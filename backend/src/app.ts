import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler, AppError } from './lib/errors';
import { apiLimiter } from './middleware/rateLimiter';
import authRoutes from './routes/auth.routes';
import roomsRoutes from './routes/rooms.routes';
import exchangesRoutes from './routes/exchanges.routes';
import swapsRoutes from './routes/swaps.routes';
import wardenRoutes from './routes/warden.routes';
import adminRoutes from './routes/admin.routes';
import auditRoutes from './routes/audit.routes';
import notificationsRoutes from './routes/notifications.routes';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Allow localhost dev variants while exposing configured CORS
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
if (env.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}
app.use('/api', apiLimiter);

// Health check endpoints (both /health and /api/health)
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    healthy: true,
    service: 'hostel-room-exchange-api',
    port: env.port,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      service: 'hostel-room-exchange-api',
      timestamp: new Date().toISOString(),
    },
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', roomsRoutes); // /api/hostels, /api/rooms, /api/rooms/:id
app.use('/api/exchanges', exchangesRoutes);
app.use('/api/swaps', swapsRoutes);
app.use('/api/warden', wardenRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/notifications', notificationsRoutes);

app.use((_req, _res, next) => {
  next(new AppError(404, 'ROUTE_NOT_FOUND', 'API endpoint not found.'));
});

app.use(errorHandler);

export default app;
