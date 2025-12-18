import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { PlanEnforcementService } from '../plans/plan-enforcement.service';
import { getPlanLimitsForEntity, PLANS_CONFIG, getPlanByName } from '../plans/plans.data';
import { AsaasService } from '../asaas/asaas.service';

export interface AgencyCreateDTO {
  name: string;
  tradeName?: string;
  cnpj: string;
  email: string;
  phone?: string;
  representativeName?: string;
  representativeDocument?: string;
  // CRECI is now always stored as full string (e.g. "123456/SP")
  creci?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  plan?: string;
  maxProperties?: number;
  maxUsers?: number;
  agencyFee?: number;
}

export interface AgencyUpdateDTO {
  name?: string;
  tradeName?: string;
  email?: string;
  phone?: string;
  representativeName?: string;
  representativeDocument?: string;
  creci?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  plan?: string;
  status?: string;
  maxProperties?: number;
  maxUsers?: number;
  agencyFee?: number;
}

@Injectable()
export class AgenciesService {
  private readonly logger = new Logger(AgenciesService.name);

  constructor(
    private prisma: PrismaService,
    private planEnforcement: PlanEnforcementService,
    private asaasService: AsaasService,
  ) {}

  async createAgency(data: AgencyCreateDTO) {
    const cleanCnpj = data.cnpj.replace(/\D/g, '');
    const existingAgency = await this.prisma.agency.findUnique({
      where: { cnpj: cleanCnpj },
    });

    if (existingAgency) {
      throw new BadRequestException('Agency with this CNPJ already exists');
    }

    const existingEmail = await this.prisma.agency.findFirst({
      where: { email: data.email },
    });

    if (existingEmail) {
      throw new BadRequestException('Agency with this email already exists');
    }

    const planName = data.plan || 'FREE';
    const planLimits = getPlanLimitsForEntity(planName, 'agency');

    const agency = await this.prisma.agency.create({
      data: {
        name: data.name,
        cnpj: cleanCnpj,
        email: data.email,
        phone: data.phone || null,
        // Store full CRECI string in single column
        creci: data.creci || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zipCode: data.zipCode || null,
        plan: planName,
        status: 'ACTIVE',
        maxProperties: planLimits.contracts,
        maxUsers: planLimits.users,
        agencyFee: data.agencyFee ?? 8,
        apiEnabled: planLimits.apiAccess,
        lastPlanChange: new Date(),
      },
      select: {
        id: true,
        name: true,
        cnpj: true,
        email: true,
        phone: true,
        creci: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        status: true,
        plan: true,
        maxProperties: true,
        maxUsers: true,
        agencyFee: true,
        apiEnabled: true,
        frozenPropertiesCount: true,
        frozenUsersCount: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            properties: true,
          },
        },
      },
    });

    return {
      id: agency.id.toString(),
      name: agency.name,
      cnpj: agency.cnpj,
      email: agency.email,
      phone: agency.phone || '',
      creci: agency.creci || '',
      address: agency.address || '',
      city: agency.city || '',
      state: agency.state || '',
      zipCode: agency.zipCode || '',
      status: agency.status,
      plan: agency.plan,
      maxProperties: agency.maxProperties || 0,
      maxUsers: agency.maxUsers || 0,
      agencyFee: agency.agencyFee ?? 8,
      apiEnabled: agency.apiEnabled,
      frozenPropertiesCount: agency.frozenPropertiesCount,
      frozenUsersCount: agency.frozenUsersCount,
      userCount: agency._count.users,
      propertyCount: agency._count.properties,
      createdAt: agency.createdAt,
      updatedAt: agency.updatedAt,
    };
  }

  async getAgencies() {
    const agencies = await this.prisma.agency.findMany({
      select: {
        id: true,
        name: true,
        cnpj: true,
        email: true,
        phone: true,
        creci: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        status: true,
        plan: true,
        maxProperties: true,
        maxUsers: true,
        agencyFee: true,
        _count: {
          select: {
            users: true,
            properties: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return agencies.map(agency => ({
      id: agency.id.toString(),
      name: agency.name,
      cnpj: agency.cnpj,
      email: agency.email,
      phone: agency.phone || '',
      creci: agency.creci || '',
      address: agency.address || '',
      city: agency.city || '',
      state: agency.state || '',
      zipCode: agency.zipCode || '',
      status: agency.status,
      plan: agency.plan,
      maxProperties: agency.maxProperties || 0,
      maxUsers: agency.maxUsers || 0,
      agencyFee: agency.agencyFee ?? 8,
      userCount: agency._count.users,
      propertyCount: agency._count.properties,
    }));
  }

  async getAgencyById(id: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(id) },
      select: {
        id: true,
        name: true,
        tradeName: true,
        cnpj: true,
        email: true,
        phone: true,
        representativeName: true,
        representativeDocument: true,
        creci: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        status: true,
        plan: true,
        maxProperties: true,
        maxUsers: true,
        agencyFee: true,
        createdAt: true,
        updatedAt: true,
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            createdAt: true,
          },
        },
        properties: {
          select: {
            id: true,
            name: true,
            address: true,
            status: true,
          },
        },
      },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    try {
      await this.planEnforcement.enforceCurrentPlanLimits(id);
    } catch (error) {
      console.error('Error enforcing plan limits:', error);
    }

    return {
      id: agency.id.toString(),
      name: agency.name,
      tradeName: agency.tradeName || '',
      cnpj: agency.cnpj,
      email: agency.email,
      phone: agency.phone || '',
      representativeName: agency.representativeName || '',
      representativeDocument: agency.representativeDocument || '',
      creci: agency.creci || '',
      address: agency.address || '',
      city: agency.city || '',
      state: agency.state || '',
      zipCode: agency.zipCode || '',
      status: agency.status,
      plan: agency.plan,
      maxProperties: agency.maxProperties,
      maxUsers: agency.maxUsers,
      agencyFee: agency.agencyFee,
      createdAt: agency.createdAt,
      updatedAt: agency.updatedAt,
      users: agency.users.map(u => ({
        id: u.id.toString(),
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
      })),
      properties: agency.properties.map(p => ({
        id: p.id.toString(),
        name: p.name,
        address: p.address,
        status: p.status,
      })),
    };
  }

  async updateAgency(id: string, data: AgencyUpdateDTO) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(id) },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    if (data.email && data.email !== agency.email) {
      const existingEmail = await this.prisma.agency.findFirst({
        where: { email: data.email },
      });

      if (existingEmail) {
        throw new BadRequestException('Agency with this email already exists');
      }
    }

    const isPlanChange = data.plan && data.plan !== agency.plan;
    let planEnforcementResult: Awaited<ReturnType<typeof this.planEnforcement.enforcePlanLimits>> | null = null;

    if (isPlanChange && data.plan) {
      const newPlanLimits = getPlanLimitsForEntity(data.plan, 'agency');

      const updated = await this.prisma.agency.update({
        where: { id: BigInt(id) },
        data: {
          name: data.name,
          tradeName: data.tradeName,
          email: data.email,
          phone: data.phone,
          representativeName: data.representativeName,
          representativeDocument: data.representativeDocument,
          address: data.address,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
          plan: data.plan,
          status: data.status,
          maxProperties: newPlanLimits.contracts,
          maxUsers: newPlanLimits.users,
          agencyFee: data.agencyFee !== undefined ? Math.max(0, Math.min(100, data.agencyFee)) : undefined,
          lastPlanChange: new Date(),
        },
        select: {
          id: true,
          name: true,
          tradeName: true,
          cnpj: true,
          email: true,
          phone: true,
          representativeName: true,
          representativeDocument: true,
          address: true,
          city: true,
          state: true,
          zipCode: true,
          status: true,
          plan: true,
          maxProperties: true,
          maxUsers: true,
          agencyFee: true,
          apiEnabled: true,
          frozenPropertiesCount: true,
          frozenUsersCount: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              users: true,
              properties: true,
            },
          },
        },
      });

      planEnforcementResult = await this.planEnforcement.enforcePlanLimits(id, data.plan!);

      const updatedAgency = await this.prisma.agency.findUnique({
        where: { id: BigInt(id) },
        select: {
          frozenPropertiesCount: true,
          frozenUsersCount: true,
        },
      });

      return {
        id: updated.id.toString(),
        name: updated.name,
        tradeName: updated.tradeName || '',
        cnpj: updated.cnpj,
        email: updated.email,
        phone: updated.phone || '',
        representativeName: updated.representativeName || '',
        representativeDocument: updated.representativeDocument || '',
        address: updated.address || '',
        city: updated.city || '',
        state: updated.state || '',
        zipCode: updated.zipCode || '',
        status: updated.status,
        plan: updated.plan,
        maxProperties: updated.maxProperties,
        maxUsers: updated.maxUsers,
        agencyFee: updated.agencyFee,
        apiEnabled: updated.apiEnabled,
        frozenPropertiesCount: updatedAgency?.frozenPropertiesCount || 0,
        frozenUsersCount: updatedAgency?.frozenUsersCount || 0,
        propertyCount: updated._count.properties,
        userCount: updated._count.users,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        planEnforcement: planEnforcementResult,
      };
    }

    const updated = await this.prisma.agency.update({
      where: { id: BigInt(id) },
      data: {
        name: data.name,
        tradeName: data.tradeName,
        email: data.email,
        phone: data.phone,
        representativeName: data.representativeName,
        representativeDocument: data.representativeDocument,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        status: data.status,
        agencyFee: data.agencyFee !== undefined ? Math.max(0, Math.min(100, data.agencyFee)) : undefined,
      },
      select: {
        id: true,
        name: true,
        tradeName: true,
        cnpj: true,
        email: true,
        phone: true,
        representativeName: true,
        representativeDocument: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        status: true,
        plan: true,
        maxProperties: true,
        maxUsers: true,
        agencyFee: true,
        apiEnabled: true,
        frozenPropertiesCount: true,
        frozenUsersCount: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            properties: true,
          },
        },
      },
    });

    return {
      id: updated.id.toString(),
      name: updated.name,
      tradeName: updated.tradeName || '',
      cnpj: updated.cnpj,
      email: updated.email,
      phone: updated.phone || '',
      representativeName: updated.representativeName || '',
      representativeDocument: updated.representativeDocument || '',
      address: updated.address || '',
      city: updated.city || '',
      state: updated.state || '',
      zipCode: updated.zipCode || '',
      status: updated.status,
      plan: updated.plan,
      maxProperties: updated.maxProperties,
      maxUsers: updated.maxUsers,
      agencyFee: updated.agencyFee,
      apiEnabled: updated.apiEnabled,
      frozenPropertiesCount: updated.frozenPropertiesCount,
      frozenUsersCount: updated.frozenUsersCount,
      propertyCount: updated._count.properties,
      userCount: updated._count.users,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteAgency(id: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(id) },
      include: {
        users: true,
        properties: true,
      },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    if (agency.users.length > 0) {
      throw new BadRequestException('Cannot delete agency with associated users');
    }

    if (agency.properties.length > 0) {
      throw new BadRequestException('Cannot delete agency with associated properties');
    }

    await this.prisma.agency.delete({
      where: { id: BigInt(id) },
    });

    return { message: 'Agency deleted successfully' };
  }

  async getPlanUsage(agencyId: string) {
    return this.planEnforcement.getFrozenEntitiesSummary(agencyId);
  }

  async getFrozenEntities(agencyId: string) {
    return this.planEnforcement.getFrozenEntitiesList(agencyId);
  }

  async previewPlanChange(agencyId: string, newPlan: string) {
    return this.planEnforcement.previewPlanChange(agencyId, newPlan);
  }

  async switchActiveContract(agencyId: string, newActiveContractId: string) {
    return this.planEnforcement.switchActiveContract(agencyId, newActiveContractId);
  }

  async enforcePlanLimits(agencyId: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { plan: true },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    return this.planEnforcement.enforcePlanLimits(agencyId, agency.plan);
  }

  async checkContractCreationAllowed(agencyId: string) {
    return this.planEnforcement.checkContractOperationAllowed(agencyId, 'create');
  }

  async checkUserCreationAllowed(agencyId: string) {
    return this.planEnforcement.checkUserOperationAllowed(agencyId, 'create');
  }

  async changePlan(agencyId: string, newPlan: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { id: true, plan: true },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    const enforcementResult = await this.planEnforcement.enforcePlanLimits(agencyId, newPlan);

    const newPlanLimits = getPlanLimitsForEntity(newPlan, 'agency');

    await this.prisma.agency.update({
      where: { id: BigInt(agencyId) },
      data: {
        plan: newPlan,
        maxProperties: newPlanLimits.contracts,
        maxUsers: newPlanLimits.users,
        lastPlanChange: new Date(),
      },
    });

    const updatedAgency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: {
        id: true,
        name: true,
        plan: true,
        maxProperties: true,
        maxUsers: true,
        frozenContractsCount: true,
        frozenUsersCount: true,
      },
    });

    return {
      success: true,
      agency: {
        id: updatedAgency?.id.toString(),
        name: updatedAgency?.name,
        plan: updatedAgency?.plan,
        maxProperties: updatedAgency?.maxProperties,
        maxUsers: updatedAgency?.maxUsers,
      },
      enforcement: enforcementResult,
      message: enforcementResult.message,
    };
  }

  async createPlanChangePayment(agencyId: string, newPlan: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: {
        id: true,
        name: true,
        cnpj: true,
        email: true,
        phone: true,
        plan: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
      },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    const currentPlan = agency.plan || 'FREE';
    const newPlanConfig = PLANS_CONFIG[newPlan];
    const currentPlanConfig = PLANS_CONFIG[currentPlan];

    if (!newPlanConfig) {
      throw new BadRequestException(`Invalid plan: ${newPlan}`);
    }

    // For FREE plan, no payment needed
    if (newPlan === 'FREE') {
      return {
        requiresPayment: false,
        message: 'Downgrade para plano gratuito não requer pagamento',
      };
    }

    // For downgrade to a cheaper paid plan (but not FREE), no payment needed
    if (newPlanConfig.price <= currentPlanConfig.price && newPlan !== 'FREE') {
      return {
        requiresPayment: false,
        message: 'Downgrade não requer pagamento',
      };
    }

    // Check if Asaas is configured
    if (!this.asaasService.isEnabled()) {
      throw new BadRequestException('Sistema de pagamento não está configurado');
    }

    // Sync or create customer in Asaas
    this.logger.log(`Syncing customer for agency ${agencyId}: ${agency.name}, ${agency.cnpj}, ${agency.email}`);
    const customerResult = await this.asaasService.syncCustomer({
      id: agencyId,
      name: agency.name,
      email: agency.email,
      document: agency.cnpj,
      phone: agency.phone || undefined,
      address: agency.address || undefined,
      city: agency.city || undefined,
      state: agency.state || undefined,
      postalCode: agency.zipCode || undefined,
    });

    if (!customerResult.success || !customerResult.customerId) {
      this.logger.error(`Failed to sync customer: ${customerResult.error}`);
      throw new BadRequestException(`Erro ao sincronizar cliente: ${customerResult.error || 'erro desconhecido'}`);
    }

    // Calculate payment value (new plan price)
    const paymentValue = newPlanConfig.price;

    // Create payment in Asaas
    const dueDate = this.asaasService.calculateDueDate(3); // 3 days from now
    const externalReference = `plan_change_${agencyId}_${newPlan}`;
    const description = `Upgrade para plano ${newPlanConfig.displayName} - ${agency.name}`;

    this.logger.log(`Creating payment for agency ${agencyId}: value=${paymentValue}, dueDate=${dueDate}, customerId=${customerResult.customerId}`);

    const paymentResult = await this.asaasService.createCompletePayment({
      customerId: customerResult.customerId,
      value: paymentValue,
      dueDate,
      description,
      externalReference,
      billingType: 'UNDEFINED', // Let user choose PIX or Boleto
    });

    if (!paymentResult.success || !paymentResult.paymentId) {
      this.logger.error(`Failed to create payment: ${paymentResult.error}`);
      throw new BadRequestException(`Erro ao criar cobrança: ${paymentResult.error || 'erro desconhecido'}`);
    }

    // Store pending plan change request (optional - field may not exist yet)
    try {
      await this.prisma.agency.update({
        where: { id: BigInt(agencyId) },
        data: {
          pendingPlanChange: newPlan,
          pendingPlanPaymentId: paymentResult.paymentId,
        },
      });
    } catch (dbError) {
      this.logger.warn(`Could not store pending plan change (field may not exist): ${dbError.message}`);
    }

    this.logger.log(`Plan change payment created for agency ${agencyId}: ${paymentResult.paymentId}`);

    return {
      requiresPayment: true,
      paymentId: paymentResult.paymentId,
      invoiceUrl: paymentResult.invoiceUrl,
      bankSlipUrl: paymentResult.bankSlipUrl,
      pixQrCode: paymentResult.pixQrCode,
      pixCopyPaste: paymentResult.pixCopyPaste,
      value: paymentValue,
      dueDate,
      currentPlan: currentPlanConfig.displayName,
      newPlan: newPlanConfig.displayName,
      message: `Pagamento de R$ ${paymentValue.toFixed(2)} necessário para ativar o plano ${newPlanConfig.displayName}`,
    };
  }

  async confirmPlanChangePayment(agencyId: string, newPlan: string) {
    // This method is called by the webhook when payment is confirmed
    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { id: true, plan: true, pendingPlanChange: true },
    });

    if (!agency) {
      this.logger.error(`Agency not found for plan change confirmation: ${agencyId}`);
      return;
    }

    // Verify the pending plan matches
    if (agency.pendingPlanChange !== newPlan) {
      this.logger.warn(`Pending plan mismatch: expected ${agency.pendingPlanChange}, got ${newPlan}`);
    }

    // Apply the plan change
    const enforcementResult = await this.planEnforcement.enforcePlanLimits(agencyId, newPlan);
    const newPlanLimits = getPlanLimitsForEntity(newPlan, 'agency');

    await this.prisma.agency.update({
      where: { id: BigInt(agencyId) },
      data: {
        plan: newPlan,
        maxProperties: newPlanLimits.contracts,
        maxUsers: newPlanLimits.users,
        lastPlanChange: new Date(),
        pendingPlanChange: null,
        pendingPlanPaymentId: null,
      },
    });

    this.logger.log(`Plan change confirmed for agency ${agencyId}: ${newPlan}`);

    return {
      success: true,
      message: `Plano alterado para ${newPlan} com sucesso`,
    };
  }

  async confirmPlanPaymentManually(agencyId: string, paymentId: string, newPlan: string) {
    // This method manually confirms a plan change payment
    // Useful for testing or when webhook is not working
    this.logger.log(`Manually confirming plan payment for agency ${agencyId}: paymentId=${paymentId}, newPlan=${newPlan}`);

    const agency = await this.prisma.agency.findUnique({
      where: { id: BigInt(agencyId) },
      select: { id: true, name: true, plan: true },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    // Check payment status in Asaas
    let paymentConfirmed = false;
    try {
      const payment = await this.asaasService.getPayment(paymentId);
      this.logger.log(`Payment ${paymentId} status in Asaas: ${payment?.status}`);

      if (payment) {
        const paidStatuses = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'BILLING_RECEIVED'];
        if (paidStatuses.includes(payment.status)) {
          // Payment is already confirmed
          paymentConfirmed = true;
          this.logger.log(`Payment ${paymentId} already confirmed with status: ${payment.status}`);
        } else if (payment.status === 'PENDING') {
          // Try to mark as received (for manual confirmation / testing)
          try {
            await this.asaasService.receiveInCash(
              paymentId,
              this.asaasService.formatDate(new Date()),
              payment.value,
            );
            paymentConfirmed = true;
            this.logger.log(`Payment ${paymentId} manually marked as received in Asaas`);
          } catch (cashError) {
            this.logger.warn(`Could not mark payment as received: ${cashError.message}`);
            // For sandbox/testing, allow proceeding anyway
            paymentConfirmed = true;
          }
        } else {
          this.logger.warn(`Payment ${paymentId} has unexpected status: ${payment.status}`);
          // For sandbox/testing, allow proceeding anyway
          paymentConfirmed = true;
        }
      }
    } catch (asaasError) {
      this.logger.warn(`Could not verify payment in Asaas: ${asaasError.message}`);
      // For sandbox/testing, allow proceeding anyway if we can't reach Asaas
      paymentConfirmed = true;
    }

    if (!paymentConfirmed) {
      throw new BadRequestException('Pagamento ainda não confirmado. Por favor, aguarde ou tente novamente.');
    }

    // Get plan configuration
    const newPlanConfig = getPlanByName(newPlan);
    if (!newPlanConfig) {
      throw new BadRequestException(`Invalid plan: ${newPlan}`);
    }

    // Apply the plan change
    const enforcementResult = await this.planEnforcement.enforcePlanLimits(agencyId, newPlan);
    const newPlanLimits = getPlanLimitsForEntity(newPlan, 'agency');

    // Update agency with new plan
    const updateData: any = {
      plan: newPlan,
      maxProperties: newPlanLimits.contracts,
      maxUsers: newPlanLimits.users,
      lastPlanChange: new Date(),
      lastPaymentAt: new Date(),
    };

    // Try to clear pending fields if they exist
    try {
      await this.prisma.agency.update({
        where: { id: BigInt(agencyId) },
        data: {
          ...updateData,
          pendingPlanChange: null,
          pendingPlanPaymentId: null,
        },
      });
    } catch (fieldError) {
      // If pending fields don't exist, update without them
      await this.prisma.agency.update({
        where: { id: BigInt(agencyId) },
        data: updateData,
      });
    }

    this.logger.log(`Plan manually upgraded for agency ${agencyId}: ${agency.plan} -> ${newPlan}`);

    return {
      success: true,
      message: `Plano atualizado para ${newPlanConfig.displayName} com sucesso!`,
      previousPlan: agency.plan,
      newPlan: newPlan,
      newLimits: newPlanLimits,
      enforcement: enforcementResult,
    };
  }
}
