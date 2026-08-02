import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { PrismaClient } from '@prisma/client';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Initialize Prisma client
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me';
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const JWT_RESET_EXPIRES_IN = process.env.JWT_RESET_EXPIRES_IN || '1h';
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);
const COOKIE_SECURE = NODE_ENV === 'production';
const PUBLIC_API_URL = process.env.PUBLIC_API_URL || `http://localhost:${PORT}`;
const ALLOW_ONRENDER_ORIGINS = String(process.env.ALLOW_ONRENDER_ORIGINS || 'true').toLowerCase() === 'true';

const buildCookieOptions = (maxAgeMs) => ({
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: COOKIE_SECURE ? 'none' : 'lax',
  path: '/',
  maxAge: maxAgeMs,
});

if (NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret-change-me') {
    throw new Error('JWT_SECRET must be set in production');
  }
  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET === 'dev-refresh-secret-change-me') {
    throw new Error('JWT_REFRESH_SECRET must be set in production');
  }
}

const parseAllowedOrigins = () => {
  const fromEnv = process.env.CORS_ORIGIN || 'http://localhost:5173';
  return fromEnv
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const allowedOrigins = parseAllowedOrigins();

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  if (ALLOW_ONRENDER_ORIGINS) {
    const isRenderOrigin = /^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(origin);
    if (isRenderOrigin) return true;
  }

  return false;
};

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

const setAuthCookies = (res, { accessToken, refreshToken }) => {
  const accessMaxAgeMs = 15 * 60 * 1000;
  const refreshMaxAgeMs = 7 * 24 * 60 * 60 * 1000;

  res.cookie('finok_access_token', accessToken, buildCookieOptions(accessMaxAgeMs));
  res.cookie('finok_refresh_token', refreshToken, buildCookieOptions(refreshMaxAgeMs));
};

const clearAuthCookies = (res) => {
  res.clearCookie('finok_access_token', buildCookieOptions(0));
  res.clearCookie('finok_refresh_token', buildCookieOptions(0));
};

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
const getTaskRoleFilter = (user) => user.role === 'ADMIN' ? {} : { managerId: user.id };

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
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.replace('Bearer ', '').trim()
    : null;
  const cookieToken = req.cookies?.finok_access_token || null;
  const token = bearerToken || cookieToken;

  if (!token) {
    throw new AppError(401, 'Unauthorized');
  }

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
  invite: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional().nullable(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  resetToken: z.string().min(1),
  newPassword: z.string().min(8),
});

const consultationSchema = z
  .object({
    email: z.string().email(),
    phone: z.string().min(3).max(100).optional().nullable(),
    firstName: z.string().min(1),
    lastName: z.string().optional().nullable(),
    preferredContactMethod: z.enum(['PHONE', 'TELEGRAM', 'EMAIL']).default('PHONE'),
    description: z.string().max(2000).optional().nullable(),
    serviceId: z.string().optional().nullable(),
    consultationType: z.enum(['FREE', 'PAID']).default('FREE'),
    serviceCategory: z.string().optional().nullable(),
    serviceName: z.string().optional().nullable(),
    servicePriceText: z.string().optional().nullable(),
    selectedServices: z.string().optional().nullable(), // JSON string of selected services
    preferredDateTime: z.string().min(1),
    estimatedDuration: z.coerce.number().int().positive().max(240).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.consultationType === 'PAID') {
      const hasServiceRef = Boolean(data.serviceId || (data.serviceName && data.serviceCategory) || data.selectedServices);
      if (!hasServiceRef) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['serviceId'],
          message: 'For PAID consultation provide serviceId or serviceName+serviceCategory',
        });
      }
    }

    if ((data.preferredContactMethod === 'PHONE' || data.preferredContactMethod === 'TELEGRAM') && !data.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phone'],
        message: 'Phone or Telegram contact is required for selected communication method',
      });
    }
  });

const consultationPatchSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
  scheduledAt: z.string().optional(),
  assignedManagerId: z.string().min(1).optional().nullable(),
  internalNotes: z.string().max(4000).optional().nullable(),
});

const pipelinePreferenceSchema = z.object({
  order: z.object({
    NEW: z.array(z.string()).default([]),
    ASSIGNED: z.array(z.string()).default([]),
    CLIENT: z.array(z.string()).default([]),
    DONE: z.array(z.string()).default([]),
  }),
});

const orderSchema = z.object({
  serviceId: z.string().min(1),
});

const reviewSchema = z.object({
  name: z.string().min(2).max(100),
  role: z.string().max(100).optional().nullable(),
  text: z.string().min(10).max(2000),
  rating: z.coerce.number().int().min(1).max(5).default(5),
});

const workerInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['MANAGER', 'CLIENT']).default('MANAGER'),
});

const workerCreateSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  password: z.string().min(8).optional(),
  role: z.enum(['MANAGER', 'CLIENT']).default('MANAGER'),
});

const taskCreateSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional().nullable(),
  managerId: z.string().min(1),
  consultationId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']).default('TODO'),
});

const taskPatchSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  managerId: z.string().min(1).optional(),
  consultationId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']).optional(),
});

const blogPostCreateSchema = z.object({
  title: z.string().min(3).max(200),
  slug: z.string().min(3).max(200).optional(),
  excerpt: z.string().max(400).optional().nullable(),
  content: z.string().min(20).max(20000),
  coverImage: z.string().url().optional().nullable(),
  category: z.string().max(120).optional().nullable(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  publishedAt: z.string().optional().nullable(),
});

const blogPostPatchSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  slug: z.string().min(3).max(200).optional(),
  excerpt: z.string().max(400).optional().nullable(),
  content: z.string().min(20).max(20000).optional(),
  coverImage: z.string().url().optional().nullable(),
  category: z.string().max(120).optional().nullable(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  publishedAt: z.string().optional().nullable(),
});

