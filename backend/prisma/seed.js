// This is the seed file for Prisma
// Run: npx prisma db seed

import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './dev.db';
const adapter = new PrismaBetterSqlite3({ url: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', dbPath) });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');
  const passwordHash = await bcrypt.hash('Test123456!', 10);

  // Clear existing data
  await prisma.consultation.deleteMany();
  await prisma.order.deleteMany();
  await prisma.service.deleteMany();
  await prisma.user.deleteMany();

  // Create sample services with fixed prices
  const services = await prisma.service.createMany({
    data: [
      {
        name: 'Консультація з податків',
        description: 'Консультація щодо оптимізації податків для фізичних осіб',
        price: 500,
        duration: 60,
        category: 'Податки',
        isActive: true,
      },
      {
        name: 'Реєстрація ФОП',
        description: 'Реєстрація фізичної особи-підприємця',
        price: 1500,
        duration: 120,
        category: 'Реєстрація',
        isActive: true,
      },
      {
        name: 'Консультація з бухгалтерії',
        description: 'Консультація з ведення бухгалтерії',
        price: 800,
        duration: 90,
        category: 'Бухгалтерія',
        isActive: true,
      },
      {
        name: 'Разовий аудит',
        description: 'Однакратна перевірка фінансової документації',
        price: 2500,
        duration: 180,
        category: 'Аудит',
        isActive: true,
      },
    ],
  });

  console.log(`✅ Created ${services.count} services`);

  // Create sample users
  const users = await prisma.user.createMany({
    data: [
      {
        email: 'admin@finok.local',
        password: passwordHash,
        role: 'ADMIN',
        firstName: 'Адмін',
        lastName: 'ФінОк',
        phone: '+380500000001',
      },
      {
        email: 'manager@finok.local',
        password: passwordHash,
        role: 'MANAGER',
        firstName: 'Менеджер',
        lastName: 'ФінОк',
        phone: '+380500000002',
      },
      {
        email: 'client1@example.com',
        password: passwordHash,
        firstName: 'Іван',
        lastName: 'Петренко',
        phone: '+380501234567',
      },
      {
        email: 'client2@example.com',
        password: passwordHash,
        firstName: 'Марія',
        lastName: 'Коваленко',
        phone: '+380502345678',
      },
    ],
  });

  console.log(`✅ Created ${users.count} users`);

  // Create sample FREE consultation (без послуги)
  await prisma.consultation.create({
    data: {
      email: 'free-consultation@example.com',
      firstName: 'Петро',
      lastName: 'Бойко',
      phone: '+380509999999',
      consultationType: 'FREE',
      isPaid: false,
      estimatedDuration: 15,
      description: 'Запит на безкоштовну консультацію з податків',
      status: 'PENDING',
      preferredDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  await prisma.consultation.create({
    data: {
      email: 'paid-consultation@example.com',
      firstName: 'Олена',
      lastName: 'Коваль',
      phone: '+380508888888',
      consultationType: 'PAID',
      isPaid: true,
      estimatedDuration: 45,
      serviceCategory: 'ФОП',
      serviceName: 'Реєстрація ФОП під ключ',
      servicePriceText: 'від 1 500 ₴',
      description: 'Потрібна платна консультація по реєстрації ФОП',
      status: 'PENDING',
      preferredDateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('✅ Created sample consultations');

  console.log('✨ Database seeding completed!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seeding error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
