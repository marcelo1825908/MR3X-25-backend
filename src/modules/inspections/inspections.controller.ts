import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InspectionsService } from './inspections.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateInspectionDto, InspectionStatus } from './dto/create-inspection.dto';
import { UpdateInspectionDto, SignInspectionDto, ApproveRejectInspectionDto } from './dto/update-inspection.dto';

@ApiTags('Inspections')
@Controller('inspections')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InspectionsController {
  constructor(private readonly inspectionsService: InspectionsService) {}

  @Get()
  @ApiOperation({ summary: 'List all inspections' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({ name: 'agencyId', required: false, type: String })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  @ApiQuery({ name: 'contractId', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'inspectorId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async findAll(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('agencyId') agencyId?: string,
    @Query('propertyId') propertyId?: string,
    @Query('contractId') contractId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('inspectorId') inspectorId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @CurrentUser() user?: any,
  ) {
    // Data isolation based on role
    let createdById: string | undefined;
    let effectiveAgencyId: string | undefined = agencyId;

    if (user?.role === 'CEO') {
      // CEO sees all - no filtering
    } else if (user?.role === 'ADMIN') {
      // ADMIN sees only inspections they created
      createdById = user.sub;
    } else if (user?.role === 'INDEPENDENT_OWNER') {
      // INDEPENDENT_OWNER sees only their own inspections
      createdById = user.sub;
    } else if (user?.agencyId) {
      // Agency users see only their agency's inspections
      effectiveAgencyId = user.agencyId;
    } else {
      // For any other role without agency, only show their own created inspections
      createdById = user?.sub;
    }

    return this.inspectionsService.findAll({
      skip,
      take,
      agencyId: effectiveAgencyId,
      propertyId,
      contractId,
      type,
      status,
      inspectorId,
      createdById,
      startDate,
      endDate,
    });
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get inspection statistics' })
  async getStatistics(@CurrentUser() user?: any) {
    let createdById: string | undefined;
    let agencyId: string | undefined;

    if (user?.role === 'CEO') {
      // CEO sees all
    } else if (user?.role === 'ADMIN' || user?.role === 'INDEPENDENT_OWNER') {
      createdById = user.sub;
    } else if (user?.agencyId) {
      agencyId = user.agencyId;
    } else {
      createdById = user?.sub;
    }

    return this.inspectionsService.getStatistics({ agencyId, createdById });
  }

  @Get('templates')
  @ApiOperation({ summary: 'List all inspection templates' })
  @ApiQuery({ name: 'agencyId', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'isDefault', required: false, type: Boolean })
  async findAllTemplates(
    @Query('agencyId') agencyId?: string,
    @Query('type') type?: string,
    @Query('isDefault') isDefault?: string,
    @CurrentUser() user?: any,
  ) {
    let effectiveAgencyId = agencyId;

    // Agency users can only see their agency's templates and default templates
    if (user?.agencyId && !agencyId) {
      effectiveAgencyId = user.agencyId;
    }

    return this.inspectionsService.findAllTemplates({
      agencyId: effectiveAgencyId,
      type,
      isDefault: isDefault === 'true' ? true : isDefault === 'false' ? false : undefined,
    });
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Get template by ID' })
  async findOneTemplate(@Param('id') id: string) {
    return this.inspectionsService.findOneTemplate(id);
  }

  @Post('templates')
  @ApiOperation({ summary: 'Create a new inspection template' })
  async createTemplate(@Body() data: any, @CurrentUser('sub') userId: string) {
    return this.inspectionsService.createTemplate(data, userId);
  }

  @Put('templates/:id')
  @ApiOperation({ summary: 'Update inspection template' })
  async updateTemplate(@Param('id') id: string, @Body() data: any) {
    return this.inspectionsService.updateTemplate(id, data);
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Delete inspection template' })
  async removeTemplate(@Param('id') id: string) {
    return this.inspectionsService.removeTemplate(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get inspection by ID' })
  async findOne(@Param('id') id: string) {
    return this.inspectionsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new inspection' })
  async create(
    @Body() data: CreateInspectionDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.inspectionsService.create(data, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update inspection' })
  async update(
    @Param('id') id: string,
    @Body() data: UpdateInspectionDto,
  ) {
    return this.inspectionsService.update(id, data);
  }

  @Patch(':id/sign')
  @ApiOperation({ summary: 'Sign inspection' })
  async sign(
    @Param('id') id: string,
    @Body() data: SignInspectionDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.inspectionsService.sign(id, data, userId);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve inspection' })
  async approve(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.inspectionsService.approve(id, userId);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject inspection' })
  async reject(
    @Param('id') id: string,
    @Body() data: ApproveRejectInspectionDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.inspectionsService.reject(id, userId, data);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update inspection status' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: InspectionStatus,
  ) {
    return this.inspectionsService.updateStatus(id, status);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete inspection' })
  async remove(@Param('id') id: string) {
    return this.inspectionsService.remove(id);
  }
}
