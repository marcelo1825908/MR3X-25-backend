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
    { key: 'LOCADOR_NOME', label: 'Nome do Locador', source: 'owner', required: false, description: 'Nome completo do proprietário (alias)' },
    { key: 'CPF_LOCADOR', label: 'CPF do Locador', source: 'owner', required: true, description: 'CPF do proprietário' },
    { key: 'LOCADOR_CPF', label: 'CPF do Locador', source: 'owner', required: false, description: 'CPF do proprietário (alias)' },
    { key: 'ENDERECO_LOCADOR', label: 'Endereço do Locador', source: 'owner', required: false, description: 'Endereço completo do proprietário' },
    { key: 'LOCADOR_ENDERECO', label: 'Endereço do Locador', source: 'owner', required: false, description: 'Endereço completo do proprietário (alias)' },
    { key: 'EMAIL_LOCADOR', label: 'E-mail do Locador', source: 'owner', required: false, description: 'E-mail do proprietário' },
    { key: 'LOCADOR_EMAIL', label: 'E-mail do Locador', source: 'owner', required: false, description: 'E-mail do proprietário (alias)' },
    { key: 'TELEFONE_LOCADOR', label: 'Telefone do Locador', source: 'owner', required: false, description: 'Telefone do proprietário' },
    { key: 'LOCADOR_TELEFONE', label: 'Telefone do Locador', source: 'owner', required: false, description: 'Telefone do proprietário (alias)' },
    { key: 'LOCADOR_NACIONALIDADE', label: 'Nacionalidade do Locador', source: 'owner', required: false, description: 'Nacionalidade do proprietário' },
    { key: 'LOCADOR_ESTADO_CIVIL', label: 'Estado Civil do Locador', source: 'owner', required: false, description: 'Estado civil do proprietário' },
    { key: 'LOCADOR_PROFISSAO', label: 'Profissão do Locador', source: 'owner', required: false, description: 'Profissão do proprietário' },
    { key: 'LOCADOR_RG', label: 'RG do Locador', source: 'owner', required: false, description: 'RG do proprietário' },
    { key: 'LOCADOR_DATA_NASC', label: 'Data de Nascimento do Locador', source: 'owner', required: false, description: 'Data de nascimento do proprietário' },

    // Owner (Locador) Variables - PJ
    { key: 'RAZAO_SOCIAL_LOCADOR', label: 'Razão Social do Locador', source: 'owner', required: false, description: 'Razão social do proprietário PJ' },
    { key: 'CNPJ_LOCADOR', label: 'CNPJ do Locador', source: 'owner', required: false, description: 'CNPJ do proprietário' },
    { key: 'REPRESENTANTE_LOCADOR', label: 'Representante do Locador', source: 'owner', required: false, description: 'Nome do representante legal do proprietário' },
    { key: 'CPF_REPRESENTANTE_LOCADOR', label: 'CPF do Representante do Locador', source: 'owner', required: false, description: 'CPF do representante legal' },
    { key: 'CARGO_LOCADOR', label: 'Cargo do Representante do Locador', source: 'owner', required: false, description: 'Cargo do representante legal' },

    // Tenant (Locatário) Variables - PF
    { key: 'NOME_LOCATARIO', label: 'Nome do Locatário', source: 'tenant', required: true, description: 'Nome completo do inquilino' },
    { key: 'LOCATARIO_NOME', label: 'Nome do Locatário', source: 'tenant', required: false, description: 'Nome completo do inquilino (alias)' },
    { key: 'CPF_LOCATARIO', label: 'CPF do Locatário', source: 'tenant', required: true, description: 'CPF do inquilino' },
    { key: 'LOCATARIO_CPF', label: 'CPF do Locatário', source: 'tenant', required: false, description: 'CPF do inquilino (alias)' },
    { key: 'ENDERECO_LOCATARIO', label: 'Endereço do Locatário', source: 'tenant', required: false, description: 'Endereço atual do inquilino' },
    { key: 'LOCATARIO_ENDERECO_ATUAL', label: 'Endereço do Locatário', source: 'tenant', required: false, description: 'Endereço atual do inquilino (alias)' },
    { key: 'EMAIL_LOCATARIO', label: 'E-mail do Locatário', source: 'tenant', required: false, description: 'E-mail do inquilino' },
    { key: 'LOCATARIO_EMAIL', label: 'E-mail do Locatário', source: 'tenant', required: false, description: 'E-mail do inquilino (alias)' },
    { key: 'TELEFONE_LOCATARIO', label: 'Telefone do Locatário', source: 'tenant', required: false, description: 'Telefone do inquilino' },
    { key: 'LOCATARIO_TELEFONE', label: 'Telefone do Locatário', source: 'tenant', required: false, description: 'Telefone do inquilino (alias)' },
    { key: 'LOCATARIO_NACIONALIDADE', label: 'Nacionalidade do Locatário', source: 'tenant', required: false, description: 'Nacionalidade do inquilino' },
    { key: 'LOCATARIO_ESTADO_CIVIL', label: 'Estado Civil do Locatário', source: 'tenant', required: false, description: 'Estado civil do inquilino' },
    { key: 'LOCATARIO_PROFISSAO', label: 'Profissão do Locatário', source: 'tenant', required: false, description: 'Profissão do inquilino' },
    { key: 'LOCATARIO_RG', label: 'RG do Locatário', source: 'tenant', required: false, description: 'RG do inquilino' },
    { key: 'LOCATARIO_DATA_NASC', label: 'Data de Nascimento do Locatário', source: 'tenant', required: false, description: 'Data de nascimento do inquilino' },

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
    { key: 'IMOBILIARIA_RAZAO_SOCIAL', label: 'Razão Social da Imobiliária', source: 'agency', required: false, description: 'Razão social da imobiliária (alias)' },
    { key: 'IMOBILIARIA_NOME_FANTASIA', label: 'Nome Fantasia da Imobiliária', source: 'agency', required: false, description: 'Nome fantasia da imobiliária' },
    { key: 'CNPJ_IMOBILIARIA', label: 'CNPJ da Imobiliária', source: 'agency', required: false, description: 'CNPJ da imobiliária' },
    { key: 'IMOBILIARIA_CNPJ', label: 'CNPJ da Imobiliária', source: 'agency', required: false, description: 'CNPJ da imobiliária (alias)' },
    { key: 'NUMERO_CRECI', label: 'CRECI da Imobiliária', source: 'agency', required: false, description: 'Número do CRECI jurídico' },
    { key: 'IMOBILIARIA_CRECI', label: 'CRECI da Imobiliária', source: 'agency', required: false, description: 'Número do CRECI jurídico (alias)' },
    { key: 'ENDERECO_IMOBILIARIA', label: 'Endereço da Imobiliária', source: 'agency', required: false, description: 'Endereço da imobiliária' },
    { key: 'IMOBILIARIA_ENDERECO', label: 'Endereço da Imobiliária', source: 'agency', required: false, description: 'Endereço da imobiliária (alias)' },
    { key: 'EMAIL_IMOBILIARIA', label: 'E-mail da Imobiliária', source: 'agency', required: false, description: 'E-mail da imobiliária' },
    { key: 'IMOBILIARIA_EMAIL', label: 'E-mail da Imobiliária', source: 'agency', required: false, description: 'E-mail da imobiliária (alias)' },
    { key: 'TELEFONE_IMOBILIARIA', label: 'Telefone da Imobiliária', source: 'agency', required: false, description: 'Telefone da imobiliária' },
    { key: 'IMOBILIARIA_TELEFONE', label: 'Telefone da Imobiliária', source: 'agency', required: false, description: 'Telefone da imobiliária (alias)' },
    { key: 'REPRESENTANTE_IMOBILIARIA', label: 'Representante da Imobiliária', source: 'agency', required: false, description: 'Nome do representante legal da imobiliária' },
    { key: 'IMOBILIARIA_REPRESENTANTE', label: 'Representante da Imobiliária', source: 'agency', required: false, description: 'Nome do representante legal da imobiliária (alias)' },
    { key: 'CPF_REPRESENTANTE_IMOBILIARIA', label: 'CPF do Representante da Imobiliária', source: 'agency', required: false, description: 'CPF do representante legal' },
    { key: 'IMOBILIARIA_REP_DOC', label: 'Documento do Representante da Imobiliária', source: 'agency', required: false, description: 'CPF do representante legal da imobiliária (alias)' },

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

    // Property Variables - Extended for Contract 3
    { key: 'IMOVEL_ENDERECO', label: 'Endereço do Imóvel', source: 'property', required: false, description: 'Endereço completo do imóvel' },
    { key: 'IMOVEL_BAIRRO', label: 'Bairro do Imóvel', source: 'property', required: false, description: 'Bairro/Localidade do imóvel' },
    { key: 'IMOVEL_TIPO', label: 'Tipo do Imóvel', source: 'property', required: false, description: 'Tipo do imóvel (residencial, comercial, etc.)' },
    { key: 'IMOVEL_MATRICULA', label: 'Matrícula do Imóvel', source: 'property', required: false, description: 'Número de matrícula/registro do imóvel' },
    { key: 'IMOVEL_AREA', label: 'Área do Imóvel', source: 'property', required: false, description: 'Área total/construída do imóvel' },
    { key: 'IMOVEL_DESCRICAO', label: 'Descrição do Imóvel', source: 'property', required: false, description: 'Descrição complementar do imóvel' },
    { key: 'IMOVEL_MOVEIS', label: 'Mobílias/Itens do Imóvel', source: 'property', required: false, description: 'Lista de mobílias e itens inclusos' },

    // Contract Variables - Administration Contract 3
    { key: 'VALOR_LIMITE_MANUTENCAO', label: 'Limite Manutenção', source: 'contract', required: false, description: 'Valor limite para manutenção sem consulta prévia' },
    { key: 'TAXA_ADMINISTRACAO', label: 'Taxa de Administração', source: 'contract', required: false, description: 'Percentual da taxa de administração' },
    { key: 'VALOR_TAXA_INTERMEDIACAO', label: 'Valor Taxa Intermediação', source: 'contract', required: false, description: 'Valor fixo da taxa de intermediação' },
    { key: 'PERCENTUAL_INTERMEDIACAO', label: 'Percentual Intermediação', source: 'contract', required: false, description: 'Percentual da taxa de intermediação' },
    { key: 'DIA_REPASSE', label: 'Dia de Repasse', source: 'contract', required: false, description: 'Dia do mês para repasse ao locador' },
    { key: 'PLANO_GARANTIA', label: 'Plano de Garantia', source: 'contract', required: false, description: 'Se possui plano de garantia contra inadimplência' },
    { key: 'VALOR_LIMITE_SERVICOS', label: 'Limite para Serviços', source: 'contract', required: false, description: 'Valor limite para autorização de serviços' },
    { key: 'MODELO_AUTORIZACAO', label: 'Modelo de Autorização', source: 'contract', required: false, description: 'Modelo de autorização (digital/sistema)' },
    { key: 'DIAS_AVISO_PREVIO', label: 'Dias de Aviso Prévio', source: 'contract', required: false, description: 'Quantidade de dias para aviso prévio' },
    { key: 'VALOR_MULTA_RESCISAO', label: 'Valor Multa Rescisão', source: 'contract', required: false, description: 'Valor da multa por rescisão sem aviso' },
    { key: 'JUROS_ATRASO', label: 'Juros por Atraso', source: 'contract', required: false, description: 'Percentual de juros por atraso' },
    { key: 'FORO_CIDADE_ESTADO', label: 'Foro/Comarca', source: 'contract', required: false, description: 'Cidade e estado do foro eleito' },

    // Inspection/Vistoria Variables
    { key: 'DATA_VISTORIA_INICIAL', label: 'Data Vistoria Inicial', source: 'contract', required: false, description: 'Data da vistoria inicial' },
    { key: 'RESP_VISTORIA_INICIAL', label: 'Responsável Vistoria Inicial', source: 'contract', required: false, description: 'Responsável pela vistoria inicial' },
    { key: 'ANEXO_VISTORIA_INICIAL', label: 'Anexo Vistoria Inicial', source: 'contract', required: false, description: 'Referência ao laudo de vistoria inicial' },
    { key: 'ANEXO_VISTORIA_FINAL', label: 'Anexo Vistoria Final', source: 'contract', required: false, description: 'Referência ao laudo de vistoria final' },

    // Digital Signature Variables
    { key: 'HASH_DOCUMENTO', label: 'Hash do Documento', source: 'system', required: false, description: 'Hash SHA-256 do documento' },
    { key: 'IP_IMOBILIARIA', label: 'IP da Imobiliária', source: 'system', required: false, description: 'Endereço IP da assinatura da imobiliária' },
    { key: 'IP_LOCADOR', label: 'IP do Locador', source: 'system', required: false, description: 'Endereço IP da assinatura do locador' },
    { key: 'DATA_ASS_IMOBILIARIA', label: 'Data Assinatura Imobiliária', source: 'system', required: false, description: 'Data da assinatura da imobiliária' },
    { key: 'DATA_ASS_LOCADOR', label: 'Data Assinatura Locador', source: 'system', required: false, description: 'Data da assinatura do locador' },

    // Contract 4 - Rural Property Rental Variables
    // Multiple Landlords (Locador 1)
    { key: 'LOCADOR1_NOME', label: 'Nome Locador 1', source: 'owner', required: false, description: 'Nome do primeiro locador' },
    { key: 'LOCADOR1_NACIONALIDADE', label: 'Nacionalidade Locador 1', source: 'owner', required: false, description: 'Nacionalidade do primeiro locador' },
    { key: 'LOCADOR1_ESTADO_CIVIL', label: 'Estado Civil Locador 1', source: 'owner', required: false, description: 'Estado civil do primeiro locador' },
    { key: 'LOCADOR1_PROFISSAO', label: 'Profissão Locador 1', source: 'owner', required: false, description: 'Profissão do primeiro locador' },
    { key: 'LOCADOR1_RG', label: 'RG Locador 1', source: 'owner', required: false, description: 'RG do primeiro locador' },
    { key: 'LOCADOR1_CPF', label: 'CPF Locador 1', source: 'owner', required: false, description: 'CPF do primeiro locador' },
    { key: 'LOCADOR1_ENDERECO', label: 'Endereço Locador 1', source: 'owner', required: false, description: 'Endereço do primeiro locador' },

    // Multiple Landlords (Locador 2)
    { key: 'LOCADOR2_NOME', label: 'Nome Locador 2', source: 'custom', required: false, description: 'Nome do segundo locador' },
    { key: 'LOCADOR2_NACIONALIDADE', label: 'Nacionalidade Locador 2', source: 'custom', required: false, description: 'Nacionalidade do segundo locador' },
    { key: 'LOCADOR2_ESTADO_CIVIL', label: 'Estado Civil Locador 2', source: 'custom', required: false, description: 'Estado civil do segundo locador' },
    { key: 'LOCADOR2_PROFISSAO', label: 'Profissão Locador 2', source: 'custom', required: false, description: 'Profissão do segundo locador' },
    { key: 'LOCADOR2_RG', label: 'RG Locador 2', source: 'custom', required: false, description: 'RG do segundo locador' },
    { key: 'LOCADOR2_CPF', label: 'CPF Locador 2', source: 'custom', required: false, description: 'CPF do segundo locador' },
    { key: 'LOCADOR2_ENDERECO', label: 'Endereço Locador 2', source: 'custom', required: false, description: 'Endereço do segundo locador' },

    // Tenant Representative (PJ)
    { key: 'LOCATARIO_REP_NOME', label: 'Nome Representante Locatário', source: 'tenant', required: false, description: 'Nome do representante legal do locatário PJ' },
    { key: 'LOCATARIO_REP_NACIONALIDADE', label: 'Nacionalidade Representante', source: 'tenant', required: false, description: 'Nacionalidade do representante legal' },
    { key: 'LOCATARIO_REP_ESTADO_CIVIL', label: 'Estado Civil Representante', source: 'tenant', required: false, description: 'Estado civil do representante legal' },
    { key: 'LOCATARIO_REP_CPF', label: 'CPF Representante', source: 'tenant', required: false, description: 'CPF do representante legal' },
    { key: 'LOCATARIO_REP_RG', label: 'RG Representante', source: 'tenant', required: false, description: 'RG do representante legal' },
    { key: 'LOCATARIO_REP_ENDERECO', label: 'Endereço Representante', source: 'tenant', required: false, description: 'Endereço do representante legal' },

    // Rural Property Specific
    { key: 'IMOVEL_LOCALIDADE', label: 'Localidade do Imóvel', source: 'property', required: false, description: 'Localização do imóvel rural' },
    { key: 'IMOVEL_AREA_LOCADA', label: 'Área Locada', source: 'property', required: false, description: 'Área total locada em m²' },
    { key: 'IMOVEL_COMARCA', label: 'Comarca do Imóvel', source: 'property', required: false, description: 'Comarca onde o imóvel está registrado' },
    { key: 'FINALIDADE_USO', label: 'Finalidade de Uso', source: 'contract', required: false, description: 'Finalidade de uso do imóvel rural' },

    // Payment Information
    { key: 'BANCO', label: 'Banco', source: 'contract', required: false, description: 'Nome do banco para pagamento' },
    { key: 'AGENCIA', label: 'Agência', source: 'contract', required: false, description: 'Número da agência bancária' },
    { key: 'CONTA', label: 'Conta', source: 'contract', required: false, description: 'Número da conta bancária' },
    { key: 'CHAVE_PIX', label: 'Chave PIX', source: 'contract', required: false, description: 'Chave PIX para pagamento' },

    // Rural Contract Penalties
    { key: 'MULTA_RESTITUICAO_MESES', label: 'Multa Restituição (Meses)', source: 'contract', required: false, description: 'Meses de multa por descumprimento de aviso prévio' },
    { key: 'MULTA_INFRACAO_MESES', label: 'Multa Infração (Meses)', source: 'contract', required: false, description: 'Meses de aluguel como multa por infração' },
    { key: 'DATA_VISTORIA_FINAL', label: 'Data Vistoria Final', source: 'contract', required: false, description: 'Data da vistoria final do imóvel' },

    // Multiple Signatures
    { key: 'DATA_ASS_LOCADOR1', label: 'Data Assinatura Locador 1', source: 'system', required: false, description: 'Data da assinatura do primeiro locador' },
    { key: 'DATA_ASS_LOCADOR2', label: 'Data Assinatura Locador 2', source: 'system', required: false, description: 'Data da assinatura do segundo locador' },
    { key: 'IP_LOCADORES', label: 'IP dos Locadores', source: 'system', required: false, description: 'Endereço IP da assinatura dos locadores' },
    { key: 'IP_LOCATARIO', label: 'IP do Locatário', source: 'system', required: false, description: 'Endereço IP da assinatura do locatário' },
    { key: 'DATA_ASS_LOCATARIO', label: 'Data Assinatura Locatário', source: 'system', required: false, description: 'Data da assinatura do locatário' },

    // Contract 6 - Commercial Lease PJ Variables
    // Tenant (Locatário) PJ Extended Variables
    { key: 'LOCATARIO_RAZAO_SOCIAL', label: 'Razão Social do Locatário', source: 'tenant', required: false, description: 'Razão social da empresa locatária' },
    { key: 'LOCATARIO_NOME_FANTASIA', label: 'Nome Fantasia do Locatário', source: 'tenant', required: false, description: 'Nome fantasia da empresa locatária' },
    { key: 'LOCATARIO_CNPJ', label: 'CNPJ do Locatário', source: 'tenant', required: false, description: 'CNPJ da empresa locatária' },
    { key: 'LOCATARIO_IE', label: 'Inscrição Estadual', source: 'tenant', required: false, description: 'Inscrição estadual da empresa locatária' },
    { key: 'LOCATARIO_IM', label: 'Inscrição Municipal', source: 'tenant', required: false, description: 'Inscrição municipal da empresa locatária' },
    { key: 'LOCATARIO_ENDERECO', label: 'Endereço da Sede', source: 'tenant', required: false, description: 'Endereço da sede da empresa locatária' },
    { key: 'LOCATARIO_CNAE', label: 'Atividade Econômica (CNAE)', source: 'tenant', required: false, description: 'Código CNAE da atividade econômica' },
    { key: 'LOCATARIO_REP_CARGO', label: 'Cargo do Representante', source: 'tenant', required: false, description: 'Cargo do representante legal do locatário' },
    { key: 'LOCATARIO_REP_EMAIL', label: 'E-mail do Representante', source: 'tenant', required: false, description: 'E-mail do representante legal' },
    { key: 'LOCATARIO_REP_TELEFONE', label: 'Telefone do Representante', source: 'tenant', required: false, description: 'Telefone do representante legal' },

    // Property Extended Variables
    { key: 'IMOVEL_CIDADE_UF', label: 'Cidade/UF do Imóvel', source: 'property', required: false, description: 'Cidade e UF do imóvel' },
    { key: 'IMOVEL_CEP', label: 'CEP do Imóvel', source: 'property', required: false, description: 'CEP do imóvel' },
    { key: 'IMOVEL_CARTORIO', label: 'Cartório de Registro', source: 'property', required: false, description: 'Cartório onde o imóvel está registrado' },
    { key: 'IMOVEL_AREA_CONSTRUIDA', label: 'Área Construída', source: 'property', required: false, description: 'Área construída do imóvel em m²' },
    { key: 'IMOVEL_AREA_TOTAL', label: 'Área Total', source: 'property', required: false, description: 'Área total do imóvel em m²' },
    { key: 'IMOVEL_MOVEIS_LISTA', label: 'Mobílias/Equipamentos', source: 'property', required: false, description: 'Lista de mobílias e equipamentos inclusos' },
    { key: 'IMOVEL_VAGAS', label: 'Vagas de Estacionamento', source: 'property', required: false, description: 'Número de vagas de estacionamento' },
    { key: 'IMOVEL_ENERGIA', label: 'Padrão de Energia', source: 'property', required: false, description: 'Padrão de energia elétrica do imóvel' },
    { key: 'IMOVEL_CONDOMINIO', label: 'Nome do Condomínio', source: 'property', required: false, description: 'Nome do condomínio (se aplicável)' },

    // Contract Values Extended
    { key: 'VALOR_ALUGUEL_EXTENSO', label: 'Valor Aluguel por Extenso', source: 'contract', required: false, description: 'Valor do aluguel por extenso' },
    { key: 'PERIODICIDADE_REAJUSTE', label: 'Periodicidade do Reajuste', source: 'contract', required: false, description: 'Periodicidade do reajuste (anual, semestral)' },
    { key: 'DATA_BASE_REAJUSTE', label: 'Data Base do Reajuste', source: 'contract', required: false, description: 'Data base para cálculo do reajuste' },

    // Responsibility Variables (who pays what)
    { key: 'RESP_IPTU', label: 'Responsável IPTU', source: 'contract', required: false, description: 'Responsável pelo pagamento do IPTU' },
    { key: 'RESP_CONDOMINIO', label: 'Responsável Condomínio', source: 'contract', required: false, description: 'Responsável pelo pagamento do condomínio' },
    { key: 'RESP_COND_EXTRAORDINARIA', label: 'Responsável Taxa Extraordinária', source: 'contract', required: false, description: 'Responsável por taxas extraordinárias de condomínio' },
    { key: 'RESP_AGUA', label: 'Responsável Água', source: 'contract', required: false, description: 'Responsável pelo pagamento da água' },
    { key: 'RESP_ENERGIA', label: 'Responsável Energia', source: 'contract', required: false, description: 'Responsável pelo pagamento da energia' },
    { key: 'RESP_GAS', label: 'Responsável Gás', source: 'contract', required: false, description: 'Responsável pelo pagamento do gás' },
    { key: 'SEGURO_EMPRESARIAL', label: 'Seguro Empresarial', source: 'contract', required: false, description: 'Informações do seguro empresarial' },
    { key: 'VALOR_SEGURO', label: 'Valor do Seguro', source: 'contract', required: false, description: 'Valor do seguro' },
    { key: 'RESP_ALVARA', label: 'Responsável Alvará', source: 'contract', required: false, description: 'Responsável pelo alvará de funcionamento' },
    { key: 'RESP_TAXAS_MUNICIPAIS', label: 'Responsável Taxas Municipais', source: 'contract', required: false, description: 'Responsável por taxas municipais' },
    { key: 'RESP_MULTAS_COND', label: 'Responsável Multas Condominiais', source: 'contract', required: false, description: 'Responsável por multas condominiais' },

    // Administration Fees Extended
    { key: 'TAXA_INTERMEDIACAO', label: 'Taxa de Intermediação %', source: 'contract', required: false, description: 'Percentual da taxa de intermediação' },
    { key: 'VALOR_INTERMEDIACAO', label: 'Valor de Intermediação', source: 'contract', required: false, description: 'Valor fixo de intermediação' },

    // Guarantee Extended Variables
    { key: 'VALOR_GARANTIA', label: 'Valor da Garantia', source: 'contract', required: false, description: 'Valor total da garantia locatícia' },
    { key: 'CAUCAO_VALOR', label: 'Valor da Caução', source: 'contract', required: false, description: 'Valor da caução em dinheiro' },
    { key: 'FIADOR_DADOS', label: 'Dados do Fiador', source: 'contract', required: false, description: 'Dados completos do fiador' },
    { key: 'SEGURO_FIANCA_DADOS', label: 'Dados Seguro-Fiança', source: 'contract', required: false, description: 'Dados do seguro-fiança' },
    { key: 'TITULO_CAPITALIZACAO', label: 'Título de Capitalização', source: 'contract', required: false, description: 'Dados do título de capitalização' },
    { key: 'CARTA_FIANCA_BANCARIA', label: 'Carta de Fiança Bancária', source: 'contract', required: false, description: 'Dados da carta de fiança bancária' },

    // Inspection Extended Variables
    { key: 'PRAZO_CONTESTACAO_VISTORIA', label: 'Prazo Contestação Vistoria', source: 'contract', required: false, description: 'Prazo em horas para contestação da vistoria' },

    // Contract Terms Extended
    { key: 'TIPO_RENOVACAO', label: 'Tipo de Renovação', source: 'contract', required: false, description: 'Tipo de renovação contratual' },
    { key: 'AUTORIZACAO_BENFEITORIAS', label: 'Autorização Benfeitorias', source: 'contract', required: false, description: 'Status de autorização para benfeitorias' },
    { key: 'LIMITE_BENFEITORIAS', label: 'Limite para Benfeitorias', source: 'contract', required: false, description: 'Valor limite para benfeitorias sem autorização' },
    { key: 'INDICE_CORRECAO', label: 'Índice de Correção', source: 'contract', required: false, description: 'Índice para correção monetária' },
    { key: 'MULTA_INFRACAO', label: 'Multa por Infração %', source: 'contract', required: false, description: 'Percentual de multa por infração contratual' },
    { key: 'DIAS_INADIMPLENCIA', label: 'Dias para Inadimplência', source: 'contract', required: false, description: 'Dias de atraso para considerar inadimplência' },
    { key: 'DIAS_PREFERENCIA', label: 'Dias para Preferência', source: 'contract', required: false, description: 'Dias de antecedência para direito de preferência' },

    // Document Attachments
    { key: 'ANEXO_GARANTIA', label: 'Anexo Garantia', source: 'contract', required: false, description: 'Referência ao anexo de garantia' },
    { key: 'ANEXO_CONTRATO_SOCIAL', label: 'Anexo Contrato Social', source: 'contract', required: false, description: 'Referência ao contrato social' },
    { key: 'ANEXOS_DOCUMENTOS_REP', label: 'Anexos Documentos Representantes', source: 'contract', required: false, description: 'Referência aos documentos dos representantes' },
    { key: 'ANEXO_CERTIDOES', label: 'Anexo Certidões', source: 'contract', required: false, description: 'Referência às certidões do imóvel' },
    { key: 'ANEXO_ALVARA', label: 'Anexo Alvará', source: 'contract', required: false, description: 'Referência ao alvará de funcionamento' },

    // Contract 7 - Rural Property Lease Variables
    // Agency Representative Extended
    { key: 'IMOBILIARIA_REP_CARGO', label: 'Cargo Representante Imobiliária', source: 'agency', required: false, description: 'Cargo do representante da imobiliária' },

    // Guarantor (Fiador) Extended Variables
    { key: 'FIADOR_DOCUMENTO', label: 'Documento do Fiador', source: 'custom', required: false, description: 'CPF ou CNPJ do fiador' },
    { key: 'FIADOR_TELEFONE', label: 'Telefone do Fiador', source: 'custom', required: false, description: 'Telefone do fiador' },
    { key: 'FIADOR_EMAIL', label: 'E-mail do Fiador', source: 'custom', required: false, description: 'E-mail do fiador' },
    { key: 'DATA_ASS_FIADOR', label: 'Data Assinatura Fiador', source: 'system', required: false, description: 'Data da assinatura do fiador' },
    { key: 'IP_FIADOR', label: 'IP do Fiador', source: 'system', required: false, description: 'IP da assinatura do fiador' },

    // Rural Property Variables
    { key: 'IMOVEL_MUNICIPIO', label: 'Município do Imóvel', source: 'property', required: false, description: 'Município onde o imóvel está localizado' },
    { key: 'IMOVEL_ESTADO', label: 'Estado do Imóvel', source: 'property', required: false, description: 'Estado (UF) do imóvel' },
    { key: 'IMOVEL_AREA_HECTARES', label: 'Área em Hectares', source: 'property', required: false, description: 'Área total do imóvel rural em hectares' },
    { key: 'IMOVEL_PERIMETRO', label: 'Perímetro/Limites', source: 'property', required: false, description: 'Perímetro e limites da propriedade' },
    { key: 'IMOVEL_NASCENTES', label: 'Nascentes', source: 'property', required: false, description: 'Informações sobre nascentes existentes' },
    { key: 'IMOVEL_BENFEITORIAS', label: 'Benfeitorias do Imóvel', source: 'property', required: false, description: 'Benfeitorias existentes na propriedade' },
    { key: 'IMOVEL_ESTRUTURAS_RURAIS', label: 'Estruturas Rurais', source: 'property', required: false, description: 'Estruturas rurais (currais, barracões, silos, etc.)' },
    { key: 'IMOVEL_ESTRADAS_INTERNAS', label: 'Estradas Internas', source: 'property', required: false, description: 'Informações sobre estradas internas' },
    { key: 'IMOVEL_REDE_ELETRICA', label: 'Rede Elétrica', source: 'property', required: false, description: 'Informações sobre rede elétrica' },
    { key: 'IMOVEL_POCOS_AGUA', label: 'Poços/Água', source: 'property', required: false, description: 'Informações sobre poços e fontes de água' },
    { key: 'IMOVEL_DESTINACAO_RURAL', label: 'Destinação Rural', source: 'property', required: false, description: 'Destinação da propriedade (agricultura, pastagem, etc.)' },

    // Rural Contract Variables
    { key: 'RENOVACAO_AUTOMATICA', label: 'Renovação Automática', source: 'contract', required: false, description: 'Se o contrato tem renovação automática (Sim/Não)' },
    { key: 'PERIODICIDADE_PAGAMENTO', label: 'Periodicidade de Pagamento', source: 'contract', required: false, description: 'Periodicidade do pagamento (mensal, anual, por safra)' },
    { key: 'PLATAFORMA_PAGAMENTO', label: 'Plataforma de Pagamento', source: 'contract', required: false, description: 'Nome da plataforma digital de pagamento' },

    // Rural Responsibility Variables
    { key: 'RESP_ITR', label: 'Responsável ITR', source: 'contract', required: false, description: 'Responsável pelo ITR' },
    { key: 'RESP_LICENCAS_AMBIENTAIS', label: 'Responsável Licenças Ambientais', source: 'contract', required: false, description: 'Responsável pelas licenças ambientais' },
    { key: 'RESP_CAR', label: 'Responsável CAR', source: 'contract', required: false, description: 'Responsável pelo Cadastro Ambiental Rural' },
    { key: 'RESP_CCIR', label: 'Responsável CCIR', source: 'contract', required: false, description: 'Responsável pelo CCIR' },
    { key: 'RESP_CERCAS', label: 'Responsável Cercas', source: 'contract', required: false, description: 'Responsável pela manutenção de cercas' },
    { key: 'RESP_TAXAS_FISCALIZACAO', label: 'Responsável Taxas Fiscalização', source: 'contract', required: false, description: 'Responsável por taxas de fiscalização' },
    { key: 'RESP_SEGURO_RURAL', label: 'Responsável Seguro Rural', source: 'contract', required: false, description: 'Responsável pelo seguro rural' },
    { key: 'RESP_ESTRADAS', label: 'Responsável Estradas', source: 'contract', required: false, description: 'Responsável pela manutenção de estradas internas' },
    { key: 'RESP_INSUMOS', label: 'Responsável Insumos', source: 'contract', required: false, description: 'Responsável por custos com insumos e produção' },

    // Rural Contract Penalties
    { key: 'DIAS_ABANDONO', label: 'Dias para Abandono', source: 'contract', required: false, description: 'Dias de abandono para configurar rescisão' },
    { key: 'VALOR_MULTA_RESCISAO_EXTENSO', label: 'Multa Rescisão por Extenso', source: 'contract', required: false, description: 'Valor da multa rescisória por extenso' },

    // Contract 15 - Rural Lease Specific Variables
    { key: 'TIPO_IMOVEL_RURAL', label: 'Tipo de Imóvel Rural', source: 'property', required: false, description: 'Tipo do imóvel rural (Fazenda/Sítio/Chácara/Pastagem/Agropecuária/Residência Rural)' },
    { key: 'FINALIDADE_RURAL', label: 'Finalidade Rural', source: 'contract', required: false, description: 'Finalidade principal do uso do imóvel rural' },
    { key: 'ATIVIDADES_PERMITIDAS', label: 'Atividades Permitidas', source: 'contract', required: false, description: 'Lista de atividades rurais permitidas no imóvel' },
    { key: 'PASTOS_RESPONSAVEL', label: 'Responsável Manutenção Pastos', source: 'contract', required: false, description: 'Responsável pela manutenção de pastos' },
    { key: 'CONSERVACAO_RESPONSAVEL', label: 'Responsável Conservação', source: 'contract', required: false, description: 'Responsável pela limpeza e conservação do imóvel' },

    // Contract 16 - Rural Residence Specific Variables
    { key: 'MANUTENCAO_JARDIM_RESPONSAVEL', label: 'Responsável Manutenção Jardim', source: 'contract', required: false, description: 'Responsável pela manutenção de jardim/pomar simples' },

    // System Variables Extended
    { key: 'DATA_HORA_REGISTRO', label: 'Data e Hora de Registro', source: 'system', required: false, description: 'Data e hora completa do registro do contrato' },

    // Contract 8 - Residential Lease PJ Variables
    // Property Values Extended
    { key: 'IMOVEL_CONDOMINIO_VALOR', label: 'Valor do Condomínio', source: 'property', required: false, description: 'Valor mensal do condomínio' },
    { key: 'IMOVEL_IPTU_VALOR', label: 'Valor do IPTU', source: 'property', required: false, description: 'Valor anual do IPTU' },

    // Insurance and Charges
    { key: 'SEGURO_INCENDIO_VALOR', label: 'Valor Seguro Incêndio', source: 'contract', required: false, description: 'Valor do seguro incêndio obrigatório' },
    { key: 'SEGURO_INCENDIO_RESPONSAVEL', label: 'Responsável Seguro Incêndio', source: 'contract', required: false, description: 'Responsável pela contratação do seguro incêndio' },

    // Contract 12 - Commercial Lease PF/PJ Specific Variables
    { key: 'DIREITO_RENOVATORIA', label: 'Direito à Renovatória', source: 'contract', required: false, description: 'Se o locatário terá direito à ação renovatória (Sim/Não)' },
    { key: 'TAXAS_FUNCIONAMENTO_RESPONSAVEL', label: 'Responsável Taxas Funcionamento', source: 'contract', required: false, description: 'Responsável pelas taxas de alvará e funcionamento' },
    { key: 'TAXA_LIXO_RESPONSAVEL', label: 'Responsável Taxa de Lixo', source: 'contract', required: false, description: 'Responsável pela taxa de lixo comercial' },
    { key: 'MULTA_RESCISORIA', label: 'Multa Rescisória (Meses)', source: 'contract', required: false, description: 'Quantidade de meses para cálculo da multa rescisória' },
    { key: 'ATIVIDADE_COMERCIAL', label: 'Atividade Comercial', source: 'contract', required: false, description: 'Descrição da atividade comercial permitida no imóvel' },

    // Residential PJ Specific
    { key: 'OCUPANTES_AUTORIZADOS', label: 'Ocupantes Autorizados', source: 'contract', required: false, description: 'Lista de ocupantes autorizados (colaboradores da empresa)' },
    { key: 'MULTA_RESCISAO_MESES', label: 'Multa Rescisão (Meses)', source: 'contract', required: false, description: 'Quantidade de meses de aluguel como multa rescisória' },

    // Gas Responsibility
    { key: 'RESP_GAS', label: 'Responsável Gás', source: 'contract', required: false, description: 'Responsável pelo pagamento do gás' },

    // Contract 9 - Residential Lease PF/PF Variables
    // Owner (Locador) Extended Variables
    { key: 'LOCADOR_RG_ORGAO', label: 'Órgão Emissor RG Locador', source: 'owner', required: false, description: 'Órgão emissor do RG do locador' },
    { key: 'LOCADOR_DATA_NASCIMENTO', label: 'Data Nascimento Locador', source: 'owner', required: false, description: 'Data de nascimento do locador' },
    { key: 'LOCADOR_NUMERO', label: 'Número Endereço Locador', source: 'owner', required: false, description: 'Número do endereço do locador' },
    { key: 'LOCADOR_COMPLEMENTO', label: 'Complemento Endereço Locador', source: 'owner', required: false, description: 'Complemento do endereço do locador' },
    { key: 'LOCADOR_BAIRRO', label: 'Bairro do Locador', source: 'owner', required: false, description: 'Bairro do endereço do locador' },
    { key: 'LOCADOR_CEP', label: 'CEP do Locador', source: 'owner', required: false, description: 'CEP do endereço do locador' },
    { key: 'LOCADOR_CIDADE', label: 'Cidade do Locador', source: 'owner', required: false, description: 'Cidade do locador' },
    { key: 'LOCADOR_ESTADO', label: 'Estado do Locador', source: 'owner', required: false, description: 'Estado (UF) do locador' },

    // Tenant (Locatário) PF Extended Variables
    { key: 'LOCATARIO_RG_ORGAO', label: 'Órgão Emissor RG Locatário', source: 'tenant', required: false, description: 'Órgão emissor do RG do locatário' },
    { key: 'LOCATARIO_DATA_NASCIMENTO', label: 'Data Nascimento Locatário', source: 'tenant', required: false, description: 'Data de nascimento do locatário' },
    { key: 'LOCATARIO_NUMERO', label: 'Número Endereço Locatário', source: 'tenant', required: false, description: 'Número do endereço do locatário' },
    { key: 'LOCATARIO_COMPLEMENTO', label: 'Complemento Endereço Locatário', source: 'tenant', required: false, description: 'Complemento do endereço do locatário' },
    { key: 'LOCATARIO_BAIRRO', label: 'Bairro do Locatário', source: 'tenant', required: false, description: 'Bairro do endereço do locatário' },
    { key: 'LOCATARIO_CEP', label: 'CEP do Locatário', source: 'tenant', required: false, description: 'CEP do endereço do locatário' },
    { key: 'LOCATARIO_CIDADE', label: 'Cidade do Locatário', source: 'tenant', required: false, description: 'Cidade do locatário' },
    { key: 'LOCATARIO_ESTADO', label: 'Estado do Locatário', source: 'tenant', required: false, description: 'Estado (UF) do locatário' },

    // Spouse (Cônjuge do Locatário) Variables
    { key: 'CONJUGE_LOCATARIO_NOME', label: 'Nome Cônjuge Locatário', source: 'tenant', required: false, description: 'Nome do cônjuge do locatário' },
    { key: 'CONJUGE_LOCATARIO_CPF', label: 'CPF Cônjuge Locatário', source: 'tenant', required: false, description: 'CPF do cônjuge do locatário' },
    { key: 'CONJUGE_LOCATARIO_RG', label: 'RG Cônjuge Locatário', source: 'tenant', required: false, description: 'RG do cônjuge do locatário' },
    { key: 'DATA_ASS_CONJUGE_LOCATARIO', label: 'Data Assinatura Cônjuge', source: 'system', required: false, description: 'Data da assinatura do cônjuge do locatário' },
    { key: 'HORA_ASS_CONJUGE_LOCATARIO', label: 'Hora Assinatura Cônjuge', source: 'system', required: false, description: 'Hora da assinatura do cônjuge do locatário' },

    // Property Extended Variables
    { key: 'IMOVEL_NUMERO', label: 'Número do Imóvel', source: 'property', required: false, description: 'Número do endereço do imóvel' },
    { key: 'IMOVEL_COMPLEMENTO', label: 'Complemento do Imóvel', source: 'property', required: false, description: 'Complemento do endereço do imóvel' },
    { key: 'IMOVEL_CIDADE', label: 'Cidade do Imóvel', source: 'property', required: false, description: 'Cidade onde o imóvel está localizado' },
    { key: 'IMOVEL_INSCRICAO_IPTU', label: 'Inscrição IPTU', source: 'property', required: false, description: 'Número de inscrição do IPTU' },
    { key: 'IMOVEL_QUARTOS', label: 'Quartos do Imóvel', source: 'property', required: false, description: 'Número de quartos do imóvel' },
    { key: 'IMOVEL_SUITES', label: 'Suítes do Imóvel', source: 'property', required: false, description: 'Número de suítes do imóvel' },
    { key: 'IMOVEL_BANHEIROS', label: 'Banheiros do Imóvel', source: 'property', required: false, description: 'Número de banheiros do imóvel' },
    { key: 'IMOVEL_SALAS', label: 'Salas do Imóvel', source: 'property', required: false, description: 'Número de salas do imóvel' },
    { key: 'IMOVEL_OBSERVACOES', label: 'Observações do Imóvel', source: 'property', required: false, description: 'Observações adicionais do imóvel' },

    // Agency Extended Variables
    { key: 'IMOBILIARIA_REP_CPF', label: 'CPF Representante Imobiliária', source: 'agency', required: false, description: 'CPF do representante legal da imobiliária' },
    { key: 'IMOBILIARIA_NUMERO', label: 'Número Endereço Imobiliária', source: 'agency', required: false, description: 'Número do endereço da imobiliária' },
    { key: 'IMOBILIARIA_COMPLEMENTO', label: 'Complemento Endereço Imobiliária', source: 'agency', required: false, description: 'Complemento do endereço da imobiliária' },
    { key: 'IMOBILIARIA_BAIRRO', label: 'Bairro da Imobiliária', source: 'agency', required: false, description: 'Bairro do endereço da imobiliária' },
    { key: 'IMOBILIARIA_CEP', label: 'CEP da Imobiliária', source: 'agency', required: false, description: 'CEP do endereço da imobiliária' },
    { key: 'IMOBILIARIA_CIDADE', label: 'Cidade da Imobiliária', source: 'agency', required: false, description: 'Cidade da imobiliária' },
    { key: 'IMOBILIARIA_ESTADO', label: 'Estado da Imobiliária', source: 'agency', required: false, description: 'Estado (UF) da imobiliária' },

    // Guarantee Extended Variables
    { key: 'GARANTIA_TIPO', label: 'Tipo de Garantia', source: 'contract', required: false, description: 'Modalidade de garantia locatícia' },
    { key: 'CAUCAO_VALOR_EXTENSO', label: 'Valor Caução por Extenso', source: 'contract', required: false, description: 'Valor da caução por extenso' },
    { key: 'CAUCAO_MESES', label: 'Caução em Meses', source: 'contract', required: false, description: 'Quantidade de meses equivalentes à caução' },
    { key: 'CAUCAO_BANCO', label: 'Banco da Caução', source: 'contract', required: false, description: 'Banco onde a caução foi depositada' },
    { key: 'CAUCAO_CONTA', label: 'Conta da Caução', source: 'contract', required: false, description: 'Conta bancária da caução' },
    { key: 'CAUCAO_DATA_DEPOSITO', label: 'Data Depósito Caução', source: 'contract', required: false, description: 'Data do depósito da caução' },

    // Fiador (Guarantor) Extended Variables
    { key: 'FIADOR_NOME', label: 'Nome do Fiador', source: 'custom', required: false, description: 'Nome completo do fiador' },
    { key: 'FIADOR_CPF', label: 'CPF do Fiador', source: 'custom', required: false, description: 'CPF do fiador' },
    { key: 'FIADOR_RG', label: 'RG do Fiador', source: 'custom', required: false, description: 'RG do fiador' },
    { key: 'FIADOR_ESTADO_CIVIL', label: 'Estado Civil do Fiador', source: 'custom', required: false, description: 'Estado civil do fiador' },
    { key: 'FIADOR_PROFISSAO', label: 'Profissão do Fiador', source: 'custom', required: false, description: 'Profissão do fiador' },
    { key: 'FIADOR_ENDERECO', label: 'Endereço do Fiador', source: 'custom', required: false, description: 'Endereço do fiador' },
    { key: 'FIADOR_NUMERO', label: 'Número Endereço Fiador', source: 'custom', required: false, description: 'Número do endereço do fiador' },
    { key: 'FIADOR_BAIRRO', label: 'Bairro do Fiador', source: 'custom', required: false, description: 'Bairro do endereço do fiador' },
    { key: 'FIADOR_CEP', label: 'CEP do Fiador', source: 'custom', required: false, description: 'CEP do endereço do fiador' },
    { key: 'FIADOR_CIDADE', label: 'Cidade do Fiador', source: 'custom', required: false, description: 'Cidade do fiador' },
    { key: 'FIADOR_ESTADO', label: 'Estado do Fiador', source: 'custom', required: false, description: 'Estado (UF) do fiador' },
    { key: 'FIADOR_IMOVEL_GARANTIA', label: 'Imóvel Garantia Fiador', source: 'custom', required: false, description: 'Descrição do imóvel oferecido em garantia pelo fiador' },
    { key: 'FIADOR_IMOVEL_MATRICULA', label: 'Matrícula Imóvel Fiador', source: 'custom', required: false, description: 'Matrícula do imóvel do fiador' },

    // Seguro-Fiança Variables
    { key: 'SEGURO_FIANCA_EMPRESA', label: 'Seguradora Fiança', source: 'contract', required: false, description: 'Nome da seguradora do seguro-fiança' },
    { key: 'SEGURO_FIANCA_APOLICE', label: 'Apólice Seguro-Fiança', source: 'contract', required: false, description: 'Número da apólice do seguro-fiança' },
    { key: 'SEGURO_FIANCA_VIGENCIA', label: 'Vigência Seguro-Fiança', source: 'contract', required: false, description: 'Vigência do seguro-fiança' },
    { key: 'SEGURO_FIANCA_COBERTURA', label: 'Cobertura Seguro-Fiança', source: 'contract', required: false, description: 'Valor de cobertura do seguro-fiança' },

    // Título de Capitalização Variables
    { key: 'TITULO_CAP_INSTITUICAO', label: 'Instituição Título Cap.', source: 'contract', required: false, description: 'Instituição financeira do título de capitalização' },
    { key: 'TITULO_CAP_NUMERO', label: 'Número Título Cap.', source: 'contract', required: false, description: 'Número do título de capitalização' },
    { key: 'TITULO_CAP_VALOR', label: 'Valor Título Cap.', source: 'contract', required: false, description: 'Valor do título de capitalização' },

    // Contract Terms Extended
    { key: 'PRAZO_AGENDAMENTO_VISTORIA', label: 'Prazo Agendamento Vistoria', source: 'contract', required: false, description: 'Prazo em horas para agendamento de vistoria' },
    { key: 'PRAZO_REPASSE_LOCADOR', label: 'Prazo Repasse Locador', source: 'contract', required: false, description: 'Prazo em dias úteis para repasse ao locador' },
    { key: 'MULTA_ATRASO_PERCENTUAL', label: 'Multa Atraso %', source: 'contract', required: false, description: 'Percentual de multa por atraso' },
    { key: 'JUROS_MORA_PERCENTUAL', label: 'Juros Mora %', source: 'contract', required: false, description: 'Percentual de juros de mora ao mês' },
    { key: 'TAXA_ADMINISTRACAO_PERCENTUAL', label: 'Taxa Administração %', source: 'contract', required: false, description: 'Percentual da taxa de administração' },
    { key: 'MULTA_INFRACAO_PERCENTUAL', label: 'Multa Infração %', source: 'contract', required: false, description: 'Percentual de multa por infração contratual' },
    { key: 'HONORARIOS_PERCENTUAL', label: 'Honorários Advocatícios %', source: 'contract', required: false, description: 'Percentual de honorários advocatícios' },
    { key: 'PRAZO_LOCACAO_MESES', label: 'Prazo Locação (Meses)', source: 'contract', required: false, description: 'Prazo total da locação em meses' },
    { key: 'DATA_INICIO_CONTRATO', label: 'Data Início Contrato', source: 'contract', required: false, description: 'Data de início do contrato' },
    { key: 'DATA_FIM_CONTRATO', label: 'Data Fim Contrato', source: 'contract', required: false, description: 'Data de término do contrato' },

    // Responsibility Extended
    { key: 'RESP_LUZ', label: 'Responsável Luz', source: 'contract', required: false, description: 'Responsável pelo pagamento da energia elétrica' },
    { key: 'RESP_TAXA_INCENDIO', label: 'Responsável Taxa Incêndio', source: 'contract', required: false, description: 'Responsável pela taxa de incêndio' },

    // Forum/Jurisdiction
    { key: 'FORO_CIDADE', label: 'Cidade do Foro', source: 'contract', required: false, description: 'Cidade do foro eleito' },
    { key: 'FORO_ESTADO', label: 'Estado do Foro', source: 'contract', required: false, description: 'Estado do foro eleito' },

    // Geolocation Variables
    { key: 'GEO_IMOBILIARIA', label: 'Geolocalização Imobiliária', source: 'system', required: false, description: 'Geolocalização da assinatura da imobiliária' },
    { key: 'GEO_LOCADOR', label: 'Geolocalização Locador', source: 'system', required: false, description: 'Geolocalização da assinatura do locador' },
    { key: 'GEO_LOCATARIO', label: 'Geolocalização Locatário', source: 'system', required: false, description: 'Geolocalização da assinatura do locatário' },

    // Signature Time Variables
    { key: 'HORA_ASS_LOCADOR', label: 'Hora Assinatura Locador', source: 'system', required: false, description: 'Hora da assinatura do locador' },
    { key: 'HORA_ASS_LOCATARIO', label: 'Hora Assinatura Locatário', source: 'system', required: false, description: 'Hora da assinatura do locatário' },
    { key: 'HORA_ASS_IMOBILIARIA', label: 'Hora Assinatura Imobiliária', source: 'system', required: false, description: 'Hora da assinatura da imobiliária' },

    // Witness Variables
    { key: 'TESTEMUNHA1_NOME', label: 'Nome 1ª Testemunha', source: 'custom', required: false, description: 'Nome da primeira testemunha' },
    { key: 'TESTEMUNHA1_CPF', label: 'CPF 1ª Testemunha', source: 'custom', required: false, description: 'CPF da primeira testemunha' },
    { key: 'DATA_ASS_TESTEMUNHA1', label: 'Data Assinatura 1ª Testemunha', source: 'system', required: false, description: 'Data da assinatura da primeira testemunha' },
    { key: 'TESTEMUNHA2_NOME', label: 'Nome 2ª Testemunha', source: 'custom', required: false, description: 'Nome da segunda testemunha' },
    { key: 'TESTEMUNHA2_CPF', label: 'CPF 2ª Testemunha', source: 'custom', required: false, description: 'CPF da segunda testemunha' },
    { key: 'DATA_ASS_TESTEMUNHA2', label: 'Data Assinatura 2ª Testemunha', source: 'system', required: false, description: 'Data da assinatura da segunda testemunha' },

    // Document Attachments Extended
    { key: 'ANEXO_DOCS_LOCADOR', label: 'Anexo Documentos Locador', source: 'contract', required: false, description: 'Referência aos documentos do locador' },
    { key: 'ANEXO_DOCS_LOCATARIO', label: 'Anexo Documentos Locatário', source: 'contract', required: false, description: 'Referência aos documentos do locatário' },
    { key: 'ANEXO_DOCS_IMOVEL', label: 'Anexo Documentos Imóvel', source: 'contract', required: false, description: 'Referência aos documentos do imóvel' },
    { key: 'ANEXO_CONVENCAO_CONDOMINIO', label: 'Anexo Convenção Condomínio', source: 'contract', required: false, description: 'Referência à convenção do condomínio' },

    // Contract 11 - Standard Residential Lease 2019 Variables
    // Fiador Extended Variables
    { key: 'FIADOR_PROFISSAO', label: 'Profissão do Fiador', source: 'custom', required: false, description: 'Profissão do fiador' },
    { key: 'FIADOR_RESP_SOLIDARIA', label: 'Responsabilidade Solidária', source: 'custom', required: false, description: 'Se o fiador tem responsabilidade solidária (Sim/Não)' },

    // Special Purpose Variable
    { key: 'FINALIDADE_ESPECIAL', label: 'Finalidade Especial', source: 'contract', required: false, description: 'Finalidade especial do imóvel, se aplicável' },

    // Responsibility Variables (Simple format)
    { key: 'AGUA_RESPONSAVEL', label: 'Responsável Água', source: 'contract', required: false, description: 'Responsável pelo pagamento da água' },
    { key: 'ENERGIA_RESPONSAVEL', label: 'Responsável Energia', source: 'contract', required: false, description: 'Responsável pelo pagamento da energia elétrica' },
    { key: 'GAS_RESPONSAVEL', label: 'Responsável Gás', source: 'contract', required: false, description: 'Responsável pelo pagamento do gás' },
    { key: 'CONDOMINIO_RESPONSAVEL', label: 'Responsável Condomínio', source: 'contract', required: false, description: 'Responsável pelo pagamento do condomínio' },
    { key: 'IPTU_RESPONSAVEL', label: 'Responsável IPTU', source: 'contract', required: false, description: 'Responsável pelo pagamento do IPTU' },

    // Payment Variables
    { key: 'FORMA_PAGAMENTO', label: 'Forma de Pagamento', source: 'contract', required: false, description: 'Forma de pagamento do aluguel' },
    { key: 'USO_IMOBILIARIA', label: 'Uso de Imobiliária', source: 'contract', required: false, description: 'Se utiliza imobiliária para administração (Sim/Não)' },
    { key: 'DADOS_BANCARIOS', label: 'Dados Bancários', source: 'contract', required: false, description: 'Dados bancários ou PIX para pagamento' },

    // Guarantee Extended Variables
    { key: 'VALOR_GARANTIA_EXTENSO', label: 'Valor Garantia por Extenso', source: 'contract', required: false, description: 'Valor da garantia por extenso' },
    { key: 'GARANTIA_DADOS', label: 'Dados da Garantia', source: 'contract', required: false, description: 'Dados complementares da garantia locatícia' },
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
      case 'IMOVEL_ENDERECO':
        const parts = [property.address, property.number, property.complement, property.neighborhood, property.city, property.stateNumber || property.state, property.cep].filter(Boolean);
        return parts.join(', ');
      case 'DESCRICAO_IMOVEL':
      case 'IMOVEL_DESCRICAO':
        return property.description || property.name || null;
      case 'MATRICULA':
      case 'IMOVEL_MATRICULA':
        return property.registrationNumber || null;
      case 'IMOVEL_BAIRRO':
        return property.neighborhood || null;
      case 'IMOVEL_TIPO':
        // Map property type to human-readable format
        const typeMap: Record<string, string> = {
          'RESIDENTIAL': 'Residencial',
          'COMMERCIAL': 'Comercial',
          'INDUSTRIAL': 'Industrial',
          'RURAL': 'Rural',
          'LAND': 'Terreno',
        };
        return typeMap[property.propertyType] || property.propertyType || 'Residencial';
      case 'IMOVEL_AREA':
        // Return built area with unit, or total area as fallback
        if (property.builtArea) {
          return `${property.builtArea} m²`;
        }
        if (property.totalArea) {
          return `${property.totalArea} m²`;
        }
        return null;
      case 'IMOVEL_MOVEIS':
      case 'IMOVEL_MOVEIS_LISTA':
        return property.furnitureList || null;
      // Extended Property Variables for Commercial Contracts
      case 'IMOVEL_CIDADE_UF':
        if (property.city && (property.stateNumber || property.state)) {
          return `${property.city}/${property.stateNumber || property.state}`;
        }
        return property.city || null;
      case 'IMOVEL_CEP':
        return property.cep || null;
      case 'IMOVEL_CARTORIO':
        return property.registryOffice || null;
      case 'IMOVEL_AREA_CONSTRUIDA':
        return property.builtArea ? `${property.builtArea}` : null;
      case 'IMOVEL_AREA_TOTAL':
        return property.totalArea ? `${property.totalArea}` : null;
      case 'IMOVEL_VAGAS':
        return property.parkingSpaces?.toString() || null;
      case 'IMOVEL_ENERGIA':
        return property.electricityPattern || null;
      case 'IMOVEL_CONDOMINIO':
        return property.condominiumName || null;
      case 'IMOVEL_LOCALIDADE':
        return property.locality || property.neighborhood || null;
      case 'IMOVEL_AREA_LOCADA':
        return property.rentedArea ? `${property.rentedArea}` : null;
      case 'IMOVEL_COMARCA':
        return property.jurisdiction || property.city || null;
      // Rural Property Variables
      case 'IMOVEL_MUNICIPIO':
        return property.city || property.municipality || null;
      case 'IMOVEL_ESTADO':
        return property.stateNumber || property.state || null;
      case 'IMOVEL_AREA_HECTARES':
        // Convert from m² to hectares if needed, or return direct value
        if (property.areaHectares) return `${property.areaHectares}`;
        if (property.totalArea) return `${(property.totalArea / 10000).toFixed(2)}`;
        return null;
      case 'IMOVEL_PERIMETRO':
        return property.perimeter || property.limits || null;
      case 'IMOVEL_NASCENTES':
        return property.springs || property.hasNaturalSprings || null;
      case 'IMOVEL_BENFEITORIAS':
        return property.improvements || property.benfeitorias || null;
      case 'IMOVEL_ESTRUTURAS_RURAIS':
        return property.ruralStructures || null;
      case 'IMOVEL_ESTRADAS_INTERNAS':
        return property.internalRoads || null;
      case 'IMOVEL_REDE_ELETRICA':
        return property.electricalGrid || property.hasElectricity || null;
      case 'IMOVEL_POCOS_AGUA':
        return property.waterWells || property.waterSources || null;
      case 'IMOVEL_DESTINACAO_RURAL':
        return property.ruralDestination || property.intendedUse || null;
      // Contract 8 - Residential Property Values
      case 'IMOVEL_CONDOMINIO_VALOR':
        return property.condominiumValue ? this.formatCurrency(property.condominiumValue) : null;
      case 'IMOVEL_IPTU_VALOR':
        return property.iptuValue ? this.formatCurrency(property.iptuValue) : null;
      // Contract 9 - Residential PF/PF Property Variables
      case 'IMOVEL_NUMERO':
        return property.number || null;
      case 'IMOVEL_COMPLEMENTO':
        return property.complement || null;
      case 'IMOVEL_CIDADE':
        return property.city || null;
      case 'IMOVEL_INSCRICAO_IPTU':
        return property.iptuRegistration || property.iptuNumber || null;
      case 'IMOVEL_QUARTOS':
        return property.bedrooms?.toString() || property.quartos?.toString() || null;
      case 'IMOVEL_SUITES':
        return property.suites?.toString() || null;
      case 'IMOVEL_BANHEIROS':
        return property.bathrooms?.toString() || property.banheiros?.toString() || null;
      case 'IMOVEL_SALAS':
        return property.livingRooms?.toString() || property.salas?.toString() || null;
      case 'IMOVEL_OBSERVACOES':
        return property.observations || property.notes || null;
      default:
        return null;
    }
  }

  private getTenantValue(key: string, tenant: any): string | null {
    if (!tenant) return null;

    switch (key) {
      case 'NOME_LOCATARIO':
      case 'LOCATARIO_NOME':
        return tenant.name || null;
      case 'CPF_LOCATARIO':
      case 'LOCATARIO_CPF':
        return this.formatCpfCnpj(tenant.document) || null;
      case 'CNPJ_LOCATARIO':
      case 'LOCATARIO_CNPJ':
        return this.formatCpfCnpj(tenant.cnpj || tenant.document) || null;
      case 'RAZAO_SOCIAL_LOCATARIO':
      case 'LOCATARIO_RAZAO_SOCIAL':
        return tenant.companyName || tenant.name || null;
      case 'LOCATARIO_NOME_FANTASIA':
        return tenant.tradeName || tenant.companyName || null;
      case 'ENDERECO_LOCATARIO':
      case 'LOCATARIO_ENDERECO_ATUAL':
      case 'LOCATARIO_ENDERECO':
        const parts = [tenant.address, tenant.number, tenant.neighborhood, tenant.city, tenant.state, tenant.cep].filter(Boolean);
        return parts.join(', ') || null;
      case 'EMAIL_LOCATARIO':
      case 'LOCATARIO_EMAIL':
        return tenant.email || null;
      case 'TELEFONE_LOCATARIO':
      case 'LOCATARIO_TELEFONE':
        return tenant.phone || null;
      case 'REPRESENTANTE_LOCATARIO':
      case 'LOCATARIO_REP_NOME':
        return tenant.representativeName || null;
      case 'CPF_REPRESENTANTE_LOCATARIO':
      case 'LOCATARIO_REP_CPF':
        return this.formatCpfCnpj(tenant.representativeDocument) || null;
      case 'CARGO_LOCATARIO':
      case 'LOCATARIO_REP_CARGO':
        return tenant.representativePosition || null;
      case 'LOCATARIO_REP_RG':
        return tenant.representativeRg || null;
      case 'LOCATARIO_REP_ENDERECO':
        return tenant.representativeAddress || null;
      case 'LOCATARIO_REP_EMAIL':
        return tenant.representativeEmail || tenant.email || null;
      case 'LOCATARIO_REP_TELEFONE':
        return tenant.representativePhone || tenant.phone || null;
      case 'LOCATARIO_NACIONALIDADE':
        return tenant.nationality || 'Brasileira';
      case 'LOCATARIO_REP_NACIONALIDADE':
        return tenant.representativeNationality || 'Brasileira';
      case 'LOCATARIO_ESTADO_CIVIL':
        return tenant.maritalStatus || null;
      case 'LOCATARIO_REP_ESTADO_CIVIL':
        return tenant.representativeMaritalStatus || null;
      case 'LOCATARIO_PROFISSAO':
        return tenant.profession || null;
      case 'LOCATARIO_RG':
        return tenant.rg || null;
      case 'LOCATARIO_DATA_NASC':
        return tenant.birthDate ? this.formatDate(tenant.birthDate) : null;
      // PJ Specific Variables
      case 'LOCATARIO_IE':
        return tenant.stateRegistration || null;
      case 'LOCATARIO_IM':
        return tenant.municipalRegistration || null;
      case 'LOCATARIO_CNAE':
        return tenant.cnae || tenant.economicActivity || null;
      // Contract 9 - Residential PF Tenant Extended Variables
      case 'LOCATARIO_RG_ORGAO':
        return tenant.rgIssuer || tenant.rgOrgao || null;
      case 'LOCATARIO_DATA_NASCIMENTO':
        return tenant.birthDate ? this.formatDate(tenant.birthDate) : null;
      case 'LOCATARIO_NUMERO':
        return tenant.number || tenant.addressNumber || null;
      case 'LOCATARIO_COMPLEMENTO':
        return tenant.complement || tenant.addressComplement || null;
      case 'LOCATARIO_BAIRRO':
        return tenant.neighborhood || tenant.bairro || null;
      case 'LOCATARIO_CEP':
        return tenant.cep || tenant.zipCode || null;
      case 'LOCATARIO_CIDADE':
        return tenant.city || tenant.cidade || null;
      case 'LOCATARIO_ESTADO':
        return tenant.state || tenant.estado || null;
      // Spouse (Cônjuge) Variables
      case 'CONJUGE_LOCATARIO_NOME':
        return tenant.spouseName || tenant.conjuge?.name || null;
      case 'CONJUGE_LOCATARIO_CPF':
        return tenant.spouseDocument ? this.formatCpfCnpj(tenant.spouseDocument) : (tenant.conjuge?.cpf ? this.formatCpfCnpj(tenant.conjuge.cpf) : null);
      case 'CONJUGE_LOCATARIO_RG':
        return tenant.spouseRg || tenant.conjuge?.rg || null;
      default:
        return null;
    }
  }

  private getOwnerValue(key: string, owner: any): string | null {
    if (!owner) return null;

    switch (key) {
      case 'NOME_LOCADOR':
      case 'LOCADOR_NOME':
        return owner.name || null;
      case 'CPF_LOCADOR':
      case 'LOCADOR_CPF':
        return this.formatCpfCnpj(owner.document) || null;
      case 'CNPJ_LOCADOR':
        return this.formatCpfCnpj(owner.cnpj || owner.document) || null;
      case 'RAZAO_SOCIAL_LOCADOR':
        return owner.companyName || owner.name || null;
      case 'ENDERECO_LOCADOR':
      case 'LOCADOR_ENDERECO':
        const parts = [owner.address, owner.number, owner.neighborhood, owner.city, owner.state, owner.cep].filter(Boolean);
        return parts.join(', ') || null;
      case 'EMAIL_LOCADOR':
      case 'LOCADOR_EMAIL':
        return owner.email || null;
      case 'TELEFONE_LOCADOR':
      case 'LOCADOR_TELEFONE':
        return owner.phone || null;
      case 'REPRESENTANTE_LOCADOR':
        return owner.representativeName || null;
      case 'CPF_REPRESENTANTE_LOCADOR':
        return this.formatCpfCnpj(owner.representativeDocument) || null;
      case 'CARGO_LOCADOR':
        return owner.representativePosition || null;
      case 'LOCADOR_NACIONALIDADE':
        return owner.nationality || 'Brasileira';
      case 'LOCADOR_ESTADO_CIVIL':
        return owner.maritalStatus || null;
      case 'LOCADOR_PROFISSAO':
        return owner.profession || null;
      case 'LOCADOR_RG':
        return owner.rg || null;
      case 'LOCADOR_DATA_NASC':
        return owner.birthDate ? this.formatDate(owner.birthDate) : null;
      // Contract 9 - Residential PF Owner Extended Variables
      case 'LOCADOR_RG_ORGAO':
        return owner.rgIssuer || owner.rgOrgao || null;
      case 'LOCADOR_DATA_NASCIMENTO':
        return owner.birthDate ? this.formatDate(owner.birthDate) : null;
      case 'LOCADOR_NUMERO':
        return owner.number || owner.addressNumber || null;
      case 'LOCADOR_COMPLEMENTO':
        return owner.complement || owner.addressComplement || null;
      case 'LOCADOR_BAIRRO':
        return owner.neighborhood || owner.bairro || null;
      case 'LOCADOR_CEP':
        return owner.cep || owner.zipCode || null;
      case 'LOCADOR_CIDADE':
        return owner.city || owner.cidade || null;
      case 'LOCADOR_ESTADO':
        return owner.state || owner.estado || null;
      default:
        return null;
    }
  }

  private getAgencyValue(key: string, agency: any): string | null {
    if (!agency) return null;

    switch (key) {
      case 'RAZAO_SOCIAL_IMOBILIARIA':
      case 'IMOBILIARIA_RAZAO_SOCIAL':
        return agency.name || null;
      case 'IMOBILIARIA_NOME_FANTASIA':
        return agency.tradeName || agency.name || null;
      case 'CNPJ_IMOBILIARIA':
      case 'IMOBILIARIA_CNPJ':
        return this.formatCpfCnpj(agency.cnpj) || null;
      case 'NUMERO_CRECI':
      case 'IMOBILIARIA_CRECI':
        return agency.creci || null;
      case 'ENDERECO_IMOBILIARIA':
      case 'IMOBILIARIA_ENDERECO':
        const parts = [agency.address, agency.number, agency.neighborhood, agency.city, agency.state, agency.cep].filter(Boolean);
        return parts.join(', ') || null;
      case 'EMAIL_IMOBILIARIA':
      case 'IMOBILIARIA_EMAIL':
        return agency.email || null;
      case 'TELEFONE_IMOBILIARIA':
      case 'IMOBILIARIA_TELEFONE':
        return agency.phone || null;
      case 'REPRESENTANTE_IMOBILIARIA':
      case 'IMOBILIARIA_REPRESENTANTE':
        return agency.representativeName || null;
      case 'CPF_REPRESENTANTE_IMOBILIARIA':
      case 'IMOBILIARIA_REP_DOC':
        return this.formatCpfCnpj(agency.representativeDocument) || null;
      case 'IMOBILIARIA_REP_CARGO':
        return agency.representativePosition || agency.representativeRole || null;
      // Contract 9 - Residential PF/PF Agency Extended Variables
      case 'IMOBILIARIA_REP_CPF':
        return agency.representativeDocument ? this.formatCpfCnpj(agency.representativeDocument) : null;
      case 'IMOBILIARIA_NUMERO':
        return agency.number || agency.addressNumber || null;
      case 'IMOBILIARIA_COMPLEMENTO':
        return agency.complement || agency.addressComplement || null;
      case 'IMOBILIARIA_BAIRRO':
        return agency.neighborhood || agency.bairro || null;
      case 'IMOBILIARIA_CEP':
        return agency.cep || agency.zipCode || null;
      case 'IMOBILIARIA_CIDADE':
        return agency.city || agency.cidade || null;
      case 'IMOBILIARIA_ESTADO':
        return agency.state || agency.estado || null;
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
      // Contract 3 - Administration Contract Variables
      case 'VALOR_LIMITE_MANUTENCAO':
        return contract.maintenanceLimit ? this.formatCurrency(contract.maintenanceLimit) : 'R$ 500,00';
      case 'TAXA_ADMINISTRACAO':
        return contract.adminFeePercent ? `${contract.adminFeePercent}%` : '10%';
      case 'VALOR_TAXA_INTERMEDIACAO':
        return contract.intermediationFee ? this.formatCurrency(contract.intermediationFee) : null;
      case 'PERCENTUAL_INTERMEDIACAO':
        // Note: Template already has % after placeholder, so don't add % here
        return contract.intermediationFeePercent ? `${contract.intermediationFeePercent}` : '100';
      case 'DIA_REPASSE':
        return contract.transferDay?.toString() || '10';
      case 'PLANO_GARANTIA':
        return contract.hasGuaranteePlan ? 'Sim' : 'Não';
      case 'VALOR_LIMITE_SERVICOS':
        return contract.serviceLimit ? this.formatCurrency(contract.serviceLimit) : 'R$ 300,00';
      case 'MODELO_AUTORIZACAO':
        return contract.authorizationModel || 'Sistema digital da imobiliária';
      case 'DIAS_AVISO_PREVIO':
        return contract.noticeDays?.toString() || '30';
      case 'VALOR_MULTA_RESCISAO':
        return contract.terminationPenalty ? this.formatCurrency(contract.terminationPenalty) : 'R$ 5.000,00';
      case 'JUROS_ATRASO':
        return contract.lateInterestPercent ? `${contract.lateInterestPercent}%` : '1%';
      case 'FORO_CIDADE_ESTADO':
        return contract.jurisdiction || `${contract.property?.city || 'São Paulo'}/${contract.property?.stateNumber || contract.property?.state || 'SP'}`;
      // Inspection/Vistoria Variables
      case 'DATA_VISTORIA_INICIAL':
        return contract.initialInspectionDate ? this.formatDate(contract.initialInspectionDate) : '[A ser agendada]';
      case 'RESP_VISTORIA_INICIAL':
        return contract.initialInspectionResponsible || 'IMOBILIÁRIA';
      case 'ANEXO_VISTORIA_INICIAL':
        return contract.initialInspectionAttachment || 'Anexo I - Laudo de Vistoria Inicial';
      case 'ANEXO_VISTORIA_FINAL':
        return contract.finalInspectionAttachment || 'Anexo II - Laudo de Vistoria Final';
      case 'DATA_VISTORIA_FINAL':
        return contract.finalInspectionDate ? this.formatDate(contract.finalInspectionDate) : '[A ser agendada]';
      case 'PRAZO_CONTESTACAO_VISTORIA':
        return contract.inspectionContestationPeriod?.toString() || '72';

      // Contract 6 - Commercial Lease Extended Variables
      case 'VALOR_ALUGUEL_EXTENSO':
        return contract.rentInWords || this.numberToWords(contract.monthlyRent);
      case 'PERIODICIDADE_REAJUSTE':
        return contract.readjustmentPeriodicity || 'Anual';
      case 'DATA_BASE_REAJUSTE':
        return contract.readjustmentBaseDate ? this.formatDate(contract.readjustmentBaseDate) : 'Data de aniversário do contrato';

      // Responsibility Variables
      case 'RESP_IPTU':
        return contract.iptuResponsibility || 'LOCATÁRIA';
      case 'RESP_CONDOMINIO':
        return contract.condominiumResponsibility || 'LOCATÁRIA';
      case 'RESP_COND_EXTRAORDINARIA':
        return contract.extraordinaryCondoResponsibility || 'LOCADOR';
      case 'RESP_AGUA':
        return contract.waterResponsibility || 'LOCATÁRIA';
      case 'RESP_ENERGIA':
        return contract.electricityResponsibility || 'LOCATÁRIA';
      case 'RESP_GAS':
        return contract.gasResponsibility || 'LOCATÁRIA';
      case 'SEGURO_EMPRESARIAL':
        return contract.businessInsurance || 'Obrigatório';
      case 'VALOR_SEGURO':
        return contract.insuranceValue ? this.formatCurrency(contract.insuranceValue) : null;
      case 'RESP_ALVARA':
        return contract.permitResponsibility || 'LOCATÁRIA';
      case 'RESP_TAXAS_MUNICIPAIS':
        return contract.municipalFeesResponsibility || 'LOCATÁRIA';
      case 'RESP_MULTAS_COND':
        return contract.condoFinesResponsibility || 'LOCATÁRIA';

      // Administration Fees
      case 'TAXA_INTERMEDIACAO':
        return contract.intermediationFeePercent?.toString() || '100';
      case 'VALOR_INTERMEDIACAO':
        return contract.intermediationFee ? this.formatCurrency(contract.intermediationFee) : null;

      // Guarantee Variables
      case 'VALOR_GARANTIA':
        return contract.guaranteeValue ? this.formatCurrency(contract.guaranteeValue) : null;
      case 'CAUCAO_VALOR':
        return contract.depositValue ? this.formatCurrency(contract.depositValue) : null;
      case 'FIADOR_DADOS':
        return contract.guarantorData || null;
      case 'SEGURO_FIANCA_DADOS':
        return contract.bailInsuranceData || null;
      case 'TITULO_CAPITALIZACAO':
        return contract.capitalizationBondData || null;
      case 'CARTA_FIANCA_BANCARIA':
        return contract.bankGuaranteeLetterData || null;

      // Contract Terms
      case 'TIPO_RENOVACAO':
        return contract.renewalType || 'Automática por igual período';
      case 'AUTORIZACAO_BENFEITORIAS':
        return contract.improvementsAuthorization || 'Mediante autorização prévia por escrito';
      case 'LIMITE_BENFEITORIAS':
        return contract.improvementsLimit ? this.formatCurrency(contract.improvementsLimit) : 'R$ 5.000,00';
      case 'INDICE_CORRECAO':
        return contract.correctionIndex || contract.readjustmentIndex || 'IGPM';
      case 'MULTA_INFRACAO':
        return contract.infractionPenaltyPercent?.toString() || '20';
      case 'DIAS_INADIMPLENCIA':
        return contract.defaultDays?.toString() || '30';
      case 'DIAS_PREFERENCIA':
        return contract.preferenceDays?.toString() || '30';

      // Document Attachments
      case 'ANEXO_GARANTIA':
        return contract.guaranteeAttachment || 'Anexo III - Comprovante de Garantia';
      case 'ANEXO_CONTRATO_SOCIAL':
        return contract.socialContractAttachment || 'Anexo IV - Contrato Social';
      case 'ANEXOS_DOCUMENTOS_REP':
        return contract.representativeDocsAttachment || 'Anexo V - Documentos dos Representantes';
      case 'ANEXO_CERTIDOES':
        return contract.certificatesAttachment || 'Anexo VI - Certidões do Imóvel';
      case 'ANEXO_ALVARA':
        return contract.permitAttachment || 'Anexo VII - Alvará de Funcionamento';

      // Contract 7 - Rural Property Lease Variables
      case 'RENOVACAO_AUTOMATICA':
        return contract.automaticRenewal ? 'Sim' : 'Não';
      case 'PERIODICIDADE_PAGAMENTO':
        return contract.paymentPeriodicity || 'Mensal';
      case 'PLATAFORMA_PAGAMENTO':
        return contract.paymentPlatform || 'Sistema MR3X';

      // Rural Responsibility Variables
      case 'RESP_ITR':
        return contract.itrResponsibility || 'LOCATÁRIA';
      case 'RESP_LICENCAS_AMBIENTAIS':
        return contract.environmentalLicenseResponsibility || 'LOCATÁRIA';
      case 'RESP_CAR':
        return contract.carResponsibility || 'Compartilhada';
      case 'RESP_CCIR':
        return contract.ccirResponsibility || 'LOCADOR';
      case 'RESP_CERCAS':
        return contract.fencesResponsibility || 'LOCATÁRIA';
      case 'RESP_TAXAS_FISCALIZACAO':
        return contract.inspectionFeesResponsibility || 'LOCATÁRIA';
      case 'RESP_SEGURO_RURAL':
        return contract.ruralInsuranceResponsibility || 'LOCATÁRIA';
      case 'RESP_ESTRADAS':
        return contract.roadsResponsibility || 'LOCATÁRIA';
      case 'RESP_INSUMOS':
        return contract.inputsResponsibility || 'LOCATÁRIA';

      // Rural Penalties
      case 'DIAS_ABANDONO':
        return contract.abandonmentDays?.toString() || '60';
      case 'VALOR_MULTA_RESCISAO_EXTENSO':
        return contract.terminationPenaltyWords || this.numberToWords(contract.terminationPenalty);

      // Contract 8 - Residential PJ Variables
      case 'SEGURO_INCENDIO_VALOR':
        return contract.fireInsuranceValue ? this.formatCurrency(contract.fireInsuranceValue) : null;
      case 'SEGURO_INCENDIO_RESPONSAVEL':
        return contract.fireInsuranceResponsibility || 'LOCATÁRIO';

      // Contract 12 - Commercial Lease PF/PJ Variables
      case 'DIREITO_RENOVATORIA':
        return contract.hasRenewalRight !== undefined ? (contract.hasRenewalRight ? 'Sim' : 'Não') : 'Sim';
      case 'TAXAS_FUNCIONAMENTO_RESPONSAVEL':
        return contract.operatingLicenseResponsibility || 'LOCATÁRIO';
      case 'TAXA_LIXO_RESPONSAVEL':
        return contract.wasteResponsibility || 'LOCATÁRIO';
      case 'MULTA_RESCISORIA':
        return contract.terminationPenaltyMonths?.toString() || '3';
      case 'ATIVIDADE_COMERCIAL':
        return contract.commercialActivity || '[atividade comercial a ser definida]';

      // Contract 15 - Rural Lease Variables
      case 'TIPO_IMOVEL_RURAL':
        return contract.ruralPropertyType || contract.property?.ruralType || 'Imóvel Rural';
      case 'FINALIDADE_RURAL':
        return contract.ruralPurpose || '[finalidade rural a ser definida]';
      case 'ATIVIDADES_PERMITIDAS':
        return contract.allowedActivities || '';
      case 'PASTOS_RESPONSAVEL':
        return contract.pastureMaintenanceResponsibility || 'LOCATÁRIO';
      case 'CONSERVACAO_RESPONSAVEL':
        return contract.conservationResponsibility || 'LOCATÁRIO';

      // Contract 16 - Rural Residence Variables
      case 'MANUTENCAO_JARDIM_RESPONSAVEL':
        return contract.gardenMaintenanceResponsibility || 'LOCATÁRIO';

      case 'OCUPANTES_AUTORIZADOS':
        return contract.authorizedOccupants || '[A ser preenchido pela LOCATÁRIA]';
      case 'MULTA_RESCISAO_MESES':
        return contract.terminationPenaltyMonths?.toString() || '3';
      case 'RESP_GAS':
        return contract.gasResponsibility || 'LOCATÁRIA';

      // Contract 9 - Residential PF/PF Variables
      case 'GARANTIA_TIPO':
        return contract.guaranteeType || 'Caução em dinheiro';
      case 'CAUCAO_VALOR_EXTENSO':
        return contract.depositInWords || this.numberToWords(contract.depositValue || contract.deposit);
      case 'CAUCAO_MESES':
        return contract.depositMonths?.toString() || '3';
      case 'CAUCAO_BANCO':
        return contract.depositBank || null;
      case 'CAUCAO_CONTA':
        return contract.depositAccount || null;
      case 'CAUCAO_DATA_DEPOSITO':
        return contract.depositDate ? this.formatDate(contract.depositDate) : null;
      case 'SEGURO_FIANCA_EMPRESA':
        return contract.bailInsuranceCompany || null;
      case 'SEGURO_FIANCA_APOLICE':
        return contract.bailInsurancePolicy || null;
      case 'SEGURO_FIANCA_VIGENCIA':
        return contract.bailInsuranceValidity || null;
      case 'SEGURO_FIANCA_COBERTURA':
        return contract.bailInsuranceCoverage ? this.formatCurrency(contract.bailInsuranceCoverage) : null;
      case 'TITULO_CAP_INSTITUICAO':
        return contract.capitalizationInstitution || null;
      case 'TITULO_CAP_NUMERO':
        return contract.capitalizationNumber || null;
      case 'TITULO_CAP_VALOR':
        return contract.capitalizationValue ? this.formatCurrency(contract.capitalizationValue) : null;
      case 'PRAZO_AGENDAMENTO_VISTORIA':
        return contract.inspectionSchedulingHours?.toString() || '48';
      case 'PRAZO_REPASSE_LOCADOR':
        return contract.ownerTransferDays?.toString() || '5';
      case 'MULTA_ATRASO_PERCENTUAL':
        return contract.lateFeePercent?.toString() || '10';
      case 'JUROS_MORA_PERCENTUAL':
        return contract.interestRatePercent?.toString() || '1';
      case 'TAXA_ADMINISTRACAO_PERCENTUAL':
        return contract.adminFeePercent?.toString() || '10';
      case 'MULTA_INFRACAO_PERCENTUAL':
        return contract.infractionPenaltyPercent?.toString() || '20';
      case 'HONORARIOS_PERCENTUAL':
        return contract.attorneyFeesPercent?.toString() || '20';
      case 'PRAZO_LOCACAO_MESES':
        if (contract.startDate && contract.endDate) {
          const start = new Date(contract.startDate);
          const end = new Date(contract.endDate);
          const months = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
          return months.toString();
        }
        return contract.durationMonths?.toString() || null;
      case 'DATA_INICIO_CONTRATO':
        return contract.startDate ? this.formatDate(contract.startDate) : null;
      case 'DATA_FIM_CONTRATO':
        return contract.endDate ? this.formatDate(contract.endDate) : null;
      case 'RESP_LUZ':
        return contract.electricityResponsibility || 'LOCATÁRIO';
      case 'RESP_TAXA_INCENDIO':
        return contract.fireInsuranceResponsibility || 'LOCATÁRIO';
      case 'FORO_CIDADE':
        return contract.jurisdictionCity || contract.property?.city || null;
      case 'FORO_ESTADO':
        return contract.jurisdictionState || contract.property?.state || null;
      case 'ANEXO_DOCS_LOCADOR':
        return contract.ownerDocsAttachment || 'Anexo - Documentos do Locador';
      case 'ANEXO_DOCS_LOCATARIO':
        return contract.tenantDocsAttachment || 'Anexo - Documentos do Locatário';
      case 'ANEXO_DOCS_IMOVEL':
        return contract.propertyDocsAttachment || 'Anexo - Documentos do Imóvel';
      case 'ANEXO_CONVENCAO_CONDOMINIO':
        return contract.condoConventionAttachment || 'Anexo - Convenção do Condomínio';

      // Contract 11 - Standard Residential Lease 2019 Variables
      case 'FINALIDADE_ESPECIAL':
        return contract.specialPurpose || null;
      case 'AGUA_RESPONSAVEL':
        return contract.waterResponsibility || 'LOCATÁRIO';
      case 'ENERGIA_RESPONSAVEL':
        return contract.electricityResponsibility || 'LOCATÁRIO';
      case 'GAS_RESPONSAVEL':
        return contract.gasResponsibility || 'LOCATÁRIO';
      case 'CONDOMINIO_RESPONSAVEL':
        return contract.condominiumResponsibility || 'LOCATÁRIO';
      case 'IPTU_RESPONSAVEL':
        return contract.iptuResponsibility || 'LOCATÁRIO';
      case 'FORMA_PAGAMENTO':
        return contract.paymentMethod || 'Depósito bancário ou PIX';
      case 'USO_IMOBILIARIA':
        return contract.usesAgency ? 'Sim' : 'Não';
      case 'DADOS_BANCARIOS':
        if (contract.bankData) return contract.bankData;
        const bankParts = [
          contract.bank && `Banco: ${contract.bank}`,
          contract.bankAgency && `Ag: ${contract.bankAgency}`,
          contract.bankAccount && `Conta: ${contract.bankAccount}`,
          contract.pixKey && `PIX: ${contract.pixKey}`
        ].filter(Boolean);
        return bankParts.length > 0 ? bankParts.join(' | ') : null;
      case 'VALOR_GARANTIA_EXTENSO':
        return contract.guaranteeValueInWords || this.numberToWords(contract.guaranteeValue);
      case 'GARANTIA_DADOS':
        return contract.guaranteeDetails || contract.guaranteeData || null;

      default:
        return null;
    }
  }

  /**
   * Convert number to words in Portuguese
   */
  private numberToWords(value: number | string | null): string | null {
    if (value === null || value === undefined) return null;
    const num = typeof value === 'string' ? parseFloat(value) : value;

    // Basic implementation for common rental values
    const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
    const teens = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
    const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

    if (num === 0) return 'zero reais';
    if (num === 100) return 'cem reais';

    const intPart = Math.floor(num);
    const decPart = Math.round((num - intPart) * 100);

    let result = '';

    // Thousands
    if (intPart >= 1000) {
      const thousands = Math.floor(intPart / 1000);
      if (thousands === 1) {
        result += 'mil';
      } else if (thousands < 10) {
        result += units[thousands] + ' mil';
      } else {
        result += thousands + ' mil';
      }
    }

    // Hundreds
    const remainder = intPart % 1000;
    if (remainder >= 100) {
      if (result) result += ' ';
      if (remainder === 100) {
        result += 'cem';
      } else {
        result += hundreds[Math.floor(remainder / 100)];
      }
    }

    // Tens and units
    const tensAndUnits = remainder % 100;
    if (tensAndUnits > 0) {
      if (result) result += ' e ';
      if (tensAndUnits < 10) {
        result += units[tensAndUnits];
      } else if (tensAndUnits < 20) {
        result += teens[tensAndUnits - 10];
      } else {
        result += tens[Math.floor(tensAndUnits / 10)];
        if (tensAndUnits % 10 > 0) {
          result += ' e ' + units[tensAndUnits % 10];
        }
      }
    }

    result += intPart === 1 ? ' real' : ' reais';

    // Cents
    if (decPart > 0) {
      result += ' e ';
      if (decPart < 10) {
        result += units[decPart];
      } else if (decPart < 20) {
        result += teens[decPart - 10];
      } else {
        result += tens[Math.floor(decPart / 10)];
        if (decPart % 10 > 0) {
          result += ' e ' + units[decPart % 10];
        }
      }
      result += decPart === 1 ? ' centavo' : ' centavos';
    }

    return result;
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

  private formatTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('pt-BR', {
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
      // Digital Signature System Variables for Contract 3
      case 'HASH_DOCUMENTO':
        return context.contract?.contractHash || context.contract?.hashFinal || '[Hash será gerado após assinatura]';
      case 'IP_IMOBILIARIA':
        return context.contract?.agencySignedIP || '[IP registrado na assinatura]';
      case 'IP_LOCADOR':
        return context.contract?.ownerSignedIP || '[IP registrado na assinatura]';
      case 'DATA_ASS_IMOBILIARIA':
        return context.contract?.agencySignedAt ? this.formatDateTime(context.contract.agencySignedAt) : '[Data de assinatura]';
      case 'DATA_ASS_LOCADOR':
        return context.contract?.ownerSignedAt ? this.formatDateTime(context.contract.ownerSignedAt) : '[Data de assinatura]';
      case 'DATA_ASS_LOCATARIO':
        return context.contract?.tenantSignedAt ? this.formatDateTime(context.contract.tenantSignedAt) : '[Data de assinatura]';
      // Fiador Signature Variables
      case 'DATA_ASS_FIADOR':
        return context.contract?.guarantorSignedAt ? this.formatDateTime(context.contract.guarantorSignedAt) : '[Data de assinatura]';
      case 'IP_FIADOR':
        return context.contract?.guarantorSignedIP || '[IP registrado na assinatura]';
      // Timestamp
      case 'DATA_HORA_REGISTRO':
        return context.contract?.createdAt ? this.formatDateTime(context.contract.createdAt) : this.formatDateTime(new Date());
      // Contract 9 - Residential PF/PF System Variables
      // Geolocation Variables
      case 'GEO_IMOBILIARIA':
        return context.contract?.agencySignedGeo || '[Geolocalização registrada na assinatura]';
      case 'GEO_LOCADOR':
        return context.contract?.ownerSignedGeo || '[Geolocalização registrada na assinatura]';
      case 'GEO_LOCATARIO':
        return context.contract?.tenantSignedGeo || '[Geolocalização registrada na assinatura]';
      // Tenant IP
      case 'IP_LOCATARIO':
        return context.contract?.tenantSignedIP || '[IP registrado na assinatura]';
      // Signature Time Variables
      case 'HORA_ASS_LOCADOR':
        return context.contract?.ownerSignedAt ? this.formatTime(context.contract.ownerSignedAt) : '[Hora de assinatura]';
      case 'HORA_ASS_LOCATARIO':
        return context.contract?.tenantSignedAt ? this.formatTime(context.contract.tenantSignedAt) : '[Hora de assinatura]';
      case 'HORA_ASS_IMOBILIARIA':
        return context.contract?.agencySignedAt ? this.formatTime(context.contract.agencySignedAt) : '[Hora de assinatura]';
      // Spouse Signature Variables
      case 'DATA_ASS_CONJUGE_LOCATARIO':
        return context.contract?.spouseSignedAt ? this.formatDateTime(context.contract.spouseSignedAt) : '[Data de assinatura]';
      case 'HORA_ASS_CONJUGE_LOCATARIO':
        return context.contract?.spouseSignedAt ? this.formatTime(context.contract.spouseSignedAt) : '[Hora de assinatura]';
      // Witness Signature Variables
      case 'DATA_ASS_TESTEMUNHA1':
        return context.contract?.witness1SignedAt ? this.formatDateTime(context.contract.witness1SignedAt) : '[Data de assinatura]';
      case 'DATA_ASS_TESTEMUNHA2':
        return context.contract?.witness2SignedAt ? this.formatDateTime(context.contract.witness2SignedAt) : '[Data de assinatura]';
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
