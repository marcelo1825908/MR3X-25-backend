import { prisma } from '../../config/database';
import { NotFoundError, ForbiddenError } from '../../shared/errors/AppError';

export class AuditLogsService {
  async getAuditLogs(params: { 
    entity?: string; 
    entityId?: string; 
    page?: number; 
    pageSize?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 50;
    
    const where: any = {};
    
    // Filter by entity type if provided
    if (params.entity) {
      where.entity = params.entity;
    }
    
    // Filter by entity ID if provided
    if (params.entityId) {
      where.entityId = BigInt(params.entityId);
    }
    
    // Filter by date range if provided
    if (params.startDate || params.endDate) {
      where.timestamp = {};
      if (params.startDate) {
        where.timestamp.gte = new Date(params.startDate);
      }
      if (params.endDate) {
        where.timestamp.lte = new Date(params.endDate);
      }
    }
    
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);
    
    // Handle null users gracefully
    const itemsWithNullSafeUsers = items.map(item => ({
      ...item,
      user: item.user || {
        id: 0n,
        name: 'Deleted User',
        email: 'unknown@deleted.com',
        role: 'UNKNOWN' as any,
      },
    }));
    
    return { items: itemsWithNullSafeUsers, total, page, pageSize };
  }
  
  async getAuditLogById(id: string) {
    const auditLog = await prisma.auditLog.findUnique({
      where: { id: BigInt(id) },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
    
    if (!auditLog) {
      throw new NotFoundError('Audit log not found');
    }
    
    // Handle null user gracefully
    return {
      ...auditLog,
      user: auditLog.user || {
        id: 0n,
        name: 'Deleted User',
        email: 'unknown@deleted.com',
        role: 'UNKNOWN' as any,
      },
    };
  }
  
  async createAuditLog(data: {
    event: string;
    userId: string;
    entity: string;
    entityId: string;
    dataBefore?: string;
    dataAfter?: string;
    ip?: string;
    userAgent?: string;
  }) {
    return prisma.auditLog.create({
      data: {
        event: data.event,
        userId: BigInt(data.userId),
        entity: data.entity,
        entityId: BigInt(data.entityId),
        dataBefore: data.dataBefore,
        dataAfter: data.dataAfter,
        ip: data.ip,
        userAgent: data.userAgent,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }
}

