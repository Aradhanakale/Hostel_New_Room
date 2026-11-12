import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { createNotificationWithEmail } from '../lib/emailStub';
import { writeAuditLog } from './auditService';
import { canStudentMoveIntoRoom, getActivePolicy } from './policyValidator';

/**
 * Executes Warden final approval in ONE atomic database transaction.
 * Either all room/bed occupancies change together, or none change on any error.
 */
export async function wardenApproveSwapGroup(params: {
  swapGroupId: string;
  wardenUserId: string;
  wardenEmail: string;
  wardenRole: string;
  remarks?: string;
}) {
  const { swapGroupId, wardenUserId, wardenEmail, wardenRole, remarks } = params;

  return prisma.$transaction(async (tx) => {
    const group = await tx.swapGroup.findUnique({
      where: { id: swapGroupId },
      include: {
        participants: {
          orderBy: { stepOrder: 'asc' },
          include: {
            student: { include: { user: true, bed: true } },
            exchangeRequest: true,
            fromRoom: {
              include: {
                beds: { include: { student: { select: { year: true } } } },
              },
            },
            toRoom: {
              include: {
                beds: { include: { student: { select: { year: true } } } },
              },
            },
            fromBed: true,
            toBed: true,
          },
        },
      },
    });

    if (!group) {
      throw new AppError(404, 'NOT_FOUND', 'Swap cycle not found.');
    }

    if (group.status !== 'AWAITING_WARDEN') {
      throw new AppError(
        400,
        'INVALID_STATE',
        `Swap cycle ${group.cycleCode} is in state ${group.status}; must be AWAITING_WARDEN to approve.`
      );
    }

    const allAccepted = group.participants.every((p) => p.decision === 'ACCEPTED');
    if (!allAccepted) {
      throw new AppError(
        400,
        'INCOMPLETE_ACCEPTANCE',
        'All participants must accept before warden approval.'
      );
    }

    // Re-verify current bed occupancies & policy invariants right before mutating
    const policy = await getActivePolicy(null);
    for (const p of group.participants) {
      if (p.fromBed.studentId !== p.studentId || p.student.bed?.id !== p.fromBedId) {
        throw new AppError(
          409,
          'CONCURRENT_OCCUPANCY_CONFLICT',
          `Occupancy conflict: ${p.student.user.name} no longer holds bed ${p.fromBed.bedLabel} in Room ${p.fromRoom.roomNumber}.`
        );
      }

      const moveCheck = canStudentMoveIntoRoom({
        student: {
          id: p.student.id,
          gender: p.student.gender,
          year: p.student.year,
          acEligible: p.student.acEligible,
          isRestricted: p.student.isRestricted,
          swapsThisSemester: p.student.swapsThisSemester,
          lastSwapAt: p.student.lastSwapAt,
          hasActiveRequest: false,
        },
        currentRoom: {
          id: p.fromRoom.id,
          roomNumber: p.fromRoom.roomNumber,
          hostelId: p.fromRoom.hostelId,
          blockId: p.fromRoom.blockId,
          floor: p.fromRoom.floor,
          type: p.fromRoom.type,
          bedCount: p.fromRoom.bedCount,
          capacity: p.fromRoom.capacity,
          gender: p.fromRoom.gender,
          status: p.fromRoom.status,
        },
        targetRoom: {
          id: p.toRoom.id,
          roomNumber: p.toRoom.roomNumber,
          hostelId: p.toRoom.hostelId,
          blockId: p.toRoom.blockId,
          floor: p.toRoom.floor,
          type: p.toRoom.type,
          bedCount: p.toRoom.bedCount,
          capacity: p.toRoom.capacity,
          gender: p.toRoom.gender,
          status: p.toRoom.status,
        },
        policy,
      });

      if (!moveCheck.allowed) {
        throw new AppError(
          400,
          'POLICY_VIOLATION_AT_APPROVAL',
          `Policy check failed for ${p.student.user.name}: ${moveCheck.reason}`
        );
      }
    }

    const now = new Date();

    // Step 1: Temporarily vacate all source beds so unique studentId constraint won't collide
    await tx.bed.updateMany({
      where: { id: { in: group.participants.map((p) => p.fromBedId) } },
      data: { studentId: null, occupiedAt: null },
    });

    // Step 2: Assign every participant to their destination bed & update stats
    const roomIds = Array.from(new Set(group.participants.map((p) => p.toRoomId)));
    const oldAllocations: Array<Record<string, string>> = [];
    const newAllocations: Array<Record<string, string>> = [];

    for (const p of group.participants) {
      await tx.bed.update({
        where: { id: p.toBedId },
        data: {
          studentId: p.studentId,
          occupiedAt: now,
        },
      });

      await tx.student.update({
        where: { id: p.studentId },
        data: {
          swapsThisSemester: { increment: 1 },
          lastSwapAt: now,
        },
      });

      await tx.exchangeRequest.update({
        where: { id: p.exchangeRequestId },
        data: { status: 'COMPLETED' },
      });

      oldAllocations.push({
        student: p.student.user.email,
        room: p.fromRoom.roomNumber,
        bed: p.fromBed.bedLabel,
      });
      newAllocations.push({
        student: p.student.user.email,
        room: p.toRoom.roomNumber,
        bed: p.toBed.bedLabel,
      });

      await writeAuditLog(tx, {
        actorId: wardenUserId,
        actorEmail: wardenEmail,
        actorRole: wardenRole,
        action: 'ROOM_REALLOCATED',
        entityType: 'STUDENT',
        entityId: p.student.rollNumber,
        oldValue: {
          room: p.fromRoom.roomNumber,
          bed: p.fromBed.bedLabel,
          roomType: p.fromRoom.type,
        },
        newValue: {
          room: p.toRoom.roomNumber,
          bed: p.toBed.bedLabel,
          roomType: p.toRoom.type,
        },
        remarks: `Executed via ${group.cycleCode}${remarks ? ` (${remarks})` : ''}`,
      });
    }

    // Step 3: Increment optimistic concurrency versions on all affected rooms
    for (const rId of roomIds) {
      await tx.room.update({
        where: { id: rId },
        data: { version: { increment: 1 } },
      });
    }

    // Step 4: Record Warden Approval and mark SwapGroup COMPLETED
    const approval = await tx.approval.create({
      data: {
        swapGroupId: group.id,
        wardenId: wardenUserId,
        decision: 'APPROVED',
        remarks: remarks || 'Approved by Warden',
      },
    });

    const completedGroup = await tx.swapGroup.update({
      where: { id: group.id },
      data: { status: 'COMPLETED' },
    });

    await writeAuditLog(tx, {
      actorId: wardenUserId,
      actorEmail: wardenEmail,
      actorRole: wardenRole,
      action: 'WARDEN_APPROVED_SWAP',
      entityType: 'SWAP_GROUP',
      entityId: group.cycleCode,
      oldValue: oldAllocations,
      newValue: newAllocations,
      remarks: remarks || 'Atomic swap executed successfully.',
    });

    // Step 5: Notify all participants (+ email stub)
    for (const p of group.participants) {
      await createNotificationWithEmail(tx, {
        userId: p.student.userId,
        email: p.student.user.email,
        title: `Room Swap Completed (${group.cycleCode})`,
        message: `Your room swap has been approved by the Warden! You are now assigned to Room ${p.toRoom.roomNumber} (${p.toRoom.type}, Bed ${p.toBed.bedLabel}).`,
        type: 'SWAP_COMPLETED',
        relatedEntityId: group.id,
      });
    }

    return { group: completedGroup, approval };
  });
}

