import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { ContractLegalIntegrationService } from './contract-legal-integration.service';
import { ContractLifecycleService, ContractLifecycleEventType } from './contract-lifecycle.service';

/**
 * Complete legal flow: Contract → Default → Notice → Agreement → Judicial
 */
@Injectable()
export class ContractLegalFlowService {
  constructor(
    private prisma: PrismaService,
    private legalIntegration: ContractLegalIntegrationService,
    private lifecycle: ContractLifecycleService,
  ) {}

  /**
   * Step 1: Detect and register default
   */
  async detectDefault(contractId: string): Promise<{
    defaultDetected: boolean;
    defaultStatus: any;
    eventCreated: boolean;
  }> {
    const defaultStatus = await this.legalIntegration.getFormalDefaultStatus(contractId);

    if (defaultStatus.isInDefault) {
      // Create lifecycle event
      await this.lifecycle.createEvent(
        contractId,
        ContractLifecycleEventType.DEFAULT_DECLARED,
        `Inadimplemento detectado: R$ ${defaultStatus.defaultAmount.toFixed(2)}`,
        {
          defaultAmount: defaultStatus.defaultAmount,
          overdueInvoices: defaultStatus.overdueInvoices,
          defaultDate: defaultStatus.defaultDate,
        },
        'SYSTEM',
        {
          type: 'PENALTY',
          amount: defaultStatus.defaultAmount,
          currency: 'BRL',
        },
      );

      return {
        defaultDetected: true,
        defaultStatus,
        eventCreated: true,
      };
    }

    return {
      defaultDetected: false,
      defaultStatus,
      eventCreated: false,
    };
  }

  /**
   * Step 2: Generate extrajudicial notice
   */
  async generateNotice(contractId: string, createdBy: string): Promise<{
    noticeCreated: boolean;
    legalBasis: any;
    noticeData?: any;
  }> {
    const legalBasis = await this.legalIntegration.getNotificationLegalBasis(contractId);

    if (!legalBasis.defaultStatus || legalBasis.defaultStatus === 'ALLEGED') {
      return {
        noticeCreated: false,
        legalBasis,
        noticeData: null,
      };
    }

    // Create notice (this would integrate with ExtrajudicialNotificationService)
    const noticeData = {
      contractId,
      legalBasis: legalBasis.legalBasis,
      applicableArticles: legalBasis.applicableArticles,
      deadline: 15, // 15 days default
      status: 'PENDING',
    };

    return {
      noticeCreated: true,
      legalBasis,
      noticeData,
    };
  }

  /**
   * Step 3: Create agreement proposal
   */
  async createAgreementProposal(
    contractId: string,
    createdBy: string,
    options?: {
      installments?: number;
      discountPercent?: number;
    },
  ): Promise<{
    agreementCreated: boolean;
    agreementData?: any;
    debtCalculation: any;
  }> {
    const debtData = await this.legalIntegration.getAgreementContractData(contractId);

    const installments = options?.installments || 1;
    const discountPercent = options?.discountPercent || 0;

    const negotiatedAmount =
      debtData.calculatedDebt.total * (1 - discountPercent / 100);
    const installmentValue = negotiatedAmount / installments;

    const agreementData = {
      contractId,
      type: 'PAYMENT_SETTLEMENT',
      title: `Acordo de Pagamento - Contrato ${debtData.contract.token}`,
      description: `Acordo para quitação de débito originado do contrato ${debtData.contract.token}`,
      originalAmount: debtData.calculatedDebt.total,
      negotiatedAmount,
      installments,
      installmentValue,
      fineAmount: debtData.calculatedDebt.fines,
      discountAmount: debtData.calculatedDebt.total - negotiatedAmount,
    };

    // Create lifecycle event
    await this.lifecycle.createEvent(
      contractId,
      ContractLifecycleEventType.AGREEMENT_REACHED,
      `Proposta de acordo criada: R$ ${negotiatedAmount.toFixed(2)} em ${installments}x`,
      agreementData,
      createdBy,
      {
        type: 'ADJUSTMENT',
        amount: -discountPercent,
        currency: 'PERCENT',
      },
    );

    return {
      agreementCreated: true,
      agreementData,
      debtCalculation: debtData.calculatedDebt,
    };
  }

  /**
   * Step 4: Prepare for judicial action
   */
  async prepareJudicial(contractId: string): Promise<{
    dossier: any;
    ready: boolean;
    recommendations: string[];
  }> {
    const dossier = await this.legalIntegration.prepareJudicialDossier(contractId);

    const recommendations: string[] = [];

    if (!dossier.ready) {
      recommendations.push('Complete os seguintes itens antes de prosseguir:');
      recommendations.push(...dossier.missingItems);
    } else {
      recommendations.push('Dossiê completo e pronto para uso judicial');
      recommendations.push('Todos os documentos necessários estão presentes');
      recommendations.push('Timeline completa disponível');
    }

    // Create lifecycle event
    await this.lifecycle.createEvent(
      contractId,
      ContractLifecycleEventType.JUDICIAL_PREPARATION,
      'Preparação para ação judicial',
      {
        ready: dossier.ready,
        missingItems: dossier.missingItems,
        documentsCount: dossier.documents.length,
        timelineEvents: dossier.timeline.length,
      },
      'SYSTEM',
    );

    return {
      dossier,
      ready: dossier.ready,
      recommendations,
    };
  }

  /**
   * Complete flow execution
   */
  async executeCompleteFlow(contractId: string, createdBy: string): Promise<{
    step1: any;
    step2: any;
    step3: any;
    step4: any;
    summary: {
      currentStep: string;
      nextAction: string;
      recommendations: string[];
    };
  }> {
    // Step 1: Detect default
    const step1 = await this.detectDefault(contractId);

    let step2: { noticeCreated: boolean; legalBasis: any; noticeData?: any } | null = null;
    let step3: { agreementCreated: boolean; agreementData?: any; debtCalculation: any } | null = null;
    let step4: { dossier: any; ready: boolean; recommendations: string[] } | null = null;

    if (step1.defaultDetected) {
      // Step 2: Generate notice
      step2 = await this.generateNotice(contractId, createdBy);

      if (step2.noticeCreated) {
        // Step 3: Create agreement proposal
        step3 = await this.createAgreementProposal(contractId, createdBy);

        // Step 4: Prepare judicial (always available)
        step4 = await this.prepareJudicial(contractId);
      }
    }

    // Determine current step and next action
    let currentStep = 'CONTRACT_ACTIVE';
    let nextAction = 'Aguardando inadimplemento';

    if (step1.defaultDetected) {
      currentStep = 'DEFAULT_DETECTED';
      nextAction = 'Gerar notificação extrajudicial';

      if (step2?.noticeCreated) {
        currentStep = 'NOTICE_SENT';
        nextAction = 'Aguardar resposta ou criar proposta de acordo';

        if (step3?.agreementCreated) {
          currentStep = 'AGREEMENT_PROPOSED';
          nextAction = 'Aguardar assinatura do acordo ou preparar para ação judicial';
        }
      }
    }

    const recommendations: string[] = [];
    if (step4 && !step4.ready) {
      recommendations.push(...step4.recommendations);
    }

    return {
      step1,
      step2,
      step3,
      step4,
      summary: {
        currentStep,
        nextAction,
        recommendations,
      },
    };
  }
}

