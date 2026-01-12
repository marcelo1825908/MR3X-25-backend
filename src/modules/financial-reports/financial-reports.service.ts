import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import * as crypto from 'crypto';
import * as PDFDocument from 'pdfkit';

export interface FinancialReportFilters {
  startDate?: string;
  endDate?: string;
  agencyId?: string;
  ownerId?: string;
  propertyId?: string;
  contractId?: string;
  type?: 'daily' | 'monthly' | 'annual';
}

export interface FinancialReportData {
  period: {
    start: string;
    end: string;
    type: string;
  };
  summary: {
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
    totalTransactions: number;
    revenueTransactions: number;
    expenseTransactions: number;
    pendingAmount: number;
    overdueAmount: number;
  };
  transactions: any[];
  generatedAt: string;
  generatedBy: string;
  hash: string;
  ip: string;
}

@Injectable()
export class FinancialReportsService {
  constructor(private prisma: PrismaService) {}

  private generateHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private formatDateTime(date: Date): string {
    return date.toISOString();
  }

  async generateReport(
    filters: FinancialReportFilters,
    userId: string,
    userRole: string,
    clientIP?: string,
  ): Promise<FinancialReportData> {
    if (!userId || !userRole) {
      throw new BadRequestException('User information is required');
    }

    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // Determine date range based on type
    if (filters.type === 'daily') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    } else if (filters.type === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (filters.type === 'annual') {
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    } else if (filters.startDate && filters.endDate) {
      startDate = new Date(filters.startDate);
      endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59);
    } else {
      // Default to current month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    // Build where clause based on user role and filters
    const where: any = {
      dataPagamento: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Role-based filtering
    if (userRole === 'INDEPENDENT_OWNER') {
      where.property = {
        createdBy: BigInt(userId),
        deleted: false,
      };
    } else if (userRole === 'PROPRIETARIO') {
      where.property = {
        ownerId: BigInt(userId),
        deleted: false,
      };
    } else if (userRole === 'AGENCY_ADMIN' || userRole === 'AGENCY_MANAGER') {
      // Get user's agency
      const user = await this.prisma.user.findUnique({
        where: { id: BigInt(userId) },
        select: { agencyId: true },
      });
      if (user?.agencyId) {
        where.property = {
          agencyId: user.agencyId,
          deleted: false,
        };
      } else {
        throw new ForbiddenException('User does not belong to an agency');
      }
    } else if (userRole !== 'CEO' && userRole !== 'ADMIN') {
      throw new ForbiddenException('You do not have permission to generate financial reports');
    }

    // Apply additional filters
    if (filters.agencyId) {
      where.property = {
        ...where.property,
        agencyId: BigInt(filters.agencyId),
      };
    }
    if (filters.ownerId) {
      where.property = {
        ...where.property,
        ownerId: BigInt(filters.ownerId),
      };
    }
    if (filters.propertyId) {
      where.propertyId = BigInt(filters.propertyId);
    }
    if (filters.contractId) {
      where.contractId = BigInt(filters.contractId);
    }

    // Fetch payments
    const payments = await this.prisma.payment.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        contract: {
          select: {
            id: true,
            contractToken: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        dataPagamento: 'desc',
      },
    });

    // Build invoice where clause (Invoice uses dueDate, not dataPagamento)
    const invoiceWhere: any = {
      dueDate: {
        gte: startDate,
        lte: endDate,
      },
      status: { in: ['PENDING', 'OVERDUE'] },
    };

    // Role-based filtering for invoices
    if (userRole === 'INDEPENDENT_OWNER') {
      invoiceWhere.property = {
        createdBy: BigInt(userId),
        deleted: false,
      };
    } else if (userRole === 'PROPRIETARIO') {
      invoiceWhere.ownerId = BigInt(userId);
    } else if (userRole === 'AGENCY_ADMIN' || userRole === 'AGENCY_MANAGER') {
      const user = await this.prisma.user.findUnique({
        where: { id: BigInt(userId) },
        select: { agencyId: true },
      });
      if (user?.agencyId) {
        invoiceWhere.agencyId = user.agencyId;
      } else {
        throw new ForbiddenException('User does not belong to an agency');
      }
    }

    // Apply additional filters to invoices
    if (filters.agencyId) {
      invoiceWhere.agencyId = BigInt(filters.agencyId);
    }
    if (filters.ownerId) {
      invoiceWhere.ownerId = BigInt(filters.ownerId);
    }
    if (filters.propertyId) {
      invoiceWhere.propertyId = BigInt(filters.propertyId);
    }
    if (filters.contractId) {
      invoiceWhere.contractId = BigInt(filters.contractId);
    }

    // Fetch pending invoices
    const pendingInvoices = await this.prisma.invoice.findMany({
      where: invoiceWhere,
      select: {
        id: true,
        originalValue: true,
        updatedValue: true,
        dueDate: true,
        status: true,
      },
    });

    // Build expense where clause
    const expenseWhere: any = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Role-based filtering for expenses
    if (userRole === 'INDEPENDENT_OWNER' || userRole === 'PROPRIETARIO') {
      expenseWhere.property = {
        ownerId: BigInt(userId),
        deleted: false,
      };
    } else if (userRole === 'AGENCY_ADMIN' || userRole === 'AGENCY_MANAGER') {
      const user = await this.prisma.user.findUnique({
        where: { id: BigInt(userId) },
        select: { agencyId: true },
      });
      if (user?.agencyId) {
        expenseWhere.property = {
          agencyId: user.agencyId,
          deleted: false,
        };
      }
    }

    // Apply additional filters to expenses
    if (filters.agencyId) {
      expenseWhere.property = {
        ...expenseWhere.property,
        agencyId: BigInt(filters.agencyId),
      };
    }
    if (filters.ownerId) {
      expenseWhere.property = {
        ...expenseWhere.property,
        ownerId: BigInt(filters.ownerId),
      };
    }
    if (filters.propertyId) {
      expenseWhere.propertyId = BigInt(filters.propertyId);
    }

    // Fetch expenses from Expense model
    const propertyExpenses = await this.prisma.expense.findMany({
      where: expenseWhere,
      select: {
        id: true,
        value: true,
        type: true,
        dueDate: true,
        createdAt: true,
      },
    });

    // Build microtransaction where clause
    const microtransactionWhere: any = {
      status: 'PAID',
      paidAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Role-based filtering for microtransactions
    if (userRole === 'INDEPENDENT_OWNER' || userRole === 'PROPRIETARIO') {
      // Get user IDs that belong to this owner
      const ownerUsers = await this.prisma.user.findMany({
        where: {
          ownerId: BigInt(userId),
        },
        select: { id: true },
      });
      const ownerUserIds = ownerUsers.map(u => u.id);
      if (ownerUserIds.length > 0) {
        microtransactionWhere.userId = { in: ownerUserIds };
      } else {
        // No users found, set to empty array to return no results
        microtransactionWhere.userId = { in: [] };
      }
    } else if (userRole === 'AGENCY_ADMIN' || userRole === 'AGENCY_MANAGER') {
      const user = await this.prisma.user.findUnique({
        where: { id: BigInt(userId) },
        select: { agencyId: true },
      });
      if (user?.agencyId) {
        microtransactionWhere.agencyId = user.agencyId;
      } else {
        // No agency found, set to empty to return no results
        microtransactionWhere.agencyId = null;
      }
    }

    // Apply additional filters to microtransactions
    if (filters.agencyId) {
      microtransactionWhere.agencyId = BigInt(filters.agencyId);
    }

    // Fetch expenses from microtransactions (platform fees, etc.)
    const microtransactionExpenses = await this.prisma.microtransaction.findMany({
      where: microtransactionWhere,
      select: {
        id: true,
        amount: true,
        type: true,
        description: true,
        paidAt: true,
      },
    });

    // Also include gateway fees from payments (2% Asaas fee)
    const gatewayFees = payments.reduce((sum, p) => {
      const fee = Number(p.valorPago || 0) * 0.02; // 2% transaction fee
      return sum + fee;
    }, 0);

    // Calculate summary
    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.valorPago || 0), 0);
    const propertyExpensesTotal = propertyExpenses.reduce((sum, e) => sum + Number(e.value || 0), 0);
    const microtransactionExpensesTotal = microtransactionExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const totalExpenses = propertyExpensesTotal + microtransactionExpensesTotal + gatewayFees;
    const netIncome = totalRevenue - totalExpenses;
    const pendingAmount = pendingInvoices.reduce(
      (sum, inv) => sum + Number(inv.updatedValue || inv.originalValue || 0),
      0,
    );
    const overdueAmount = pendingInvoices
      .filter(inv => inv.status === 'OVERDUE')
      .reduce((sum, inv) => sum + Number(inv.updatedValue || inv.originalValue || 0), 0);

