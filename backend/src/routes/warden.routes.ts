import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateJWT, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  wardenApproveSwapGroup,
  wardenRejectSwapGroup,
} from '../services/wardenApproval';

const router = Router();

const decisionSchema = z.object({
  remarks: z.string().max(500).optional().default(''),
});

const rejectSchema = z.object({
  remarks: z.string().min(3, 'Rejection remarks are required (minimum 3 characters).').max(500),
});

router.use(authenticateJWT, requireRole('WARDEN', 'ADMIN'));

router.get('/queue', async (_req, res, next) => {
  try {
    const [pendingQueue, recentDecisions] = await Promise.all([
      prisma.swapGroup.findMany({
        where: { status: 'AWAITING_WARDEN' },
        include: {
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
        orderBy: { updatedAt: 'asc' },
      }),
      prisma.swapGroup.findMany({
        where: { status: { in: ['COMPLETED', 'REJECTED'] } },
        include: {
          approvals: {
            include: {
              warden: { select: { id: true, name: true, email: true } },
            },
          },
          participants: {
            orderBy: { stepOrder: 'asc' },
            include: {
              student: {
                include: { user: { select: { id: true, name: true, email: true } } },
              },
              fromRoom: true,
              toRoom: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 25,
      }),
    ]);

    res.json({
      success: true,
      data: {
        pendingQueue,
        recentDecisions,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/swaps/:groupId/approve',
  validateBody(decisionSchema),
  async (req, res, next) => {
    try {
      const result = await wardenApproveSwapGroup({
        swapGroupId: String(req.params.groupId),
        wardenUserId: req.user!.userId,
        wardenEmail: req.user!.email,
        wardenRole: req.user!.role,
        remarks: req.body.remarks,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/swaps/:groupId/reject',
  validateBody(rejectSchema),
  async (req, res, next) => {
    try {
      const result = await wardenRejectSwapGroup({
        swapGroupId: String(req.params.groupId),
        wardenUserId: req.user!.userId,
        wardenEmail: req.user!.email,
        wardenRole: req.user!.role,
        remarks: req.body.remarks,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
