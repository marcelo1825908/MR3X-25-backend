import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
import { ExtrajudicialNotificationsModule } from './modules/extrajudicial-notifications/extrajudicial-notifications.module';
import { AgreementsModule } from './modules/agreements/agreements.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { ApiClientModule } from './modules/api-client/api-client.module';
import { SalesRepModule } from './modules/sales-rep/sales-rep.module';
import { AuditorModule } from './modules/auditor/auditor.module';
import { PlatformManagerModule } from './modules/platform-manager/platform-manager.module';
import { AsaasModule } from './modules/asaas/asaas.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.cellere-asaas'],
    }),
    ScheduleModule.forRoot(),
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
    ExtrajudicialNotificationsModule,
    AgreementsModule,
    InvoicesModule,
    ApiClientModule,
    SalesRepModule,
    AuditorModule,
    PlatformManagerModule,
    AsaasModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
