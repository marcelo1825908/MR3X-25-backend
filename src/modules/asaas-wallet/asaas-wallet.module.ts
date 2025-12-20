import { Module } from '@nestjs/common';
import { AsaasWalletController } from './asaas-wallet.controller';
import { AsaasWalletService } from './asaas-wallet.service';
import { AsaasModule } from '../asaas/asaas.module';

@Module({
  imports: [AsaasModule],
  controllers: [AsaasWalletController],
  providers: [AsaasWalletService],
  exports: [AsaasWalletService],
})
export class AsaasWalletModule {}
