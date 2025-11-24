import puppeteer from 'puppeteer';

export interface ReceiptData {
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
}

export async function generateReceiptPDF(data: ReceiptData): Promise<Buffer> {
  const html = generateReceiptHTML(data);

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

function generateReceiptHTML(data: ReceiptData): string {
  const paymentDate = new Date(data.paymentDate).toLocaleDateString('pt-BR');

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recibo de Pagamento</title>
  <style>
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #000;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 100%;
      margin: 0 auto;
      border: 2px solid #000;
      padding: 30px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 18pt;
      font-weight: bold;
      margin: 0;
    }
    .header h2 {
      font-size: 14pt;
      font-weight: normal;
      margin: 5px 0;
    }
    .receipt-number {
      text-align: right;
      font-size: 10pt;
      margin-bottom: 20px;
    }
    .info-section {
      margin: 20px 0;
    }
    .info-row {
      display: flex;
      margin-bottom: 10px;
    }
    .info-label {
      font-weight: bold;
      width: 150px;
    }
    .info-value {
      flex: 1;
    }
    .amount-section {
      text-align: center;
      margin: 40px 0;
      padding: 20px;
      background-color: #f5f5f5;
      border: 1px solid #000;
    }
    .amount-value {
      font-size: 24pt;
      font-weight: bold;
      color: #000;
    }
    .amount-words {
      font-size: 14pt;
      margin-top: 10px;
    }
    .signature-section {
      margin-top: 60px;
    }
    .signature-line {
      border-top: 1px solid #000;
      width: 300px;
      margin: 60px auto 5px;
    }
    .signature-name {
      text-align: center;
      font-size: 10pt;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 10pt;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>RECIBO DE PAGAMENTO</h1>
      <h2>LOCAÇÃO DE IMÓVEL</h2>
    </div>

    <div class="receipt-number">
      <strong>Nº: ${data.receiptNumber}</strong>
    </div>

    <div class="info-section">
      <div class="info-row">
        <div class="info-label">RECEBIDO DE:</div>
        <div class="info-value">${data.tenantName}</div>
      </div>
      <div class="info-row">
        <div class="info-label">CPF/CNPJ:</div>
        <div class="info-value">${data.tenantDocument}</div>
      </div>
      <div class="info-row">
        <div class="info-label">A FAVOR DE:</div>
        <div class="info-value">${data.ownerName}</div>
      </div>
      <div class="info-row">
        <div class="info-label">CPF/CNPJ:</div>
        <div class="info-value">${data.ownerDocument}</div>
      </div>
      <div class="info-row">
        <div class="info-label">IMÓVEL:</div>
        <div class="info-value">${data.propertyAddress}</div>
      </div>
      <div class="info-row">
        <div class="info-label">REFERENTE A:</div>
        <div class="info-value">${data.description} - ${data.referenceMonth}</div>
      </div>
      <div class="info-row">
        <div class="info-label">FORMA DE PAGAMENTO:</div>
        <div class="info-value">${data.paymentMethod}</div>
      </div>
      <div class="info-row">
        <div class="info-label">DATA:</div>
        <div class="info-value">${paymentDate}</div>
      </div>
    </div>

    <div class="amount-section">
      <div class="amount-value">R$ ${data.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
      <div class="amount-words">(${numberToWords(data.amount)} reais)</div>
    </div>

    <div class="signature-section">
      <div class="signature-line"></div>
      <div class="signature-name">${data.ownerName}<br>CPF/CNPJ: ${data.ownerDocument}</div>
    </div>

    <div class="footer">
      <p>Este documento foi emitido automaticamente pela plataforma MR3X.</p>
      <p>Recibo válido para fins fiscais e comprobatórios.</p>
    </div>
  </div>
</body>
</html>
  `;
}

function numberToWords(num: number): string {
  // Simple Portuguese number to words converter
  const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const teens = ['dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  // For simplicity, using a basic conversion
  // In production, use a library like 'number-to-words' or similar
  return convertNumberToWords(num);

  function convertNumberToWords(n: number): string {
    if (n === 0) return 'zero';
    if (n < 10) return units[Math.floor(n)];
    if (n < 20) return teens[Math.floor(n) - 10];
    if (n < 100) {
      const ten = Math.floor(n / 10);
      const unit = n % 10;
      return tens[ten] + (unit > 0 ? ' e ' + units[unit] : '');
    }
    if (n < 1000) {
      const hundred = Math.floor(n / 100);
      const remainder = n % 100;
      return hundreds[hundred] + (remainder > 0 ? ' e ' + convertNumberToWords(remainder) : '');
    }
    return n.toString();
  }
}

