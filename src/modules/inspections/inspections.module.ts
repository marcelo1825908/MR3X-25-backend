import { Module } from '@nestjs/common';
import { InspectionsController } from './inspections.controller';
import { InspectionsService } from './inspections.service';
import { InspectionMediaController } from './inspection-media.controller';
import { InspectionMediaService } from './inspection-media.service';
import { InspectionVerificationController } from './inspection-verification.controller';
import { InspectionHashService } from './services/inspection-hash.service';
import { InspectionPdfService } from './services/inspection-pdf.service';
import { InspectionSignatureService } from './services/inspection-signature.service';
import { InspectionSignatureLinkService } from './services/inspection-signature-link.service';

@Module({
  controllers: [
    InspectionsController,
    InspectionMediaController,
    InspectionVerificationController,
  ],
  providers: [
    InspectionsService,
    InspectionMediaService,
    InspectionHashService,
    InspectionPdfService,
    InspectionSignatureService,
    InspectionSignatureLinkService,
  ],
  exports: [
    InspectionsService,
    InspectionHashService,
    InspectionPdfService,
    InspectionSignatureService,
    InspectionSignatureLinkService,
  ],
})
export class InspectionsModule {}