const slugify = (value = '') =>
  String(value)
    .toLowerCase()
    .normalize('NFKD')
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);

const resolveUniqueBlogSlug = async (rawValue, excludeId = null) => {
  const base = slugify(rawValue) || `post-${Date.now()}`;
  let candidate = base;
  let iteration = 1;

  while (true) {
    const existing = await prisma.blogPost.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) return candidate;
    iteration += 1;
    candidate = `${base}-${iteration}`.slice(0, 190);
  }
};

const visitSchema = z.object({
  visitorId: z.string().min(6).max(120).optional(),
  path: z.string().max(500).optional(),
  referrer: z.string().max(500).optional(),
  title: z.string().max(200).optional(),
});

const escapeCsv = (value) => {
  if (value == null) return '';
  const raw = String(value);
  if (/[,"\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
};

const parseAmountFromText = (value) => {
  if (!value) return 0;
  const match = String(value).match(/([\d\s]+)(?:[.,](\d{1,2}))?/);
  if (!match) return 0;
  const whole = Number((match[1] || '0').replace(/\s/g, ''));
  const cents = Number(match[2] || 0);
  if (!Number.isFinite(whole)) return 0;
  return whole + cents / 100;
};

const parseAmountFromSelectedServices = (selectedServicesRaw) => {
  if (!selectedServicesRaw) return 0;

  try {
    const services = typeof selectedServicesRaw === 'string'
      ? JSON.parse(selectedServicesRaw)
      : selectedServicesRaw;

    if (!Array.isArray(services) || services.length === 0) return 0;

    return services.reduce((sum, service) => {
      const parsed = parseAmountFromText(service?.price);
      return sum + (Number.isFinite(parsed) ? parsed : 0);
    }, 0);
  } catch {
    return 0;
  }
};

const resolvePipelineStage = ({ status, assignedManagerId }) => {
  if (status === 'COMPLETED') return 'DONE';
  if (status === 'CONFIRMED') return 'CLIENT';
  if (assignedManagerId) return 'ASSIGNED';
  return 'NEW';
};

const buildGoogleCalendarLink = ({ title, description, startDate, endDate, location = '' }) => {
  if (!startDate || !endDate) return null;
  const fmt = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title || 'Consultation',
    details: description || '',
    location,
    dates: `${fmt(startDate)}/${fmt(endDate)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, try again later' },
});

const publicFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, try again later' },
});

app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error('CORS blocked')); 
    },
    credentials: true,
  })
);
app.use(morgan('short'));
app.use(cookieParser());
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
    publicApiUrl: PUBLIC_API_URL,
  });
});

app.get('/api/blog/posts', asyncHandler(async (req, res) => {
  const { limit = 30 } = req.query;
  const posts = await prisma.blogPost.findMany({
    where: { status: 'PUBLISHED' },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      coverImage: true,
      category: true,
      tags: true,
      publishedAt: true,
      createdAt: true,
      author: { select: pickUserFields },
    },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: Math.min(Number(limit) || 30, 100),
  });

  const normalized = posts.map((post) => ({
    ...post,
    tags: post.tags ? String(post.tags).split(',').map((item) => item.trim()).filter(Boolean) : [],
  }));
  res.json(normalized);
}));

app.get('/api/blog/posts/:slug', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const post = await prisma.blogPost.findFirst({
    where: {
      slug,
      status: 'PUBLISHED',
    },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      coverImage: true,
      category: true,
      tags: true,
      publishedAt: true,
      createdAt: true,
      author: { select: pickUserFields },
    },
  });
  if (!post) throw new AppError(404, 'Post not found');

  res.json({
    ...post,
    tags: post.tags ? String(post.tags).split(',').map((item) => item.trim()).filter(Boolean) : [],
  });
}));

app.post('/api/analytics/visit', validateBody(visitSchema), asyncHandler(async (req, res) => {
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 200);
  const fallbackVisitorId = `${String(req.ip || 'unknown-ip').slice(0, 40)}:${userAgent.slice(0, 40)}`;
  const visitorId = String(req.body.visitorId || fallbackVisitorId).trim().slice(0, 120);

  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  const alreadyTracked = await prisma.auditLog.findFirst({
    where: {
      entityType: 'SiteVisit',
      action: 'VISIT',
      entityId: visitorId,
      createdAt: { gte: dayStart, lte: dayEnd },
    },
    select: { id: true },
  });

  if (alreadyTracked) {
    return res.json({ tracked: false, reason: 'already-tracked-today' });
  }

  await logAudit({
    entityType: 'SiteVisit',
    entityId: visitorId,
    action: 'VISIT',
    metadata: {
      path: req.body.path || null,
      referrer: req.body.referrer || null,
      title: req.body.title || null,
      ip: req.ip,
      userAgent,
    },
  });

  res.status(201).json({ tracked: true });
}));

// ============ AUTH ENDPOINTS ============

// Register (create new user)
app.post('/api/auth/register', authLimiter, validateBody(registerSchema), asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, phone, invite } = req.body;
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  let role = 'CLIENT';
  if (invite) {
    try {
      const payload = jwt.verify(invite, JWT_SECRET);
      if (payload?.type === 'worker_invite' && payload?.email?.toLowerCase?.() === email.toLowerCase()) {
        role = payload.role === 'MANAGER' ? 'MANAGER' : 'CLIENT';
      }
    } catch {
      throw new AppError(400, 'Invalid or expired invite link');
    }
  }

  try {
    const user = await prisma.user.create({
      data: {
        email,
        password: passwordHash,
        role,
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
  setAuthCookies(res, { accessToken, refreshToken });

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
  const refreshToken = req.body?.refreshToken || req.cookies?.finok_refresh_token;

  if (!refreshToken) {
    throw new AppError(401, 'Refresh token is required');
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
  } catch {
    throw new AppError(401, 'Invalid or expired refresh token');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new AppError(401, 'Unauthorized');

  const accessToken = signAccessToken(user);
  const nextRefreshToken = signRefreshToken(user);
  setAuthCookies(res, { accessToken, refreshToken: nextRefreshToken });
  res.json({ token: accessToken, accessToken, access_token: accessToken });
}));

app.post('/api/auth/logout', asyncHandler(async (req, res) => {
  clearAuthCookies(res);
  res.status(204).end();
}));

app.post('/api/auth/request-password-reset', authLimiter, validateBody(forgotPasswordSchema), asyncHandler(async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (user) {
    const resetToken = jwt.sign(
      { sub: user.id, type: 'password_reset' },
      JWT_SECRET,
      { expiresIn: JWT_RESET_EXPIRES_IN }
    );
    console.log(`[auth] Password reset requested for ${normalizedEmail}: /reset-password?token=${resetToken}`);
  }

  res.json({ ok: true, message: 'If account exists, password reset instructions were sent' });
}));

app.post('/api/auth/reset-password', authLimiter, validateBody(resetPasswordSchema), asyncHandler(async (req, res) => {
  const { resetToken, newPassword } = req.body;

  let payload;
  try {
    payload = jwt.verify(resetToken, JWT_SECRET);
  } catch {
    throw new AppError(401, 'Invalid or expired reset token');
  }

  if (payload?.type !== 'password_reset' || !payload?.sub) {
    throw new AppError(401, 'Invalid reset token payload');
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { id: payload.sub },
    data: { password: passwordHash },
  });

  res.json({ ok: true });
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
app.post('/api/entities/Consultation', publicFormLimiter, validateBody(consultationSchema), asyncHandler(async (req, res) => {
  const {
    email,
    phone,
    firstName,
    lastName,
    preferredContactMethod,
    description,
    serviceId,
    consultationType,
    serviceCategory,
    serviceName,
    servicePriceText,
    selectedServices,
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
      phone: phone || null,
      firstName,
      lastName: lastName || null,
      description: description || null,
      preferredContactMethod,
      googleMeetLink: 'https://meet.google.com/new',
      serviceId: consultationType === 'PAID' ? serviceId || null : null,
      consultationType,
      isPaid: consultationType === 'PAID',
      estimatedDuration: effectiveDuration,
      serviceCategory: consultationType === 'PAID' ? serviceCategory || null : null,
      serviceName: consultationType === 'PAID' ? serviceName || null : null,
      servicePriceText: consultationType === 'PAID' ? servicePriceText || null : null,
      selectedServices: consultationType === 'PAID' ? selectedServices || null : null,
      preferredDateTime: preferredDate,
      status: 'PENDING',
      pipelineStageEnteredAt: new Date(),
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
      preferredContactMethod,
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
      preferredContactMethod,
      googleMeetLink: consultation.googleMeetLink,
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
      preferredContactMethod,
      consultationType,
      serviceName,
      serviceCategory,
      preferredDateTime,
      googleMeetLink: consultation.googleMeetLink,
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

    const nextAssignedManagerId = assignedManagerId === null ? null : (assignedManagerId || before.assignedManagerId || null);
    const nextStatus = status || before.status;
    const beforeStage = resolvePipelineStage(before);
    const afterStage = resolvePipelineStage({ status: nextStatus, assignedManagerId: nextAssignedManagerId });
    const shouldResetStageClock = beforeStage !== afterStage;

    if (nextStatus === 'CONFIRMED' && !nextAssignedManagerId) {
      throw new AppError(400, 'Select a manager before confirming consultation');
    }

    const consultation = await prisma.consultation.update({
      where: { id },
      data: {
        status: nextStatus,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        assignedManagerId: assignedManagerId === null ? null : assignedManagerId || undefined,
        internalNotes: internalNotes === null ? null : internalNotes || undefined,
        updatedById: req.user.id,
        confirmedAt: nextStatus === 'CONFIRMED' ? (before.confirmedAt || new Date()) : undefined,
        confirmedById: nextStatus === 'CONFIRMED' ? req.user.id : undefined,
        pipelineStageEnteredAt: shouldResetStageClock ? new Date() : undefined,
      },
      include: {
        service: true,
        assignedManager: { select: pickUserFields },
        confirmedBy: { select: pickUserFields },
      },
    });

    await logAudit({
      actorUserId: req.user.id,
      consultationId: consultation.id,
      entityType: 'Consultation',
      entityId: consultation.id,
      action: 'UPDATE',
      beforeState: before,
      afterState: consultation,
      metadata: { status, scheduledAt, assignedManagerId: nextAssignedManagerId },
    });

    if (status && status !== before.status) {
      await queueNotification({
        consultationId: consultation.id,
        channel: 'email',
        type: 'consultation.status.changed.client',
        recipient: consultation.email,
        payload: { status, consultationId: consultation.id },
      });

      if (status === 'CONFIRMED') {
        const preferredChannel = consultation.preferredContactMethod === 'TELEGRAM'
          ? 'telegram'
          : consultation.preferredContactMethod === 'EMAIL'
            ? 'email'
            : 'phone';
        const preferredRecipient = consultation.preferredContactMethod === 'EMAIL'
          ? consultation.email
          : consultation.phone;

        await queueNotification({
          consultationId: consultation.id,
          channel: preferredChannel,
          type: 'consultation.confirmed.client',
          recipient: preferredRecipient,
          payload: {
            consultationId: consultation.id,
            manager: consultation.assignedManager?.firstName || consultation.assignedManager?.email || null,
            scheduledAt: consultation.preferredDateTime || consultation.scheduledAt || null,
            googleMeetLink: consultation.googleMeetLink || null,
          },
        });
      }
    }

    if (nextAssignedManagerId && consultation.assignedManager) {
      const startAt = consultation.preferredDateTime || consultation.scheduledAt;
      const endAt = startAt
        ? addMinutes(new Date(startAt), Number(consultation.estimatedDuration || 15))
        : null;
      const googleCalendarLink = buildGoogleCalendarLink({
        title: `Консультація: ${consultation.firstName} ${consultation.lastName || ''}`.trim(),
        description: [
          `Клієнт: ${consultation.firstName} ${consultation.lastName || ''}`.trim(),
          `Email: ${consultation.email}`,
          `Телефон: ${consultation.phone || '—'}`,
          `Канал зв'язку: ${consultation.preferredContactMethod}`,
          `Тип: ${consultation.consultationType}`,
          `Послуга: ${consultation.serviceName || consultation.service?.name || 'Безкоштовна консультація'}`,
          `Нотатки: ${consultation.description || '—'}`,
        ].join('\n'),
        startDate: startAt,
        endDate: endAt,
        location: 'Online',
      });

      await queueNotification({
        consultationId: consultation.id,
        userId: consultation.assignedManager.id,
        channel: 'email',
        type: 'consultation.assigned.manager',
        recipient: consultation.assignedManager.email,
        payload: {
          consultationId: consultation.id,
          managerId: consultation.assignedManager.id,
          googleCalendarLink,
          googleMeetLink: consultation.googleMeetLink || 'https://meet.google.com/new',
          assignedAt: new Date().toISOString(),
        },
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
    confirmationType,
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
  if (confirmationType === 'CONFIRMED') {
    where.status = { in: ['CONFIRMED', 'COMPLETED'] };
  }
  if (confirmationType === 'UNCONFIRMED') {
    where.status = { notIn: ['CONFIRMED', 'COMPLETED'] };
  }
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
      order: true,
      assignedManager: { select: pickUserFields },
      createdBy: { select: pickUserFields },
      confirmedBy: { select: pickUserFields },
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

app.get('/api/admin/consultations/export.csv', authMiddleware, requireRole(['ADMIN', 'MANAGER']), asyncHandler(async (req, res) => {
  const where = getManagerRoleFilter(req.user);
  const consultations = await prisma.consultation.findMany({
    where,
    include: {
      service: true,
      order: true,
      assignedManager: { select: pickUserFields },
    },
    orderBy: { createdAt: 'desc' },
  });

  const header = [
    'id',
    'createdAt',
    'preferredDateTime',
    'status',
    'consultationType',
    'firstName',
    'lastName',
    'email',
    'phone',
    'serviceCategory',
    'serviceName',
    'servicePriceText',
    'preferredContactMethod',
    'googleMeetLink',
    'managerEmail',
    'managerName',
    'managerState',
    'description',
  ];
  const rows = consultations.map((item) => {
    const managerName = item.assignedManager
      ? `${item.assignedManager.firstName || ''} ${item.assignedManager.lastName || ''}`.trim()
      : '';
    return [
      item.id,
      item.createdAt?.toISOString?.() || '',
      item.preferredDateTime?.toISOString?.() || '',
      item.status,
      item.consultationType,
      item.firstName,
      item.lastName || '',
      item.email,
      item.phone || '',
      item.serviceCategory || item.service?.category || '',
      item.serviceName || item.service?.name || '',
      item.servicePriceText || '',
      item.preferredContactMethod || '',
      item.googleMeetLink || '',
      item.assignedManager?.email || '',
      managerName,
      item.assignedManagerId ? 'Закріплено' : 'На розподіленні',
      item.description || '',
    ];
  });
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => escapeCsv(cell)).join(','))
    .join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="clients-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(`\uFEFF${csv}`);
}));

