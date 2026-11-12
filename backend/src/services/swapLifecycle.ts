import { ParticipantDecision } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { createNotificationWithEmail } from '../lib/emailStub';
import { writeAuditLog } from './auditService';
import {
  detectAllCycles,
  GraphRequestNode,
  selectDisjointCycles,
} from './cycleDetector';
import { getActivePolicy, RoomContext, StudentContext } from './policyValidator';

let cycleSeqCache = 0;

async function generateCycleCode(): Promise<string> {
  if (cycleSeqCache === 0) {
    const count = await prisma.swapGroup.count();
    cycleSeqCache = 100 + count;
  }
  cycleSeqCache += 1;
  return `CYC-${cycleSeqCache}`;
}

/**
 * Expires stale PENDING exchange requests past expiresAt and dissolves
 * AWAITING_ACCEPTANCE swap groups past acceptanceDeadline.
 */
export async function expireStaleEntities(): Promise<{
  expiredRequests: number;
  dissolvedCycles: number;
}> {
  const now = new Date();
  let expiredRequests = 0;
  let dissolvedCycles = 0;

  // 1. Dissolve timed-out swap groups
  const timedOutGroups = await prisma.swapGroup.findMany({
    where: {
      status: 'AWAITING_ACCEPTANCE',
      acceptanceDeadline: { lt: now },
    },
    include: {
      participants: {
        include: {
          student: { include: { user: true } },
          exchangeRequest: true,
        },
      },
    },
  });

  for (const group of timedOutGroups) {
    await prisma.$transaction(async (tx) => {
      await tx.swapGroup.update({
        where: { id: group.id },
        data: {
          status: 'DISSOLVED',
          dissolveReason: 'Acceptance window timed out before all participants accepted.',
        },
      });

      for (const p of group.participants) {
        if (p.decision === 'PENDING') {
          await tx.swapParticipant.update({
            where: { id: p.id },
            data: { decision: 'TIMED_OUT', respondedAt: now },
          });
        }

        // Release request back to pool unless expired
        const reqExpired = p.exchangeRequest.expiresAt <= now;
        await tx.exchangeRequest.update({
          where: { id: p.exchangeRequestId },
          data: {
            status: reqExpired ? 'EXPIRED' : 'PENDING',
            lockedCycleId: null,
          },
        });

        await createNotificationWithEmail(tx, {
          userId: p.student.userId,
          email: p.student.user.email,
          title: `Swap Cycle ${group.cycleCode} Timed Out`,
          message: reqExpired
            ? `Cycle ${group.cycleCode} expired and your request ${p.exchangeRequest.requestCode} also reached its expiry date.`
            : `Cycle ${group.cycleCode} was dissolved due to acceptance timeout. Your request ${p.exchangeRequest.requestCode} has been returned to the matching pool.`,
          type: 'CYCLE_DISSOLVED',
          relatedEntityId: group.id,
        });
      }

      await writeAuditLog(tx, {
        actorId: null,
        actorEmail: 'system@hostelswap.edu',
        actorRole: 'SYSTEM',
        action: 'CYCLE_TIMED_OUT',
        entityType: 'SWAP_GROUP',
        entityId: group.cycleCode,
        oldValue: { status: 'AWAITING_ACCEPTANCE' },
        newValue: { status: 'DISSOLVED' },
        remarks: 'Acceptance timeout elapsed; participants released.',
      });
    });
    dissolvedCycles += 1;
  }

  // 2. Expire stale pending requests
  const staleRequests = await prisma.exchangeRequest.findMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: now },
    },
    include: {
      student: { include: { user: true } },
    },
  });

  if (staleRequests.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const req of staleRequests) {
        await tx.exchangeRequest.update({
          where: { id: req.id },
          data: { status: 'EXPIRED' },
        });
        await createNotificationWithEmail(tx, {
          userId: req.student.userId,
          email: req.student.user.email,
          title: `Exchange Request ${req.requestCode} Expired`,
          message: `Your room exchange request ${req.requestCode} has reached its expiry date without completing a swap.`,
          type: 'REQUEST_EXPIRED',
          relatedEntityId: req.id,
        });
      }
    });
    expiredRequests = staleRequests.length;
  }

  return { expiredRequests, dissolvedCycles };
}

