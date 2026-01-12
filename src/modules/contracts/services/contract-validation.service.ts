import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@config/prisma.service';

export interface RequiredContractField {
  field: string;
  label: string;
  category: 'financial' | 'temporal' | 'parties' | 'property' | 'legal';
  description: string;
  legalBasis?: string;
}

export interface ValidationError {
  field: string;
  label: string;
  message: string;
  category: string;
}

export interface ContractValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  checkedFields: number;
  passedFields: number;
  score: number;
}

export interface ValidationWarning {
  field: string;
  label: string;
  message: string;
  recommendation: string;
}

@Injectable()
export class ContractValidationService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly requiredFields: RequiredContractField[] = [
    {
      field: 'monthlyRent',
      label: 'Valor do Aluguel',
      category: 'financial',
      description: 'Valor mensal do aluguel em reais',
      legalBasis: 'Art. 17 - O locador não poderá cobrar antecipadamente o aluguel',
    },
    {
      field: 'dueDay',
      label: 'Dia de Vencimento',
      category: 'financial',
      description: 'Dia do mês para vencimento do aluguel',
      legalBasis: 'Art. 23, I - O locatário é obrigado a pagar pontualmente o aluguel',
    },
    {
      field: 'readjustmentIndex',
      label: 'Índice de Reajuste',
      category: 'financial',
      description: 'Índice econômico para reajuste anual (IGPM, IPCA, INPC, etc.)',
      legalBasis: 'Art. 17 - O aluguel pode ser livremente convencionado, vedada sua estipulação em moeda estrangeira',
    },
    {
      field: 'lateFeePercent',
      label: 'Multa por Atraso',
      category: 'financial',
      description: 'Percentual de multa por atraso no pagamento (máximo 10%)',
      legalBasis: 'Art. 413 do Código Civil - A penalidade deve ser reduzida equitativamente',
    },
    {
      field: 'interestRatePercent',
      label: 'Juros de Mora',
      category: 'financial',
      description: 'Percentual de juros moratórios ao mês (máximo 1%)',
      legalBasis: 'Art. 406 do Código Civil - Taxa legal de juros moratórios',
    },

    {
      field: 'startDate',
      label: 'Data de Início',
      category: 'temporal',
      description: 'Data de início da vigência do contrato',
      legalBasis: 'Art. 3º - O contrato de locação pode ser ajustado por qualquer prazo',
    },
    {
      field: 'endDate',
      label: 'Data de Término',
      category: 'temporal',
      description: 'Data de término da vigência do contrato',
      legalBasis: 'Art. 3º - Dependendo da vontade das partes',
    },

    {
      field: 'tenantId',
      label: 'Locatário',
      category: 'parties',
      description: 'Identificação do locatário (inquilino)',
      legalBasis: 'Art. 1º - A locação de imóvel urbano regula-se pelo disposto nesta Lei',
    },
    {
      field: 'ownerId',
      label: 'Locador',
      category: 'parties',
      description: 'Identificação do locador (proprietário)',
      legalBasis: 'Art. 1º - A locação de imóvel urbano regula-se pelo disposto nesta Lei',
    },

    {
      field: 'propertyId',
      label: 'Imóvel',
      category: 'property',
      description: 'Identificação do imóvel objeto da locação',
      legalBasis: 'Art. 1º - Objeto da locação é o imóvel urbano',
    },

    {
      field: 'earlyTerminationPenaltyPercent',
      label: 'Multa por Rescisão Antecipada',
      category: 'legal',
      description: 'Penalidade proporcional ao tempo restante do contrato',
      legalBasis: 'Art. 4º - Durante o prazo, o locatário não poderá devolver o imóvel senão pagando multa pactuada',
    },
    {
      field: 'creci',
      label: 'CRECI do Corretor',
      category: 'legal',
      description: 'Número de registro no Conselho Regional de Corretores de Imóveis',
      legalBasis: 'Lei 6.530/78 - Somente corretores inscritos no CRECI podem intermediar transações imobiliárias',
    },
  ];

  private readonly validIndexes = [
    'IGPM',
    'IPCA',
    'INPC',
    'SELIC',
    'CDI',
    'IPC',
    'IGP-DI',
  ];

  async validateContract(contractId: bigint): Promise<ContractValidationResult> {
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

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let passedFields = 0;

    for (const field of this.requiredFields) {
      const value = this.getFieldValue(contract, field.field);
      const validation = this.validateField(field, value, contract);

      if (validation.error) {
        errors.push(validation.error);
      } else {
        passedFields++;
      }

      if (validation.warning) {
        warnings.push(validation.warning);
      }
    }

    const additionalValidations = await this.performAdditionalValidations(contract);
    errors.push(...additionalValidations.errors);
    warnings.push(...additionalValidations.warnings);

    const checkedFields = this.requiredFields.length;
    const score = Math.round((passedFields / checkedFields) * 100);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      checkedFields,
      passedFields,
      score,
    };
  }

  private getFieldValue(contract: any, field: string): any {
    return contract[field];
  }

  private validateField(
    field: RequiredContractField,
    value: any,
    contract: any,
  ): { error: ValidationError | null; warning: ValidationWarning | null } {
    let error: ValidationError | null = null;
    let warning: ValidationWarning | null = null;

    if (value === null || value === undefined || value === '') {
      error = {
        field: field.field,
        label: field.label,
        message: `Campo obrigatório não preenchido: ${field.label}`,
        category: field.category,
      };
      return { error, warning };
    }

    switch (field.field) {
      case 'monthlyRent':
        const rent = Number(value);
        if (isNaN(rent) || rent <= 0) {
          error = {
            field: field.field,
            label: field.label,
            message: 'O valor do aluguel deve ser maior que zero',
            category: field.category,
          };
        } else if (rent < 100) {
          warning = {
            field: field.field,
            label: field.label,
            message: 'Valor do aluguel muito baixo',
            recommendation: 'Verifique se o valor está correto',
          };
        }
        break;

      case 'dueDay':
        const day = Number(value);
        if (isNaN(day) || day < 1 || day > 31) {
          error = {
            field: field.field,
            label: field.label,
            message: 'O dia de vencimento deve estar entre 1 e 31',
            category: field.category,
          };
        } else if (day > 28) {
          warning = {
            field: field.field,
            label: field.label,
            message: 'Dia de vencimento pode não existir em todos os meses',
            recommendation: 'Considere usar dia 28 ou anterior para evitar problemas em fevereiro',
          };
        }
        break;

      case 'readjustmentIndex':
        if (!this.validIndexes.includes(value.toUpperCase())) {
          warning = {
            field: field.field,
            label: field.label,
            message: `Índice "${value}" não é um dos índices padrão`,
            recommendation: `Recomenda-se usar: ${this.validIndexes.join(', ')}`,
          };
        }
        break;

      case 'lateFeePercent':
        const lateFee = Number(value);
        if (isNaN(lateFee) || lateFee < 0) {
          error = {
            field: field.field,
            label: field.label,
            message: 'A multa por atraso deve ser um valor válido',
            category: field.category,
          };
        } else if (lateFee > 10) {
          warning = {
            field: field.field,
            label: field.label,
            message: 'Multa superior a 10% pode ser considerada abusiva',
            recommendation: 'Art. 413 CC - A penalidade deve ser reduzida equitativamente pelo juiz',
          };
        }
        break;

      case 'interestRatePercent':
        const interest = Number(value);
        if (isNaN(interest) || interest < 0) {
          error = {
            field: field.field,
            label: field.label,
            message: 'Os juros de mora devem ser um valor válido',
            category: field.category,
          };
        } else if (interest > 1) {
          warning = {
            field: field.field,
            label: field.label,
            message: 'Juros superiores a 1% ao mês podem ser considerados usura',
            recommendation: 'Art. 406 CC - Taxa legal de juros é de 1% ao mês',
          };
        }
        break;

      case 'startDate':
      case 'endDate':
        if (!(value instanceof Date) && isNaN(new Date(value).getTime())) {
          error = {
            field: field.field,
            label: field.label,
            message: `Data inválida para ${field.label}`,
            category: field.category,
          };
        }
        break;

      case 'earlyTerminationPenaltyPercent':
        const penalty = Number(value);
        if (isNaN(penalty) || penalty < 0) {
          error = {
            field: field.field,
            label: field.label,
            message: 'A multa por rescisão deve ser um valor válido',
            category: field.category,
          };
        } else if (penalty > 3) {
          warning = {
            field: field.field,
            label: field.label,
            message: 'Multa de rescisão superior a 3 aluguéis pode ser considerada abusiva',
            recommendation: 'Art. 4º Lei 8.245/91 - A multa deve ser proporcional ao prazo restante',
          };
        }
        break;

      case 'creci':
        const creciStr = String(value).trim();
        const creciRegex = /^(CRECI[\/\-]?)?([A-Z]{2})\s*[\-\/]?\s*(\d{3,6})([\-\/]?[FJ])?$/i;
        if (!creciRegex.test(creciStr) && !/^\d{3,6}[\/\-]?[A-Z]{2}$/i.test(creciStr)) {
          warning = {
            field: field.field,
            label: field.label,
            message: 'Formato do CRECI pode estar incorreto',
            recommendation: 'Use o formato: CRECI/XX 12345 ou XX-12345 (ex: CRECI/SP 12345)',
          };
        }
        break;
    }

    return { error, warning };
  }

  private async performAdditionalValidations(contract: any): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (contract.startDate && contract.endDate) {
      const start = new Date(contract.startDate);
      const end = new Date(contract.endDate);

      if (end <= start) {
        errors.push({
          field: 'endDate',
          label: 'Data de Término',
          message: 'A data de término deve ser posterior à data de início',
          category: 'temporal',
        });
      }

      const durationMonths = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
      if (durationMonths < 12) {
        warnings.push({
          field: 'duration',
          label: 'Duração do Contrato',
          message: 'Contratos com menos de 12 meses têm proteção reduzida',
          recommendation: 'Art. 47 Lei 8.245/91 - Contratos de 30+ meses oferecem mais segurança ao locatário',
        });
      }
    }

    if (contract.tenantUser) {
      if (!contract.tenantUser.document) {
        warnings.push({
          field: 'tenantDocument',
          label: 'Documento do Locatário',
          message: 'Locatário sem CPF/CNPJ cadastrado',
          recommendation: 'O CPF/CNPJ é essencial para validade jurídica do contrato',
        });
      }
      if (!contract.tenantUser.email) {
        warnings.push({
          field: 'tenantEmail',
          label: 'E-mail do Locatário',
          message: 'Locatário sem e-mail cadastrado',
          recommendation: 'O e-mail é necessário para notificações e assinatura digital',
        });
      }
    }

    if (contract.ownerUser) {
      if (!contract.ownerUser.document) {
        warnings.push({
          field: 'ownerDocument',
          label: 'Documento do Locador',
          message: 'Locador sem CPF/CNPJ cadastrado',
          recommendation: 'O CPF/CNPJ é essencial para validade jurídica do contrato',
        });
      }
    }

    if (contract.property) {
      if (!contract.property.address || !contract.property.city) {
        errors.push({
          field: 'propertyAddress',
          label: 'Endereço do Imóvel',
          message: 'O endereço completo do imóvel é obrigatório',
          category: 'property',
        });
      }
    }

    if (contract.deposit) {
      const deposit = Number(contract.deposit);
      const rent = Number(contract.monthlyRent);
      if (deposit > rent * 3) {
        warnings.push({
          field: 'deposit',
          label: 'Valor da Caução',
          message: 'Caução superior a 3 aluguéis pode ser considerada abusiva',
          recommendation: 'Art. 38 Lei 8.245/91 - A caução não pode exceder 3 meses de aluguel',
        });
      }
    }

    // CRECI is required only for brokers, not for independent owners
    // Check if the contract creator is a broker or if there's an agency involved
    const isBrokerContract = contract.agencyId !== null && contract.agencyId !== undefined;
    const isIndependentOwner = contract.ownerUser?.role === 'INDEPENDENT_OWNER';
    
    if (!contract.creci) {
      if (isIndependentOwner && !isBrokerContract) {
        // Independent owners don't need CRECI - they have direct contract with MR3X (CEO)
        // No error or warning needed
      } else if (contract.agency && contract.agency.creci) {
        warnings.push({
          field: 'creci',
          label: 'CRECI do Corretor',
          message: 'Usando CRECI da imobiliária',
          recommendation: 'Recomenda-se informar o CRECI do corretor responsável pelo contrato',
        });
      } else if (isBrokerContract) {
        // CRECI is required for broker contracts
        errors.push({
          field: 'creci',
          label: 'CRECI do Corretor',
          message: 'O CRECI do corretor é obrigatório para validade do contrato quando há intermediação imobiliária',
          category: 'legal',
        });
      }
    }

    if (contract.tenantUser && !contract.tenantUser.document) {
      errors.push({
        field: 'tenantDocument',
        label: 'CPF/CNPJ do Locatário',
        message: 'O CPF ou CNPJ do locatário é obrigatório para validade jurídica',
        category: 'parties',
      });
    }

    if (contract.ownerUser && !contract.ownerUser.document) {
      errors.push({
        field: 'ownerDocument',
        label: 'CPF/CNPJ do Locador',
        message: 'O CPF ou CNPJ do locador é obrigatório para validade jurídica',
        category: 'parties',
      });
    }

    return { errors, warnings };
  }

  async isContractValid(contractId: bigint): Promise<boolean> {
    const result = await this.validateContract(contractId);
    return result.valid;
  }

  async getValidationSummary(contractId: bigint): Promise<{
    isValid: boolean;
    score: number;
    errorCount: number;
    warningCount: number;
    categories: Record<string, { errors: number; warnings: number }>;
  }> {
    const result = await this.validateContract(contractId);

    const categories: Record<string, { errors: number; warnings: number }> = {
      financial: { errors: 0, warnings: 0 },
      temporal: { errors: 0, warnings: 0 },
      parties: { errors: 0, warnings: 0 },
      property: { errors: 0, warnings: 0 },
      legal: { errors: 0, warnings: 0 },
    };

    for (const error of result.errors) {
      if (categories[error.category]) {
        categories[error.category].errors++;
      }
    }

    for (const warning of result.warnings) {
      const field = warning.field;
      if (field.includes('rent') || field.includes('fee') || field.includes('deposit') || field.includes('interest')) {
        categories.financial.warnings++;
      } else if (field.includes('date') || field.includes('duration')) {
        categories.temporal.warnings++;
      } else if (field.includes('tenant') || field.includes('owner')) {
        categories.parties.warnings++;
      } else if (field.includes('property')) {
        categories.property.warnings++;
      } else {
        categories.legal.warnings++;
      }
    }

    return {
      isValid: result.valid,
      score: result.score,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
      categories,
    };
  }

  getValidIndexes(): string[] {
    return this.validIndexes;
  }

  getRequiredFields(): RequiredContractField[] {
    return this.requiredFields;
  }
}
