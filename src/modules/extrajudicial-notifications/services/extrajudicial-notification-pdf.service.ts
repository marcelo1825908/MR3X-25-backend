import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@config/prisma.service';
import * as puppeteer from 'puppeteer';
import * as bwipjs from 'bwip-js';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import { ExtrajudicialNotificationHashService } from './extrajudicial-notification-hash.service';

interface NotificationData {
  id: string;
  token: string;
  notificationNumber: string;
  protocolNumber: string;
  type: string;
  status: string;
  priority: string;
  creditor: {
    name: string;
    document: string;
    address: string | null;
    email: string | null;
    phone: string | null;
  };
  debtor: {
    name: string;
    document: string;
    address: string | null;
    email: string | null;
    phone: string | null;
  };
  property: {
    address: string;
    city: string;
    state: string;
  };
  title: string;
  subject: string;
  description: string;
  legalBasis: string;
  demandedAction: string;
  financial: {
    principalAmount: number | null;
    fineAmount: number | null;
    interestAmount: number | null;
    correctionAmount: number | null;
    lawyerFees: number | null;
    totalAmount: number;
  };
  deadline: {
    days: number;
    date: Date;
    gracePeriodDays: number | null;
  };
  consequencesText: string | null;
  signatures?: {
    creditor?: { signature: string; signedAt: Date; ip: string; lat?: number; lng?: number };
    debtor?: { signature: string; signedAt: Date; ip: string; lat?: number; lng?: number };
    witness1?: { signature: string; signedAt: Date; name: string; document: string };
    witness2?: { signature: string; signedAt: Date; name: string; document: string };
  };
  createdAt: Date;
}

