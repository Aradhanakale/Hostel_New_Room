"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const prisma_1 = require("./lib/prisma");
async function bootstrap() {
    try {
        await prisma_1.prisma.$connect();
        console.log('[DB] Connected to PostgreSQL via Prisma');
        const server = app_1.default.listen(env_1.env.port, '0.0.0.0', () => {
            console.log(`[API] Hostel Room Exchange backend listening on http://0.0.0.0:${env_1.env.port} (http://localhost:${env_1.env.port})`);
        });
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`\x1b[31m[API Error] Port ${env_1.env.port} is already in use by another process.\x1b[0m`);
                console.error(`\x1b[33mTo free port ${env_1.env.port}, run: lsof -ti :${env_1.env.port} | xargs kill -9\x1b[0m`);
            }
            else {
                console.error('[API Server Error]', err);
            }
            process.exit(1);
        });
    }
    catch (err) {
        console.error('[Startup Error]', err);
        process.exit(1);
    }
}
bootstrap();
