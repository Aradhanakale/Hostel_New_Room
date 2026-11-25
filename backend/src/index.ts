import app from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';

async function bootstrap() {
  try {
    await prisma.$connect();
    console.log('[DB] Connected to PostgreSQL via Prisma');

    const server = app.listen(env.port, '0.0.0.0', () => {
      console.log(`[API] Hostel Room Exchange backend listening on http://0.0.0.0:${env.port} (http://localhost:${env.port})`);
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\x1b[31m[API Error] Port ${env.port} is already in use by another process.\x1b[0m`);
        console.error(`\x1b[33mTo free port ${env.port}, run: lsof -ti :${env.port} | xargs kill -9\x1b[0m`);
      } else {
        console.error('[API Server Error]', err);
      }
      process.exit(1);
    });
  } catch (err) {
    console.error('[Startup Error]', err);
    process.exit(1);
  }
}

bootstrap();
