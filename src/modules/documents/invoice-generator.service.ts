import puppeteer from 'puppeteer';

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  ownerName: string;
  ownerDocument: string;
  ownerAddress: string;
  ownerCity: string;
  ownerState: string;
  ownerZipCode: string;
  tenantName: string;
  tenantDocument: string;
  propertyAddress: string;
  referenceMonth: string;
  description: string;
  originalValue: number;
  lateFee?: number;
  interest?: number;
  discount?: number;
  finalValue: number;
  instructions?: string;
}

export async function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  const html = generateInvoiceHTML(data);

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
        left: '15mm',
      },
      printBackground: true,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

function generateInvoiceHTML(data: InvoiceData): string {
  const invoiceDate = new Date(data.invoiceDate).toLocaleDateString('pt-BR');
  const dueDate = new Date(data.dueDate).toLocaleDateString('pt-BR');

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fatura de Locação</title>
  <style>
    body {
      font-family: 'Arial', sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #000;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 100%;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      border-bottom: 3px solid #000;
      padding-bottom: 20px;
    }
    .company-info {
      flex: 1;
    }
    .company-name {
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .company-details {
      font-size: 9pt;
      color: #666;
    }
    .invoice-info {
      text-align: right;
    }
    .invoice-title {
      font-size: 24pt;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .invoice-number {
      font-size: 12pt;
      margin-bottom: 5px;
    }
    .invoice-date {
      font-size: 10pt;
    }
    .content {
      margin: 30px 0;
    }
    .section {
      margin-bottom: 20px;
    }
    .section-title {
      font-size: 12pt;
      font-weight: bold;
      background-color: #f0f0f0;
      padding: 5px 10px;
      margin-bottom: 10px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    .info-item {
      margin-bottom: 8px;
    }
    .info-label {
      font-weight: bold;
      font-size: 9pt;
    }
    .info-value {
      font-size: 10pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #000;
      padding: 10px;
      text-align: left;
    }
    th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .totals {
      margin-left: auto;
      width: 300px;
      margin-top: 20px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      border-bottom: 1px solid #ddd;
    }
    .total-row.final {
      font-weight: bold;
      font-size: 12pt;
      border-bottom: 2px solid #000;
      margin-top: 10px;
    }
    .instructions {
      margin-top: 30px;
      padding: 15px;
      background-color: #f9f9f9;
      border-left: 3px solid #000;
    }
    .instructions-title {
      font-weight: bold;
      margin-bottom: 10px;
    }
    .footer {
      margin-top: 50px;
      text-align: center;
      font-size: 9pt;
      color: #666;
      border-top: 1px solid #ddd;
      padding-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-info">
        <div class="company-name">${data.ownerName}</div>
        <div class="company-details">
          CPF/CNPJ: ${data.ownerDocument}
        </div>
        <div class="company-details">
          ${data.ownerAddress}, ${data.ownerCity} - ${data.ownerState}
        </div>
        <div class="company-details">
          CEP: ${data.ownerZipCode}
        </div>
      </div>
      <div class="invoice-info">
        <div class="invoice-title">FATURA</div>
        <div class="invoice-number">Nº ${data.invoiceNumber}</div>
        <div class="invoice-date">Data: ${invoiceDate}</div>
        <div class="invoice-date">Vencimento: ${dueDate}</div>
      </div>
    </div>

    <div class="content">
      <div class="section">
        <div class="section-title">DADOS DO PAGADOR</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Nome:</div>
            <div class="info-value">${data.tenantName}</div>
          </div>
          <div class="info-item">
            <div class="info-label">CPF/CNPJ:</div>
            <div class="info-value">${data.tenantDocument}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Endereço:</div>
            <div class="info-value">${data.propertyAddress}</div>
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Descrição</th>
            <th>Referência</th>
            <th class="text-right">Valor Original</th>
            <th class="text-right">Desconto</th>
            <th class="text-right">Juros/Multa</th>
            <th class="text-right">Valor Final</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${data.description}</td>
            <td>${data.referenceMonth}</td>
            <td class="text-right">R$ ${data.originalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            <td class="text-right">R$ ${(data.discount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            <td class="text-right">R$ ${((data.lateFee || 0) + (data.interest || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            <td class="text-right">R$ ${data.finalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>

      <div class="totals">
        <div class="total-row">
          <span>Valor Original:</span>
          <span>R$ ${data.originalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
        ${data.discount ? `
        <div class="total-row">
          <span>Desconto:</span>
          <span>- R$ ${data.discount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
        ` : ''}
        ${data.lateFee ? `
        <div class="total-row">
          <span>Multa:</span>
          <span>+ R$ ${data.lateFee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
        ` : ''}
        ${data.interest ? `
        <div class="total-row">
          <span>Juros:</span>
          <span>+ R$ ${data.interest.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
        ` : ''}
        <div class="total-row final">
          <span>TOTAL A PAGAR:</span>
          <span>R$ ${data.finalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      ${data.instructions ? `
      <div class="instructions">
        <div class="instructions-title">INSTRUÇÕES DE PAGAMENTO</div>
        <div>${data.instructions}</div>
      </div>
      ` : ''}
    </div>

    <div class="footer">
      <p>Esta fatura foi gerada automaticamente pela plataforma MR3X.</p>
      <p>Em caso de dúvidas, entre em contato através do dashboard.</p>
    </div>
  </div>
</body>
</html>
  `;
}

