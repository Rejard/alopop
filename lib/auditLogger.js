// @ts-nocheck
const { PrismaClient } = require('@prisma/client');

/** @type {PrismaClient} */
let prisma;
if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // Next.js hot-reloading duplicate connection workaround.
  if (!globalThis['globalPrismaForAudit']) {
    globalThis['globalPrismaForAudit'] = new PrismaClient();
  }
  prisma = globalThis['globalPrismaForAudit'];
}

/**
 * @param {{
 *   userId?: string | null;
 *   targetUserId?: string | null;
 *   activityType: string;
 *   status: 'SUCCESS' | 'FAILED' | 'PENDING';
 *   metadata?: Record<string, any> | null;
 * }} params
 */
async function logUserActivity(params) {
  try {
    if (process.env.LOG_SERVER_URL) {
      // Loose-coupling microservice log forwarding logic placeholder.
    }

    return await prisma.userActivityLog.create({
      data: {
        userId: params.userId || null,
        targetUserId: params.targetUserId || null,
        activityType: params.activityType,
        status: params.status,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  } catch (error) {
    console.error(`[AUDIT_LOG_ERROR] Failed to log activity ${params.activityType}:`, error);
  }
}

/**
 * @param {{
 *   socketId: string;
 *   userId?: string | null;
 *   event: string;
 *   details?: string | null;
 * }} params
 */
async function logSocketAudit(params) {
  try {
    if (process.env.LOG_SERVER_URL) {
      // Loose-coupling microservice log forwarding logic placeholder.
    }

    return await prisma.socketAuditLog.create({
      data: {
        socketId: params.socketId,
        userId: params.userId || null,
        event: params.event,
        details: params.details || null,
      },
    });
  } catch (error) {
    console.error(`[AUDIT_LOG_ERROR] Failed to log socket event ${params.event}:`, error);
  }
}

module.exports = {
  logUserActivity,
  logSocketAudit,
};
