import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Initialize SQLite adapter for Prisma
const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './dev.db';
const adapter = new PrismaBetterSqlite3({ url: dbPath });

// Initialize Prisma client with adapter
const prisma = new PrismaClient({ adapter });
const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me';
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

const parseAllowedOrigins = () => {
  const fromEnv = process.env.CORS_ORIGIN || 'http://localhost:5173';
  return fromEnv
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const allowedOrigins = parseAllowedOrigins();

class AppError extends Error {
  constructor(statusCode, message, details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const validateBody = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return next(new AppError(400, 'Validation failed', parsed.error.flatten()));
  }
  req.body = parsed.data;
  next();
};

const signAccessToken = (user) =>
  jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRES_IN,
  });

const signRefreshToken = (user) =>
  jwt.sign({ sub: user.id }, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
  });

const pickUserFields = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
};

const parseJsonSafely = (value) => {
  if (value == null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const serializeData = (value) => {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const parseDateOnly = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60 * 1000);

const overlaps = (startA, endA, startB, endB) => startA < endB && endA > startB;

const getConsultationEnd = (consultation) => {
  const start = parseDateOnly(consultation.preferredDateTime || consultation.scheduledAt);
  if (!start) return null;
  const duration = Number(consultation.estimatedDuration || 15);
  return addMinutes(start, duration);
};

const getConsultationStart = (consultation) =>
  parseDateOnly(consultation.preferredDateTime || consultation.scheduledAt);

const logAudit = async ({ actorUserId = null, consultationId = null, entityType, entityId = null, action, beforeState = null, afterState = null, metadata = null }) => {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId,
        consultationId,
        entityType,
        entityId,
        action,
        beforeState: serializeData(beforeState),
        afterState: serializeData(afterState),
        metadata: serializeData(metadata),
      },
    });
  } catch (error) {
    console.warn('Audit log failed:', error?.message || error);
  }
};

const queueNotification = async ({ consultationId = null, userId = null, channel, type, recipient = null, payload = null }) => {
  try {
    const record = await prisma.notificationLog.create({
      data: {
        consultationId,
        userId,
        channel,
        type,
        recipient,
        payload: serializeData(payload),
        status: 'queued',
      },
    });
    console.log(`[notification:${channel}] ${type}`, payload || '');
    return record;
  } catch (error) {
    console.warn('Notification queue failed:', error?.message || error);
    return null;
  }
};

const requireRole = (allowedRoles) => (req, res, next) => {
  if (!req.user) throw new AppError(401, 'Unauthorized');
  if (!allowedRoles.includes(req.user.role)) {
    throw new AppError(403, 'Forbidden');
  }
  next();
};

const getManagerRoleFilter = (user) => user.role === 'ADMIN' ? {} : { assignedManagerId: user.id };

const DEFAULT_WORK_START_HOUR = Number(process.env.WORK_START_HOUR || 9);
const DEFAULT_WORK_END_HOUR = Number(process.env.WORK_END_HOUR || 18);
const DEFAULT_SLOT_STEP = Number(process.env.SLOT_STEP_MINUTES || 15);

const getDayBounds = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const generateSlots = ({ date, durationMinutes, consultations, stepMinutes = DEFAULT_SLOT_STEP }) => {
  const slots = [];
  const day = new Date(date);
  if (Number.isNaN(day.getTime())) return slots;

  const workStart = new Date(day);
  workStart.setHours(DEFAULT_WORK_START_HOUR, 0, 0, 0);
  const workEnd = new Date(day);
  workEnd.setHours(DEFAULT_WORK_END_HOUR, 0, 0, 0);
  const durationMs = durationMinutes * 60 * 1000;

  for (let cursor = new Date(workStart); cursor.getTime() + durationMs <= workEnd.getTime(); cursor = addMinutes(cursor, stepMinutes)) {
    const slotStart = new Date(cursor);
    const slotEnd = addMinutes(slotStart, durationMinutes);
    const blocked = consultations.some((consultation) => {
      const existingStart = getConsultationStart(consultation);
      const existingEnd = getConsultationEnd(consultation);
      if (!existingStart || !existingEnd) return false;
      return overlaps(slotStart, slotEnd, existingStart, existingEnd);
    });
    if (!blocked) {
      slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
    }
  }

  return slots;
};

