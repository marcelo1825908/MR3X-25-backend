import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@config/prisma.service';
import * as puppeteer from 'puppeteer';
import * as bwipjs from 'bwip-js';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import { InspectionHashService } from './inspection-hash.service';

interface InspectionData {
  id: string;
  token: string;
  type: string;
  status: string;
  date: Date;
  scheduledDate: Date | null;
  notes: string | null;
  location: string | null;
  property: {
    address: string;
    city: string;
    neighborhood: string;
    cep: string;
  };
  tenant: {
    name: string;
    document: string;
    email: string;
  } | null;
  owner: {
    name: string;
    document: string;
    email: string;
  } | null;
  inspector: {
    name: string;
    email: string;
  };
  agency?: {
    name: string;
    cnpj: string;
  };
  items: Array<{
    room: string;
    item: string;
    condition: string;
    description: string | null;
    needsRepair: boolean;
    repairCost: number | null;
    responsible: string | null;
    photos: string[];
  }>;
  signatures?: {
    tenant?: { signature: string; signedAt: Date; ip: string; lat?: number; lng?: number };
    owner?: { signature: string; signedAt: Date; ip: string; lat?: number; lng?: number };
    agency?: { signature: string; signedAt: Date; ip: string; lat?: number; lng?: number };
    inspector?: { signature: string; signedAt: Date; ip: string; lat?: number; lng?: number };
  };
}

