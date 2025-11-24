import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data
  console.log('🧹 Clearing existing data...');
  await prisma.refreshToken.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.inspection.deleteMany();
  await prisma.activeChat.deleteMany();
  await prisma.message.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.transfer.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.property.deleteMany();
  await prisma.legalRepresentative.deleteMany();
  await prisma.agency.deleteMany(); // Add agency cleanup
  // Delete users in correct order to respect foreign key constraints
  await prisma.user.deleteMany({
    where: { ownerId: { not: null } } // Delete tenants first
  });
  await prisma.user.deleteMany({
    where: { ownerId: null } // Then delete owners
  });
  await prisma.company.deleteMany();

  // Create companies
  console.log('🏢 Creating companies...');
  // Create agencies
  console.log('🏢 Creating agencies...');
  const agency1 = await prisma.agency.create({
    data: {
      name: 'Central Imóveis',
      cnpj: '12.345.678/0001-90',
      email: 'contato@centralimoveis.com',
      phone: '(11) 3333-4444',
      address: 'Rua das Flores, 123',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01234-567',
      status: 'ACTIVE',
      plan: 'ESSENCIAL',
      maxProperties: 50,
      maxUsers: 10,
    },
  });

  const agency2 = await prisma.agency.create({
    data: {
      name: 'Premium Real Estate',
      cnpj: '98.765.432/0001-10',
      email: 'contato@premiumrealestate.com',
      phone: '(11) 5555-6666',
      address: 'Av. Paulista, 1000',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01310-100',
      status: 'ACTIVE',
      plan: 'PROFISSIONAL',
      maxProperties: 100,
      maxUsers: 20,
    },
  });

  // Create users for all roles
  console.log('👥 Creating users...');
  const hashedPassword = await bcrypt.hash('123456', 10);

  // CEO
  const ceo = await prisma.user.create({
    data: {
      email: 'ceo@mr3x.com',
      password: hashedPassword,
      role: 'CEO',
      plan: 'PROFISSIONAL',
      name: 'João Silva',
      phone: '(11) 99999-0001',
      document: '123.456.789-00',
      status: 'ACTIVE',
    },
  });

  // ADMIN
  const admin = await prisma.user.create({
    data: {
      email: 'admin@mr3x.com',
      password: hashedPassword,
      role: 'ADMIN',
      plan: 'PROFISSIONAL',
      name: 'Maria Santos',
      phone: '(11) 99999-0002',
      document: '234.567.890-11',
      status: 'ACTIVE',
    },
  });

  // AGENCY_ADMIN (Lisa - Director/Supervisor-General)
  const agencyAdmin = await prisma.user.create({
    data: {
      email: 'lisa@central.com',
      password: hashedPassword,
      role: 'AGENCY_ADMIN',
      plan: 'PROFISSIONAL',
      name: 'Lisa Oliveira',
      phone: '(11) 99999-0003',
      document: '345.678.901-22',
      status: 'ACTIVE',
      agencyId: agency1.id,
    },
  });

  // MANAGER
  const manager = await prisma.user.create({
    data: {
      email: 'manager@central.com',
      password: hashedPassword,
      role: 'AGENCY_MANAGER',
      plan: 'ESSENCIAL',
      name: 'Pedro Oliveira',
      phone: '(11) 99999-0003',
      document: '345.678.901-22',
      agencyId: agency1.id,
      status: 'ACTIVE',
    },
  });

  // PROPRIETARIO
  const proprietario = await prisma.user.create({
    data: {
      email: 'proprietario@teste.com',
      password: hashedPassword,
      role: 'PROPRIETARIO',
      plan: 'ESSENCIAL',
      name: 'Ana Costa',
      phone: '(11) 99999-0004',
      document: '456.789.012-33',
      address: 'Rua das Palmeiras, 456',
      city: 'São Paulo',
      state: 'SP',
      cep: '04567-890',
      agencyId: agency1.id, // Linked to agency
      status: 'ACTIVE',
    },
  });

  // CORRETOR
  const corretor = await prisma.user.create({
    data: {
      email: 'corretor@central.com',
      password: hashedPassword,
      role: 'BROKER',
      plan: 'FREE',
      name: 'Carlos Mendes',
      phone: '(11) 99999-0005',
      document: '567.890.123-44',
      agencyId: agency1.id,
      brokerId: manager.id, // Assigned to the agency manager
      status: 'ACTIVE',
    },
  });

  // INQUILINO
  const inquilino1 = await prisma.user.create({
    data: {
      email: 'inquilino1@teste.com',
      password: hashedPassword,
      role: 'INQUILINO',
      plan: 'FREE',
      name: 'Lucia Ferreira',
      phone: '(11) 99999-0006',
      document: '678.901.234-55',
      address: 'Rua das Rosas, 789',
      city: 'São Paulo',
      state: 'SP',
      cep: '05678-901',
      ownerId: proprietario.id,
      status: 'ACTIVE',
    },
  });

  const inquilino2 = await prisma.user.create({
    data: {
      email: 'inquilino2@teste.com',
      password: hashedPassword,
      role: 'INQUILINO',
      plan: 'FREE',
      name: 'Roberto Alves',
      phone: '(11) 99999-0007',
      document: '789.012.345-66',
      address: 'Av. das Acácias, 321',
      city: 'São Paulo',
      state: 'SP',
      cep: '06789-012',
      ownerId: proprietario.id,
      status: 'ACTIVE',
    },
  });

  // AUDITOR
  const auditor = await prisma.user.create({
    data: {
      email: 'auditor@mr3x.com',
      password: hashedPassword,
      role: 'LEGAL_AUDITOR',
      plan: 'ESSENCIAL',
      name: 'Fernanda Lima',
      phone: '(11) 99999-0008',
      document: '890.123.456-77',
      status: 'ACTIVE',
    },
  });

  // API_CLIENT
  const apiClient = await prisma.user.create({
    data: {
      email: 'api@integracao.com',
      password: hashedPassword,
      role: 'API_CLIENT',
      plan: 'PROFISSIONAL',
      name: 'Sistema Integração',
      status: 'ACTIVE',
    },
  });

  // Create properties
  console.log('🏠 Creating properties...');
  const property1 = await prisma.property.create({
    data: {
      ownerId: proprietario.id,
      agencyId: agency1.id,
      brokerId: corretor.id,
      name: 'Apartamento Centro',
      address: 'Rua Augusta, 100',
      neighborhood: 'Consolação',
      city: 'São Paulo',
      cep: '01305-000',
      monthlyRent: 2500.00,
      status: 'ALUGADO',
      tenantId: inquilino1.id,
      dueDay: 5,
      stateNumber: '12345',
    },
  });

  const property2 = await prisma.property.create({
    data: {
      ownerId: proprietario.id,
      agencyId: agency1.id,
      brokerId: corretor.id,
      name: 'Casa Vila Madalena',
      address: 'Rua Harmonia, 200',
      neighborhood: 'Vila Madalena',
      city: 'São Paulo',
      cep: '05435-000',
      monthlyRent: 3200.00,
      status: 'ALUGADO',
      tenantId: inquilino2.id,
      dueDay: 10,
      stateNumber: '67890',
    },
  });

  const property3 = await prisma.property.create({
    data: {
      ownerId: proprietario.id,
      agencyId: agency1.id,
      brokerId: corretor.id,
      name: 'Studio Pinheiros',
      address: 'Rua Teodoro Sampaio, 300',
      neighborhood: 'Pinheiros',
      city: 'São Paulo',
      cep: '05406-150',
      monthlyRent: 1800.00,
      status: 'DISPONIVEL',
      dueDay: 15,
      stateNumber: '11111',
    },
  });

  // Create contracts
  console.log('📋 Creating contracts...');
  const contract1 = await prisma.contract.create({
    data: {
      propertyId: property1.id,
      tenantId: inquilino1.id,
      ownerId: proprietario.id,
      agencyId: agency1.id,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      monthlyRent: 2500.00,
      status: 'ATIVO',
      tenant: inquilino1.name,
    },
  });

  const contract2 = await prisma.contract.create({
    data: {
      propertyId: property2.id,
      tenantId: inquilino2.id,
      ownerId: proprietario.id,
      agencyId: agency1.id,
      startDate: new Date('2024-02-01'),
      endDate: new Date('2025-01-31'),
      monthlyRent: 3200.00,
      status: 'ATIVO',
      tenant: inquilino2.name,
    },
  });

  // Create payments
  console.log('💰 Creating payments...');
  const payment1 = await prisma.payment.create({
    data: {
      valorPago: 2500.00,
      dataPagamento: new Date('2024-01-05'),
      contratoId: contract1.id,
      propertyId: property1.id,
      userId: inquilino1.id,
      agencyId: agency1.id,
      tipo: 'PIX',
    },
  });

  const payment2 = await prisma.payment.create({
    data: {
      valorPago: 2500.00,
      dataPagamento: new Date('2024-02-05'),
      contratoId: contract1.id,
      propertyId: property1.id,
      userId: inquilino1.id,
      agencyId: agency1.id,
      tipo: 'PIX',
    },
  });

  const payment3 = await prisma.payment.create({
    data: {
      valorPago: 3200.00,
      dataPagamento: new Date('2024-02-10'),
      contratoId: contract2.id,
      propertyId: property2.id,
      userId: inquilino2.id,
      agencyId: agency1.id,
      tipo: 'BOLETO',
    },
  });

  // Create notifications
  console.log('🔔 Creating notifications...');
  await prisma.notification.create({
    data: {
      description: 'Vencimento do aluguel',
      ownerId: proprietario.id,
      tenantId: inquilino1.id,
      propertyId: property1.id,
      agencyId: agency1.id,
      recurring: 'MONTHLY',
      type: 'ON_TIME',
      days: 3,
      creationDate: new Date(),
    },
  });

  await prisma.notification.create({
    data: {
      description: 'Pagamento recebido',
      ownerId: proprietario.id,
      tenantId: inquilino2.id,
      propertyId: property2.id,
      agencyId: agency1.id,
      recurring: 'MONTHLY',
      type: 'ON_TIME',
      days: 0,
      creationDate: new Date(),
      lastExecutionDate: new Date(),
    },
  });

  // Create chat
  console.log('💬 Creating chat...');
  const chat1 = await prisma.chat.create({
    data: {
      participant1Id: proprietario.id,
      participant2Id: inquilino1.id,
      name: 'Chat - Apartamento Centro',
      createdAt: new Date(),
    },
  });

  await prisma.message.create({
    data: {
      chatId: chat1.id,
      senderId: inquilino1.id,
      receiverId: proprietario.id,
      content: 'Olá, gostaria de saber sobre a manutenção do apartamento',
      messageTimestamp: new Date(),
      messageRead: false,
    },
  });

  await prisma.message.create({
    data: {
      chatId: chat1.id,
      senderId: proprietario.id,
      receiverId: inquilino1.id,
      content: 'Olá! Claro, qual é o problema?',
      messageTimestamp: new Date(Date.now() + 60000),
      messageRead: false,
    },
  });

  // Create audit logs
  console.log('📊 Creating audit logs...');
  await prisma.auditLog.create({
    data: {
      event: 'USER_CREATED',
      userId: admin.id,
      entity: 'USER',
      entityId: inquilino1.id,
      dataAfter: JSON.stringify({ name: inquilino1.name, email: inquilino1.email }),
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0...',
    },
  });

  await prisma.auditLog.create({
    data: {
      event: 'PROPERTY_CREATED',
      userId: proprietario.id,
      entity: 'PROPERTY',
      entityId: property1.id,
      dataAfter: JSON.stringify({ name: property1.name, address: property1.address }),
      ip: '192.168.1.2',
      userAgent: 'Mozilla/5.0...',
    },
  });

  console.log('✅ Database seeding completed successfully!');
  console.log('\n📋 Test Accounts Created:');
  console.log('CEO: ceo@mr3x.com / 123456');
  console.log('ADMIN: admin@mr3x.com / 123456');
  console.log('AGENCY_ADMIN: lisa@central.com / 123456');
  console.log('MANAGER: manager@central.com / 123456');
  console.log('PROPRIETARIO: proprietario@teste.com / 123456');
  console.log('CORRETOR: corretor@central.com / 123456');
  console.log('INQUILINO 1: inquilino1@teste.com / 123456');
  console.log('INQUILINO 2: inquilino2@teste.com / 123456');
  console.log('AUDITOR: auditor@mr3x.com / 123456');
  console.log('API_CLIENT: api@integracao.com / 123456');
  console.log('\n🏠 Properties: 3 created');
  console.log('📋 Contracts: 2 created');
  console.log('💰 Payments: 3 created');
  console.log('🔔 Notifications: 2 created');
  console.log('💬 Chat messages: 2 created');
  console.log('📊 Audit logs: 2 created');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
