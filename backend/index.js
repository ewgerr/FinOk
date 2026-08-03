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
import PDFDocument from 'pdfkit';


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

const decodeDocumentBase64 = (value) => {
  if (!value) return null;
  if (value.startsWith('data:')) {
    const parts = value.split(',');
    if (parts.length < 2) return null;
    return Buffer.from(parts[1], 'base64');
  }
  return Buffer.from(value, 'base64');
};

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

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
const WORKER_ROLES = ['MANAGER', 'ACCOUNTANT', 'VIEWER'];
const ADMIN_PANEL_ROLES = [...ADMIN_ROLES, ...WORKER_ROLES];
const INBOX_CHANNELS = ['email', 'telegram', 'instagram', 'facebook', 'sms'];

const isAdminRole = (role) => ADMIN_ROLES.includes(role);
const isAllowedWorkerRole = (role) => WORKER_ROLES.includes(role);
const canViewAdminPanel = (role) => ADMIN_PANEL_ROLES.includes(role);
const canWriteConsultations = (role) => isAdminRole(role) || role === 'MANAGER';
const canManagePayments = (role) => isAdminRole(role) || role === 'MANAGER' || role === 'ACCOUNTANT';
const canManageDocuments = (role) => isAdminRole(role) || role === 'MANAGER' || role === 'ACCOUNTANT';
const canManageWorkers = (role) => isAdminRole(role);
const canRunAutomations = (role) => isAdminRole(role) || role === 'MANAGER';
const canManageContent = (role) => isAdminRole(role);
const canViewAudit = (role) => isAdminRole(role);

const requireRole = (allowedRoles) => (req, res, next) => {
  if (!req.user) throw new AppError(401, 'Unauthorized');
  if (isAdminRole(req.user.role)) {
    next();
    return;
  }
  if (!allowedRoles.includes(req.user.role)) {
    throw new AppError(403, 'Forbidden');
  }
  next();
};

const getManagerRoleFilter = (user) => isAdminRole(user.role) ? {} : { assignedManagerId: user.id };
const getTaskRoleFilter = (user) => isAdminRole(user.role) ? {} : { managerId: user.id };

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
  estimatedDuration: z.coerce.number().int().positive().max(240).optional(),
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
  role: z.enum(['MANAGER', 'ACCOUNTANT', 'VIEWER']).default('MANAGER'),
});

const workerCreateSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  password: z.string().min(8).optional(),
  role: z.enum(['MANAGER', 'ACCOUNTANT', 'VIEWER']).default('MANAGER'),
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

const documentCreateSchema = z.object({
  title: z.string().min(1).max(200),
  folder: z.string().min(1).max(120).default('General'),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(120).optional().nullable(),
  fileSize: z.coerce.number().int().positive().max(10 * 1024 * 1024).optional().nullable(),
  contentBase64: z.string().max(12 * 1024 * 1024).optional().nullable(),
  externalUrl: z.string().url().max(2000).optional().nullable(),
  consultationId: z.string().optional().nullable(),
  documentGroupId: z.string().optional().nullable(),
});

const documentPatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  folder: z.string().min(1).max(120).optional(),
  isArchived: z.boolean().optional(),
});

const inboxSendSchema = z.object({
  consultationId: z.string().optional().nullable(),
  channel: z.enum(['email', 'telegram', 'instagram', 'facebook', 'sms']).default('email'),
  type: z.string().min(3).max(120).default('inbox.manual'),
  recipient: z.string().max(200).optional().nullable(),
  message: z.string().min(1).max(4000),
  subject: z.string().max(200).optional().nullable(),
});

const automationRunSchema = z.object({
  templateKey: z.enum(['reminder-24h', 'payment-reminder', 'followup-pending', 'omni-followup']),
  consultationId: z.string().optional().nullable(),
});

const recurringScheduleSchema = z.object({
  consultationId: z.string().min(1),
  occurrences: z.coerce.number().int().min(2).max(24).default(4),
  intervalDays: z.coerce.number().int().min(1).max(30).default(7),
});

const recurringExceptionSchema = z.object({
  seriesId: z.string().min(1),
  occurrenceIndex: z.coerce.number().int().min(1),
  reason: z.string().max(300).optional().nullable(),
});

const calendarSyncPushSchema = z.object({
  consultationId: z.string().min(1),
  provider: z.enum(['google']).default('google'),
});

