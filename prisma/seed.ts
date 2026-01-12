import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  await prisma.refreshToken.deleteMany();
  await prisma.emailVerification.deleteMany();

  await prisma.auditLog.deleteMany();

  await prisma.activeChat.deleteMany();
  await prisma.message.deleteMany();
  await prisma.chat.deleteMany();

  await prisma.notification.deleteMany();

  await prisma.extrajudicialNotificationAudit.deleteMany();
  await prisma.extrajudicialNotification.deleteMany();

  await prisma.serviceContractClauseHistory.deleteMany();
  await prisma.serviceContractProperty.deleteMany();
  await prisma.serviceContract.deleteMany();

  await prisma.transfer.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.expense.deleteMany();

  await prisma.contractClauseHistory.deleteMany();
  await prisma.contractAudit.deleteMany();
  await prisma.contract.deleteMany();

  await prisma.inspectionMedia.deleteMany();
  await prisma.inspectionSignatureLink.deleteMany();
  await prisma.inspectionAudit.deleteMany();
  await prisma.inspectionItem.deleteMany();
  await prisma.inspection.deleteMany();
  await prisma.inspectionTemplate.deleteMany();

  await prisma.agreement.deleteMany();
  await prisma.agreementTemplate.deleteMany();
  await prisma.document.deleteMany();
  await prisma.propertyImage.deleteMany();
  await prisma.property.deleteMany();

  await prisma.agency.deleteMany();
  await prisma.company.deleteMany();

  await prisma.platformSettings.deleteMany();
  await prisma.igpmIndex.deleteMany();

  await prisma.planModificationRequest.deleteMany();

  await prisma.tenantAnalysis.deleteMany();

  await prisma.salesActivity.deleteMany();
  await prisma.salesGoal.deleteMany();
  await prisma.salesCommission.deleteMany();
  await prisma.salesProposal.deleteMany();
  await prisma.salesProspect.deleteMany();

  await prisma.salesMessageReply.deleteMany();
  await prisma.salesNotification.deleteMany();
  await prisma.salesMessage.deleteMany();

  await prisma.user.updateMany({
    data: {
      ownerId: null,
      brokerId: null,
      createdBy: null,
      legalRepresentativeId: null,
    },
  });

  await prisma.legalRepresentative.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash('123456', 10);

  const ceo = await prisma.user.create({
    data: {
      email: 'ceo@gmail.com',
      password: hashedPassword,
      plainPassword: '123456',
      role: UserRole.CEO,
      plan: 'PROFISSIONAL',
      name: 'CEO MR3X',
      phone: '(11) 99999-0001',
      document: '123.456.789-00',
      status: 'ACTIVE',
    },
  });
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