@Injectable()
export class ExtrajudicialNotificationPdfService {
  private readonly uploadsDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly hashService: ExtrajudicialNotificationHashService,
  ) {
    this.uploadsDir = path.join(process.cwd(), 'uploads', 'extrajudicial-notifications');
    this.ensureDirectoryExists(path.join(this.uploadsDir, 'provisional'));
    this.ensureDirectoryExists(path.join(this.uploadsDir, 'final'));
  }

  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Generate barcode as base64 PNG
   */
  async generateBarcodeBase64(token: string): Promise<string> {
    try {
      const png = await bwipjs.toBuffer({
        bcid: 'code128',
        text: token,
        scale: 3,
        height: 10,
        includetext: true,
        textxalign: 'center',
        textyoffset: -4,
      });
      return `data:image/png;base64,${png.toString('base64')}`;
    } catch (error) {
      console.error('Error generating barcode:', error);
      throw error;
    }
  }

  /**
   * Generate QR code as base64 PNG
   */
  async generateQRCodeBase64(url: string): Promise<string> {
    try {
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 150,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      });
      return qrDataUrl;
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw error;
    }
  }

  /**
   * Get notification data for PDF generation
   */
  private async getNotificationData(notificationId: bigint): Promise<NotificationData> {
    const notification = await this.prisma.extrajudicialNotification.findUnique({
      where: { id: notificationId },
      include: {
        property: true,
        creditor: true,
        debtor: true,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notificacao extrajudicial nao encontrada');
    }

    return {
      id: notification.id.toString(),
      token: notification.notificationToken,
      notificationNumber: notification.notificationNumber || '',
      protocolNumber: notification.protocolNumber || '',
      type: notification.type,
      status: notification.status,
      priority: notification.priority,
      creditor: {
        name: notification.creditorName,
        document: notification.creditorDocument,
        address: notification.creditorAddress,
        email: notification.creditorEmail,
        phone: notification.creditorPhone,
      },
      debtor: {
        name: notification.debtorName,
        document: notification.debtorDocument,
        address: notification.debtorAddress,
        email: notification.debtorEmail,
        phone: notification.debtorPhone,
      },
      property: {
        address: notification.property?.address || 'Endereco nao informado',
        city: notification.property?.city || 'Cidade nao informada',
        state: '',
      },
      title: notification.title,
      subject: notification.subject,
      description: notification.description,
      legalBasis: notification.legalBasis,
      demandedAction: notification.demandedAction,
      financial: {
        principalAmount: notification.principalAmount ? Number(notification.principalAmount) : null,
        fineAmount: notification.fineAmount ? Number(notification.fineAmount) : null,
        interestAmount: notification.interestAmount ? Number(notification.interestAmount) : null,
        correctionAmount: notification.correctionAmount ? Number(notification.correctionAmount) : null,
        lawyerFees: notification.lawyerFees ? Number(notification.lawyerFees) : null,
        totalAmount: Number(notification.totalAmount),
      },
      deadline: {
        days: notification.deadlineDays,
        date: notification.deadlineDate,
        gracePeriodDays: notification.gracePeriodDays,
      },
      consequencesText: notification.consequencesText,
      signatures: {
        creditor: notification.creditorSignature
          ? {
              signature: notification.creditorSignature,
              signedAt: notification.creditorSignedAt!,
              ip: notification.creditorSignedIP || 'N/A',
              lat: notification.creditorGeoLat || undefined,
              lng: notification.creditorGeoLng || undefined,
            }
          : undefined,
        debtor: notification.debtorSignature
          ? {
              signature: notification.debtorSignature,
              signedAt: notification.debtorSignedAt!,
              ip: notification.debtorSignedIP || 'N/A',
              lat: notification.debtorGeoLat || undefined,
              lng: notification.debtorGeoLng || undefined,
            }
          : undefined,
        witness1: notification.witness1Signature
          ? {
              signature: notification.witness1Signature,
              signedAt: notification.witness1SignedAt!,
              name: notification.witness1Name || '',
              document: notification.witness1Document || '',
            }
          : undefined,
        witness2: notification.witness2Signature
          ? {
              signature: notification.witness2Signature,
              signedAt: notification.witness2SignedAt!,
              name: notification.witness2Name || '',
              document: notification.witness2Document || '',
            }
          : undefined,
      },
      createdAt: notification.createdAt,
    };
  }

  private getTypeLabel(type: string): string {
    const types: Record<string, string> = {
      COBRANCA_ALUGUEL: 'Cobranca de Aluguel',
      COBRANCA_CONDOMINIO: 'Cobranca de Condominio',
      COBRANCA_IPTU: 'Cobranca de IPTU',
      COBRANCA_MULTAS: 'Cobranca de Multas',
      COBRANCA_DANOS: 'Cobranca de Danos',
      RESCISAO_CONTRATO: 'Rescisao de Contrato',
      DESOCUPACAO: 'Desocupacao',
      DIVERGENCIA_VISTORIA: 'Divergencia de Vistoria',
      OUTROS: 'Outros',
    };
    return types[type] || type;
  }

  private getStatusLabel(status: string): string {
    const statuses: Record<string, string> = {
      RASCUNHO: 'Rascunho',
      AGUARDANDO_ENVIO: 'Aguardando Envio',
      ENVIADA: 'Enviada',
      VISUALIZADA: 'Visualizada',
      RESPONDIDA: 'Respondida',
      ACEITA: 'Aceita',
      REJEITADA: 'Rejeitada',
      PRAZO_EXPIRADO: 'Prazo Expirado',
      ENCAMINHADA_JUDICIAL: 'Encaminhada ao Judicial',
      CANCELADA: 'Cancelada',
    };
    return statuses[status] || status;
  }

  private getPriorityLabel(priority: string): string {
    const priorities: Record<string, string> = {
      URGENT: 'Urgente',
      HIGH: 'Alta',
      NORMAL: 'Normal',
      LOW: 'Baixa',
    };
    return priorities[priority] || priority;
  }

  private getPriorityColor(priority: string): string {
    const colors: Record<string, string> = {
      URGENT: '#dc2626',
      HIGH: '#ea580c',
      NORMAL: '#2563eb',
      LOW: '#6b7280',
    };
    return colors[priority] || '#2563eb';
  }

  private formatCurrency(value: number | null): string {
    if (value === null) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('pt-BR');
  }

  private formatDateTime(date: Date): string {
    return new Date(date).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }

  /**
   * Render HTML template with data
   */
  private async renderHtmlTemplate(data: NotificationData, isProvisional: boolean): Promise<string> {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify/notification/${data.token}`;
    const barcodeBase64 = await this.generateBarcodeBase64(data.token);
    const qrCodeBase64 = await this.generateQRCodeBase64(verificationUrl);

    const templateData = {
      ...data,
      isProvisional,
      barcodeBase64,
      qrCodeBase64,
      verificationUrl,
      generatedAt: this.formatDateTime(new Date()),
      typeLabel: this.getTypeLabel(data.type),
      statusLabel: this.getStatusLabel(data.status),
      priorityLabel: this.getPriorityLabel(data.priority),
      priorityColor: this.getPriorityColor(data.priority),
      deadlineDateFormatted: this.formatDate(data.deadline.date),
      createdAtFormatted: this.formatDate(data.createdAt),
    };

    return this.getNotificationHtmlTemplate(templateData);
  }

  /**
   * Generate provisional PDF (with watermark)
   */
  async generateProvisionalPdf(notificationId: bigint): Promise<Buffer> {
    console.log(`[PDF] Starting provisional PDF generation for notification ${notificationId}`);

    let data;
    try {
      data = await this.getNotificationData(notificationId);
      console.log(`[PDF] Got notification data: ${data.id}, token: ${data.token}`);
    } catch (error) {
      console.error(`[PDF] Error getting notification data:`, error);
      throw error;
    }

    let html;
    try {
      html = await this.renderHtmlTemplate(data, true);
      console.log(`[PDF] HTML template rendered successfully`);
    } catch (error) {
      console.error(`[PDF] Error rendering HTML template:`, error);
      throw error;
    }

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      console.log(`[PDF] Puppeteer browser launched successfully`);
    } catch (error) {
      console.error(`[PDF] Error launching Puppeteer browser:`, error);
      throw new Error(`Failed to launch PDF generator: ${error.message}`);
    }

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const footerTemplate = `
        <div style="width: 100%; font-size: 9pt; font-family: 'Times New Roman', Times, serif; color: #666; padding: 5px 15mm; border-top: 1px solid #ddd;">
          <p style="margin: 0 0 4px 0;"><strong>Token:</strong> ${data.token}</p>
          <p style="margin: 0 0 4px 0;"><strong>Protocolo:</strong> ${data.protocolNumber}</p>
          <p style="margin: 0 0 4px 0;"><strong>Gerado em:</strong> ${this.formatDateTime(new Date())}</p>
          <p style="margin: 0;"><strong>Verificacao:</strong> ${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify/notification/${data.token}</p>
        </div>
      `;

      const pdfUint8Array = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', right: '12mm', bottom: '30mm', left: '12mm' },
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: footerTemplate,
      });

      const pdfBuffer = Buffer.from(pdfUint8Array);

      // Save provisional PDF
      const timestamp = Date.now();
      const filename = `notification-provisional-${timestamp}.pdf`;
      const filePath = path.join(this.uploadsDir, 'provisional', data.id, filename);

      this.ensureDirectoryExists(path.dirname(filePath));
      fs.writeFileSync(filePath, pdfBuffer);

      // Generate and store provisional hash
      const hash = this.hashService.generateHash(pdfBuffer);
      await this.prisma.extrajudicialNotification.update({
        where: { id: notificationId },
        data: {
          provisionalPdfPath: filePath,
          provisionalHash: hash,
        },
      });

      return pdfBuffer;
    } finally {
      await browser.close();
    }
  }

  /**
   * Generate final PDF (no watermark, with all signatures)
   */
  async generateFinalPdf(notificationId: bigint): Promise<Buffer> {
    const data = await this.getNotificationData(notificationId);
    const html = await this.renderHtmlTemplate(data, false);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const footerTemplate = `
        <div style="width: 100%; font-size: 7pt; font-family: 'Times New Roman', Times, serif; color: #666; padding: 5px 15mm; border-top: 1px solid #ddd;">
          <p style="margin: 0 0 2px 0;"><strong>Token:</strong> ${data.token}</p>
          <p style="margin: 0 0 2px 0;"><strong>Protocolo:</strong> ${data.protocolNumber}</p>
          <p style="margin: 0 0 2px 0;"><strong>Gerado em:</strong> ${this.formatDateTime(new Date())}</p>
          <p style="margin: 0;"><strong>Verificacao:</strong> ${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify/notification/${data.token}</p>
        </div>
      `;

      const pdfUint8Array = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', right: '12mm', bottom: '30mm', left: '12mm' },
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: footerTemplate,
      });

      const pdfBuffer = Buffer.from(pdfUint8Array);

      // Save final PDF
      const timestamp = Date.now();
      const filename = `notification-final-${timestamp}.pdf`;
      const filePath = path.join(this.uploadsDir, 'final', data.id, filename);

      this.ensureDirectoryExists(path.dirname(filePath));
      fs.writeFileSync(filePath, pdfBuffer);

      // Generate and store final hash
      const hash = this.hashService.generateHash(pdfBuffer);
      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify/notification/${data.token}`;

      await this.prisma.extrajudicialNotification.update({
        where: { id: notificationId },
        data: {
          finalPdfPath: filePath,
          hashFinal: hash,
          verificationUrl,
          pdfGeneratedAt: new Date(),
        },
      });

      return pdfBuffer;
    } finally {
      await browser.close();
    }
  }

  /**
   * Get stored PDF file
   */
  async getStoredPdf(notificationId: bigint, type: 'provisional' | 'final'): Promise<Buffer | null> {
    const notification = await this.prisma.extrajudicialNotification.findUnique({
      where: { id: notificationId },
      select: { provisionalPdfPath: true, finalPdfPath: true },
    });

    if (!notification) {
      throw new NotFoundException('Notificacao nao encontrada');
    }

    const filePath = type === 'provisional' ? notification.provisionalPdfPath : notification.finalPdfPath;

    if (!filePath || !fs.existsSync(filePath)) {
      return null;
    }

    return fs.readFileSync(filePath);
  }

  /**
   * Get notification HTML template
   */
  private getNotificationHtmlTemplate(data: any): string {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notificacao Extrajudicial - ${data.notificationNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #333;
      background: white;
    }

    .page {
      padding: 10px;
      position: relative;
    }

    ${
      data.isProvisional
        ? `
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 80px;
      color: rgba(200, 200, 200, 0.3);
      font-weight: bold;
      white-space: nowrap;
      pointer-events: none;
      z-index: 1000;
    }
    `
        : ''
    }

    /* Header info bar */
    .header-info-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 15px;
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      margin-bottom: 15px;
      font-size: 9pt;
    }

    .header-info-bar .token {
      font-family: 'Courier New', monospace;
      font-weight: bold;
    }

    /* QR and Barcode container - centered like contract */
    .codes-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 30px;
      padding: 15px;
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      margin-bottom: 20px;
    }

    .codes-container .qrcode img {
      width: 80px;
      height: 80px;
    }

    .codes-container .barcode img {
      height: 50px;
    }

    /* Sidebar barcode (vertical on right side) */
    .sidebar-barcode {
      position: fixed;
      right: -25mm;
      top: 50%;
      transform: rotate(90deg) translateX(-50%);
      z-index: 100;
    }

    .sidebar-barcode img {
      max-width: 60mm;
      height: auto;
    }

    /* Header */
    .header {
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 2px solid #333;
      padding-bottom: 15px;
    }

    .header h1 {
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 5px;
    }

    .header .subtitle {
      font-size: 12pt;
      color: #555;
      font-weight: 600;
    }

    .header .token {
      font-size: 10pt;
      color: #666;
      font-family: 'Courier New', monospace;
    }

    .priority-badge {
      display: inline-block;
      padding: 4px 15px;
      border-radius: 3px;
      font-size: 9pt;
      font-weight: bold;
      color: white;
      background-color: ${data.priorityColor};
      margin-top: 10px;
    }

    /* Sections */
    .section {
      margin-bottom: 20px;
    }

    .section-title {
      font-size: 12pt;
      font-weight: bold;
      color: #333;
      border-bottom: 1px solid #ccc;
      padding-bottom: 5px;
      margin-bottom: 10px;
    }

    /* Parties info */
    .parties {
      display: flex;
      gap: 20px;
      margin-bottom: 20px;
    }

    .party {
      flex: 1;
      border: 1px solid #ddd;
      padding: 10px;
      border-radius: 4px;
    }

    .party h3 {
      font-size: 11pt;
      font-weight: bold;
      margin-bottom: 8px;
      color: #444;
    }

    .party p {
      font-size: 10pt;
      margin-bottom: 3px;
    }

    .party .label {
      font-weight: bold;
    }

    /* Property info */
    .property-info {
      background: #f9f9f9;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 20px;
    }

    /* Content sections */
    .content-section {
      margin-bottom: 20px;
    }

    .content-section h3 {
      font-size: 12pt;
      font-weight: bold;
      color: #333;
      border-bottom: 1px solid #ccc;
      padding-bottom: 5px;
      margin-bottom: 10px;
    }

    .content-section p {
      text-align: justify;
      margin-bottom: 10px;
    }

    .legal-text {
      background: #f5f5f5;
      border-left: 4px solid #666;
      padding: 12px 15px;
      font-style: italic;
      margin: 15px 0;
    }

    /* Financial table */
    .financial-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }

    .financial-table th,
    .financial-table td {
      border: 1px solid #ddd;
      padding: 10px 12px;
      text-align: left;
      font-size: 10pt;
    }

    .financial-table th {
      background: #f0f0f0;
      font-weight: 600;
    }

    .financial-table .total-row {
      background: #e0e0e0;
      font-weight: bold;
      font-size: 11pt;
    }

    .financial-table .amount {
      text-align: right;
      font-family: 'Courier New', monospace;
    }

    /* Detail boxes */
    .contract-details {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }

    .detail-box {
      border: 1px solid #ddd;
      padding: 10px;
      text-align: center;
    }

    .detail-box .label {
      font-size: 9pt;
      color: #666;
      text-transform: uppercase;
    }

    .detail-box .value {
      font-size: 14pt;
      font-weight: bold;
      color: #333;
    }

    /* Deadline box */
    .deadline-box {
      background: #fff3cd;
      border: 2px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
      text-align: center;
      border-radius: 4px;
    }

    .deadline-box h4 {
      font-size: 11pt;
      color: #856404;
      margin-bottom: 8px;
      text-transform: uppercase;
    }

    .deadline-box .date {
      font-size: 16pt;
      font-weight: bold;
      color: #664d03;
    }

    .deadline-box .days {
      font-size: 10pt;
      color: #856404;
      margin-top: 5px;
    }

    /* Demanded action */
    .demanded-action {
      background: #d1ecf1;
      border: 1px solid #bee5eb;
      padding: 15px;
      margin: 15px 0;
      border-radius: 4px;
    }

    .demanded-action h4 {
      font-size: 11pt;
      color: #0c5460;
      margin-bottom: 8px;
      text-transform: uppercase;
    }

    .demanded-action p {
      font-size: 10pt;
      color: #0c5460;
    }

    /* Consequences box */
    .consequences-box {
      background: #f8d7da;
      border: 1px solid #f5c6cb;
      padding: 15px;
      margin: 15px 0;
      border-radius: 4px;
    }

    .consequences-box h4 {
      font-size: 10pt;
      color: #721c24;
      margin-bottom: 8px;
      text-transform: uppercase;
    }

    .consequences-box p {
      font-size: 9pt;
      color: #721c24;
    }

    /* Signatures */
    .signatures {
      margin-top: 30px;
      page-break-inside: avoid;
    }

    .signature-row {
      display: flex;
      gap: 30px;
      margin-bottom: 20px;
    }

    .signature-box {
      flex: 1;
      text-align: center;
    }

    .signature-line {
      border-top: 1px solid #333;
      margin-top: 50px;
      padding-top: 5px;
    }

    .signature-image {
      height: 40px;
      margin-bottom: 5px;
    }

    .signature-image img {
      max-height: 50px;
      max-width: 150px;
    }

    .signature-name {
      font-weight: bold;
      font-size: 10pt;
    }

    .signature-doc {
      font-size: 9pt;
      color: #666;
    }

    .signature-meta {
      font-size: 7pt;
      color: #888;
      margin-top: 3px;
    }

  </style>
</head>
<body>
  ${data.isProvisional ? '<div class="watermark">AGUARDANDO ASSINATURAS</div>' : ''}

  <div class="sidebar-barcode">
    <img src="${data.barcodeBase64}" alt="Codigo de barras">
  </div>

  <div class="page">
    <!-- Header info bar like contract -->
    <div class="header-info-bar">
      <div>
        <span class="token">Token: ${data.token}</span>
      </div>
      <div>
        <span><strong>N:</strong> ${data.notificationNumber}</span>
        &nbsp;&nbsp;|&nbsp;&nbsp;
        <span><strong>Protocolo:</strong> ${data.protocolNumber}</span>
      </div>
    </div>

    <!-- QR Code and Barcode centered like contract -->
    <div class="codes-container">
      <div class="qrcode">
        <img src="${data.qrCodeBase64}" alt="QR Code">
      </div>
      <div class="barcode">
        <img src="${data.barcodeBase64}" alt="Codigo de barras">
      </div>
    </div>

    <div class="header">
      <h1>NOTIFICACAO EXTRAJUDICIAL</h1>
      <p class="subtitle">${data.typeLabel.toUpperCase()}</p>
      <span class="priority-badge">${data.priorityLabel}</span>
    </div>

    <div class="section">
      <h2 class="section-title">PARTES</h2>
      <div class="parties">
        <div class="party">
          <h3>NOTIFICANTE (Credor)</h3>
          <p><span class="label">Nome:</span> ${data.creditor.name}</p>
          <p><span class="label">CPF/CNPJ:</span> ${data.creditor.document}</p>
          ${data.creditor.address ? `<p><span class="label">Endereco:</span> ${data.creditor.address}</p>` : ''}
          ${data.creditor.email ? `<p><span class="label">E-mail:</span> ${data.creditor.email}</p>` : ''}
          ${data.creditor.phone ? `<p><span class="label">Telefone:</span> ${data.creditor.phone}</p>` : ''}
        </div>
        <div class="party">
          <h3>NOTIFICADO (Devedor)</h3>
          <p><span class="label">Nome:</span> ${data.debtor.name}</p>
          <p><span class="label">CPF/CNPJ:</span> ${data.debtor.document}</p>
          ${data.debtor.address ? `<p><span class="label">Endereco:</span> ${data.debtor.address}</p>` : ''}
          ${data.debtor.email ? `<p><span class="label">E-mail:</span> ${data.debtor.email}</p>` : ''}
          ${data.debtor.phone ? `<p><span class="label">Telefone:</span> ${data.debtor.phone}</p>` : ''}
        </div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">IMOVEL OBJETO</h2>
      <div class="property-info">
        <p><span class="label">Endereco:</span> ${data.property.address}</p>
        <p><span class="label">Cidade:</span> ${data.property.city}${data.property.state ? ' - ' + data.property.state : ''}</p>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">OBJETO DA NOTIFICACAO</h2>
      <p><strong>Titulo:</strong> ${data.title}</p>
      <p><strong>Assunto:</strong> ${data.subject}</p>
      <p style="margin-top: 10px; text-align: justify;">${data.description}</p>

      <div class="legal-text">
        <strong>Fundamentacao Legal:</strong><br>
        ${data.legalBasis}
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">VALORES DEVIDOS</h2>
      <table class="financial-table">
        <tbody>
          ${
            data.financial.principalAmount
              ? `
          <tr>
            <td>Valor Principal</td>
            <td class="amount">${this.formatCurrency(data.financial.principalAmount)}</td>
          </tr>
          `
              : ''
          }
          ${
            data.financial.fineAmount
              ? `
          <tr>
            <td>Multa</td>
            <td class="amount">${this.formatCurrency(data.financial.fineAmount)}</td>
          </tr>
          `
              : ''
          }
          ${
            data.financial.interestAmount
              ? `
          <tr>
            <td>Juros</td>
            <td class="amount">${this.formatCurrency(data.financial.interestAmount)}</td>
          </tr>
          `
              : ''
          }
          ${
            data.financial.correctionAmount
              ? `
          <tr>
            <td>Correcao Monetaria</td>
            <td class="amount">${this.formatCurrency(data.financial.correctionAmount)}</td>
          </tr>
          `
              : ''
          }
          ${
            data.financial.lawyerFees
              ? `
          <tr>
            <td>Honorarios Advocaticios</td>
            <td class="amount">${this.formatCurrency(data.financial.lawyerFees)}</td>
          </tr>
          `
              : ''
          }
          <tr class="total-row">
            <td><strong>TOTAL DEVIDO</strong></td>
            <td class="amount"><strong>${this.formatCurrency(data.financial.totalAmount)}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="demanded-action">
      <h4>ACAO REQUERIDA</h4>
      <p>${data.demandedAction}</p>
    </div>

    <div class="section">
      <h2 class="section-title">PRAZO PARA CUMPRIMENTO</h2>
      <div class="contract-details">
        <div class="detail-box">
          <p class="label">Data Limite</p>
          <p class="value">${data.deadlineDateFormatted}</p>
        </div>
        <div class="detail-box">
          <p class="label">Prazo</p>
          <p class="value">${data.deadline.days} dias</p>
        </div>
        <div class="detail-box">
          <p class="label">Carencia</p>
          <p class="value">${data.deadline.gracePeriodDays ? data.deadline.gracePeriodDays + ' dias' : 'N/A'}</p>
        </div>
      </div>
    </div>

    ${
      data.consequencesText
        ? `
    <div class="consequences-box">
      <h4>CONSEQUENCIAS DO NAO CUMPRIMENTO</h4>
      <p>${data.consequencesText}</p>
    </div>
    `
        : ''
    }

    <div class="signatures">
      <h2 class="section-title">ASSINATURAS</h2>

      <div class="signature-row">
        <div class="signature-box">
          ${
            data.signatures?.creditor?.signature
              ? `
          <div class="signature-image">
            <img src="${data.signatures.creditor.signature}" alt="Assinatura do Credor">
          </div>
          `
              : ''
          }
          <div class="signature-line">
            <p class="signature-name">${data.creditor.name}</p>
            <p class="signature-doc">NOTIFICANTE - ${data.creditor.document}</p>
            ${
              data.signatures?.creditor
                ? `
            <p class="signature-meta">
              Assinado em: ${this.formatDateTime(data.signatures.creditor.signedAt)}<br>
              IP: ${data.signatures.creditor.ip}
              ${data.signatures.creditor.lat ? `<br>Geo: ${data.signatures.creditor.lat.toFixed(6)}, ${data.signatures.creditor.lng?.toFixed(6)}` : ''}
            </p>
            `
                : ''
            }
          </div>
        </div>

        <div class="signature-box">
          ${
            data.signatures?.debtor?.signature
              ? `
          <div class="signature-image">
            <img src="${data.signatures.debtor.signature}" alt="Assinatura do Devedor">
          </div>
          `
              : ''
          }
          <div class="signature-line">
            <p class="signature-name">${data.debtor.name}</p>
            <p class="signature-doc">NOTIFICADO - ${data.debtor.document}</p>
            ${
              data.signatures?.debtor
                ? `
            <p class="signature-meta">
              Assinado em: ${this.formatDateTime(data.signatures.debtor.signedAt)}<br>
              IP: ${data.signatures.debtor.ip}
              ${data.signatures.debtor.lat ? `<br>Geo: ${data.signatures.debtor.lat.toFixed(6)}, ${data.signatures.debtor.lng?.toFixed(6)}` : ''}
            </p>
            `
                : ''
            }
          </div>
        </div>
      </div>

      ${
        data.signatures?.witness1 || data.signatures?.witness2
          ? `
      <div class="signature-row">
        ${
          data.signatures?.witness1
            ? `
        <div class="signature-box">
          <div class="signature-image">
            <img src="${data.signatures.witness1.signature}" alt="Assinatura Testemunha 1">
          </div>
          <div class="signature-line">
            <p class="signature-name">${data.signatures.witness1.name}</p>
            <p class="signature-doc">TESTEMUNHA - ${data.signatures.witness1.document}</p>
            <p class="signature-meta">Assinado em: ${this.formatDateTime(data.signatures.witness1.signedAt)}</p>
          </div>
        </div>
        `
            : ''
        }

        ${
          data.signatures?.witness2
            ? `
        <div class="signature-box">
          <div class="signature-image">
            <img src="${data.signatures.witness2.signature}" alt="Assinatura Testemunha 2">
          </div>
          <div class="signature-line">
            <p class="signature-name">${data.signatures.witness2.name}</p>
            <p class="signature-doc">TESTEMUNHA - ${data.signatures.witness2.document}</p>
            <p class="signature-meta">Assinado em: ${this.formatDateTime(data.signatures.witness2.signedAt)}</p>
          </div>
        </div>
        `
            : ''
        }
      </div>
      `
          : ''
      }
    </div>

  </div>
</body>
</html>
    `;
  }
}
