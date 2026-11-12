import { NotificationType, Prisma } from '@prisma/client';

export interface EmailStubPayload {
  to: string;
  subject: string;
  body: string;
}

const recentEmailLogs: Array<EmailStubPayload & { sentAt: string }> = [];

export function sendEmailStub(payload: EmailStubPayload): void {
  const entry = { ...payload, sentAt: new Date().toISOString() };
  recentEmailLogs.unshift(entry);
  if (recentEmailLogs.length > 100) {
    recentEmailLogs.pop();
  }
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[EMAIL STUB] To: ${payload.to} | Subject: ${payload.subject}`);
  }
}

export function getRecentEmailStubs() {
  return recentEmailLogs;
}

export async function createNotificationWithEmail(
  tx: Prisma.TransactionClient,
  params: {
    userId: string;
    email: string;
    title: string;
    message: string;
    type: NotificationType;
    relatedEntityId?: string;
  }
) {
  sendEmailStub({
    to: params.email,
    subject: `[HostelSwap] ${params.title}`,
    body: params.message,
  });

  return tx.notification.create({
    data: {
      userId: params.userId,
      title: params.title,
      message: params.message,
      type: params.type,
      relatedEntityId: params.relatedEntityId,
      emailStubSent: true,
      emailStubRecipient: params.email,
    },
  });
}
