import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { authenticateJWT, signToken } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { validateBody } from '../middleware/validate';
import { writeAuditLog } from '../services/auditService';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6),
  rollNumber: z.string().min(3).max(30),
  year: z.coerce.number().int().min(1).max(5),
  gender: z.enum(['MALE', 'FEMALE']),
  branch: z.string().min(2).max(50),
  phone: z.string().optional(),
  acEligible: z.boolean().optional().default(false),
});

async function buildProfilePayload(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      studentProfile: {
        include: {
          bed: {
            include: {
              room: {
                include: {
                  hostel: true,
                  block: true,
                  beds: {
                    include: {
                      student: {
                        include: {
                          user: {
                            select: { id: true, name: true, email: true, phone: true },
                          },
                        },
                      },
                    },
                    orderBy: { bedLabel: 'asc' },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) return null;

  const student = user.studentProfile;
  const currentBed = student?.bed ?? null;
  const currentRoom = currentBed?.room ?? null;

  const roommates = currentRoom
    ? currentRoom.beds
        .filter((b) => b.student && b.student.id !== student?.id)
        .map((b) => ({
          bedLabel: b.bedLabel,
          studentId: b.student!.id,
          name: b.student!.user.name,
          email: b.student!.user.email,
          rollNumber: b.student!.rollNumber,
          year: b.student!.year,
          branch: b.student!.branch,
        }))
    : [];

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    student: student
      ? {
          id: student.id,
          rollNumber: student.rollNumber,
          year: student.year,
          gender: student.gender,
          branch: student.branch,
          acEligible: student.acEligible,
          isRestricted: student.isRestricted,
          swapsThisSemester: student.swapsThisSemester,
          lastSwapAt: student.lastSwapAt,
          currentBed: currentBed
            ? { id: currentBed.id, bedLabel: currentBed.bedLabel }
            : null,
          currentRoom: currentRoom
            ? {
                id: currentRoom.id,
                roomNumber: currentRoom.roomNumber,
                floor: currentRoom.floor,
                bedCount: currentRoom.bedCount,
                type: currentRoom.type,
                gender: currentRoom.gender,
                capacity: currentRoom.capacity,
                status: currentRoom.status,
                hostel: {
                  id: currentRoom.hostel.id,
                  name: currentRoom.hostel.name,
                  code: currentRoom.hostel.code,
                },
                block: {
                  id: currentRoom.block.id,
                  name: currentRoom.block.name,
                  code: currentRoom.block.code,
                },
                beds: currentRoom.beds.map((b) => ({
                  id: b.id,
                  bedLabel: b.bedLabel,
                  isOccupied: Boolean(b.studentId),
                  occupantName: b.student?.user.name || null,
                  isCurrentUser: b.studentId === student.id,
                })),
              }
            : null,
          roommates,
        }
      : null,
  };
}

router.post('/login', authLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || !user.isActive) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const profile = await buildProfilePayload(user.id);

    await writeAuditLog(prisma, {
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'USER_LOGIN',
      entityType: 'USER',
      entityId: user.id,
    });

    res.json({
      success: true,
      data: {
        token,
        user: profile,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/register', authLimiter, validateBody(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password, rollNumber, year, gender, branch, phone, acEligible } =
      req.body;

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email: normalizedEmail,
          passwordHash,
          role: 'STUDENT',
          phone,
        },
      });

      const student = await tx.student.create({
        data: {
          userId: user.id,
          rollNumber,
          year,
          gender,
          branch,
          acEligible,
        },
      });

      // Auto-assign first vacant bed matching gender if available
      const freeBed = await tx.bed.findFirst({
        where: {
          studentId: null,
          room: {
            gender,
            status: 'AVAILABLE',
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (freeBed) {
        await tx.bed.update({
          where: { id: freeBed.id },
          data: { studentId: student.id, occupiedAt: new Date() },
        });
      }

      await writeAuditLog(tx, {
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'STUDENT_REGISTERED',
        entityType: 'STUDENT',
        entityId: student.rollNumber,
        newValue: { email: user.email, year, branch, gender, assignedBed: freeBed?.id || null },
      });

      return user;
    });

    const token = signToken({
      userId: created.id,
      email: created.email,
      role: created.role,
    });
    const profile = await buildProfilePayload(created.id);

    res.status(201).json({
      success: true,
      data: { token, user: profile },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticateJWT, async (req, res, next) => {
  try {
    const profile = await buildProfilePayload(req.user!.userId);
    if (!profile) {
      throw new AppError(404, 'NOT_FOUND', 'User profile not found.');
    }
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
});

export default router;