const authMiddleware = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError(401, 'Unauthorized');
  }

  const token = authHeader.replace('Bearer ', '').trim();
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    throw new AppError(401, 'Invalid or expired token');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: pickUserFields,
  });

  if (!user) {
    throw new AppError(401, 'Unauthorized');
  }

  req.user = user;
  next();
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().min(7).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const consultationSchema = z
  .object({
    email: z.string().email(),
    phone: z.string().min(7),
    firstName: z.string().min(1),
    lastName: z.string().optional().nullable(),
    description: z.string().max(2000).optional().nullable(),
    serviceId: z.string().optional().nullable(),
    consultationType: z.enum(['FREE', 'PAID']).default('FREE'),
    serviceCategory: z.string().optional().nullable(),
    serviceName: z.string().optional().nullable(),
    servicePriceText: z.string().optional().nullable(),
    preferredDateTime: z.string().min(1),
    estimatedDuration: z.coerce.number().int().positive().max(240).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.consultationType === 'PAID') {
      const hasServiceRef = Boolean(data.serviceId || (data.serviceName && data.serviceCategory));
      if (!hasServiceRef) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['serviceId'],
          message: 'For PAID consultation provide serviceId or serviceName+serviceCategory',
        });
      }
    }
  });

const consultationPatchSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
  scheduledAt: z.string().optional(),
  assignedManagerId: z.string().min(1).optional().nullable(),
  internalNotes: z.string().max(4000).optional().nullable(),
});

const orderSchema = z.object({
  serviceId: z.string().min(1),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, try again later' },
});

// Middleware
app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('CORS blocked')); 
    },
    credentials: true,
  })
);
app.use(morgan('short'));
app.use(express.json({ limit: '1mb' }));

// ============ Health Check ============
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'FinOK backend running' });
});

app.get('/api/openapi.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'openapi.json'));
});

app.get('/api/docs', (req, res) => {
  res.type('html').send(`
    <html>
      <head><title>FinOK API Docs</title></head>
      <body style="font-family: sans-serif; padding: 24px;">
        <h1>FinOK API Docs</h1>
        <p><a href="/api/openapi.json">OpenAPI JSON</a></p>
      </body>
    </html>
  `);
});

// ============ Public Settings (App Configuration) ============
app.get('/api/apps/public/prod/public-settings/by-id/:appId', (req, res) => {
  const { appId } = req.params;
  res.json({
    id: appId,
    name: 'FinOK',
    description: 'Фінансові консультації та послуги',
    publicApiUrl: `http://localhost:${PORT}`,
  });
});

// ============ AUTH ENDPOINTS ============

// Register (create new user)
app.post('/api/auth/register', authLimiter, validateBody(registerSchema), asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, phone } = req.body;
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    const user = await prisma.user.create({
      data: {
        email,
        password: passwordHash,
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
      },
    });

    res.status(201).json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new AppError(409, 'Email already exists');
    }
    throw error;
  }
}));

// Login
app.post('/api/auth/login', authLimiter, validateBody(loginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError(401, 'Invalid credentials');
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    throw new AppError(401, 'Invalid credentials');
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  res.json({
    token: accessToken,
    accessToken,
    access_token: accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
    },
  });
}));

app.post('/api/auth/refresh', authLimiter, validateBody(refreshSchema), asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  let payload;
  try {
    payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
  } catch {
    throw new AppError(401, 'Invalid or expired refresh token');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new AppError(401, 'Unauthorized');

  const accessToken = signAccessToken(user);
  res.json({ token: accessToken, accessToken, access_token: accessToken });
}));