    // Format revenue transactions
    const revenueTransactions = payments.map(p => ({
      id: p.id.toString(),
      date: this.formatDate(p.dataPagamento),
      amount: Number(p.valorPago || 0),
      type: 'REVENUE',
      category: p.tipo || 'RENT',
      property: p.property
        ? {
            id: p.property.id.toString(),
            name: p.property.name,
            address: p.property.address,
          }
        : null,
      contract: p.contract
        ? {
            id: p.contract.id.toString(),
            token: p.contract.contractToken,
          }
        : null,
      tenant: p.user
        ? {
            id: p.user.id.toString(),
            name: p.user.name,
            email: p.user.email,
          }
        : null,
    }));

    // Format expense transactions from Expense model
    const propertyExpenseTransactions = propertyExpenses.map(e => ({
      id: `exp-${e.id.toString()}`,
      date: this.formatDate(e.dueDate || e.createdAt),
      amount: Number(e.value || 0),
      type: 'EXPENSE',
      category: e.type || 'PROPERTY_EXPENSE',
      description: `Despesa de imóvel - ${e.type}`,
    }));

    // Format expense transactions from microtransactions
    const microtransactionExpenseTransactions = microtransactionExpenses.map(e => ({
      id: `mt-${e.id.toString()}`,
      date: this.formatDate(e.paidAt || new Date()),
      amount: Number(e.amount || 0),
      type: 'EXPENSE',
      category: e.type || 'MICROTRANSACTION',
      description: e.description || 'Microtransação',
    }));

