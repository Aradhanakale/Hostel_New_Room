import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateJWT } from '../middleware/auth';
import { getRecentEmailStubs } from '../lib/emailStub';

const router = Router();

router.use(authenticateJWT);

router.get('/', async (req, res, next) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user!.userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.notification.count({
        where: { userId: req.user!.userId, isRead: false },
      }),
    ]);

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: {
        id: String(req.params.id),
        userId: req.user!.userId,
      },
      data: { isRead: true },
    });
    res.json({ success: true, data: { markedRead: true } });
  } catch (err) {
    next(err);
  }
});

router.post('/read-all', async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.userId, isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true, data: { markedAllRead: true } });
  } catch (err) {
    next(err);
  }
});

router.get('/email-stubs', async (_req, res) => {
  res.json({ success: true, data: getRecentEmailStubs() });
});

export default router;
