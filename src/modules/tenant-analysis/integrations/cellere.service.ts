import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface FinancialAnalysisRequest {
  document: string;
  includeScore?: boolean;
  includeDebts?: boolean;
  includePaymentHistory?: boolean;
}

export interface FinancialAnalysisResponse {
  creditScore?: number;
  totalDebts?: number;
  activeDebts?: number;
  hasNegativeRecords?: boolean;
  paymentDelays?: number;
  averageDelayDays?: number;
  debtDetails?: Array<{
    creditor: string;
    amount: number;
    daysOverdue: number;
  }>;
  paymentHistory?: {
    totalDelays: number;
    averageDelay: number;
  };
  status?: 'CLEAR' | 'WARNING' | 'CRITICAL';
  // Raw data from Cellere
  name?: string;
  birthDate?: string;
  motherName?: string;
  situacaoCadastral?: string;
}

export interface BackgroundCheckRequest {
  document: string;
  includeCriminal?: boolean;
  includeJudicial?: boolean;
  includeProtests?: boolean;
}

export interface BackgroundCheckResponse {
  hasCriminalRecords?: boolean;
  criminalRecords?: Array<{
    type: string;
    description: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    date?: string;
  }>;
  hasJudicialRecords?: boolean;
  judicialRecords?: Array<{
    processNumber: string;
    court: string;
    type: string;
    status: string;
    isEviction?: boolean;
  }>;
  hasEvictions?: boolean;
  evictionsCount?: number;
  hasProtests?: boolean;
  protestRecords?: Array<{
    notaryOffice: string;
    amount: number;
    creditor: string;
    status: string;
    date?: string;
    city?: string;
    state?: string;
    type?: string;
    protocol?: string;
    source?: string;
  }>;
  totalProtestValue?: number;
  hasArrestWarrants?: boolean;
  arrestWarrants?: Array<{
    numero: string;
    tipo: string;
    orgao: string;
    dataExpedicao: string;
  }>;
  status?: 'CLEAR' | 'WARNING' | 'CRITICAL';
  infoSimplesData?: {
    source: string;
    consultationProtocol?: string;
    consultationDate?: string;
    cartoriosWithProtests?: number;
  };
}

export interface DocumentValidationResponse {
  documentValid: boolean;
  documentActive: boolean;
  documentOwnerMatch: boolean;
  hasFraudAlerts: boolean;
  registrationName?: string;
  motherName?: string;
  birthDate?: string;
  situacaoCadastral?: string;
  address?: {
    logradouro?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
  };
  phones?: string[];
  emails?: string[];
  status: 'VALID' | 'WARNING' | 'INVALID';
}

@Injectable()
export class CellereService {
  private readonly logger = new Logger(CellereService.name);
  private readonly client: AxiosInstance;
  private readonly isEnabled: boolean;

