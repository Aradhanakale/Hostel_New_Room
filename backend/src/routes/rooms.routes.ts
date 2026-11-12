import { Router } from 'express';
import { Gender, RoomType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.get('/hostels', authenticateJWT, async (_req, res, next) => {
  try {
    const hostels = await prisma.hostel.findMany({
      include: {
        blocks: {
          orderBy: { code: 'asc' },
        },
        _count: {
          select: { rooms: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: hostels });
  } catch (err) {
    next(err);
  }
});

router.get('/rooms', authenticateJWT, async (req, res, next) => {
  try {
    const { hostelId, blockId, type, bedCount, floor, gender, available, search } =
      req.query;

    const rooms = await prisma.room.findMany({
      where: {
        ...(hostelId ? { hostelId: String(hostelId) } : {}),
        ...(blockId ? { blockId: String(blockId) } : {}),
        ...(type && (type === 'AC' || type === 'NON_AC')
          ? { type: type as RoomType }
          : {}),
        ...(bedCount ? { bedCount: Number(bedCount) } : {}),
        ...(floor ? { floor: Number(floor) } : {}),
        ...(gender && (gender === 'MALE' || gender === 'FEMALE' || gender === 'COED')
          ? { gender: gender as Gender }
          : {}),
        ...(search
          ? {
              OR: [
                { roomNumber: { contains: String(search), mode: 'insensitive' } },
                { hostel: { name: { contains: String(search), mode: 'insensitive' } } },
                { block: { name: { contains: String(search), mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: {
        hostel: { select: { id: true, name: true, code: true } },
        block: { select: { id: true, name: true, code: true } },
        beds: {
          include: {
            student: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
          orderBy: { bedLabel: 'asc' },
        },
      },
      orderBy: [{ hostel: { code: 'asc' } }, { block: { code: 'asc' } }, { roomNumber: 'asc' }],
    });

    const formatted = rooms
      .map((room) => {
        const occupiedCount = room.beds.filter((b) => Boolean(b.studentId)).length;
        const availableCount = room.bedCount - occupiedCount;
        return {
          id: room.id,
          roomNumber: room.roomNumber,
          floor: room.floor,
          bedCount: room.bedCount,
          type: room.type,
          gender: room.gender,
          capacity: room.capacity,
          status: room.status,
          occupiedCount,
          availableCount,
          hostel: room.hostel,
          block: room.block,
          beds: room.beds.map((b) => ({
            id: b.id,
            bedLabel: b.bedLabel,
            isOccupied: Boolean(b.studentId),
            occupant: b.student
              ? {
                  id: b.student.id,
                  name: b.student.user.name,
                  rollNumber: b.student.rollNumber,
                  year: b.student.year,
                  branch: b.student.branch,
                }
              : null,
          })),
        };
      })
      .filter((r) => {
        if (available === 'true') return r.availableCount > 0 && r.status !== 'MAINTENANCE';
        if (available === 'false') return r.availableCount === 0;
        return true;
      });

    res.json({ success: true, data: formatted });
  } catch (err) {
    next(err);
  }
});

router.get('/rooms/:id', authenticateJWT, async (req, res, next) => {
  try {
    const room = await prisma.room.findUnique({
      where: { id: String(req.params.id) },
      include: {
        hostel: true,
        block: true,
        beds: {
          include: {
            student: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
          orderBy: { bedLabel: 'asc' },
        },
      },
    });

    if (!room) {
      throw new AppError(404, 'NOT_FOUND', 'Room not found.');
    }

    const occupiedCount = room.beds.filter((b) => Boolean(b.studentId)).length;

    res.json({
      success: true,
      data: {
        ...room,
        occupiedCount,
        availableCount: room.bedCount - occupiedCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