@Injectable()
export class InspectionPdfService {
  private readonly uploadsDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly hashService: InspectionHashService,
  ) {
    this.uploadsDir = path.join(process.cwd(), 'uploads', 'inspections');

    // Ensure directories exist
    this.ensureDirectoryExists(path.join(this.uploadsDir, 'provisional'));
    this.ensureDirectoryExists(path.join(this.uploadsDir, 'final'));
  }

  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Generate unique token in format MR3X-INS-YEAR-XXXX-XXXX
   */
  generateInspectionToken(): string {
    const year = new Date().getFullYear();
    const random1 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const random2 = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `MR3X-INS-${year}-${random1}-${random2}`;
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
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      return qrDataUrl;
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw error;
    }
  }

  /**
   * Get inspection data for PDF generation
   */
  private async getInspectionData(inspectionId: bigint): Promise<InspectionData> {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: inspectionId },
      include: {
        property: {
          include: {
            owner: true,
            tenant: true,
          },
        },
        inspector: true,
        items: true,
      },
    });

    if (!inspection) {
      throw new NotFoundException('Vistoria não encontrada');
    }

    // Get agency if exists
    const agency = inspection.agencyId
      ? await this.prisma.agency.findUnique({
          where: { id: inspection.agencyId },
          select: { name: true, cnpj: true },
        })
      : null;

    return {
      id: inspection.id.toString(),
      token: inspection.inspectionToken || this.generateInspectionToken(),
      type: inspection.type,
      status: inspection.status,
      date: inspection.date,
      scheduledDate: inspection.scheduledDate,
      notes: inspection.notes,
      location: inspection.location,
      property: {
        address: inspection.property.address,
        city: inspection.property.city,
        neighborhood: inspection.property.neighborhood,
        cep: inspection.property.cep,
      },
      tenant: inspection.property.tenant
        ? {
            name: inspection.property.tenant.name || 'N/A',
            document: inspection.property.tenant.document || 'N/A',
            email: inspection.property.tenant.email,
          }
        : null,
      owner: inspection.property.owner
        ? {
            name: inspection.property.owner.name || 'N/A',
            document: inspection.property.owner.document || 'N/A',
            email: inspection.property.owner.email,
          }
        : null,
      inspector: {
        name: inspection.inspector.name || 'N/A',
        email: inspection.inspector.email,
      },
      agency: agency
        ? {
            name: agency.name,
            cnpj: agency.cnpj,
          }
        : undefined,
      items: inspection.items.map((item) => ({
        room: item.room,
        item: item.item,
        condition: item.condition,
        description: item.description,
        needsRepair: item.needsRepair,
        repairCost: item.repairCost ? Number(item.repairCost) : null,
        responsible: item.responsible,
        photos: item.photos ? JSON.parse(item.photos) : [],
      })),
      signatures: {
        tenant: inspection.tenantSignature
          ? {
              signature: inspection.tenantSignature,
              signedAt: inspection.tenantSignedAt!,
              ip: inspection.tenantSignedIP || 'N/A',
              lat: inspection.tenantGeoLat || undefined,
              lng: inspection.tenantGeoLng || undefined,
            }
          : undefined,
        owner: inspection.ownerSignature
          ? {
              signature: inspection.ownerSignature,
              signedAt: inspection.ownerSignedAt!,
              ip: inspection.ownerSignedIP || 'N/A',
              lat: inspection.ownerGeoLat || undefined,
              lng: inspection.ownerGeoLng || undefined,
            }
          : undefined,
        agency: inspection.agencySignature
          ? {
              signature: inspection.agencySignature,
              signedAt: inspection.agencySignedAt!,
              ip: inspection.agencySignedIP || 'N/A',
              lat: inspection.agencyGeoLat || undefined,
              lng: inspection.agencyGeoLng || undefined,
            }
          : undefined,
        inspector: inspection.inspectorSignature
          ? {
              signature: inspection.inspectorSignature,
              signedAt: inspection.inspectorSignedAt!,
              ip: inspection.inspectorSignedIP || 'N/A',
              lat: inspection.inspectorGeoLat || undefined,
              lng: inspection.inspectorGeoLng || undefined,
            }
          : undefined,
      },
    };
  }

  /**
   * Render HTML template with data
   */
  private async renderHtmlTemplate(data: InspectionData, isProvisional: boolean): Promise<string> {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify/inspection/${data.token}`;
    const barcodeBase64 = await this.generateBarcodeBase64(data.token);
    const qrCodeBase64 = await this.generateQRCodeBase64(verificationUrl);

    const templateData = {
      ...data,
      isProvisional,
      barcodeBase64,
      qrCodeBase64,
      verificationUrl,
      generatedAt: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      dateFormatted: data.date.toLocaleDateString('pt-BR'),
      scheduledDateFormatted: data.scheduledDate?.toLocaleDateString('pt-BR') || 'N/A',
      typeLabel: this.getTypeLabel(data.type),
      statusLabel: this.getStatusLabel(data.status),
    };

    return this.getInspectionHtmlTemplate(templateData);
  }

  private getTypeLabel(type: string): string {
    const types: Record<string, string> = {
      ENTRADA: 'Vistoria de Entrada',
      SAIDA: 'Vistoria de Saída',
      PERIODICA: 'Vistoria Periódica',
      REPAROS: 'Vistoria de Reparos',
    };
    return types[type] || type;
  }

  private getStatusLabel(status: string): string {
    const statuses: Record<string, string> = {
      RASCUNHO: 'Rascunho',
      EM_ANDAMENTO: 'Em Andamento',
      AGUARDANDO_ASSINATURA: 'Aguardando Assinatura',
      CONCLUIDA: 'Concluída',
      APROVADA: 'Aprovada',
      REJEITADA: 'Rejeitada',
    };
    return statuses[status] || status;
  }

  private getConditionLabel(condition: string): string {
    const conditions: Record<string, string> = {
      BOM: 'Bom',
      REGULAR: 'Regular',
      DANIFICADO: 'Danificado',
      FALTANDO: 'Faltando',
    };
    return conditions[condition] || condition;
  }

  private getConditionColor(condition: string): string {
    const colors: Record<string, string> = {
      BOM: '#28a745',
      REGULAR: '#ffc107',
      DANIFICADO: '#dc3545',
      FALTANDO: '#6c757d',
    };
    return colors[condition] || '#333';
  }

  /**
   * Generate provisional PDF (with watermark)
   */
  async generateProvisionalPdf(inspectionId: bigint): Promise<Buffer> {
    const data = await this.getInspectionData(inspectionId);
    const html = await this.renderHtmlTemplate(data, true);

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
          top: '15mm',
          right: '12mm',
          bottom: '15mm',
          left: '12mm',
        },
      });

      const pdfBuffer = Buffer.from(pdfUint8Array);

      // Save provisional PDF
      const timestamp = Date.now();
      const filename = `inspection-provisional-${timestamp}.pdf`;
      const filePath = path.join(this.uploadsDir, 'provisional', data.id, filename);

      this.ensureDirectoryExists(path.dirname(filePath));
      fs.writeFileSync(filePath, pdfBuffer);

      // Generate and store provisional hash
      const hash = this.hashService.generateHash(pdfBuffer);
      await this.prisma.inspection.update({
        where: { id: inspectionId },
        data: {
          provisionalPdfPath: filePath,
          provisionalHash: hash,
          inspectionToken: data.token,
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
  async generateFinalPdf(inspectionId: bigint): Promise<Buffer> {
    const data = await this.getInspectionData(inspectionId);
    const html = await this.renderHtmlTemplate(data, false);

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
          top: '15mm',
          right: '12mm',
          bottom: '15mm',
          left: '12mm',
        },
      });

      const pdfBuffer = Buffer.from(pdfUint8Array);

      // Save final PDF
      const timestamp = Date.now();
      const filename = `inspection-final-${timestamp}.pdf`;
      const filePath = path.join(this.uploadsDir, 'final', data.id, filename);

      this.ensureDirectoryExists(path.dirname(filePath));
      fs.writeFileSync(filePath, pdfBuffer);

      // Generate and store final hash
      const hash = this.hashService.generateHash(pdfBuffer);
      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify/inspection/${data.token}`;

      await this.prisma.inspection.update({
        where: { id: inspectionId },
        data: {
          finalPdfPath: filePath,
          pdfReportUrl: filePath,
          hashFinal: hash,
          verificationUrl,
          reportGeneratedAt: new Date(),
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
  async getStoredPdf(inspectionId: bigint, type: 'provisional' | 'final'): Promise<Buffer | null> {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: { provisionalPdfPath: true, finalPdfPath: true },
    });

    if (!inspection) {
      throw new NotFoundException('Vistoria não encontrada');
    }

    const filePath = type === 'provisional' ? inspection.provisionalPdfPath : inspection.finalPdfPath;

    if (!filePath || !fs.existsSync(filePath)) {
      return null;
    }

    return fs.readFileSync(filePath);
  }

  /**
   * Get inspection HTML template
   */
  private getInspectionHtmlTemplate(data: any): string {
    const itemsHtml = data.items
      .map(
        (item: any, index: number) => `
        <div class="inspection-item">
          <div class="item-header">
            <span class="item-number">${index + 1}</span>
            <span class="item-room">${item.room}</span>
            <span class="item-name">${item.item}</span>
            <span class="item-condition" style="background-color: ${this.getConditionColor(item.condition)}">
              ${this.getConditionLabel(item.condition)}
            </span>
          </div>
          ${item.description ? `<p class="item-description">${item.description}</p>` : ''}
          ${
            item.needsRepair
              ? `
            <div class="repair-info">
              <span class="repair-badge">Necessita Reparo</span>
              ${item.repairCost ? `<span class="repair-cost">Custo estimado: R$ ${item.repairCost.toFixed(2)}</span>` : ''}
              ${item.responsible ? `<span class="repair-responsible">Responsável: ${item.responsible}</span>` : ''}
            </div>
          `
              : ''
          }
        </div>
      `,
      )
      .join('');

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório de Vistoria - ${data.token}</title>
  <style>
    @page {
      size: A4;
      margin: 0;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.5;
      color: #333;
      background: white;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 15mm 12mm;
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
      font-size: 60px;
      color: rgba(200, 200, 200, 0.25);
      font-weight: bold;
      white-space: nowrap;
      pointer-events: none;
      z-index: 1000;
    }
    `
        : ''
    }

    .sidebar-barcode {
      position: fixed;
      right: 3mm;
      top: 50%;
      transform: rotate(90deg) translateX(-50%);
      z-index: 100;
    }

    .sidebar-barcode img {
      max-width: 50mm;
      height: auto;
    }

    .qrcode-container {
      position: fixed;
      bottom: 20mm;
      right: 15mm;
      text-align: center;
      z-index: 100;
    }

    .qrcode-container img {
      width: 22mm;
      height: 22mm;
    }

    .qrcode-container p {
      font-size: 6pt;
      color: #666;
      margin-top: 1mm;
    }

    .header {
      text-align: center;
      margin-bottom: 15px;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 10px;
    }

    .header h1 {
      font-size: 16pt;
      font-weight: bold;
      color: #1e40af;
      margin-bottom: 3px;
    }

    .header .subtitle {
      font-size: 12pt;
      color: #3b82f6;
      margin-bottom: 5px;
    }

    .header .token {
      font-size: 9pt;
      color: #666;
      font-family: 'Courier New', monospace;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 15px;
    }

    .info-box {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 10px;
      background: #f9fafb;
    }

    .info-box h3 {
      font-size: 9pt;
      font-weight: bold;
      color: #1e40af;
      margin-bottom: 8px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 4px;
    }

    .info-box p {
      font-size: 9pt;
      margin-bottom: 3px;
    }

    .info-box .label {
      font-weight: 600;
      color: #374151;
    }

    .section {
      margin-bottom: 15px;
    }

    .section-title {
      font-size: 11pt;
      font-weight: bold;
      color: #1e40af;
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 4px;
      margin-bottom: 10px;
    }

    .inspection-item {
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 8px;
      margin-bottom: 8px;
      background: #fff;
    }

    .item-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 5px;
    }

    .item-number {
      background: #1e40af;
      color: white;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 8pt;
      font-weight: bold;
    }

    .item-room {
      font-weight: bold;
      color: #374151;
      font-size: 9pt;
    }

    .item-name {
      flex: 1;
      font-size: 9pt;
    }

    .item-condition {
      padding: 2px 8px;
      border-radius: 12px;
      color: white;
      font-size: 8pt;
      font-weight: bold;
    }

    .item-description {
      font-size: 8pt;
      color: #6b7280;
      margin-left: 30px;
    }

    .repair-info {
      margin-top: 5px;
      margin-left: 30px;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .repair-badge {
      background: #fef2f2;
      color: #dc2626;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 7pt;
      font-weight: 600;
    }

    .repair-cost, .repair-responsible {
      font-size: 7pt;
      color: #6b7280;
    }

    .notes-box {
      background: #fffbeb;
      border: 1px solid #fcd34d;
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 15px;
    }

    .notes-box h3 {
      font-size: 9pt;
      color: #b45309;
      margin-bottom: 5px;
    }

    .notes-box p {
      font-size: 9pt;
      color: #92400e;
    }

    .signatures {
      margin-top: 20px;
      page-break-inside: avoid;
    }

    .signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .signature-box {
      text-align: center;
      padding: 10px;
    }

    .signature-image {
      height: 40px;
      margin-bottom: 5px;
    }

    .signature-image img {
      max-height: 40px;
      max-width: 120px;
    }

    .signature-line {
      border-top: 1px solid #333;
      margin-top: 40px;
      padding-top: 5px;
    }

    .signature-name {
      font-weight: bold;
      font-size: 9pt;
    }

    .signature-role {
      font-size: 8pt;
      color: #666;
    }

    .signature-meta {
      font-size: 6pt;
      color: #888;
      margin-top: 3px;
    }

    .footer {
      position: fixed;
      bottom: 8mm;
      left: 12mm;
      right: 50mm;
      font-size: 6pt;
      color: #666;
      border-top: 1px solid #ddd;
      padding-top: 4px;
    }

    .footer p {
      margin-bottom: 1px;
    }

    .hash {
      font-family: 'Courier New', monospace;
      font-size: 5pt;
      word-break: break-all;
    }

    .status-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 8pt;
      font-weight: bold;
      background: #dbeafe;
      color: #1e40af;
    }
  </style>
</head>
<body>
  ${data.isProvisional ? '<div class="watermark">AGUARDANDO ASSINATURAS</div>' : ''}

  <div class="sidebar-barcode">
    <img src="${data.barcodeBase64}" alt="Codigo de barras">
  </div>

  <div class="qrcode-container">
    <img src="${data.qrCodeBase64}" alt="QR Code de verificacao">
    <p>Verifique este documento</p>
  </div>

  <div class="page">
    <div class="header">
      <h1>RELATORIO DE VISTORIA</h1>
      <p class="subtitle">${data.typeLabel}</p>
      <p class="token">Token: ${data.token}</p>
      <span class="status-badge">${data.statusLabel}</span>
    </div>

    <div class="info-grid">
      <div class="info-box">
        <h3>IMOVEL</h3>
        <p><span class="label">Endereco:</span> ${data.property.address}</p>
        <p><span class="label">Bairro:</span> ${data.property.neighborhood}</p>
        <p><span class="label">Cidade:</span> ${data.property.city}</p>
        <p><span class="label">CEP:</span> ${data.property.cep}</p>
      </div>
      <div class="info-box">
        <h3>INFORMACOES DA VISTORIA</h3>
        <p><span class="label">Data:</span> ${data.dateFormatted}</p>
        <p><span class="label">Agendada:</span> ${data.scheduledDateFormatted}</p>
        <p><span class="label">Vistoriador:</span> ${data.inspector.name}</p>
        ${data.location ? `<p><span class="label">Local:</span> ${data.location}</p>` : ''}
      </div>
    </div>

    <div class="info-grid">
      ${
        data.owner
          ? `
      <div class="info-box">
        <h3>PROPRIETARIO</h3>
        <p><span class="label">Nome:</span> ${data.owner.name}</p>
        <p><span class="label">CPF/CNPJ:</span> ${data.owner.document}</p>
        <p><span class="label">E-mail:</span> ${data.owner.email}</p>
      </div>
      `
          : ''
      }
      ${
        data.tenant
          ? `
      <div class="info-box">
        <h3>INQUILINO</h3>
        <p><span class="label">Nome:</span> ${data.tenant.name}</p>
        <p><span class="label">CPF/CNPJ:</span> ${data.tenant.document}</p>
        <p><span class="label">E-mail:</span> ${data.tenant.email}</p>
      </div>
      `
          : ''
      }
    </div>

    ${
      data.agency
        ? `
    <div class="info-box" style="margin-bottom: 15px;">
      <h3>IMOBILIARIA</h3>
      <p><span class="label">Razao Social:</span> ${data.agency.name}</p>
      <p><span class="label">CNPJ:</span> ${data.agency.cnpj}</p>
    </div>
    `
        : ''
    }

    <div class="section">
      <h2 class="section-title">ITENS VISTORIADOS</h2>
      ${itemsHtml || '<p style="color: #666; font-style: italic;">Nenhum item registrado</p>'}
    </div>

    ${
      data.notes
        ? `
    <div class="notes-box">
      <h3>OBSERVACOES</h3>
      <p>${data.notes}</p>
    </div>
    `
        : ''
    }

    <div class="signatures">
      <h2 class="section-title">ASSINATURAS</h2>

      <div class="signature-grid">
        <div class="signature-box">
          ${
            data.signatures?.inspector?.signature
              ? `
          <div class="signature-image">
            <img src="${data.signatures.inspector.signature}" alt="Assinatura do Vistoriador">
          </div>
          `
              : ''
          }
          <div class="signature-line">
            <p class="signature-name">${data.inspector.name}</p>
            <p class="signature-role">VISTORIADOR</p>
            ${
              data.signatures?.inspector
                ? `
            <p class="signature-meta">
              Assinado em: ${new Date(data.signatures.inspector.signedAt).toLocaleString('pt-BR')}<br>
              IP: ${data.signatures.inspector.ip}
              ${data.signatures.inspector.lat ? `<br>Geo: ${data.signatures.inspector.lat.toFixed(6)}, ${data.signatures.inspector.lng?.toFixed(6)}` : ''}
            </p>
            `
                : ''
            }
          </div>
        </div>

        ${
          data.owner
            ? `
        <div class="signature-box">
          ${
            data.signatures?.owner?.signature
              ? `
          <div class="signature-image">
            <img src="${data.signatures.owner.signature}" alt="Assinatura do Proprietario">
          </div>
          `
              : ''
          }
          <div class="signature-line">
            <p class="signature-name">${data.owner.name}</p>
            <p class="signature-role">PROPRIETARIO</p>
            ${
              data.signatures?.owner
                ? `
            <p class="signature-meta">
              Assinado em: ${new Date(data.signatures.owner.signedAt).toLocaleString('pt-BR')}<br>
              IP: ${data.signatures.owner.ip}
              ${data.signatures.owner.lat ? `<br>Geo: ${data.signatures.owner.lat.toFixed(6)}, ${data.signatures.owner.lng?.toFixed(6)}` : ''}
            </p>
            `
                : ''
            }
          </div>
        </div>
        `
            : ''
        }

        ${
          data.tenant
            ? `
        <div class="signature-box">
          ${
            data.signatures?.tenant?.signature
              ? `
          <div class="signature-image">
            <img src="${data.signatures.tenant.signature}" alt="Assinatura do Inquilino">
          </div>
          `
              : ''
          }
          <div class="signature-line">
            <p class="signature-name">${data.tenant.name}</p>
            <p class="signature-role">INQUILINO</p>
            ${
              data.signatures?.tenant
                ? `
            <p class="signature-meta">
              Assinado em: ${new Date(data.signatures.tenant.signedAt).toLocaleString('pt-BR')}<br>
              IP: ${data.signatures.tenant.ip}
              ${data.signatures.tenant.lat ? `<br>Geo: ${data.signatures.tenant.lat.toFixed(6)}, ${data.signatures.tenant.lng?.toFixed(6)}` : ''}
            </p>
            `
                : ''
            }
          </div>
        </div>
        `
            : ''
        }

        ${
          data.agency
            ? `
        <div class="signature-box">
          ${
            data.signatures?.agency?.signature
              ? `
          <div class="signature-image">
            <img src="${data.signatures.agency.signature}" alt="Assinatura da Imobiliaria">
          </div>
          `
              : ''
          }
          <div class="signature-line">
            <p class="signature-name">${data.agency.name}</p>
            <p class="signature-role">IMOBILIARIA</p>
            ${
              data.signatures?.agency
                ? `
            <p class="signature-meta">
              Assinado em: ${new Date(data.signatures.agency.signedAt).toLocaleString('pt-BR')}<br>
              IP: ${data.signatures.agency.ip}
              ${data.signatures.agency.lat ? `<br>Geo: ${data.signatures.agency.lat.toFixed(6)}, ${data.signatures.agency.lng?.toFixed(6)}` : ''}
            </p>
            `
                : ''
            }
          </div>
        </div>
        `
            : ''
        }
      </div>
    </div>

    <div class="footer">
      <p><strong>Token:</strong> ${data.token}</p>
      <p><strong>Gerado em:</strong> ${data.generatedAt}</p>
      <p><strong>Verificacao:</strong> ${data.verificationUrl}</p>
      ${!data.isProvisional ? `<p class="hash"><strong>Hash SHA-256:</strong> Calculado apos geracao final</p>` : ''}
    </div>
  </div>
</body>
</html>
    `;
  }
}
