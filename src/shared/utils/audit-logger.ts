import { prisma } from '../../config/database';

interface AuditLogData {
  event: string;
  userId?: string;
  entity: string;
  entityId: string;
  dataBefore?: any;
  dataAfter?: any;
  ip?: string;
  userAgent?: string;
}

export async function createAuditLog(data: AuditLogData) {
  try {
    await prisma.auditLog.create({
      data: {
        event: data.event,
        userId: data.userId ? BigInt(data.userId) : null,
        entity: data.entity,
        entityId: BigInt(data.entityId),
        dataBefore: data.dataBefore ? JSON.stringify(data.dataBefore) : null,
        dataAfter: data.dataAfter ? JSON.stringify(data.dataAfter) : null,
        ip: data.ip || null,
        userAgent: data.userAgent || null,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging should not break the main flow
  }
}

