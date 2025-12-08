import { Injectable, Logger } from '@nestjs/common';

/**
 * Mock service for tenant analysis during development
 * Provides realistic fake data when Cellere API is not available
 */
@Injectable()
export class MockAnalysisService {
  private readonly logger = new Logger(MockAnalysisService.name);

  /**
   * Generate mock financial analysis based on document hash
   */
  async getFinancialAnalysis(document: string) {
    this.logger.debug(`Generating mock financial analysis for: ${document}`);

    // Use document hash to generate consistent but varied results
    const hash = this.hashDocument(document);
    const scenario = hash % 4; // 0: excellent, 1: good, 2: warning, 3: critical

    const scenarios = {
      0: { // Excellent - No issues
        creditScore: 850 + (hash % 150),
        totalDebts: 0,
        activeDebts: 0,
        hasNegativeRecords: false,
        paymentDelays: 0,
        averageDelayDays: 0,
        debtDetails: [],
        status: 'CLEAR' as const,
      },
      1: { // Good - Minor issues
        creditScore: 650 + (hash % 150),
        totalDebts: 1500 + (hash % 3000),
        activeDebts: 1,
        hasNegativeRecords: false,
        paymentDelays: 2,
        averageDelayDays: 5,
        debtDetails: [
          {
            creditor: 'Cartão de Crédito Banco X',
            amount: 1500 + (hash % 3000),
            daysOverdue: 15,
            type: 'credit_card',
          },
        ],
        status: 'CLEAR' as const,
      },
      2: { // Warning - Some concerns
        creditScore: 450 + (hash % 150),
        totalDebts: 5000 + (hash % 10000),
        activeDebts: 3,
        hasNegativeRecords: true,
        paymentDelays: 8,
        averageDelayDays: 25,
        debtDetails: [
          {
            creditor: 'Financeira ABC',
            amount: 3500,
            daysOverdue: 45,
            type: 'personal_loan',
          },
          {
            creditor: 'Loja de Departamentos',
            amount: 800,
            daysOverdue: 30,
            type: 'store_credit',
          },
          {
            creditor: 'Telefonia Móvel',
            amount: 350,
            daysOverdue: 60,
            type: 'telecom',
          },
        ],
        status: 'WARNING' as const,
      },
      3: { // Critical - Serious issues
        creditScore: 200 + (hash % 150),
        totalDebts: 25000 + (hash % 50000),
        activeDebts: 7,
        hasNegativeRecords: true,
        paymentDelays: 20,
        averageDelayDays: 90,
        debtDetails: [
          {
            creditor: 'Banco Nacional',
            amount: 15000,
            daysOverdue: 180,
            type: 'bank_loan',
          },
          {
            creditor: 'Financeira XYZ',
            amount: 8000,
            daysOverdue: 120,
            type: 'personal_loan',
          },
          {
            creditor: 'Cartão Platinum',
            amount: 5500,
            daysOverdue: 90,
            type: 'credit_card',
          },
        ],
        status: 'CRITICAL' as const,
      },
    };

    // Simulate API delay
    await this.delay(500 + (hash % 1000));

    return scenarios[scenario];
  }

