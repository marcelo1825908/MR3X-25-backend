import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './config/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { ChatsModule } from './modules/chats/chats.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { AgenciesModule } from './modules/agencies/agencies.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { AuditModule } from './modules/audit/audit.module';
import { ValidationModule } from './modules/validation/validation.module';
import { AddressModule } from './modules/address/address.module';
import { SettingsModule } from './modules/settings/settings.module';
import { PlansModule } from './modules/plans/plans.module';
import { ContractTemplatesModule } from './modules/contract-templates/contract-templates.module';
import { TenantAnalysisModule } from './modules/tenant-analysis/tenant-analysis.module';
import { InspectionsModule } from './modules/inspections/inspections.module';
import { AgreementsModule } from './modules/agreements/agreements.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.cellere-asaas'],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    PropertiesModule,
    ContractsModule,
    PaymentsModule,
    TenantsModule,
    ChatsModule,
    NotificationsModule,
    DashboardModule,
    CompaniesModule,
    AgenciesModule,
    DocumentsModule,
    AuditModule,
    ValidationModule,
    AddressModule,
    SettingsModule,
    PlansModule,
    ContractTemplatesModule,
    TenantAnalysisModule,
    InspectionsModule,
    AgreementsModule,
    InvoicesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
