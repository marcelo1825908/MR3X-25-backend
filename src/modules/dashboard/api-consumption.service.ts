import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { CellereService } from '../tenant-analysis/integrations/cellere.service';
import { InfoSimplesService } from '../tenant-analysis/integrations/infosimples.service';
import axios from 'axios';

export interface ApiConsumptionData {
  cellere: {
    balance: number;
    units: string;
    lastUpdate: Date;
    status: 'ok' | 'error' | 'unavailable';
    error?: string;
  };
  infosimples: {
    balance?: number;
    dailyConsumption?: number;
    monthlyConsumption?: number;
    lastUpdate: Date;
    status: 'ok' | 'error' | 'unavailable';
    error?: string;
  };
  estimates: {
    contractsRemaining: number;
    analysesRemaining: number;
    validationsRemaining: number;
    daysUntilDepletion: number;
  };
  alerts: {
    lowBalance: boolean;
    criticalBalance: boolean;
    lastAlertDate?: Date;
  };
  consumptionHistory: {
    daily: Array<{ date: string; cellere: number; infosimples: number }>;
    monthly: Array<{ month: string; cellere: number; infosimples: number }>;
  };
}

@Injectable()
export class ApiConsumptionService {
  private readonly logger = new Logger(ApiConsumptionService.name);
  private readonly infosimplesToken: string;

  constructor(
    private prisma: PrismaService,
    private cellereService: CellereService,
    private infoSimplesService: InfoSimplesService,
    private configService: ConfigService,
  ) {
    this.infosimplesToken = this.configService.get<string>('INFOSIMPLES_API_TOKEN', 'ntFnNyuKjLWrEp4KECuiLpisz8IfX4Uvm2ZEgBRv');
  }

  async getConsumptionData(): Promise<ApiConsumptionData> {
    const now = new Date();
    
    // Fetch current balances
    const [cellereData, infosimplesData] = await Promise.allSettled([
      this.fetchCellereBalance(),
      this.fetchInfosimplesData(),
    ]);

    const cellere = cellereData.status === 'fulfilled' 
      ? cellereData.value 
      : {
          balance: 0,
          units: 'credit',
          lastUpdate: now,
          status: 'error' as const,
          error: cellereData.reason?.message || 'Failed to fetch',
        };

    const infosimples = infosimplesData.status === 'fulfilled'
      ? infosimplesData.value
      : {
          lastUpdate: now,
          status: 'error' as const,
          error: infosimplesData.reason?.message || 'Failed to fetch',
        };

    // Calculate estimates
    const estimates = await this.calculateEstimates(cellere.balance);

    // Check alerts
    const infosimplesBalance = infosimples.status === 'ok' ? infosimples.balance : undefined;
    const alerts = this.checkAlerts(cellere.balance, infosimplesBalance);

    // Get consumption history
    const consumptionHistory = await this.getConsumptionHistory();

    // Save current state
    await this.saveConsumptionRecord('CELLERE', cellere.balance, 0, 0, cellere.units);
    if (infosimples.status === 'ok' && infosimples.balance !== undefined) {
      await this.saveConsumptionRecord(
        'INFOSIMPLES',
        infosimples.balance,
        infosimples.dailyConsumption || 0,
        infosimples.monthlyConsumption || 0,
        'credit',
      );
    }

    return {
      cellere,
      infosimples,
      estimates,
      alerts,
      consumptionHistory,
    };
  }

  private async fetchCellereBalance(): Promise<{
    balance: number;
    units: string;
    lastUpdate: Date;
    status: 'ok' | 'error';
  }> {
    try {
      const balance = await this.cellereService.getBalance();
      return {
        balance: balance.amount || 0,
        units: balance.units || 'credit',
        lastUpdate: new Date(),
        status: 'ok',
      };
    } catch (error: any) {
      this.logger.error(`Error fetching Cellere balance: ${error.message}`);
      throw error;
    }
  }