    const expenseTransactions = [...propertyExpenseTransactions, ...microtransactionExpenseTransactions];

    // Add gateway fees as expense
    if (gatewayFees > 0) {
      expenseTransactions.push({
        id: 'gateway-fees',
        date: this.formatDate(endDate),
        amount: gatewayFees,
        type: 'EXPENSE',
        category: 'GATEWAY_FEE',
        description: 'Taxa de transação Asaas (2%)',
      });
    }

    const transactions = [...revenueTransactions, ...expenseTransactions].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });

    // Generate hash for report integrity (includes all data for immutability)
    const reportContent = JSON.stringify({
      period: { start: this.formatDate(startDate), end: this.formatDate(endDate), type: filters.type || 'custom' },
      summary: { 
        totalRevenue, 
        totalExpenses, 
        netIncome, 
        totalTransactions: transactions.length, 
        revenueTransactions: revenueTransactions.length,
        expenseTransactions: expenseTransactions.length,
        pendingAmount, 
        overdueAmount 
      },
      transactions,
      generatedAt: this.formatDateTime(now),
      generatedBy: userId,
      generatedByIP: clientIP || 'N/A',
    });
    const hash = this.generateHash(reportContent);

    return {
      period: {
        start: this.formatDate(startDate),
        end: this.formatDate(endDate),
        type: filters.type || 'custom',
      },
      summary: {
        totalRevenue,
        totalExpenses,
        netIncome,
        totalTransactions: transactions.length,
        revenueTransactions: revenueTransactions.length,
        expenseTransactions: expenseTransactions.length,
        pendingAmount,
        overdueAmount,
      },
      transactions,
      generatedAt: this.formatDateTime(now),
      generatedBy: userId,
      hash,
      ip: clientIP || 'N/A',
    };
  }

  async exportToCSV(reportData: FinancialReportData): Promise<string> {
    const lines: string[] = [];

    // Header
    lines.push('RELATORIO FINANCEIRO - MR3X');
    lines.push(`Periodo: ${reportData.period.start} a ${reportData.period.end}`);
    lines.push(`Tipo: ${reportData.period.type}`);
    lines.push(`Gerado em: ${reportData.generatedAt}`);
    lines.push(`Hash SHA-256: ${reportData.hash}`);
    lines.push(`IP: ${reportData.ip}`);
    lines.push('');

    // Summary
    lines.push('RESUMO');
    lines.push(`Receita Total,${reportData.summary.totalRevenue.toFixed(2)}`);
    lines.push(`Despesas Total,${reportData.summary.totalExpenses.toFixed(2)}`);
    lines.push(`Lucro Liquido,${reportData.summary.netIncome.toFixed(2)}`);
    lines.push(`Total de Transacoes,${reportData.summary.totalTransactions}`);
    lines.push(`Valor Pendente,${reportData.summary.pendingAmount.toFixed(2)}`);
    lines.push(`Valor Vencido,${reportData.summary.overdueAmount.toFixed(2)}`);
    lines.push('');

    // Revenue Transactions
    lines.push('RECEITAS');
    lines.push('Data,Valor,Categoria,Imovel,Contrato,Inquilino');
    reportData.transactions
      .filter(t => t.type === 'REVENUE')
      .forEach(t => {
        const propertyName = t.property?.name || 'N/A';
        const contractToken = t.contract?.token || 'N/A';
        const tenantName = t.tenant?.name || 'N/A';
        lines.push(`${t.date},${t.amount.toFixed(2)},${t.category || 'N/A'},${propertyName},${contractToken},${tenantName}`);
      });

    lines.push('');
    // Expense Transactions
    lines.push('DESPESAS');
    lines.push('Data,Valor,Categoria,Descricao');
    reportData.transactions
      .filter(t => t.type === 'EXPENSE')
      .forEach(t => {
        lines.push(`${t.date},${t.amount.toFixed(2)},${t.category || 'N/A'},${t.description || 'N/A'}`);
      });

    // Add BOM for Excel compatibility
    return '\uFEFF' + lines.join('\n');
  }

  async exportToJSON(reportData: FinancialReportData): Promise<string> {
    return JSON.stringify(reportData, null, 2);
  }

  async exportToPDF(reportData: FinancialReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc.fontSize(20).font('Helvetica-Bold').text('RELATÓRIO FINANCEIRO - MR3X', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).font('Helvetica');
        doc.text(`Período: ${reportData.period.start} a ${reportData.period.end}`, { align: 'center' });
        doc.text(`Tipo: ${reportData.period.type}`, { align: 'center' });
        doc.text(`Gerado em: ${new Date(reportData.generatedAt).toLocaleString('pt-BR')}`, { align: 'center' });
        doc.text(`IP de Geração: ${reportData.ip}`, { align: 'center' });
        doc.moveDown(2);

        // Summary
        doc.fontSize(14).font('Helvetica-Bold').text('RESUMO');
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica');
        doc.text(`Receita Total: R$ ${reportData.summary.totalRevenue.toFixed(2)}`);
        doc.text(`Despesas Total: R$ ${reportData.summary.totalExpenses.toFixed(2)}`);
        doc.text(`Lucro Líquido: R$ ${reportData.summary.netIncome.toFixed(2)}`);
        doc.text(`Total de Transações: ${reportData.summary.totalTransactions}`);
        doc.text(`Receitas: ${reportData.summary.revenueTransactions || 0} | Despesas: ${reportData.summary.expenseTransactions || 0}`);
        doc.text(`Valor Pendente: R$ ${reportData.summary.pendingAmount.toFixed(2)}`);
        doc.text(`Valor Vencido: R$ ${reportData.summary.overdueAmount.toFixed(2)}`);
        doc.moveDown(2);

        // Revenue Section
        doc.fontSize(14).font('Helvetica-Bold').text('RECEITAS');
        doc.moveDown(0.5);
        const revenueTransactions = reportData.transactions.filter(t => t.type === 'REVENUE');
        if (revenueTransactions.length > 0) {
          doc.fontSize(10).font('Helvetica-Bold');
          doc.text('Data', 50);
          doc.text('Valor', 150);
          doc.text('Categoria', 250);
          doc.text('Imóvel', 350);
          doc.moveDown(0.3);
          doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
          doc.moveDown(0.3);

          doc.font('Helvetica');
          revenueTransactions.slice(0, 50).forEach((t) => {
            if (doc.y > 750) {
              doc.addPage();
            }
            doc.text(t.date, 50);
            doc.text(`R$ ${t.amount.toFixed(2)}`, 150);
            doc.text(t.category || 'N/A', 250);
            doc.text(t.property?.name || 'N/A', 350);
            doc.moveDown(0.4);
          });
        } else {
          doc.font('Helvetica').text('Nenhuma receita registrada no período.');
        }

        doc.moveDown(1);

        // Expense Section
        doc.fontSize(14).font('Helvetica-Bold').text('DESPESAS');
        doc.moveDown(0.5);
        const expenseTransactions = reportData.transactions.filter(t => t.type === 'EXPENSE');
        if (expenseTransactions.length > 0) {
          doc.fontSize(10).font('Helvetica-Bold');
          doc.text('Data', 50);
          doc.text('Valor', 150);
          doc.text('Categoria', 250);
          doc.text('Descrição', 350);
          doc.moveDown(0.3);
          doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
          doc.moveDown(0.3);

          doc.font('Helvetica');
          expenseTransactions.slice(0, 50).forEach((t) => {
            if (doc.y > 750) {
              doc.addPage();
            }
            doc.text(t.date, 50);
            doc.text(`R$ ${t.amount.toFixed(2)}`, 150);
            doc.text(t.category || 'N/A', 250);
            doc.text((t.description || 'N/A').substring(0, 30), 350);
            doc.moveDown(0.4);
          });
        } else {
          doc.font('Helvetica').text('Nenhuma despesa registrada no período.');
        }

        // Footer with hash
        doc.moveDown(2);
        doc.fontSize(8).font('Helvetica').text(`Hash SHA-256: ${reportData.hash}`, { align: 'center' });
        doc.text(`Este documento é imutável e serve como prova de integridade para a Receita Federal.`, { align: 'center' });
        doc.text(`Gerado por: ${reportData.generatedBy} | IP: ${reportData.ip}`, { align: 'center' });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}

