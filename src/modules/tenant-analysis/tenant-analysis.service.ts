import { Injectable, Logger, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { CellereService } from './integrations/cellere.service';
import { InfoSimplesService } from './integrations/infosimples.service';
import { AnalyzeTenantDto, AnalysisType, GetAnalysisHistoryDto } from './dto';
import { TenantAnalysisStatus, RiskLevel, UserRole } from '@prisma/client';
import { TenantVisibilityService } from './tenant-visibility.service';
import { BillingCycleService } from '../billing-cycle/billing-cycle.service';
import * as crypto from 'crypto';

@Injectable()
export class TenantAnalysisService {
  private readonly logger = new Logger(TenantAnalysisService.name);
  private readonly analysisValidityDays: number;

  constructor(
    private prisma: PrismaService,
    private cellereService: CellereService,
    private infoSimplesService: InfoSimplesService,
    private configService: ConfigService,
    @Inject(forwardRef(() => BillingCycleService))
    private billingCycleService: BillingCycleService,
  ) {
    this.analysisValidityDays = this.configService.get<number>('TENANT_ANALYSIS_VALIDITY_DAYS', 30);
  }

  private generateAnalysisToken(): string {
    const year = new Date().getFullYear();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `MR3X-PSQ-${year}-${random}`;
  }

  async analyzeTenant(dto: AnalyzeTenantDto, userId: bigint, agencyId?: bigint, userRole?: string) {
    const { document, analysisType = AnalysisType.FULL, name, lgpdAccepted, forceRefresh = false } = dto;
    const documentType = document.length === 11 ? 'CPF' : 'CNPJ';

    if (!lgpdAccepted) {
      throw new BadRequestException(
        'Você deve aceitar o Termo de Responsabilidade para realizar a consulta. O usuário declara possuir base legal válida e assume total responsabilidade pelo uso das informações obtidas, nos termos da LGPD.'
      );
    }

    this.logger.log(`Starting ${analysisType} analysis for document: ${this.maskDocument(document)}${forceRefresh ? ' (forced refresh)' : ''}`);

    if (!forceRefresh) {
      const existingAnalysis = await this.findRecentAnalysis(document, userId, agencyId, userRole);
      if (existingAnalysis) {
        this.logger.log(`Found recent valid analysis for document: ${this.maskDocument(document)}`);
        return this.formatAnalysisResponse(existingAnalysis);
      }
    } else {
      // Delete all existing analyses for this document when force refresh is enabled
      const deletedCount = await this.prisma.tenantAnalysis.deleteMany({
        where: { document },
      });
      this.logger.log(`Force refresh: deleted ${deletedCount.count} existing analyses for document: ${this.maskDocument(document)}`);
    }

    let financial, background, documentValidation;

    try {
      if (analysisType === AnalysisType.FULL || analysisType === AnalysisType.FINANCIAL) {
        financial = await this.getFinancialAnalysis(document);
      }

      if (analysisType === AnalysisType.FULL || analysisType === AnalysisType.BACKGROUND) {
        background = await this.getBackgroundAnalysis(document);
      }

      if (analysisType === AnalysisType.FULL) {
        documentValidation = await this.getDocumentValidation(document);
      }
    } catch (error) {
      this.logger.error(`Analysis failed for ${this.maskDocument(document)}: ${error.message}`);

      const errorMessage = this.extractErrorMessage(error);

      throw new Error(errorMessage);
    }

    const { riskScore, riskLevel } = this.calculateRiskScore(financial, background, documentValidation);
    const recommendation = this.getRecommendation(riskScore, riskLevel, background);
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + this.analysisValidityDays);

    const token = this.generateAnalysisToken();

    const isCPF = documentType === 'CPF';
    const address = documentValidation?.address || financial?.address;
    const fullAddress = address
      ? `${address.logradouro || ''}${address.numero ? ', ' + address.numero : ''}${address.bairro ? ' - ' + address.bairro : ''}`
      : null;
    const phones = documentValidation?.phones || financial?.phones || [];

    const analysis = await this.prisma.tenantAnalysis.create({
      data: {
        token,
        document,
        documentType,
        name: documentValidation?.registrationName || financial?.name || name,
        requestedById: userId,
        agencyId,

        ...(isCPF ? {
          personStatus: documentValidation?.situacaoCadastral || financial?.situacaoCadastral,
          personAddress: fullAddress,
          personCity: address?.cidade,
          personState: address?.uf,
          personZipCode: address?.cep,
          personPhone: phones?.[0] || null,
          birthDate: documentValidation?.birthDate || financial?.birthDate,
          motherName: documentValidation?.motherName || financial?.motherName,
        } : {}),

        ...(!isCPF ? {
          companyName: documentValidation?.registrationName || financial?.name,
          tradingName: null,
          companyStatus: documentValidation?.situacaoCadastral || financial?.situacaoCadastral,
          companyAddress: fullAddress,
          companyCity: address?.cidade,
          companyState: address?.uf,
          companyZipCode: address?.cep,
          companyPhone: phones?.[0] || null,
        } : {}),

        lgpdAcceptedAt: new Date(),
        lgpdAcceptedBy: userId,

        creditScore: financial?.creditScore,
        totalDebts: financial?.totalDebts,
        activeDebts: financial?.activeDebts,
        hasNegativeRecords: financial?.hasNegativeRecords,
        paymentDelays: financial?.paymentDelays,
        averageDelayDays: financial?.averageDelayDays,
        financialDetails: financial?.debtDetails ? JSON.stringify(financial.debtDetails) : null,
        financialStatus: financial?.status,

        hasCriminalRecords: background?.hasCriminalRecords,
        criminalRecordsCount: background?.criminalRecords?.length || 0,
        criminalDetails: background?.criminalRecords ? JSON.stringify(background.criminalRecords) : null,
        criminalStatus: background?.hasCriminalRecords ? 'WARNING' : 'CLEAR',

        hasJudicialRecords: background?.hasJudicialRecords,
        judicialRecordsCount: background?.judicialRecords?.length || 0,
        hasEvictions: background?.hasEvictions,
        evictionsCount: background?.evictionsCount,
        judicialDetails: background?.judicialRecords ? JSON.stringify(background.judicialRecords) : null,
        judicialStatus: background?.hasEvictions ? 'CRITICAL' : (background?.hasJudicialRecords ? 'WARNING' : 'CLEAR'),

        hasProtests: background?.hasProtests,
        protestsCount: background?.protestRecords?.length || 0,
        totalProtestValue: background?.totalProtestValue,
        protestDetails: background?.protestRecords ? JSON.stringify(background.protestRecords) : null,
        protestStatus: background?.hasProtests ? 'WARNING' : 'CLEAR',

        documentValid: documentValidation?.documentValid,
        documentActive: documentValidation?.documentActive,
        documentOwnerMatch: documentValidation?.documentOwnerMatch,
        hasFraudAlerts: documentValidation?.hasFraudAlerts,
        documentStatus: documentValidation?.status,

        riskScore,
        riskLevel,
        recommendation: recommendation.recommendation,
        recommendationNotes: recommendation.notes,

        status: TenantAnalysisStatus.COMPLETED,
        analyzedAt: new Date(),
        validUntil,

        rawResponse: JSON.stringify({ financial, background, documentValidation }),
      },
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Track usage for billing (only when a new analysis is created, not for cached results)
    if (agencyId) {
      try {
        await this.billingCycleService.trackUsage({
          agencyId: agencyId.toString(),
          feature: 'screenings',
          quantity: 1,
          referenceId: analysis.id.toString(),
          referenceType: 'tenant_analysis',
        });
        this.logger.log(`Usage tracked for analysis ${analysis.id} - agency ${agencyId}`);
      } catch (error) {
        // Log error but don't fail the analysis if usage tracking fails
        this.logger.error(`Failed to track usage for analysis ${analysis.id}: ${error.message}`);
      }
    }

    this.logger.log(`Analysis completed for ${this.maskDocument(document)} - Risk: ${riskLevel} (${riskScore})`);
    return this.formatAnalysisResponse(analysis);
  }

  private extractErrorMessage(error: any): string {
    const message = error.message || 'Unknown error';

    if (message.includes('Insufficient Cellere credits')) {
      return 'Créditos insuficientes na API Cellere. Por favor, adicione mais créditos na sua conta.';
    }
    if (message.includes('invalidToken') || message.includes('401')) {
      return 'Token da API Cellere inválido. Por favor, verifique a configuração do token.';
    }
    if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
      return 'Tempo limite excedido ao conectar com a API. Tente novamente.';
    }
    if (message.includes('ENOTFOUND') || message.includes('ECONNREFUSED')) {
      return 'Não foi possível conectar com o serviço de análise. Verifique sua conexão.';
    }
    if (message.includes('Request failed with status code 400')) {
      return 'Documento inválido ou formato incorreto. Verifique o CPF/CNPJ informado.';
    }
    if (message.includes('Request failed with status code 404')) {
      return 'Documento não encontrado na base de dados.';
    }
    if (message.includes('Request failed with status code 500')) {
      return 'Erro interno no serviço de análise. Tente novamente mais tarde.';
    }

    return `Erro na análise: ${message}`;
  }

  async getAnalysisHistory(dto: GetAnalysisHistoryDto, userId: bigint, userRole: string, agencyId?: bigint) {
    const { document, search, riskLevel, status, page = 1, limit = 10 } = dto;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (userRole === 'CEO') {
      return {
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    } else if (userRole === 'ADMIN') {
      where.agencyId = null;
    } else if (['AGENCY_ADMIN', 'AGENCY_MANAGER', 'BROKER'].includes(userRole)) {
      if (!agencyId) {
        return {
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        };
      }
      where.agencyId = agencyId;
    } else if (['INDEPENDENT_OWNER', 'PROPRIETARIO'].includes(userRole)) {
      where.requestedById = userId;
    } else {
      return {
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    // Handle search parameter - search by document or name
    if (search) {
      // Clean the search term (remove dots, dashes, spaces for document search)
      const cleanedSearch = search.replace(/[\.\-\s\/]/g, '');
      this.logger.log(`Search term: "${search}", cleaned: "${cleanedSearch}"`);

      // Use AND to combine role-based filters with OR search conditions
      // Note: MySQL is case-insensitive by default with utf8 collation
      const searchConditions = [
        { document: { contains: cleanedSearch } },
        { name: { contains: search } },
        { token: { contains: search } },
      ];

      // If we already have role-based conditions, combine with AND
      const existingConditions = { ...where };
      where.AND = [
        existingConditions,
        { OR: searchConditions }
      ];
      // Remove the duplicated conditions from root level
      delete where.agencyId;
      delete where.requestedById;
    }

    // Also support direct document filter (for backwards compatibility)
    if (document && !search) {
      const cleanedDocument = document.replace(/[\.\-\s\/]/g, '');
      where.document = { contains: cleanedDocument };
    }

    if (riskLevel) {
      where.riskLevel = riskLevel as RiskLevel;
    }
    if (status) {
      where.status = status as TenantAnalysisStatus;
    }

    const [data, total] = await Promise.all([
      this.prisma.tenantAnalysis.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          requestedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.tenantAnalysis.count({ where }),
    ]);

    const dataWithVisibility = data.map(item => {
      const formatted = {
        id: item.id.toString(),
        token: item.token,
        document: item.document,
        documentType: item.documentType,
        name: item.name,
        riskScore: item.riskScore,
        riskLevel: item.riskLevel,
        recommendation: item.recommendation,
        status: item.status,
        analyzedAt: item.analyzedAt?.toISOString(),
        requestedBy: {
          id: item.requestedBy.id.toString(),
          name: item.requestedBy.name,
          email: item.requestedBy.email,
        },
        basicData: item.documentType === 'CPF'
          ? {
              type: 'CPF',
              name: item.name,
              status: item.personStatus,
              phone: item.personPhone,
              birthDate: item.birthDate || null,
              address: item.personAddress,
              city: item.personCity,
              state: item.personState,
              zipCode: item.personZipCode,
            }
          : {
              type: 'CNPJ',
              companyName: item.companyName || item.name,
              status: item.companyStatus,
              phone: item.companyPhone,
              address: item.companyAddress,
              city: item.companyCity,
              state: item.companyState,
              zipCode: item.companyZipCode,
            },
      };

      return TenantVisibilityService.applyVisibility(
        formatted,
        userRole as UserRole,
        userId,
      );
    });

    return {
      data: dataWithVisibility,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAnalysisById(id: bigint, userId: bigint, userRole: string, agencyId?: bigint) {
    const analysis = await this.prisma.tenantAnalysis.findUnique({
      where: { id },
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!analysis) {
      throw new NotFoundException('Análise não encontrada');
    }

    if (userRole === 'CEO') {
      throw new NotFoundException('Acesso negado. CEO não tem acesso ao histórico de pesquisas.');
    } else if (userRole === 'ADMIN') {
      if (analysis.agencyId !== null) {
        throw new NotFoundException('Análise não encontrada');
      }
    } else if (['AGENCY_ADMIN', 'AGENCY_MANAGER', 'BROKER'].includes(userRole)) {
      if (!agencyId || analysis.agencyId !== agencyId) {
        throw new NotFoundException('Análise não encontrada');
      }
    } else if (['INDEPENDENT_OWNER', 'PROPRIETARIO'].includes(userRole)) {
      if (analysis.requestedById !== userId) {
        throw new NotFoundException('Análise não encontrada');
      }
    } else {
      throw new NotFoundException('Análise não encontrada');
    }

    const formatted = this.formatAnalysisResponse(analysis);
    return TenantVisibilityService.applyVisibility(
      formatted,
      userRole as UserRole,
      userId,
    );
  }

  async getAnalysisStats(userId: bigint, userRole: string, agencyId?: bigint) {
    const where: any = {};

    if (userRole === 'CEO') {
      return {
        total: 0,
        byRiskLevel: {},
        byStatus: {},
        recentAnalyses: [],
      };
    } else if (userRole === 'ADMIN') {
      where.agencyId = null;
    } else if (['AGENCY_ADMIN', 'AGENCY_MANAGER', 'BROKER'].includes(userRole)) {
      if (!agencyId) {
        return {
          total: 0,
          byRiskLevel: {},
          byStatus: {},
          recentAnalyses: [],
        };
      }
      where.agencyId = agencyId;
    } else if (['INDEPENDENT_OWNER', 'PROPRIETARIO'].includes(userRole)) {
      where.requestedById = userId;
    } else {
      return {
        total: 0,
        byRiskLevel: {},
        byStatus: {},
        recentAnalyses: [],
      };
    }

    const [total, byRiskLevel, byStatus, recentAnalyses] = await Promise.all([
      this.prisma.tenantAnalysis.count({ where }),
      this.prisma.tenantAnalysis.groupBy({
        by: ['riskLevel'],
        where: { ...where, riskLevel: { not: null } },
        _count: true,
      }),
      this.prisma.tenantAnalysis.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      this.prisma.tenantAnalysis.findMany({
        where,
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          document: true,
          name: true,
          riskLevel: true,
          riskScore: true,
          analyzedAt: true,
        },
      }),
    ]);

    return {
      total,
      byRiskLevel: byRiskLevel.reduce((acc, item) => {
        acc[item.riskLevel || 'UNKNOWN'] = item._count;
        return acc;
      }, {} as Record<string, number>),
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>),
      recentAnalyses: recentAnalyses.map(a => ({
        id: a.id.toString(),
        document: a.document,
        name: a.name,
        riskLevel: a.riskLevel,
        riskScore: a.riskScore,
        analyzedAt: a.analyzedAt?.toISOString(),
      })),
    };
  }

  private async findRecentAnalysis(document: string, userId?: bigint, agencyId?: bigint, userRole?: string) {
    const where: any = {
      document,
      status: TenantAnalysisStatus.COMPLETED,
      validUntil: { gt: new Date() },
    };

    // Filter analyses based on user context to ensure proper data isolation
    if (userRole && ['INDEPENDENT_OWNER', 'PROPRIETARIO'].includes(userRole)) {
      // INDEPENDENT_OWNER should only see their own analyses
      where.requestedById = userId;
    } else if (userRole && ['AGENCY_ADMIN', 'AGENCY_MANAGER', 'BROKER'].includes(userRole)) {
      // Agency users can see analyses from their agency
      if (agencyId) {
        where.agencyId = agencyId;
      }
    } else if (userRole === 'ADMIN') {
      // ADMIN sees analyses without agency (platform-level)
      where.agencyId = null;
    }
    // CEO and other roles get no cached results (force fresh analysis)

    const analysis = await this.prisma.tenantAnalysis.findFirst({
      where,
      orderBy: { analyzedAt: 'desc' },
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return analysis;
  }

  private async getFinancialAnalysis(document: string) {
    return this.cellereService.getFinancialAnalysis({
      document,
      includeScore: true,
      includeDebts: true,
      includePaymentHistory: true,
    });
  }

  private async getBackgroundAnalysis(document: string) {
    let baseBackground = await this.cellereService.getBackgroundCheck({
      document,
      includeCriminal: true,
      includeJudicial: true,
      includeProtests: true,
    });

    try {
      const infoSimplesProtests = await this.infoSimplesService.analyzeProtests(document);

      if (infoSimplesProtests && infoSimplesProtests.hasProtests) {
        this.logger.log(`InfoSimples found ${infoSimplesProtests.totalProtests} protests for ${this.maskDocument(document)}`);

        const mappedProtests = infoSimplesProtests.protests.map(p => ({
          notaryOffice: p.notaryOffice,
          amount: p.amount || 0,
          creditor: p.assignor || p.presenter || 'Não informado',
          status: 'ATIVO',
          date: p.date,
          city: p.city,
          state: p.state,
          type: p.type,
          protocol: p.protocol,
          source: 'INFOSIMPLES_CENPROT_SP',
        }));

        const existingProtests = baseBackground.protestRecords || [];
        const allProtests = [...existingProtests];

        for (const newProtest of mappedProtests) {
          const isDuplicate = allProtests.some(existing =>
            (existing.protocol && existing.protocol === newProtest.protocol) ||
            (existing.amount === newProtest.amount && existing.notaryOffice === newProtest.notaryOffice)
          );
          if (!isDuplicate) {
            allProtests.push(newProtest);
          }
        }

        baseBackground = {
          ...baseBackground,
          hasProtests: allProtests.length > 0,
          protestRecords: allProtests,
          totalProtestValue: allProtests.reduce((sum, p) => sum + (p.amount || 0), 0),
          infoSimplesData: {
            source: infoSimplesProtests.source,
            consultationProtocol: infoSimplesProtests.consultationProtocol,
            consultationDate: infoSimplesProtests.consultationDate,
            cartoriosWithProtests: infoSimplesProtests.cartoriosWithProtests,
          },
        };
      }
    } catch (error) {
      this.logger.warn(`Failed to fetch InfoSimples protest data: ${error.message}`);
    }

    return baseBackground;
  }

  private async getDocumentValidation(document: string) {
    return this.cellereService.getDocumentValidation(document);
  }

  private calculateRiskScore(financial: any, background: any, documentValidation: any): { riskScore: number; riskLevel: RiskLevel } {
    let score = 1000;

    if (financial) {
      // More aggressive credit score deduction
      if (financial.creditScore) {
        score -= Math.max(0, (1000 - financial.creditScore) * 0.5); // Increased from 0.3 to 0.5
      }
      // More aggressive debt deductions
      if (financial.totalDebts > 0) {
        score -= Math.min(200, financial.totalDebts / 100); // More aggressive: was /200, now /100
      }
      if (financial.activeDebts > 0) {
        score -= Math.min(150, financial.activeDebts * 25); // More aggressive: was *15, now *25
      }
      if (financial.hasNegativeRecords) {
        score -= 100; // Increased from 50 to 100
      }
      if (financial.paymentDelays > 0) {
        score -= Math.min(150, financial.paymentDelays * 15); // More aggressive: was *10, now *15
      }
      // Additional deduction for average delay days
      if (financial.averageDelayDays > 0) {
        score -= Math.min(100, financial.averageDelayDays * 2);
      }
    }

    if (background) {
      if (background.hasCriminalRecords) {
        background.criminalRecords?.forEach((record: any) => {
          if (record.severity === 'HIGH') score -= 300; // Increased from 250
          else if (record.severity === 'MEDIUM') score -= 200; // Increased from 150
          else score -= 100; // Increased from 75
        });
      }

      if (background.hasJudicialRecords && background.judicialRecords?.length > 0) {
        let judicialDeduction = 0;

        background.judicialRecords.forEach((record: any) => {
          const type = (record.type || '').toLowerCase();
          const processNumber = (record.processNumber || '').toLowerCase();

          if (this.isEvictionRelated(type)) {
            judicialDeduction += 150; // Increased from 100
          }
          else if (this.isMinorJudicialRecord(type)) {
            judicialDeduction += 10; // Increased from 5
          }
          else {
            judicialDeduction += 35; // Increased from 20
          }
        });

        score -= Math.min(300, judicialDeduction); // Increased cap from 200 to 300
      }

      if (background.hasEvictions) {
        score -= Math.min(400, background.evictionsCount * 200); // More aggressive: was *150, now *200
      }

      if (background.hasProtests) {
        // More aggressive protest deductions
        score -= Math.min(150, (background.protestRecords?.length || 0) * 30); // Increased from 20 to 30
        score -= Math.min(150, (background.totalProtestValue || 0) / 300); // More aggressive: was /500, now /300
      }
    }

    if (documentValidation) {
      if (!documentValidation.documentValid) {
        score -= 300; // Increased from 200
      }
      if (!documentValidation.documentActive) {
        score -= 150; // Increased from 100
      }
      if (documentValidation.hasFraudAlerts) {
        score -= 400; // Increased from 300
      }
      if (!documentValidation.documentOwnerMatch) {
        score -= 200; // New: penalize if document owner doesn't match
      }
    }

    score = Math.max(0, Math.min(1000, Math.round(score)));

    // More strict thresholds to ensure score aligns with risk level
    // A high score (750+) should only be LOW risk, not MEDIUM or HIGH
    let riskLevel: RiskLevel;
    if (score >= 800) riskLevel = RiskLevel.LOW; // Strict: only very high scores are LOW risk
    else if (score >= 600) riskLevel = RiskLevel.MEDIUM; // Medium scores are MEDIUM risk
    else if (score >= 400) riskLevel = RiskLevel.HIGH; // Lower scores are HIGH risk
    else riskLevel = RiskLevel.CRITICAL; // Very low scores are CRITICAL

    this.logger.debug(`Risk calculation: score=${score}, level=${riskLevel}, judicial=${background?.judicialRecords?.length || 0} records, protests=${background?.protestRecords?.length || 0}, debts=${financial?.totalDebts || 0}`);

    return { riskScore: score, riskLevel };
  }

  private isEvictionRelated(type: string): boolean {
    const evictionKeywords = [
      'despejo', 'desocupação', 'desocupacao', 'imissão', 'imissao',
      'reintegração de posse', 'reintegracao de posse', 'locação', 'locacao',
      'aluguel', 'inadimplência locatícia', 'inadimplencia locaticia'
    ];
    return evictionKeywords.some(keyword => type.includes(keyword));
  }

  private isMinorJudicialRecord(type: string): boolean {
    const minorKeywords = [
      'termo circunstanciado', 'tco', 'juizado especial', 'pequenas causas',
      'trânsito', 'transito', 'multa', 'infração', 'infracao',
      'consumidor', 'procon', 'trabalhista', 'acidente',
      'execução fiscal', 'execucao fiscal', 'iptu', 'ipva',
      'pensão alimentícia', 'pensao alimenticia', 'família', 'familia'
    ];
    return minorKeywords.some(keyword => type.includes(keyword));
  }

  private getRecommendation(riskScore: number, riskLevel: RiskLevel, background: any): { recommendation: string; notes: string } {
    if (background?.hasEvictions && background.evictionsCount >= 2) {
      return {
        recommendation: 'REJECTED',
        notes: 'Múltiplos históricos de despejo identificados. Recomenda-se não prosseguir com a locação.',
      };
    }

    if (background?.hasCriminalRecords) {
      const hasHighSeverity = background.criminalRecords?.some((r: any) => r.severity === 'HIGH');
      if (hasHighSeverity) {
        return {
          recommendation: 'REJECTED',
          notes: 'Registros criminais de alta gravidade identificados. Recomenda-se não prosseguir com a locação.',
        };
      }
    }

    if (riskLevel === RiskLevel.LOW) {
      return {
        recommendation: 'APPROVED',
        notes: 'Perfil de baixo risco. Aprovado para locação sem restrições.',
      };
    }

    if (riskLevel === RiskLevel.MEDIUM) {
      return {
        recommendation: 'APPROVED_WITH_CAUTION',
        notes: 'Perfil de risco moderado. Aprovado com recomendação de acompanhamento.',
      };
    }

    if (riskLevel === RiskLevel.HIGH) {
      return {
        recommendation: 'REQUIRES_GUARANTOR',
        notes: 'Perfil de risco elevado. Recomenda-se exigir fiador ou seguro fiança.',
      };
    }

    return {
      recommendation: 'REJECTED',
      notes: 'Perfil de risco crítico. Recomenda-se não prosseguir com a locação.',
    };
  }

  private formatAnalysisResponse(analysis: any) {
    const riskPercentage = Math.round((analysis.riskScore || 0) / 10);
    const isCPF = analysis.documentType === 'CPF';

    return {
      id: analysis.id.toString(),
      token: analysis.token,
      document: analysis.document,
      documentType: analysis.documentType,
      name: analysis.name,

      basicData: isCPF ? {
        type: 'CPF',
        name: analysis.name,
        status: analysis.personStatus,
        address: analysis.personAddress,
        city: analysis.personCity,
        state: analysis.personState,
        zipCode: analysis.personZipCode,
        phone: analysis.personPhone,
        birthDate: analysis.birthDate,
        motherName: analysis.motherName,
      } : {
        type: 'CNPJ',
        companyName: analysis.companyName || analysis.name,
        tradingName: analysis.tradingName,
        status: analysis.companyStatus,
        address: analysis.companyAddress,
        city: analysis.companyCity,
        state: analysis.companyState,
        zipCode: analysis.companyZipCode,
        phone: analysis.companyPhone,
        openingDate: analysis.companyOpeningDate?.toISOString()?.split('T')[0],
      },

      photo: analysis.photoPath ? {
        path: analysis.photoPath,
        filename: analysis.photoFilename,
      } : null,

      financial: {
        creditScore: analysis.creditScore,
        totalDebts: Number(analysis.totalDebts) || 0,
        activeDebts: analysis.activeDebts || 0,
        hasNegativeRecords: analysis.hasNegativeRecords || false,
        paymentDelays: analysis.paymentDelays || 0,
        averageDelayDays: analysis.averageDelayDays || 0,
        debtDetails: analysis.financialDetails ? JSON.parse(analysis.financialDetails) : [],
        status: analysis.financialStatus || 'CLEAR',
      },

      background: {
        hasCriminalRecords: analysis.hasCriminalRecords || false,
        criminalRecords: analysis.criminalDetails ? JSON.parse(analysis.criminalDetails) : [],
        hasJudicialRecords: analysis.hasJudicialRecords || false,
        judicialRecords: analysis.judicialDetails ? JSON.parse(analysis.judicialDetails) : [],
        hasEvictions: analysis.hasEvictions || false,
        evictionsCount: analysis.evictionsCount || 0,
        hasProtests: analysis.hasProtests || false,
        protestRecords: analysis.protestDetails ? JSON.parse(analysis.protestDetails) : [],
        totalProtestValue: Number(analysis.totalProtestValue) || 0,
        status: this.getBackgroundStatus(analysis),
      },

      documentValidation: {
        documentValid: analysis.documentValid ?? true,
        documentActive: analysis.documentActive ?? true,
        documentOwnerMatch: analysis.documentOwnerMatch ?? true,
        hasFraudAlerts: analysis.hasFraudAlerts || false,
        registrationName: analysis.name,
        status: analysis.documentStatus || 'VALID',
      },

      riskScore: analysis.riskScore || 0,
      riskLevel: analysis.riskLevel || 'MEDIUM',
      riskPercentage,
      recommendation: analysis.recommendation || 'REQUIRES_GUARANTOR',
      recommendationNotes: analysis.recommendationNotes,

      status: analysis.status,
      analyzedAt: analysis.analyzedAt?.toISOString(),
      validUntil: analysis.validUntil?.toISOString(),

      lgpd: {
        acceptedAt: analysis.lgpdAcceptedAt?.toISOString(),
        acceptedBy: analysis.lgpdAcceptedBy?.toString(),
      },

      summary: {
        financialStatus: analysis.financialStatus || 'CLEAR',
        criminalStatus: analysis.criminalStatus || 'CLEAR',
        judicialStatus: analysis.judicialStatus || 'CLEAR',
        protestStatus: analysis.protestStatus || 'CLEAR',
        documentStatus: analysis.documentStatus || 'VALID',
      },

      requestedBy: analysis.requestedBy ? {
        id: analysis.requestedBy.id.toString(),
        name: analysis.requestedBy.name,
        email: analysis.requestedBy.email,
      } : undefined,
    };
  }

  private getBackgroundStatus(analysis: any): 'CLEAR' | 'WARNING' | 'CRITICAL' {
    if (analysis.hasCriminalRecords || analysis.hasEvictions) {
      return 'CRITICAL';
    }
    if (analysis.hasJudicialRecords || analysis.hasProtests) {
      return 'WARNING';
    }
    return 'CLEAR';
  }

  private maskDocument(document: string): string {
    if (!document) return '';
    if (document.length === 11) {
      return `${document.slice(0, 3)}.***.***-${document.slice(-2)}`;
    }
    return `${document.slice(0, 2)}.***.***/${document.slice(-6, -2)}-${document.slice(-2)}`;
  }

  async analyzeFinancial(document: string) {
    return this.getFinancialAnalysis(document);
  }

  async analyzeBackground(document: string) {
    return this.getBackgroundAnalysis(document);
  }

  async getFullAnalysis(document: string) {
    const dto: AnalyzeTenantDto = { document, analysisType: AnalysisType.FULL, lgpdAccepted: true };
    return this.analyzeTenant(dto, BigInt(1));
  }

  async healthCheck() {
    const isHealthy = await this.cellereService.healthCheck();
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: 'Cellere API',
      timestamp: new Date().toISOString(),
    };
  }

  async uploadPhoto(analysisId: bigint, photoPath: string, photoFilename: string, userId: bigint) {
    const analysis = await this.prisma.tenantAnalysis.findUnique({
      where: { id: analysisId },
    });

    if (!analysis) {
      throw new NotFoundException('Análise não encontrada');
    }

    if (analysis.photoPath) {
      try {
        const fs = require('fs');
        if (fs.existsSync(analysis.photoPath)) {
          fs.unlinkSync(analysis.photoPath);
        }
      } catch (error) {
        this.logger.warn(`Failed to delete old photo: ${error.message}`);
      }
    }

    const updated = await this.prisma.tenantAnalysis.update({
      where: { id: analysisId },
      data: {
        photoPath,
        photoFilename,
      },
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    this.logger.log(`Photo uploaded for analysis ${analysisId}`);
    return this.formatAnalysisResponse(updated);
  }
}
