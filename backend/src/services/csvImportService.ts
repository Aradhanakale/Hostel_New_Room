import { parse } from 'csv-parse/sync';
import bcrypt from 'bcryptjs';
import { Gender, RoomType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { writeAuditLog } from './auditService';

export async function importRoomsFromCsv(
  csvText: string,
  actor: { userId: string; email: string; role: string }
) {
  let records: Array<Record<string, string>>;
  try {
    records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (err) {
    throw new AppError(400, 'INVALID_CSV', 'Failed to parse CSV content.');
  }

  let created = 0;
  const errors: string[] = [];

  for (let idx = 0; idx < records.length; idx++) {
    const row = records[idx];
    try {
      const hostelCode = row.hostelCode || row.hostel_code;
      const blockCode = row.blockCode || row.block_code;
      const roomNumber = row.roomNumber || row.room_number;
      const floor = parseInt(row.floor || '1', 10);
      const bedCount = parseInt(row.bedCount || row.bed_count || '2', 10);
      const type = ((row.type || 'NON_AC').toUpperCase() === 'AC' ? 'AC' : 'NON_AC') as RoomType;
      const gender = ((row.gender || 'MALE').toUpperCase() as Gender);

      if (!hostelCode || !blockCode || !roomNumber) {
        errors.push(`Row ${idx + 2}: missing hostelCode, blockCode, or roomNumber`);
        continue;
      }

      const hostel = await prisma.hostel.findUnique({ where: { code: hostelCode } });
      if (!hostel) {
        errors.push(`Row ${idx + 2}: Hostel code "${hostelCode}" not found`);
        continue;
      }

      const block = await prisma.block.findUnique({
        where: { hostelId_code: { hostelId: hostel.id, code: blockCode } },
      });
      if (!block) {
        errors.push(`Row ${idx + 2}: Block code "${blockCode}" not found in ${hostelCode}`);
        continue;
      }

      const bedLabels = Array.from({ length: bedCount }, (_, i) => `B${i + 1}`);
      await prisma.room.create({
        data: {
          hostelId: hostel.id,
          blockId: block.id,
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
      });
      created += 1;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      errors.push(`Row ${idx + 2}: ${msg}`);
    }
  }

  await writeAuditLog(prisma, {
    actorId: actor.userId,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: 'CSV_IMPORT_ROOMS',
    entityType: 'ROOM',
    entityId: 'BULK',
    newValue: { created, errorCount: errors.length },
  });

  return { totalRows: records.length, created, errors };
}

export async function importStudentsFromCsv(
  csvText: string,
  actor: { userId: string; email: string; role: string }
) {
  let records: Array<Record<string, string>>;
  try {
    records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch {
    throw new AppError(400, 'INVALID_CSV', 'Failed to parse CSV content.');
  }

  let created = 0;
  const errors: string[] = [];
  const defaultPasswordHash = await bcrypt.hash('Student@123', 10);

  for (let idx = 0; idx < records.length; idx++) {
    const row = records[idx];
    try {
      const { name, email, rollNumber, branch } = row;
      const year = parseInt(row.year || '2', 10);
      const gender = ((row.gender || 'MALE').toUpperCase() as Gender);
      const acEligible = String(row.acEligible || row.ac_eligible || 'false').toLowerCase() === 'true';
      const hostelCode = row.hostelCode || row.hostel_code;
      const blockCode = row.blockCode || row.block_code;
      const roomNumber = row.roomNumber || row.room_number;
      const bedLabel = row.bedLabel || row.bed_label;

      if (!name || !email || !rollNumber || !branch) {
        errors.push(`Row ${idx + 2}: missing required fields (name, email, rollNumber, branch)`);
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name,
            email: email.toLowerCase(),
            passwordHash: defaultPasswordHash,
            role: 'STUDENT',
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

        if (hostelCode && blockCode && roomNumber && bedLabel) {
          const hostel = await tx.hostel.findUnique({ where: { code: hostelCode } });
          if (hostel) {
            const block = await tx.block.findUnique({
              where: { hostelId_code: { hostelId: hostel.id, code: blockCode } },
            });
            if (block) {
              const room = await tx.room.findUnique({
                where: { blockId_roomNumber: { blockId: block.id, roomNumber } },
              });
              if (room) {
                await tx.bed.update({
                  where: { roomId_bedLabel: { roomId: room.id, bedLabel } },
                  data: { studentId: student.id, occupiedAt: new Date() },
                });
              }
            }
          }
        }
      });

      created += 1;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      errors.push(`Row ${idx + 2}: ${msg}`);
    }
  }

  await writeAuditLog(prisma, {
    actorId: actor.userId,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: 'CSV_IMPORT_STUDENTS',
    entityType: 'STUDENT',
    entityId: 'BULK',
    newValue: { created, errorCount: errors.length },
  });

  return { totalRows: records.length, created, errors };
}
