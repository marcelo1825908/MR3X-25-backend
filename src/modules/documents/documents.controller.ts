import {
  Controller,
  Post,
  Body,
  Res,
  UseGuards,
  Param,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Documents')
@Controller('documents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('receipt')
  @ApiOperation({ summary: 'Generate a payment receipt PDF' })
  async generateReceipt(@Body() data: any, @Req() req: Request, @Res() res: Response) {
    // Extract client IP
    const clientIP = req.ip || 
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      'N/A';

    // Add metadata to receipt data
    const receiptDataWithMetadata = {
      ...data,
      ip: clientIP,
      generatedAt: new Date().toISOString(),
    };

    const pdfBuffer = await this.documentsService.generateReceipt(receiptDataWithMetadata);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="recibo-${data.receiptNumber || 'documento'}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Post('invoice')
  @ApiOperation({ summary: 'Generate an invoice PDF' })
  async generateInvoice(@Body() data: any, @Res() res: Response) {
    const pdfBuffer = await this.documentsService.generateInvoice(data);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="fatura-${data.invoiceNumber || 'documento'}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Post('receipt/payment/:paymentId')
  @ApiOperation({ summary: 'Generate a receipt from an existing payment' })
  async generateReceiptFromPayment(
    @Param('paymentId') paymentId: string,
    @Res() res: Response,
  ) {
    res.status(501).json({ message: 'Not implemented yet' });
  }

  @Post('invoice/auto/:contractId')
  @ApiOperation({ summary: 'Generate an automatic invoice from contract' })
  async generateAutoInvoice(
    @Param('contractId') contractId: string,
    @Res() res: Response,
  ) {
    res.status(501).json({ message: 'Not implemented yet' });
  }
}
