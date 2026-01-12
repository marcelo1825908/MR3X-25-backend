import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as crypto from 'crypto';
import { PrismaService } from '../../config/prisma.service';
import { TokenGeneratorService, TokenEntityType } from '../common/services/token-generator.service';

interface ReceiptData {
  receiptNumber: string;
  paymentDate: string;
  ownerName: string;
  ownerDocument: string;
  tenantName: string;
  tenantDocument: string;
  propertyAddress: string;
  amount: number;
  description: string;
  paymentMethod: string;
  referenceMonth: string;
  hash?: string;
  ip?: string;
  generatedAt?: string;
}

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  ownerName: string;
  ownerDocument: string;
  ownerZipCode: string;
  ownerAddress: string;
  ownerCity: string;
  ownerState: string;
  tenantName: string;
  tenantDocument: string;
  propertyAddress: string;
  referenceMonth: string;
  description: string;
  originalValue: number;
  lateFee: number;
  interest: number;
  discount: number;
  finalValue: number;
  instructions: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private tokenGenerator: TokenGeneratorService,
  ) {}

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  private formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  }

  async generateReceipt(data: ReceiptData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        // Generate fiscal token for receipt (MR3X-REC-2025-XXXX-XXXX)
        const receiptToken = await this.tokenGenerator.generateToken(TokenEntityType.RECEIPT);

        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        doc.fontSize(20).font('Helvetica-Bold').text('RECIBO DE PAGAMENTO', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).font('Helvetica').text(`Nº ${data.receiptNumber || receiptToken}`, { align: 'center' });
        doc.fontSize(10).font('Helvetica').text(`Token Fiscal: ${receiptToken}`, { align: 'center' });
        doc.moveDown(2);

        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();

        doc.fontSize(11).font('Helvetica-Bold').text('DADOS DO PAGAMENTO');
        doc.moveDown(0.5);
        doc.font('Helvetica');
        doc.text(`Data do Pagamento: ${this.formatDate(data.paymentDate)}`);
        doc.text(`Forma de Pagamento: ${data.paymentMethod}`);
        doc.text(`Mês de Referência: ${data.referenceMonth}`);
        doc.moveDown();

        doc.font('Helvetica-Bold').text('PROPRIETÁRIO (RECEBEDOR)');
        doc.moveDown(0.5);
        doc.font('Helvetica');
        doc.text(`Nome: ${data.ownerName}`);
        doc.text(`CPF/CNPJ: ${data.ownerDocument}`);
        doc.moveDown();

        doc.font('Helvetica-Bold').text('INQUILINO (PAGADOR)');
        doc.moveDown(0.5);
        doc.font('Helvetica');
        doc.text(`Nome: ${data.tenantName}`);
        doc.text(`CPF/CNPJ: ${data.tenantDocument}`);
        doc.moveDown();

        doc.font('Helvetica-Bold').text('IMÓVEL');
        doc.moveDown(0.5);
        doc.font('Helvetica');
        doc.text(`Endereço: ${data.propertyAddress}`);
        doc.moveDown();

        doc.font('Helvetica-Bold').text('VALOR RECEBIDO');
        doc.moveDown(0.5);
        doc.fontSize(16).text(this.formatCurrency(data.amount), { align: 'center' });
        doc.moveDown();

        doc.fontSize(11).font('Helvetica-Bold').text('DESCRIÇÃO');
        doc.moveDown(0.5);
        doc.font('Helvetica').text(data.description);
        doc.moveDown(2);

        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(2);

        doc.fontSize(10).text(
          `Declaro ter recebido a quantia de ${this.formatCurrency(data.amount)} ` +
          `(${this.numberToWords(data.amount)}) referente a ${data.description}.`,
          { align: 'justify' }
        );
        doc.moveDown(3);

        doc.text('_'.repeat(50), { align: 'center' });
        doc.text(data.ownerName, { align: 'center' });
        doc.text('Proprietário', { align: 'center' });
        doc.moveDown(2);

        // Generate hash if not provided
        const generatedAt = data.generatedAt || new Date().toISOString();
        const receiptContent = JSON.stringify({
          receiptNumber: data.receiptNumber || receiptToken,
          paymentDate: data.paymentDate,
          ownerName: data.ownerName,
          ownerDocument: data.ownerDocument,
          tenantName: data.tenantName,
          tenantDocument: data.tenantDocument,
          propertyAddress: data.propertyAddress,
          amount: data.amount,
          description: data.description,
          paymentMethod: data.paymentMethod,
          referenceMonth: data.referenceMonth,
          generatedAt,
          ip: data.ip || 'N/A',
        });
        const receiptHash = data.hash || crypto.createHash('sha256').update(receiptContent).digest('hex');

        // Add integrity information
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();
        doc.fontSize(9).font('Helvetica-Bold').text('INFORMAÇÕES DE INTEGRIDADE', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(8).font('Helvetica');
        doc.text(`Gerado em: ${new Date(generatedAt).toLocaleString('pt-BR')}`, { align: 'center' });
        if (data.ip) {
          doc.text(`IP: ${data.ip}`, { align: 'center' });
        }
        doc.moveDown(0.5);
        doc.fontSize(7).font('Helvetica').text(`Hash SHA-256: ${receiptHash.substring(0, 32)}...`, { align: 'center' });
        doc.moveDown();

        doc.fontSize(8).text(
          `Documento gerado em ${new Date(generatedAt).toLocaleDateString('pt-BR')} às ${new Date(generatedAt).toLocaleTimeString('pt-BR')}`,
          { align: 'center' }
        );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  async generateInvoice(data: InvoiceData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        doc.fontSize(20).font('Helvetica-Bold').text('FATURA DE ALUGUEL', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).font('Helvetica').text(`Nº ${data.invoiceNumber}`, { align: 'center' });
        doc.moveDown(2);

        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();

        doc.fontSize(11).font('Helvetica-Bold').text('DADOS DA FATURA');
        doc.moveDown(0.5);
        doc.font('Helvetica');
        doc.text(`Data de Emissão: ${this.formatDate(data.invoiceDate)}`);
        doc.text(`Data de Vencimento: ${this.formatDate(data.dueDate)}`);
        doc.text(`Mês de Referência: ${data.referenceMonth}`);
        doc.moveDown();

        doc.font('Helvetica-Bold').text('LOCADOR (PROPRIETÁRIO)');
        doc.moveDown(0.5);
        doc.font('Helvetica');
        doc.text(`Nome: ${data.ownerName}`);
        doc.text(`CPF/CNPJ: ${data.ownerDocument}`);
        doc.text(`Endereço: ${data.ownerAddress}`);
        doc.text(`${data.ownerCity} - ${data.ownerState}, CEP: ${data.ownerZipCode}`);
        doc.moveDown();

        doc.font('Helvetica-Bold').text('LOCATÁRIO (INQUILINO)');
        doc.moveDown(0.5);
        doc.font('Helvetica');
        doc.text(`Nome: ${data.tenantName}`);
        doc.text(`CPF/CNPJ: ${data.tenantDocument}`);
        doc.moveDown();

        doc.font('Helvetica-Bold').text('IMÓVEL LOCADO');
        doc.moveDown(0.5);
        doc.font('Helvetica');
        doc.text(`Endereço: ${data.propertyAddress}`);
        doc.moveDown();

        doc.font('Helvetica-Bold').text('DISCRIMINAÇÃO DOS VALORES');
        doc.moveDown(0.5);

        const tableTop = doc.y;
        const col1 = 50;
        const col2 = 400;

        doc.font('Helvetica');
        doc.text('Descrição', col1, tableTop);
        doc.text('Valor', col2, tableTop);

        doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).stroke();
        doc.moveDown();

        const rowHeight = 20;
        let currentY = doc.y;

        doc.text(data.description || 'Aluguel', col1, currentY);
        doc.text(this.formatCurrency(data.originalValue), col2, currentY);
        currentY += rowHeight;

        if (data.lateFee > 0) {
          doc.text('Multa por Atraso', col1, currentY);
          doc.text(this.formatCurrency(data.lateFee), col2, currentY);
          currentY += rowHeight;
        }

        if (data.interest > 0) {
          doc.text('Juros', col1, currentY);
          doc.text(this.formatCurrency(data.interest), col2, currentY);
          currentY += rowHeight;
        }

        if (data.discount > 0) {
          doc.text('Desconto', col1, currentY);
          doc.text(`- ${this.formatCurrency(data.discount)}`, col2, currentY);
          currentY += rowHeight;
        }

        doc.moveTo(50, currentY + 5).lineTo(550, currentY + 5).stroke();
        currentY += 15;

        doc.font('Helvetica-Bold');
        doc.text('VALOR TOTAL', col1, currentY);
        doc.fontSize(14).text(this.formatCurrency(data.finalValue), col2, currentY);
        doc.moveDown(2);

        if (data.instructions) {
          doc.fontSize(11).font('Helvetica-Bold').text('INSTRUÇÕES DE PAGAMENTO');
          doc.moveDown(0.5);
          doc.font('Helvetica').text(data.instructions);
        }

        doc.moveDown(2);

        doc.fontSize(8).text(
          `Documento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
          { align: 'center' }
        );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private numberToWords(num: number): string {
    const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
    const teens = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
    const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

    if (num === 0) return 'zero reais';
    if (num === 100) return 'cem reais';

    const reais = Math.floor(num);
    const centavos = Math.round((num - reais) * 100);

    let result = '';

    if (reais >= 1000) {
      const thousands = Math.floor(reais / 1000);
      if (thousands === 1) {
        result += 'mil';
      } else {
        result += this.numberToWordsHelper(thousands) + ' mil';
      }
      const remainder = reais % 1000;
      if (remainder > 0) {
        result += ' e ' + this.numberToWordsHelper(remainder);
      }
    } else {
      result = this.numberToWordsHelper(reais);
    }

    result += reais === 1 ? ' real' : ' reais';

    if (centavos > 0) {
      result += ' e ' + this.numberToWordsHelper(centavos);
      result += centavos === 1 ? ' centavo' : ' centavos';
    }

    return result;
  }

  private numberToWordsHelper(num: number): string {
    const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
    const teens = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
    const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

    if (num === 0) return '';
    if (num === 100) return 'cem';

    let result = '';

    if (num >= 100) {
      result += hundreds[Math.floor(num / 100)];
      num %= 100;
      if (num > 0) result += ' e ';
    }

    if (num >= 20) {
      result += tens[Math.floor(num / 10)];
      num %= 10;
      if (num > 0) result += ' e ';
    } else if (num >= 10) {
      return result + teens[num - 10];
    }

    if (num > 0) {
      result += units[num];
    }

    return result;
  }
}
