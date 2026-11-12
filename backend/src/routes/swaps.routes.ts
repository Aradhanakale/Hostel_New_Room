import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { authenticateJWT, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  expireStaleEntities,
  respondToSwapGroup,
  runCycleDetectionAndLock,
} from '../services/swapLifecycle';

const router = Router();

const respondSchema = z.object({
  decision: z.enum(['ACCEPTED', 'REJECTED']),
  remarks: z.string().max(300).optional(),
});

router.get('/matches', authenticateJWT, async (req, res, next) => {
  try {
    await expireStaleEntities();

    const isPrivileged = req.user!.role === 'WARDEN' || req.user!.role === 'ADMIN';
    let studentId: string | undefined;

    if (!isPrivileged) {
      const student = await prisma.student.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!student) {
        res.json({ success: true, data: [] });
        return;
      }
      studentId = student.id;
    }

    const groups = await prisma.swapGroup.findMany({
      where: studentId
        ? {
            participants: {
              some: { studentId },
            },
          }
        : undefined,
      include: {
        approvals: {
          include: {
            warden: { select: { id: true, name: true, email: true } },
          },
        },
        participants: {
          orderBy: { stepOrder: 'asc' },
          include: {
            exchangeRequest: {
              select: { id: true, requestCode: true, reason: true },
            },
            student: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
            fromRoom: { include: { hostel: true, block: true } },
            fromBed: true,
            toRoom: { include: { hostel: true, block: true } },
            toBed: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: groups });
  } catch (err) {
    next(err);
  }
});

router.get('/:groupId', authenticateJWT, async (req, res, next) => {
  try {
    const group = await prisma.swapGroup.findUnique({
      where: { id: String(req.params.groupId) },
      include: {
        approvals: {
          include: {
            warden: { select: { id: true, name: true, email: true } },
          },
        },
        participants: {
          orderBy: { stepOrder: 'asc' },
          include: {
            exchangeRequest: { select: { id: true, requestCode: true, reason: true } },
            student: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
            fromRoom: { include: { hostel: true, block: true } },
            fromBed: true,
            toRoom: { include: { hostel: true, block: true } },
            toBed: true,
          },
        },
      },
    });

    if (!group) {
      throw new AppError(404, 'NOT_FOUND', 'Swap cycle not found.');
    }

    if (req.user!.role === 'STUDENT') {
      const isParticipant = group.participants.some(
        (p) => p.student.userId === req.user!.userId
      );
      if (!isParticipant) {
        throw new AppError(403, 'FORBIDDEN', 'You are not a participant in this swap cycle.');
      }
    }

    res.json({ success: true, data: group });
  } catch (err) {
    next(err);
  }
});

router.post('/detect', authenticateJWT, async (_req, res, next) => {
  try {
    const result = await runCycleDetectionAndLock();
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/:groupId/respond',
  authenticateJWT,
  requireRole('STUDENT'),
  validateBody(respondSchema),
  async (req, res, next) => {
    try {
      const result = await respondToSwapGroup({
        swapGroupId: String(req.params.groupId),
        userId: req.user!.userId,
        decision: req.body.decision,
        remarks: req.body.remarks,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
