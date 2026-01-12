import { Injectable } from '@nestjs/common';

export enum MessageChannel {
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
  EMAIL = 'EMAIL',
}

export enum TenantType {
  INDIVIDUAL = 'INDIVIDUAL', // PF
  BUSINESS = 'BUSINESS', // PJ
}

export enum ReminderStage {
  PRE_DUE_7_DAYS = 'PRE_DUE_7_DAYS',
  PRE_DUE_3_DAYS = 'PRE_DUE_3_DAYS',
  DUE_TODAY = 'DUE_TODAY',
  POST_DUE_1_DAY = 'POST_DUE_1_DAY',
  POST_DUE_3_DAYS = 'POST_DUE_3_DAYS',
  POST_DUE_7_DAYS = 'POST_DUE_7_DAYS',
}

@Injectable()
export class PaymentReminderTemplateService {
  /**
   * Get message template based on stage, channel, and tenant type
   */
  getTemplate(
    stage: ReminderStage,
    channel: MessageChannel,
    tenantType: TenantType = TenantType.INDIVIDUAL,
  ): string {
    const templates = this.getTemplates(tenantType);

    const channelTemplates = templates[stage];
    if (!channelTemplates) {
      return '';
    }

    return channelTemplates[channel] || '';
  }

  /**
   * Get all templates for a tenant type
   */
  private getTemplates(tenantType: TenantType): Record<
    ReminderStage,
    Record<MessageChannel, string>
  > {
    if (tenantType === TenantType.BUSINESS) {
      return this.getBusinessTemplates();
    }

    return this.getIndividualTemplates();
  }

  /**
   * Templates for Individual (PF) tenants - Aggressive Expire D version
   */
  private getIndividualTemplates(): Record<
    ReminderStage,
    Record<MessageChannel, string>
  > {
    return {
      [ReminderStage.PRE_DUE_7_DAYS]: {
        [MessageChannel.SMS]: '[NOME], seu aluguel vence em 7 dias.\nEvite problemas: pague agora → [LINK]',
        [MessageChannel.WHATSAPP]: 'Olá [NOME], seu aluguel vence em 7 dias.\nEvite problemas: pague agora → [LINK]',
        [MessageChannel.EMAIL]: this.getEmailTemplate(
          'Seu aluguel vence em 7 dias',
          '[NOME], seu aluguel vence em 7 dias.\n\nEvite problemas: pague agora → [LINK]',
        ),
      },
      [ReminderStage.PRE_DUE_3_DAYS]: {
        [MessageChannel.SMS]: 'Faltam 3 dias.\nAtraso gera multa imediata.\nPague agora: [LINK]',
        [MessageChannel.WHATSAPP]: 'Faltam 3 dias para o vencimento.\nAtraso gera multa imediata.\nPague agora: [LINK]',
        [MessageChannel.EMAIL]: this.getEmailTemplate(
          'Faltam 3 dias para o vencimento',
          'Faltam 3 dias.\n\nAtraso gera multa imediata.\n\nPague agora: [LINK]',
        ),
      },
      [ReminderStage.DUE_TODAY]: {
        [MessageChannel.SMS]: 'VENCE HOJE.\nApós 23h59 multa e juros serão aplicados.\nPague já: [LINK]',
        [MessageChannel.WHATSAPP]: 'VENCE HOJE!\nApós 23h59 multa e juros serão aplicados.\nPague já: [LINK]',
        [MessageChannel.EMAIL]: this.getEmailTemplate(
          'VENCE HOJE - Ação imediata necessária',
          'VENCE HOJE.\n\nApós 23h59 multa e juros serão aplicados.\n\nPague já: [LINK]',
        ),
      },
      [ReminderStage.POST_DUE_1_DAY]: {
        [MessageChannel.SMS]: 'ALUGUEL VENCIDO.\nValor atualizado.\nRegularize agora: [LINK]',
        [MessageChannel.WHATSAPP]: 'Seu aluguel está vencido.\nValor atualizado com multa.\nRegularize agora: [LINK]',
        [MessageChannel.EMAIL]: this.getEmailTemplate(
          'Aluguel vencido - Regularização necessária',
          'ALUGUEL VENCIDO.\n\nValor atualizado com multa.\n\nRegularize agora: [LINK]',
        ),
      },
      [ReminderStage.POST_DUE_3_DAYS]: {
        [MessageChannel.SMS]: '3 DIAS DE ATRASO.\nJuros aumentando diariamente.\nPague imediatamente: [LINK]',
        [MessageChannel.WHATSAPP]: '3 dias de atraso.\nJuros aumentando diariamente.\nPague imediatamente: [LINK]',
        [MessageChannel.EMAIL]: this.getEmailTemplate(
          '3 dias de atraso - Juros acumulando',
          '3 DIAS DE ATRASO.\n\nJuros aumentando diariamente.\n\nPague imediatamente: [LINK]',
        ),
      },
      [ReminderStage.POST_DUE_7_DAYS]: {
        [MessageChannel.SMS]: 'ÚLTIMO AVISO.\nEncaminhamento administrativo será iniciado hoje.\nQuitação imediata: [LINK]',
        [MessageChannel.WHATSAPP]: 'ÚLTIMO AVISO.\nEncaminhamento administrativo será iniciado hoje.\nQuitação imediata: [LINK]',
        [MessageChannel.EMAIL]: this.getEmailTemplate(
          'Último aviso - Encaminhamento administrativo',
          'ÚLTIMO AVISO.\n\nEncaminhamento administrativo será iniciado hoje.\n\nQuitação imediata: [LINK]',
        ),
      },
    };
  }

