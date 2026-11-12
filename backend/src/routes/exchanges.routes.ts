import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { authenticateJWT, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { writeAuditLog } from '../services/auditService';
import {
  evaluateExchangeRequestPolicy,
  getActivePolicy,
  RoomContext,
  StudentContext,
} from '../services/policyValidator';
import {
  expireStaleEntities,
  runCycleDetectionAndLock,
} from '../services/swapLifecycle';
import { createNotificationWithEmail } from '../lib/emailStub';

const router = Router();

const createExchangeSchema = z.object({
  desiredRoomId: z.string().optional().nullable(),
  desiredHostelId: z.string().optional().nullable(),
  desiredBlockId: z.string().optional().nullable(),
  desiredFloor: z.coerce.number().int().min(0).max(20).optional().nullable(),
  desiredRoomType: z.enum(['AC', 'NON_AC', 'ANY']).default('ANY'),
  desiredBedCount: z.coerce.number().int().min(1).max(6).optional().nullable(),
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(500),
  expiresAt: z.string().datetime().or(z.string().min(8)),
});

async function buildStudentAndRoomValidationContext(userId: string, desiredRoomId?: string | null) {
  const student = await prisma.student.findUnique({
    where: { userId },
    include: {
      user: true,
      bed: {
        include: {
          room: {
            include: {
              beds: { include: { student: { select: { year: true } } } },
            },
          },
        },
      },
    },
  });

  if (!student) {
    throw new AppError(403, 'FORBIDDEN', 'Only students can submit exchange requests.');
  }

  const activeExisting = await prisma.exchangeRequest.findFirst({
    where: {
      studentId: student.id,
      status: { in: ['PENDING', 'IN_CYCLE', 'AWAITING_WARDEN'] },
    },
  });

  const currentBed = student.bed;
  const currentRoom = currentBed?.room ?? null;

  let targetRoomRecord = null;
  if (desiredRoomId) {
    targetRoomRecord = await prisma.room.findUnique({
      where: { id: desiredRoomId },
      include: {
        beds: { include: { student: { select: { year: true } } } },
      },
    });
  }

  const studentCtx: StudentContext = {
    id: student.id,
    gender: student.gender,
    year: student.year,
    acEligible: student.acEligible,
    isRestricted: student.isRestricted,
    swapsThisSemester: student.swapsThisSemester,
    lastSwapAt: student.lastSwapAt,
    hasActiveRequest: Boolean(activeExisting),
  };

  const currentRoomCtx: RoomContext | null = currentRoom
    ? {
        id: currentRoom.id,
        roomNumber: currentRoom.roomNumber,
        hostelId: currentRoom.hostelId,
        blockId: currentRoom.blockId,
        floor: currentRoom.floor,
        type: currentRoom.type,
        bedCount: currentRoom.bedCount,
        capacity: currentRoom.capacity,
        gender: currentRoom.gender,
        status: currentRoom.status,
        occupantYears: currentRoom.beds
          .map((b) => b.student?.year)
          .filter((y): y is number => typeof y === 'number'),
      }
    : null;

  const targetRoomCtx: RoomContext | null = targetRoomRecord
    ? {
        id: targetRoomRecord.id,
        roomNumber: targetRoomRecord.roomNumber,
        hostelId: targetRoomRecord.hostelId,
        blockId: targetRoomRecord.blockId,
        floor: targetRoomRecord.floor,
        type: targetRoomRecord.type,
        bedCount: targetRoomRecord.bedCount,
        capacity: targetRoomRecord.capacity,
        gender: targetRoomRecord.gender,
        status: targetRoomRecord.status,
        occupantYears: targetRoomRecord.beds
          .map((b) => b.student?.year)
          .filter((y): y is number => typeof y === 'number'),
      }
    : null;

  const policy = await getActivePolicy(currentRoom?.hostelId);

  return { student, currentBed, currentRoom, studentCtx, currentRoomCtx, targetRoomCtx, policy };
}

router.post(
  '/validate-preview',
  authenticateJWT,
  requireRole('STUDENT'),
  validateBody(createExchangeSchema.partial({ reason: true, expiresAt: true })),
  async (req, res, next) => {
    try {
      const { desiredRoomId, desiredRoomType = 'ANY', desiredBedCount, expiresAt } = req.body;
      const ctx = await buildStudentAndRoomValidationContext(req.user!.userId, desiredRoomId);
      const parsedExpiry = expiresAt
        ? new Date(expiresAt)
        : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      const validation = evaluateExchangeRequestPolicy({
        student: ctx.studentCtx,
        currentRoom: ctx.currentRoomCtx,
        targetRoom: ctx.targetRoomCtx,
        criteria: {
          desiredRoomId,
          desiredRoomType,
          desiredBedCount,
          expiresAt: parsedExpiry,
        },
        policy: ctx.policy,
      });

      res.json({ success: true, data: validation });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/',
  authenticateJWT,
  requireRole('STUDENT'),
  validateBody(createExchangeSchema),
  async (req, res, next) => {
    try {
      await expireStaleEntities();

      const {
        desiredRoomId,
        desiredHostelId,
        desiredBlockId,
        desiredFloor,
        desiredRoomType,
        desiredBedCount,
        reason,
        expiresAt,
      } = req.body;

      const parsedExpiry = new Date(expiresAt);
      if (Number.isNaN(parsedExpiry.getTime())) {
        throw new AppError(400, 'INVALID_DATE', 'Invalid expiry date format.');
      }

      const ctx = await buildStudentAndRoomValidationContext(req.user!.userId, desiredRoomId);

      const validation = evaluateExchangeRequestPolicy({
        student: ctx.studentCtx,
        currentRoom: ctx.currentRoomCtx,
        targetRoom: ctx.targetRoomCtx,
        criteria: {
          desiredRoomId,
          desiredRoomType,
          desiredBedCount,
          expiresAt: parsedExpiry,
        },
        policy: ctx.policy,
      });

      if (!validation.passed || !ctx.currentBed || !ctx.currentRoom) {
        const failedChecks = validation.checks.filter((c) => !c.passed);
        throw new AppError(
          422,
          'POLICY_VALIDATION_FAILED',
          failedChecks.map((f) => f.message).join(' '),
          { validation }
        );
      }

      const count = await prisma.exchangeRequest.count();
      const requestCode = `EX-${1001 + count}`;

      const createdRequest = await prisma.$transaction(async (tx) => {
        const created = await tx.exchangeRequest.create({
          data: {
            requestCode,
            studentId: ctx.student.id,
            currentRoomId: ctx.currentRoom!.id,
            currentBedId: ctx.currentBed!.id,
            desiredRoomId: desiredRoomId || null,
            desiredHostelId: desiredHostelId || null,
            desiredBlockId: desiredBlockId || null,
            desiredFloor: desiredFloor ?? null,
            desiredRoomType,
            desiredBedCount: desiredBedCount ?? null,
            reason,
            expiresAt: parsedExpiry,
            status: 'PENDING',
            validationSnapshot: validation as unknown as Prisma.InputJsonValue,
          },
          include: {
            currentRoom: { include: { hostel: true, block: true } },
            currentBed: true,
            desiredRoom: { include: { hostel: true, block: true } },
            desiredHostel: true,
            desiredBlock: true,
          },
        });

        await writeAuditLog(tx, {
          actorId: ctx.student.userId,
          actorEmail: ctx.student.user.email,
          actorRole: 'STUDENT',
          action: 'EXCHANGE_REQUEST_CREATED',
          entityType: 'EXCHANGE_REQUEST',
          entityId: created.requestCode,
          newValue: {
            currentRoom: ctx.currentRoom!.roomNumber,
            desiredRoom: created.desiredRoom?.roomNumber || desiredRoomType,
            reason,
          },
        });

        return created;
      });

      // Immediately run swap cycle detection!
      const matchRun = await runCycleDetectionAndLock();

      // Re-fetch request to see if it matched immediately
      const refreshed = await prisma.exchangeRequest.findUnique({
        where: { id: createdRequest.id },
        include: {
          currentRoom: { include: { hostel: true, block: true } },
          currentBed: true,
          desiredRoom: { include: { hostel: true, block: true } },
          desiredHostel: true,
          desiredBlock: true,
          lockedCycle: {
            include: {
              participants: {
                orderBy: { stepOrder: 'asc' },
                include: {
                  student: { include: { user: { select: { id: true, name: true, email: true } } } },
                  fromRoom: true,
                  fromBed: true,
                  toRoom: true,
                  toBed: true,
                },
              },
            },
          },
        },
      });

      res.status(201).json({
        success: true,
        data: {
          request: refreshed,
          validation,
          cyclesDetectedNow: matchRun.cyclesCreated,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/', authenticateJWT, async (req, res, next) => {
  try {
    await expireStaleEntities();

    const isPrivileged = req.user!.role === 'WARDEN' || req.user!.role === 'ADMIN';
    let studentIdFilter: string | undefined;

    if (!isPrivileged) {
      const student = await prisma.student.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!student) {
        res.json({ success: true, data: [] });
        return;
      }
      studentIdFilter = student.id;
    }

    const { status } = req.query;

    const requests = await prisma.exchangeRequest.findMany({
      where: {
        ...(studentIdFilter ? { studentId: studentIdFilter } : {}),
        ...(status ? { status: String(status) as never } : {}),
      },
      include: {
        student: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        currentRoom: { include: { hostel: true, block: true } },
        currentBed: true,
        desiredRoom: { include: { hostel: true, block: true } },
        desiredHostel: true,
        desiredBlock: true,
        lockedCycle: {
          include: {
            participants: {
              orderBy: { stepOrder: 'asc' },
              include: {
                student: { include: { user: { select: { id: true, name: true, email: true } } } },
                fromRoom: true,
                fromBed: true,
                toRoom: true,
                toBed: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: requests });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticateJWT, async (req, res, next) => {
  try {
    const request = await prisma.exchangeRequest.findUnique({
      where: { id: String(req.params.id) },
      include: {
        student: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        currentRoom: { include: { hostel: true, block: true } },
        currentBed: true,
        desiredRoom: { include: { hostel: true, block: true } },
        desiredHostel: true,
        desiredBlock: true,
        lockedCycle: {
          include: {
            approvals: {
              include: { warden: { select: { id: true, name: true, email: true } } },
            },
            participants: {
              orderBy: { stepOrder: 'asc' },
              include: {
                student: { include: { user: { select: { id: true, name: true, email: true } } } },
                fromRoom: true,
                fromBed: true,
                toRoom: true,
                toBed: true,
              },
            },
          },
        },
      },
    });

    if (!request) {
      throw new AppError(404, 'NOT_FOUND', 'Exchange request not found.');
    }

    if (
      req.user!.role === 'STUDENT' &&
      request.student.userId !== req.user!.userId
    ) {
      throw new AppError(403, 'FORBIDDEN', 'You can only view your own exchange requests.');
    }

    res.json({ success: true, data: request });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', authenticateJWT, requireRole('STUDENT'), async (req, res, next) => {
  try {
    const request = await prisma.exchangeRequest.findUnique({
      where: { id: String(req.params.id) },
      include: {
        student: { include: { user: true } },
        lockedCycle: {
          include: {
            participants: {
              include: {
                student: { include: { user: true } },
                exchangeRequest: true,
              },
            },
          },
        },
      },
    });

    if (!request) {
      throw new AppError(404, 'NOT_FOUND', 'Exchange request not found.');
    }

    if (request.student.userId !== req.user!.userId) {
      throw new AppError(403, 'FORBIDDEN', 'You can only cancel your own request.');
    }

    if (!['PENDING', 'IN_CYCLE'].includes(request.status)) {
      throw new AppError(
        400,
        'CANNOT_CANCEL',
        `Cannot cancel request in status ${request.status}.`
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.exchangeRequest.update({
        where: { id: request.id },
        data: { status: 'CANCELLED', lockedCycleId: null },
      });

      if (request.lockedCycle && request.lockedCycle.status === 'AWAITING_ACCEPTANCE') {
        await tx.swapGroup.update({
          where: { id: request.lockedCycle.id },
          data: {
            status: 'DISSOLVED',
            dissolveReason: `Cancelled by ${request.student.user.name}.`,
          },
        });

        for (const p of request.lockedCycle.participants) {
          if (p.exchangeRequestId !== request.id) {
            await tx.exchangeRequest.update({
              where: { id: p.exchangeRequestId },
              data: { status: 'PENDING', lockedCycleId: null },
            });
            await createNotificationWithEmail(tx, {
              userId: p.student.userId,
              email: p.student.user.email,
              title: `Swap Cycle ${request.lockedCycle.cycleCode} Dissolved`,
              message: `${request.student.user.name} cancelled their request. Your request ${p.exchangeRequest.requestCode} was returned to the matching pool.`,
              type: 'CYCLE_DISSOLVED',
              relatedEntityId: request.lockedCycle.id,
            });
          }
        }
      }

      await writeAuditLog(tx, {
        actorId: request.student.userId,
        actorEmail: request.student.user.email,
        actorRole: 'STUDENT',
        action: 'EXCHANGE_REQUEST_CANCELLED',
        entityType: 'EXCHANGE_REQUEST',
        entityId: request.requestCode,
        oldValue: { status: request.status },
        newValue: { status: 'CANCELLED' },
      });
    });

    await runCycleDetectionAndLock();

    res.json({
      success: true,
      data: { message: 'Request cancelled successfully.' },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
