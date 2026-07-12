# FinOK Backend

Сервер Express + Prisma + SQLite для FinOK консультацій та послуг.

## Встановлення

1. Встановіть залежності:
```bash
npm install
```

2. Ініціалізуйте базу даних (Prisma ORM):
```bash
npm run db:push
```

3. Заповніть БД тестовими даними:
```bash
npm run db:seed
```

## Запуск

**Розробка** (з автоперезавантаженням через nodemon):
```bash
npm run dev
```

**Продакшен:**
```bash
npm start
```

**Prisma Studio** (графічний інтерфейс БД):
```bash
npm run db:studio
```

**Резервна копія БД**:
```bash
npm run db:backup
```

## Структура БД

### User
- Клієнти системи
- email, password, role, firstName, lastName, phone

### Service
- Послуги з фіксованою вартістю
- name, description, price, duration, category, isActive

### Consultation
- Консультації (безкоштовні або прив'язані до послуги)
- email, phone, firstName, lastName, description
- **consultationType**: `FREE` (без послуги) або `PAID` (з послугою)
- **preferredDateTime**: бажані дата і час клієнта
- **estimatedDuration**: орієнтовна тривалість у хвилинах
- **serviceCategory / serviceName / servicePriceText**: дані для платної консультації
- **assignedManagerId / internalNotes**: менеджер і внутрішні нотатки
- **status**: PENDING, CONFIRMED, COMPLETED, CANCELLED

### NotificationLog
- Черга повідомлень для email/Telegram

### AuditLog
- Журнал змін для консультацій та адмінських дій

### Order
- Замовлення на платні послуги
- userId, serviceId, amount, status

## API Endpoints

### Health
- `GET /api/health` — перевірка доступності
- `GET /api/openapi.json` — OpenAPI JSON
- `GET /api/docs` — прості API docs

### Auth
- `POST /api/auth/register` — реєстрація користувача
- `POST /api/auth/login` — логін
- `POST /api/auth/refresh` — оновлення access token
- `GET /api/auth/me` — поточний користувач (потребує токену)

### Services (послуги)
- `GET /api/entities/Service` — список всіх послуг
- `GET /api/entities/Service/:id` — деталі послуги

### Consultations
- `POST /api/entities/Consultation` — створити консультацію
  ```json
  {
    "email": "user@example.com",
    "phone": "+380501234567",
    "firstName": "Іван",
    "lastName": "Петренко",
    "description": "Запит",
    "consultationType": "FREE",
    "serviceId": null,
    "preferredDateTime": "2026-07-12T11:00:00.000Z"
  }
  ```
- `GET /api/entities/Consultation` — список (фільтри: consultationType, status, serviceId) **(auth required)**
- `GET /api/entities/Consultation/:id` — деталі **(auth required)**
- `PATCH /api/entities/Consultation/:id` — оновити статус/час **(auth required)**
- `GET /api/entities/Consultation/available-slots` — доступні слоти на день

### Admin
- `GET /api/admin/consultations` — список консультацій з фільтрами
- `GET /api/admin/stats` — dashboard статистика
- `GET /api/admin/notifications` — журнал повідомлень
- `GET /api/admin/audit-logs` — аудиторський журнал

### Orders (замовлення)
- `POST /api/entities/Order` — створити замовлення **(auth required)**
- `GET /api/entities/Order` — список (фільтр: status) **(auth required)**

## Безпека (впроваджено)

- [x] Хешування паролів (`bcryptjs`)
- [x] JWT access/refresh токени
- [x] CORS allowlist через `CORS_ORIGIN`
- [x] Rate limiting для auth endpoint-ів
- [x] Валідація вводу (`zod`)
- [x] `helmet` middleware
- [x] Централізований error handler

## Розробка

### Перегляд схеми БД
```bash
npx prisma studio
```

### Виконання міграції після змін schema
```bash
npx prisma db push
```

### Переправка БД (видалення всіх даних)
```bash
npx prisma db push --force-reset
```

## Середовище

Змінні в `.env`:
- `DATABASE_URL` — шлях до SQLite БД
- `JWT_SECRET` — ключ для access token
- `JWT_REFRESH_SECRET` — ключ для refresh token
- `JWT_ACCESS_EXPIRES_IN` — TTL access token (напр. `15m`)
- `JWT_REFRESH_EXPIRES_IN` — TTL refresh token (напр. `7d`)
- `BCRYPT_ROUNDS` — складність хешування паролів (напр. `10`)
- `CORS_ORIGIN` — дозволені origin (comma-separated)
- `PORT` — порт сервера (за замовчуванням 4000)
- `NODE_ENV` — development/production
