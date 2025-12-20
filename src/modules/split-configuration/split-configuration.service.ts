import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import {
  CreateSplitConfigurationDto,
  CreateSplitReceiverDto,
  CreateSplitRuleDto,
  SplitRuleType,
  ReceiverType,
  ChargeType
} from './dto/create-split-configuration.dto';
import {
  UpdateSplitConfigurationDto,
  UpdateSplitReceiverDto,
  UpdateSplitRuleDto,
  SplitConfigurationStatus,
  ActivateConfigurationDto,
  DeactivateConfigurationDto,
  ValidateConfigurationDto
} from './dto/update-split-configuration.dto';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

export interface SplitPreviewResult {
  grossAmount: number;
  receivers: {
    receiverType: string;
    name: string;
    amount: number;
    percentage: number;
  }[];
  totalDistributed: number;
  isValid: boolean;
  errors: string[];
}

@Injectable()
export class SplitConfigurationService {
  private readonly logger = new Logger(SplitConfigurationService.name);

  constructor(private prisma: PrismaService) {}

  // ===============================================
  // CONFIGURATION CRUD
  // ===============================================

  async findAll(params: {
    agencyId?: string;
    ownerId?: string;
    contractId?: string;
    propertyId?: string;
    status?: string;
    scope?: string;
    skip?: number;
    take?: number;
  }) {
    const {
      agencyId,
      ownerId,
      contractId,
      propertyId,
      status,
      scope,
      skip = 0,
      take = 50,
    } = params;

    const where: any = {};

    if (agencyId) where.agencyId = BigInt(agencyId);
    if (ownerId) where.ownerId = BigInt(ownerId);
    if (contractId) where.contractId = BigInt(contractId);
    if (propertyId) where.propertyId = BigInt(propertyId);
    if (status) where.status = status;
    if (scope) where.scope = scope;

    const [items, total] = await Promise.all([
      this.prisma.splitConfiguration.findMany({
        where,
        skip: Number(skip),
        take: Number(take),
        include: {
          receivers: {
            include: {
              wallet: true,
              rules: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.splitConfiguration.count({ where }),
    ]);

    return {
      items: items.map(this.serializeConfiguration),
      total,
      skip: Number(skip),
      take: Number(take),
    };
  }

  async findOne(id: string) {
    const configuration = await this.prisma.splitConfiguration.findFirst({
      where: {
        OR: [
          { id: this.parseBigInt(id) },
          { token: id },
        ],
      },
      include: {
        receivers: {
          include: {
            wallet: true,
            rules: true,
          },
        },
        auditLogs: {
          orderBy: { performedAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!configuration) {
      throw new NotFoundException(`Split configuration not found: ${id}`);
    }

    return this.serializeConfiguration(configuration);
  }

  async findActiveForEntity(params: {
    agencyId?: string;
    ownerId?: string;
    contractId?: string;
    propertyId?: string;
  }) {
    const { agencyId, ownerId, contractId, propertyId } = params;

    // Priority: Contract > Property > Global
    const scopes = ['PER_CONTRACT', 'PER_PROPERTY', 'GLOBAL'];

    for (const scope of scopes) {
      const where: any = {
        status: 'ACTIVE',
        scope,
      };

      if (agencyId) where.agencyId = BigInt(agencyId);
      if (ownerId) where.ownerId = BigInt(ownerId);

      if (scope === 'PER_CONTRACT' && contractId) {
        where.contractId = BigInt(contractId);
      } else if (scope === 'PER_PROPERTY' && propertyId) {
        where.propertyId = BigInt(propertyId);
      }

      const config = await this.prisma.splitConfiguration.findFirst({
        where,
        include: {
          receivers: {
            include: {
              wallet: true,
              rules: {
                where: { isActive: true },
              },
            },
          },
        },
        orderBy: { version: 'desc' },
      });

      if (config) {
        return this.serializeConfiguration(config);
      }
    }

    return null;
  }

  async create(data: CreateSplitConfigurationDto, userId: string) {
    const token = uuidv4().substring(0, 8).toUpperCase();

    // Create the configuration
    const configuration = await this.prisma.splitConfiguration.create({
      data: {
        token,
        name: data.name,
        description: data.description,
        scope: data.scope || 'GLOBAL',
        agencyId: data.agencyId ? BigInt(data.agencyId) : null,
        ownerId: data.ownerId ? BigInt(data.ownerId) : null,
        contractId: data.contractId ? BigInt(data.contractId) : null,
        propertyId: data.propertyId ? BigInt(data.propertyId) : null,
        effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : null,
        changeReason: data.changeReason,
        notes: data.notes,
        createdBy: BigInt(userId),
        status: 'DRAFT',
        version: 1,
      },
    });

    // Create receivers if provided
    if (data.receivers && data.receivers.length > 0) {
      for (const receiverData of data.receivers) {
        await this.createReceiver(configuration.id.toString(), receiverData, userId);
      }
    }

    // Log audit
    await this.createAuditLog({
      configurationId: configuration.id.toString(),
      action: 'CREATE',
      entityType: 'CONFIGURATION',
      entityId: configuration.id.toString(),
      newValues: JSON.stringify(data),
      performedBy: userId,
      reason: data.changeReason,
    });

    return this.findOne(configuration.id.toString());
  }

  async update(id: string, data: UpdateSplitConfigurationDto, userId: string) {
    const existing = await this.findOne(id);

    if (existing.status === 'ACTIVE') {
      throw new BadRequestException('Cannot modify an active configuration. Deactivate it first or create a new version.');
    }

    const oldValues = JSON.stringify(existing);

    await this.prisma.splitConfiguration.update({
      where: { id: BigInt(existing.id) },
      data: {
        name: data.name,
        description: data.description,
        scope: data.scope,
        effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : undefined,
        changeReason: data.changeReason,
        notes: data.notes,
      },
    });

    // Log audit
    await this.createAuditLog({
      configurationId: existing.id,
      action: 'UPDATE',
      entityType: 'CONFIGURATION',
      entityId: existing.id,
      oldValues,
      newValues: JSON.stringify(data),
      performedBy: userId,
      reason: data.changeReason,
    });

    return this.findOne(id);
  }

  async delete(id: string, userId: string, reason?: string) {
    const existing = await this.findOne(id);

    if (existing.status === 'ACTIVE') {
      throw new BadRequestException('Cannot delete an active configuration. Deactivate it first.');
    }

    await this.createAuditLog({
      configurationId: existing.id,
      action: 'DELETE',
      entityType: 'CONFIGURATION',
      entityId: existing.id,
      oldValues: JSON.stringify(existing),
      performedBy: userId,
      reason,
    });

    await this.prisma.splitConfiguration.delete({
      where: { id: BigInt(existing.id) },
    });

    return { success: true, message: 'Configuration deleted successfully' };
  }

  // ===============================================
  // RECEIVERS CRUD
  // ===============================================

  async createReceiver(configurationId: string, data: CreateSplitReceiverDto, userId: string) {
    const config = await this.findOne(configurationId);

    if (config.status === 'ACTIVE') {
      throw new BadRequestException('Cannot add receivers to an active configuration.');
    }

    const receiver = await this.prisma.splitReceiver.create({
      data: {
        configurationId: BigInt(configurationId),
        receiverType: data.receiverType,
        name: data.name,
        document: data.document,
        userId: data.userId ? BigInt(data.userId) : null,
        agencyId: data.agencyId ? BigInt(data.agencyId) : null,
        walletId: data.walletId ? BigInt(data.walletId) : null,
        isLocked: data.isLocked || false,
      },
    });

    // Create rules if provided
    if (data.rules && data.rules.length > 0) {
      for (const ruleData of data.rules) {
        await this.createRule(configurationId, receiver.id.toString(), ruleData, userId);
      }
    }

    await this.createAuditLog({
      configurationId,
      action: 'CREATE',
      entityType: 'RECEIVER',
      entityId: receiver.id.toString(),
      newValues: JSON.stringify(data),
      performedBy: userId,
    });

    return this.serializeReceiver(receiver);
  }

  async updateReceiver(configurationId: string, receiverId: string, data: UpdateSplitReceiverDto, userId: string) {
    const config = await this.findOne(configurationId);

    if (config.status === 'ACTIVE') {
      throw new BadRequestException('Cannot modify receivers in an active configuration.');
    }

    const receiver = await this.prisma.splitReceiver.findUnique({
      where: { id: BigInt(receiverId) },
    });

    if (!receiver) {
      throw new NotFoundException(`Receiver not found: ${receiverId}`);
    }

    if (receiver.isLocked) {
      throw new ForbiddenException('Cannot modify a locked receiver.');
    }

    const oldValues = JSON.stringify(receiver);

    const updated = await this.prisma.splitReceiver.update({
      where: { id: BigInt(receiverId) },
      data: {
        name: data.name,
        document: data.document,
        walletId: data.walletId ? BigInt(data.walletId) : undefined,
      },
    });

    await this.createAuditLog({
      configurationId,
      action: 'UPDATE',
      entityType: 'RECEIVER',
      entityId: receiverId,
      oldValues,
      newValues: JSON.stringify(data),
      performedBy: userId,
    });

    return this.serializeReceiver(updated);
  }

  async deleteReceiver(configurationId: string, receiverId: string, userId: string) {
    const config = await this.findOne(configurationId);

    if (config.status === 'ACTIVE') {
      throw new BadRequestException('Cannot delete receivers from an active configuration.');
    }

    const receiver = await this.prisma.splitReceiver.findUnique({
      where: { id: BigInt(receiverId) },
    });

    if (!receiver) {
      throw new NotFoundException(`Receiver not found: ${receiverId}`);
    }

    if (receiver.isLocked) {
      throw new ForbiddenException('Cannot delete a locked receiver.');
    }

    await this.createAuditLog({
      configurationId,
      action: 'DELETE',
      entityType: 'RECEIVER',
      entityId: receiverId,
      oldValues: JSON.stringify(receiver),
      performedBy: userId,
    });

    await this.prisma.splitReceiver.delete({
      where: { id: BigInt(receiverId) },
    });

    return { success: true };
  }

  // ===============================================
  // RULES CRUD
  // ===============================================

  async createRule(configurationId: string, receiverId: string, data: CreateSplitRuleDto, userId: string) {
    const config = await this.findOne(configurationId);

    if (config.status === 'ACTIVE') {
      throw new BadRequestException('Cannot add rules to an active configuration.');
    }

    // Validate percentage rules
    if (data.ruleType === SplitRuleType.PERCENTAGE && (data.value < 0 || data.value > 100)) {
      throw new BadRequestException('Percentage value must be between 0 and 100.');
    }

    const rule = await this.prisma.splitRule.create({
      data: {
        configurationId: BigInt(configurationId),
        receiverId: BigInt(receiverId),
        ruleType: data.ruleType,
        value: data.value,
        minimumAmount: data.minimumAmount,
        maximumAmount: data.maximumAmount,
        chargeType: data.chargeType,
        priority: data.priority || 0,
        isActive: true,
      },
    });

    await this.createAuditLog({
      configurationId,
      action: 'CREATE',
      entityType: 'RULE',
      entityId: rule.id.toString(),
      newValues: JSON.stringify(data),
      performedBy: userId,
    });

    return this.serializeRule(rule);
  }

  async updateRule(configurationId: string, ruleId: string, data: UpdateSplitRuleDto, userId: string) {
    const config = await this.findOne(configurationId);

    if (config.status === 'ACTIVE') {
      throw new BadRequestException('Cannot modify rules in an active configuration.');
    }

    const rule = await this.prisma.splitRule.findUnique({
      where: { id: BigInt(ruleId) },
    });

    if (!rule) {
      throw new NotFoundException(`Rule not found: ${ruleId}`);
    }

    const oldValues = JSON.stringify(rule);

    const updated = await this.prisma.splitRule.update({
      where: { id: BigInt(ruleId) },
      data: {
        ruleType: data.ruleType,
        value: data.value,
        minimumAmount: data.minimumAmount,
        maximumAmount: data.maximumAmount,
        chargeType: data.chargeType,
        priority: data.priority,
        isActive: data.isActive,
      },
    });

    await this.createAuditLog({
      configurationId,
      action: 'UPDATE',
      entityType: 'RULE',
      entityId: ruleId,
      oldValues,
      newValues: JSON.stringify(data),
      performedBy: userId,
    });

    return this.serializeRule(updated);
  }

  async deleteRule(configurationId: string, ruleId: string, userId: string) {
    const config = await this.findOne(configurationId);

    if (config.status === 'ACTIVE') {
      throw new BadRequestException('Cannot delete rules from an active configuration.');
    }

    const rule = await this.prisma.splitRule.findUnique({
      where: { id: BigInt(ruleId) },
    });

    if (!rule) {
      throw new NotFoundException(`Rule not found: ${ruleId}`);
    }

    await this.createAuditLog({
      configurationId,
      action: 'DELETE',
      entityType: 'RULE',
      entityId: ruleId,
      oldValues: JSON.stringify(rule),
      performedBy: userId,
    });

    await this.prisma.splitRule.delete({
      where: { id: BigInt(ruleId) },
    });

    return { success: true };
  }

  // ===============================================
  // STATUS MANAGEMENT
  // ===============================================

  async validate(id: string, data: ValidateConfigurationDto, userId: string) {
    const config = await this.findOne(id);

    // Run validation checks
    const validationResult = await this.runValidation(config);

    if (!validationResult.isValid) {
      throw new BadRequestException(`Validation failed: ${validationResult.errors.join(', ')}`);
    }

    await this.prisma.splitConfiguration.update({
      where: { id: BigInt(id) },
      data: {
        isValidated: true,
        validatedAt: new Date(),
        validatedBy: BigInt(userId),
        validationNotes: data.notes,
      },
    });

    await this.createAuditLog({
      configurationId: id,
      action: 'VALIDATE',
      entityType: 'CONFIGURATION',
      entityId: id,
      newValues: JSON.stringify({ validated: true, notes: data.notes }),
      performedBy: userId,
    });

    return this.findOne(id);
  }

  async activate(id: string, data: ActivateConfigurationDto, userId: string) {
    const config = await this.findOne(id);

    if (!config.isValidated) {
      throw new BadRequestException('Configuration must be validated before activation.');
    }

    // Deactivate any other active configuration for the same entity/scope
    await this.deactivateOtherConfigs(config);

    await this.prisma.splitConfiguration.update({
      where: { id: BigInt(id) },
      data: {
        status: 'ACTIVE',
        activatedAt: new Date(),
        activatedBy: BigInt(userId),
        changeReason: data.reason,
      },
    });

    await this.createAuditLog({
      configurationId: id,
      action: 'ACTIVATE',
      entityType: 'CONFIGURATION',
      entityId: id,
      newValues: JSON.stringify({ status: 'ACTIVE' }),
      performedBy: userId,
      reason: data.reason,
    });

    return this.findOne(id);
  }

  async deactivate(id: string, data: DeactivateConfigurationDto, userId: string) {
    const config = await this.findOne(id);

    if (config.status !== 'ACTIVE') {
      throw new BadRequestException('Configuration is not active.');
    }

    await this.prisma.splitConfiguration.update({
      where: { id: BigInt(id) },
      data: {
        status: 'INACTIVE',
        deactivatedAt: new Date(),
        deactivatedBy: BigInt(userId),
        changeReason: data.reason,
      },
    });

    await this.createAuditLog({
      configurationId: id,
      action: 'DEACTIVATE',
      entityType: 'CONFIGURATION',
      entityId: id,
      newValues: JSON.stringify({ status: 'INACTIVE' }),
      performedBy: userId,
      reason: data.reason,
    });

    return this.findOne(id);
  }

  async createNewVersion(id: string, userId: string) {
    const existing = await this.findOne(id);

    // Create a copy with incremented version
    const newConfig = await this.prisma.splitConfiguration.create({
      data: {
        token: uuidv4().substring(0, 8).toUpperCase(),
        name: existing.name,
        description: existing.description,
        scope: existing.scope,
        agencyId: existing.agencyId ? BigInt(existing.agencyId) : null,
        ownerId: existing.ownerId ? BigInt(existing.ownerId) : null,
        contractId: existing.contractId ? BigInt(existing.contractId) : null,
        propertyId: existing.propertyId ? BigInt(existing.propertyId) : null,
        status: 'DRAFT',
        version: existing.version + 1,
        createdBy: BigInt(userId),
      },
    });

    // Copy receivers and rules
    for (const receiver of existing.receivers || []) {
      const newReceiver = await this.prisma.splitReceiver.create({
        data: {
          configurationId: newConfig.id,
          receiverType: receiver.receiverType,
          name: receiver.name,
          document: receiver.document,
          userId: receiver.userId ? BigInt(receiver.userId) : null,
          agencyId: receiver.agencyId ? BigInt(receiver.agencyId) : null,
          walletId: receiver.walletId ? BigInt(receiver.walletId) : null,
          isLocked: receiver.isLocked,
        },
      });

      // Copy rules
      for (const rule of receiver.rules || []) {
        await this.prisma.splitRule.create({
          data: {
            configurationId: newConfig.id,
            receiverId: newReceiver.id,
            ruleType: rule.ruleType,
            value: rule.value,
            minimumAmount: rule.minimumAmount,
            maximumAmount: rule.maximumAmount,
            chargeType: rule.chargeType,
            priority: rule.priority,
            isActive: rule.isActive,
          },
        });
      }
    }

    await this.createAuditLog({
      configurationId: newConfig.id.toString(),
      action: 'CREATE_VERSION',
      entityType: 'CONFIGURATION',
      entityId: newConfig.id.toString(),
      newValues: JSON.stringify({ previousVersionId: id, version: newConfig.version }),
      performedBy: userId,
    });

    return this.findOne(newConfig.id.toString());
  }

  // ===============================================
  // SPLIT CALCULATION & PREVIEW
  // ===============================================

  async calculateSplit(configId: string, grossAmount: number, chargeType?: ChargeType): Promise<SplitPreviewResult> {
    const config = await this.findOne(configId);
    return this.performSplitCalculation(config, grossAmount, chargeType);
  }

  async previewSplit(params: {
    agencyId?: string;
    ownerId?: string;
    contractId?: string;
    propertyId?: string;
    grossAmount: number;
    chargeType?: ChargeType;
  }): Promise<SplitPreviewResult> {
    const config = await this.findActiveForEntity({
      agencyId: params.agencyId,
      ownerId: params.ownerId,
      contractId: params.contractId,
      propertyId: params.propertyId,
    });

    if (!config) {
      return {
        grossAmount: params.grossAmount,
        receivers: [],
        totalDistributed: 0,
        isValid: false,
        errors: ['No active split configuration found for this entity.'],
      };
    }

    return this.performSplitCalculation(config, params.grossAmount, params.chargeType);
  }

  private performSplitCalculation(config: any, grossAmount: number, chargeType?: ChargeType): SplitPreviewResult {
    const result: SplitPreviewResult = {
      grossAmount,
      receivers: [],
      totalDistributed: 0,
      isValid: true,
      errors: [],
    };

    let remainingAmount = grossAmount;
    const receiverAmounts: Map<string, number> = new Map();

    // Sort receivers by priority
    const allRules: { receiver: any; rule: any }[] = [];
    for (const receiver of config.receivers || []) {
      for (const rule of receiver.rules || []) {
        if (!rule.isActive) continue;
        if (chargeType && rule.chargeType && rule.chargeType !== chargeType) continue;
        allRules.push({ receiver, rule });
      }
    }

    allRules.sort((a, b) => (b.rule.priority || 0) - (a.rule.priority || 0));

    // Calculate amounts for each rule
    for (const { receiver, rule } of allRules) {
      let amount = 0;

      if (rule.ruleType === 'PERCENTAGE') {
        amount = (grossAmount * Number(rule.value)) / 100;
      } else if (rule.ruleType === 'FIXED') {
        amount = Number(rule.value);
      }

      // Apply constraints
      if (rule.minimumAmount && amount < Number(rule.minimumAmount)) {
        amount = Number(rule.minimumAmount);
      }
      if (rule.maximumAmount && amount > Number(rule.maximumAmount)) {
        amount = Number(rule.maximumAmount);
      }

      // Don't exceed remaining amount
      if (amount > remainingAmount) {
        amount = remainingAmount;
      }

      const receiverId = receiver.id.toString();
      const currentAmount = receiverAmounts.get(receiverId) || 0;
      receiverAmounts.set(receiverId, currentAmount + amount);
      remainingAmount -= amount;
    }

    // Build result
    for (const receiver of config.receivers || []) {
      const amount = receiverAmounts.get(receiver.id.toString()) || 0;
      if (amount > 0) {
        result.receivers.push({
          receiverType: receiver.receiverType,
          name: receiver.name,
          amount: Math.round(amount * 100) / 100,
          percentage: Math.round((amount / grossAmount) * 10000) / 100,
        });
        result.totalDistributed += amount;
      }
    }

    result.totalDistributed = Math.round(result.totalDistributed * 100) / 100;

    // Validate total
    if (Math.abs(result.totalDistributed - grossAmount) > 0.01) {
      result.isValid = false;
      result.errors.push(`Total distributed (${result.totalDistributed}) does not match gross amount (${grossAmount})`);
    }

    return result;
  }

  // ===============================================
  // VALIDATION
  // ===============================================

  private async runValidation(config: any): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check if has receivers
    if (!config.receivers || config.receivers.length === 0) {
      errors.push('Configuration must have at least one receiver.');
    }

    // Check if has rules
    let hasRules = false;
    for (const receiver of config.receivers || []) {
      if (receiver.rules && receiver.rules.length > 0) {
        hasRules = true;
        break;
      }
    }
    if (!hasRules) {
      errors.push('Configuration must have at least one split rule.');
    }

    // Check percentage total
    let totalPercentage = 0;
    for (const receiver of config.receivers || []) {
      for (const rule of receiver.rules || []) {
        if (rule.ruleType === 'PERCENTAGE' && rule.isActive) {
          totalPercentage += Number(rule.value);
        }
      }
    }
    if (totalPercentage > 100) {
      errors.push(`Total percentage (${totalPercentage}%) exceeds 100%.`);
    }

    // Check wallet linkage for receivers
    for (const receiver of config.receivers || []) {
      if (!receiver.walletId && receiver.receiverType !== 'PLATFORM') {
        errors.push(`Receiver "${receiver.name}" does not have a linked Asaas wallet.`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // ===============================================
  // AUDIT LOGGING
  // ===============================================

  async getAuditLogs(configurationId: string, params: { skip?: number; take?: number }) {
    const { skip = 0, take = 50 } = params;

    const [items, total] = await Promise.all([
      this.prisma.splitAuditLog.findMany({
        where: { configurationId: BigInt(configurationId) },
        skip: Number(skip),
        take: Number(take),
        orderBy: { performedAt: 'desc' },
      }),
      this.prisma.splitAuditLog.count({
        where: { configurationId: BigInt(configurationId) },
      }),
    ]);

    return {
      items: items.map(this.serializeAuditLog),
      total,
      skip: Number(skip),
      take: Number(take),
    };
  }

  private async createAuditLog(params: {
    configurationId: string;
    action: string;
    entityType: string;
    entityId?: string;
    oldValues?: string;
    newValues?: string;
    performedBy: string;
    reason?: string;
    clientIP?: string;
    userAgent?: string;
  }) {
    const { configurationId, action, entityType, entityId, oldValues, newValues, performedBy, reason, clientIP, userAgent } = params;

    // Generate integrity hash
    const hashData = `${configurationId}|${action}|${entityType}|${entityId}|${oldValues}|${newValues}|${performedBy}|${Date.now()}`;
    const integrityHash = crypto.createHash('sha256').update(hashData).digest('hex');

    await this.prisma.splitAuditLog.create({
      data: {
        configurationId: BigInt(configurationId),
        action,
        entityType,
        entityId: entityId ? BigInt(entityId) : null,
        oldValues,
        newValues,
        performedBy: BigInt(performedBy),
        reason,
        clientIP,
        userAgent,
        integrityHash,
      },
    });
  }

  // ===============================================
  // HELPER METHODS
  // ===============================================

  private async deactivateOtherConfigs(config: any) {
    const where: any = {
      status: 'ACTIVE',
      scope: config.scope,
      id: { not: BigInt(config.id) },
    };

    if (config.agencyId) where.agencyId = BigInt(config.agencyId);
    if (config.ownerId) where.ownerId = BigInt(config.ownerId);
    if (config.contractId) where.contractId = BigInt(config.contractId);
    if (config.propertyId) where.propertyId = BigInt(config.propertyId);

    await this.prisma.splitConfiguration.updateMany({
      where,
      data: {
        status: 'INACTIVE',
        deactivatedAt: new Date(),
      },
    });
  }

  private parseBigInt(value: string): bigint | undefined {
    try {
      return BigInt(value);
    } catch {
      return undefined;
    }
  }

  private serializeConfiguration(config: any): any {
    return {
      id: config.id.toString(),
      token: config.token,
      name: config.name,
      description: config.description,
      scope: config.scope,
      agencyId: config.agencyId?.toString(),
      ownerId: config.ownerId?.toString(),
      contractId: config.contractId?.toString(),
      propertyId: config.propertyId?.toString(),
      status: config.status,
      version: config.version,
      effectiveDate: config.effectiveDate,
      isValidated: config.isValidated,
      validatedAt: config.validatedAt,
      validatedBy: config.validatedBy?.toString(),
      validationNotes: config.validationNotes,
      activatedAt: config.activatedAt,
      activatedBy: config.activatedBy?.toString(),
      deactivatedAt: config.deactivatedAt,
      deactivatedBy: config.deactivatedBy?.toString(),
      changeReason: config.changeReason,
      notes: config.notes,
      createdBy: config.createdBy?.toString(),
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      receivers: config.receivers?.map((r: any) => this.serializeReceiver(r)),
      auditLogs: config.auditLogs?.map((l: any) => this.serializeAuditLog(l)),
    };
  }

  private serializeReceiver(receiver: any): any {
    return {
      id: receiver.id.toString(),
      configurationId: receiver.configurationId?.toString(),
      receiverType: receiver.receiverType,
      name: receiver.name,
      document: receiver.document,
      userId: receiver.userId?.toString(),
      agencyId: receiver.agencyId?.toString(),
      walletId: receiver.walletId?.toString(),
      isLocked: receiver.isLocked,
      createdAt: receiver.createdAt,
      updatedAt: receiver.updatedAt,
      wallet: receiver.wallet ? this.serializeWallet(receiver.wallet) : null,
      rules: receiver.rules?.map((r: any) => this.serializeRule(r)),
    };
  }

  private serializeRule(rule: any): any {
    return {
      id: rule.id.toString(),
      configurationId: rule.configurationId?.toString(),
      receiverId: rule.receiverId?.toString(),
      ruleType: rule.ruleType,
      value: Number(rule.value),
      minimumAmount: rule.minimumAmount ? Number(rule.minimumAmount) : null,
      maximumAmount: rule.maximumAmount ? Number(rule.maximumAmount) : null,
      chargeType: rule.chargeType,
      priority: rule.priority,
      isActive: rule.isActive,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }

  private serializeWallet(wallet: any): any {
    return {
      id: wallet.id.toString(),
      asaasAccountId: wallet.asaasAccountId,
      asaasWalletId: wallet.asaasWalletId,
      ownerName: wallet.ownerName,
      ownerDocument: wallet.ownerDocument,
      ownerEmail: wallet.ownerEmail,
      ownerPhone: wallet.ownerPhone,
      isVerified: wallet.isVerified,
      verifiedAt: wallet.verifiedAt,
      bankName: wallet.bankName,
      status: wallet.status,
    };
  }

  private serializeAuditLog(log: any): any {
    return {
      id: log.id.toString(),
      configurationId: log.configurationId?.toString(),
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId?.toString(),
      oldValues: log.oldValues ? JSON.parse(log.oldValues) : null,
      newValues: log.newValues ? JSON.parse(log.newValues) : null,
      reason: log.reason,
      performedBy: log.performedBy?.toString(),
      performedAt: log.performedAt,
      integrityHash: log.integrityHash,
    };
  }
}
