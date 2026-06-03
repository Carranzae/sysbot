import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 🏢 Create default business types
  const businessTypes = [
    { name: 'Restaurant Demo', industryType: 'RESTAURANT' },
    { name: 'Clinic Demo', industryType: 'CLINIC' },
    { name: 'Real Estate Demo', industryType: 'REAL_ESTATE' },
    { name: 'Academy Demo', industryType: 'ACADEMY' },
    { name: 'Retail Demo', industryType: 'RETAIL' },
    { name: 'Services Demo', industryType: 'SERVICES' },
  ];

  for (const type of businessTypes) {
    console.log(`📦 Seeding business: ${type.name}`);
  }

  // 👤 Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@botsas.com' },
    update: {},
    create: {
      email: 'admin@botsas.com',
      password: '$2b$10$YourHashedPasswordHere', // Change this!
      firstName: 'Admin',
      lastName: 'User',
      phone: '+1234567890',
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('👤 Admin user created:', adminUser.email);

  // ⚙️ Create system configuration
  const existingConfig = await prisma.systemConfig.findFirst({
    where: { key: 'app_version', scope: 'GLOBAL' }
  });

  if (!existingConfig) {
    const systemConfig = await prisma.systemConfig.create({
      data: {
        key: 'app_version',
        value: '1.0.0',
        scope: 'GLOBAL',
      },
    });
    console.log('⚙️ System config created:', systemConfig.key);
  } else {
    console.log('⚙️ System config already exists:', existingConfig.key);
  }

  console.log('✅ Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