// Get current user
app.get('/api/auth/me', authMiddleware, asyncHandler(async (req, res) => {
  res.json(req.user);
}));

// ============ SERVICES ENDPOINTS ============

// Get all services
app.get('/api/entities/Service', asyncHandler(async (req, res) => {
  const services = await prisma.service.findMany({ where: { isActive: true } });
  res.json(services);
}));

// Get single service
app.get('/api/entities/Service/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) throw new AppError(404, 'Service not found');
  res.json(service);
}));

// ============ CONSULTATIONS ENDPOINTS ============
app.post('/api/entities/Consultation', validateBody(consultationSchema), asyncHandler(async (req, res) => {
  const {
    email,
    phone,
    firstName,
    lastName,
    description,
    serviceId,
    consultationType,
    serviceCategory,
    serviceName,
    servicePriceText,
    preferredDateTime,
    estimatedDuration,
  } = req.body;

  const preferredDate = new Date(preferredDateTime);
  if (Number.isNaN(preferredDate.getTime())) {
    throw new AppError(400, 'preferredDateTime has invalid format');
  }

  if (serviceId) {
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) throw new AppError(404, 'Service not found');
  }

  const normalizedDuration = consultationType === 'FREE'
    ? 15
    : Number(estimatedDuration || 45);

  const consultationEnd = addMinutes(preferredDate, normalizedDuration);
  const { start: dayStart, end: dayEnd } = getDayBounds(preferredDate);

  const existingConsultations = await prisma.consultation.findMany({
    where: {
      status: { in: ['PENDING', 'CONFIRMED'] },
      preferredDateTime: {
        gte: dayStart,
        lte: dayEnd,
      },
    },
    select: {
      id: true,
      preferredDateTime: true,
      scheduledAt: true,
      estimatedDuration: true,
      status: true,
    },
  });

  const hasConflict = existingConsultations.some((existing) => {
    const existingStart = getConsultationStart(existing);
    const existingEnd = getConsultationEnd(existing);
    if (!existingStart || !existingEnd) return false;
    return overlaps(preferredDate, consultationEnd, existingStart, existingEnd);
  });

  if (hasConflict) {
    throw new AppError(409, 'Chosen time slot is already booked');
  }

  let resolvedService = null;
  if (serviceId) {
    resolvedService = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!resolvedService) throw new AppError(404, 'Service not found');
  }

  const effectiveDuration = consultationType === 'PAID'
    ? Number(estimatedDuration || resolvedService?.duration || 45)
    : 15;

  const consultation = await prisma.consultation.create({
    data: {
      email,
      phone,
      firstName,
      lastName: lastName || null,
      description: description || null,
      serviceId: consultationType === 'PAID' ? serviceId || null : null,
      consultationType,
      isPaid: consultationType === 'PAID',
      estimatedDuration: effectiveDuration,
      serviceCategory: consultationType === 'PAID' ? serviceCategory || null : null,
      serviceName: consultationType === 'PAID' ? serviceName || null : null,
      servicePriceText: consultationType === 'PAID' ? servicePriceText || null : null,
      preferredDateTime: preferredDate,
      status: 'PENDING',
      createdById: req.user?.id || null,
    },
    include: { service: true },
  });

  await logAudit({
    actorUserId: req.user?.id || null,
    consultationId: consultation.id,
    entityType: 'Consultation',
    entityId: consultation.id,
    action: 'CREATE',
    afterState: consultation,
    metadata: {
      consultationType,
      serviceId,
      preferredDateTime,
      estimatedDuration: effectiveDuration,
    },
  });

  await queueNotification({
    consultationId: consultation.id,
    channel: 'email',
    type: 'consultation.created.client',
    recipient: email,
    payload: {
      firstName,
      preferredDateTime,
      consultationType,
    },
  });

  await queueNotification({
    consultationId: consultation.id,
    channel: 'telegram',
    type: 'consultation.created.team',
    recipient: process.env.TELEGRAM_TEAM_CHAT_ID || null,
    payload: {
      consultationId: consultation.id,
      firstName,
      phone,
      consultationType,
      serviceName,
      serviceCategory,
      preferredDateTime,
    },
  });

  res.status(201).json(consultation);
}));

