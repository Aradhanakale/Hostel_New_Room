import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { authenticateJWT, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { writeAuditLog } from '../services/auditService';
import { importRoomsFromCsv, importStudentsFromCsv } from '../services/csvImportService';

const router = Router();

router.use(authenticateJWT, requireRole('ADMIN', 'WARDEN'));

router.get('/stats', async (_req, res, next) => {
  try {
    const [
      totalRequests,
      pendingRequests,
      inCycleRequests,
      awaitingWardenRequests,
      completedRequests,
      rejectedRequests,
      totalGroups,
      completedGroups,
      dissolvedGroups,
      awaitingWardenGroups,
      rooms,
      studentsCount,
    ] = await Promise.all([
      prisma.exchangeRequest.count(),
      prisma.exchangeRequest.count({ where: { status: 'PENDING' } }),
      prisma.exchangeRequest.count({ where: { status: 'IN_CYCLE' } }),
      prisma.exchangeRequest.count({ where: { status: 'AWAITING_WARDEN' } }),
      prisma.exchangeRequest.count({ where: { status: 'COMPLETED' } }),
      prisma.exchangeRequest.count({ where: { status: 'REJECTED' } }),
      prisma.swapGroup.count(),
      prisma.swapGroup.count({ where: { status: 'COMPLETED' } }),
      prisma.swapGroup.count({ where: { status: 'DISSOLVED' } }),
      prisma.swapGroup.count({ where: { status: 'AWAITING_WARDEN' } }),
      prisma.room.findMany({
        include: {
          beds: { select: { studentId: true } },
        },
      }),
      prisma.student.count(),
    ]);

    let totalBeds = 0;
    let occupiedBeds = 0;
    let acBeds = 0;
    let acOccupied = 0;
    let nonAcBeds = 0;
    let nonAcOccupied = 0;
    const byBedCount: Record<string, { total: number; occupied: number; rooms: number }> = {};

    for (const room of rooms) {
      const occ = room.beds.filter((b) => Boolean(b.studentId)).length;
      totalBeds += room.bedCount;
      occupiedBeds += occ;
      if (room.type === 'AC') {
        acBeds += room.bedCount;
        acOccupied += occ;
      } else {
        nonAcBeds += room.bedCount;
        nonAcOccupied += occ;
      }

      const key = `${room.bedCount}-Bed`;
      if (!byBedCount[key]) {
        byBedCount[key] = { total: 0, occupied: 0, rooms: 0 };
      }
      byBedCount[key].total += room.bedCount;
      byBedCount[key].occupied += occ;
      byBedCount[key].rooms += 1;
    }

    const terminalRequests = completedRequests + rejectedRequests;
    const successRate =
      terminalRequests > 0
        ? Math.round((completedRequests / terminalRequests) * 100)
        : totalRequests > 0
        ? Math.round((completedRequests / totalRequests) * 100)
        : 0;

    res.json({
      success: true,
      data: {
        requests: {
          total: totalRequests,
          pending: pendingRequests,
          inCycle: inCycleRequests,
          awaitingWarden: awaitingWardenRequests,
          completed: completedRequests,
          rejected: rejectedRequests,
          successRate,
        },
        cycles: {
          total: totalGroups,
          completed: completedGroups,
          dissolved: dissolvedGroups,
          awaitingWarden: awaitingWardenGroups,
        },
        occupancy: {
          totalRooms: rooms.length,
          totalStudents: studentsCount,
          totalBeds,
          occupiedBeds,
          availableBeds: totalBeds - occupiedBeds,
          occupancyRate: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
          ac: {
            total: acBeds,
            occupied: acOccupied,
            rate: acBeds > 0 ? Math.round((acOccupied / acBeds) * 100) : 0,
          },
          nonAc: {
            total: nonAcBeds,
            occupied: nonAcOccupied,
            rate: nonAcBeds > 0 ? Math.round((nonAcOccupied / nonAcBeds) * 100) : 0,
          },
          byBedCount,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// --- Policies ---
router.get('/policies', async (_req, res, next) => {
  try {
    const policies = await prisma.policy.findMany({
      include: { hostel: { select: { id: true, name: true, code: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: policies });
  } catch (err) {
    next(err);
  }
});

const policyUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  sameGenderOnly: z.boolean().optional(),
  sameYearOnly: z.boolean().optional(),
  allowAcNonAcSwap: z.boolean().optional(),
  requireAcEligibility: z.boolean().optional(),
  requireSameBedCount: z.boolean().optional(),
  maxSwapsPerSemester: z.coerce.number().int().min(1).max(20).optional(),
  cooldownDays: z.coerce.number().int().min(0).max(365).optional(),
  maxCycleLength: z.coerce.number().int().min(2).max(8).optional(),
  acceptanceTimeoutHours: z.coerce.number().int().min(1).max(168).optional(),
  blockedWindowStart: z.string().datetime().nullable().optional(),
  blockedWindowEnd: z.string().datetime().nullable().optional(),
  exchangeDeadline: z.string().datetime().nullable().optional(),
});

router.patch(
  '/policies/:id',
  requireRole('ADMIN'),
  validateBody(policyUpdateSchema),
  async (req, res, next) => {
    try {
      const existing = await prisma.policy.findUnique({
        where: { id: String(req.params.id) },
      });
      if (!existing) {
        throw new AppError(404, 'NOT_FOUND', 'Policy not found.');
      }

      const data = {
        ...req.body,
        blockedWindowStart:
          req.body.blockedWindowStart === undefined
            ? existing.blockedWindowStart
            : req.body.blockedWindowStart
            ? new Date(req.body.blockedWindowStart)
            : null,
        blockedWindowEnd:
          req.body.blockedWindowEnd === undefined
            ? existing.blockedWindowEnd
            : req.body.blockedWindowEnd
            ? new Date(req.body.blockedWindowEnd)
            : null,
        exchangeDeadline:
          req.body.exchangeDeadline === undefined
            ? existing.exchangeDeadline
            : req.body.exchangeDeadline
            ? new Date(req.body.exchangeDeadline)
            : null,
        updatedBy: req.user!.email,
      };

      const updated = await prisma.policy.update({
        where: { id: existing.id },
        data,
      });

      await writeAuditLog(prisma, {
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'POLICY_UPDATED',
        entityType: 'POLICY',
        entityId: updated.id,
        oldValue: existing,
        newValue: updated,
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// --- Hostels & Blocks ---
const createHostelSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).max(10),
  gender: z.enum(['MALE', 'FEMALE', 'COED']),
  address: z.string().optional(),
  description: z.string().optional(),
});

router.post(
  '/hostels',
  requireRole('ADMIN'),
  validateBody(createHostelSchema),
  async (req, res, next) => {
    try {
      const hostel = await prisma.hostel.create({
        data: {
          ...req.body,
          code: req.body.code.toUpperCase(),
        },
      });
      await writeAuditLog(prisma, {
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'HOSTEL_CREATED',
        entityType: 'HOSTEL',
        entityId: hostel.code,
        newValue: hostel,
      });
      res.status(201).json({ success: true, data: hostel });
    } catch (err) {
      next(err);
    }
  }
);

const createBlockSchema = z.object({
  hostelId: z.string(),
  name: z.string().min(1),
  code: z.string().min(1).max(10),
  floors: z.coerce.number().int().min(1).max(20),
  gender: z.enum(['MALE', 'FEMALE', 'COED']),
});

router.post(
  '/blocks',
  requireRole('ADMIN'),
  validateBody(createBlockSchema),
  async (req, res, next) => {
    try {
      const block = await prisma.block.create({
        data: {
          ...req.body,
          code: req.body.code.toUpperCase(),
        },
      });
      res.status(201).json({ success: true, data: block });
    } catch (err) {
      next(err);
    }
  }
);

// --- Rooms ---
const createRoomSchema = z.object({
  hostelId: z.string(),
  blockId: z.string(),
  roomNumber: z.string().min(1),
  floor: z.coerce.number().int().min(0).max(20),
  bedCount: z.coerce.number().int().refine((n) => [1, 2, 3, 4, 6].includes(n), {
    message: 'bedCount must be 1, 2, 3, 4, or 6',
  }),
  type: z.enum(['AC', 'NON_AC']),
  gender: z.enum(['MALE', 'FEMALE', 'COED']),
});

router.post(
  '/rooms',
  requireRole('ADMIN'),
  validateBody(createRoomSchema),
  async (req, res, next) => {
    try {
      const { hostelId, blockId, roomNumber, floor, bedCount, type, gender } = req.body;
      const bedLabels = Array.from({ length: bedCount }, (_, i) => `B${i + 1}`);

      const room = await prisma.room.create({
        data: {
          hostelId,
          blockId,
          roomNumber,
          floor,
          bedCount,
          capacity: bedCount,
          type,
          gender,
          status: 'AVAILABLE',
          beds: {
            create: bedLabels.map((bedLabel) => ({ bedLabel })),
          },
        },
        include: { beds: true, hostel: true, block: true },
      });

      await writeAuditLog(prisma, {
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'ROOM_CREATED',
        entityType: 'ROOM',
        entityId: `${room.hostel.code}-${room.roomNumber}`,
        newValue: { roomNumber, bedCount, type, gender },
      });

      res.status(201).json({ success: true, data: room });
    } catch (err) {
      next(err);
    }
  }
);

const updateRoomSchema = z.object({
  type: z.enum(['AC', 'NON_AC']).optional(),
  bedCount: z.coerce
    .number()
    .int()
    .refine((n) => [1, 2, 3, 4, 6].includes(n), {
      message: 'bedCount must be 1, 2, 3, 4, or 6',
    })
    .optional(),
  status: z.enum(['AVAILABLE', 'FULL', 'MAINTENANCE']).optional(),
});

router.patch(
  '/rooms/:id',
  requireRole('ADMIN'),
  validateBody(updateRoomSchema),
  async (req, res, next) => {
    try {
      const room = await prisma.room.findUnique({
        where: { id: String(req.params.id) },
        include: { beds: { orderBy: { bedLabel: 'asc' } } },
      });

      if (!room) {
        throw new AppError(404, 'NOT_FOUND', 'Room not found.');
      }

      const occupiedBeds = room.beds.filter((b) => Boolean(b.studentId));
      const newBedCount = req.body.bedCount ?? room.bedCount;

      if (newBedCount < occupiedBeds.length) {
        throw new AppError(
          400,
          'BED_COUNT_BELOW_OCCUPANTS',
          `Cannot reduce bed count to ${newBedCount}; room currently has ${occupiedBeds.length} occupants.`
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        if (newBedCount > room.bedCount) {
          for (let i = room.bedCount + 1; i <= newBedCount; i++) {
            await tx.bed.create({
              data: { roomId: room.id, bedLabel: `B${i}` },
            });
          }
        } else if (newBedCount < room.bedCount) {
          const vacantBeds = room.beds.filter((b) => !b.studentId).reverse();
          const toDelete = vacantBeds.slice(0, room.bedCount - newBedCount);
          if (toDelete.length > 0) {
            await tx.bed.deleteMany({
              where: { id: { in: toDelete.map((b) => b.id) } },
            });
          }
        }

        return tx.room.update({
          where: { id: room.id },
          data: {
            ...(req.body.type ? { type: req.body.type } : {}),
            ...(req.body.status ? { status: req.body.status } : {}),
            bedCount: newBedCount,
            capacity: newBedCount,
            version: { increment: 1 },
          },
          include: { beds: { orderBy: { bedLabel: 'asc' } } },
        });
      });

      await writeAuditLog(prisma, {
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'ROOM_UPDATED',
        entityType: 'ROOM',
        entityId: room.roomNumber,
        oldValue: { type: room.type, bedCount: room.bedCount, status: room.status },
        newValue: { type: updated.type, bedCount: updated.bedCount, status: updated.status },
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// --- Students ---
router.get('/students', async (req, res, next) => {
  try {
    const search = req.query.search ? String(req.query.search) : '';
    const students = await prisma.student.findMany({
      where: search
        ? {
            OR: [
              { rollNumber: { contains: search, mode: 'insensitive' } },
              { branch: { contains: search, mode: 'insensitive' } },
              { user: { name: { contains: search, mode: 'insensitive' } } },
              { user: { email: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : undefined,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        bed: {
          include: {
            room: { include: { hostel: true, block: true } },
          },
        },
      },
      orderBy: { rollNumber: 'asc' },
    });
    res.json({ success: true, data: students });
  } catch (err) {
    next(err);
  }
});

const updateStudentSchema = z.object({
  acEligible: z.boolean().optional(),
  isRestricted: z.boolean().optional(),
});

router.patch(
  '/students/:id',
  requireRole('ADMIN'),
  validateBody(updateStudentSchema),
  async (req, res, next) => {
    try {
      const updated = await prisma.student.update({
        where: { id: String(req.params.id) },
        data: req.body,
        include: { user: { select: { id: true, name: true, email: true } } },
      });

      await writeAuditLog(prisma, {
        actorId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        action: 'STUDENT_UPDATED',
        entityType: 'STUDENT',
        entityId: updated.rollNumber,
        newValue: req.body,
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// --- All Swap Cycles & Requests ---
router.get('/swaps', async (_req, res, next) => {
  try {
    const [cycles, requests] = await Promise.all([
      prisma.swapGroup.findMany({
        include: {
          approvals: {
            include: { warden: { select: { name: true, email: true } } },
          },
          participants: {
            orderBy: { stepOrder: 'asc' },
            include: {
              student: { include: { user: { select: { name: true, email: true } } } },
              fromRoom: true,
              fromBed: true,
              toRoom: true,
              toBed: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.exchangeRequest.findMany({
        include: {
          student: { include: { user: { select: { name: true, email: true } } } },
          currentRoom: true,
          currentBed: true,
          desiredRoom: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({ success: true, data: { cycles, requests } });
  } catch (err) {
    next(err);
  }
});

// --- CSV Bulk Imports ---
const csvImportSchema = z.object({
  csv: z.string().min(5, 'CSV content is required'),
});

router.post(
  '/import/rooms',
  requireRole('ADMIN'),
  validateBody(csvImportSchema),
  async (req, res, next) => {
    try {
      const result = await importRoomsFromCsv(req.body.csv, req.user!);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/import/students',
  requireRole('ADMIN'),
  validateBody(csvImportSchema),
  async (req, res, next) => {
    try {
      const result = await importStudentsFromCsv(req.body.csv, req.user!);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
