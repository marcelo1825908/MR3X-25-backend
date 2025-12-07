import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@config/prisma.service';
import * as puppeteer from 'puppeteer';
import * as bwipjs from 'bwip-js';
import * as QRCode from 'qrcode';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { ContractHashService } from './contract-hash.service';

interface ContractData {
  id: string;
  token: string;
  status: string;
  startDate: Date;
  endDate: Date;
  monthlyRent: number;
  deposit: number | null;
  dueDay: number | null;
  description: string | null;
  clauses: any;
  tenant: {
    name: string;
    document: string;
    email: string;
    address: string;
  };
  owner: {
    name: string;
    document: string;
    email: string;
    address: string;
  };
  property: {
    address: string;
    city: string;
    neighborhood: string;
    cep: string;
  };
  agency?: {
    name: string;
    cnpj: string;
  };
  signatures?: {
    tenant?: { signature: string; signedAt: Date; ip: string; lat?: number; lng?: number };
    owner?: { signature: string; signedAt: Date; ip: string; lat?: number; lng?: number };
    agency?: { signature: string; signedAt: Date; ip: string; lat?: number; lng?: number };
    witness?: { signature: string; signedAt: Date; name: string; document: string; lat?: number; lng?: number };
  };
}

@Injectable()
export class ContractPdfService {
  private readonly uploadsDir: string;
  private readonly templatesDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly hashService: ContractHashService,
  ) {
    this.uploadsDir = path.join(process.cwd(), 'uploads', 'contracts');
    this.templatesDir = path.join(__dirname, '..', 'templates');

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
   * Generate unique token in format MR3X-CTR-YEAR-XXXX-XXXX
   */
  generateContractToken(): string {
    const year = new Date().getFullYear();
    const random1 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const random2 = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `MR3X-CTR-${year}-${random1}-${random2}`;
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
   * Get contract data for PDF generation
   */
  private async getContractData(contractId: bigint): Promise<ContractData> {
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
      throw new NotFoundException('Contrato não encontrado');
    }

    return {
      id: contract.id.toString(),
      token: contract.contractToken || this.generateContractToken(),
      status: contract.status,
      startDate: contract.startDate,
      endDate: contract.endDate,
      monthlyRent: Number(contract.monthlyRent),
      deposit: contract.deposit ? Number(contract.deposit) : null,
      dueDay: contract.dueDay,
      description: contract.description,
      clauses: contract.clausesSnapshot || {},
      tenant: {
        name: contract.tenantUser.name || 'N/A',
        document: contract.tenantUser.document || 'N/A',
        email: contract.tenantUser.email,
        address: `${contract.tenantUser.address || ''}, ${contract.tenantUser.neighborhood || ''} - ${contract.tenantUser.city || ''}, ${contract.tenantUser.state || ''}`,
      },
      owner: {
        name: contract.ownerUser?.name || 'N/A',
        document: contract.ownerUser?.document || 'N/A',
        email: contract.ownerUser?.email || 'N/A',
        address: contract.ownerUser
          ? `${contract.ownerUser.address || ''}, ${contract.ownerUser.neighborhood || ''} - ${contract.ownerUser.city || ''}, ${contract.ownerUser.state || ''}`
          : 'N/A',
      },
      property: {
        address: contract.property.address,
        city: contract.property.city,
        neighborhood: contract.property.neighborhood,
        cep: contract.property.cep,
      },
      agency: contract.agency
        ? {
            name: contract.agency.name,
            cnpj: contract.agency.cnpj,
          }
        : undefined,
      signatures: {
        tenant: contract.tenantSignature
          ? {
              signature: contract.tenantSignature,
              signedAt: contract.tenantSignedAt!,
              ip: contract.tenantSignedIP || 'N/A',
              lat: contract.tenantGeoLat || undefined,
              lng: contract.tenantGeoLng || undefined,
            }
          : undefined,
        owner: contract.ownerSignature
          ? {
              signature: contract.ownerSignature,
              signedAt: contract.ownerSignedAt!,
              ip: contract.ownerSignedIP || 'N/A',
              lat: contract.ownerGeoLat || undefined,
              lng: contract.ownerGeoLng || undefined,
            }
          : undefined,
        agency: contract.agencySignature
          ? {
              signature: contract.agencySignature,
              signedAt: contract.agencySignedAt!,
              ip: contract.agencySignedIP || 'N/A',
              lat: contract.agencyGeoLat || undefined,
              lng: contract.agencyGeoLng || undefined,
            }
          : undefined,
        witness: contract.witnessSignature
          ? {
              signature: contract.witnessSignature,
              signedAt: contract.witnessSignedAt!,
              name: contract.witnessName || 'N/A',
              document: contract.witnessDocument || 'N/A',
              lat: contract.witnessGeoLat || undefined,
              lng: contract.witnessGeoLng || undefined,
            }
          : undefined,
      },
    };
  }

  /**
   * Render HTML template with data
   */
  private async renderHtmlTemplate(data: ContractData, isProvisional: boolean): Promise<string> {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify/${data.token}`;
    const barcodeBase64 = await this.generateBarcodeBase64(data.token);
    const qrCodeBase64 = await this.generateQRCodeBase64(verificationUrl);

    const templateData = {
      ...data,
      isProvisional,
      barcodeBase64,
      qrCodeBase64,
      verificationUrl,
      generatedAt: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      monthlyRentFormatted: data.monthlyRent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      depositFormatted: data.deposit?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'N/A',
      startDateFormatted: data.startDate.toLocaleDateString('pt-BR'),
      endDateFormatted: data.endDate.toLocaleDateString('pt-BR'),
    };

    // Get HTML template
    const html = this.getContractHtmlTemplate(templateData);
    return html;
  }

  /**
   * Generate provisional PDF (with watermark)
   */
  async generateProvisionalPdf(contractId: bigint): Promise<Buffer> {
    const data = await this.getContractData(contractId);
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
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
      });

      // Convert Uint8Array to Buffer
      const pdfBuffer = Buffer.from(pdfUint8Array);

      // Save provisional PDF
      const timestamp = Date.now();
      const filename = `contract-provisional-${timestamp}.pdf`;
      const filePath = path.join(this.uploadsDir, 'provisional', data.id, filename);

      this.ensureDirectoryExists(path.dirname(filePath));
      fs.writeFileSync(filePath, pdfBuffer);

      // Generate and store provisional hash
      const hash = this.hashService.generateHash(pdfBuffer);
      await this.prisma.contract.update({
        where: { id: contractId },
        data: {
          provisionalPdfPath: filePath,
          provisionalHash: hash,
          contractToken: data.token,
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
  async generateFinalPdf(contractId: bigint): Promise<Buffer> {
    const data = await this.getContractData(contractId);
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
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
      });

      // Convert Uint8Array to Buffer
      const pdfBuffer = Buffer.from(pdfUint8Array);

      // Save final PDF
      const timestamp = Date.now();
      const filename = `contract-final-${timestamp}.pdf`;
      const filePath = path.join(this.uploadsDir, 'final', data.id, filename);

      this.ensureDirectoryExists(path.dirname(filePath));
      fs.writeFileSync(filePath, pdfBuffer);

      // Generate and store final hash
      const hash = this.hashService.generateHash(pdfBuffer);
      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify/${data.token}`;

      await this.prisma.contract.update({
        where: { id: contractId },
        data: {
          finalPdfPath: filePath,
          hashFinal: hash,
          verificationUrl,
        },
      });

      return pdfBuffer;
    } finally {
      await browser.close();
    }
  }

  /**
   * Get contract HTML template
   */
  private getContractHtmlTemplate(data: any): string {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contrato de Locação - ${data.token}</title>
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
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #333;
      background: white;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 20mm 15mm;
      position: relative;
    }

    /* Watermark for provisional */
    ${data.isProvisional ? `
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
    ` : ''}

    /* Sidebar barcode */
    .sidebar-barcode {
      position: fixed;
      right: 5mm;
      top: 50%;
      transform: rotate(90deg) translateX(-50%);
      z-index: 100;
    }

    .sidebar-barcode img {
      max-width: 60mm;
      height: auto;
    }

    /* QR Code */
    .qrcode-container {
      position: fixed;
      bottom: 25mm;
      right: 20mm;
      text-align: center;
      z-index: 100;
    }

    .qrcode-container img {
      width: 25mm;
      height: 25mm;
    }

    .qrcode-container p {
      font-size: 7pt;
      color: #666;
      margin-top: 2mm;
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

    .header .token {
      font-size: 10pt;
      color: #666;
      font-family: 'Courier New', monospace;
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

    /* Contract details */
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

    /* Clauses */
    .clauses {
      text-align: justify;
    }

    .clause {
      margin-bottom: 15px;
    }

    .clause-title {
      font-weight: bold;
      margin-bottom: 5px;
    }

    /* Signatures */
    .signatures {
      margin-top: 40px;
      page-break-inside: avoid;
    }

    .signature-row {
      display: flex;
      gap: 30px;
      margin-bottom: 30px;
    }

    .signature-box {
      flex: 1;
      text-align: center;
    }

    .signature-line {
      border-top: 1px solid #333;
      margin-top: 60px;
      padding-top: 5px;
    }

    .signature-image {
      height: 50px;
      margin-bottom: 10px;
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

    /* Footer */
    .footer {
      position: fixed;
      bottom: 10mm;
      left: 15mm;
      right: 60mm;
      font-size: 7pt;
      color: #666;
      border-top: 1px solid #ddd;
      padding-top: 5px;
    }

    .footer p {
      margin-bottom: 2px;
    }

    .hash {
      font-family: 'Courier New', monospace;
      font-size: 6pt;
      word-break: break-all;
    }
  </style>
</head>
<body>
  ${data.isProvisional ? '<div class="watermark">AGUARDANDO ASSINATURAS</div>' : ''}

  <div class="sidebar-barcode">
    <img src="${data.barcodeBase64}" alt="Código de barras">
  </div>

  <div class="qrcode-container">
    <img src="${data.qrCodeBase64}" alt="QR Code de verificação">
    <p>Verifique este documento</p>
  </div>

  <div class="page">
    <div class="header">
      <h1>CONTRATO DE LOCAÇÃO RESIDENCIAL</h1>
      <p class="token">Token: ${data.token}</p>
    </div>

    <div class="section">
      <h2 class="section-title">PARTES CONTRATANTES</h2>
      <div class="parties">
        <div class="party">
          <h3>LOCADOR (Proprietário)</h3>
          <p><span class="label">Nome:</span> ${data.owner.name}</p>
          <p><span class="label">CPF/CNPJ:</span> ${data.owner.document}</p>
          <p><span class="label">E-mail:</span> ${data.owner.email}</p>
          <p><span class="label">Endereço:</span> ${data.owner.address}</p>
        </div>
        <div class="party">
          <h3>LOCATÁRIO (Inquilino)</h3>
          <p><span class="label">Nome:</span> ${data.tenant.name}</p>
          <p><span class="label">CPF/CNPJ:</span> ${data.tenant.document}</p>
          <p><span class="label">E-mail:</span> ${data.tenant.email}</p>
          <p><span class="label">Endereço:</span> ${data.tenant.address}</p>
        </div>
      </div>
    </div>

    ${data.agency ? `
    <div class="section">
      <h2 class="section-title">IMOBILIÁRIA</h2>
      <div class="property-info">
        <p><span class="label">Razão Social:</span> ${data.agency.name}</p>
        <p><span class="label">CNPJ:</span> ${data.agency.cnpj}</p>
      </div>
    </div>
    ` : ''}

    <div class="section">
      <h2 class="section-title">IMÓVEL OBJETO DA LOCAÇÃO</h2>
      <div class="property-info">
        <p><span class="label">Endereço:</span> ${data.property.address}</p>
        <p><span class="label">Bairro:</span> ${data.property.neighborhood}</p>
        <p><span class="label">Cidade:</span> ${data.property.city}</p>
        <p><span class="label">CEP:</span> ${data.property.cep}</p>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">CONDIÇÕES FINANCEIRAS</h2>
      <div class="contract-details">
        <div class="detail-box">
          <p class="label">Valor do Aluguel</p>
          <p class="value">${data.monthlyRentFormatted}</p>
        </div>
        <div class="detail-box">
          <p class="label">Caução/Depósito</p>
          <p class="value">${data.depositFormatted}</p>
        </div>
        <div class="detail-box">
          <p class="label">Dia de Vencimento</p>
          <p class="value">${data.dueDay || 'N/A'}</p>
        </div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">PRAZO DO CONTRATO</h2>
      <div class="contract-details">
        <div class="detail-box">
          <p class="label">Data de Início</p>
          <p class="value">${data.startDateFormatted}</p>
        </div>
        <div class="detail-box">
          <p class="label">Data de Término</p>
          <p class="value">${data.endDateFormatted}</p>
        </div>
        <div class="detail-box">
          <p class="label">Duração</p>
          <p class="value">${this.calculateDuration(data.startDate, data.endDate)}</p>
        </div>
      </div>
    </div>

    ${data.clauses && Object.keys(data.clauses).length > 0 ? `
    <div class="section clauses">
      <h2 class="section-title">CLÁUSULAS E CONDIÇÕES</h2>
      ${this.renderClauses(data.clauses)}
    </div>
    ` : `
    <div class="section clauses">
      <h2 class="section-title">CLÁUSULAS E CONDIÇÕES</h2>
      <div class="clause">
        <p class="clause-title">CLÁUSULA PRIMEIRA - DO OBJETO</p>
        <p>O LOCADOR cede ao LOCATÁRIO o imóvel acima descrito, para fins exclusivamente residenciais.</p>
      </div>
      <div class="clause">
        <p class="clause-title">CLÁUSULA SEGUNDA - DO PRAZO</p>
        <p>O prazo da presente locação é de ${this.calculateDuration(data.startDate, data.endDate)}, iniciando-se em ${data.startDateFormatted} e terminando em ${data.endDateFormatted}.</p>
      </div>
      <div class="clause">
        <p class="clause-title">CLÁUSULA TERCEIRA - DO ALUGUEL</p>
        <p>O valor do aluguel mensal é de ${data.monthlyRentFormatted}, a ser pago até o dia ${data.dueDay || '5'} de cada mês.</p>
      </div>
      <div class="clause">
        <p class="clause-title">CLÁUSULA QUARTA - DA CAUÇÃO</p>
        <p>O LOCATÁRIO entrega ao LOCADOR, a título de caução, o valor de ${data.depositFormatted}, que será devolvido ao final da locação, corrigido monetariamente.</p>
      </div>
    </div>
    `}

    <div class="signatures">
      <h2 class="section-title">ASSINATURAS</h2>

      <div class="signature-row">
        <div class="signature-box">
          ${data.signatures?.owner?.signature ? `
          <div class="signature-image">
            <img src="${data.signatures.owner.signature}" alt="Assinatura do Locador">
          </div>
          ` : ''}
          <div class="signature-line">
            <p class="signature-name">${data.owner.name}</p>
            <p class="signature-doc">LOCADOR - ${data.owner.document}</p>
            ${data.signatures?.owner ? `
            <p class="signature-meta">
              Assinado em: ${new Date(data.signatures.owner.signedAt).toLocaleString('pt-BR')}<br>
              IP: ${data.signatures.owner.ip}
              ${data.signatures.owner.lat ? `<br>Geo: ${data.signatures.owner.lat.toFixed(6)}, ${data.signatures.owner.lng?.toFixed(6)}` : ''}
            </p>
            ` : ''}
          </div>
        </div>
        <div class="signature-box">
          ${data.signatures?.tenant?.signature ? `
          <div class="signature-image">
            <img src="${data.signatures.tenant.signature}" alt="Assinatura do Locatário">
          </div>
          ` : ''}
          <div class="signature-line">
            <p class="signature-name">${data.tenant.name}</p>
            <p class="signature-doc">LOCATÁRIO - ${data.tenant.document}</p>
            ${data.signatures?.tenant ? `
            <p class="signature-meta">
              Assinado em: ${new Date(data.signatures.tenant.signedAt).toLocaleString('pt-BR')}<br>
              IP: ${data.signatures.tenant.ip}
              ${data.signatures.tenant.lat ? `<br>Geo: ${data.signatures.tenant.lat.toFixed(6)}, ${data.signatures.tenant.lng?.toFixed(6)}` : ''}
            </p>
            ` : ''}
          </div>
        </div>
      </div>

      ${data.agency || data.signatures?.agency ? `
      <div class="signature-row">
        <div class="signature-box">
          ${data.signatures?.agency?.signature ? `
          <div class="signature-image">
            <img src="${data.signatures.agency.signature}" alt="Assinatura da Imobiliária">
          </div>
          ` : ''}
          <div class="signature-line">
            <p class="signature-name">${data.agency?.name || 'Imobiliária'}</p>
            <p class="signature-doc">IMOBILIÁRIA - ${data.agency?.cnpj || 'N/A'}</p>
            ${data.signatures?.agency ? `
            <p class="signature-meta">
              Assinado em: ${new Date(data.signatures.agency.signedAt).toLocaleString('pt-BR')}<br>
              IP: ${data.signatures.agency.ip}
              ${data.signatures.agency.lat ? `<br>Geo: ${data.signatures.agency.lat.toFixed(6)}, ${data.signatures.agency.lng?.toFixed(6)}` : ''}
            </p>
            ` : ''}
          </div>
        </div>
        <div class="signature-box">
          ${data.signatures?.witness?.signature ? `
          <div class="signature-image">
            <img src="${data.signatures.witness.signature}" alt="Assinatura da Testemunha">
          </div>
          ` : ''}
          <div class="signature-line">
            <p class="signature-name">${data.signatures?.witness?.name || 'Testemunha'}</p>
            <p class="signature-doc">TESTEMUNHA - ${data.signatures?.witness?.document || 'N/A'}</p>
            ${data.signatures?.witness ? `
            <p class="signature-meta">
              Assinado em: ${new Date(data.signatures.witness.signedAt).toLocaleString('pt-BR')}
              ${data.signatures.witness.lat ? `<br>Geo: ${data.signatures.witness.lat.toFixed(6)}, ${data.signatures.witness.lng?.toFixed(6)}` : ''}
            </p>
            ` : ''}
          </div>
        </div>
      </div>
      ` : ''}
    </div>

    <div class="footer">
      <p><strong>Token:</strong> ${data.token}</p>
      <p><strong>Gerado em:</strong> ${data.generatedAt}</p>
      <p><strong>Verificação:</strong> ${data.verificationUrl}</p>
      ${!data.isProvisional ? `<p class="hash"><strong>Hash SHA-256:</strong> Este hash será calculado após a geração final do documento</p>` : ''}
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Calculate duration between two dates
   */
  private calculateDuration(startDate: Date, endDate: Date): string {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const months = Math.floor(diffDays / 30);
    const years = Math.floor(months / 12);

    if (years > 0) {
      const remainingMonths = months % 12;
      return `${years} ano${years > 1 ? 's' : ''}${remainingMonths > 0 ? ` e ${remainingMonths} mês${remainingMonths > 1 ? 'es' : ''}` : ''}`;
    }
    return `${months} mês${months > 1 ? 'es' : ''}`;
  }

  /**
   * Render clauses from JSON
   */
  private renderClauses(clauses: any): string {
    if (!clauses || typeof clauses !== 'object') {
      return '';
    }

    let html = '';
    let clauseNumber = 1;

    for (const [key, value] of Object.entries(clauses)) {
      if (typeof value === 'string') {
        html += `
          <div class="clause">
            <p class="clause-title">CLÁUSULA ${this.toRoman(clauseNumber)} - ${key.toUpperCase()}</p>
            <p>${value}</p>
          </div>
        `;
        clauseNumber++;
      }
    }

    return html;
  }

  /**
   * Convert number to Roman numeral
   */
  private toRoman(num: number): string {
    const roman: { [key: string]: number } = {
      M: 1000,
      CM: 900,
      D: 500,
      CD: 400,
      C: 100,
      XC: 90,
      L: 50,
      XL: 40,
      X: 10,
      IX: 9,
      V: 5,
      IV: 4,
      I: 1,
    };

    let result = '';
    for (const key of Object.keys(roman)) {
      while (num >= roman[key]) {
        result += key;
        num -= roman[key];
      }
    }
    return result;
  }

  /**
   * Get stored PDF file
   */
  async getStoredPdf(contractId: bigint, type: 'provisional' | 'final'): Promise<Buffer | null> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: { provisionalPdfPath: true, finalPdfPath: true },
    });

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado');
    }

    const filePath = type === 'provisional' ? contract.provisionalPdfPath : contract.finalPdfPath;

    if (!filePath || !fs.existsSync(filePath)) {
      return null;
    }

    return fs.readFileSync(filePath);
  }
}
