import { Request, Response } from 'express';
import { generateReceiptPDF, ReceiptData } from './receipt-generator.service';
import { generateInvoicePDF, InvoiceData } from './invoice-generator.service';

export class DocumentsController {
  /**
   * Generate receipt PDF
   */
  generateReceipt = async (req: Request, res: Response) => {
    try {
      const data: ReceiptData = req.body;
      const pdfBuffer = await generateReceiptPDF(data);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="recibo-${data.receiptNumber}.pdf"`);
      res.send(Buffer.from(pdfBuffer));
    } catch (error) {
      console.error('Error generating receipt:', error);
      res.status(500).json({ message: 'Error generating receipt PDF' });
    }
  };

  /**
   * Generate invoice PDF
   */
  generateInvoice = async (req: Request, res: Response) => {
    try {
      const data: InvoiceData = req.body;
      const pdfBuffer = await generateInvoicePDF(data);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="fatura-${data.invoiceNumber}.pdf"`);
      res.send(Buffer.from(pdfBuffer));
    } catch (error) {
      console.error('Error generating invoice:', error);
      res.status(500).json({ message: 'Error generating invoice PDF' });
    }
  };

  /**
   * Generate receipt from payment data
   */
  generateReceiptFromPayment = async (req: Request, res: Response) => {
    try {
      // This would fetch payment data from database and generate receipt
      // For now, return the receipt data structure
      const receiptData: ReceiptData = req.body;
      const pdfBuffer = await generateReceiptPDF(receiptData);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="recibo.pdf"`);
      res.send(Buffer.from(pdfBuffer));
    } catch (error) {
      console.error('Error generating receipt from payment:', error);
      res.status(500).json({ message: 'Error generating receipt' });
    }
  };

  /**
   * Generate invoice with automatic calculation
   */
  generateAutoInvoice = async (req: Request, res: Response) => {
    try {
      // This would fetch contract/payment data and calculate values automatically
      const invoiceData: InvoiceData = req.body;
      const pdfBuffer = await generateInvoicePDF(invoiceData);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="fatura.pdf"`);
      res.send(Buffer.from(pdfBuffer));
    } catch (error) {
      console.error('Error generating auto invoice:', error);
      res.status(500).json({ message: 'Error generating invoice' });
    }
  };
}

