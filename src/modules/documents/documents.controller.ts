import {
  Controller,
  Post,
  Body,
  Res,
  UseGuards,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
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
  async generateReceipt(@Body() data: any, @Res() res: Response) {
    const pdfBuffer = await this.documentsService.generateReceipt(data);

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
    // TODO: Fetch payment data from database and generate receipt
    res.status(501).json({ message: 'Not implemented yet' });
  }

  @Post('invoice/auto/:contractId')
  @ApiOperation({ summary: 'Generate an automatic invoice from contract' })
  async generateAutoInvoice(
    @Param('contractId') contractId: string,
    @Res() res: Response,
  ) {
    // TODO: Fetch contract data from database and generate invoice
    res.status(501).json({ message: 'Not implemented yet' });
  }
}