/**
 * Loads all active PENDING requests, builds the directed graph, detects cycles
 * (direct 2-way and multi-party up to maxCycleLength), ranks them, locks disjoint cycles,
 * and sends match notifications.
 */
export async function runCycleDetectionAndLock(): Promise<{
  cyclesCreated: number;
  createdGroupIds: string[];
}> {
  await expireStaleEntities();

  const policy = await getActivePolicy(null);
  const now = new Date();

  const pendingRequests = await prisma.exchangeRequest.findMany({
    where: {
      status: 'PENDING',
      lockedCycleId: null,
      expiresAt: { gt: now },
    },
    include: {
      student: {
        include: {
          user: true,
          bed: true,
        },
      },
      currentRoom: {
        include: {
          beds: {
            include: {
              student: { select: { year: true } },
            },
          },
        },
      },
      currentBed: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (pendingRequests.length < 2) {
    return { cyclesCreated: 0, createdGroupIds: [] };
  }

  const graphNodes: GraphRequestNode[] = pendingRequests
    .filter((r) => !r.student.isRestricted && r.student.bed?.id === r.currentBedId)
    .map((r) => {
      const occupantYears = r.currentRoom.beds
        .map((b) => b.student?.year)
        .filter((y): y is number => typeof y === 'number');

      const studentCtx: StudentContext = {
        id: r.student.id,
        gender: r.student.gender,
        year: r.student.year,
        acEligible: r.student.acEligible,
        isRestricted: r.student.isRestricted,
        swapsThisSemester: r.student.swapsThisSemester,
        lastSwapAt: r.student.lastSwapAt,
        hasActiveRequest: false,
      };

      const roomCtx: RoomContext = {
        id: r.currentRoom.id,
        roomNumber: r.currentRoom.roomNumber,
        hostelId: r.currentRoom.hostelId,
        blockId: r.currentRoom.blockId,
        floor: r.currentRoom.floor,
        type: r.currentRoom.type,
        bedCount: r.currentRoom.bedCount,
        capacity: r.currentRoom.capacity,
        gender: r.currentRoom.gender,
        status: r.currentRoom.status,
        occupantYears,
      };

      return {
        requestId: r.id,
        requestCode: r.requestCode,
        studentId: r.student.id,
        studentName: r.student.user.name,
        student: studentCtx,
        currentRoom: roomCtx,
        currentBedId: r.currentBed.id,
        currentBedLabel: r.currentBed.bedLabel,
        desiredRoomId: r.desiredRoomId,
        desiredHostelId: r.desiredHostelId,
        desiredBlockId: r.desiredBlockId,
        desiredFloor: r.desiredFloor,
        desiredRoomType: r.desiredRoomType,
        desiredBedCount: r.desiredBedCount,
        createdAt: r.createdAt,
      };
    });

  const allCycles = detectAllCycles(graphNodes, policy);
  const selectedCycles = selectDisjointCycles(allCycles);

  const createdGroupIds: string[] = [];

  for (const cycle of selectedCycles) {
    const cycleCode = await generateCycleCode();
    const acceptanceDeadline = new Date(
      now.getTime() + policy.acceptanceTimeoutHours * 60 * 60 * 1000
    );

    const createdId = await prisma.$transaction(async (tx) => {
      // Optimistic conflict guard: ensure all requests are still PENDING and unlocked
      const lockedCheck = await tx.exchangeRequest.findMany({
        where: {
          id: { in: cycle.nodes.map((n) => n.requestId) },
          status: 'PENDING',
          lockedCycleId: null,
        },
        select: { id: true },
      });

      if (lockedCheck.length !== cycle.nodes.length) {
        return null; // Conflict detected, skip safely
      }

      const group = await tx.swapGroup.create({
        data: {
          cycleCode,
          type: cycle.type,
          length: cycle.length,
          status: 'AWAITING_ACCEPTANCE',
          acceptanceDeadline,
        },
      });

      // Node i moves into Node (i + 1) % N's room & bed
      const chainSummary: string[] = [];
      for (let i = 0; i < cycle.nodes.length; i++) {
        const fromNode = cycle.nodes[i];
        const toNode = cycle.nodes[(i + 1) % cycle.nodes.length];
        chainSummary.push(`${fromNode.studentName} (${fromNode.currentRoom.roomNumber}) -> ${toNode.currentRoom.roomNumber}`);

        await tx.swapParticipant.create({
          data: {
            swapGroupId: group.id,
            exchangeRequestId: fromNode.requestId,
            studentId: fromNode.studentId,
            fromRoomId: fromNode.currentRoom.id,
            fromBedId: fromNode.currentBedId,
            toRoomId: toNode.currentRoom.id,
            toBedId: toNode.currentBedId,
            stepOrder: i,
            decision: 'PENDING',
          },
        });

        await tx.exchangeRequest.update({
          where: { id: fromNode.requestId },
          data: {
            status: 'IN_CYCLE',
            lockedCycleId: group.id,
          },
        });

        const studentRecord = pendingRequests.find((r) => r.id === fromNode.requestId)!.student;
        await createNotificationWithEmail(tx, {
          userId: studentRecord.userId,
          email: studentRecord.user.email,
          title: `${cycle.type === 'DIRECT' ? 'Direct Swap' : `${cycle.length}-Way Swap Cycle`} Found (${cycleCode})`,
          message: `Match detected for request ${fromNode.requestCode}! Move from Room ${fromNode.currentRoom.roomNumber} (${fromNode.currentBedLabel}) to Room ${toNode.currentRoom.roomNumber} (${toNode.currentBedLabel}). Please accept before ${acceptanceDeadline.toISOString().slice(0, 16)}.`,
          type: 'ACCEPT_REQUIRED',
          relatedEntityId: group.id,
        });
      }

      await writeAuditLog(tx, {
        actorId: null,
        actorEmail: 'system@hostelswap.edu',
        actorRole: 'SYSTEM',
        action: 'SWAP_CYCLE_DETECTED',
        entityType: 'SWAP_GROUP',
        entityId: cycleCode,
        newValue: {
          type: cycle.type,
          length: cycle.length,
          chain: chainSummary,
        },
        remarks: `Automatically matched and locked ${cycle.length} participants.`,
      });

      return group.id;
    });

    if (createdId) {
      createdGroupIds.push(createdId);
    }
  }

  return {
    cyclesCreated: createdGroupIds.length,
    createdGroupIds,
  };
}

/**
 * Student accepts or rejects their participation in a SwapGroup.
 * If rejected -> dissolves cycle and releases all other requests back to PENDING.
 * If accepted & all accepted -> transitions to AWAITING_WARDEN and notifies Wardens.
 */
export async function respondToSwapGroup(params: {
  swapGroupId: string;
  userId: string;
  decision: 'ACCEPTED' | 'REJECTED';
  remarks?: string;
}) {
  const { swapGroupId, userId, decision, remarks } = params;

  await expireStaleEntities();

  const student = await prisma.student.findUnique({
    where: { userId },
    include: { user: true },
  });
  if (!student) {
    throw new AppError(403, 'FORBIDDEN', 'Only students with an active profile can respond to swap chains.');
  }

  const group = await prisma.swapGroup.findUnique({
    where: { id: swapGroupId },
    include: {
      participants: {
        orderBy: { stepOrder: 'asc' },
        include: {
          student: { include: { user: true } },
          exchangeRequest: true,
          fromRoom: true,
          toRoom: true,
        },
      },
    },
  });

  if (!group) {
    throw new AppError(404, 'NOT_FOUND', 'Swap cycle not found.');
  }

  if (group.status !== 'AWAITING_ACCEPTANCE') {
    throw new AppError(
      400,
      'INVALID_STATE',
      `This swap cycle is currently ${group.status} and cannot accept participant responses.`
    );
  }

  const participant = group.participants.find((p) => p.studentId === student.id);
  if (!participant) {
    throw new AppError(403, 'FORBIDDEN', 'You are not a participant in this swap cycle.');
  }

  if (participant.decision !== 'PENDING') {
    throw new AppError(400, 'ALREADY_RESPONDED', `You have already marked this swap as ${participant.decision}.`);
  }

  const now = new Date();

  if (decision === 'REJECTED') {
    const updatedGroup = await prisma.$transaction(async (tx) => {
      await tx.swapParticipant.update({
        where: { id: participant.id },
        data: {
          decision: 'REJECTED',
          respondedAt: now,
          remarks: remarks || 'Declined by participant',
        },
      });

      const dissolved = await tx.swapGroup.update({
        where: { id: group.id },
        data: {
          status: 'DISSOLVED',
          dissolveReason: `Declined by ${student.user.name}${remarks ? `: ${remarks}` : ''}`,
        },
      });

      // Release all OTHER participants' requests back to PENDING; mark rejector's request CANCELLED or PENDING
      for (const p of group.participants) {
        const isRejector = p.id === participant.id;
        await tx.exchangeRequest.update({
          where: { id: p.exchangeRequestId },
          data: {
            status: isRejector ? 'CANCELLED' : 'PENDING',
            lockedCycleId: null,
          },
        });

        if (!isRejector) {
          await createNotificationWithEmail(tx, {
            userId: p.student.userId,
            email: p.student.user.email,
            title: `Swap Cycle ${group.cycleCode} Dissolved`,
            message: `Participant ${student.user.name} declined the swap. Your request ${p.exchangeRequest.requestCode} has been released back to the matching pool.`,
            type: 'CYCLE_DISSOLVED',
            relatedEntityId: group.id,
          });
        }
      }

      await writeAuditLog(tx, {
        actorId: student.userId,
        actorEmail: student.user.email,
        actorRole: 'STUDENT',
        action: 'SWAP_PARTICIPANT_REJECTED',
        entityType: 'SWAP_GROUP',
        entityId: group.cycleCode,
        oldValue: { status: 'AWAITING_ACCEPTANCE' },
        newValue: { status: 'DISSOLVED', rejectedBy: student.user.email },
        remarks: remarks || 'Participant declined swap; cycle dissolved and peers released.',
      });

      return dissolved;
    });

    // Trigger re-matching for released peers
    await runCycleDetectionAndLock();

    return { group: updatedGroup, allAccepted: false };
  }

  // ACCEPTED path
  const result = await prisma.$transaction(async (tx) => {
    await tx.swapParticipant.update({
      where: { id: participant.id },
      data: {
        decision: ParticipantDecision.ACCEPTED,
        respondedAt: now,
        remarks: remarks || null,
      },
    });

    const othersPending = group.participants.some(
      (p) => p.id !== participant.id && p.decision !== 'ACCEPTED'
    );

    await writeAuditLog(tx, {
      actorId: student.userId,
      actorEmail: student.user.email,
      actorRole: 'STUDENT',
      action: 'SWAP_PARTICIPANT_ACCEPTED',
      entityType: 'SWAP_GROUP',
      entityId: group.cycleCode,
      newValue: { participant: student.user.email, decision: 'ACCEPTED' },
    });

    if (!othersPending) {
      const updatedGroup = await tx.swapGroup.update({
        where: { id: group.id },
        data: { status: 'AWAITING_WARDEN' },
      });

      await tx.exchangeRequest.updateMany({
        where: { id: { in: group.participants.map((p) => p.exchangeRequestId) } },
        data: { status: 'AWAITING_WARDEN' },
      });

      // Notify all Wardens
      const wardens = await tx.user.findMany({
        where: { role: 'WARDEN', isActive: true },
      });
      for (const w of wardens) {
        await createNotificationWithEmail(tx, {
          userId: w.id,
          email: w.email,
          title: `Warden Approval Needed: ${group.cycleCode}`,
          message: `All ${group.length} participants have accepted swap cycle ${group.cycleCode}. Ready for final approval.`,
          type: 'ACCEPT_REQUIRED',
          relatedEntityId: group.id,
        });
      }

      // Notify participants
      for (const p of group.participants) {
        await createNotificationWithEmail(tx, {
          userId: p.student.userId,
          email: p.student.user.email,
          title: `All Participants Accepted (${group.cycleCode})`,
          message: `Every participant accepted cycle ${group.cycleCode}. Your swap is now awaiting Warden approval. Room allocations remain unchanged until approved.`,
          type: 'MATCH_FOUND',
          relatedEntityId: group.id,
        });
      }

      return { group: updatedGroup, allAccepted: true };
    }

    return { group, allAccepted: false };
  });

  return result;
}
