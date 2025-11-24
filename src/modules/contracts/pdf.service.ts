import puppeteer from 'puppeteer';
import { Decimal } from '@prisma/client/runtime/library';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { Canvas, createCanvas } from 'canvas';

interface ContractData {
  property: {
    name?: string | null;
    address: string;
    city: string;
    neighborhood: string;
    monthlyRent?: number | Decimal | null;
  };
  owner: {
    name?: string | null;
    document?: string | null;
    email: string;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
  };
  tenant: {
    name?: string | null;
    document?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
  };
  startDate: string;
  endDate: string;
  monthlyRent: number;
  city: string;
  index: string;
  contractToken?: string;
  contractHash?: string;
  creci?: string | null;
  templateId?: string | null;
  templateContent?: string | null;
  brokerName?: string | null;
}

export async function generateContractPDF(data: ContractData): Promise<Buffer> {
  // Generate QR code and barcode
  const qrCodeDataUrl = await generateQRCode(data.contractHash || data.contractToken || '');
  const barcodeDataUrl = await generateBarcode(data.contractToken || '');

  const html = generateContractHTML(data, qrCodeDataUrl, barcodeDataUrl);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '25mm', // Extra left margin for barcode
      },
      printBackground: true,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

async function generateQRCode(data: string): Promise<string> {
  if (!data) return '';
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 100,
      margin: 1,
    });
    return qrCodeDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    return '';
  }
}

async function generateBarcode(data: string): Promise<string> {
  if (!data) return '';
  try {
    const canvas = createCanvas(200, 60);
    JsBarcode(canvas, data, {
      format: 'CODE128',
      width: 2,
      height: 40,
      displayValue: true,
      fontSize: 12,
    });
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error generating barcode:', error);
    return '';
  }
}

