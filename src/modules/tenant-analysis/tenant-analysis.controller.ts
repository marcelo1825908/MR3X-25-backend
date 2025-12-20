import { Controller, Get, Post, Body, UseGuards, Query, Param, HttpException, HttpStatus, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import { TenantAnalysisService } from './tenant-analysis.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OwnerPermissionGuard } from '../../common/guards/owner-permission.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OwnerPermission } from '../../common/decorators/owner-permission.decorator';
import { OwnerAction } from '../../common/constants/owner-permissions.constants';
import { UserRole } from '@prisma/client';
import { AnalyzeTenantDto, GetAnalysisHistoryDto } from './dto';

const analysisPhotoStorage = diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'tenant-analysis');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const imageFileFilter = (_req: any, file: any, cb: any) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Apenas arquivos de imagem são permitidos'), false);
  }
};

@ApiTags('Tenant Analysis')
@Controller('tenant-analysis')
@UseGuards(JwtAuthGuard, RolesGuard, OwnerPermissionGuard)
@ApiBearerAuth()
export class TenantAnalysisController {
  constructor(private readonly tenantAnalysisService: TenantAnalysisService) {}

  @Get('health')
  @ApiOperation({ summary: 'Check tenant analysis service health' })
  async healthCheck() {
    return this.tenantAnalysisService.healthCheck();
  }

  @Post('analyze')
  @Roles(
    UserRole.CEO,
    UserRole.ADMIN,
    UserRole.AGENCY_ADMIN,
    UserRole.AGENCY_MANAGER,
    UserRole.BROKER,
    UserRole.INDEPENDENT_OWNER,
    UserRole.PROPRIETARIO
  )
  @OwnerPermission('tenant_analysis', OwnerAction.CREATE)
  @ApiOperation({ summary: 'Perform a complete tenant analysis' })
  async analyzeTenant(
    @Body() dto: AnalyzeTenantDto,
    @CurrentUser() user: any,
  ) {
    try {
      console.log('Received analyze request:', {
        document: dto.document ? `${dto.document.substring(0, 3)}***` : 'missing',
        analysisType: dto.analysisType,
        lgpdAccepted: dto.lgpdAccepted,
        name: dto.name
      });

      const userId = BigInt(user.sub);
      const agencyId = user.agencyId ? BigInt(user.agencyId) : undefined;
      return await this.tenantAnalysisService.analyzeTenant(dto, userId, agencyId, user.role);
    } catch (error) {
      console.error('Tenant analysis error:', error.message);
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: error.message || 'Erro ao realizar análise do inquilino',
          error: 'Analysis Failed',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('history')
  @Roles(
    UserRole.CEO,
    UserRole.ADMIN,
    UserRole.AGENCY_ADMIN,
    UserRole.AGENCY_MANAGER,
    UserRole.BROKER,
    UserRole.INDEPENDENT_OWNER,
    UserRole.PROPRIETARIO
  )
  @ApiOperation({ summary: 'Get analysis history with filters' })
  @ApiQuery({ name: 'document', required: false, description: 'Filter by document' })
  @ApiQuery({ name: 'riskLevel', required: false, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'COMPLETED', 'FAILED', 'EXPIRED'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAnalysisHistory(
    @Query() dto: GetAnalysisHistoryDto,
    @CurrentUser() user: any,
  ) {
    const userId = BigInt(user.sub);
    const agencyId = user.agencyId ? BigInt(user.agencyId) : undefined;
    return this.tenantAnalysisService.getAnalysisHistory(dto, userId, user.role, agencyId);
  }

  @Get('stats')
  @Roles(
    UserRole.CEO,
    UserRole.ADMIN,
    UserRole.AGENCY_ADMIN,
    UserRole.AGENCY_MANAGER,
    UserRole.BROKER,
    UserRole.INDEPENDENT_OWNER,
    UserRole.PROPRIETARIO
  )
  @ApiOperation({ summary: 'Get analysis statistics for dashboard' })
  async getAnalysisStats(@CurrentUser() user: any) {
    const userId = BigInt(user.sub);
    const agencyId = user.agencyId ? BigInt(user.agencyId) : undefined;
    return this.tenantAnalysisService.getAnalysisStats(userId, user.role, agencyId);
  }

  @Get(':id')
  @Roles(
    UserRole.CEO,
    UserRole.ADMIN,
    UserRole.AGENCY_ADMIN,
    UserRole.AGENCY_MANAGER,
    UserRole.BROKER,
    UserRole.INDEPENDENT_OWNER,
    UserRole.PROPRIETARIO
  )
  @ApiOperation({ summary: 'Get a specific analysis by ID' })
  @ApiParam({ name: 'id', description: 'Analysis ID' })
  async getAnalysisById(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const userId = BigInt(user.sub);
    const agencyId = user.agencyId ? BigInt(user.agencyId) : undefined;
    return this.tenantAnalysisService.getAnalysisById(BigInt(id), userId, user.role, agencyId);
  }

  @Post(':id/photo')
  @Roles(
    UserRole.CEO,
    UserRole.ADMIN,
    UserRole.AGENCY_ADMIN,
    UserRole.AGENCY_MANAGER,
    UserRole.BROKER,
    UserRole.INDEPENDENT_OWNER,
    UserRole.PROPRIETARIO
  )
  @ApiOperation({ summary: 'Upload photo for a tenant analysis' })
  @ApiParam({ name: 'id', description: 'Analysis ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photo: {
          type: 'string',
          format: 'binary',
          description: 'Photo image file',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: analysisPhotoStorage,
      fileFilter: imageFileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  async uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new HttpException('Arquivo de foto é obrigatório', HttpStatus.BAD_REQUEST);
    }

    const userId = BigInt(user.sub);
    return this.tenantAnalysisService.uploadPhoto(BigInt(id), file.path, file.filename, userId);
  }

  @Post('financial')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER)
  @ApiOperation({ summary: 'Get financial analysis for a document (legacy)' })
  async analyzeFinancial(@Body('document') document: string) {
    return this.tenantAnalysisService.analyzeFinancial(document);
  }

  @Post('background')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER)
  @ApiOperation({ summary: 'Get background check for a document (legacy)' })
  async analyzeBackground(@Body('document') document: string) {
    return this.tenantAnalysisService.analyzeBackground(document);
  }

  @Post('full')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER)
  @ApiOperation({ summary: 'Get full tenant analysis (legacy)' })
  async getFullAnalysis(@Body('document') document: string) {
    return this.tenantAnalysisService.getFullAnalysis(document);
  }
}