// List consultations (with optional filters)
app.get('/api/entities/Consultation', authMiddleware, asyncHandler(async (req, res) => {
  const { consultationType, status, serviceId } = req.query;

  const where = {};
  if (consultationType) where.consultationType = consultationType;
  if (status) where.status = status;
  if (serviceId) where.serviceId = serviceId;

  const consultations = await prisma.consultation.findMany({
    where,
    include: { service: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json(consultations);
}));

// Public availability slots
app.get('/api/entities/Consultation/available-slots', asyncHandler(async (req, res) => {
  const { date, duration = 15, step = DEFAULT_SLOT_STEP } = req.query;
  if (!date) throw new AppError(400, 'date query param is required');

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) throw new AppError(400, 'Invalid date');

  const { start: dayStart, end: dayEnd } = getDayBounds(parsedDate);
  const consultations = await prisma.consultation.findMany({
    where: {
      status: { in: ['PENDING', 'CONFIRMED'] },
      preferredDateTime: { gte: dayStart, lte: dayEnd },
    },
    select: {
      preferredDateTime: true,
      scheduledAt: true,
      estimatedDuration: true,
      status: true,
    },
  });

  const slots = generateSlots({
    date: parsedDate,
    durationMinutes: Number(duration) || 15,
    consultations,
    stepMinutes: Number(step) || DEFAULT_SLOT_STEP,
  });

  res.json({ date: parsedDate.toISOString(), duration: Number(duration) || 15, slots });
}));

// Get single consultation
app.get('/api/entities/Consultation/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const consultation = await prisma.consultation.findUnique({
    where: { id },
    include: { service: true },
  });

  if (!consultation) throw new AppError(404, 'Consultation not found');
  res.json(consultation);
}));

// Update consultation status
app.patch('/api/entities/Consultation/:id', authMiddleware, validateBody(consultationPatchSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, scheduledAt, assignedManagerId, internalNotes } = req.body;

  try {
    const before = await prisma.consultation.findUnique({ where: { id } });
    if (!before) throw new AppError(404, 'Consultation not found');

    const consultation = await prisma.consultation.update({
      where: { id },
      data: {
        status: status || undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        assignedManagerId: assignedManagerId === null ? null : assignedManagerId || undefined,
        internalNotes: internalNotes === null ? null : internalNotes || undefined,
        updatedById: req.user.id,
      },
      include: { service: true },
    });

    await logAudit({
      actorUserId: req.user.id,
      consultationId: consultation.id,
      entityType: 'Consultation',
      entityId: consultation.id,
      action: 'UPDATE',
      beforeState: before,
      afterState: consultation,
      metadata: { status, scheduledAt, assignedManagerId },
    });

    if (status && status !== before.status) {
      await queueNotification({
        consultationId: consultation.id,
        channel: 'email',
        type: 'consultation.status.changed.client',
        recipient: consultation.email,
        payload: { status, consultationId: consultation.id },
      });
    }

    res.json(consultation);
  } catch (error) {
    if (error.code === 'P2025') throw new AppError(404, 'Consultation not found');
    throw error;
  }
}));

