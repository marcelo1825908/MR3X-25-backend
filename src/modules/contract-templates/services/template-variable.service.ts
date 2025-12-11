import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@config/prisma.service';

/**
 * Variable field definitions for contract templates
 * Maps template placeholders to their data sources
 */
export interface TemplateVariable {
  key: string;
  label: string;
  source: 'property' | 'tenant' | 'owner' | 'agency' | 'contract' | 'broker' | 'system' | 'custom';
  required: boolean;
  description: string;
}

export interface TemplateContext {
  property?: any;
  tenant?: any;
  owner?: any;
  agency?: any;
  contract?: any;
  broker?: any;
  custom?: Record<string, string>;
}

export interface VariableValidationResult {
  valid: boolean;
  missingRequired: string[];
  missingOptional: string[];
  filledCount: number;
  totalCount: number;
}

@Injectable()
export class TemplateVariableService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * All available template variables with their sources
   */
  private readonly templateVariables: TemplateVariable[] = [
    // Broker/Agent Variables
    { key: 'NOME_CORRETOR', label: 'Nome do Corretor', source: 'broker', required: false, description: 'Nome do corretor responsável' },
    { key: 'CRECI_CORRETOR', label: 'CRECI do Corretor', source: 'broker', required: false, description: 'Número do CRECI do corretor' },

    // Owner (Locador) Variables - PF
    { key: 'NOME_LOCADOR', label: 'Nome do Locador', source: 'owner', required: true, description: 'Nome completo do proprietário' },
    { key: 'CPF_LOCADOR', label: 'CPF do Locador', source: 'owner', required: true, description: 'CPF do proprietário' },
    { key: 'ENDERECO_LOCADOR', label: 'Endereço do Locador', source: 'owner', required: false, description: 'Endereço completo do proprietário' },
    { key: 'EMAIL_LOCADOR', label: 'E-mail do Locador', source: 'owner', required: false, description: 'E-mail do proprietário' },
    { key: 'TELEFONE_LOCADOR', label: 'Telefone do Locador', source: 'owner', required: false, description: 'Telefone do proprietário' },

    // Owner (Locador) Variables - PJ
    { key: 'RAZAO_SOCIAL_LOCADOR', label: 'Razão Social do Locador', source: 'owner', required: false, description: 'Razão social do proprietário PJ' },
    { key: 'CNPJ_LOCADOR', label: 'CNPJ do Locador', source: 'owner', required: false, description: 'CNPJ do proprietário' },
    { key: 'REPRESENTANTE_LOCADOR', label: 'Representante do Locador', source: 'owner', required: false, description: 'Nome do representante legal do proprietário' },
    { key: 'CPF_REPRESENTANTE_LOCADOR', label: 'CPF do Representante do Locador', source: 'owner', required: false, description: 'CPF do representante legal' },
    { key: 'CARGO_LOCADOR', label: 'Cargo do Representante do Locador', source: 'owner', required: false, description: 'Cargo do representante legal' },

    // Tenant (Locatário) Variables - PF
    { key: 'NOME_LOCATARIO', label: 'Nome do Locatário', source: 'tenant', required: true, description: 'Nome completo do inquilino' },
    { key: 'CPF_LOCATARIO', label: 'CPF do Locatário', source: 'tenant', required: true, description: 'CPF do inquilino' },
    { key: 'ENDERECO_LOCATARIO', label: 'Endereço do Locatário', source: 'tenant', required: false, description: 'Endereço atual do inquilino' },
    { key: 'EMAIL_LOCATARIO', label: 'E-mail do Locatário', source: 'tenant', required: false, description: 'E-mail do inquilino' },
    { key: 'TELEFONE_LOCATARIO', label: 'Telefone do Locatário', source: 'tenant', required: false, description: 'Telefone do inquilino' },

    // Tenant (Locatário) Variables - PJ
    { key: 'RAZAO_SOCIAL_LOCATARIO', label: 'Razão Social do Locatário', source: 'tenant', required: false, description: 'Razão social do inquilino PJ' },
    { key: 'CNPJ_LOCATARIO', label: 'CNPJ do Locatário', source: 'tenant', required: false, description: 'CNPJ do inquilino' },
    { key: 'REPRESENTANTE_LOCATARIO', label: 'Representante do Locatário', source: 'tenant', required: false, description: 'Nome do representante legal do inquilino' },
    { key: 'CPF_REPRESENTANTE_LOCATARIO', label: 'CPF do Representante do Locatário', source: 'tenant', required: false, description: 'CPF do representante legal' },
    { key: 'CARGO_LOCATARIO', label: 'Cargo do Representante do Locatário', source: 'tenant', required: false, description: 'Cargo do representante legal' },

    // Property (Imóvel) Variables
    { key: 'ENDERECO_IMOVEL', label: 'Endereço do Imóvel', source: 'property', required: true, description: 'Endereço completo do imóvel' },
    { key: 'DESCRICAO_IMOVEL', label: 'Descrição do Imóvel', source: 'property', required: false, description: 'Descrição detalhada do imóvel' },
    { key: 'MATRICULA', label: 'Matrícula do Imóvel', source: 'property', required: false, description: 'Número de matrícula no cartório' },
    { key: 'ATIVIDADE_COMERCIAL', label: 'Atividade Comercial', source: 'custom', required: false, description: 'Atividade comercial prevista (para contratos comerciais)' },

    // Contract (Contrato) Variables - REQUIRED FOR LEGAL VALIDITY
    { key: 'VALOR_ALUGUEL', label: 'Valor do Aluguel', source: 'contract', required: true, description: 'Valor mensal do aluguel em R$' },
    { key: 'DIA_VENCIMENTO', label: 'Dia de Vencimento', source: 'contract', required: true, description: 'Dia do mês para vencimento do aluguel' },
    { key: 'PRAZO_MESES', label: 'Prazo em Meses', source: 'contract', required: true, description: 'Duração do contrato em meses' },
    { key: 'DATA_INICIO', label: 'Data de Início', source: 'contract', required: true, description: 'Data de início do contrato' },
    { key: 'DATA_FIM', label: 'Data de Término', source: 'contract', required: true, description: 'Data de término do contrato' },
    { key: 'INDICE_REAJUSTE', label: 'Índice de Reajuste', source: 'contract', required: true, description: 'Índice econômico para reajuste (IGPM, IPCA, INPC, etc.)' },
    { key: 'TIPO_GARANTIA', label: 'Tipo de Garantia', source: 'contract', required: true, description: 'Garantia locatícia (caução, fiador, seguro fiança)' },
    { key: 'COMARCA', label: 'Comarca/Foro', source: 'contract', required: true, description: 'Comarca de eleição para litígios' },

    // Contract - Optional Fields
    { key: 'DEPOSITO_CAUCAO', label: 'Valor do Depósito/Caução', source: 'contract', required: false, description: 'Valor do depósito de caução' },
    { key: 'MULTA_ATRASO', label: 'Multa por Atraso', source: 'contract', required: false, description: 'Percentual de multa por atraso (padrão 10%)' },
    { key: 'JUROS_MORA', label: 'Juros de Mora', source: 'contract', required: false, description: 'Percentual de juros de mora ao mês (padrão 1%)' },
    { key: 'MULTA_RESCISAO', label: 'Multa por Rescisão', source: 'contract', required: false, description: 'Valor da multa por rescisão antecipada' },

    // Agency (Imobiliária) Variables
    { key: 'RAZAO_SOCIAL_IMOBILIARIA', label: 'Razão Social da Imobiliária', source: 'agency', required: false, description: 'Razão social da imobiliária' },
    { key: 'CNPJ_IMOBILIARIA', label: 'CNPJ da Imobiliária', source: 'agency', required: false, description: 'CNPJ da imobiliária' },
    { key: 'NUMERO_CRECI', label: 'CRECI da Imobiliária', source: 'agency', required: false, description: 'Número do CRECI jurídico' },
    { key: 'ENDERECO_IMOBILIARIA', label: 'Endereço da Imobiliária', source: 'agency', required: false, description: 'Endereço da imobiliária' },
    { key: 'EMAIL_IMOBILIARIA', label: 'E-mail da Imobiliária', source: 'agency', required: false, description: 'E-mail da imobiliária' },
    { key: 'TELEFONE_IMOBILIARIA', label: 'Telefone da Imobiliária', source: 'agency', required: false, description: 'Telefone da imobiliária' },
    { key: 'REPRESENTANTE_IMOBILIARIA', label: 'Representante da Imobiliária', source: 'agency', required: false, description: 'Nome do representante legal da imobiliária' },
    { key: 'CPF_REPRESENTANTE_IMOBILIARIA', label: 'CPF do Representante da Imobiliária', source: 'agency', required: false, description: 'CPF do representante legal' },

    // System-generated Variables
    { key: 'CIDADE', label: 'Cidade', source: 'system', required: false, description: 'Cidade onde o contrato é firmado' },
    { key: 'DATA_ASSINATURA', label: 'Data de Assinatura', source: 'system', required: false, description: 'Data da assinatura do contrato' },
    { key: 'DATA_ACEITE', label: 'Data de Aceite', source: 'system', required: false, description: 'Data do aceite eletrônico' },

    // Platform Service Contract Variables
    { key: 'NOME_CONTRATANTE', label: 'Nome do Contratante', source: 'custom', required: false, description: 'Nome do contratante (para contratos de serviço)' },
    { key: 'DOCUMENTO_CONTRATANTE', label: 'CPF/CNPJ do Contratante', source: 'custom', required: false, description: 'Documento do contratante' },
    { key: 'ENDERECO_CONTRATANTE', label: 'Endereço do Contratante', source: 'custom', required: false, description: 'Endereço do contratante' },
    { key: 'EMAIL_CONTRATANTE', label: 'E-mail do Contratante', source: 'custom', required: false, description: 'E-mail do contratante' },
    { key: 'TELEFONE_CONTRATANTE', label: 'Telefone do Contratante', source: 'custom', required: false, description: 'Telefone do contratante' },
    { key: 'PLANO_SELECIONADO', label: 'Plano Selecionado', source: 'custom', required: false, description: 'Nome do plano contratado' },
    { key: 'VALOR_PLANO', label: 'Valor do Plano', source: 'custom', required: false, description: 'Valor mensal do plano' },
    { key: 'FORMA_PAGAMENTO', label: 'Forma de Pagamento', source: 'custom', required: false, description: 'Forma de pagamento do plano' },
    { key: 'PERIODO_VIGENCIA', label: 'Período de Vigência', source: 'custom', required: false, description: 'Período de vigência do contrato' },

    // Partnership/Affiliate Contract Variables
    { key: 'NOME_AFILIADO', label: 'Nome do Afiliado', source: 'custom', required: false, description: 'Nome do parceiro afiliado' },
    { key: 'CPF_AFILIADO', label: 'CPF do Afiliado', source: 'custom', required: false, description: 'CPF do afiliado' },
    { key: 'ENDERECO_AFILIADO', label: 'Endereço do Afiliado', source: 'custom', required: false, description: 'Endereço do afiliado' },
    { key: 'EMAIL_AFILIADO', label: 'E-mail do Afiliado', source: 'custom', required: false, description: 'E-mail do afiliado' },
    { key: 'TELEFONE_AFILIADO', label: 'Telefone do Afiliado', source: 'custom', required: false, description: 'Telefone do afiliado' },
    { key: 'PERCENTUAL_COMISSAO', label: 'Percentual de Comissão', source: 'custom', required: false, description: 'Percentual de comissão do afiliado' },

    // Condominium Contract Variables
    { key: 'NOME_CONDOMINIO', label: 'Nome do Condomínio', source: 'custom', required: false, description: 'Nome do condomínio' },
    { key: 'CNPJ_CONDOMINIO', label: 'CNPJ do Condomínio', source: 'custom', required: false, description: 'CNPJ do condomínio' },
    { key: 'ENDERECO_CONDOMINIO', label: 'Endereço do Condomínio', source: 'custom', required: false, description: 'Endereço do condomínio' },
    { key: 'NOME_SINDICO', label: 'Nome do Síndico', source: 'custom', required: false, description: 'Nome do síndico' },
    { key: 'CPF_SINDICO', label: 'CPF do Síndico', source: 'custom', required: false, description: 'CPF do síndico' },
    { key: 'EMAIL_CONDOMINIO', label: 'E-mail do Condomínio', source: 'custom', required: false, description: 'E-mail do condomínio' },
    { key: 'TELEFONE_CONDOMINIO', label: 'Telefone do Condomínio', source: 'custom', required: false, description: 'Telefone do condomínio' },
    { key: 'VALOR_MENSAL', label: 'Valor Mensal', source: 'custom', required: false, description: 'Valor mensal do serviço' },
    { key: 'DIA_PAGAMENTO', label: 'Dia de Pagamento', source: 'custom', required: false, description: 'Dia de pagamento mensal' },

    // MR3X Platform Info
    { key: 'ENDERECO_MR3X', label: 'Endereço MR3X', source: 'system', required: false, description: 'Endereço da sede da MR3X' },

    // Signature Variables
    { key: 'ASSINATURA_LOCADOR', label: 'Assinatura do Locador', source: 'contract', required: false, description: 'Assinatura digital do locador com hash e IP' },
    { key: 'ASSINATURA_LOCATARIO', label: 'Assinatura do Locatário', source: 'contract', required: false, description: 'Assinatura digital do locatário com hash e IP' },
    { key: 'ASSINATURA_IMOBILIARIA', label: 'Assinatura da Imobiliária', source: 'contract', required: false, description: 'Assinatura digital da imobiliária com hash e IP' },
    { key: 'ASSINATURA_TESTEMUNHA', label: 'Assinatura da Testemunha', source: 'contract', required: false, description: 'Assinatura digital da testemunha' },
    { key: 'HASH_CONTRATO', label: 'Hash do Contrato', source: 'contract', required: false, description: 'Hash SHA-256 do contrato' },
    { key: 'VERIFICACAO_URL', label: 'URL de Verificação', source: 'contract', required: false, description: 'URL para validação do contrato' },
  ];

  /**
   * Get all available template variables
   */
  getAllVariables(): TemplateVariable[] {
    return this.templateVariables;
  }

  /**
   * Get required variables for a template
   */
  getRequiredVariables(): TemplateVariable[] {
    return this.templateVariables.filter(v => v.required);
  }

  /**
   * Extract all variable placeholders from template content
   */
  extractVariables(templateContent: string): string[] {
    const regex = /\[([A-Z_]+)\]/g;
    const matches = templateContent.match(regex) || [];
    return [...new Set(matches.map(m => m.replace(/[\[\]]/g, '')))];
  }

  /**
   * Build context from contract data for variable replacement
   */
  async buildContextFromContract(contractId: bigint): Promise<TemplateContext> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        property: true,
        tenantUser: true,
        ownerUser: true,
        agency: true,
      },
    });

    if (!contract) {
      throw new BadRequestException('Contrato não encontrado');
    }

    return {
      property: contract.property,
      tenant: contract.tenantUser,
      owner: contract.ownerUser,
      agency: contract.agency,
      contract: contract,
    };
  }

  /**
   * Get variable value from context based on variable definition
   */
  private getVariableValue(variable: TemplateVariable, context: TemplateContext): string | null {
    const { key, source } = variable;

    switch (source) {
      case 'property':
        return this.getPropertyValue(key, context.property);
      case 'tenant':
        return this.getTenantValue(key, context.tenant);
      case 'owner':
        return this.getOwnerValue(key, context.owner);
      case 'agency':
        return this.getAgencyValue(key, context.agency);
      case 'contract':
        return this.getContractValue(key, context.contract);
      case 'broker':
        return this.getBrokerValue(key, context.contract);
      case 'system':
        return this.getSystemValue(key, context);
      case 'custom':
        return context.custom?.[key] || null;
      default:
        return null;
    }
  }

  private getPropertyValue(key: string, property: any): string | null {
    if (!property) return null;

    switch (key) {
      case 'ENDERECO_IMOVEL':
        const parts = [property.address, property.number, property.complement, property.neighborhood, property.city, property.state, property.cep].filter(Boolean);
        return parts.join(', ');
      case 'DESCRICAO_IMOVEL':
        return property.description || property.name || null;
      case 'MATRICULA':
        return property.registrationNumber || null;
      default:
        return null;
    }
  }

  private getTenantValue(key: string, tenant: any): string | null {
    if (!tenant) return null;

    switch (key) {
      case 'NOME_LOCATARIO':
        return tenant.name || null;
      case 'CPF_LOCATARIO':
        return this.formatCpfCnpj(tenant.document) || null;
      case 'CNPJ_LOCATARIO':
        return this.formatCpfCnpj(tenant.cnpj || tenant.document) || null;
      case 'RAZAO_SOCIAL_LOCATARIO':
        return tenant.companyName || tenant.name || null;
      case 'ENDERECO_LOCATARIO':
        const parts = [tenant.address, tenant.number, tenant.neighborhood, tenant.city, tenant.state, tenant.cep].filter(Boolean);
        return parts.join(', ') || null;
      case 'EMAIL_LOCATARIO':
        return tenant.email || null;
      case 'TELEFONE_LOCATARIO':
        return tenant.phone || tenant.mobilePhone || null;
      case 'REPRESENTANTE_LOCATARIO':
        return tenant.representativeName || null;
      case 'CPF_REPRESENTANTE_LOCATARIO':
        return this.formatCpfCnpj(tenant.representativeDocument) || null;
      case 'CARGO_LOCATARIO':
        return tenant.representativePosition || null;
      default:
        return null;
    }
  }

  private getOwnerValue(key: string, owner: any): string | null {
    if (!owner) return null;

    switch (key) {
      case 'NOME_LOCADOR':
        return owner.name || null;
      case 'CPF_LOCADOR':
        return this.formatCpfCnpj(owner.document) || null;
      case 'CNPJ_LOCADOR':
        return this.formatCpfCnpj(owner.cnpj || owner.document) || null;
      case 'RAZAO_SOCIAL_LOCADOR':
        return owner.companyName || owner.name || null;
      case 'ENDERECO_LOCADOR':
        const parts = [owner.address, owner.number, owner.neighborhood, owner.city, owner.state, owner.cep].filter(Boolean);
        return parts.join(', ') || null;
      case 'EMAIL_LOCADOR':
        return owner.email || null;
      case 'TELEFONE_LOCADOR':
        return owner.phone || owner.mobilePhone || null;
      case 'REPRESENTANTE_LOCADOR':
        return owner.representativeName || null;
      case 'CPF_REPRESENTANTE_LOCADOR':
        return this.formatCpfCnpj(owner.representativeDocument) || null;
      case 'CARGO_LOCADOR':
        return owner.representativePosition || null;
      default:
        return null;
    }
  }

  private getAgencyValue(key: string, agency: any): string | null {
    if (!agency) return null;

    switch (key) {
      case 'RAZAO_SOCIAL_IMOBILIARIA':
        return agency.name || null;
      case 'CNPJ_IMOBILIARIA':
        return this.formatCpfCnpj(agency.cnpj) || null;
      case 'NUMERO_CRECI':
        return agency.creci || null;
      case 'ENDERECO_IMOBILIARIA':
        const parts = [agency.address, agency.number, agency.neighborhood, agency.city, agency.state, agency.cep].filter(Boolean);
        return parts.join(', ') || null;
      case 'EMAIL_IMOBILIARIA':
        return agency.email || null;
      case 'TELEFONE_IMOBILIARIA':
        return agency.phone || null;
      case 'REPRESENTANTE_IMOBILIARIA':
        return agency.representativeName || null;
      case 'CPF_REPRESENTANTE_IMOBILIARIA':
        return this.formatCpfCnpj(agency.representativeDocument) || null;
      default:
        return null;
    }
  }

  private getContractValue(key: string, contract: any): string | null {
    if (!contract) return null;

    switch (key) {
      case 'VALOR_ALUGUEL':
        return this.formatCurrency(contract.monthlyRent);
      case 'DIA_VENCIMENTO':
        return contract.dueDay?.toString() || '5';
      case 'PRAZO_MESES':
        if (contract.startDate && contract.endDate) {
          const start = new Date(contract.startDate);
          const end = new Date(contract.endDate);
          const months = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
          return months.toString();
        }
        return null;
      case 'DATA_INICIO':
        return contract.startDate ? this.formatDate(contract.startDate) : null;
      case 'DATA_FIM':
        return contract.endDate ? this.formatDate(contract.endDate) : null;
      case 'INDICE_REAJUSTE':
        return contract.readjustmentIndex || 'IGPM';
      case 'TIPO_GARANTIA':
        return contract.guaranteeType || 'Caução em dinheiro';
      case 'COMARCA':
        return contract.jurisdiction || contract.property?.city || null;
      case 'DEPOSITO_CAUCAO':
        return contract.deposit ? this.formatCurrency(contract.deposit) : null;
      case 'MULTA_ATRASO':
        return contract.lateFeePercent ? `${contract.lateFeePercent}%` : '10%';
      case 'JUROS_MORA':
        return contract.interestRatePercent ? `${contract.interestRatePercent}%` : '1%';
      case 'MULTA_RESCISAO':
        if (contract.earlyTerminationPenaltyPercent && contract.monthlyRent) {
          const penalty = Number(contract.earlyTerminationPenaltyPercent) * Number(contract.monthlyRent);
          return this.formatCurrency(penalty);
        }
        return null;
      case 'HASH_CONTRATO':
        return contract.contractHash || contract.hashFinal || '[Hash será gerado após assinatura]';
      case 'VERIFICACAO_URL':
        return contract.verificationUrl || `https://mr3x.com.br/verificar/${contract.contractToken || '[token]'}`;
      case 'ASSINATURA_LOCADOR':
        return this.formatSignature('LOCADOR', contract.ownerSignedAt, contract.ownerSignedIP, contract.ownerSignature);
      case 'ASSINATURA_LOCATARIO':
        return this.formatSignature('LOCATÁRIO', contract.tenantSignedAt, contract.tenantSignedIP, contract.tenantSignature);
      case 'ASSINATURA_IMOBILIARIA':
        return this.formatSignature('IMOBILIÁRIA', contract.agencySignedAt, contract.agencySignedIP, contract.agencySignature);
      case 'ASSINATURA_TESTEMUNHA':
        if (contract.witnessName) {
          return this.formatSignature(contract.witnessName, contract.witnessSignedAt, null, contract.witnessSignature);
        }
        return '[Aguardando assinatura da testemunha]';
      default:
        return null;
    }
  }

  private formatSignature(role: string, signedAt: Date | null, signedIP: string | null, signature: string | null): string {
    if (!signedAt) {
      return `[Aguardando assinatura do(a) ${role}]`;
    }
    const dateStr = this.formatDateTime(signedAt);
    const ipStr = signedIP ? `IP: ${signedIP}` : '';
    const hashStr = signature ? `Hash: ${signature.substring(0, 16)}...` : '';
    return `✓ Assinado digitalmente por ${role}\n   Data/Hora: ${dateStr}\n   ${ipStr}\n   ${hashStr}`;
  }

  private formatDateTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  private getBrokerValue(key: string, contract: any): string | null {
    switch (key) {
      case 'NOME_CORRETOR':
        return contract?.brokerName || null;
      case 'CRECI_CORRETOR':
        return contract?.creci || null;
      default:
        return null;
    }
  }

  private getSystemValue(key: string, context: TemplateContext): string | null {
    switch (key) {
      case 'CIDADE':
        return context.property?.city || context.contract?.property?.city || null;
      case 'DATA_ASSINATURA':
      case 'DATA_ACEITE':
        return this.formatDate(new Date());
      case 'ENDERECO_MR3X':
        return 'São Paulo/SP - Brasil';
      default:
        return null;
    }
  }

  /**
   * Process template content and replace variables with values
   */
  processTemplate(templateContent: string, context: TemplateContext): string {
    let processedContent = templateContent;

    for (const variable of this.templateVariables) {
      const placeholder = `[${variable.key}]`;
      if (processedContent.includes(placeholder)) {
        const value = this.getVariableValue(variable, context);
        processedContent = processedContent.replace(
          new RegExp(`\\[${variable.key}\\]`, 'g'),
          value || placeholder, // Keep placeholder if no value
        );
      }
    }

    // Process custom variables
    if (context.custom) {
      for (const [key, value] of Object.entries(context.custom)) {
        const placeholder = `[${key}]`;
        processedContent = processedContent.replace(new RegExp(`\\[${key}\\]`, 'g'), value || placeholder);
      }
    }

    return processedContent;
  }

  /**
   * Validate that all required variables have values
   */
  validateTemplate(templateContent: string, context: TemplateContext): VariableValidationResult {
    const extractedVars = this.extractVariables(templateContent);
    const missingRequired: string[] = [];
    const missingOptional: string[] = [];
    let filledCount = 0;

    for (const varKey of extractedVars) {
      const variable = this.templateVariables.find(v => v.key === varKey);
      if (!variable) {
        // Custom variable
        const value = context.custom?.[varKey];
        if (value) {
          filledCount++;
        } else {
          missingOptional.push(varKey);
        }
        continue;
      }

      const value = this.getVariableValue(variable, context);
      if (value) {
        filledCount++;
      } else if (variable.required) {
        missingRequired.push(varKey);
      } else {
        missingOptional.push(varKey);
      }
    }

    return {
      valid: missingRequired.length === 0,
      missingRequired,
      missingOptional,
      filledCount,
      totalCount: extractedVars.length,
    };
  }

  /**
   * Get preview of processed template with context
   */
  async getProcessedTemplatePreview(templateId: string, contractId: bigint): Promise<{ content: string; validation: VariableValidationResult }> {
    const { getTemplateById } = await import('../contract-templates');
    const template = getTemplateById(templateId);

    if (!template) {
      throw new BadRequestException('Template não encontrado');
    }

    const context = await this.buildContextFromContract(contractId);
    const processedContent = this.processTemplate(template.content, context);
    const validation = this.validateTemplate(template.content, context);

    return {
      content: processedContent,
      validation,
    };
  }

  // Utility functions
  private formatCpfCnpj(value: string | null): string | null {
    if (!value) return null;
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (cleaned.length === 14) {
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return value;
  }

  private formatCurrency(value: number | string | null): string | null {
    if (value === null || value === undefined) return null;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    // Format number without currency symbol (template already has "R$")
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
