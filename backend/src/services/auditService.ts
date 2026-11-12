import { Prisma } from '@prisma/client';
import { stringify } from 'csv-stringify/sync';
import PDFDocument from 'pdfkit';
import { prisma } from '../lib/prisma';

export interface AuditEntryInput {
  actorId?: string | null;
  actorEmail: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  remarks?: string;
}

export async function writeAuditLog(
  tx: Prisma.TransactionClient | typeof prisma,
  entry: AuditEntryInput
) {
  return tx.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      actorEmail: entry.actorEmail,
      actorRole: entry.actorRole,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      oldValue: entry.oldValue ? (entry.oldValue as Prisma.InputJsonValue) : Prisma.JsonNull,
      newValue: entry.newValue ? (entry.newValue as Prisma.InputJsonValue) : Prisma.JsonNull,
      remarks: entry.remarks ?? null,
    },
  });
}

export async function exportAuditLogsCsv(filters?: {
  action?: string;
  entityType?: string;
}): Promise<string> {
  const logs = await prisma.auditLog.findMany({
    where: {
      ...(filters?.action ? { action: filters.action } : {}),
      ...(filters?.entityType ? { entityType: filters.entityType } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  const rows = logs.map((log) => ({
    ID: log.id,
    Timestamp: log.createdAt.toISOString(),
    ActorEmail: log.actorEmail,
    ActorRole: log.actorRole,
    Action: log.action,
    EntityType: log.entityType,
    EntityId: log.entityId,
    OldValue: log.oldValue ? JSON.stringify(log.oldValue) : '',
    NewValue: log.newValue ? JSON.stringify(log.newValue) : '',
    Remarks: log.remarks || '',
  }));

  return stringify(rows, { header: true });
}

export async function exportAuditLogsPdf(filters?: {
  action?: string;
  entityType?: string;
}): Promise<Buffer> {
  const logs = await prisma.auditLog.findMany({
    where: {
      ...(filters?.action ? { action: filters.action } : {}),
      ...(filters?.entityType ? { entityType: filters.entityType } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 250,
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).font('Helvetica-Bold').text('Hostel Room Exchange - Immutable Audit Trail');
    doc.moveDown(0.3);
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#64748b')
      .text(`Generated at: ${new Date().toISOString()} | Total Records: ${logs.length}`);
    doc.moveDown(1);

    for (const log of logs) {
      if (doc.y > 740) {
        doc.addPage();
      }
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#0f172a')
        .text(`[${log.createdAt.toISOString()}] ${log.action} (${log.entityType}: ${log.entityId})`);
      doc
        .fontSize(8.5)
        .font('Helvetica')
        .fillColor('#334155')
        .text(`Actor: ${log.actorEmail} (${log.actorRole})${log.remarks ? ` | Remarks: ${log.remarks}` : ''}`);
      if (log.oldValue || log.newValue) {
        doc
          .fontSize(8)
          .fillColor('#475569')
          .text(
            `Change: ${log.oldValue ? JSON.stringify(log.oldValue) : 'N/A'} -> ${log.newValue ? JSON.stringify(log.newValue) : 'N/A'}`
          );
      }
      doc.moveDown(0.5);
    }

    doc.end();
  });
}
