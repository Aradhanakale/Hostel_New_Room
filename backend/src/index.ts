import app from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';

async function bootstrap() {
  try {
    await prisma.$connect();
    console.log('[DB] Connected to PostgreSQL via Prisma');

    app.listen(env.port, () => {
      console.log(`[API] Hostel Room Exchange backend listening on http://localhost:${env.port}`);
    });
  } catch (err) {
    console.error('[Startup Error]', err);
    process.exit(1);
  }
}

bootstrap();