// ============ ADMIN ENDPOINTS ============
app.get('/api/admin/consultations', authMiddleware, requireRole(['ADMIN', 'MANAGER']), asyncHandler(async (req, res) => {
  const {
    status,
    consultationType,
    assignedManagerId,
    dateFrom,
    dateTo,
    search,
  } = req.query;

  const where = {
    ...getManagerRoleFilter(req.user),
  };

  if (status) where.status = status;
  if (consultationType) where.consultationType = consultationType;
  if (assignedManagerId) where.assignedManagerId = assignedManagerId;
  if (dateFrom || dateTo) {
    where.preferredDateTime = {};
    if (dateFrom) where.preferredDateTime.gte = new Date(dateFrom);
    if (dateTo) where.preferredDateTime.lte = new Date(dateTo);
  }

  const consultations = await prisma.consultation.findMany({
    where,
    include: {
      service: true,
      assignedManager: { select: pickUserFields },
      createdBy: { select: pickUserFields },
    },
    orderBy: { createdAt: 'desc' },
  });

  const filtered = search
    ? consultations.filter((item) => {
        const haystack = [
          item.firstName,
          item.lastName,
          item.email,
          item.phone,
          item.serviceName,
          item.serviceCategory,
          item.description,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(String(search).toLowerCase());
      })
    : consultations;

  res.json(filtered);
}));

app.get('/api/admin/stats', authMiddleware, requireRole(['ADMIN', 'MANAGER']), asyncHandler(async (req, res) => {
  const where = getManagerRoleFilter(req.user);
  const consultations = await prisma.consultation.findMany({
    where,
    select: {
      id: true,
      consultationType: true,
      status: true,
      preferredDateTime: true,
      createdAt: true,
    },
  });

  const total = consultations.length;
  const freeCount = consultations.filter((c) => c.consultationType === 'FREE').length;
  const paidCount = consultations.filter((c) => c.consultationType === 'PAID').length;
  const statusCounts = consultations.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  res.json({
    total,
    freeCount,
    paidCount,
    statusCounts,
    upcoming: consultations.filter((c) => c.preferredDateTime && new Date(c.preferredDateTime) > new Date()).length,
  });
}));

app.get('/api/admin/audit-logs', authMiddleware, requireRole(['ADMIN']), asyncHandler(async (req, res) => {
  const logs = await prisma.auditLog.findMany({
    include: {
      actorUser: { select: pickUserFields },
      consultation: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(logs.map((item) => ({
    ...item,
    beforeState: parseJsonSafely(item.beforeState),
    afterState: parseJsonSafely(item.afterState),
    metadata: parseJsonSafely(item.metadata),
  })));
}));

app.get('/api/admin/notifications', authMiddleware, requireRole(['ADMIN', 'MANAGER']), asyncHandler(async (req, res) => {
  const logs = await prisma.notificationLog.findMany({
    include: {
      consultation: true,
      user: { select: pickUserFields },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(logs.map((item) => ({
    ...item,
    payload: parseJsonSafely(item.payload),
  })));
}));

// ============ ORDERS ENDPOINTS (для платних послуг) ============

// Create order
app.post('/api/entities/Order', authMiddleware, validateBody(orderSchema), asyncHandler(async (req, res) => {
  const { serviceId } = req.body;

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) throw new AppError(404, 'Service not found');

  const order = await prisma.order.create({
    data: {
      userId: req.user.id,
      serviceId,
      amount: service.price,
      status: 'PENDING',
    },
    include: { service: true },
  });

  res.status(201).json(order);
}));

// Get orders
app.get('/api/entities/Order', authMiddleware, asyncHandler(async (req, res) => {
  const { status } = req.query;

  const where = { userId: req.user.id };
  if (status) where.status = status;

  const orders = await prisma.order.findMany({
    where,
    include: { service: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json(orders);
}));

// ============ Error Handling ============
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  if (err.message === 'CORS blocked') {
    return res.status(403).json({ error: 'CORS policy blocked this origin' });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
    });
  }

  console.error('Unhandled server error:', err);
  return res.status(500).json({
    error: 'Internal server error',
    ...(NODE_ENV !== 'production' ? { details: err.message } : {}),
  });
});

// ============ Start Server ============
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMainModule) {
  app.listen(PORT, () => {
    console.log(`Backend listening on http://localhost:${PORT}`);
  });
}

export { app, prisma };

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});