function generateContractHTML(data: ContractData, qrCodeDataUrl: string, barcodeDataUrl: string): string {
  const startDate = new Date(data.startDate).toLocaleDateString('pt-BR');
  const endDate = new Date(data.endDate).toLocaleDateString('pt-BR');
  const today = new Date().toLocaleDateString('pt-BR');
  const verificationUrl = data.contractHash 
    ? `https://mr3x.com.br/verify/${data.contractHash}`
    : data.contractToken 
      ? `https://mr3x.com.br/verify/${data.contractToken}`
      : '';

  // If template content is provided, use it and replace placeholders
  if (data.templateContent) {
    return generateTemplateHTML(data, qrCodeDataUrl, barcodeDataUrl, verificationUrl);
  }

  // Otherwise, use default template
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contrato de Locação</title>
  <style>
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #000;
      margin: 0;
      padding: 0;
      position: relative;
    }
    .barcode-sidebar {
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      width: 20mm;
      display: flex;
      align-items: center;
      justify-content: center;
      writing-mode: vertical-rl;
      text-orientation: mixed;
    }
    .barcode-sidebar img {
      transform: rotate(-90deg);
      max-width: 100%;
      max-height: 100%;
    }
    .security-section {
      border: 1px solid #ccc;
      padding: 10px;
      margin: 20px 0;
      background-color: #f9f9f9;
      font-size: 9pt;
    }
    .security-section h3 {
      margin-top: 0;
      font-size: 10pt;
    }
    .qr-code-container {
      text-align: center;
      margin: 10px 0;
    }
    .qr-code-container img {
      max-width: 100px;
      height: auto;
    }
    .token-info {
      font-family: monospace;
      font-size: 8pt;
      word-break: break-all;
    }
    .container {
      max-width: 100%;
      margin: 0 auto;
    }
    h1 {
      text-align: center;
      font-size: 16pt;
      font-weight: bold;
      margin-bottom: 30px;
    }
    h2 {
      font-size: 14pt;
      font-weight: bold;
      margin-top: 20px;
      margin-bottom: 10px;
    }
    p {
      text-align: justify;
      margin-bottom: 15px;
    }
    .clause {
      margin-bottom: 15px;
    }
    .clause-title {
      font-weight: bold;
      margin-bottom: 5px;
    }
    .signature-section {
      margin-top: 60px;
      page-break-inside: avoid;
    }
    .signature-line {
      border-top: 1px solid #000;
      width: 250px;
      margin: 60px auto 5px;
    }
    .signature-name {
      text-align: center;
      font-size: 10pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #000;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
  </style>
</head>
<body>
  ${barcodeDataUrl ? `
  <div class="barcode-sidebar">
    <img src="${barcodeDataUrl}" alt="Barcode" />
  </div>
  ` : ''}
  <div class="container" style="${barcodeDataUrl ? 'margin-left: 25mm;' : ''}">
    ${qrCodeDataUrl ? `
    <div style="text-align: right; margin-bottom: 10px;">
      <img src="${qrCodeDataUrl}" alt="QR Code" style="width: 80px; height: 80px;" />
    </div>
    ` : ''}
    <h1>CONTRATO DE LOCAÇÃO RESIDENCIAL</h1>
    
    ${data.contractToken || data.contractHash || data.creci ? `
    <div class="security-section">
      <h3>INFORMAÇÕES DE SEGURANÇA E VERIFICAÇÃO</h3>
      ${data.contractToken ? `<p><strong>Token do Contrato:</strong> <span class="token-info">${data.contractToken}</span></p>` : ''}
      ${data.contractHash ? `<p><strong>Hash SHA-256:</strong> <span class="token-info">${data.contractHash}</span></p>` : ''}
      ${data.creci ? `<p><strong>CRECI:</strong> ${data.creci}</p>` : ''}
      ${verificationUrl ? `<p><strong>Verificação:</strong> <a href="${verificationUrl}">${verificationUrl}</a></p>` : ''}
      <p><strong>Data de Geração:</strong> ${new Date().toLocaleString('pt-BR')}</p>
    </div>
    ` : ''}

    <h2>PARTES CONTRATANTES</h2>
    
    <p><strong>LOCADOR(A):</strong> ${data.owner.name || 'Não informado'}, ${data.owner.document ? `CPF/CNPJ: ${data.owner.document}` : ''}, 
    residente e domiciliado(a) em ${data.owner.address || ''}, ${data.owner.city || ''} - ${data.owner.state || ''}, 
    e-mail: ${data.owner.email}, telefone: ${data.owner.phone || 'Não informado'}.</p>

    <p><strong>LOCATÁRIO(A):</strong> ${data.tenant.name || 'Não informado'}, ${data.tenant.document ? `CPF/CNPJ: ${data.tenant.document}` : ''}, 
    residente e domiciliado(a) em ${data.tenant.address || ''}, ${data.tenant.city || ''} - ${data.tenant.state || ''}, 
    e-mail: ${data.tenant.email || 'Não informado'}, telefone: ${data.tenant.phone || 'Não informado'}.</p>

    <h2>OBJETO DO CONTRATO</h2>

    <p>O presente contrato tem por objeto a locação do imóvel situado em <strong>${data.property.address}, 
    ${data.property.neighborhood}, ${data.property.city}</strong>, 
    que o LOCADOR dá em locação ao LOCATÁRIO, que aceita, mediante as cláusulas e condições seguintes:</p>

    <h2>CLÁUSULAS CONTRATUAIS</h2>

    <div class="clause">
      <div class="clause-title">CLÁUSULA 1ª - DO PRAZO</div>
      <p>O prazo de locação é de <strong>${calculateMonths(data.startDate, data.endDate)} meses</strong>, 
      com início em <strong>${startDate}</strong> e término em <strong>${endDate}</strong>, 
      podendo ser prorrogado mediante acordo entre as partes.</p>
    </div>

    <div class="clause">
      <div class="clause-title">CLÁUSULA 2ª - DO ALUGUEL</div>
      <p>O valor mensal do aluguel é de <strong>R$ ${data.monthlyRent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>, 
      devendo ser pago até o dia 10 (dez) de cada mês, mediante depósito bancário ou transferência para a conta indicada pelo LOCADOR.</p>
    </div>

    <div class="clause">
      <div class="clause-title">CLÁUSULA 3ª - DO REAJUSTE</div>
      <p>O valor do aluguel será reajustado anualmente pela variação do índice <strong>${data.index}</strong>, 
      ou na sua falta, por outro índice que legalmente o substitua.</p>
    </div>

    <div class="clause">
      <div class="clause-title">CLÁUSULA 4ª - DAS OBRIGAÇÕES DO LOCATÁRIO</div>
      <p>São obrigações do LOCATÁRIO:</p>
      <ul>
        <li>Pagar pontualmente o aluguel e os encargos da locação;</li>
        <li>Usar o imóvel exclusivamente para fins residenciais;</li>
        <li>Conservar o imóvel em bom estado de conservação;</li>
        <li>Realizar pequenos reparos e manutenções necessárias;</li>
        <li>Permitir vistorias pelo LOCADOR mediante prévio aviso;</li>
        <li>Não realizar modificações no imóvel sem autorização;</li>
        <li>Restituir o imóvel ao término do contrato nas mesmas condições;</li>
        <li>Comunicar imediatamente qualquer dano ou defeito no imóvel.</li>
      </ul>
    </div>

    <div class="clause">
      <div class="clause-title">CLÁUSULA 5ª - DAS OBRIGAÇÕES DO LOCADOR</div>
      <p>São obrigações do LOCADOR:</p>
      <ul>
        <li>Entregar o imóvel em condições de uso;</li>
        <li>Garantir o uso pacífico do imóvel;</li>
        <li>Realizar reparos estruturais necessários;</li>
        <li>Pagar tributos e taxas que sejam de sua responsabilidade;</li>
        <li>Manter o imóvel em condições de habitabilidade.</li>
      </ul>
    </div>

    <div class="clause">
      <div class="clause-title">CLÁUSULA 6ª - DA RESCISÃO</div>
      <p>O presente contrato poderá ser rescindido por qualquer das partes, mediante aviso prévio de 30 (trinta) dias, 
      ou conforme previsto na legislação vigente. Em caso de descumprimento de qualquer cláusula, 
      a parte infratora estará sujeita às penalidades previstas em lei.</p>
    </div>

    <div class="clause">
      <div class="clause-title">CLÁUSULA 7ª - DAS DISPOSIÇÕES GERAIS</div>
      <p>As partes elegem o foro da comarca de <strong>${data.city}</strong> para dirimir quaisquer dúvidas 
      ou controvérsias oriundas do presente contrato.</p>
    </div>

    <p>E, por estarem assim justas e contratadas, as partes assinam o presente instrumento em 02 (duas) vias 
    de igual teor e forma, na presença de 02 (duas) testemunhas.</p>

    <p style="text-align: right; margin-top: 40px;">${data.city}, ${today}</p>

    <div class="signature-section">
      <div class="signature-line"></div>
      <div class="signature-name">${data.owner.name || 'LOCADOR(A)'}<br>CPF/CNPJ: ${data.owner.document || ''}</div>
    </div>

    <div class="signature-section">
      <div class="signature-line"></div>
      <div class="signature-name">${data.tenant.name || 'LOCATÁRIO(A)'}<br>CPF/CNPJ: ${data.tenant.document || ''}</div>
    </div>

    <h2 style="margin-top: 60px;">TESTEMUNHAS</h2>

    <div class="signature-section">
      <div class="signature-line"></div>
      <div class="signature-name">Testemunha 1<br>CPF: _________________</div>
    </div>

    <div class="signature-section">
      <div class="signature-line"></div>
      <div class="signature-name">Testemunha 2<br>CPF: _________________</div>
    </div>
  </div>
</body>
</html>
  `;
}

function calculateMonths(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return months;
}

function generateTemplateHTML(data: ContractData, qrCodeDataUrl: string, barcodeDataUrl: string, verificationUrl: string): string {
  const startDate = new Date(data.startDate).toLocaleDateString('pt-BR');
  const endDate = new Date(data.endDate).toLocaleDateString('pt-BR');
  const today = new Date().toLocaleDateString('pt-BR');
  const months = calculateMonths(data.startDate, data.endDate);

  // Replace placeholders in template content
  let templateContent = data.templateContent || '';
  
  // Calculate months
  const replacements: Record<string, string> = {
    NOME_CORRETOR: data.brokerName || '',
    CRECI_CORRETOR: data.creci || '',
    NOME_LOCADOR: data.owner.name || '',
    CPF_LOCADOR: data.owner.document || '',
    CNPJ_LOCADOR: data.owner.document || '',
    ENDERECO_LOCADOR: data.owner.address || '',
    EMAIL_LOCADOR: data.owner.email || '',
    TELEFONE_LOCADOR: data.owner.phone || '',
    NOME_LOCATARIO: data.tenant.name || '',
    CPF_LOCATARIO: data.tenant.document || '',
    CNPJ_LOCATARIO: data.tenant.document || '',
    ENDERECO_LOCATARIO: data.tenant.address || '',
    EMAIL_LOCATARIO: data.tenant.email || '',
    TELEFONE_LOCATARIO: data.tenant.phone || '',
    ENDERECO_IMOVEL: data.property.address || '',
    DESCRICAO_IMOVEL: data.property.name || data.property.address || '',
    PRAZO_MESES: months.toString(),
    DATA_INICIO: startDate,
    DATA_FIM: endDate,
    VALOR_ALUGUEL: data.monthlyRent.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    DIA_VENCIMENTO: '10',
    INDICE_REAJUSTE: data.index || 'IGPM',
    TIPO_GARANTIA: 'Caução',
    COMARCA: data.city || '',
    CIDADE: data.city || '',
    DATA_ASSINATURA: today,
    RAZAO_SOCIAL_LOCADOR: data.owner.name || '',
    REPRESENTANTE_LOCADOR: data.owner.name || '',
    CPF_REPRESENTANTE_LOCADOR: data.owner.document || '',
    CARGO_LOCADOR: 'Representante Legal',
    RAZAO_SOCIAL_LOCATARIO: data.tenant.name || '',
    REPRESENTANTE_LOCATARIO: data.tenant.name || '',
    CPF_REPRESENTANTE_LOCATARIO: data.tenant.document || '',
    CARGO_LOCATARIO: 'Representante Legal',
  };

  // Replace all placeholders
  for (const [key, value] of Object.entries(replacements)) {
    templateContent = templateContent.replace(new RegExp(`\\[${key}\\]`, 'g'), value || '');
  }

  // Convert markdown-style formatting to HTML
  templateContent = templateContent
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contrato</title>
  <style>
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #000;
      margin: 0;
      padding: 0;
      position: relative;
    }
    .barcode-sidebar {
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      width: 20mm;
      display: flex;
      align-items: center;
      justify-content: center;
      writing-mode: vertical-rl;
      text-orientation: mixed;
    }
    .barcode-sidebar img {
      transform: rotate(-90deg);
      max-width: 100%;
      max-height: 100%;
    }
    .security-section {
      border: 1px solid #ccc;
      padding: 10px;
      margin: 20px 0;
      background-color: #f9f9f9;
      font-size: 9pt;
    }
    .security-section h3 {
      margin-top: 0;
      font-size: 10pt;
    }
    .token-info {
      font-family: monospace;
      font-size: 8pt;
      word-break: break-all;
    }
    .container {
      max-width: 100%;
      margin: 0 auto;
      ${barcodeDataUrl ? 'margin-left: 25mm;' : ''}
    }
    h1 {
      text-align: center;
      font-size: 16pt;
      font-weight: bold;
      margin-bottom: 30px;
    }
    h2 {
      font-size: 14pt;
      font-weight: bold;
      margin-top: 20px;
      margin-bottom: 10px;
    }
    p {
      text-align: justify;
      margin-bottom: 15px;
    }
    strong {
      font-weight: bold;
    }
  </style>
</head>
<body>
  ${barcodeDataUrl ? `
  <div class="barcode-sidebar">
    <img src="${barcodeDataUrl}" alt="Barcode" />
  </div>
  ` : ''}
  <div class="container">
    ${qrCodeDataUrl ? `
    <div style="text-align: right; margin-bottom: 10px;">
      <img src="${qrCodeDataUrl}" alt="QR Code" style="width: 80px; height: 80px;" />
    </div>
    ` : ''}
    
    ${data.contractToken || data.contractHash || data.creci ? `
    <div class="security-section">
      <h3>INFORMAÇÕES DE SEGURANÇA E VERIFICAÇÃO</h3>
      ${data.contractToken ? `<p><strong>Token do Contrato:</strong> <span class="token-info">${data.contractToken}</span></p>` : ''}
      ${data.contractHash ? `<p><strong>Hash SHA-256:</strong> <span class="token-info">${data.contractHash}</span></p>` : ''}
      ${data.creci ? `<p><strong>CRECI:</strong> ${data.creci}</p>` : ''}
      ${verificationUrl ? `<p><strong>Verificação:</strong> <a href="${verificationUrl}">${verificationUrl}</a></p>` : ''}
      <p><strong>Data de Geração:</strong> ${new Date().toLocaleString('pt-BR')}</p>
    </div>
    ` : ''}

    <div style="white-space: pre-wrap;">${templateContent}</div>
  </div>
</body>
</html>
  `;
}