export async function wardenRejectSwapGroup(params: {
  swapGroupId: string;
  wardenUserId: string;
  wardenEmail: string;
  wardenRole: string;
  remarks: string;
}) {
  const { swapGroupId, wardenUserId, wardenEmail, wardenRole, remarks } = params;

  if (!remarks || remarks.trim().length < 3) {
    throw new AppError(400, 'REMARKS_REQUIRED', 'Rejection remarks are required.');
  }

  return prisma.$transaction(async (tx) => {
    const group = await tx.swapGroup.findUnique({
      where: { id: swapGroupId },
      include: {
        participants: {
          include: {
            student: { include: { user: true } },
            exchangeRequest: true,
          },
        },
      },
    });

    if (!group) {
      throw new AppError(404, 'NOT_FOUND', 'Swap cycle not found.');
    }

    if (group.status !== 'AWAITING_WARDEN' && group.status !== 'AWAITING_ACCEPTANCE') {
      throw new AppError(
        400,
        'INVALID_STATE',
        `Cannot reject cycle in status ${group.status}.`
      );
    }

    const approval = await tx.approval.create({
      data: {
        swapGroupId: group.id,
        wardenId: wardenUserId,
        decision: 'REJECTED',
        remarks: remarks.trim(),
      },
    });

    const rejectedGroup = await tx.swapGroup.update({
      where: { id: group.id },
      data: {
        status: 'REJECTED',
        dissolveReason: `Warden rejected: ${remarks.trim()}`,
      },
    });

    await tx.exchangeRequest.updateMany({
      where: { id: { in: group.participants.map((p) => p.exchangeRequestId) } },
      data: { status: 'REJECTED' },
    });

    await writeAuditLog(tx, {
      actorId: wardenUserId,
      actorEmail: wardenEmail,
      actorRole: wardenRole,
      action: 'WARDEN_REJECTED_SWAP',
      entityType: 'SWAP_GROUP',
      entityId: group.cycleCode,
      oldValue: { status: group.status },
      newValue: { status: 'REJECTED' },
      remarks: remarks.trim(),
    });

    for (const p of group.participants) {
      await createNotificationWithEmail(tx, {
        userId: p.student.userId,
        email: p.student.user.email,
        title: `Swap Cycle ${group.cycleCode} Rejected by Warden`,
        message: `Warden rejected swap cycle ${group.cycleCode}. Reason: ${remarks.trim()}. Your room allocation remains unchanged.`,
        type: 'WARDEN_REJECTED',
        relatedEntityId: group.id,
      });
    }

    return { group: rejectedGroup, approval };
  });
}
