// This is the seed file for Prisma
// Run: npx prisma db seed

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db';
}

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');
  const passwordHash = await bcrypt.hash('Test123456!', 10);

  // Clear existing data
  await prisma.notificationLog.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.review.deleteMany();
  await prisma.blogPost.deleteMany();
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
        email: 'manager2@finok.local',
        password: passwordHash,
        role: 'MANAGER',
        firstName: 'Ірина',
        lastName: 'Менеджер',
        phone: '+380500000003',
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

  const [admin, manager1, manager2] = await Promise.all([
    prisma.user.findUnique({ where: { email: 'admin@finok.local' } }),
    prisma.user.findUnique({ where: { email: 'manager@finok.local' } }),
    prisma.user.findUnique({ where: { email: 'manager2@finok.local' } }),
  ]);

  const servicesList = await prisma.service.findMany();
  const getService = (namePart) => servicesList.find((s) => s.name.includes(namePart));

  const now = Date.now();
  const consultations = await Promise.all([
    prisma.consultation.create({
      data: {
        email: 'free-consultation@example.com',
        firstName: 'Петро',
        lastName: 'Бойко',
        phone: '+380509999999',
        consultationType: 'FREE',
        isPaid: false,
        estimatedDuration: 15,
        preferredContactMethod: 'TELEGRAM',
        description: 'Запит на безкоштовну консультацію з податків',
        status: 'PENDING',
        preferredDateTime: new Date(now + 24 * 60 * 60 * 1000),
      },
    }),

    prisma.consultation.create({
      data: {
        email: 'paid-consultation@example.com',
        firstName: 'Олена',
        lastName: 'Коваль',
        phone: '+380508888888',
        consultationType: 'PAID',
        isPaid: true,
        estimatedDuration: 45,
        preferredContactMethod: 'EMAIL',
        serviceId: getService('Реєстрація')?.id || null,
        serviceCategory: 'ФОП',
        serviceName: 'Реєстрація ФОП під ключ',
        servicePriceText: 'від 1 500 ₴',
        description: 'Потрібна платна консультація по реєстрації ФОП',
        status: 'CONFIRMED',
        assignedManagerId: manager1?.id || null,
        confirmedById: admin?.id || null,
        confirmedAt: new Date(now - 2 * 60 * 60 * 1000),
        googleMeetLink: 'https://meet.google.com/new',
        preferredDateTime: new Date(now + 2 * 24 * 60 * 60 * 1000),
      },
    }),

    prisma.consultation.create({
      data: {
        email: 'completed@example.com',
        firstName: 'Андрій',
        lastName: 'Мельник',
        phone: '+380507777777',
        consultationType: 'PAID',
        isPaid: true,
        estimatedDuration: 60,
        preferredContactMethod: 'PHONE',
        serviceId: getService('бухгалтерії')?.id || null,
        serviceCategory: 'Бухгалтерія',
        serviceName: 'Консультація з бухгалтерії',
        servicePriceText: '800 ₴',
        description: 'Потрібна допомога з обліком ФОП',
        status: 'COMPLETED',
        assignedManagerId: manager2?.id || null,
        confirmedById: admin?.id || null,
        confirmedAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
        googleMeetLink: 'https://meet.google.com/new',
        preferredDateTime: new Date(now - 4 * 24 * 60 * 60 * 1000),
      },
    }),
  ]);

  console.log(`✅ Created ${consultations.length} consultations`);

  const [pendingConsultation, confirmedConsultation] = consultations;

  const tasks = await prisma.task.createMany({
    data: [
      {
        title: 'Підготувати комерційну пропозицію',
        description: 'Сформувати КП і відправити клієнту',
        status: 'TODO',
        priority: 'HIGH',
        dueDate: new Date(now + 24 * 60 * 60 * 1000),
        managerId: manager1?.id,
        consultationId: confirmedConsultation?.id,
      },
      {
        title: 'Закрити кейс і відправити матеріали',
        description: 'Надіслати підсумки по консультації',
        status: 'DONE',
        priority: 'MEDIUM',
        dueDate: new Date(now - 2 * 24 * 60 * 60 * 1000),
        managerId: manager2?.id,
      },
    ].filter((item) => item.managerId),
  });
  console.log(`✅ Created ${tasks.count} tasks`);

  const blogPosts = await prisma.blogPost.createMany({
    data: [
      {
        title: 'Що змінилося для ФОП у 2026 році',
        slug: 'fop-2026-zminy',
        excerpt: 'Коротко про ключові зміни для підприємців.',
        content: 'У цьому матеріалі розберемо нові правила, ставки та ризики для ФОП у 2026 році. Практичні поради, чекліст і типові помилки.',
        category: 'Новини',
        tags: 'фоп,податки,новини',
        status: 'PUBLISHED',
        publishedAt: new Date(now - 24 * 60 * 60 * 1000),
        authorId: admin?.id || null,
      },
      {
        title: 'Як підготуватися до перевірки: 10 кроків',
        slug: 'pidgotovka-do-perevirky-10-krokiv',
        excerpt: 'Покрокова підготовка документів та процесів.',
        content: 'Цей гайд допоможе підготувати бізнес до перевірки без зайвого стресу: від документів до комунікації з командою.',
        category: 'Аналітика',
        tags: 'перевірка,бізнес,облік',
        status: 'DRAFT',
        authorId: admin?.id || null,
      },
    ],
  });
  console.log(`✅ Created ${blogPosts.count} blog posts`);

  const reviews = await prisma.review.createMany({
    data: [
      {
        name: 'Марина К.',
        role: 'Власниця ФОП',
        text: 'Все чітко і по ділу. Допомогли розкласти фінанси по поличках.',
        rating: 5,
        isApproved: true,
      },
      {
        name: 'Олег Т.',
        role: 'Директор ТОВ',
        text: 'Консультація була дуже корисною, хочемо продовжити співпрацю.',
        rating: 5,
        isApproved: false,
      },
    ],
  });
  console.log(`✅ Created ${reviews.count} reviews`);

  const notifications = await prisma.notificationLog.createMany({
    data: [
      {
        consultationId: pendingConsultation?.id || null,
        channel: 'email',
        type: 'consultation.created.client',
        recipient: pendingConsultation?.email || null,
        payload: JSON.stringify({ sample: true }),
        status: 'queued',
      },
      {
        consultationId: confirmedConsultation?.id || null,
        userId: manager1?.id || null,
        channel: 'email',
        type: 'consultation.assigned.manager',
        recipient: manager1?.email || null,
        payload: JSON.stringify({ sample: true }),
        status: 'queued',
      },
    ],
  });
  console.log(`✅ Created ${notifications.count} notifications`);

  const audits = await prisma.auditLog.createMany({
    data: [
      {
        actorUserId: admin?.id || null,
        consultationId: confirmedConsultation?.id || null,
        entityType: 'Consultation',
        entityId: confirmedConsultation?.id || null,
        action: 'UPDATE',
        metadata: JSON.stringify({ status: 'CONFIRMED' }),
      },
      {
        actorUserId: admin?.id || null,
        entityType: 'BlogPost',
        action: 'CREATE_BLOG_POST',
        metadata: JSON.stringify({ sample: true }),
      },
    ],
  });
  console.log(`✅ Created ${audits.count} audit logs`);
  console.log('✨ Database seeding completed!');
  console.log('🔐 Demo credentials: admin@finok.local / Test123456!');
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