app.get('/api/admin/pipeline/preferences', authMiddleware, requireRole(['ADMIN', 'MANAGER']), asyncHandler(async (req, res) => {
  const record = await prisma.pipelinePreference.findUnique({
    where: { userId: req.user.id },
    select: { orderJson: true },
  });

  const fallback = { NEW: [], ASSIGNED: [], CLIENT: [], DONE: [] };
  let order = fallback;

  if (record?.orderJson) {
    try {
      const parsed = JSON.parse(record.orderJson);
      order = {
        NEW: Array.isArray(parsed?.NEW) ? parsed.NEW : [],
        ASSIGNED: Array.isArray(parsed?.ASSIGNED) ? parsed.ASSIGNED : [],
        CLIENT: Array.isArray(parsed?.CLIENT) ? parsed.CLIENT : [],
        DONE: Array.isArray(parsed?.DONE) ? parsed.DONE : [],
      };
    } catch {
      order = fallback;
    }
  }

  res.json({ order });
}));

app.put('/api/admin/pipeline/preferences', authMiddleware, requireRole(['ADMIN', 'MANAGER']), validateBody(pipelinePreferenceSchema), asyncHandler(async (req, res) => {
  const { order } = req.body;

  const record = await prisma.pipelinePreference.upsert({
    where: { userId: req.user.id },
    create: {
      userId: req.user.id,
      orderJson: JSON.stringify(order),
    },
    update: {
      orderJson: JSON.stringify(order),
    },
    select: {
      userId: true,
      orderJson: true,
      updatedAt: true,
    },
  });

  res.json({
    userId: record.userId,
    order,
    updatedAt: record.updatedAt,
  });
}));

