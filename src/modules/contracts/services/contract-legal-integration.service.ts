import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';

/**
 * Service for legal-logical integration between Contract and other modules
 * Ensures that legal basis flows correctly between modules
 */
@Injectable()
export class ContractLegalIntegrationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get legal basis for extrajudicial notification from contract
   */
  async getNotificationLegalBasis(contractId: string): Promise<{
    contract: any;
    legalBasis: string[];
    defaultStatus: 'PROVEN' | 'ALLEGED';
    applicableArticles: string[];
  }> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(contractId) },
      include: {
        property: true,
        tenantUser: true,
        ownerUser: true,
        invoices: {
          where: { status: 'OVERDUE' },
          orderBy: { dueDate: 'asc' },
        },
      },
    });

    if (!contract) {
      throw new Error('Contract not found');
    }

    const legalBasis: string[] = [];
    const applicableArticles: string[] = [];

    // Check contract type to determine legal framework
    const contractType = (contract as any).contractType || 'RESIDENTIAL';
    
    if (contractType === 'RESIDENTIAL') {
      legalBasis.push('Lei do Inquilinato (Lei 8.245/1991)');
      applicableArticles.push('Art. 22', 'Art. 23');
    } else {
      legalBasis.push('Código Civil (Lei 10.406/2002)');
      applicableArticles.push('Art. 389', 'Art. 397');
    }

    // Check for proven default
    const hasOverdueInvoices = contract.invoices && contract.invoices.length > 0;
    const defaultStatus: 'PROVEN' | 'ALLEGED' = hasOverdueInvoices ? 'PROVEN' : 'ALLEGED';

    if (hasOverdueInvoices) {
      legalBasis.push('Inadimplemento contratual comprovado');
      const totalOverdue = contract.invoices.reduce((sum, inv) => {
        return sum + Number(inv.originalValue || 0);
      }, 0);
      legalBasis.push(`Valor em atraso: R$ ${totalOverdue.toFixed(2)}`);
    }

    return {
      contract: {
        id: contract.id.toString(),
        token: contract.contractToken,
        monthlyRent: contract.monthlyRent,
        startDate: contract.startDate,
        endDate: contract.endDate,
      },
      legalBasis,
      defaultStatus,
      applicableArticles,
    };
  }

  /**
   * Get contract data for agreement creation
   */
  async getAgreementContractData(contractId: string): Promise<{
    contract: any;
    debtOrigin: string;
    originalAmount: number;
    calculatedDebt: {
      baseValue: number;
      fines: number;
      interest: number;
      total: number;
    };
  }> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(contractId) },
      include: {
        invoices: {
          where: { status: { in: ['OVERDUE', 'PENDING'] } },
          orderBy: { dueDate: 'asc' },
        },
      },
    });

    if (!contract) {
      throw new Error('Contract not found');
    }

    // Calculate total debt
    let baseValue = 0;
    let fines = 0;
    let interest = 0;

    contract.invoices.forEach((invoice) => {
      const invoiceValue = Number(invoice.originalValue || 0);
      baseValue += invoiceValue;

      // Calculate fines and interest if overdue
      if (invoice.status === 'OVERDUE' && invoice.dueDate) {
        const dueDate = new Date(invoice.dueDate);
        const today = new Date();
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysOverdue > 0) {
          const lateFeePercent = Number(contract.lateFeePercent || 2.0);
          const interestRatePercent = Number(contract.interestRatePercent || 1.0);
          
          fines += invoiceValue * (lateFeePercent / 100);
          interest += invoiceValue * (interestRatePercent / 100) * (daysOverdue / 30);
        }
      }
    });

    const total = baseValue + fines + interest;

    return {
      contract: {
        id: contract.id.toString(),
        token: contract.contractToken,
        monthlyRent: contract.monthlyRent,
      },
      debtOrigin: `Contrato ${contract.contractToken || contract.id}`,
      originalAmount: baseValue,
      calculatedDebt: {
        baseValue,
        fines,
        interest,
        total,
      },
    };
  }

  /**
   * Link inspection to contract with automatic clauses
   */
  async linkInspectionToContract(
    contractId: string,
    inspectionId: string,
  ): Promise<{
    linked: boolean;
    automaticClauses: string[];
  }> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(contractId) },
    });

    const inspection = await this.prisma.inspection.findUnique({
      where: { id: BigInt(inspectionId) },
    });

    if (!contract || !inspection) {
      throw new Error('Contract or inspection not found');
    }

    // Generate automatic clauses based on inspection
    const automaticClauses: string[] = [];

    if (inspection.status === 'APPROVED') {
      automaticClauses.push(
        'As partes reconhecem o relatório de vistoria como representação fiel do estado de conservação do imóvel.',
      );
      automaticClauses.push(
        'O locatário assume responsabilidade pela manutenção do imóvel no estado verificado na vistoria.',
      );
    }

    return {
      linked: true,
      automaticClauses,
    };
  }

  /**
   * Get formal default status from contract and payments
   */
  async getFormalDefaultStatus(contractId: string): Promise<{
    isInDefault: boolean;
    defaultDate?: Date;
    defaultAmount: number;
    overdueInvoices: number;
    legalBasis: string;
  }> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(contractId) },
      include: {
        invoices: {
          where: { status: 'OVERDUE' },
          orderBy: { dueDate: 'asc' },
        },
        payments: {
          where: { status: 'CONFIRMED' },
          orderBy: { dataPagamento: 'desc' },
        },
      },
    });

    if (!contract) {
      throw new Error('Contract not found');
    }

    const overdueInvoices = contract.invoices.length;
    const isInDefault = overdueInvoices > 0;

    let defaultDate: Date | undefined;
    let defaultAmount = 0;

    if (isInDefault && contract.invoices.length > 0) {
      defaultDate = contract.invoices[0].dueDate;
      defaultAmount = contract.invoices.reduce((sum, inv) => {
        return sum + Number(inv.originalValue || 0);
      }, 0);
    }

    const legalBasis = isInDefault
      ? 'Inadimplemento contratual nos termos do Art. 22 da Lei do Inquilinato'
      : 'Contrato em situação regular';

    return {
      isInDefault,
      defaultDate,
      defaultAmount,
      overdueInvoices,
      legalBasis,
    };
  }

  /**
   * Prepare judicial dossier
   */
  async prepareJudicialDossier(contractId: string): Promise<{
    contract: any;
    timeline: any[];
    documents: any[];
    financialSummary: any;
    legalBasis: string[];
    ready: boolean;
    missingItems: string[];
  }> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(contractId) },
      include: {
        property: true,
        tenantUser: true,
        ownerUser: true,
        invoices: true,
        payments: true,
        agreements: true,
        extrajudicialNotifications: true,
        audits: {
          orderBy: { performedAt: 'asc' },
        },
      },
    });

    if (!contract) {
      throw new Error('Contract not found');
    }

    const missingItems: string[] = [];

    // Check required documents
    if (!contract.hashFinal) missingItems.push('PDF final assinado');
    if (!contract.tenantSignedAt || !contract.ownerSignedAt) missingItems.push('Assinaturas completas');
    if (contract.audits.length === 0) missingItems.push('Logs de auditoria');

    // Build timeline
    const timeline = [
      {
        date: contract.startDate,
        event: 'Início do contrato',
        type: 'CONTRACT_START',
      },
      ...contract.audits.map((audit) => ({
        date: audit.performedAt,
        event: audit.action,
        type: 'AUDIT',
        details: audit.details,
      })),
      ...contract.invoices
        .filter((inv) => inv.status === 'OVERDUE')
        .map((inv) => ({
          date: inv.dueDate,
          event: `Vencimento de fatura - R$ ${Number(inv.originalValue).toFixed(2)}`,
          type: 'INVOICE_OVERDUE',
        })),
      ...contract.extrajudicialNotifications.map((notif) => ({
        date: notif.createdAt,
        event: `Notificação extrajudicial - ${notif.status}`,
        type: 'NOTIFICATION',
      })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Financial summary
    const totalRent = Number(contract.monthlyRent);
    const totalPaid = contract.payments
      .filter((p) => p.status === 'CONFIRMED')
      .reduce((sum, p) => sum + Number(p.valorPago || 0), 0);
    const totalOverdue = contract.invoices
      .filter((inv) => inv.status === 'OVERDUE')
      .reduce((sum, inv) => sum + Number(inv.originalValue || 0), 0);

    // Legal basis
    const contractType = (contract as any).contractType || 'RESIDENTIAL';
    const legalBasis = contractType === 'RESIDENTIAL'
      ? ['Lei do Inquilinato (Lei 8.245/1991)', 'Código Civil (Lei 10.406/2002)']
      : ['Código Civil (Lei 10.406/2002)'];

    // Documents list
    const documents = [
      contract.finalPdfPath ? { type: 'CONTRACT_PDF', path: contract.finalPdfPath } : null,
      ...contract.extrajudicialNotifications.map((notif) => ({
        type: 'NOTIFICATION',
        id: notif.id.toString(),
        token: notif.notificationToken,
      })),
      ...contract.agreements.map((agreement) => ({
        type: 'AGREEMENT',
        id: agreement.id.toString(),
        token: agreement.agreementToken,
      })),
    ].filter(Boolean);

    return {
      contract: {
        id: contract.id.toString(),
        token: contract.contractToken,
        startDate: contract.startDate,
        endDate: contract.endDate,
        monthlyRent: contract.monthlyRent,
      },
      timeline,
      documents,
      financialSummary: {
        totalRent,
        totalPaid,
        totalOverdue,
        balance: totalOverdue - (totalPaid - totalRent * Math.floor((new Date().getTime() - new Date(contract.startDate).getTime()) / (1000 * 60 * 60 * 24 * 30))),
      },
      legalBasis,
      ready: missingItems.length === 0,
      missingItems,
    };
  }
}