const aiRunSchema = z.object({
  scenario: z.enum(['client-summary', 'next-action', 'reply-draft']),
  consultationId: z.string().optional().nullable(),
  input: z.string().max(4000).optional().nullable(),
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

const createPaymentPdf = ({ documentTitle, documentNumber, payment, consultation, managerName, footerNote }) => {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  const today = new Date().toLocaleDateString('uk-UA');
  doc.fontSize(22).text(`FINOK ${documentTitle.toUpperCase()}`, { align: 'left' });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#555').text(`${documentTitle} #: ${documentNumber}`);
  doc.text(`Date: ${today}`);
  doc.text(`Currency: ${payment.currency || 'UAH'}`);
  doc.moveDown();

  doc.fillColor('#111').fontSize(14).text('Client');
  doc.fontSize(11).text(`Name: ${payment.clientName || '—'}`);
  doc.text(`Email: ${payment.email || '—'}`);
  doc.moveDown();

  doc.fontSize(14).text('Service');
  doc.fontSize(11).text(`Service: ${payment.serviceName || 'Paid consultation'}`);
  doc.text(`Consultation ID: ${consultation.id}`);
  doc.text(`Manager: ${managerName || '—'}`);
  doc.moveDown();

  doc.fontSize(14).text('Amount');
  doc.fontSize(20).fillColor('#0f766e').text(`${Number(payment.amount || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ${payment.currency || 'UAH'}`);
  doc.fillColor('#111').fontSize(11).text(`Payment status: ${payment.paymentStatus || 'PENDING'}`);
  doc.moveDown(2);

  doc.fontSize(10).fillColor('#666').text(footerNote || 'This payment document was generated automatically by FinOK CRM.', { align: 'left' });
  doc.end();

  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
};

const buildConsultationAIPromptData = async (consultationId) => {
  if (!consultationId) return null;
  const consultation = await prisma.consultation.findUnique({
    where: { id: consultationId },
    include: {
      assignedManager: { select: pickUserFields },
      order: true,
      service: true,
      tasks: true,
    },
  });
  if (!consultation) return null;

  return {
    id: consultation.id,
    clientName: `${consultation.firstName} ${consultation.lastName || ''}`.trim(),
    email: consultation.email,
    phone: consultation.phone,
    status: consultation.status,
    type: consultation.consultationType,
    service: consultation.serviceName || consultation.service?.name || 'Безкоштовна консультація',
    notes: consultation.description || '',
    manager: consultation.assignedManager?.firstName || consultation.assignedManager?.email || null,
    tasks: consultation.tasks?.map((task) => ({
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
    })) || [],
    paymentStatus: consultation.order?.status || 'PENDING',
  };
};

const runAIScenario = ({ scenario, input = '', context = null }) => {
  const safeInput = String(input || '').trim();
  const baseContext = context || {};

  if (scenario === 'client-summary') {
    return {
      scenario,
      output: `Клієнт: ${baseContext.clientName || '—'}; статус: ${baseContext.status || '—'}; послуга: ${baseContext.service || '—'}; оплата: ${baseContext.paymentStatus || '—'}; задач: ${baseContext.tasks?.length || 0}.`,
      confidence: 0.72,
      source: 'rule-engine',
    };
  }

  if (scenario === 'next-action') {
    const hasOpenTasks = (baseContext.tasks || []).some((task) => ['TODO', 'IN_PROGRESS'].includes(task.status));
    let suggestion = 'Уточнити деталі запиту та підтвердити зручний слот.';
    if (baseContext.status === 'PENDING') suggestion = 'Призначити менеджера та відправити follow-up клієнту.';
    if (baseContext.status === 'CONFIRMED' && baseContext.paymentStatus !== 'PAID') suggestion = 'Надіслати нагадування про оплату та підготувати інвойс.';
    if (hasOpenTasks) suggestion = 'Закрити відкриті задачі перед наступним етапом.';
    return {
      scenario,
      output: suggestion,
      confidence: 0.68,
      source: 'rule-engine',
    };
  }

  if (scenario === 'reply-draft') {
    const greeting = baseContext.clientName ? `Доброго дня, ${baseContext.clientName}!` : 'Доброго дня!';
    return {
      scenario,
      output: `${greeting}\n\nДякуємо за звернення до FinOK. ${safeInput || 'Ми взяли ваш запит у роботу.'}\n\nЗ повагою, команда FinOK.`,
      confidence: 0.64,
      source: 'rule-engine',
    };
  }

  return {
    scenario,
    output: 'Сценарій не підтримується.',
    confidence: 0.1,
    source: 'rule-engine',
  };
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
app.use(express.json({ limit: '12mb' }));

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
        role = isAllowedWorkerRole(payload.role) ? payload.role : 'CLIENT';
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
  if (!canWriteConsultations(req.user.role)) throw new AppError(403, 'Forbidden');
  const { id } = req.params;
  const { status, scheduledAt, estimatedDuration, assignedManagerId, internalNotes } = req.body;

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
        estimatedDuration: Number.isFinite(Number(estimatedDuration)) ? Number(estimatedDuration) : undefined,
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
      metadata: { status, scheduledAt, estimatedDuration, assignedManagerId: nextAssignedManagerId },
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
app.get('/api/admin/consultations', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'VIEWER']), asyncHandler(async (req, res) => {
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

app.get('/api/admin/consultations/export.csv', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'VIEWER']), asyncHandler(async (req, res) => {
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

app.get('/api/admin/pipeline/preferences', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'VIEWER']), asyncHandler(async (req, res) => {
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

app.get('/api/admin/stats', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'VIEWER']), asyncHandler(async (req, res) => {
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

  const workersCount = isAdminRole(req.user.role)
    ? await prisma.user.count({ where: { role: { in: WORKER_ROLES } } })
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

app.get('/api/admin/notifications', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'VIEWER']), asyncHandler(async (req, res) => {
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

app.get('/api/admin/workers', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'VIEWER']), asyncHandler(async (req, res) => {
  const workers = await prisma.user.findMany({
    where: isAdminRole(req.user.role)
      ? { role: { in: WORKER_ROLES } }
      : { id: req.user.id },
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
  if (!canManageWorkers(req.user.role)) throw new AppError(403, 'Forbidden');
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

app.get('/api/admin/payments', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'VIEWER']), asyncHandler(async (req, res) => {
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

app.get('/api/admin/payments/analytics', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'VIEWER']), asyncHandler(async (req, res) => {
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

app.post('/api/admin/payments/:consultationId/mark-paid', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'ACCOUNTANT']), asyncHandler(async (req, res) => {
  if (!canManagePayments(req.user.role)) throw new AppError(403, 'Forbidden');
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

app.get('/api/admin/payments/:consultationId/invoice.pdf', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'VIEWER']), asyncHandler(async (req, res) => {
  if (!canManagePayments(req.user.role)) throw new AppError(403, 'Forbidden');
  const { consultationId } = req.params;
  const consultation = await prisma.consultation.findFirst({
    where: {
      id: consultationId,
      consultationType: 'PAID',
      ...getManagerRoleFilter(req.user),
    },
    include: {
      service: true,
      order: true,
      assignedManager: { select: pickUserFields },
    },
  });

  if (!consultation) throw new AppError(404, 'Paid consultation not found');

  const amount = consultation.order?.amount
    || parseAmountFromSelectedServices(consultation.selectedServices)
    || parseAmountFromText(consultation.servicePriceText)
    || Number(consultation.service?.price || 0)
    || 0;

  const payment = {
    consultationId: consultation.id,
    clientName: `${consultation.firstName} ${consultation.lastName || ''}`.trim(),
    email: consultation.email,
    serviceName: consultation.serviceName || consultation.service?.name || 'Платна консультація',
    amount,
    currency: 'UAH',
    paymentStatus: consultation.order?.status || 'PENDING',
  };

  const invoiceNumber = `FINOK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${consultation.id.slice(-6).toUpperCase()}`;
  const managerName = consultation.assignedManager?.firstName || consultation.assignedManager?.email || null;
  const pdfBuffer = await createPaymentPdf({
    documentTitle: 'Invoice',
    documentNumber: invoiceNumber,
    payment,
    consultation,
    managerName,
    footerNote: 'This invoice was generated automatically by FinOK CRM.',
  });

  await logAudit({
    actorUserId: req.user.id,
    consultationId: consultation.id,
    entityType: 'Invoice',
    entityId: invoiceNumber,
    action: 'EXPORT_PAYMENT_INVOICE',
    metadata: {
      amount,
      currency: 'UAH',
      consultationId: consultation.id,
    },
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${consultation.id}.pdf"`);
  res.send(pdfBuffer);
}));

app.get('/api/admin/payments/:consultationId/receipt.pdf', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'VIEWER']), asyncHandler(async (req, res) => {
  if (!canManagePayments(req.user.role)) throw new AppError(403, 'Forbidden');
  const { consultationId } = req.params;
  const consultation = await prisma.consultation.findFirst({
    where: {
      id: consultationId,
      consultationType: 'PAID',
      ...getManagerRoleFilter(req.user),
    },
    include: { service: true, order: true, assignedManager: { select: pickUserFields } },
  });
  if (!consultation) throw new AppError(404, 'Paid consultation not found');

  const amount = consultation.order?.amount
    || parseAmountFromSelectedServices(consultation.selectedServices)
    || parseAmountFromText(consultation.servicePriceText)
    || Number(consultation.service?.price || 0)
    || 0;

  const payment = {
    consultationId: consultation.id,
    clientName: `${consultation.firstName} ${consultation.lastName || ''}`.trim(),
    email: consultation.email,
    serviceName: consultation.serviceName || consultation.service?.name || 'Платна консультація',
    amount,
    currency: 'UAH',
    paymentStatus: consultation.order?.status || 'PENDING',
  };

  const receiptNumber = `REC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${consultation.id.slice(-6).toUpperCase()}`;
  const managerName = consultation.assignedManager?.firstName || consultation.assignedManager?.email || null;
  const pdfBuffer = await createPaymentPdf({
    documentTitle: 'Receipt',
    documentNumber: receiptNumber,
    payment,
    consultation,
    managerName,
    footerNote: 'This receipt confirms payment registration in FinOK CRM.',
  });

  await logAudit({
    actorUserId: req.user.id,
    consultationId: consultation.id,
    entityType: 'Receipt',
    entityId: receiptNumber,
    action: 'EXPORT_PAYMENT_RECEIPT',
    metadata: { amount, currency: 'UAH', consultationId: consultation.id },
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="receipt-${consultation.id}.pdf"`);
  res.send(pdfBuffer);
}));

app.get('/api/admin/payments/:consultationId/contract.pdf', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'VIEWER']), asyncHandler(async (req, res) => {
  if (!canManagePayments(req.user.role)) throw new AppError(403, 'Forbidden');
  const { consultationId } = req.params;
  const consultation = await prisma.consultation.findFirst({
    where: {
      id: consultationId,
      consultationType: 'PAID',
      ...getManagerRoleFilter(req.user),
    },
    include: { service: true, order: true, assignedManager: { select: pickUserFields } },
  });
  if (!consultation) throw new AppError(404, 'Paid consultation not found');

  const amount = consultation.order?.amount
    || parseAmountFromSelectedServices(consultation.selectedServices)
    || parseAmountFromText(consultation.servicePriceText)
    || Number(consultation.service?.price || 0)
    || 0;

  const payment = {
    consultationId: consultation.id,
    clientName: `${consultation.firstName} ${consultation.lastName || ''}`.trim(),
    email: consultation.email,
    serviceName: consultation.serviceName || consultation.service?.name || 'Платна консультація',
    amount,
    currency: 'UAH',
    paymentStatus: consultation.order?.status || 'PENDING',
  };

  const contractNumber = `CNT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${consultation.id.slice(-6).toUpperCase()}`;
  const managerName = consultation.assignedManager?.firstName || consultation.assignedManager?.email || null;
  const pdfBuffer = await createPaymentPdf({
    documentTitle: 'Contract',
    documentNumber: contractNumber,
    payment,
    consultation,
    managerName,
    footerNote: 'Template contract generated by FinOK CRM for workflow operations.',
  });

  await logAudit({
    actorUserId: req.user.id,
    consultationId: consultation.id,
    entityType: 'Contract',
    entityId: contractNumber,
    action: 'EXPORT_PAYMENT_CONTRACT',
    metadata: { amount, currency: 'UAH', consultationId: consultation.id },
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="contract-${consultation.id}.pdf"`);
  res.send(pdfBuffer);
}));

app.get('/api/admin/inbox', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'VIEWER']), asyncHandler(async (req, res) => {
  const { channel, status, search } = req.query;
  const where = {};
  if (channel) where.channel = String(channel);
  if (status) where.status = String(status);

  const logs = await prisma.notificationLog.findMany({
    where,
    include: {
      consultation: {
        include: {
          assignedManager: { select: pickUserFields },
        },
      },
      user: { select: pickUserFields },
    },
    orderBy: { createdAt: 'desc' },
    take: 400,
  });

  const scopedLogs = logs.filter((item) => {
    if (isAdminRole(req.user.role)) return true;
    const assignedManagerId = item.consultation?.assignedManagerId || null;
    return assignedManagerId === req.user.id || item.userId === req.user.id;
  });

  const filteredLogs = search
    ? scopedLogs.filter((item) => {
        const payload = parseJsonSafely(item.payload);
        const text = [
          item.type,
          item.channel,
          item.recipient,
          item.consultation?.firstName,
          item.consultation?.lastName,
          item.consultation?.email,
          item.consultation?.phone,
          payload?.message,
          payload?.subject,
        ].filter(Boolean).join(' ').toLowerCase();
        return text.includes(String(search).toLowerCase());
      })
    : scopedLogs;

  const rows = filteredLogs.map((item) => ({
    id: item.id,
    consultationId: item.consultationId,
    createdAt: item.createdAt,
    channel: item.channel,
    type: item.type,
    status: item.status,
    recipient: item.recipient,
    payload: parseJsonSafely(item.payload),
    sender: item.user,
    client: item.consultation
      ? {
          id: item.consultation.id,
          name: `${item.consultation.firstName} ${item.consultation.lastName || ''}`.trim(),
          email: item.consultation.email,
          phone: item.consultation.phone,
          manager: item.consultation.assignedManager,
        }
      : null,
  }));

  res.json(rows);
}));

app.post('/api/admin/inbox/send', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'ACCOUNTANT']), validateBody(inboxSendSchema), asyncHandler(async (req, res) => {
  if (!canWriteConsultations(req.user.role) && req.user.role !== 'ACCOUNTANT') throw new AppError(403, 'Forbidden');
  const { consultationId, channel, type, recipient, message, subject } = req.body;
  if (!INBOX_CHANNELS.includes(channel)) throw new AppError(400, 'Unsupported channel');

  let consultation = null;
  if (consultationId) {
    consultation = await prisma.consultation.findFirst({
      where: {
        id: consultationId,
        ...getManagerRoleFilter(req.user),
      },
      include: {
        assignedManager: { select: pickUserFields },
      },
    });
    if (!consultation) throw new AppError(404, 'Consultation not found');
  }

  const finalRecipient = recipient
    || consultation?.email
    || consultation?.phone
    || null;

  if (!finalRecipient) {
    throw new AppError(400, 'Recipient is required');
  }

  const record = await queueNotification({
    consultationId: consultation?.id || null,
    userId: req.user.id,
    channel,
    type,
    recipient: finalRecipient,
    payload: {
      subject: subject || null,
      message,
      source: 'manual-inbox',
    },
  });

  await logAudit({
    actorUserId: req.user.id,
    consultationId: consultation?.id || null,
    entityType: 'Inbox',
    entityId: record?.id || null,
    action: 'SEND_MANUAL_MESSAGE',
    metadata: {
      channel,
      recipient: finalRecipient,
      type,
    },
  });

  res.status(201).json({
    ok: true,
    id: record?.id || null,
    consultationId: consultation?.id || null,
    recipient: finalRecipient,
    channel,
    type,
  });
}));

app.get('/api/admin/automations/templates', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'VIEWER']), asyncHandler(async (req, res) => {
  res.json([
    {
      key: 'reminder-24h',
      title: 'Нагадування за 24 години',
      description: 'Відправляє нагадування клієнту перед консультацією.',
      requiresConsultation: true,
      trigger: 'manual.run',
      actions: ['resolve-contact-channel', 'send-message'],
    },
    {
      key: 'payment-reminder',
      title: 'Нагадування про оплату',
      description: 'Відправляє повідомлення клієнтам з неоплаченими платними консультаціями.',
      requiresConsultation: false,
      trigger: 'scheduled.daily',
      actions: ['filter-unpaid', 'send-message'],
    },
    {
      key: 'followup-pending',
      title: 'Follow-up для PENDING',
      description: 'Надсилає follow-up клієнтам зі статусом PENDING старше 2 днів.',
      requiresConsultation: false,
      trigger: 'scheduled.daily',
      actions: ['filter-pending>2d', 'send-message'],
    },
    {
      key: 'omni-followup',
      title: 'Omni follow-up chain',
      description: 'Ланцюжок Email → Telegram → Instagram/Facebook (якщо немає відповіді).',
      requiresConsultation: true,
      trigger: 'manual.run',
      actions: ['send-email', 'send-telegram', 'send-instagram', 'send-facebook'],
    },
  ]);
}));

app.post('/api/admin/automations/run', authMiddleware, requireRole(['ADMIN', 'MANAGER']), validateBody(automationRunSchema), asyncHandler(async (req, res) => {
  if (!canRunAutomations(req.user.role)) throw new AppError(403, 'Forbidden');
  const { templateKey, consultationId } = req.body;

  if (templateKey === 'reminder-24h') {
    if (!consultationId) throw new AppError(400, 'consultationId is required for reminder-24h');

    const consultation = await prisma.consultation.findFirst({
      where: {
        id: consultationId,
        ...getManagerRoleFilter(req.user),
      },
    });
    if (!consultation) throw new AppError(404, 'Consultation not found');

    const preferredChannel = consultation.preferredContactMethod === 'EMAIL'
      ? 'email'
      : consultation.preferredContactMethod === 'TELEGRAM'
        ? 'telegram'
        : 'sms';
    const recipient = preferredChannel === 'email' ? consultation.email : consultation.phone;

    if (!recipient) throw new AppError(400, 'Consultation has no recipient for selected channel');

    await queueNotification({
      consultationId: consultation.id,
      userId: req.user.id,
      channel: preferredChannel,
      type: 'automation.reminder-24h',
      recipient,
      payload: {
        message: `Нагадування: консультація запланована на ${consultation.preferredDateTime || consultation.scheduledAt || 'вказаний час'}`,
      },
    });

    await logAudit({
      actorUserId: req.user.id,
      consultationId: consultation.id,
      entityType: 'Automation',
      entityId: consultation.id,
      action: 'RUN_TEMPLATE_REMINDER_24H',
      metadata: { templateKey },
    });

    res.json({ ok: true, templateKey, processed: 1 });
    return;
  }

  const whereBase = {
    ...getManagerRoleFilter(req.user),
    consultationType: 'PAID',
  };

  if (templateKey === 'payment-reminder') {
    const rows = await prisma.consultation.findMany({
      where: {
        ...whereBase,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      include: { order: true },
      orderBy: { createdAt: 'desc' },
      take: 120,
    });

    const targets = rows.filter((item) => (item.order?.status || 'PENDING') !== 'PAID');
    let sent = 0;
    for (const item of targets) {
      await queueNotification({
        consultationId: item.id,
        userId: req.user.id,
        channel: 'email',
        type: 'automation.payment-reminder',
        recipient: item.email,
        payload: {
          message: 'Нагадуємо про оплату консультації. Для деталей звʼяжіться з менеджером FinOK.',
        },
      });
      sent += 1;
    }

    await logAudit({
      actorUserId: req.user.id,
      entityType: 'Automation',
      action: 'RUN_TEMPLATE_PAYMENT_REMINDER',
      metadata: { templateKey, sent },
    });

    res.json({ ok: true, templateKey, processed: targets.length, sent });
    return;
  }

  if (templateKey === 'followup-pending') {
    const threshold = new Date(Date.now() - (2 * 24 * 60 * 60 * 1000));
    const rows = await prisma.consultation.findMany({
      where: {
        ...getManagerRoleFilter(req.user),
        status: 'PENDING',
        createdAt: { lte: threshold },
      },
      orderBy: { createdAt: 'desc' },
      take: 120,
    });

    let sent = 0;
    for (const item of rows) {
      const channel = item.preferredContactMethod === 'EMAIL'
        ? 'email'
        : item.preferredContactMethod === 'TELEGRAM'
          ? 'telegram'
          : 'sms';
      const recipient = channel === 'email' ? item.email : item.phone;
      if (!recipient) continue;

      await queueNotification({
        consultationId: item.id,
        userId: req.user.id,
        channel,
        type: 'automation.followup-pending',
        recipient,
        payload: {
          message: 'Нагадуємо про вашу заявку. Ми готові допомогти і відповісти на запитання.',
        },
      });
      sent += 1;
    }

    await logAudit({
      actorUserId: req.user.id,
      entityType: 'Automation',
      action: 'RUN_TEMPLATE_FOLLOWUP_PENDING',
      metadata: { templateKey, processed: rows.length, sent },
    });

    res.json({ ok: true, templateKey, processed: rows.length, sent });
    return;
  }

  if (templateKey === 'omni-followup') {
    if (!consultationId) throw new AppError(400, 'consultationId is required for omni-followup');
    const consultation = await prisma.consultation.findFirst({
      where: {
        id: consultationId,
        ...getManagerRoleFilter(req.user),
      },
    });
    if (!consultation) throw new AppError(404, 'Consultation not found');

    const chain = [
      { channel: 'email', recipient: consultation.email },
      { channel: 'telegram', recipient: consultation.phone },
      { channel: 'instagram', recipient: consultation.phone },
      { channel: 'facebook', recipient: consultation.phone },
    ];

    const sent = [];
    for (const step of chain) {
      if (!step.recipient) continue;
      await queueNotification({
        consultationId: consultation.id,
        userId: req.user.id,
        channel: step.channel,
        type: 'automation.omni-followup',
        recipient: step.recipient,
        payload: {
          message: 'Нагадування від FinOK щодо вашої консультації. Будемо раді відповісти на запитання.',
          chain: 'omni-followup',
          step: step.channel,
        },
      });
      sent.push(step.channel);
    }

    await logAudit({
      actorUserId: req.user.id,
      consultationId: consultation.id,
      entityType: 'Automation',
      entityId: consultation.id,
      action: 'RUN_TEMPLATE_OMNI_FOLLOWUP',
      metadata: { templateKey, sent },
    });

    res.json({ ok: true, templateKey, processed: 1, sentChannels: sent });
    return;
  }

  throw new AppError(400, 'Unsupported automation template');
}));

app.get('/api/admin/ai/scenarios', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'VIEWER']), asyncHandler(async (req, res) => {
  res.json([
    {
      key: 'client-summary',
      title: 'Client summary',
      description: 'Стисла зведена картка клієнта, оплати і задач.',
    },
    {
      key: 'next-action',
      title: 'Next best action',
      description: 'Рекомендований наступний крок для менеджера.',
    },
    {
      key: 'reply-draft',
      title: 'Reply draft',
      description: 'Чернетка відповіді клієнту за поточним контекстом.',
    },
  ]);
}));

app.post('/api/admin/ai/run', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'VIEWER']), validateBody(aiRunSchema), asyncHandler(async (req, res) => {
  const { scenario, consultationId, input } = req.body;
  const context = consultationId ? await buildConsultationAIPromptData(consultationId) : null;
  if (consultationId && !context) throw new AppError(404, 'Consultation not found');

  const result = runAIScenario({ scenario, input, context });

  await logAudit({
    actorUserId: req.user.id,
    consultationId: consultationId || null,
    entityType: 'AI',
    entityId: scenario,
    action: 'RUN_AI_SCENARIO',
    metadata: {
      scenario,
      consultationId: consultationId || null,
      confidence: result.confidence,
      source: result.source,
    },
  });

  res.json({
    scenario,
    context,
    ...result,
  });
}));

app.get('/api/admin/calendar/sync/providers', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'VIEWER']), asyncHandler(async (req, res) => {
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  res.json({
    providers: [
      {
        key: 'google',
        title: 'Google Calendar',
        enabled: googleEnabled,
        scopes: ['calendar.events.readonly', 'calendar.events'],
      },
    ],
  });
}));

app.get('/api/admin/calendar/sync/google/connect-url', authMiddleware, requireRole(['ADMIN', 'MANAGER']), asyncHandler(async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${allowedOrigins[0] || 'http://localhost:5173'}/admin/calendar/google/callback`;
  if (!clientId) {
    res.json({ enabled: false, message: 'Google sync is not configured' });
    return;
  }

  const state = `${req.user.id}:${Date.now()}`;
  const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events');
  const connectUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&access_type=offline&prompt=consent&scope=${scope}&state=${encodeURIComponent(state)}`;
  res.json({ enabled: true, provider: 'google', connectUrl });
}));

app.post('/api/admin/calendar/sync/push', authMiddleware, requireRole(['ADMIN', 'MANAGER']), validateBody(calendarSyncPushSchema), asyncHandler(async (req, res) => {
  const { consultationId, provider } = req.body;
  const consultation = await prisma.consultation.findFirst({
    where: {
      id: consultationId,
      ...getManagerRoleFilter(req.user),
    },
  });
  if (!consultation) throw new AppError(404, 'Consultation not found');

  const startAt = consultation.scheduledAt || consultation.preferredDateTime;
  const endAt = startAt
    ? addMinutes(new Date(startAt), Number(consultation.estimatedDuration || 45))
    : null;

  const eventPayload = {
    title: `Консультація: ${consultation.firstName} ${consultation.lastName || ''}`.trim(),
    description: consultation.description || '',
    startAt,
    endAt,
    attendeeEmail: consultation.email,
  };

  await logAudit({
    actorUserId: req.user.id,
    consultationId: consultation.id,
    entityType: 'CalendarSync',
    entityId: consultation.id,
    action: 'PUSH_EVENT_TO_PROVIDER',
    metadata: {
      provider,
      eventPayload,
      simulated: true,
    },
  });

  res.json({
    ok: true,
    provider,
    simulated: true,
    message: 'Sync adapter stub is ready. Wire OAuth tokens + API call to enable production sync.',
    eventPayload,
  });
}));

app.post('/api/admin/calendar/recurring', authMiddleware, requireRole(['ADMIN', 'MANAGER']), validateBody(recurringScheduleSchema), asyncHandler(async (req, res) => {
  if (!canWriteConsultations(req.user.role)) throw new AppError(403, 'Forbidden');
  const { consultationId, occurrences, intervalDays } = req.body;

  const base = await prisma.consultation.findFirst({
    where: {
      id: consultationId,
      ...getManagerRoleFilter(req.user),
    },
    include: {
      service: true,
    },
  });
  if (!base) throw new AppError(404, 'Consultation not found');

  const baseStart = getConsultationStart(base);
  if (!baseStart) throw new AppError(400, 'Base consultation has no schedule date');

  const series = await prisma.recurringSeries.create({
    data: {
      title: `${base.firstName} ${base.lastName || ''}`.trim() || base.email,
      consultationType: base.consultationType,
      intervalDays,
      plannedOccurrences: occurrences,
      startAt: baseStart,
      createdById: req.user.id,
    },
  });

  await prisma.consultation.update({
    where: { id: base.id },
    data: {
      recurringSeriesId: series.id,
      recurringOccurrence: 1,
    },
  });

  const created = [];
  const skipped = [];
  for (let index = 1; index < occurrences; index += 1) {
    const occurrenceIndex = index + 1;
    const nextStart = addMinutes(baseStart, intervalDays * 24 * 60 * index);
    const { start: dayStart, end: dayEnd } = getDayBounds(nextStart);

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
      },
    });

    const nextEnd = addMinutes(nextStart, Number(base.estimatedDuration || 45));
    const hasConflict = existingConsultations.some((existing) => {
      const existingStart = getConsultationStart(existing);
      const existingEnd = getConsultationEnd(existing);
      if (!existingStart || !existingEnd) return false;
      return overlaps(nextStart, nextEnd, existingStart, existingEnd);
    });

    if (hasConflict) {
      await prisma.recurringException.create({
        data: {
          recurringSeriesId: series.id,
          occurrenceIndex,
          action: 'SKIP',
          reason: 'Time conflict',
        },
      });
      skipped.push({ occurrenceIndex, date: nextStart, reason: 'Time conflict' });
      continue;
    }

    const clone = await prisma.consultation.create({
      data: {
        userId: base.userId,
        serviceId: base.serviceId,
        email: base.email,
        phone: base.phone,
        firstName: base.firstName,
        lastName: base.lastName,
        consultationType: base.consultationType,
        isPaid: base.isPaid,
        estimatedDuration: base.estimatedDuration,
        serviceCategory: base.serviceCategory,
        serviceName: base.serviceName,
        servicePriceText: base.servicePriceText,
        selectedServices: base.selectedServices,
        assignedManagerId: base.assignedManagerId,
        createdById: req.user.id,
        description: base.description,
        preferredContactMethod: base.preferredContactMethod,
        googleMeetLink: base.googleMeetLink,
        preferredDateTime: nextStart,
        scheduledAt: nextStart,
        status: 'PENDING',
        pipelineStageEnteredAt: new Date(),
        recurringSeriesId: series.id,
        recurringOccurrence: occurrenceIndex,
      },
      select: {
        id: true,
        preferredDateTime: true,
        recurringOccurrence: true,
      },
    });

    created.push(clone);
  }

  await logAudit({
    actorUserId: req.user.id,
    consultationId: base.id,
    entityType: 'ConsultationSeries',
    entityId: base.id,
    action: 'CREATE_RECURRING_SERIES',
    metadata: {
      seriesId: series.id,
      baseConsultationId: base.id,
      requestedOccurrences: occurrences,
      intervalDays,
      createdCount: created.length,
      createdIds: created.map((item) => item.id),
      skippedCount: skipped.length,
    },
  });

  res.status(201).json({
    seriesId: series.id,
    baseConsultationId: base.id,
    requestedOccurrences: occurrences,
    intervalDays,
    createdCount: created.length,
    created,
    skipped,
  });
}));

