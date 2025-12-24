import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Res,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import { InspectionMediaService } from './inspection-media.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const storage = diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'inspections');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

const mediaFileFilter = (_req: any, file: any, cb: any) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image and video files are allowed'), false);
  }
};

@ApiTags('Inspection Media')
@Controller('inspections')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InspectionMediaController {
  constructor(private readonly inspectionMediaService: InspectionMediaService) {}

  @Post(':inspectionId/media')
  @ApiOperation({ summary: 'Upload media (images/videos) for an inspection' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'itemIndex', required: false, type: Number, description: 'Index of the inspection item' })
  @ApiQuery({ name: 'room', required: false, type: String, description: 'Room name for the media' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      storage,
      fileFilter: mediaFileFilter,
      limits: {
        fileSize: 100 * 1024 * 1024,
      },
    }),
  )
  async uploadMedia(
    @Param('inspectionId') inspectionId: string,
    @Query('itemIndex') itemIndex?: string,
    @Query('room') room?: string,
    @UploadedFiles() files?: Express.Multer.File[],
    @CurrentUser() user?: any,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Nenhum arquivo foi enviado');
    }

    if (files.length > 20) {
      throw new BadRequestException(`Limite de 20 arquivos por upload. Você tentou enviar ${files.length} arquivos.`);
    }

    const uploadedMedia = await this.inspectionMediaService.uploadMedia(
      inspectionId,
      user,
      files,
      itemIndex ? parseInt(itemIndex) : undefined,
      room,
    );

    return {
      success: true,
      media: uploadedMedia,
      message: `${uploadedMedia.length} file(s) uploaded successfully`,
    };
  }

  @Get(':inspectionId/media')
  @ApiOperation({ summary: 'Get all media for an inspection' })
  @ApiQuery({ name: 'itemIndex', required: false, type: Number })
  async getInspectionMedia(
    @Param('inspectionId') inspectionId: string,
    @Query('itemIndex') itemIndex?: string,
    @CurrentUser() user?: any,
  ) {
    return this.inspectionMediaService.getInspectionMedia(
      inspectionId,
      user,
      itemIndex ? parseInt(itemIndex) : undefined,
    );
  }

  @Get(':inspectionId/media/:mediaId/file')
  @ApiOperation({ summary: 'Get media file by ID' })
  async getMediaFile(
    @Param('inspectionId') inspectionId: string,
    @Param('mediaId') mediaId: string,
    @Res() res: Response,
  ) {
    const media = await this.inspectionMediaService.getMediaById(inspectionId, mediaId);

    if (!media || !media.path) {
      return res.status(404).json({ error: 'Media not found' });
    }

    const filePath = path.resolve(media.path);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: 'Media file not found' });
    }
  }

  @Delete(':inspectionId/media/:mediaId')
  @ApiOperation({ summary: 'Delete a media file' })
  async deleteMedia(
    @Param('inspectionId') inspectionId: string,
    @Param('mediaId') mediaId: string,
    @CurrentUser() user?: any,
  ) {
    await this.inspectionMediaService.deleteMedia(inspectionId, mediaId, user);

    return {
      success: true,
      message: 'Media deleted successfully',
    };
  }
}
