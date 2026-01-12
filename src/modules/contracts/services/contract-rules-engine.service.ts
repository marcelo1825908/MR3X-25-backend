import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';

export enum ContractType {
  RESIDENTIAL = 'RESIDENTIAL',
  NON_RESIDENTIAL = 'NON_RESIDENTIAL',
  SHORT_TERM = 'SHORT_TERM',
  COMMERCIAL_FIXED = 'COMMERCIAL_FIXED',
  COMMERCIAL_INDEFINITE = 'COMMERCIAL_INDEFINITE',
}

export enum GuaranteeType {
  CASH_DEPOSIT = 'CASH_DEPOSIT',
  GUARANTOR = 'GUARANTOR',
  RENT_INSURANCE = 'RENT_INSURANCE',
  CAPITALIZATION_BOND = 'CAPITALIZATION_BOND',
}

export enum ChargeResponsibility {
  OWNER = 'OWNER',
  TENANT = 'TENANT',
  SHARED = 'SHARED',
}

export interface ContractRule {
  id: string;
  name: string;
  condition: (contract: any) => boolean;
  action: (contract: any) => any;
  legalBasis: string;
  description: string;
}

export interface ContractCharges {
  iptu: { responsible: ChargeResponsibility; value?: number };
  condominium: { responsible: ChargeResponsibility; value?: number };
  water: { responsible: ChargeResponsibility; value?: number };
  electricity: { responsible: ChargeResponsibility; value?: number };
  gas: { responsible: ChargeResponsibility; value?: number };
  fines: { responsible: ChargeResponsibility; value?: number };
}

export interface ContractRACI {
  owner: string[];
  tenant: string[];
  agency: string[];
  platform: string[];
}

export interface JudicialReadinessChecklist {
  properPartyQualification: boolean;
  definedContractType: boolean;
  validLeaseGuarantee: boolean;
  completedSignatures: boolean;
  completeLogs: boolean;
  essentialClausesIncluded: boolean;
  chargesDefined: boolean;
  penaltiesParameterized: boolean;
  legalBasisDocumented: boolean;
  hashGenerated: boolean;
  overallReady: boolean;
  missingItems: string[];
}

@Injectable()
export class ContractRulesEngineService {
  private rules: ContractRule[] = [];

  constructor(private prisma: PrismaService) {
    this.initializeRules();
  }

  private initializeRules() {
    // Rule 1: Residential contracts < 30 months - Article 47 of Tenancy Law
    this.rules.push({
      id: 'residential-short-term',
      name: 'Residential Short-Term Contract Rule',
      condition: (contract) => {
        const contractType = contract.contractType || contract.type;
        const months = this.calculateContractMonths(contract.startDate, contract.endDate);
        return contractType === ContractType.RESIDENTIAL && months < 30;
      },
      action: (contract) => ({
        repossessionRules: 'Article 47 of Brazilian Tenancy Law (Law 8,245/91)',
        requiresCourtOrder: true,
        noticePeriod: 30,
      }),
      legalBasis: 'Lei do Inquilinato, Art. 47',
      description: 'Residential contracts under 30 months are subject to Article 47 repossession rules',
    });

    // Rule 2: Automatic rent adjustment
    this.rules.push({
      id: 'rent-adjustment',
      name: 'Automatic Rent Adjustment Rule',
      condition: (contract) => {
        const adjustmentMonth = contract.readjustmentMonth || 12;
        const currentMonth = new Date().getMonth() + 1;
        return currentMonth === adjustmentMonth && contract.status === 'ACTIVE';
      },
      action: (contract) => ({
        shouldAdjust: true,
        adjustmentIndex: contract.readjustmentIndex || 'IGPM',
        eventType: 'RENT_ADJUSTMENT',
      }),
      legalBasis: 'Lei do Inquilinato, Art. 7º',
      description: 'Automatic rent adjustment based on index and month',
    });

    // Rule 3: Grace period for late payment
    this.rules.push({
      id: 'grace-period',
      name: 'Grace Period Rule',
      condition: (contract) => {
        // Check if payment is overdue but within grace period
        return contract.status === 'ACTIVE';
      },
      action: (contract) => ({
        gracePeriodDays: 5, // Default 5 days grace period
        eventType: 'GRACE_PERIOD',
        appliesPenalty: false,
      }),
      legalBasis: 'Lei do Inquilinato, Art. 22',
      description: 'Grace period before applying late fees',
    });

    // Rule 4: Acceleration clause
    this.rules.push({
      id: 'acceleration-clause',
      name: 'Acceleration Clause Rule',
      condition: (contract) => {
        // Check if there are multiple overdue payments
        return contract.status === 'ACTIVE';
      },
      action: (contract) => ({
        accelerationTrigger: 'MULTIPLE_OVERDUE_PAYMENTS',
        eventType: 'ACCELERATION',
        makesAllPaymentsDue: true,
      }),
      legalBasis: 'Código Civil, Art. 333',
      description: 'Acceleration clause for multiple defaults',
    });

    // Rule 5: Valid forum selection
    this.rules.push({
      id: 'forum-selection',
      name: 'Forum Selection Clause Rule',
      condition: (contract) => {
        return contract.jurisdiction && contract.jurisdiction.trim() !== '';
      },
      action: (contract) => ({
        validForum: contract.jurisdiction,
        eventType: 'FORUM_SELECTION',
        legalBasis: 'Código de Processo Civil, Art. 63',
      }),
      legalBasis: 'CPC, Art. 63',
      description: 'Valid forum selection clause',
    });
  }

