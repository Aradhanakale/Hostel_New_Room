import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateJWT, requireRole } from '../middleware/auth';
import { exportAuditLogsCsv, exportAuditLogsPdf } from '../services/auditService';

const router = Router();

router.use(authenticateJWT, requireRole('ADMIN', 'WARDEN'));

router.get('/', async (req, res, next) => {
  try {
    const action = req.query.action ? String(req.query.action) : undefined;
    const entityType = req.query.entityType ? String(req.query.entityType) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));

    const where = {
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...(search
        ? {
            OR: [
              { actorEmail: { contains: search, mode: 'insensitive' as const } },
              { entityId: { contains: search, mode: 'insensitive' as const } },
              { action: { contains: search, mode: 'insensitive' as const } },
              { remarks: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/export', async (req, res, next) => {
  try {
    const format = String(req.query.format || 'csv').toLowerCase();
    const action = req.query.action ? String(req.query.action) : undefined;
    const entityType = req.query.entityType ? String(req.query.entityType) : undefined;

    if (format === 'pdf') {
      const buffer = await exportAuditLogsPdf({ action, entityType });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-trail.pdf"');
      res.send(buffer);
      return;
    }

    const csv = await exportAuditLogsCsv({ action, entityType });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-trail.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

export default router;
