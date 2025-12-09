import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  Ip,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InspectionHashService } from './services/inspection-hash.service';
import { InspectionSignatureService, SignatureData } from './services/inspection-signature.service';
import { InspectionSignatureLinkService } from './services/inspection-signature-link.service';

/**
 * Public controller for inspection verification and external signing
 * No authentication required for these endpoints
 */
@ApiTags('Inspection Verification (Public)')
@Controller('public/inspections')
export class InspectionVerificationController {
  constructor(
    private readonly hashService: InspectionHashService,
    private readonly signatureService: InspectionSignatureService,
    private readonly signatureLinkService: InspectionSignatureLinkService,
  ) {}

  // ==================== Hash Verification ====================

  @Get('verify/:token')
  @ApiOperation({ summary: 'Get inspection verification data by token' })
  async getVerificationData(@Param('token') token: string) {
    return this.hashService.getVerificationData(token);
  }

  @Post('verify/:token/hash')
  @ApiOperation({ summary: 'Verify hash by inspection token' })
  async verifyHashByToken(
    @Param('token') token: string,
    @Body('hash') hash: string,
  ) {
    return this.hashService.verifyHashByToken(token, hash);
  }

  @Post('verify/:token/upload')
  @ApiOperation({ summary: 'Verify uploaded PDF against stored hash' })
  @UseInterceptors(FileInterceptor('file'))
  async validateUploadedPdf(
    @Param('token') token: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.hashService.validateUploadedPdf(token, file.buffer);
  }

  // ==================== External Signing ====================

  @Get('sign/:linkToken')
  @ApiOperation({ summary: 'Get inspection data for external signing' })
  async getSigningData(@Param('linkToken') linkToken: string) {
    return this.signatureLinkService.getInspectionDataForSigning(linkToken);
  }

  @Post('sign/:linkToken')
  @ApiOperation({ summary: 'Sign inspection via external link' })
  async signViaLink(
    @Param('linkToken') linkToken: string,
    @Body() signatureData: SignatureData,
    @Ip() clientIP: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.signatureService.signInspectionViaLink(linkToken, {
      ...signatureData,
      clientIP,
      userAgent,
    });
  }

  @Get('sign/:linkToken/validate')
  @ApiOperation({ summary: 'Validate signature link' })
  async validateSignatureLink(@Param('linkToken') linkToken: string) {
    return this.signatureLinkService.validateSignatureLink(linkToken);
  }
}
