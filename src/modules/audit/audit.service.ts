import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import * as crypto from 'crypto';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  
  constructor(private prisma: PrismaService) {}

  async getAuditLogs(params: {
    entity?: string;
    entityId?: string;
    page?: number;
    pageSize?: number;
    startDate?: string;
    endDate?: string;
    search?: string;
  }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 50;

    const where: any = {};

    // Build base filters
    const baseConditions: any = {};
    if (params.entity) {
      baseConditions.entity = params.entity;
    }

    if (params.entityId) {
      baseConditions.entityId = BigInt(params.entityId);
    }

    if (params.startDate || params.endDate) {
      baseConditions.timestamp = {};
      if (params.startDate) {
        baseConditions.timestamp.gte = new Date(params.startDate);
      }
      if (params.endDate) {
        baseConditions.timestamp.lte = new Date(params.endDate);
      }
    }

    // Search functionality - search in event, entity, user name, email, IP, entityId
    if (params.search && params.search.trim()) {
      const searchTerm = params.search.trim();
      
      // Build search OR conditions
      // Note: MySQL default collation is case-insensitive, so we don't need mode: 'insensitive'
      const searchConditions: any[] = [
        { event: { contains: searchTerm } },
        { entity: { contains: searchTerm } },
        { ip: { contains: searchTerm } },
        { userAgent: { contains: searchTerm } },
        {
          user: {
            OR: [
              { name: { contains: searchTerm } },
              { email: { contains: searchTerm } },
            ],
          },
        },
      ];

      // Try to parse as number for entityId search
      const searchAsNumber = parseInt(searchTerm, 10);
      if (!isNaN(searchAsNumber) && searchAsNumber > 0) {
        try {
          searchConditions.push({ entityId: BigInt(searchAsNumber) });
        } catch (e) {
          // Ignore if conversion fails
        }
      }

      // Combine base filters with search: (base filters) AND (search OR conditions)
      const hasBaseFilters = Object.keys(baseConditions).length > 0;
      
      if (hasBaseFilters) {
        where.AND = [
          baseConditions,
          { OR: searchConditions },
        ];
      } else {
        // No base filters, just use search OR
        where.OR = searchConditions;
      }
    } else {
      // No search, just use base conditions
      Object.assign(where, baseConditions);
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
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
      this.prisma.auditLog.count({ where }),
    ]);

    const itemsWithNullSafeUsers = items.map(item => ({
      id: item.id.toString(),
      event: item.event,
      entity: item.entity,
      entityId: item.entityId?.toString() || null,
      dataBefore: item.dataBefore,
      dataAfter: item.dataAfter,
      ip: item.ip,
      userAgent: item.userAgent,
      timestamp: item.timestamp,
      integrityHash: item.integrityHash,
      user: item.user
        ? {
            id: item.user.id.toString(),
            name: item.user.name,
            email: item.user.email,
            role: item.user.role,
          }
        : {
            id: '0',
            name: 'Deleted User',
            email: 'unknown@deleted.com',
            role: 'UNKNOWN',
          },
    }));

    return { items: itemsWithNullSafeUsers, total, page, pageSize };
  }

  async getAuditLogById(id: string) {
    const auditLog = await this.prisma.auditLog.findUnique({
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
      throw new NotFoundException('Audit log not found');
    }

    return {
      id: auditLog.id.toString(),
      event: auditLog.event,
      entity: auditLog.entity,
      entityId: auditLog.entityId?.toString() || null,
      dataBefore: auditLog.dataBefore,
      dataAfter: auditLog.dataAfter,
      ip: auditLog.ip,
      userAgent: auditLog.userAgent,
      timestamp: auditLog.timestamp,
      integrityHash: auditLog.integrityHash,
      user: auditLog.user
        ? {
            id: auditLog.user.id.toString(),
            name: auditLog.user.name,
            email: auditLog.user.email,
            role: auditLog.user.role,
          }
        : {
            id: '0',
            name: 'Deleted User',
            email: 'unknown@deleted.com',
            role: 'UNKNOWN',
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
    // Generate integrity hash for this audit log entry
    const timestamp = new Date().toISOString();
    const hashData = `${data.event}|${data.userId}|${data.entity}|${data.entityId}|${data.dataBefore || ''}|${data.dataAfter || ''}|${data.ip || ''}|${timestamp}`;
    const integrityHash = crypto.createHash('sha256').update(hashData).digest('hex');

    const auditLog = await this.prisma.auditLog.create({
      data: {
        event: data.event,
        userId: BigInt(data.userId),
        entity: data.entity,
        entityId: BigInt(data.entityId),
        dataBefore: data.dataBefore,
        dataAfter: data.dataAfter,
        ip: data.ip,
        userAgent: data.userAgent,
        integrityHash,
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

    return {
      id: auditLog.id.toString(),
      event: auditLog.event,
      entity: auditLog.entity,
      entityId: auditLog.entityId?.toString() || null,
      dataBefore: auditLog.dataBefore,
      dataAfter: auditLog.dataAfter,
      ip: auditLog.ip,
      userAgent: auditLog.userAgent,
      timestamp: auditLog.timestamp,
      integrityHash: auditLog.integrityHash,
      user: auditLog.user
        ? {
            id: auditLog.user.id.toString(),
            name: auditLog.user.name,
            email: auditLog.user.email,
            role: auditLog.user.role,
          }
        : null,
    };
  }

  async exportAuditLogs(params: {
    entity?: string;
    entityId?: string;
    startDate?: string;
    endDate?: string;
    format: 'csv' | 'json' | 'pdf';
    requestIp?: string;
  }): Promise<{ content: string | Buffer; hash: string; metadata: any }> {
    const where: any = {};

    if (params.entity) {
      where.entity = params.entity;
    }

    if (params.entityId) {
      where.entityId = BigInt(params.entityId);
    }

    if (params.startDate || params.endDate) {
      where.timestamp = {};
      if (params.startDate) {
        where.timestamp.gte = new Date(params.startDate);
      }
      if (params.endDate) {
        where.timestamp.lte = new Date(params.endDate);
      }
    }

    const logs = await this.prisma.auditLog.findMany({
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
    });

    const exportData = logs.map(item => ({
      id: item.id.toString(),
      event: item.event,
      entity: item.entity,
      entityId: item.entityId?.toString() || null,
      dataBefore: item.dataBefore,
      dataAfter: item.dataAfter,
      ip: item.ip,
      userAgent: item.userAgent,
      timestamp: item.timestamp.toISOString(),
      integrityHash: item.integrityHash,
      user: item.user
        ? {
            id: item.user.id.toString(),
            name: item.user.name,
            email: item.user.email,
            role: item.user.role,
          }
        : {
            id: '0',
            name: 'Deleted User',
            email: 'unknown@deleted.com',
            role: 'UNKNOWN',
          },
    }));

    let content: string | Buffer;
    if (params.format === 'csv') {
      content = this.exportToCsv(logs);
    } else if (params.format === 'pdf') {
      content = await this.exportToPdf(logs, params.requestIp);
    } else {
      content = JSON.stringify(exportData, null, 2);
    }

    // Generate integrity hash
    const hash = crypto.createHash('sha256').update(
      typeof content === 'string' ? content : content.toString('base64')
    ).digest('hex');

    const metadata = {
      generatedAt: new Date().toISOString(),
      generatedBy: params.requestIp || 'unknown',
      recordCount: logs.length,
      format: params.format,
      hash: hash,
      filters: {
        entity: params.entity,
        entityId: params.entityId,
        startDate: params.startDate,
        endDate: params.endDate,
      },
    };

    // Add metadata to CSV/JSON exports
    if (params.format === 'csv') {
      const csvWithMetadata = this.addMetadataToCsv(content as string, metadata);
      const finalHash = crypto.createHash('sha256').update(csvWithMetadata).digest('hex');
      return { content: csvWithMetadata, hash: finalHash, metadata: { ...metadata, hash: finalHash } };
    } else if (params.format === 'json') {
      const jsonWithMetadata = JSON.stringify({ metadata, data: exportData }, null, 2);
      const finalHash = crypto.createHash('sha256').update(jsonWithMetadata).digest('hex');
      return { content: jsonWithMetadata, hash: finalHash, metadata: { ...metadata, hash: finalHash } };
    }

    return { content, hash, metadata };
  }

  private exportToCsv(logs: any[]): string {
    const headers = [
      'ID',
      'Data/Hora',
      'Evento',
      'Entidade',
      'ID da Entidade',
      'Usuário',
      'Email',
      'Perfil',
      'IP',
      'User Agent',
      'Hash de Integridade',
      'Dados Antes',
      'Dados Depois',
    ];

    const rows = logs.map(item => [
      item.id.toString(),
      item.timestamp.toISOString(),
      item.event || '',
      item.entity || '',
      item.entityId?.toString() || '',
      item.user?.name || 'Deleted User',
      item.user?.email || 'unknown@deleted.com',
      item.user?.role || 'UNKNOWN',
      item.ip || '',
      item.userAgent || '',
      item.integrityHash || '',
      item.dataBefore ? JSON.stringify(item.dataBefore).replace(/"/g, '""') : '',
      item.dataAfter ? JSON.stringify(item.dataAfter).replace(/"/g, '""') : '',
    ]);

    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    // Add BOM for Excel compatibility
    return '\uFEFF' + csvContent;
  }

  private addMetadataToCsv(csvContent: string, metadata: any): string {
    const metadataRows = [
      '# Relatório de Auditoria - MR3X',
      `# Data/Hora de Geração: ${metadata.generatedAt}`,
      `# IP de Geração: ${metadata.generatedBy}`,
      `# Total de Registros: ${metadata.recordCount}`,
      `# Hash de Integridade: ${metadata.hash}`,
      `# Formato: ${metadata.format}`,
      '#',
    ];
    return metadataRows.join('\n') + '\n' + csvContent;
  }

  private async exportToPdf(logs: any[], requestIp?: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc.fontSize(20).font('Helvetica-Bold').text('RELATÓRIO DE AUDITORIA', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).font('Helvetica').text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });
        if (requestIp) {
          doc.text(`IP de Geração: ${requestIp}`, { align: 'center' });
        }
        doc.text(`Total de Registros: ${logs.length}`, { align: 'center' });
        doc.moveDown(2);

        // Logs
        logs.forEach((log, index) => {
          if (index > 0) {
            doc.moveDown();
            doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
            doc.moveDown();
          }

          doc.fontSize(11).font('Helvetica-Bold').text(`Registro #${log.id.toString()}`);
          doc.moveDown(0.5);
          doc.font('Helvetica');
          doc.fontSize(10);
          doc.text(`Data/Hora: ${log.timestamp.toLocaleString('pt-BR')}`);
          doc.text(`Evento: ${log.event}`);
          doc.text(`Entidade: ${log.entity} (ID: ${log.entityId?.toString() || 'N/A'})`);
          if (log.user) {
            doc.text(`Usuário: ${log.user.name} (${log.user.email}) - ${log.user.role}`);
          }
          if (log.ip) {
            doc.text(`IP: ${log.ip}`);
          }
          if (log.userAgent) {
            doc.text(`User Agent: ${log.userAgent.substring(0, 80)}${log.userAgent.length > 80 ? '...' : ''}`);
          }
          if (log.integrityHash) {
            doc.font('Helvetica-Bold').text(`Hash de Integridade: ${log.integrityHash}`);
            doc.font('Helvetica');
          }
          if (log.dataBefore || log.dataAfter) {
            doc.moveDown(0.3);
            if (log.dataBefore) {
              doc.font('Helvetica-Bold').text('Dados Antes:');
              doc.font('Helvetica').text(JSON.stringify(JSON.parse(log.dataBefore), null, 2).substring(0, 200), { continued: false });
            }
            if (log.dataAfter) {
              doc.font('Helvetica-Bold').text('Dados Depois:');
              doc.font('Helvetica').text(JSON.stringify(JSON.parse(log.dataAfter), null, 2).substring(0, 200), { continued: false });
            }
          }

          // Check if we need a new page
          if (doc.y > 750) {
            doc.addPage();
          }
        });

        // Footer with hash
        const hash = crypto.createHash('sha256').update(JSON.stringify(logs)).digest('hex');
        doc.moveDown(2);
        doc.fontSize(8).font('Helvetica').text(`Hash de Integridade: ${hash}`, { align: 'center' });
        doc.text(`Este documento é imutável e serve como prova de integridade dos dados auditados.`, { align: 'center' });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}