  /**
   * Apply all applicable rules to a contract
   */
  async applyRules(contractId: string): Promise<any> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(contractId) },
      include: {
        property: true,
        tenantUser: true,
        ownerUser: true,
      },
    });

    if (!contract) {
      throw new Error('Contract not found');
    }

    const applicableRules = this.rules.filter((rule) => rule.condition(contract));
    const results = applicableRules.map((rule) => ({
      ruleId: rule.id,
      ruleName: rule.name,
      legalBasis: rule.legalBasis,
      description: rule.description,
      result: rule.action(contract),
    }));

    return {
      contractId,
      applicableRules: results,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate penalty based on legal parameters
   */
  calculatePenalty(contract: any, remainingMonths: number, totalMonths: number): number {
    const rent = Number(contract.monthlyRent);
    const penaltyPercent = Number(contract.earlyTerminationPenaltyPercent || 3.0);
    const basePenalty = rent * 3; // 3 months rent
    const proportionalFactor = remainingMonths / totalMonths;
    return basePenalty * proportionalFactor;
  }

  /**
   * Validate contract type and apply appropriate legal framework
   */
  validateContractType(contractType: string, termMonths: number): {
    valid: boolean;
    legalFramework: string;
    applicableArticles: string[];
    warnings: string[];
  } {
    const warnings: string[] = [];
    let legalFramework = '';
    const applicableArticles: string[] = [];

    switch (contractType) {
      case ContractType.RESIDENTIAL:
        legalFramework = 'Lei do Inquilinato (Lei 8.245/91)';
        applicableArticles.push('Art. 7º', 'Art. 22', 'Art. 47');
        if (termMonths < 30) {
          warnings.push('Residential contracts under 30 months are subject to Article 47 repossession rules');
        }
        break;
      case ContractType.NON_RESIDENTIAL:
        legalFramework = 'Código Civil (Lei 10.406/2002)';
        applicableArticles.push('Art. 565', 'Art. 571');
        break;
      case ContractType.COMMERCIAL_FIXED:
        legalFramework = 'Código Civil + Lei do Inquilinato (commercial provisions)';
        applicableArticles.push('Art. 565 CC', 'Art. 7º Lei 8.245/91');
        break;
      default:
        warnings.push('Contract type not fully defined');
    }

    return {
      valid: true,
      legalFramework,
      applicableArticles,
      warnings,
    };
  }

  /**
   * Check judicial readiness
   */
  async checkJudicialReadiness(contractId: string): Promise<JudicialReadinessChecklist> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(contractId) },
      include: {
        property: true,
        tenantUser: true,
        ownerUser: true,
        audits: {
          take: 1,
          orderBy: { performedAt: 'desc' },
        },
      },
    });

    if (!contract) {
      throw new Error('Contract not found');
    }

    const missingItems: string[] = [];

    const properPartyQualification =
      !!contract.tenantUser && !!contract.ownerUser && !!contract.property;
    if (!properPartyQualification) missingItems.push('Proper party qualification');

    const definedContractType = !!(contract as any).contractType || !!(contract as any).type;
    if (!definedContractType) missingItems.push('Defined contract type');

    const validLeaseGuarantee =
      !!contract.guaranteeType && !!contract.deposit && Number(contract.deposit) > 0;
    if (!validLeaseGuarantee) missingItems.push('Valid lease guarantee');

    const completedSignatures =
      !!contract.tenantSignedAt && !!contract.ownerSignedAt && !!contract.hashFinal;
    if (!completedSignatures) missingItems.push('Completed signatures');

    const completeLogs = contract.audits && contract.audits.length > 0;
    if (!completeLogs) missingItems.push('Complete audit logs');

    const essentialClausesIncluded = !!(contract as any).clausesSnapshot;
    if (!essentialClausesIncluded) missingItems.push('Essential clauses included');

    const chargesDefined = this.checkChargesDefined(contract);
    if (!chargesDefined) missingItems.push('Charges defined');

    const penaltiesParameterized =
      !!contract.lateFeePercent &&
      !!contract.interestRatePercent &&
      !!contract.earlyTerminationPenaltyPercent;
    if (!penaltiesParameterized) missingItems.push('Penalties parameterized');

    const legalBasisDocumented = !!contract.jurisdiction;
    if (!legalBasisDocumented) missingItems.push('Legal basis documented');

    const hashGenerated = !!contract.hashFinal;
    if (!hashGenerated) missingItems.push('Hash generated');

    const overallReady = missingItems.length === 0;

    return {
      properPartyQualification,
      definedContractType,
      validLeaseGuarantee,
      completedSignatures,
      completeLogs,
      essentialClausesIncluded,
      chargesDefined,
      penaltiesParameterized,
      legalBasisDocumented,
      hashGenerated,
      overallReady,
      missingItems,
    };
  }

  private checkChargesDefined(contract: any): boolean {
    // Check if charges are defined in contract metadata
    const charges = (contract as any).charges;
    if (!charges) return false;

    return (
      charges.iptu !== undefined ||
      charges.condominium !== undefined ||
      charges.water !== undefined ||
      charges.electricity !== undefined
    );
  }

  private calculateContractMonths(startDate: Date | string, endDate: Date | string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    return months;
  }

  /**
   * Generate automatic clauses based on contract type and conditions
   */
  generateAutomaticClauses(contract: any): string[] {
    const clauses: string[] = [];

    // Grace period clause
    clauses.push(
      'As partes estabelecem prazo de 5 (cinco) dias corridos após o vencimento para pagamento sem aplicação de multa.',
    );

    // Acceleration clause
    clauses.push(
      'Em caso de inadimplemento de 2 (duas) ou mais parcelas, todas as parcelas vincendas tornar-se-ão imediatamente exigíveis.',
    );

    // Forum selection clause
    if (contract.jurisdiction) {
      clauses.push(
        `Fica eleito o foro da comarca de ${contract.jurisdiction} para dirimir questões oriundas deste contrato.`,
      );
    }

    // Electronic communications clause
    clauses.push(
      'As comunicações entre as partes poderão ser realizadas por meio eletrônico, sendo válidas as notificações enviadas por e-mail cadastrado.',
    );

    // LGPD clause
    clauses.push(
      'O tratamento de dados pessoais será realizado em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018), sendo os dados utilizados exclusivamente para execução deste contrato.',
    );

    return clauses;
  }
}