  private async fetchInfosimplesData(): Promise<{
    balance?: number;
    dailyConsumption?: number;
    monthlyConsumption?: number;
    lastUpdate: Date;
    status: 'ok' | 'error';
    error?: string;
  }> {
    try {
      // Note: Infosimples API endpoint for account info may vary
      // Using the token-based approach as mentioned in requirements
      // The actual endpoint might be different - this is a placeholder that can be adjusted
      const response = await axios.get('https://api.infosimples.com/api/v2/consultas/conta', {
        params: {
          token: this.infosimplesToken,
        },
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      // Parse response based on Infosimples API structure
      // This may need adjustment based on actual API response format
      const data = response.data || {};
      
      return {
        balance: data.saldo || data.balance || data.account?.balance,
        dailyConsumption: data.consumo_diario || data.daily_consumption || data.account?.daily_consumption || 0,
        monthlyConsumption: data.consumo_mensal || data.monthly_consumption || data.account?.monthly_consumption || 0,
        lastUpdate: new Date(),
        status: 'ok',
      };
    } catch (error: any) {
      this.logger.warn(`Error fetching Infosimples data: ${error.message}`);
      // Return basic structure even on error - Infosimples API might not expose account info
      return {
        lastUpdate: new Date(),
        status: 'error',
        error: error.message || 'API endpoint not available',
      };
    }
  }

  private async calculateEstimates(cellereBalance: number): Promise<{
    contractsRemaining: number;
    analysesRemaining: number;
    validationsRemaining: number;
    daysUntilDepletion: number;
  }> {
    // Get average daily consumption
    const avgDailyConsumption = await this.getAverageDailyConsumption();
    
    // Estimates based on typical usage:
    // - Contract generation: ~2 credits
    // - Analysis: ~5 credits
    // - Validation: ~1 credit
    const contractsRemaining = Math.floor(cellereBalance / 2);
    const analysesRemaining = Math.floor(cellereBalance / 5);
    const validationsRemaining = Math.floor(cellereBalance / 1);

    // Calculate days until depletion based on average daily consumption
    const daysUntilDepletion = avgDailyConsumption > 0 
      ? Math.floor(cellereBalance / avgDailyConsumption)
      : 999; // If no consumption history, assume unlimited

    return {
      contractsRemaining,
      analysesRemaining,
      validationsRemaining,
      daysUntilDepletion,
    };
  }

  private async getAverageDailyConsumption(): Promise<number> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const records = await this.prisma.apiConsumption.findMany({
        where: {
          provider: 'CELLERE',
          recordDate: { gte: thirtyDaysAgo },
        },
        orderBy: { recordDate: 'desc' },
      });

      if (records.length < 2) return 0;

      // Calculate average daily consumption
      let totalConsumption = 0;
      for (let i = 1; i < records.length; i++) {
        const prev = Number(records[i].balance || 0);
        const curr = Number(records[i - 1].balance || 0);
        if (prev > curr) {
          totalConsumption += (prev - curr);
        }
      }

      return records.length > 1 ? totalConsumption / (records.length - 1) : 0;
    } catch (error) {
      this.logger.error(`Error calculating average daily consumption: ${error}`);
      return 0;
    }
  }

  private checkAlerts(cellereBalance: number, infosimplesBalance?: number): {
    lowBalance: boolean;
    criticalBalance: boolean;
    lastAlertDate?: Date;
  } {
    // Get last record to check alert thresholds
    const threshold30 = 30; // 30% of typical balance (would need to track max balance)
    const threshold10 = 10; // 10% of typical balance

    // For now, use absolute thresholds (can be improved with historical max)
    const lowThreshold = 300; // Example: 300 credits
    const criticalThreshold = 100; // Example: 100 credits

    const lowBalance = cellereBalance < lowThreshold;
    const criticalBalance = cellereBalance < criticalThreshold;

    return {
      lowBalance,
      criticalBalance,
      lastAlertDate: (lowBalance || criticalBalance) ? new Date() : undefined,
    };
  }

  private async getConsumptionHistory(): Promise<{
    daily: Array<{ date: string; cellere: number; infosimples: number }>;
    monthly: Array<{ month: string; cellere: number; infosimples: number }>;
  }> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const records = await this.prisma.apiConsumption.findMany({
        where: {
          recordDate: { gte: thirtyDaysAgo },
        },
        orderBy: { recordDate: 'asc' },
      });