app.get('/api/admin/calendar/recurring/:seriesId', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'VIEWER']), asyncHandler(async (req, res) => {
  const { seriesId } = req.params;
  const series = await prisma.recurringSeries.findUnique({
    where: { id: seriesId },
    include: {
      consultations: {
        include: {
          assignedManager: { select: pickUserFields },
        },
        orderBy: { recurringOccurrence: 'asc' },
      },
      exceptions: {
        orderBy: { occurrenceIndex: 'asc' },
      },
    },
  });

  if (!series) throw new AppError(404, 'Recurring series not found');
  if (!isAdminRole(req.user.role)) {
    const hasAccess = series.consultations.some((item) => item.assignedManagerId === req.user.id);
    if (!hasAccess) throw new AppError(403, 'Forbidden');
  }

  res.json(series);
}));

app.post('/api/admin/calendar/recurring/exception', authMiddleware, requireRole(['ADMIN', 'MANAGER']), validateBody(recurringExceptionSchema), asyncHandler(async (req, res) => {
  if (!canWriteConsultations(req.user.role)) throw new AppError(403, 'Forbidden');
  const { seriesId, occurrenceIndex, reason } = req.body;
  const series = await prisma.recurringSeries.findUnique({
    where: { id: seriesId },
    include: { consultations: true },
  });
  if (!series) throw new AppError(404, 'Recurring series not found');

  if (!isAdminRole(req.user.role)) {
    const hasAccess = series.consultations.some((item) => item.assignedManagerId === req.user.id);
    if (!hasAccess) throw new AppError(403, 'Forbidden');
  }

  const consultationToCancel = series.consultations.find((item) => item.recurringOccurrence === occurrenceIndex);
  if (consultationToCancel) {
    await prisma.consultation.update({
      where: { id: consultationToCancel.id },
      data: { status: 'CANCELLED' },
    });
  }

  const existingException = await prisma.recurringException.findFirst({
    where: {
      recurringSeriesId: seriesId,
      occurrenceIndex,
    },
    select: { id: true },
  });

  const exception = existingException
    ? await prisma.recurringException.update({
        where: { id: existingException.id },
        data: {
          action: 'SKIP',
          reason: reason || 'Skipped by manager',
          consultationId: consultationToCancel?.id || null,
        },
      })
    : await prisma.recurringException.create({
        data: {
          recurringSeriesId: seriesId,
          occurrenceIndex,
          action: 'SKIP',
          reason: reason || 'Skipped by manager',
          consultationId: consultationToCancel?.id || null,
        },
      });

  await logAudit({
    actorUserId: req.user.id,
    consultationId: consultationToCancel?.id || null,
    entityType: 'RecurringSeries',
    entityId: seriesId,
    action: 'ADD_RECURRING_EXCEPTION',
    metadata: {
      occurrenceIndex,
      reason: reason || 'Skipped by manager',
    },
  });

  res.status(201).json({
    ok: true,
    exception,
    cancelledConsultationId: consultationToCancel?.id || null,
  });
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
  if (!canManageContent(req.user.role)) throw new AppError(403, 'Forbidden');
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
  if (!canManageContent(req.user.role)) throw new AppError(403, 'Forbidden');
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
  if (!canManageContent(req.user.role)) throw new AppError(403, 'Forbidden');
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

app.get('/api/admin/tasks', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'VIEWER']), asyncHandler(async (req, res) => {
  const { status, managerId } = req.query;
  const where = {
    ...getTaskRoleFilter(req.user),
  };
  if (status) where.status = status;
  if (managerId && isAdminRole(req.user.role)) where.managerId = String(managerId);

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
  if (!isAdminRole(req.user.role) && req.user.id !== managerId) {
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
  if (!isAdminRole(req.user.role) && before.managerId !== req.user.id) {
    throw new AppError(403, 'Forbidden');
  }

  const { title, description, managerId, consultationId, dueDate, priority, status } = req.body;
  if (!isAdminRole(req.user.role) && managerId && managerId !== req.user.id) {
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

app.get('/api/admin/documents', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'VIEWER']), asyncHandler(async (req, res) => {
  const { folder, consultationId, search, includeArchived } = req.query;

  const where = {
    ...(String(includeArchived || 'false') === 'true' ? {} : { isArchived: false }),
  };

  if (folder && folder !== 'all') where.folder = String(folder);
  if (consultationId) where.consultationId = String(consultationId);
  if (search) {
    where.OR = [
      { title: { contains: String(search) } },
      { fileName: { contains: String(search) } },
      { folder: { contains: String(search) } },
    ];
  }

  const documents = await prisma.clientDocument.findMany({
    where,
    include: {
      uploadedBy: { select: pickUserFields },
      consultation: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          status: true,
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  });

  res.json(documents.map((item) => ({
    ...item,
    contentBase64: item.contentBase64 ? undefined : null,
  })));
}));

app.post('/api/admin/documents', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'ACCOUNTANT']), validateBody(documentCreateSchema), asyncHandler(async (req, res) => {
  if (!canManageDocuments(req.user.role)) throw new AppError(403, 'Forbidden');
  const { title, folder, fileName, mimeType, fileSize, contentBase64, externalUrl, consultationId, documentGroupId } = req.body;

  if (!contentBase64 && !externalUrl) {
    throw new AppError(400, 'Provide contentBase64 or externalUrl');
  }

  if (consultationId) {
    const exists = await prisma.consultation.findUnique({ where: { id: consultationId }, select: { id: true } });
    if (!exists) throw new AppError(404, 'Consultation not found');
  }

  const groupId = documentGroupId || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const latestVersion = await prisma.clientDocument.findFirst({
    where: { documentGroupId: groupId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  const version = Number(latestVersion?.version || 0) + 1;

  const document = await prisma.clientDocument.create({
    data: {
      title,
      folder,
      fileName,
      mimeType: mimeType || null,
      fileSize: fileSize ? Number(fileSize) : null,
      contentBase64: contentBase64 || null,
      externalUrl: externalUrl || null,
      consultationId: consultationId || null,
      uploadedById: req.user.id,
      documentGroupId: groupId,
      version,
      isArchived: false,
    },
    include: {
      uploadedBy: { select: pickUserFields },
      consultation: { select: { id: true, firstName: true, lastName: true, email: true, status: true } },
    },
  });

  await logAudit({
    actorUserId: req.user.id,
    consultationId: document.consultationId,
    entityType: 'ClientDocument',
    entityId: document.id,
    action: 'CREATE_DOCUMENT',
    afterState: { ...document, contentBase64: document.contentBase64 ? '[hidden]' : null },
  });

  res.status(201).json({ ...document, contentBase64: null });
}));

app.patch('/api/admin/documents/:id', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'ACCOUNTANT']), validateBody(documentPatchSchema), asyncHandler(async (req, res) => {
  if (!canManageDocuments(req.user.role)) throw new AppError(403, 'Forbidden');
  const { id } = req.params;
  const before = await prisma.clientDocument.findUnique({ where: { id } });
  if (!before) throw new AppError(404, 'Document not found');

  const { title, folder, isArchived } = req.body;

  const document = await prisma.clientDocument.update({
    where: { id },
    data: {
      title: title || undefined,
      folder: folder || undefined,
      isArchived: typeof isArchived === 'boolean' ? isArchived : undefined,
    },
    include: {
      uploadedBy: { select: pickUserFields },
      consultation: { select: { id: true, firstName: true, lastName: true, email: true, status: true } },
    },
  });

  await logAudit({
    actorUserId: req.user.id,
    consultationId: document.consultationId,
    entityType: 'ClientDocument',
    entityId: document.id,
    action: 'UPDATE_DOCUMENT',
    beforeState: { ...before, contentBase64: before.contentBase64 ? '[hidden]' : null },
    afterState: { ...document, contentBase64: document.contentBase64 ? '[hidden]' : null },
  });

  res.json({ ...document, contentBase64: null });
}));

app.get('/api/admin/documents/:id/versions', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'VIEWER']), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const current = await prisma.clientDocument.findUnique({ where: { id }, select: { documentGroupId: true } });
  if (!current) throw new AppError(404, 'Document not found');

  const versions = await prisma.clientDocument.findMany({
    where: { documentGroupId: current.documentGroupId },
    include: {
      uploadedBy: { select: pickUserFields },
    },
    orderBy: { version: 'desc' },
  });

  res.json(versions.map((item) => ({ ...item, contentBase64: null })));
}));

app.get('/api/admin/documents/:id/download', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'VIEWER']), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const document = await prisma.clientDocument.findUnique({ where: { id } });
  if (!document) throw new AppError(404, 'Document not found');

  if (document.externalUrl) {
    return res.redirect(document.externalUrl);
  }

  if (!document.contentBase64) {
    throw new AppError(404, 'Document file content not found');
  }

  const buffer = decodeDocumentBase64(document.contentBase64);
  if (!buffer) throw new AppError(400, 'Invalid document content format');

  res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.fileName || 'document')}"`);
  return res.send(buffer);
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
app.get('/api/admin/reviews', authMiddleware, requireRole(['ADMIN', 'MANAGER', 'VIEWER']), asyncHandler(async (req, res) => {
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
