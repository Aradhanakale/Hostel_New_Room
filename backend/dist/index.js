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
        app_1.default.listen(env_1.env.port, () => {
            console.log(`[API] Hostel Room Exchange backend listening on http://localhost:${env_1.env.port}`);
        });
    }
    catch (err) {
        console.error('[Startup Error]', err);
        process.exit(1);
    }
}
bootstrap();