  /**
   * Templates for Business (PJ) tenants - More formal version
   */
  private getBusinessTemplates(): Record<
    ReminderStage,
    Record<MessageChannel, string>
  > {
    return {
      [ReminderStage.PRE_DUE_7_DAYS]: {
        [MessageChannel.SMS]: 'Aluguel vence em 7 dias.\nProgramar pagamento: [LINK]',
        [MessageChannel.WHATSAPP]: 'Aluguel vence em 7 dias.\nProgramar pagamento: [LINK]',
        [MessageChannel.EMAIL]: this.getEmailTemplate(
          'Aluguel vence em 7 dias',
          'Aluguel vence em 7 dias.\n\nProgramar pagamento: [LINK]',
        ),
      },
      [ReminderStage.PRE_DUE_3_DAYS]: {
        [MessageChannel.SMS]: 'Restam 3 dias.\nAtraso gera multa automática.\nPague: [LINK]',
        [MessageChannel.WHATSAPP]: 'Restam 3 dias para o vencimento.\nAtraso gera multa automática.\nPague: [LINK]',
        [MessageChannel.EMAIL]: this.getEmailTemplate(
          'Restam 3 dias para o vencimento',
          'Restam 3 dias.\n\nAtraso gera multa automática.\n\nPague: [LINK]',
        ),
      },
      [ReminderStage.DUE_TODAY]: {
        [MessageChannel.SMS]: 'Vence hoje.\nEvitar encargos: [LINK]',
        [MessageChannel.WHATSAPP]: 'Vence hoje.\nEvitar encargos: [LINK]',
        [MessageChannel.EMAIL]: this.getEmailTemplate(
          'Vence hoje',
          'Vence hoje.\n\nEvitar encargos: [LINK]',
        ),
      },
      [ReminderStage.POST_DUE_1_DAY]: {
        [MessageChannel.SMS]: 'Débito vencido.\nRegularização imediata necessária: [LINK]',
        [MessageChannel.WHATSAPP]: 'Débito vencido.\nRegularização imediata necessária: [LINK]',
        [MessageChannel.EMAIL]: this.getEmailTemplate(
          'Débito vencido',
          'Débito vencido.\n\nRegularização imediata necessária: [LINK]',
        ),
      },
      [ReminderStage.POST_DUE_3_DAYS]: {
        [MessageChannel.SMS]: 'Débito continua aberto.\nJuros diários.\n[LINK]',
        [MessageChannel.WHATSAPP]: 'Débito continua aberto.\nJuros diários.\n[LINK]',
        [MessageChannel.EMAIL]: this.getEmailTemplate(
          'Débito em aberto - Juros diários',
          'Débito continua aberto.\n\nJuros diários.\n\n[LINK]',
        ),
      },
      [ReminderStage.POST_DUE_7_DAYS]: {
        [MessageChannel.SMS]: 'Último aviso antes de medidas formais.\n[LINK]',
        [MessageChannel.WHATSAPP]: 'Último aviso antes de medidas formais.\n[LINK]',
        [MessageChannel.EMAIL]: this.getEmailTemplate(
          'Último aviso - Medidas formais',
          'Último aviso antes de medidas formais.\n\n[LINK]',
        ),
      },
    };
  }

  /**
   * Generate full email template with header and footer
   */
  private getEmailTemplate(subject: string, body: string): string {
    return `
ASSUNTO: ${subject}

${body}

---
Valor: [VALOR_ALUGUEL]
Vencimento: [DATA_VENCIMENTO]
Referência: [MES_REFERENCIA]

Link para pagamento: [LINK]

---
MR3X - Gestão de Aluguéis
Este é um e-mail automático. Por favor, não responda.

MR3X é uma plataforma de tecnologia para gestão de aluguéis e não presta serviços jurídicos, advocatícios ou de intermediação judicial.
    `.trim();
  }

  /**
   * Get owner notification template
   */
  getOwnerTemplate(stage: ReminderStage): string {
    const templates: Record<ReminderStage, string> = {
      [ReminderStage.PRE_DUE_7_DAYS]: 'Aluguel vence em 7 dias. Acompanhando.',
      [ReminderStage.DUE_TODAY]: 'Aguardando pagamento do inquilino.',
      [ReminderStage.POST_DUE_1_DAY]: 'Inquilino em atraso. Ações automáticas iniciadas.',
      [ReminderStage.POST_DUE_7_DAYS]: 'Procedimentos administrativos serão sugeridos.',
      [ReminderStage.PRE_DUE_3_DAYS]: 'Aluguel vence em 3 dias. Acompanhando.',
      [ReminderStage.POST_DUE_3_DAYS]: 'Inquilino em atraso há 3 dias. Monitorando.',
    };

    return templates[stage] || '';
  }
}

