import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { CellereService } from './integrations/cellere.service';
import { InfoSimplesService } from './integrations/infosimples.service';
import { AnalyzeTenantDto, AnalysisType, GetAnalysisHistoryDto } from './dto';
import { TenantAnalysisStatus, RiskLevel } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TenantAnalysisService {
  private readonly logger = new Logger(TenantAnalysisService.name);
  private readonly analysisValidityDays: number;

  constructor(
    private prisma: PrismaService,
    private cellereService: CellereService,
    private infoSimplesService: InfoSimplesService,
    private configService: ConfigService,
  ) {
    this.analysisValidityDays = this.configService.get<number>('TENANT_ANALYSIS_VALIDITY_DAYS', 30);
  }

  /**
   * Generate unique token for tenant analysis
   */
  private generateAnalysisToken(): string {
    const prefix = 'TA';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Perform a full tenant analysis
   */
  async analyzeTenant(dto: AnalyzeTenantDto, userId: bigint, agencyId?: bigint) {
    const { document, analysisType = AnalysisType.FULL, name, lgpdAccepted } = dto;
    const documentType = document.length === 11 ? 'CPF' : 'CNPJ';

    // Verify LGPD acceptance
    if (!lgpdAccepted) {
      throw new BadRequestException(
        'Você deve aceitar os termos da LGPD para realizar a consulta. O usuário se responsabiliza pelo uso indevido dos dados pesquisados conforme determina a LGPD.'
      );
    }

    this.logger.log(`Starting ${analysisType} analysis for document: ${this.maskDocument(document)}`);

    // Check for recent valid analysis
    const existingAnalysis = await this.findRecentAnalysis(document);
    if (existingAnalysis) {
      this.logger.log(`Found recent valid analysis for document: ${this.maskDocument(document)}`);
      return this.formatAnalysisResponse(existingAnalysis);
    }

    // Perform analysis FIRST - don't save to DB if it fails
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

      // Extract user-friendly error message
      const errorMessage = this.extractErrorMessage(error);

      // Don't save to DB - just throw the error with clear message
      throw new Error(errorMessage);
    }

    // Calculate risk score and level
    const { riskScore, riskLevel } = this.calculateRiskScore(financial, background, documentValidation);
    const recommendation = this.getRecommendation(riskScore, riskLevel, background);
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + this.analysisValidityDays);

    // Generate unique token
    const token = this.generateAnalysisToken();

    // Extract basic data from document validation
    const isCPF = documentType === 'CPF';
    const address = documentValidation?.address;
    const fullAddress = address
      ? `${address.logradouro || ''}${address.numero ? ', ' + address.numero : ''}${address.bairro ? ' - ' + address.bairro : ''}`
      : null;

    // Only save to DB after successful analysis
    const analysis = await this.prisma.tenantAnalysis.create({
      data: {
        token,
        document,
        documentType,
        name: documentValidation?.registrationName || name,
        requestedById: userId,
        agencyId,

        // Basic data for CPF
        ...(isCPF ? {
          personStatus: documentValidation?.situacaoCadastral || financial?.situacaoCadastral,
          personAddress: fullAddress,
          personCity: address?.cidade,
          personState: address?.uf,
          personZipCode: address?.cep,
          personPhone: documentValidation?.phones?.[0] || null,
          birthDate: documentValidation?.birthDate || financial?.birthDate,
          motherName: documentValidation?.motherName || financial?.motherName,
        } : {}),

        // Basic data for CNPJ
        ...(!isCPF ? {
          companyName: documentValidation?.registrationName || financial?.name,
          tradingName: null, // Would need additional API call
          companyStatus: documentValidation?.situacaoCadastral || financial?.situacaoCadastral,
          companyAddress: fullAddress,
          companyCity: address?.cidade,
          companyState: address?.uf,
          companyZipCode: address?.cep,
          companyPhone: documentValidation?.phones?.[0] || null,
        } : {}),

        // LGPD tracking
        lgpdAcceptedAt: new Date(),
        lgpdAcceptedBy: userId,

        // Financial data
        creditScore: financial?.creditScore,
        totalDebts: financial?.totalDebts,
        activeDebts: financial?.activeDebts,
        hasNegativeRecords: financial?.hasNegativeRecords,
        paymentDelays: financial?.paymentDelays,
        averageDelayDays: financial?.averageDelayDays,
        financialDetails: financial?.debtDetails ? JSON.stringify(financial.debtDetails) : null,
        financialStatus: financial?.status,

        // Criminal data
        hasCriminalRecords: background?.hasCriminalRecords,
        criminalRecordsCount: background?.criminalRecords?.length || 0,
        criminalDetails: background?.criminalRecords ? JSON.stringify(background.criminalRecords) : null,
        criminalStatus: background?.hasCriminalRecords ? 'WARNING' : 'CLEAR',

        // Judicial data
        hasJudicialRecords: background?.hasJudicialRecords,
        judicialRecordsCount: background?.judicialRecords?.length || 0,
        hasEvictions: background?.hasEvictions,
        evictionsCount: background?.evictionsCount,
        judicialDetails: background?.judicialRecords ? JSON.stringify(background.judicialRecords) : null,
        judicialStatus: background?.hasEvictions ? 'CRITICAL' : (background?.hasJudicialRecords ? 'WARNING' : 'CLEAR'),

        // Protest data
        hasProtests: background?.hasProtests,
        protestsCount: background?.protestRecords?.length || 0,
        totalProtestValue: background?.totalProtestValue,
        protestDetails: background?.protestRecords ? JSON.stringify(background.protestRecords) : null,
        protestStatus: background?.hasProtests ? 'WARNING' : 'CLEAR',

        // Document validation
        documentValid: documentValidation?.documentValid,
        documentActive: documentValidation?.documentActive,
        documentOwnerMatch: documentValidation?.documentOwnerMatch,
        hasFraudAlerts: documentValidation?.hasFraudAlerts,
        documentStatus: documentValidation?.status,

        // Risk assessment
        riskScore,
        riskLevel,
        recommendation: recommendation.recommendation,
        recommendationNotes: recommendation.notes,

        // Status
        status: TenantAnalysisStatus.COMPLETED,
        analyzedAt: new Date(),
        validUntil,

        // Raw response for auditing
        rawResponse: JSON.stringify({ financial, background, documentValidation }),
      },
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    this.logger.log(`Analysis completed for ${this.maskDocument(document)} - Risk: ${riskLevel} (${riskScore})`);
    return this.formatAnalysisResponse(analysis);
  }

  /**
   * Extract user-friendly error message from API errors
   */
  private extractErrorMessage(error: any): string {
    const message = error.message || 'Unknown error';

    // Map common error messages to user-friendly Portuguese messages
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

    // Return original message if no mapping found
    return `Erro na análise: ${message}`;
  }

  /**
   * Get analysis history with filters
   * All authorized roles can see all analyses since the analysis is about the tenant,
   * not the requester. This allows sharing tenant risk information across the platform
   * and avoids redundant API calls.
   */
  async getAnalysisHistory(dto: GetAnalysisHistoryDto, userId: bigint, userRole: string, agencyId?: bigint) {
    const { document, riskLevel, status, page = 1, limit = 10 } = dto;
    const skip = (page - 1) * limit;

    // Build where clause - all authorized roles can see all analyses
    // The controller already restricts access to authorized roles only via @Roles decorator
    const where: any = {};

    // Apply filters
    if (document) {
      where.document = { contains: document };
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

    return {
      data: data.map(item => ({
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
        // Include basicData for tenant registration
        basicData: item.documentType === 'CPF' ? {
          type: 'CPF',
          phone: item.personPhone,
          birthDate: item.birthDate || null,
        } : {
          type: 'CNPJ',
          phone: item.companyPhone,
        },
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a specific analysis by ID
   * All authorized roles can access any analysis since the analysis is about the tenant.
   */
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
      throw new NotFoundException('Analysis not found');
    }

    // All authorized roles can access any analysis
    // The controller already restricts access to authorized roles only via @Roles decorator

    return this.formatAnalysisResponse(analysis);
  }

  /**
   * Get statistics for dashboard
   * All authorized roles can see global statistics since analyses are shared across the platform.
   */
  async getAnalysisStats(userId: bigint, userRole: string, agencyId?: bigint) {
    // All authorized roles can see all statistics
    // The controller already restricts access to authorized roles only via @Roles decorator
    const where: any = {};

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

  // ==================== Private Methods ====================

  private async findRecentAnalysis(document: string) {
    const analysis = await this.prisma.tenantAnalysis.findFirst({
      where: {
        document,
        status: TenantAnalysisStatus.COMPLETED,
        validUntil: { gt: new Date() },
      },
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

    // Enhance with InfoSimples CENPROT-SP protest data
    try {
      const infoSimplesProtests = await this.infoSimplesService.analyzeProtests(document);

      // Merge protest data from InfoSimples
      if (infoSimplesProtests && infoSimplesProtests.hasProtests) {
        this.logger.log(`InfoSimples found ${infoSimplesProtests.totalProtests} protests for ${this.maskDocument(document)}`);

        // Map InfoSimples protests to our format
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

        // Combine protests from both sources, removing duplicates by protocol/amount
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

        // Update background with merged protest data
        baseBackground = {
          ...baseBackground,
          hasProtests: allProtests.length > 0,
          protestRecords: allProtests,
          totalProtestValue: allProtests.reduce((sum, p) => sum + (p.amount || 0), 0),
          // Add InfoSimples specific data
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
      // Continue with base background data if InfoSimples fails
    }

    return baseBackground;
  }

  private async getDocumentValidation(document: string) {
    return this.cellereService.getDocumentValidation(document);
  }

  private calculateRiskScore(financial: any, background: any, documentValidation: any): { riskScore: number; riskLevel: RiskLevel } {
    let score = 1000; // Start with perfect score

    // Financial factors (40% weight)
    if (financial) {
      if (financial.creditScore) {
        score -= Math.max(0, (1000 - financial.creditScore) * 0.3);
      }
      if (financial.totalDebts > 0) {
        score -= Math.min(150, financial.totalDebts / 200);
      }
      if (financial.activeDebts > 0) {
        score -= Math.min(75, financial.activeDebts * 15);
      }
      if (financial.hasNegativeRecords) {
        score -= 50;
      }
      if (financial.paymentDelays > 0) {
        score -= Math.min(100, financial.paymentDelays * 10);
      }
    }

    // Background factors (50% weight)
    if (background) {
      // Criminal records - severe impact
      if (background.hasCriminalRecords) {
        background.criminalRecords?.forEach((record: any) => {
          if (record.severity === 'HIGH') score -= 250;
          else if (record.severity === 'MEDIUM') score -= 150;
          else score -= 75;
        });
      }

      // Judicial records - classify by type and severity
      if (background.hasJudicialRecords && background.judicialRecords?.length > 0) {
        let judicialDeduction = 0;

        background.judicialRecords.forEach((record: any) => {
          const type = (record.type || '').toLowerCase();
          const processNumber = (record.processNumber || '').toLowerCase();

          // Check if it's an eviction-related process
          if (this.isEvictionRelated(type)) {
            judicialDeduction += 100; // Eviction is serious
          }
          // Minor records (TERMO CIRCUNSTANCIADO, traffic, small claims)
          else if (this.isMinorJudicialRecord(type)) {
            judicialDeduction += 5; // Minor impact
          }
          // Regular lawsuits
          else {
            judicialDeduction += 20;
          }
        });

        // Cap judicial deduction at 200 points max
        score -= Math.min(200, judicialDeduction);
      }

      // Evictions - very severe impact (already counted separately)
      if (background.hasEvictions) {
        score -= Math.min(300, background.evictionsCount * 150);
      }

      // Protests
      if (background.hasProtests) {
        score -= Math.min(100, (background.protestRecords?.length || 0) * 20);
        score -= Math.min(100, (background.totalProtestValue || 0) / 500);
      }
    }

    // Document validation (10% weight)
    if (documentValidation) {
      if (!documentValidation.documentValid) {
        score -= 200;
      }
      if (!documentValidation.documentActive) {
        score -= 100;
      }
      if (documentValidation.hasFraudAlerts) {
        score -= 300;
      }
    }

    // Ensure score is within bounds
    score = Math.max(0, Math.min(1000, Math.round(score)));

    // Determine risk level
    let riskLevel: RiskLevel;
    if (score >= 800) riskLevel = RiskLevel.LOW;
    else if (score >= 600) riskLevel = RiskLevel.MEDIUM;
    else if (score >= 400) riskLevel = RiskLevel.HIGH;
    else riskLevel = RiskLevel.CRITICAL;

    this.logger.debug(`Risk calculation: score=${score}, level=${riskLevel}, judicial=${background?.judicialRecords?.length || 0} records`);

    return { riskScore: score, riskLevel };
  }

  /**
   * Check if a judicial record type is eviction-related
   */
  private isEvictionRelated(type: string): boolean {
    const evictionKeywords = [
      'despejo', 'desocupação', 'desocupacao', 'imissão', 'imissao',
      'reintegração de posse', 'reintegracao de posse', 'locação', 'locacao',
      'aluguel', 'inadimplência locatícia', 'inadimplencia locaticia'
    ];
    return evictionKeywords.some(keyword => type.includes(keyword));
  }

  /**
   * Check if a judicial record is minor (low impact)
   */
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
    // Check for automatic rejection conditions
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

    // Score-based recommendations
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

      // Basic data for CPF
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

      // Photo
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

      // LGPD tracking
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
      // CPF: show first 3 and last 2 digits
      return `${document.slice(0, 3)}.***.***-${document.slice(-2)}`;
    }
    // CNPJ: show first 2 and last 2 digits
    return `${document.slice(0, 2)}.***.***/${document.slice(-6, -2)}-${document.slice(-2)}`;
  }

  // Legacy methods for backward compatibility
  async analyzeFinancial(document: string) {
    return this.getFinancialAnalysis(document);
  }

  async analyzeBackground(document: string) {
    return this.getBackgroundAnalysis(document);
  }

  async getFullAnalysis(document: string) {
    // This is the legacy method - create a simple DTO and call the new method
    // For legacy support, we assume LGPD acceptance
    const dto: AnalyzeTenantDto = { document, analysisType: AnalysisType.FULL, lgpdAccepted: true };
    // Note: This will need a userId in production - for legacy support, we'll use a system user
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

  /**
   * Upload photo for an analysis
   */
  async uploadPhoto(analysisId: bigint, photoPath: string, photoFilename: string, userId: bigint) {
    const analysis = await this.prisma.tenantAnalysis.findUnique({
      where: { id: analysisId },
    });

    if (!analysis) {
      throw new NotFoundException('Análise não encontrada');
    }

    // Delete old photo if exists
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