      // Group by date
      const dailyMap = new Map<string, { cellere: number; infosimples: number }>();

      records.forEach((record) => {
        const dateKey = record.recordDate.toISOString().split('T')[0];
        const balance = Number(record.balance || 0);

        if (!dailyMap.has(dateKey)) {
          dailyMap.set(dateKey, { cellere: 0, infosimples: 0 });
        }

        const entry = dailyMap.get(dateKey)!;
        if (record.provider === 'CELLERE') {
          entry.cellere = balance;
        } else if (record.provider === 'INFOSIMPLES') {
          entry.infosimples = balance;
        }
      });

      const daily = Array.from(dailyMap.entries()).map(([date, data]) => ({
        date,
        ...data,
      }));

      // Group by month for monthly view
      const monthlyMap = new Map<string, { cellere: number; infosimples: number }>();

      records.forEach((record) => {
        const month = String(record.recordDate.getMonth() + 1).padStart(2, '0');
        const monthKey = `${record.recordDate.getFullYear()}-${month}`;
        const monthlyConsumption = Number(record.monthlyConsumption || 0);

        if (!monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, { cellere: 0, infosimples: 0 });
        }

        const entry = monthlyMap.get(monthKey)!;
        if (record.provider === 'CELLERE') {
          entry.cellere = monthlyConsumption;
        } else if (record.provider === 'INFOSIMPLES') {
          entry.infosimples = monthlyConsumption;
        }
      });

      const monthly = Array.from(monthlyMap.entries()).map(([month, data]) => ({
        month,
        ...data,
      }));

      return { daily, monthly };
    } catch (error) {
      this.logger.error(`Error getting consumption history: ${error}`);
      return { daily: [], monthly: [] };
    }
  }

  private async saveConsumptionRecord(
    provider: string,
    balance: number,
    dailyConsumption: number,
    monthlyConsumption: number,
    units: string,
  ): Promise<void> {
    try {
      // Create date at midnight in local timezone, then convert to UTC date-only
      const now = new Date();
      const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      // Convert to UTC date string and back to Date to ensure consistent format
      const todayStr = todayLocal.toISOString().split('T')[0]; // YYYY-MM-DD
      const today = new Date(todayStr + 'T00:00:00.000Z');

      // First, try to find existing record using date range to handle timezone issues
      const startOfDay = new Date(today);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setUTCHours(23, 59, 59, 999);

      const existing = await this.prisma.apiConsumption.findFirst({
        where: {
          provider,
          recordDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });

      if (existing) {
        // Update existing record
        await this.prisma.apiConsumption.update({
          where: { id: existing.id },
          data: {
            balance,
            dailyConsumption,
            monthlyConsumption,
            units,
            updatedAt: new Date(),
          },
        });
      } else {
        // Create new record - use the existing recordDate format if we found one, otherwise use today
        try {
          await this.prisma.apiConsumption.create({
            data: {
              provider,
              balance,
              dailyConsumption,
              monthlyConsumption,
              units,
              recordDate: today,
            },
          });
        } catch (createError: any) {
          // If create fails due to unique constraint, try to find and update again
          if (createError.code === 'P2002' || createError.message?.includes('Unique constraint')) {
            const retryExisting = await this.prisma.apiConsumption.findFirst({
              where: {
                provider,
                recordDate: {
                  gte: startOfDay,
                  lte: endOfDay,
                },
              },
            });

            if (retryExisting) {
              await this.prisma.apiConsumption.update({
                where: { id: retryExisting.id },
                data: {
                  balance,
                  dailyConsumption,
                  monthlyConsumption,
                  units,
                  updatedAt: new Date(),
                },
              });
            } else {
              this.logger.warn(`Unique constraint error but could not find record for ${provider} on ${todayStr}`);
            }
          } else {
            throw createError;
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error saving consumption record: ${error}`);
    }
  }

  async refreshData(): Promise<ApiConsumptionData> {
    this.logger.log('Manually refreshing API consumption data');
    return this.getConsumptionData();
  }
}

