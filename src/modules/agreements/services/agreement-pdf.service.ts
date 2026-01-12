import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface AgreementData {
  id: string;
  agreementToken: string;
  type: string;
  title: string;
  description?: string;
  content?: string;
  status: string;
  originalAmount?: number;
  negotiatedAmount?: number;
  fineAmount?: number;
  discountAmount?: number;
  installments?: number;
  installmentValue?: number;
  effectiveDate?: Date;
  expirationDate?: Date;
  newDueDate?: Date;
  moveOutDate?: Date;
  property: {
    address: string;
    city: string;
    neighborhood: string;
    name?: string;
  };
  tenant?: {
    name: string;
    document: string;
    email?: string;
  };
  owner?: {
    name: string;
    document: string;
    email?: string;
  };
  contract?: {
    id: string;
    startDate: Date;
    endDate: Date;
  };
  signatures?: {
    tenant?: { signedAt: Date; ip?: string; lat?: number; lng?: number };
    owner?: { signedAt: Date; ip?: string; lat?: number; lng?: number };
    agency?: { signedAt: Date; ip?: string; lat?: number; lng?: number };
  };
}

@Injectable()
export class AgreementPdfService {
  private readonly uploadsDir: string;

  constructor(private readonly prisma: PrismaService) {
    this.uploadsDir = path.join(process.cwd(), 'uploads', 'agreements');
    this.ensureDirectoryExists(path.join(this.uploadsDir, 'final'));
  }

  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private generateHash(content: Buffer): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  private formatDate(date: Date | null | undefined): string {
    if (!date) return '-';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(date));
  }

  private formatDateTime(date: Date | null | undefined): string {
    if (!date) return '-';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  }

  async getAgreementData(agreementId: bigint): Promise<AgreementData> {
    const agreement = await this.prisma.agreement.findUnique({
      where: { id: agreementId },
      include: {
        property: {
          select: {
            address: true,
            city: true,
            neighborhood: true,
            name: true,
          },
        },
        tenant: {
          select: {
            name: true,
            document: true,
            email: true,
          },
        },
        owner: {
          select: {
            name: true,
            document: true,
            email: true,
          },
        },
        contract: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    if (!agreement) {
      throw new NotFoundException('Agreement not found');
    }

    return {
      id: agreement.id.toString(),
      agreementToken: agreement.agreementToken || '',
      type: agreement.type,
      title: agreement.title,
      description: agreement.description || undefined,
      content: agreement.content || undefined,
      status: agreement.status,
      originalAmount: agreement.originalAmount ? Number(agreement.originalAmount) : undefined,
      negotiatedAmount: agreement.negotiatedAmount ? Number(agreement.negotiatedAmount) : undefined,
      fineAmount: agreement.fineAmount ? Number(agreement.fineAmount) : undefined,
      discountAmount: agreement.discountAmount ? Number(agreement.discountAmount) : undefined,
      installments: agreement.installments || undefined,
      installmentValue: agreement.installmentValue ? Number(agreement.installmentValue) : undefined,
      effectiveDate: agreement.effectiveDate || undefined,
      expirationDate: agreement.expirationDate || undefined,
      newDueDate: agreement.newDueDate || undefined,
      moveOutDate: agreement.moveOutDate || undefined,
      property: {
        address: agreement.property.address,
        city: agreement.property.city,
        neighborhood: agreement.property.neighborhood,
        name: agreement.property.name || undefined,
      },
      tenant: agreement.tenant
        ? {
            name: agreement.tenant.name || '',
            document: agreement.tenant.document || '',
            email: agreement.tenant.email || undefined,
          }
        : undefined,
      owner: agreement.owner
        ? {
            name: agreement.owner.name || '',
            document: agreement.owner.document || '',
            email: agreement.owner.email || undefined,
          }
        : undefined,
      contract: agreement.contract
        ? {
            id: agreement.contract.id.toString(),
            startDate: agreement.contract.startDate,
            endDate: agreement.contract.endDate,
          }
        : undefined,
      signatures: {
        tenant: agreement.tenantSignedAt
          ? {
              signedAt: agreement.tenantSignedAt,
              ip: agreement.clientIP || undefined,
              lat: undefined,
              lng: undefined,
            }
          : undefined,
        owner: agreement.ownerSignedAt
          ? {
              signedAt: agreement.ownerSignedAt,
              ip: agreement.clientIP || undefined,
              lat: undefined,
              lng: undefined,
            }
          : undefined,
        agency: agreement.agencySignedAt
          ? {
              signedAt: agreement.agencySignedAt,
              ip: agreement.clientIP || undefined,
              lat: undefined,
              lng: undefined,
            }
          : undefined,
      },
    };
  }

  private getAgreementHtmlTemplate(data: AgreementData): string {
    const isPaymentSettlement = data.type === 'PAYMENT_SETTLEMENT';
    const hasFinancialData = data.originalAmount !== undefined || data.negotiatedAmount !== undefined;

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acordo - ${data.title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #000;
      padding: 20mm 15mm;
      background: #fff;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 2px solid #000;
      padding-bottom: 15px;
    }
    .header h1 {
      font-size: 16pt;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .header .token {
      font-size: 10pt;
      color: #666;
      font-family: monospace;
    }
    .legal-nature {
      background: #fff3cd;
      border: 2px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
      border-radius: 5px;
    }
    .legal-nature h3 {
      font-size: 12pt;
      font-weight: bold;
      margin-bottom: 10px;
      color: #856404;
    }
    .legal-nature p {
      font-size: 11pt;
      margin-bottom: 8px;
      text-align: justify;
    }
    .parties {
      margin: 20px 0;
    }
    .party {
      margin-bottom: 15px;
    }
    .party strong {
      font-weight: bold;
    }
    .content {
      margin: 20px 0;
      text-align: justify;
    }
    .financial-details {
      margin: 20px 0;
      border: 1px solid #ddd;
      padding: 15px;
      border-radius: 5px;
    }
    .financial-details h3 {
      font-size: 12pt;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .financial-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      border-bottom: 1px solid #eee;
    }
    .financial-row:last-child {
      border-bottom: none;
      font-weight: bold;
      font-size: 13pt;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 2px solid #000;
    }
    .enforceability-clause {
      background: #e7f3ff;
      border-left: 4px solid #2196F3;
      padding: 15px;
      margin: 20px 0;
    }
    .enforceability-clause h3 {
      font-size: 12pt;
      font-weight: bold;
      margin-bottom: 10px;
      color: #0d47a1;
    }
    .enforceability-clause p {
      font-size: 11pt;
      text-align: justify;
      margin-bottom: 8px;
    }
    .signatures {
      margin-top: 40px;
      page-break-inside: avoid;
    }
    .signature-block {
      margin: 30px 0;
      padding: 15px;
      border-top: 1px solid #000;
      width: 45%;
      display: inline-block;
      vertical-align: top;
      margin-right: 5%;
    }
    .signature-block:last-child {
      margin-right: 0;
    }
    .signature-block .name {
      font-weight: bold;
      margin-top: 60px;
      text-align: center;
    }
    .signature-block .document {
      text-align: center;
      font-size: 10pt;
      color: #666;
      margin-top: 5px;
    }
    .signature-meta {
      font-size: 9pt;
      color: #666;
      margin-top: 10px;
      text-align: center;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 9pt;
      color: #666;
      text-align: center;
    }
    .footer .hash {
      font-family: monospace;
      word-break: break-all;
      margin-top: 10px;
    }
    .disclaimer {
      margin-top: 20px;
      padding: 10px;
      background: #f5f5f5;
      border-radius: 5px;
      font-size: 9pt;
      text-align: center;
      color: #666;
    }
    .electronic-signature-clause {
      background: #f0f0f0;
      padding: 15px;
      margin: 20px 0;
      border-radius: 5px;
      font-size: 11pt;
      text-align: justify;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${data.title}</h1>
    <div class="token">Token: ${data.agreementToken}</div>
  </div>

  <div class="legal-nature">
    <h3>NATUREZA JURÍDICA DO ACORDO</h3>
    ${isPaymentSettlement ? `
    <p><strong>1. RECONHECIMENTO DE DÉBITO:</strong> As partes reconhecem a existência de débito no valor de ${this.formatCurrency(data.originalAmount)} (valor original), decorrente de obrigações contratuais não cumpridas.</p>
    <p><strong>2. TRANSAÇÃO (ACORDO):</strong> Este documento constitui uma transação nos termos do Art. 840 do Código Civil Brasileiro, mediante a qual as partes ajustam o pagamento do débito reconhecido, estabelecendo condições específicas de quitação.</p>
    ` : `
    <p><strong>NATUREZA JURÍDICA:</strong> Este acordo constitui um ajuste contratual entre as partes, estabelecendo condições específicas para a execução de obrigações decorrentes do contrato de locação.</p>
    `}
  </div>

  <div class="parties">
    <div class="party">
      <strong>LOCADOR(A):</strong> ${data.owner?.name || 'Não informado'}, ${data.owner?.document ? `CPF/CNPJ: ${data.owner.document}` : ''}
    </div>
    <div class="party">
      <strong>LOCATÁRIO(A):</strong> ${data.tenant?.name || 'Não informado'}, ${data.tenant?.document ? `CPF/CNPJ: ${data.tenant.document}` : ''}
    </div>
    ${data.property ? `
    <div class="party">
      <strong>IMÓVEL:</strong> ${data.property.name || ''} ${data.property.address}, ${data.property.neighborhood}, ${data.property.city}
    </div>
    ` : ''}
  </div>

  ${data.description ? `
  <div class="content">
    <h3>OBJETO DO ACORDO</h3>
    <p>${data.description}</p>
  </div>
  ` : ''}

  ${hasFinancialData ? `
  <div class="financial-details">
    <h3>CONDIÇÕES FINANCEIRAS</h3>
    ${data.originalAmount !== undefined ? `
    <div class="financial-row">
      <span>Valor Original:</span>
      <span>${this.formatCurrency(data.originalAmount)}</span>
    </div>
    ` : ''}
    ${data.fineAmount !== undefined && data.fineAmount > 0 ? `
    <div class="financial-row">
      <span>Multa:</span>
      <span>${this.formatCurrency(data.fineAmount)}</span>
    </div>
    ` : ''}
    ${data.discountAmount !== undefined && data.discountAmount > 0 ? `
    <div class="financial-row">
      <span>Desconto:</span>
      <span>${this.formatCurrency(data.discountAmount)}</span>
    </div>
    ` : ''}
    ${data.negotiatedAmount !== undefined ? `
    <div class="financial-row">
      <span>Valor Negociado:</span>
      <span>${this.formatCurrency(data.negotiatedAmount)}</span>
    </div>
    ` : ''}
    ${data.installments !== undefined && data.installments > 1 ? `
    <div class="financial-row">
      <span>Parcelas:</span>
      <span>${data.installments}x de ${this.formatCurrency(data.installmentValue)}</span>
    </div>
    ` : ''}
    ${data.newDueDate ? `
    <div class="financial-row">
      <span>Nova Data de Vencimento:</span>
      <span>${this.formatDate(data.newDueDate)}</span>
    </div>
    ` : ''}
  </div>
  ` : ''}

  ${data.content ? `
  <div class="content">
    <h3>CLÁUSULAS E CONDIÇÕES</h3>
    <div>${data.content.replace(/\n/g, '<br>')}</div>
  </div>
  ` : ''}

  <div class="enforceability-clause">
    <h3>CLÁUSULAS DE EXECUTABILIDADE</h3>
    <p><strong>1. CLÁUSULA DE ACELERAÇÃO:</strong> Em caso de inadimplemento de qualquer parcela ou obrigação prevista neste acordo, todas as parcelas vincendas tornar-se-ão imediatamente exigíveis, sem necessidade de notificação prévia.</p>
    <p><strong>2. MULTA POR INADIMPLEMENTO:</strong> Em caso de descumprimento das condições estabelecidas, será aplicada multa de 2% (dois por cento) sobre o valor em atraso, além de juros de mora de 1% (um por cento) ao mês, calculados pro rata die.</p>
    <p><strong>3. TÍTULO EXECUTIVO EXTRAJUDICIAL:</strong> As partes reconhecem que este acordo, uma vez assinado, constitui título executivo extrajudicial nos termos do Art. 784, inciso III, do Código de Processo Civil, podendo ser executado diretamente, sem necessidade de ação de conhecimento prévia.</p>
  </div>

  <div class="electronic-signature-clause">
    <p><strong>EXECUÇÃO ELETRÔNICA:</strong> Este acordo foi executado eletronicamente em conformidade com o Artigo 10 da Medida Provisória 2.200-2/2001. A assinatura eletrônica utilizada é do tipo simples, conforme Lei nº 14.063/2020.</p>
  </div>

  <div class="signatures">
    ${data.signatures?.tenant ? `
    <div class="signature-block">
      <div class="name">${data.tenant?.name || 'Locatário'}</div>
      <div class="document">${data.tenant?.document || ''}</div>
      <div class="signature-meta">
        Assinado em: ${this.formatDateTime(data.signatures.tenant.signedAt)}<br>
        ${data.signatures.tenant.ip ? `IP: ${data.signatures.tenant.ip}<br>` : ''}
        ${data.signatures.tenant.lat && data.signatures.tenant.lng ? `Localização: ${data.signatures.tenant.lat.toFixed(6)}, ${data.signatures.tenant.lng.toFixed(6)}` : ''}
      </div>
    </div>
    ` : `
    <div class="signature-block">
      <div class="name">${data.tenant?.name || 'Locatário'}</div>
      <div class="document">${data.tenant?.document || ''}</div>
      <div class="signature-meta">Aguardando assinatura</div>
    </div>
    `}
    
    ${data.signatures?.owner ? `
    <div class="signature-block">
      <div class="name">${data.owner?.name || 'Locador'}</div>
      <div class="document">${data.owner?.document || ''}</div>
      <div class="signature-meta">
        Assinado em: ${this.formatDateTime(data.signatures.owner.signedAt)}<br>
        ${data.signatures.owner.ip ? `IP: ${data.signatures.owner.ip}<br>` : ''}
        ${data.signatures.owner.lat && data.signatures.owner.lng ? `Localização: ${data.signatures.owner.lat.toFixed(6)}, ${data.signatures.owner.lng.toFixed(6)}` : ''}
      </div>
    </div>
    ` : `
    <div class="signature-block">
      <div class="name">${data.owner?.name || 'Locador'}</div>
      <div class="document">${data.owner?.document || ''}</div>
      <div class="signature-meta">Aguardando assinatura</div>
    </div>
    `}
  </div>

  <div class="footer">
    <p><strong>Token:</strong> ${data.agreementToken}</p>
    <p><strong>Gerado em:</strong> ${this.formatDateTime(new Date())}</p>
    <p><strong>Verificação:</strong> ${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify/agreement/${data.agreementToken}</p>
    <p class="hash"><strong>Hash SHA-256:</strong> Será gerado após finalização</p>
    <p class="disclaimer">MR3X é uma plataforma de tecnologia para gestão de aluguéis e não presta serviços jurídicos, de advocacia ou intermediação judicial.</p>
  </div>
</body>
</html>
    `;
  }

  async generatePdf(agreementId: bigint): Promise<Buffer> {
    const data = await this.getAgreementData(agreementId);
    const html = this.getAgreementHtmlTemplate(data);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfUint8Array = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
      });

      const pdfBuffer = Buffer.from(pdfUint8Array);
      const hash = this.generateHash(pdfBuffer);

      const timestamp = Date.now();
      const filename = `agreement-${data.agreementToken}-${timestamp}.pdf`;
      const filePath = path.join(this.uploadsDir, 'final', data.id, filename);

      this.ensureDirectoryExists(path.dirname(filePath));
      fs.writeFileSync(filePath, pdfBuffer);

      await this.prisma.agreement.update({
        where: { id: agreementId },
        data: {
          pdfUrl: filePath,
          agreementHash: hash,
        },
      });

      return pdfBuffer;
    } finally {
      await browser.close();
    }
  }
}

