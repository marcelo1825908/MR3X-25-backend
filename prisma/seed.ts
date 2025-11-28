import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data
  console.log('🧹 Clearing existing data...');

  // Delete in correct order to respect foreign key constraints
  await prisma.refreshToken.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.message.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.propertyImage.deleteMany();
  await prisma.property.deleteMany();
  await prisma.agency.deleteMany();
  await prisma.user.deleteMany();

  // Create only CEO user
  // Per MR3X Hierarchy Requirements:
  // - CEO is the root profile, created only once
  // - CEO creates ADMIN users
  // - All other users are created through the proper hierarchy
  console.log('👤 Creating CEO user...');
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

  console.log('✅ Database seeding completed successfully!');
  console.log('\n📋 Account Created:');
  console.log('CEO: ceo@gmail.com / 123456');
  console.log('\n📌 Note: Per MR3X Hierarchy Requirements:');
  console.log('   - CEO can only create ADMIN users');
  console.log('   - ADMIN can create: AGENCY_MANAGER, LEGAL_AUDITOR, REPRESENTATIVE, API_CLIENT');
  console.log('   - AGENCY_ADMIN can create: AGENCY_MANAGER, BROKER, PROPRIETARIO');
  console.log('   - AGENCY_MANAGER can create: BROKER, PROPRIETARIO');
  console.log('   - INDEPENDENT_OWNER can create: INQUILINO, BUILDING_MANAGER');
  console.log('   - All other roles are created through self-registration or by authorized users');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