  constructor(private configService: ConfigService) {
    const token = this.configService.get<string>('CELLERE_API_TOKEN');
    const baseURL = this.configService.get<string>('CELLERE_API_BASE_URL', 'https://api.gw.cellereit.com.br');
    this.isEnabled = this.configService.get<string>('TENANT_ANALYSIS_ENABLED', 'false') === 'true';

    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        this.logger.log(`Cellere API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error('Cellere API Request Error:', error.message);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        this.logger.log(`Cellere API Response: ${response.status}`);
        this.logger.debug(`Response data: ${JSON.stringify(response.data).substring(0, 500)}...`);
        return response;
      },
      (error) => {
        this.logger.error(`Cellere API Error: ${error.response?.status} - ${error.message}`);
        if (error.response?.data) {
          this.logger.error(`Error data: ${JSON.stringify(error.response.data)}`);
        }
        return Promise.reject(error);
      }
    );

    if (this.isEnabled) {
      this.logger.log(`Cellere API enabled. Base URL: ${baseURL}`);
    } else {
      this.logger.warn('Cellere API is disabled');
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isEnabled) {
      return false;
    }

    try {
      // Check balance to verify API is working
      const response = await this.client.get('/utilitarias/saldo-portal');
      this.logger.log(`Cellere balance: ${response.data?.amount} credits`);
      return true;
    } catch (error) {
      this.logger.error('Health check failed');
      return false;
    }
  }

  /**
   * Get account balance from Cellere
   */
  async getBalance(): Promise<{ amount: number; units: string }> {
    const response = await this.client.get('/utilitarias/saldo-portal');
    return {
      amount: response.data?.amount || 0,
      units: response.data?.units || 'credit',
    };
  }

  /**
   * Get financial analysis (CPF/CNPJ complete info)
   * Uses: GET /analise-financeira/cpf-completo or /cnpj-completo
   */
  async getFinancialAnalysis(request: FinancialAnalysisRequest): Promise<FinancialAnalysisResponse> {
    if (!this.isEnabled) {
      throw new Error('Tenant analysis is disabled');
    }

    const isCPF = request.document.length === 11;
    const endpoint = isCPF
      ? `/analise-financeira/cpf-completo`
      : `/analise-financeira/cnpj-completo`;
    const param = isCPF ? 'cpf' : 'cnpj';

    this.logger.log(`Getting financial analysis for ${param}: ${this.maskDocument(request.document)}`);

    try {
      const response = await this.client.get(endpoint, {
        params: { [param]: request.document },
      });

      return this.mapFinancialResponse(response.data, isCPF);
    } catch (error: any) {
      // Check for insufficient balance
      if (error.response?.data?.reason === 'insufficientBalance') {
        throw new Error('Insufficient Cellere credits. Please add more credits to your account.');
      }
      throw new Error(`Financial analysis failed: ${error.message}`);
    }
  }

  /**
   * Get background check (court processes, arrest warrants)
   * Uses: GET /bg-check/cpf-completo or /cnpj-completo
   *       GET /consultas/validacao-fiscal-pj (court processes)
   *       GET /consultas/br/cnj/mandados-prisao (arrest warrants)
   */
  async getBackgroundCheck(request: BackgroundCheckRequest): Promise<BackgroundCheckResponse> {
    if (!this.isEnabled) {
      throw new Error('Tenant analysis is disabled');
    }

    const isCPF = request.document.length === 11;
    const param = isCPF ? 'cpf' : 'cnpj';

    this.logger.log(`Getting background check for ${param}: ${this.maskDocument(request.document)}`);

    try {
      // Get complete info from bg-check
      const bgEndpoint = isCPF ? '/bg-check/cpf-completo' : '/bg-check/cnpj-completo';
      const bgResponse = await this.client.get(bgEndpoint, {
        params: { [param]: request.document },
      });

      // Get court processes
      let courtProcesses: any = null;
      if (request.includeJudicial) {
        try {
          const courtResponse = await this.client.get('/consultas/validacao-fiscal-pj', {
            params: { [param]: request.document },
          });
          courtProcesses = courtResponse.data;
        } catch (e) {
          this.logger.warn('Court processes query failed, continuing...');
        }
      }

      // Get arrest warrants (CPF only)
      let arrestWarrants: any = null;
      if (isCPF && request.includeCriminal) {
        try {
          const warrantsResponse = await this.client.get('/consultas/br/cnj/mandados-prisao', {
            params: { cpf: request.document },
          });
          arrestWarrants = warrantsResponse.data;
        } catch (e) {
          this.logger.warn('Arrest warrants query failed, continuing...');
        }
      }

      return this.mapBackgroundResponse(bgResponse.data, courtProcesses, arrestWarrants, isCPF);
    } catch (error: any) {
      if (error.response?.data?.reason === 'insufficientBalance') {
        throw new Error('Insufficient Cellere credits. Please add more credits to your account.');
      }
      throw new Error(`Background check failed: ${error.message}`);
    }
  }

  /**
   * Validate CPF/CNPJ document
   * Uses: GET /bg-check/cpf-validacao-cadastral or /bg-check/cpf-completo
   */
  async getDocumentValidation(document: string): Promise<DocumentValidationResponse> {
    if (!this.isEnabled) {
      throw new Error('Tenant analysis is disabled');
    }

    const isCPF = document.length === 11;
    this.logger.log(`Validating document: ${this.maskDocument(document)}`);

    try {
      if (isCPF) {
        // Use advanced CPF validation
        const response = await this.client.get('/bg-check/cpf-validacao-cadastral', {
          params: { cpf: document },
        });
        return this.mapCPFValidationResponse(response.data);
      } else {
        // Use CNPJ complete
        const response = await this.client.get('/bg-check/cnpj-completo', {
          params: { cnpj: document },
        });
        return this.mapCNPJValidationResponse(response.data);
      }
    } catch (error: any) {
      if (error.response?.data?.reason === 'insufficientBalance') {
        throw new Error('Insufficient Cellere credits. Please add more credits to your account.');
      }
      // Return basic validation if API fails
      this.logger.warn('Document validation API failed, returning basic validation');
      return {
        documentValid: this.validateDocumentFormat(document),
        documentActive: true,
        documentOwnerMatch: true,
        hasFraudAlerts: false,
        status: 'VALID',
      };
    }
  }

  /**
   * FaceMatch - Compare selfie with document photo
   * Uses: POST /facematch/one-image (single image) or POST /facematch/ (two images)
   */
  async getFacematch(selfieBase64: string, documentBase64?: string): Promise<{ match: boolean; confidence: number }> {
    if (!this.isEnabled) {
      throw new Error('Tenant analysis is disabled');
    }

    try {
      let response;
      if (documentBase64) {
        // Two images comparison
        response = await this.client.post('/facematch/', {
          image1: selfieBase64,
          image2: documentBase64,
        });
      } else {
        // Single image (selfie holding document)
        response = await this.client.post('/facematch/one-image', {
          image: selfieBase64,
        });
      }

      const result = response.data?.result?.[0] || response.data;
      const confidenceStr = result?.confiability || '0%';
      const confidence = parseFloat(confidenceStr.replace('%', '')) / 100;

      return {
        match: confidence >= 0.7,
        confidence,
      };
    } catch (error: any) {
      if (error.response?.data?.reason === 'insufficientBalance') {
        throw new Error('Insufficient Cellere credits.');
      }
      throw new Error(`Facematch failed: ${error.message}`);
    }
  }

  /**
   * Extract data from CNH document
   * Uses: POST /contextus/cnh
   */
  async extractCNH(imageBase64: string): Promise<any> {
    if (!this.isEnabled) {
      throw new Error('Tenant analysis is disabled');
    }

    try {
      const response = await this.client.post('/contextus/cnh', {
        image: imageBase64,
      });
      return this.mapDocumentExtractionResponse(response.data);
    } catch (error: any) {
      throw new Error(`CNH extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract data from address proof
   * Uses: POST /contextus/comp_endereco_v2
   */
  async extractAddressProof(imageBase64: string): Promise<any> {
    if (!this.isEnabled) {
      throw new Error('Tenant analysis is disabled');
    }

    try {
      const response = await this.client.post('/contextus/comp_endereco_v2', {
        image: imageBase64,
      });
      return this.mapDocumentExtractionResponse(response.data);
    } catch (error: any) {
      throw new Error(`Address proof extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract data from rental contract
   * Uses: POST /contextus/contrato-locacao-v2
   */
  async extractRentalContract(imageBase64: string): Promise<any> {
    if (!this.isEnabled) {
      throw new Error('Tenant analysis is disabled');
    }

    try {
      const response = await this.client.post('/contextus/contrato-locacao-v2', {
        image: imageBase64,
      });
      return this.mapDocumentExtractionResponse(response.data);
    } catch (error: any) {
      throw new Error(`Rental contract extraction failed: ${error.message}`);
    }
  }

  /**
   * KYC Phone validation (Claro, Tim, Vivo)
   */
  async validatePhone(phone: string, cpf: string, carrier?: 'claro' | 'tim' | 'vivo'): Promise<{ valid: boolean; matches: any }> {
    if (!this.isEnabled) {
      throw new Error('Tenant analysis is disabled');
    }

    const carriers = carrier ? [carrier] : ['claro', 'tim', 'vivo'];

    for (const c of carriers) {
      try {
        const response = await this.client.post(`/telecom/${c}/kyc/match`, {
          phoneNumber: phone,
          idDocument: cpf,
        });

        const idMatch = response.data?.idDocumentMatch;
        if (idMatch === 'true' || idMatch === true) {
          return {
            valid: true,
            matches: response.data,
          };
        }
      } catch (e) {
        this.logger.debug(`KYC ${c} failed, trying next...`);
      }
    }

    return { valid: false, matches: null };
  }

  // ==================== Response Mapping ====================

  private mapFinancialResponse(data: any, isCPF: boolean): FinancialAnalysisResponse {
    if (isCPF) {
      const cpfData = data?.CadastroPessoaFisica || data;
      const rfData = data?.ReceitaFederalCpf || {};

      const situacao = rfData?.SituacaoCadastral || cpfData?.SituacaoReceitaBancoDados || '';
      const hasIssues = situacao !== 'REGULAR' && situacao !== '';

      return {
        name: cpfData?.Nome || rfData?.NomePessoaFisica,
        birthDate: cpfData?.DataNascimento || rfData?.DataNascimento,
        motherName: cpfData?.NomeMae,
        situacaoCadastral: situacao,
        creditScore: this.estimateCreditScore(situacao, cpfData?.RendaEstimada),
        totalDebts: 0, // Not available in this endpoint
        activeDebts: 0,
        hasNegativeRecords: hasIssues,
        paymentDelays: 0,
        averageDelayDays: 0,
        debtDetails: [],
        status: hasIssues ? 'WARNING' : 'CLEAR',
      };
    } else {
      // CNPJ
      const situacao = data?.SituacaoCadastral || '';
      const hasIssues = situacao !== 'ATIVA' && situacao !== '';

      return {
        name: data?.NomeEmpresarial || data?.NomeFantasia,
        situacaoCadastral: situacao,
        creditScore: hasIssues ? 400 : 800,
        totalDebts: 0,
        activeDebts: 0,
        hasNegativeRecords: hasIssues,
        status: hasIssues ? 'WARNING' : 'CLEAR',
      };
    }
  }

  private mapBackgroundResponse(bgData: any, courtData: any, warrantsData: any, isCPF: boolean): BackgroundCheckResponse {
    // Process court records
    const processos = courtData?.Processos || [];
    const judicialRecords = processos.map((p: any) => ({
      processNumber: p.Numero || '',
      court: p.TribunalNome || p.CorpoJulgador || '',
      type: p.Tipo || p.Assunto || '',
      status: p.Situacao || '',
      isEviction: this.isEvictionProcess(p),
    }));

    const evictions = judicialRecords.filter((r: any) => r.isEviction);

    // Process arrest warrants
    const mandados = warrantsData?.Mandados || [];
    const hasArrestWarrants = mandados.length > 0;
    const arrestWarrants = mandados.map((m: any) => ({
      numero: m.NumeroPeca || m.NumeroPecaFormatado || '',
      tipo: m.DescricaoPeca || '',
      orgao: m.NomeOrgao || '',
      dataExpedicao: m.DataExpedicao || '',
    }));

    // Determine status
    let status: 'CLEAR' | 'WARNING' | 'CRITICAL' = 'CLEAR';
    if (hasArrestWarrants || evictions.length > 0) {
      status = 'CRITICAL';
    } else if (judicialRecords.length > 0) {
      status = 'WARNING';
    }

    return {
      hasCriminalRecords: hasArrestWarrants,
      criminalRecords: hasArrestWarrants ? arrestWarrants.map((w: any) => ({
        type: w.tipo,
        description: `Mandado de Prisão - ${w.orgao}`,
        severity: 'HIGH' as const,
        date: w.dataExpedicao,
      })) : [],
      hasJudicialRecords: judicialRecords.length > 0,
      judicialRecords,
      hasEvictions: evictions.length > 0,
      evictionsCount: evictions.length,
      hasProtests: false, // Would need separate protest API
      protestRecords: [],
      totalProtestValue: 0,
      hasArrestWarrants,
      arrestWarrants,
      status,
    };
  }

  private mapCPFValidationResponse(data: any): DocumentValidationResponse {
    const situacao = data?.SituacaoCadastral || '';
    const isValid = situacao === 'REGULAR';
    const isActive = situacao !== 'SUSPENSO' && situacao !== 'CANCELADO' && situacao !== 'NULO';

    return {
      documentValid: isValid,
      documentActive: isActive,
      documentOwnerMatch: true,
      hasFraudAlerts: situacao === 'TITULAR FALECIDO',
      registrationName: data?.Nome,
      motherName: data?.NomeMae,
      birthDate: data?.DataNascimento,
      situacaoCadastral: situacao,
      address: data?.Logradouro ? {
        logradouro: data.Logradouro,
        numero: data.Numero,
        bairro: data.Bairro,
        cidade: data.Cidade,
        uf: data.UF,
        cep: data.CEP,
      } : undefined,
      phones: data?.TelefoneComDDD ? [data.TelefoneComDDD] : [],
      emails: data?.EnderecoEmail ? [data.EnderecoEmail] : [],
      status: isValid ? 'VALID' : (isActive ? 'WARNING' : 'INVALID'),
    };
  }

  private mapCNPJValidationResponse(data: any): DocumentValidationResponse {
    const situacao = data?.SituacaoCadastral || '';
    const isValid = situacao === 'ATIVA';
    const isActive = situacao !== 'BAIXADA' && situacao !== 'INAPTA' && situacao !== 'SUSPENSA';

    return {
      documentValid: isValid,
      documentActive: isActive,
      documentOwnerMatch: true,
      hasFraudAlerts: false,
      registrationName: data?.NomeEmpresarial || data?.NomeFantasia,
      situacaoCadastral: situacao,
      address: {
        logradouro: data?.Logradouro,
        numero: data?.Numero,
        bairro: data?.BairroDistrito,
        cidade: data?.Municipio,
        uf: data?.UF,
        cep: data?.CEP,
      },
      phones: data?.Telefone ? [data.Telefone] : [],
      emails: data?.EnderecoEletronico ? [data.EnderecoEletronico] : [],
      status: isValid ? 'VALID' : (isActive ? 'WARNING' : 'INVALID'),
    };
  }

  private mapDocumentExtractionResponse(data: any): any {
    const result = data?.result?.[0] || {};
    const fields: Record<string, any> = {};

    if (result.fields) {
      for (const field of result.fields) {
        fields[field.name] = {
          value: field.value,
          confidence: field.score,
        };
      }
    }

    return {
      fields,
      docType: result.docType,
      qualityScore: result.docQualityScore,
      tags: result.tags,
      queryId: data?.queryId,
    };
  }

  // ==================== Helper Methods ====================

  private isEvictionProcess(record: any): boolean {
    const type = (record.Tipo || record.Assunto || '').toLowerCase();
    const evictionKeywords = ['despejo', 'desocupação', 'desocupacao', 'imissão', 'imissao'];
    return evictionKeywords.some(keyword => type.includes(keyword));
  }

  private estimateCreditScore(situacao: string, rendaEstimada?: string): number {
    // Base score
    let score = 700;

    // Adjust based on status
    if (situacao === 'REGULAR') {
      score = 800;
    } else if (situacao === 'TITULAR FALECIDO') {
      score = 0;
    } else if (situacao === 'SUSPENSO' || situacao === 'CANCELADO') {
      score = 300;
    } else if (situacao !== '') {
      score = 500;
    }

    // Adjust based on estimated income
    if (rendaEstimada) {
      const renda = parseFloat(rendaEstimada);
      if (renda > 10000) score += 50;
      else if (renda > 5000) score += 25;
      else if (renda < 1000) score -= 50;
    }

    return Math.max(0, Math.min(1000, score));
  }

  private validateDocumentFormat(document: string): boolean {
    if (!document) return false;
    const digits = document.replace(/\D/g, '');

    if (digits.length === 11) {
      return this.validateCPF(digits);
    } else if (digits.length === 14) {
      return this.validateCNPJ(digits);
    }
    return false;
  }

  private validateCPF(cpf: string): boolean {
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cpf[i]) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf[9])) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cpf[i]) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    return remainder === parseInt(cpf[10]);
  }

  private validateCNPJ(cnpj: string): boolean {
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cnpj[i]) * weights1[i];
    }
    let remainder = sum % 11;
    const digit1 = remainder < 2 ? 0 : 11 - remainder;
    if (digit1 !== parseInt(cnpj[12])) return false;

    sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(cnpj[i]) * weights2[i];
    }
    remainder = sum % 11;
    const digit2 = remainder < 2 ? 0 : 11 - remainder;
    return digit2 === parseInt(cnpj[13]);
  }

  private maskDocument(document: string): string {
    if (!document) return '';
    if (document.length === 11) {
      return `${document.slice(0, 3)}.***.***-${document.slice(-2)}`;
    }
    return `${document.slice(0, 2)}.***.***/${document.slice(-6, -2)}-${document.slice(-2)}`;
  }
}
