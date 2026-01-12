import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { VerificationService, DocumentType } from './verification.service';

@ApiTags('Document Verification (Public)')
@Controller('verify')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get('token/:token')
  @Public()
  @ApiOperation({ summary: 'Verify document authenticity by token (auto-detects document type)' })
  @ApiParam({ name: 'token', description: 'Document verification token' })
  @ApiQuery({ name: 'type', required: false, enum: DocumentType, description: 'Document type (optional, auto-detected if not provided)' })
  async verifyByToken(
    @Param('token') token: string,
    @Query('type') type?: DocumentType,
  ) {
    const result = await this.verificationService.verifyByToken(token, type);
    return {
      success: result.valid,
      data: result,
    };
  }

  @Post('token/:token/hash')
  @Public()
  @ApiOperation({ summary: 'Validate hash against stored hash' })
  @ApiParam({ name: 'token', description: 'Document verification token' })
  @ApiQuery({ name: 'type', required: false, enum: DocumentType, description: 'Document type (optional)' })
  @ApiBody({
    schema: {
      properties: {
        hash: { type: 'string', description: 'SHA-256 hash to validate' },
      },
      required: ['hash'],
    },
  })
  async verifyHash(
    @Param('token') token: string,
    @Body('hash') hash: string,
    @Query('type') type?: DocumentType,
  ) {
    if (!hash) {
      throw new BadRequestException('Hash é obrigatório');
    }

    const result = await this.verificationService.verifyHash(token, hash, type);
    return {
      success: result.valid,
      data: result,
    };
  }

  @Post('token/:token/pdf')
  @Public()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload PDF file and validate its hash' })
  @ApiParam({ name: 'token', description: 'Document verification token' })
  @ApiQuery({ name: 'type', required: false, enum: DocumentType, description: 'Document type (optional)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF file to validate',
        },
      },
    },
  })
  async verifyPdf(
    @Param('token') token: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('type') type?: DocumentType,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo PDF é obrigatório');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Arquivo deve ser um PDF');
    }

    const result = await this.verificationService.verifyPdf(token, file.buffer, type);
    return {
      success: result.valid,
      data: result,
    };
  }
}

