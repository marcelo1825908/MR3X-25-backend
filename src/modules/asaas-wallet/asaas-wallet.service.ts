import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { AsaasService } from '../asaas/asaas.service';
import {
  CreateAsaasWalletDto,
  UpdateAsaasWalletDto,
  LinkAsaasAccountDto,
  VerifyWalletDto,
  AsaasConnectionStatusDto,
} from './dto/asaas-wallet.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AsaasWalletService {
  private readonly logger = new Logger(AsaasWalletService.name);

  constructor(
    private prisma: PrismaService,
    private asaasService: AsaasService,
  ) {}

  // ===============================================
  // WALLET CRUD
  // ===============================================

  async findAll(params: {
    agencyId?: string;
    userId?: string;
    status?: string;
    skip?: number;
    take?: number;
  }) {
    const { agencyId, userId, status, skip = 0, take = 50 } = params;

    const where: any = {};
    if (agencyId) where.agencyId = BigInt(agencyId);
    if (userId) where.userId = BigInt(userId);
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.asaasWallet.findMany({
        where,
        skip: Number(skip),
        take: Number(take),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.asaasWallet.count({ where }),
    ]);

    return {
      items: items.map(this.serializeWallet),
      total,
      skip: Number(skip),
      take: Number(take),
    };
  }

  async findOne(id: string) {
    const wallet = await this.prisma.asaasWallet.findFirst({
      where: {
        OR: [
          { id: this.parseBigInt(id) },
          { asaasWalletId: id },
          { asaasAccountId: id },
        ],
      },
    });

    if (!wallet) {
      throw new NotFoundException(`Asaas wallet not found: ${id}`);
    }

    return this.serializeWallet(wallet);
  }

  async findByEntity(params: { agencyId?: string; userId?: string }) {
    const { agencyId, userId } = params;

    const where: any = {};
    if (agencyId) where.agencyId = BigInt(agencyId);
    if (userId) where.userId = BigInt(userId);

    const wallets = await this.prisma.asaasWallet.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return wallets.map(this.serializeWallet);
  }

  async create(data: CreateAsaasWalletDto, userId: string) {
    // Check if wallet already exists
    const existing = await this.prisma.asaasWallet.findFirst({
      where: {
        OR: [
          { asaasAccountId: data.asaasAccountId },
          { asaasWalletId: data.asaasWalletId },
        ],
      },
    });

    if (existing) {
      throw new BadRequestException('Asaas wallet with this account or wallet ID already exists.');
    }

    const wallet = await this.prisma.asaasWallet.create({
      data: {
        asaasAccountId: data.asaasAccountId,
        asaasWalletId: data.asaasWalletId,
        ownerName: data.ownerName,
        ownerDocument: data.ownerDocument.replace(/\D/g, ''),
        ownerEmail: data.ownerEmail,
        ownerPhone: data.ownerPhone,
        agencyId: data.agencyId ? BigInt(data.agencyId) : null,
        userId: data.userId ? BigInt(data.userId) : null,
        bankCode: data.bankCode,
        bankName: data.bankName,
        bankBranch: data.bankBranch,
        bankAccount: data.bankAccount,
        bankAccountType: data.bankAccountType,
        pixKey: data.pixKey,
        status: 'PENDING',
        createdBy: BigInt(userId),
      },
    });

    return this.serializeWallet(wallet);
  }

  async update(id: string, data: UpdateAsaasWalletDto) {
    const existing = await this.findOne(id);

    const wallet = await this.prisma.asaasWallet.update({
      where: { id: BigInt(existing.id) },
      data: {
        ownerName: data.ownerName,
        ownerEmail: data.ownerEmail,
        ownerPhone: data.ownerPhone,
        bankCode: data.bankCode,
        bankName: data.bankName,
        bankBranch: data.bankBranch,
        bankAccount: data.bankAccount,
        bankAccountType: data.bankAccountType,
        pixKey: data.pixKey,
      },
    });

    return this.serializeWallet(wallet);
  }

  async delete(id: string) {
    const existing = await this.findOne(id);

    // Check if wallet is in use
    const receiversUsingWallet = await this.prisma.splitReceiver.count({
      where: { walletId: BigInt(id) },
    });

    if (receiversUsingWallet > 0) {
      throw new BadRequestException('Cannot delete wallet that is in use by split receivers.');
    }

    await this.prisma.asaasWallet.delete({
      where: { id: BigInt(existing.id) },
    });

    return { success: true, message: 'Wallet deleted successfully' };
  }

  // ===============================================
  // ASAAS INTEGRATION
  // ===============================================

  async linkAccount(data: LinkAsaasAccountDto, userId: string) {
    // Validate the API key by making a request to Asaas
    try {
      // Use the provided API key to get account info
      const accountInfo = await this.getAsaasAccountInfo(data.apiKey);

      if (!accountInfo) {
        throw new BadRequestException('Invalid Asaas API key or unable to fetch account information.');
      }

      // Create the wallet
      const wallet = await this.prisma.asaasWallet.create({
        data: {
          asaasAccountId: accountInfo.id,
          asaasWalletId: accountInfo.walletId || accountInfo.id,
          ownerName: accountInfo.name,
          ownerDocument: accountInfo.cpfCnpj?.replace(/\D/g, '') || '',
          ownerEmail: accountInfo.email,
          ownerPhone: accountInfo.phone,
          agencyId: data.agencyId ? BigInt(data.agencyId) : null,
          userId: data.userId ? BigInt(data.userId) : null,
          bankCode: accountInfo.bankAccount?.bank?.code,
          bankName: accountInfo.bankAccount?.bank?.name,
          bankBranch: accountInfo.bankAccount?.agency,
          bankAccount: accountInfo.bankAccount?.account,
          bankAccountType: accountInfo.bankAccount?.accountType,
          pixKey: accountInfo.bankAccount?.pixKey,
          status: 'ACTIVE',
          isVerified: true,
          verifiedAt: new Date(),
          verifiedBy: BigInt(userId),
          verificationMethod: 'API_KEY',
          lastSyncedAt: new Date(),
          createdBy: BigInt(userId),
        },
      });

      return this.serializeWallet(wallet);
    } catch (error) {
      this.logger.error(`Failed to link Asaas account: ${error.message}`);
      throw new BadRequestException(`Failed to link Asaas account: ${error.message}`);
    }
  }

  async verify(id: string, data: VerifyWalletDto, userId: string) {
    const existing = await this.findOne(id);

    if (existing.isVerified) {
      throw new BadRequestException('Wallet is already verified.');
    }

    // Sync with Asaas to verify the account
    await this.syncWithAsaas(id);

    const wallet = await this.prisma.asaasWallet.update({
      where: { id: BigInt(existing.id) },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy: BigInt(userId),
        verificationMethod: 'MANUAL',
        status: 'ACTIVE',
      },
    });

    return this.serializeWallet(wallet);
  }

  async syncWithAsaas(id: string) {
    const existing = await this.findOne(id);

    try {
      // In a real implementation, you would call Asaas API to get latest account info
      // For now, we'll just update the sync timestamp
      const wallet = await this.prisma.asaasWallet.update({
        where: { id: BigInt(existing.id) },
        data: {
          lastSyncedAt: new Date(),
          syncError: null,
        },
      });

      return this.serializeWallet(wallet);
    } catch (error) {
      await this.prisma.asaasWallet.update({
        where: { id: BigInt(existing.id) },
        data: {
          syncError: error.message,
        },
      });
      throw error;
    }
  }

  async getConnectionStatus(params: { agencyId?: string; userId?: string }): Promise<AsaasConnectionStatusDto> {
    const { agencyId, userId } = params;

    // Check if Asaas service is enabled
    const isAsaasEnabled = this.asaasService.isEnabled();

    if (!isAsaasEnabled) {
      return {
        isConnected: false,
        error: 'Asaas API is not configured.',
      };
    }

    // Find the primary wallet for this entity
    const wallet = await this.prisma.asaasWallet.findFirst({
      where: {
        AND: [
          agencyId ? { agencyId: BigInt(agencyId) } : {},
          userId ? { userId: BigInt(userId) } : {},
          { status: 'ACTIVE' },
          { isVerified: true },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!wallet) {
      return {
        isConnected: false,
        error: 'No verified Asaas wallet found.',
      };
    }

    // Get last webhook log
    const lastWebhook = await this.prisma.webhookLog.findFirst({
      where: { provider: 'asaas' },
      orderBy: { createdAt: 'desc' },
    });

    return {
      isConnected: true,
      accountId: wallet.asaasAccountId,
      accountName: wallet.ownerName,
      accountEmail: wallet.ownerEmail || undefined,
      accountStatus: wallet.status,
      lastWebhookAt: lastWebhook?.createdAt || undefined,
    };
  }

  async getSubaccounts() {
    // Get subaccounts from Asaas (for platform split functionality)
    // This would call Asaas API to list subaccounts
    try {
      // Placeholder - in real implementation, call Asaas API
      return {
        items: [],
        total: 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get subaccounts: ${error.message}`);
      throw error;
    }
  }

  // ===============================================
  // HELPER METHODS
  // ===============================================

  private async getAsaasAccountInfo(apiKey: string): Promise<any> {
    // Make a request to Asaas to get account info using the provided API key
    const url = this.asaasService.isEnabled()
      ? 'https://sandbox.asaas.com/api/v3/myAccount'
      : 'https://sandbox.asaas.com/api/v3/myAccount';

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'access_token': apiKey,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.errors?.[0]?.description || 'Failed to fetch account info');
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`Failed to get Asaas account info: ${error.message}`);
      throw error;
    }
  }

  private parseBigInt(value: string): bigint | undefined {
    try {
      return BigInt(value);
    } catch {
      return undefined;
    }
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
      agencyId: wallet.agencyId?.toString(),
      userId: wallet.userId?.toString(),
      isVerified: wallet.isVerified,
      verifiedAt: wallet.verifiedAt,
      verifiedBy: wallet.verifiedBy?.toString(),
      verificationMethod: wallet.verificationMethod,
      bankCode: wallet.bankCode,
      bankName: wallet.bankName,
      bankBranch: wallet.bankBranch,
      bankAccount: wallet.bankAccount,
      bankAccountType: wallet.bankAccountType,
      pixKey: wallet.pixKey,
      status: wallet.status,
      lastSyncedAt: wallet.lastSyncedAt,
      syncError: wallet.syncError,
      createdBy: wallet.createdBy?.toString(),
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }
}