app.post('/api/admin/workers/invite', authMiddleware, requireRole(['ADMIN']), validateBody(workerInviteSchema), asyncHandler(async (req, res) => {
  const { email, role } = req.body;
  const inviteToken = jwt.sign(
    { email, role, type: 'worker_invite', by: req.user.id },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const frontendBase = (allowedOrigins[0] || 'http://localhost:5173').replace(/\/$/, '');
  const inviteLink = `${frontendBase}/register?invite=${encodeURIComponent(inviteToken)}&email=${encodeURIComponent(email)}`;

  await queueNotification({
    channel: 'email',
    type: 'worker.invite',
    recipient: email,
    payload: {
      role,
      inviteLink,
      invitedBy: req.user.email,
      expiresIn: '7d',
    },
  });

  await logAudit({
    actorUserId: req.user.id,
    entityType: 'UserInvite',
    entityId: email,
    action: 'CREATE_WORKER_INVITE',
    afterState: { email, role },
    metadata: { inviteLink },
  });

  res.status(201).json({ email, role, inviteLink, expiresIn: '7d' });
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
      email: true,
      assignedManagerId: true,
      serviceName: true,
      service: {
        select: {
          name: true,
        },
      },
    },
  });

  const analyticsWindowStart = new Date();
  analyticsWindowStart.setDate(analyticsWindowStart.getDate() - 30);
  analyticsWindowStart.setHours(0, 0, 0, 0);

  const siteVisits = await prisma.auditLog.findMany({
    where: {
      entityType: 'SiteVisit',
      action: 'VISIT',
      createdAt: { gte: analyticsWindowStart },
    },
    select: {
      entityId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const taskWhere = getTaskRoleFilter(req.user);
  const tasks = await prisma.task.findMany({
    where: taskWhere,
    select: { id: true, status: true },
  });

  const workersCount = req.user.role === 'ADMIN'
    ? await prisma.user.count({ where: { role: 'MANAGER' } })
    : 1;

  const total = consultations.length;
  const freeCount = consultations.filter((c) => c.consultationType === 'FREE').length;
  const paidCount = consultations.filter((c) => c.consultationType === 'PAID').length;
  const uniqueClients = new Set(consultations.map((c) => (c.email || '').toLowerCase()).filter(Boolean));
  const statusCounts = consultations.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
  const taskStatusCounts = tasks.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const todayBookings = consultations.filter((c) => {
    const createdAt = new Date(c.createdAt);
    return createdAt >= todayStart && createdAt <= todayEnd;
  }).length;

  const todayPaidBookings = consultations.filter((c) => {
    const createdAt = new Date(c.createdAt);
    return c.consultationType === 'PAID' && createdAt >= todayStart && createdAt <= todayEnd;
  }).length;

  const todayVisitSet = new Set(
    siteVisits
      .filter((v) => {
        const createdAt = new Date(v.createdAt);
        return createdAt >= todayStart && createdAt <= todayEnd;
      })
      .map((v) => v.entityId || 'unknown')
  );

  const dateKey = (value) => {
    const d = new Date(value);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const dayLabel = (isoDate) => {
    const d = new Date(isoDate);
    return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
  };

  const rangeDays = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - idx));
    return d;
  });

  const bookingsByDayMap = consultations.reduce((acc, item) => {
    const key = dateKey(item.createdAt);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const visitsByDaySetMap = siteVisits.reduce((acc, item) => {
    const key = dateKey(item.createdAt);
    if (!acc[key]) acc[key] = new Set();
    acc[key].add(item.entityId || 'unknown');
    return acc;
  }, {});

  const bookingsVsVisits7d = rangeDays.map((day) => {
    const key = dateKey(day);
    return {
      day: dayLabel(day),
      bookings: bookingsByDayMap[key] || 0,
      visits: visitsByDaySetMap[key]?.size || 0,
    };
  });

  const serviceCountMap = consultations.reduce((acc, item) => {
    const serviceName = item.serviceName || item.service?.name || 'Безкоштовна консультація';
    acc[serviceName] = (acc[serviceName] || 0) + 1;
    return acc;
  }, {});

  const popularServices = Object.entries(serviceCountMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 7);

  const conversionRateToday = todayVisitSet.size
    ? Number(((todayBookings / todayVisitSet.size) * 100).toFixed(1))
    : 0;

  const freeLeadEmails = new Set(
    consultations
      .filter((c) => c.consultationType === 'FREE')
      .map((c) => (c.email || '').toLowerCase())
      .filter(Boolean)
  );

  const convertedToPaidEmails = new Set(
    consultations
      .filter((c) => c.consultationType === 'PAID' && freeLeadEmails.has((c.email || '').toLowerCase()))
      .map((c) => (c.email || '').toLowerCase())
      .filter(Boolean)
  );

  const freeToPaidConversion = freeLeadEmails.size
    ? Number(((convertedToPaidEmails.size / freeLeadEmails.size) * 100).toFixed(1))
    : 0;

  res.json({
    total,
    freeCount,
    paidCount,
    statusCounts,
    workersCount,
    totalClients: uniqueClients.size,
    unassignedCount: consultations.filter((c) => !c.assignedManagerId).length,
    tasksTotal: tasks.length,
    tasksOpen: tasks.filter((t) => ['TODO', 'IN_PROGRESS'].includes(t.status)).length,
    taskStatusCounts,
    upcoming: consultations.filter((c) => c.preferredDateTime && new Date(c.preferredDateTime) > new Date()).length,
    analytics: {
      todayVisits: todayVisitSet.size,
      todayBookings,
      todayPaidBookings,
      conversionRateToday,
      freeLeads: freeLeadEmails.size,
      convertedToPaid: convertedToPaidEmails.size,
      freeToPaidConversion,
      popularServices,
      bookingsVsVisits7d,
      consultationTypeShare: [
        { name: 'FREE', value: freeCount },
        { name: 'PAID', value: paidCount },
      ],
    },
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

app.get('/api/admin/workers', authMiddleware, requireRole(['ADMIN']), asyncHandler(async (req, res) => {
  const workers = await prisma.user.findMany({
    where: { role: 'MANAGER' },
    select: {
      ...pickUserFields,
      _count: {
        select: {
          assignedConsultations: true,
          assignedTasks: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(workers);
}));

app.post('/api/admin/workers', authMiddleware, requireRole(['ADMIN']), validateBody(workerCreateSchema), asyncHandler(async (req, res) => {
  const { email, firstName, lastName, phone, password, role } = req.body;
  const tempPassword = password || 'Temp123456!';
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

  const worker = await prisma.user.create({
    data: {
      email,
      password: passwordHash,
      role,
      firstName,
      lastName: lastName || null,
      phone: phone || null,
    },
    select: pickUserFields,
  });

  await logAudit({
    actorUserId: req.user.id,
    entityType: 'User',
    entityId: worker.id,
    action: 'CREATE_WORKER',
    afterState: worker,
  });

  res.status(201).json({ ...worker, generatedPassword: password ? null : tempPassword });
}));

app.get('/api/admin/payments', authMiddleware, requireRole(['ADMIN', 'MANAGER']), asyncHandler(async (req, res) => {
  const consultations = await prisma.consultation.findMany({
    where: {
      ...getManagerRoleFilter(req.user),
      consultationType: 'PAID',
    },
    include: {
      service: true,
      order: true,
      assignedManager: { select: pickUserFields },
    },
    orderBy: { createdAt: 'desc' },
  });

  const rows = consultations.map((item) => {
    const amount = item.order?.amount
      || parseAmountFromSelectedServices(item.selectedServices)
      || parseAmountFromText(item.servicePriceText)
      || Number(item.service?.price || 0)
      || 0;
    return {
      id: item.id,
      consultationId: item.id,
      clientName: `${item.firstName} ${item.lastName || ''}`.trim(),
      email: item.email,
      serviceName: item.serviceName || item.service?.name || 'Платна консультація',
      amount,
      currency: 'UAH',
      paymentStatus: item.order?.status || 'PENDING',
      orderId: item.order?.id || null,
      manager: item.assignedManager || null,
      createdAt: item.createdAt,
      consultationStatus: item.status,
    };
  });

  res.json(rows);
}));

app.get('/api/admin/payments/analytics', authMiddleware, requireRole(['ADMIN', 'MANAGER']), asyncHandler(async (req, res) => {
  const consultations = await prisma.consultation.findMany({
    where: {
      ...getManagerRoleFilter(req.user),
      consultationType: 'PAID',
    },
    include: {
      service: true,
      order: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const paidRows = consultations
    .map((item) => {
      const amount = item.order?.amount
        || parseAmountFromSelectedServices(item.selectedServices)
        || parseAmountFromText(item.servicePriceText)
        || Number(item.service?.price || 0)
        || 0;
      const paymentStatus = item.order?.status || 'PENDING';
      const key = (item.email || '').trim().toLowerCase();
      return {
        id: item.id,
        clientKey: key,
        clientName: `${item.firstName} ${item.lastName || ''}`.trim() || item.email,
        email: item.email,
        amount,
        paymentStatus,
      };
    })
    .filter((item) => item.paymentStatus === 'PAID' && Number(item.amount) > 0 && item.clientKey);

  const perClientMap = paidRows.reduce((acc, item) => {
    if (!acc[item.clientKey]) {
      acc[item.clientKey] = {
        clientName: item.clientName,
        email: item.email,
        totalPaid: 0,
        paidOrdersCount: 0,
      };
    }
    acc[item.clientKey].totalPaid += Number(item.amount || 0);
    acc[item.clientKey].paidOrdersCount += 1;
    return acc;
  }, {});

  const perClient = Object.values(perClientMap)
    .map((item) => ({
      ...item,
      averageCheck: item.paidOrdersCount ? Number((item.totalPaid / item.paidOrdersCount).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.averageCheck - a.averageCheck);

  const totalPaid = paidRows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const paidOrdersCount = paidRows.length;

  res.json({
    overall: {
      totalPaid,
      paidOrdersCount,
      averageCheck: paidOrdersCount ? Number((totalPaid / paidOrdersCount).toFixed(2)) : 0,
      paidClientsCount: perClient.length,
    },
    perClient,
  });
}));

app.post('/api/admin/payments/:consultationId/mark-paid', authMiddleware, requireRole(['ADMIN', 'MANAGER']), asyncHandler(async (req, res) => {
  const { consultationId } = req.params;

  const consultation = await prisma.consultation.findFirst({
    where: {
      id: consultationId,
      consultationType: 'PAID',
      ...getManagerRoleFilter(req.user),
    },
    include: { service: true, order: true },
  });

  if (!consultation) throw new AppError(404, 'Paid consultation not found');

  const amount = consultation.order?.amount
    || parseAmountFromSelectedServices(consultation.selectedServices)
    || parseAmountFromText(consultation.servicePriceText)
    || Number(consultation.service?.price || 0)
    || 0;

  let order = consultation.order;
  if (!order) {
    let fallbackServiceId = consultation.serviceId || consultation.service?.id;

    if (!fallbackServiceId && consultation.serviceName) {
      const matchedService = await prisma.service.findFirst({
        where: {
          name: consultation.serviceName,
          ...(consultation.serviceCategory ? { category: consultation.serviceCategory } : {}),
        },
        select: { id: true },
      });
      fallbackServiceId = matchedService?.id || null;
    }

    if (!fallbackServiceId) {
      const createdService = await prisma.service.create({
        data: {
          name: consultation.serviceName || 'Платна консультація',
          description: consultation.description || 'Автоматично створена послуга для оплати консультації',
          price: Number(amount || 0),
          duration: Number(consultation.estimatedDuration || 45),
          category: consultation.serviceCategory || 'GENERAL',
          isActive: true,
        },
        select: { id: true },
      });
      fallbackServiceId = createdService.id;
    }

    if (!fallbackServiceId) {
      throw new AppError(400, 'Cannot mark as paid: consultation has no linked serviceId');
    }

    order = await prisma.order.create({
      data: {
        userId: consultation.userId || req.user.id,
        serviceId: fallbackServiceId,
        amount,
        status: 'PAID',
      },
    });

    await prisma.consultation.update({
      where: { id: consultation.id },
      data: {
        orderId: order.id,
        serviceId: consultation.serviceId || fallbackServiceId,
      },
    });
  } else {
    order = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'PAID' },
    });
  }

  await logAudit({
    actorUserId: req.user.id,
    consultationId: consultation.id,
    entityType: 'Order',
    entityId: order.id,
    action: 'MARK_PAYMENT_PAID',
    afterState: order,
  });

  res.json(order);
}));

app.get('/api/admin/blog/posts', authMiddleware, requireRole(['ADMIN']), asyncHandler(async (req, res) => {
  const posts = await prisma.blogPost.findMany({
    include: {
      author: { select: pickUserFields },
    },
    orderBy: [{ createdAt: 'desc' }],
    take: 300,
  });

  res.json(posts.map((post) => ({
    ...post,
    tags: post.tags ? String(post.tags).split(',').map((item) => item.trim()).filter(Boolean) : [],
  })));
}));

app.post('/api/admin/blog/posts', authMiddleware, requireRole(['ADMIN']), validateBody(blogPostCreateSchema), asyncHandler(async (req, res) => {
  const { title, slug, excerpt, content, coverImage, category, tags, status, publishedAt } = req.body;
  const normalizedSlug = await resolveUniqueBlogSlug(slug || title);

  const post = await prisma.blogPost.create({
    data: {
      title,
      slug: normalizedSlug,
      excerpt: excerpt || null,
      content,
      coverImage: coverImage || null,
      category: category || null,
      tags: Array.isArray(tags) ? tags.join(',') : null,
      status,
      publishedAt: status === 'PUBLISHED'
        ? (publishedAt ? new Date(publishedAt) : new Date())
        : null,
      authorId: req.user.id,
    },
    include: {
      author: { select: pickUserFields },
    },
  });

  await logAudit({
    actorUserId: req.user.id,
    entityType: 'BlogPost',
    entityId: post.id,
    action: 'CREATE_BLOG_POST',
    afterState: post,
  });

  res.status(201).json({
    ...post,
    tags: post.tags ? String(post.tags).split(',').map((item) => item.trim()).filter(Boolean) : [],
  });
}));

app.patch('/api/admin/blog/posts/:id', authMiddleware, requireRole(['ADMIN']), validateBody(blogPostPatchSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const before = await prisma.blogPost.findUnique({ where: { id } });
  if (!before) throw new AppError(404, 'Blog post not found');

  const { title, slug, excerpt, content, coverImage, category, tags, status, publishedAt } = req.body;
  const nextSlug = slug
    ? await resolveUniqueBlogSlug(slug, id)
    : title
      ? await resolveUniqueBlogSlug(title, id)
      : undefined;

  const post = await prisma.blogPost.update({
    where: { id },
    data: {
      title: title || undefined,
      slug: nextSlug || undefined,
      excerpt: excerpt === null ? null : excerpt || undefined,
      content: content || undefined,
      coverImage: coverImage === null ? null : coverImage || undefined,
      category: category === null ? null : category || undefined,
      tags: Array.isArray(tags) ? tags.join(',') : undefined,
      status: status || undefined,
      publishedAt: publishedAt === null
        ? null
        : publishedAt
          ? new Date(publishedAt)
          : status === 'PUBLISHED' && !before.publishedAt
            ? new Date()
            : undefined,
    },
    include: {
      author: { select: pickUserFields },
    },
  });

  await logAudit({
    actorUserId: req.user.id,
    entityType: 'BlogPost',
    entityId: post.id,
    action: 'UPDATE_BLOG_POST',
    beforeState: before,
    afterState: post,
  });

  res.json({
    ...post,
    tags: post.tags ? String(post.tags).split(',').map((item) => item.trim()).filter(Boolean) : [],
  });
}));

app.delete('/api/admin/blog/posts/:id', authMiddleware, requireRole(['ADMIN']), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const before = await prisma.blogPost.findUnique({ where: { id } });
  if (!before) throw new AppError(404, 'Blog post not found');

  await prisma.blogPost.delete({ where: { id } });
  await logAudit({
    actorUserId: req.user.id,
    entityType: 'BlogPost',
    entityId: id,
    action: 'DELETE_BLOG_POST',
    beforeState: before,
  });

  res.status(204).end();
}));

app.get('/api/admin/tasks', authMiddleware, requireRole(['ADMIN', 'MANAGER']), asyncHandler(async (req, res) => {
  const { status, managerId } = req.query;
  const where = {
    ...getTaskRoleFilter(req.user),
  };
  if (status) where.status = status;
  if (managerId && req.user.role === 'ADMIN') where.managerId = String(managerId);

  const tasks = await prisma.task.findMany({
    where,
    include: {
      manager: { select: pickUserFields },
      consultation: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          consultationType: true,
          status: true,
        },
      },
    },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
  });
  res.json(tasks);
}));

app.post('/api/admin/tasks', authMiddleware, requireRole(['ADMIN', 'MANAGER']), validateBody(taskCreateSchema), asyncHandler(async (req, res) => {
  const { title, description, managerId, consultationId, dueDate, priority, status } = req.body;
  if (req.user.role !== 'ADMIN' && req.user.id !== managerId) {
    throw new AppError(403, 'Managers can create tasks only for themselves');
  }

  const task = await prisma.task.create({
    data: {
      title,
      description: description || null,
      managerId,
      consultationId: consultationId || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      priority,
      status,
    },
    include: {
      manager: { select: pickUserFields },
      consultation: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  await logAudit({
    actorUserId: req.user.id,
    consultationId: task.consultationId || null,
    entityType: 'Task',
    entityId: task.id,
    action: 'CREATE_TASK',
    afterState: task,
  });

  res.status(201).json(task);
}));

app.patch('/api/admin/tasks/:id', authMiddleware, requireRole(['ADMIN', 'MANAGER']), validateBody(taskPatchSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const before = await prisma.task.findUnique({ where: { id } });
  if (!before) throw new AppError(404, 'Task not found');
  if (req.user.role !== 'ADMIN' && before.managerId !== req.user.id) {
    throw new AppError(403, 'Forbidden');
  }

  const { title, description, managerId, consultationId, dueDate, priority, status } = req.body;
  if (req.user.role !== 'ADMIN' && managerId && managerId !== req.user.id) {
    throw new AppError(403, 'Managers cannot reassign task owner');
  }

  const task = await prisma.task.update({
    where: { id },
    data: {
      title: title || undefined,
      description: description === null ? null : description || undefined,
      managerId: managerId || undefined,
      consultationId: consultationId === null ? null : consultationId || undefined,
      dueDate: dueDate === null ? null : dueDate ? new Date(dueDate) : undefined,
      priority: priority || undefined,
      status: status || undefined,
    },
    include: {
      manager: { select: pickUserFields },
      consultation: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  await logAudit({
    actorUserId: req.user.id,
    consultationId: task.consultationId || null,
    entityType: 'Task',
    entityId: task.id,
    action: 'UPDATE_TASK',
    beforeState: before,
    afterState: task,
  });

  res.json(task);
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

// ============ REVIEWS ============

// Public: get approved reviews
app.get('/api/reviews', asyncHandler(async (req, res) => {
  const reviews = await prisma.review.findMany({
    where: { isApproved: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(reviews);
}));

// Public: submit a review (goes to moderation)
app.post('/api/reviews', validateBody(reviewSchema), asyncHandler(async (req, res) => {
  const { name, role, text, rating } = req.body;
  const review = await prisma.review.create({
    data: { name, role: role || null, text, rating: Number(rating) || 5, isApproved: false },
  });
  res.status(201).json({ id: review.id, message: 'Дякую́! Ваш відгук надіслано на модерацію.' });
}));

// Admin: list all reviews (incl. pending)
app.get('/api/admin/reviews', authMiddleware, requireRole(['ADMIN', 'MANAGER']), asyncHandler(async (req, res) => {
  const reviews = await prisma.review.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(reviews);
}));

// Admin: approve / reject review
app.patch('/api/admin/reviews/:id', authMiddleware, requireRole(['ADMIN', 'MANAGER']), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isApproved } = req.body;
  if (typeof isApproved !== 'boolean') throw new AppError(400, 'isApproved must be boolean');
  const review = await prisma.review.update({ where: { id }, data: { isApproved } });
  res.json(review);
}));

// Admin: delete review
app.delete('/api/admin/reviews/:id', authMiddleware, requireRole(['ADMIN']), asyncHandler(async (req, res) => {
  await prisma.review.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

// ============ Optional frontend serving (single-service deploy) ============
const frontendDistDir = path.join(__dirname, '../dist');
const frontendIndexFile = path.join(frontendDistDir, 'index.html');
const hasFrontendBuild = fs.existsSync(frontendIndexFile);

if (hasFrontendBuild) {
  app.use(express.static(frontendDistDir));

  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(frontendIndexFile);
  });
} else {
  app.get('/', (req, res) => {
    res.status(200).json({
      ok: true,
      service: 'finok-backend',
      message: 'Backend is running. Frontend build was not found in /dist.',
      health: '/api/health',
    });
  });
}
// ============ Optional frontend serving (single-service deploy) ============

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