  /**
   * Generate mock background check based on document hash
   */
  async getBackgroundCheck(document: string) {
    this.logger.debug(`Generating mock background check for: ${document}`);

    const hash = this.hashDocument(document);
    const scenario = (hash >> 4) % 4; // Different distribution than financial

    const scenarios = {
      0: { // Clean record
        hasCriminalRecords: false,
        criminalRecords: [],
        hasJudicialRecords: false,
        judicialRecords: [],
        hasEvictions: false,
        evictionsCount: 0,
        hasProtests: false,
        protestRecords: [],
        totalProtestValue: 0,
        status: 'CLEAR' as const,
      },
      1: { // Minor judicial
        hasCriminalRecords: false,
        criminalRecords: [],
        hasJudicialRecords: true,
        judicialRecords: [
          {
            processNumber: `0001234-56.2023.8.26.${String(hash % 1000).padStart(4, '0')}`,
            court: 'TJSP - 1ª Vara Cível',
            type: 'Cobrança',
            status: 'Em andamento',
            isEviction: false,
          },
        ],
        hasEvictions: false,
        evictionsCount: 0,
        hasProtests: true,
        protestRecords: [
          {
            notaryOffice: `${(hash % 10) + 1}º Tabelião de Protesto`,
            amount: 1200 + (hash % 2000),
            creditor: 'Empresa de Serviços Ltda',
            status: 'Ativo',
            date: '2024-06-15',
          },
        ],
        totalProtestValue: 1200 + (hash % 2000),
        status: 'WARNING' as const,
      },
      2: { // Some concerns
        hasCriminalRecords: false,
        criminalRecords: [],
        hasJudicialRecords: true,
        judicialRecords: [
          {
            processNumber: `0005678-90.2022.8.26.${String(hash % 1000).padStart(4, '0')}`,
            court: 'TJSP - 2ª Vara Cível',
            type: 'Despejo por falta de pagamento',
            status: 'Arquivado',
            isEviction: true,
          },
          {
            processNumber: `0009012-34.2023.8.26.${String(hash % 1000).padStart(4, '0')}`,
            court: 'TJSP - Juizado Especial',
            type: 'Indenização',
            status: 'Em andamento',
            isEviction: false,
          },
        ],
        hasEvictions: true,
        evictionsCount: 1,
        hasProtests: true,
        protestRecords: [
          {
            notaryOffice: `${(hash % 10) + 1}º Tabelião de Protesto`,
            amount: 3500,
            creditor: 'Imobiliária Central',
            status: 'Pago',
            date: '2023-09-20',
          },
          {
            notaryOffice: `${((hash + 3) % 10) + 1}º Tabelião de Protesto`,
            amount: 2800,
            creditor: 'Condomínio Edifício Sol',
            status: 'Ativo',
            date: '2024-02-10',
          },
        ],
        totalProtestValue: 6300,
        status: 'WARNING' as const,
      },
      3: { // Serious issues
        hasCriminalRecords: true,
        criminalRecords: [
          {
            type: 'Estelionato',
            description: 'Processo relacionado a fraude em locação de imóvel',
            severity: 'MEDIUM' as const,
            date: '2021-03-15',
          },
        ],
        hasJudicialRecords: true,
        judicialRecords: [
          {
            processNumber: `0012345-67.2021.8.26.${String(hash % 1000).padStart(4, '0')}`,
            court: 'TJSP - 5ª Vara Criminal',
            type: 'Criminal - Estelionato',
            status: 'Condenação transitada em julgado',
            isEviction: false,
          },
          {
            processNumber: `0023456-78.2022.8.26.${String(hash % 1000).padStart(4, '0')}`,
            court: 'TJSP - 3ª Vara Cível',
            type: 'Despejo por falta de pagamento',
            status: 'Sentença procedente',
            isEviction: true,
          },
          {
            processNumber: `0034567-89.2023.8.26.${String(hash % 1000).padStart(4, '0')}`,
            court: 'TJSP - 1ª Vara Cível',
            type: 'Despejo por descumprimento contratual',
            status: 'Em andamento',
            isEviction: true,
          },
        ],
        hasEvictions: true,
        evictionsCount: 2,
        hasProtests: true,
        protestRecords: [
          {
            notaryOffice: '3º Tabelião de Protesto',
            amount: 8500,
            creditor: 'Imobiliária Premium',
            status: 'Ativo',
            date: '2024-01-05',
          },
          {
            notaryOffice: '7º Tabelião de Protesto',
            amount: 4200,
            creditor: 'Banco Nacional',
            status: 'Ativo',
            date: '2023-11-20',
          },
        ],
        totalProtestValue: 12700,
        status: 'CRITICAL' as const,
      },
    };

    await this.delay(300 + (hash % 700));

    return scenarios[scenario];
  }

  /**
   * Generate mock document validation
   */
  async getDocumentValidation(document: string) {
    this.logger.debug(`Generating mock document validation for: ${document}`);

    const hash = this.hashDocument(document);
    const isValid = (hash % 10) !== 0; // 90% valid
    const isCPF = document.length === 11;

    // Generate a fake name based on document
    const firstNames = ['João', 'Maria', 'José', 'Ana', 'Carlos', 'Fernanda', 'Pedro', 'Lucia', 'Paulo', 'Mariana'];
    const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Almeida', 'Pereira', 'Lima', 'Gomes'];

    const firstName = firstNames[hash % firstNames.length];
    const lastName = lastNames[(hash >> 4) % lastNames.length];
    const name = `${firstName} ${lastName}`;

    await this.delay(200 + (hash % 300));

    if (!isValid) {
      return {
        documentValid: false,
        documentActive: false,
        documentOwnerMatch: false,
        hasFraudAlerts: true,
        registrationName: null,
        status: 'INVALID' as const,
      };
    }

    const hasFraudAlerts = (hash % 20) === 0; // 5% with fraud alerts

    return {
      documentValid: true,
      documentActive: true,
      documentOwnerMatch: !hasFraudAlerts,
      hasFraudAlerts,
      registrationName: name,
      status: hasFraudAlerts ? 'WARNING' as const : 'VALID' as const,
    };
  }

  /**
   * Simple hash function for document
   */
  private hashDocument(document: string): number {
    let hash = 0;
    for (let i = 0; i < document.length; i++) {
      const char = document.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Simulate async delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
