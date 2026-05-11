import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Groq from 'groq-sdk';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHAT_ACTIVE_PORT_FILE = path.resolve(__dirname, '..', 'scripts', '.chat-active-port');

function writeChatActivePort(activePort) {
  try {
    fs.writeFileSync(CHAT_ACTIVE_PORT_FILE, String(activePort), 'utf8');
  } catch (err) {
    console.warn('[chat] Could not write active port file:', err?.message || err);
  }
}

function clearChatActivePort() {
  try {
    fs.unlinkSync(CHAT_ACTIVE_PORT_FILE);
  } catch {
    /* ignore */
  }
}

clearChatActivePort();
process.on('exit', clearChatActivePort);
import authRoutes from './api/routes/authRoutes.js';
import postsRoutes from './api/routes/postsRoutes.js';
import { LENDING_AI_APPEND, LENDING_CUSTOMER_FAQ, getLendingFallbackReply } from './ai/lendingTraining.js';
import {
  createConversation,
  getConversation,
  getAllConversations,
  updateStatus,
  updateMode,
  updateVisitor,
  addMessage,
  getMessages,
  getArchivedConversations,
  archiveConversation,
  deleteConversation,
  createLead,
  getLeads,
  getLeadById,
  updateLeadStatus,
  updateLead,
  createOrUpdateVisit,
  getVisitByVisitId,
  getAllVisits,
  getVisitsForAnalytics,
  updateVisitLocation,
  createTicket,
  getTickets,
  getTicketById,
  getTicketsByConvo,
  updateTicket,
  setTicketUnread,
  incrementConversationUnread,
  clearConversationUnread,
  deleteTicket,
  getSiteSettings,
  setSiteSettings,
  getSettings,
  setSettings,
  getAdminStats,
  getCareerPositions,
  getCareerPositionById,
  createCareerPosition,
  createApplication,
  createLendingApplication,
  listApplications,
  listLendingApplications,
  getApplicationById,
  deleteApplication,
  updateApplicationStatus,
  updateCareerPosition,
  deleteCareerPosition,
  getNewsItems,
  createNewsItem,
  updateNewsItem,
  deleteNewsItem,
  getNewsletterContent,
  setNewsletterContent,
  createSubscriber,
  getSubscriberByEmail,
  updateSubscriberType,
  getSubscribers,
  deleteSubscriber,
  deleteSubscriberByToken,
  countSubscribers,
  getSubscribersForNotification,
  createFeedback,
  getFeedback,
  markFeedbackRead,
  deleteFeedback,
  countUnreadFeedback,
  createPartnership,
  getPartnerships,
  deletePartnership,
  updatePartnership,
  getCrmTickets,
  getCrmTicketById,
  createCrmTicket,
  updateCrmTicket,
  deleteCrmTicket,
  addCrmTicketReply,
  addCrmTicketNote,
  setCrmTicketUnread,
  getRecentOpenChatTickets,
  logActivity,
  getActivityLogs,
  getAdminUsers,
  createAdminUser,
  deleteAdminUser,
  getAdminUserByEmail,
  updateAdminUserRole,
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getRoleById,
  getPermissions,
  getRolePermissions,
  getPermissionsForRole,
  createPermission,
  getPermissionIdsForRole,
  assignRolePermissions,
  getRolesWithPermissions,
  DB_PROVIDER,
  ensureApplicationsTable,
  ensureLendingApplicationsTable,
  getAppRoles,
  createAppRole,
  updateAppRole,
  deleteAppRole,
  getAppUsers,
  createAppUser,
  getAppUserByUsername,
  getAppUserByLogin,
  getAppRoleById,
  getCmsPages,
  getCmsPageByName,
  getCmsPageContent,
  getCmsSectionsByPageId,
  getCmsContentsBySectionId,
  upsertCmsContent,
  getCmsSectionByPageAndKey,
} from './db/provider.js';
import { sendNotificationEmails, isEmailConfigured, sendTestEmail, sendCustomEmail, sendApplicationConfirmationEmail } from './lib/email.js';
import { syncOutboundChatMessage, syncOutboundFeedback } from './lib/laravelSupportSync.js';
import { deterministicSyncUuid } from './lib/syncDedupeUuid.js';

const app = express();
if (process.env.TRUST_PROXY === '1' || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS) || 1);
}

/** Comma-separated browser origins; empty = allow all (local dev). Set in production. */
const normalizeCorsOrigin = (value) => {
  const raw = String(value || '').trim().replace(/\/$/, '');
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  // Support bare domains in env values, e.g. amalgatedlending.com
  return `https://${raw}`;
};
const defaultChatCorsOrigins = [
  'https://amalgatedlending.com',
  'https://www.amalgatedlending.com',
  'https://chat.amalgatedlending.com',
  'https://hrisdemo.agctek.co',
];
const chatCorsOrigins = [
  ...new Set(
    [...defaultChatCorsOrigins, ...(process.env.CHAT_CORS_ORIGINS || '').split(/[\s,]+/)]
      .map((s) => s.trim())
      .filter(Boolean)
      .map(normalizeCorsOrigin)
      .filter(Boolean),
  ),
];
const isAllowedChatOrigin = (origin) => {
  const normalized = normalizeCorsOrigin(origin);
  if (!normalized) return true;
  if (chatCorsOrigins.includes(normalized)) return true;
  try {
    const { hostname } = new URL(normalized);
    if (process.env.NODE_ENV !== 'production') {
      // Dev ergonomics: allow local/LAN origins regardless of Vite port.
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname === '[::1]' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.')
      ) {
        return true;
      }
    }
    // Allow Amalgated Lending site variants behind Cloudflare/proxies.
    if (hostname === 'amalgatedlending.com' || hostname.endsWith('.amalgatedlending.com')) return true;
    if (hostname === 'hrisdemo.agctek.co' || hostname.endsWith('.agctek.co')) return true;
  } catch {
    return false;
  }
  return false;
};
/**
 * Credentialed CORS requires a single reflected origin (literal match to the request's Origin).
 * Use the browser-sent Origin string, not generic `true`, so ACAO stays one deterministic value at the origin layer.
 * If you still see "multiple values" errors in production, the edge is ALSO sending ACAO — remove duplicate proxy headers.
 */
const chatCorsConfig =
  chatCorsOrigins.length > 0
    ? {
        origin(origin, callback) {
          const raw = typeof origin === 'string' ? origin.trim() : '';
          if (!raw || !isAllowedChatOrigin(raw)) {
            callback(null, false);
            return;
          }
          callback(null, raw);
        },
        credentials: true,
      }
    : { origin: true };
if (process.env.NODE_ENV === 'production' && chatCorsOrigins.length === 0) {
  console.warn('[chat] NODE_ENV=production but CHAT_CORS_ORIGINS is empty — all origins allowed. Set CHAT_CORS_ORIGINS for stricter CORS.');
}

let port = Number(process.env.CHAT_PORT || process.env.PORT) || 8010;
const httpServer = createServer(app);
/**
 * Keep Socket.IO / Engine.IO CORS disabled — Express `cors(chatCorsConfig)` already answers preflights.
 * Enabling `cors` on Socket.IO as well often stacks with reverse-proxy `add_header` and breaks browsers
 * ("Access-Control-Allow-Origin contains multiple values").
 *
 * Tuning notes (safe defaults):
 *  - `pingInterval` / `pingTimeout` slightly higher than defaults so flaky mobile networks
 *    don't churn through reconnects (each reconnect rebuilds presence + history fan-out).
 *  - `maxHttpBufferSize` capped at 1 MB to avoid one huge frame stalling the event loop.
 *  - `perMessageDeflate` only kicks in for big frames so small status pings stay cheap.
 */
const io = new Server(httpServer, {
  cors: false,
  pingInterval: 25_000,
  pingTimeout: 60_000,
  maxHttpBufferSize: 1024 * 1024,
  perMessageDeflate: { threshold: 1024 },
});
const CHAT_PERF_LOG =
  ['1', 'true', 'yes', 'on'].includes(String(process.env.CHAT_PERF_LOG || '').toLowerCase().trim());

function nowMs() {
  return Date.now();
}

/** Visitor sockets per conversation (website widget); supports multiple tabs. */
const visitorPresenceCounts = new Map();

function trackVisitorOnline(conversationId) {
  const id = String(conversationId || '').trim();
  if (!id) return;
  visitorPresenceCounts.set(id, (visitorPresenceCounts.get(id) || 0) + 1);
  io.to('admin').emit('visitor:presence', { conversationId: id, online: true });
}

function trackVisitorOffline(conversationId) {
  const id = String(conversationId || '').trim();
  if (!id) return;
  const next = (visitorPresenceCounts.get(id) || 0) - 1;
  if (next <= 0) visitorPresenceCounts.delete(id);
  else visitorPresenceCounts.set(id, next);
  io.to('admin').emit('visitor:presence', {
    conversationId: id,
    online: visitorPresenceCounts.has(id),
  });
}

/** Latest measured AI reply durations (ms from user message to stream complete), newest first. */
const recentAiReplyMetrics = [];

function recordAiReplyMetric(conversationId, delayMs) {
  const id = String(conversationId || '').trim();
  const ms = Math.max(0, Number(delayMs) || 0);
  recentAiReplyMetrics.unshift({ conversationId: id, delayMs: ms, at: new Date().toISOString() });
  while (recentAiReplyMetrics.length > 50) recentAiReplyMetrics.pop();
  io.to('admin').emit('ai:metrics:refresh');
}

function perfLog(stage, startedAt, details = {}) {
  if (!CHAT_PERF_LOG) return;
  const elapsedMs = Math.max(0, nowMs() - startedAt);
  console.log(`[chat][perf] ${stage}`, { elapsed_ms: elapsedMs, ...details });
}

let adminConversationRefreshTimer = null;
let adminAnalyticsRefreshTimer = null;
/**
 * Debounced fan-out to the admin room. The admin frontend listens for
 * `conversations:refresh` / `analytics:refresh` and re-fetches the
 * conversation list / analytics dashboard when it sees them.
 *
 * The previous implementation recursed into itself instead of emitting,
 * which silently never fired the events; this restores the intended
 * debounce + single emit behaviour without changing the public contract.
 */
function emitConversationsRefresh() {
  if (adminConversationRefreshTimer) return;
  adminConversationRefreshTimer = setTimeout(() => {
    adminConversationRefreshTimer = null;
    try {
      io.to('admin').emit('conversations:refresh');
    } catch (err) {
      console.warn('[chat] conversations:refresh emit failed', err?.message || err);
    }
  }, 150);
}

function emitAnalyticsRefresh() {
  if (adminAnalyticsRefreshTimer) return;
  adminAnalyticsRefreshTimer = setTimeout(() => {
    adminAnalyticsRefreshTimer = null;
    try {
      io.to('admin').emit('analytics:refresh');
    } catch (err) {
      console.warn('[chat] analytics:refresh emit failed', err?.message || err);
    }
  }, 500);
}

function extractClientIpFromHeaders(headers, fallback = '') {
  const h = headers || {};
  const cf = String(h['cf-connecting-ip'] || '').trim();
  if (cf) return cf;
  const xff = String(h['x-forwarded-for'] || '').split(',')[0]?.trim();
  if (xff) return xff;
  const xri = String(h['x-real-ip'] || '').trim();
  if (xri) return xri;
  return String(fallback || '').trim();
}

function parseDeviceMetaFromHeaders(headers) {
  const h = headers || {};
  const ua = String(h['user-agent'] || '');
  const { device, browser } = parseUserAgent(ua);
  const saveData = String(h['save-data'] || '').toLowerCase() === 'on';
  const secMobile = String(h['sec-ch-ua-mobile'] || '').trim();
  const effectiveType = String(h['ect'] || h['x-network-type'] || '').toLowerCase().trim();
  const isBot = /bot|crawler|spider|headless|preview|facebookexternalhit|whatsapp|telegrambot|slurp|bingpreview/i.test(ua);
  let os = 'Unknown';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod|ios/i.test(ua)) os = 'iOS';
  else if (/mac os|macintosh/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  const isMobile = device === 'Mobile' || secMobile === '?1';
  return { ua, device, browser, os, isBot, isMobile, saveData, effectiveType };
}

function classifyTrafficProfile(meta) {
  if (meta.isBot) return { routingTier: 'bot', contentProfile: 'lite', cacheHint: 'aggressive' };
  if (meta.saveData || ['2g', '3g', 'slow-2g'].includes(meta.effectiveType)) {
    return { routingTier: 'edge-economy', contentProfile: 'lite', cacheHint: 'aggressive' };
  }
  if (meta.isMobile) return { routingTier: 'edge-mobile', contentProfile: 'balanced', cacheHint: 'normal' };
  return { routingTier: 'edge-standard', contentProfile: 'full', cacheHint: 'normal' };
}

app.use(cors(chatCorsConfig));
/**
 * gzip every JSON / HTML / JS / CSS response above 1 KB.
 * Massive win for the chat history endpoints (large JSON arrays) and for the SPA
 * bundle when this server also serves `../dist`. Skipped automatically for
 * Server-Sent-Events streams because `compression` checks res.getHeader('Content-Type').
 */
app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
  }),
);
app.use(express.json());

function createRateLimiter({ windowMs, limit }) {
  const bucket = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = `${getClientIp(req)}:${req.path}`;
    const record = bucket.get(key);
    if (!record || now - record.start > windowMs) {
      bucket.set(key, { start: now, count: 1 });
      return next();
    }
    if (record.count >= limit) {
      return res.status(429).json({ ok: false, message: 'Too many requests. Please try again shortly.' });
    }
    record.count += 1;
    bucket.set(key, record);
    return next();
  };
}

// Capture client IP + device/network metadata once for every HTTP request.
app.use((req, res, next) => {
  const ip = extractClientIpFromHeaders(req.headers, req.ip || req.socket?.remoteAddress || '');
  const meta = parseDeviceMetaFromHeaders(req.headers);
  const traffic = classifyTrafficProfile(meta);
  req.clientMeta = {
    ip,
    ...meta,
    ...traffic,
  };
  res.setHeader('X-Traffic-Tier', traffic.routingTier);
  res.setHeader('X-Content-Profile', traffic.contentProfile);
  next();
});

app.use((req, res, next) => {
  const host = String(req?.headers?.host || '').toLowerCase().split(':')[0];
  if (host === 'www.amalgatedlending.com') {
    return res.redirect(301, `https://amalgatedlending.com${req.originalUrl || '/'}`);
  }
  next();
});

const limitAdminLogin = createRateLimiter({ windowMs: 60 * 1000, limit: 10 });
const limitPublicChat = createRateLimiter({ windowMs: 10 * 1000, limit: 40 });

const INTERNAL_BROADCAST_SECRET = String(process.env.CHAT_INTERNAL_BROADCAST_SECRET || '').trim();

function requireInternalChatBroadcast(req, res, next) {
  if (!INTERNAL_BROADCAST_SECRET) {
    return res.status(503).json({
      ok: false,
      message: 'Relay not configured — set CHAT_INTERNAL_BROADCAST_SECRET on chat-server.',
    });
  }
  const hdr = String(req.headers['x-chat-broadcast-secret'] || '').trim();
  if (!hdr || hdr !== INTERNAL_BROADCAST_SECRET) {
    return res.status(403).json({ ok: false, message: 'Forbidden.' });
  }
  next();
}

/**
 * Laravel → Socket.IO relay: staff replies created in Laravel `chat_messages` reach visitors without Pusher.
 * POST JSON { conversation_id, message: { id?, sender, content, created_at?, admin_name? } }
 */
app.post('/api/internal/chat-broadcast/message', requireInternalChatBroadcast, (req, res) => {
  try {
    const conversationId = String(req.body?.conversation_id || '').trim();
    const m = req.body?.message || {};
    const content = String(m.content || '').trim();
    if (!conversationId || !content) {
      return res.status(422).json({ ok: false, message: 'conversation_id and message.content are required.' });
    }
    const payload = {
      conversation_id: conversationId,
      id: m.id != null ? m.id : `laravel-${Date.now()}`,
      sender: String(m.sender || 'admin').toLowerCase() === 'admin' ? 'admin' : String(m.sender || 'admin'),
      content,
      created_at: m.created_at || new Date().toISOString(),
      admin_name: m.admin_name || null,
    };
    io.to(conversationId).emit('chat:message', payload);
    io.to('admin').emit('chat:newMessage', { conversationId, message: payload });
    emitConversationsRefresh();
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      message: e instanceof Error ? e.message : 'Unable to relay message.',
    });
  }
});

/**
 * Serve CMS uploads at /uploads/cms.
 *
 * Files in here are content-hashed by the CMS upload pipeline (timestamp + random
 * suffix in the filename) so a 30-day cache is safe; we also send `immutable` for
 * better hit ratios on Cloudflare / browser caches and a small `Vary` to keep
 * compressed/uncompressed clients separated.
 */
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'storage', 'app', 'public', 'uploads'), {
    fallthrough: true,
    maxAge: '30d',
    etag: true,
    lastModified: true,
    setHeaders(res) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
      res.setHeader('Vary', 'Accept-Encoding');
    },
  }),
);

// Handle invalid JSON, multer, and any other API errors as JSON (not HTML 500)
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ ok: false, message: 'Invalid JSON body.' });
  }
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ ok: false, message: 'Resume must be 2MB or smaller.' });
    }
    return res.status(400).json({ ok: false, message: err.message || 'File upload error.' });
  }
  if (err?.message?.includes?.('Only PDF')) {
    return res.status(400).json({ ok: false, message: err.message });
  }
  const url = req.originalUrl || req.url || '';
  if (url.startsWith('/api') && !res.headersSent) {
    console.error('[api]', req.method, url, err?.message || err);
    const status = Number(err.statusCode || err.status) || 500;
    return res.status(status).json({
      ok: false,
      message: err?.message || 'Unable to complete request.',
    });
  }
  return next(err);
});

// ── Example Auth + CRUD API ──
app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);

// ── Public: Careers & News (DB-backed) ──
app.get('/api/public/careers', async (_req, res) => {
  try {
    const positions = await getCareerPositions();
    res.json({ ok: true, positions });
  } catch (err) {
    console.error('[api][public][careers]', err?.message || err);
    res.status(500).json({ ok: false });
  }
});

app.get('/api/public/careers/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ ok: false, message: 'Invalid job id.' });
    }
    const position = await getCareerPositionById(id);
    if (!position) return res.status(404).json({ ok: false, message: 'Job not found.' });
    res.json({ ok: true, position });
  } catch (err) {
    console.error('[api][public][careers/:id]', err?.message || err);
    res.status(500).json({ ok: false });
  }
});

// ── Job applications: resume upload dir and multer ──
const RESUMES_DIR = path.join(__dirname, 'storage', 'app', 'public', 'resumes');
try {
  fs.mkdirSync(RESUMES_DIR, { recursive: true });
} catch {
  /* directory may already exist */
}

const resumeStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, RESUMES_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.pdf';
    const base = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    cb(null, `${base}${ext}`);
  },
});
const uploadResume = multer({
  storage: resumeStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(pdf|doc|docx)$/i.test(file.originalname);
    if (allowed) cb(null, true);
    else cb(new Error('Only PDF, DOC, or DOCX files are allowed.'));
  },
});

// CMS image upload
const CMS_UPLOADS_DIR = path.join(__dirname, 'storage', 'app', 'public', 'uploads', 'cms');
try {
  fs.mkdirSync(CMS_UPLOADS_DIR, { recursive: true });
} catch {}
const cmsStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, CMS_UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const safe = (path.basename(file.originalname, ext) || 'image').replace(/[^a-z0-9_-]/gi, '_').slice(0, 40);
    cb(null, `${Date.now()}-${safe}${ext}`);
  },
});
const uploadCmsImage = multer({
  storage: cmsStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.originalname);
    if (allowed) cb(null, true);
    else cb(new Error('Only image files (jpg, png, gif, webp, svg) are allowed.'));
  },
});

const EMAIL_REGEX_APPLY = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmailApply(str) {
  return typeof str === 'string' && EMAIL_REGEX_APPLY.test(str.trim());
}

app.post('/api/applications', uploadResume.single('resume'), async (req, res) => {
  try {
    const body = req.body || {};
    const jobId = body.job_id != null ? Number(body.job_id) : NaN;
    if (!Number.isInteger(jobId) || jobId < 1) {
      return res.status(400).json({ ok: false, message: 'Valid job_id is required.' });
    }
    const fullName = (body.full_name ?? '').trim();
    const email = (body.email ?? '').trim();
    const phone = (body.phone ?? '').trim();
    if (!fullName) return res.status(400).json({ ok: false, message: 'Full name is required.' });
    if (!email) return res.status(400).json({ ok: false, message: 'Email is required.' });
    if (!isValidEmailApply(email)) {
      return res.status(400).json({ ok: false, message: 'Please provide a valid email address.' });
    }
    if (!phone) return res.status(400).json({ ok: false, message: 'Phone is required.' });
    if (!req.file || !req.file.path) {
      return res.status(400).json({
        ok: false,
        message: 'Resume file (PDF, DOC, or DOCX, max 2MB) is required. If you uploaded a file, check its size and format.',
      });
    }
    const resumeStored = path.join('resumes', path.basename(req.file.path)).replace(/\\/g, '/');

    await createApplication({
      job_id: jobId,
      full_name: fullName,
      email,
      phone: phone || null,
      resume: resumeStored,
    });

    io.to('admin').emit('applications:refresh');

    if (isEmailConfigured()) {
      try {
        const job = await getCareerPositionById(jobId).catch(() => null);
        const jobTitle = job?.title || 'your application';
        await sendApplicationConfirmationEmail({
          to: email,
          applicantName: fullName,
          jobTitle,
        }).catch((e) => console.error('[api][applications] confirmation email:', e?.message || e));
      } catch (e) {
        console.error('[api][applications] email send:', e?.message || e);
      }
    }

    res.status(201).json({ ok: true, message: 'Application submitted successfully.' });
  } catch (err) {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ ok: false, message: 'Resume must be 2MB or smaller.' });
    }
    if (err && err.message && String(err.message).includes('Only PDF')) {
      return res.status(400).json({ ok: false, message: err.message });
    }
    console.error('[api][applications]', err?.message || err);
    if (err?.stack) console.error(err.stack);
    const isDev = process.env.NODE_ENV !== 'production';
    const message =
      isDev && err?.message
        ? `Server error: ${err.message}`
        : 'Unable to submit application. Please try again.';
    res.status(500).json({ ok: false, message });
  }
});

// ── Amalgated Lending: loan applications (JSON) ──
function requireLendingAdminSecret(req, res, next) {
  const secret = process.env.LENDING_ADMIN_API_SECRET
  if (!secret || String(secret).trim().length < 8) {
    return res.status(503).json({
      ok: false,
      message: 'LENDING_ADMIN_API_SECRET is not set on the server (min 8 characters).',
    })
  }
  const auth = req.headers.authorization || ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  const header = (req.headers['x-lending-admin-secret'] || '').trim()
  if (bearer === secret || header === secret) return next()
  return res.status(401).json({ ok: false, message: 'Unauthorized.' })
}

app.post('/api/lending/applications', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const required = ['fullName', 'email', 'phone', 'address', 'employmentStatus', 'monthlyIncome', 'loanType', 'loanAmount', 'loanTerm']
    const missing = required.filter((k) => !String(body[k] ?? '').trim())
    if (missing.length) {
      return res.status(400).json({ ok: false, message: `Missing required fields: ${missing.join(', ')}` })
    }
    if (!isValidEmailApply(String(body.email))) {
      return res.status(400).json({ ok: false, message: 'Please provide a valid email address.' })
    }
    await createLendingApplication(body)
    io.to('admin').emit('applications:refresh')
    res.status(201).json({ ok: true, message: 'Application submitted successfully.' })
  } catch (err) {
    console.error('[api][lending][applications][post]', err?.message || err)
    res.status(500).json({ ok: false, message: 'Unable to submit application. Please try again.' })
  }
})

app.get('/api/lending/applications', requireLendingAdminSecret, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 300, 1), 500)
    const applications = await listLendingApplications({ limit })
    res.json({ ok: true, applications })
  } catch (err) {
    console.error('[api][lending][applications][get]', err?.message || err)
    res.status(500).json({ ok: false, message: 'Failed to load applications.' })
  }
})

app.get('/api/public/news', async (_req, res) => {
  try {
    const [content, items] = await Promise.all([getNewsletterContent(), getNewsItems()]);
    res.json({ ok: true, content: content || null, items });
  } catch (err) {
    console.error('[api][public][news]', err?.message || err);
    res.status(500).json({ ok: false });
  }
});

// ── Public: CMS page content ──
app.get('/api/pages/:pageName', async (req, res) => {
  try {
    const pageName = String(req.params.pageName || '').trim().toLowerCase();
    if (!pageName) return res.status(400).json({ ok: false, message: 'Page name required.' });
    const content = await getCmsPageContent(pageName);
    if (!content) return res.status(404).json({ ok: false, message: 'Page not found.' });
    res.json({ ok: true, content });
  } catch (err) {
    console.error('[api][pages]', err?.message || err);
    res.status(500).json({ ok: false });
  }
});

// ── Careers & News subscription (stores in subscribers table) ──
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(str) {
  return typeof str === 'string' && EMAIL_REGEX.test(str.trim());
}

app.post('/api/subscribe', async (req, res) => {
  const { email, subscription_type, honeypot } = req.body || {};
  if (honeypot) return res.json({ ok: true });
  const trimmed = (email || '').trim().toLowerCase();
  if (!trimmed || !isValidEmail(trimmed)) {
    return res.status(400).json({ ok: false, message: 'A valid email address is required.' });
  }
  const type = ['careers', 'news', 'both'].includes(subscription_type) ? subscription_type : 'both';
  try {
    const existing = await getSubscriberByEmail(trimmed);
    if (existing) {
      await updateSubscriberType(existing.id, type);
      return res.json({ ok: true, updated: true });
    }
    const sub = await createSubscriber({ email: trimmed, subscription_type: type });
    if (!sub) return res.status(400).json({ ok: false, message: 'Unable to subscribe. Please try again.' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[api][subscribe]', err?.message || err);
    return res.status(500).json({ ok: false, message: 'Unable to subscribe. Please try again.' });
  }
});

app.get('/api/unsubscribe/:token', async (req, res) => {
  const { token } = req.params;
  if (!token) return res.redirect('/');
  try {
    await deleteSubscriberByToken(token);
  } catch { /* ignore */ }
  const base = (process.env.SITE_URL || '').replace(/\/$/, '') || `http://localhost:${port}`;
  return res.redirect(`${base}/news?unsubscribed=1`);
});

// ── Newsletter subscribe (stores to admin leads) ──
app.post('/api/newsletter-subscribe', async (req, res) => {
  const { email, source_page } = req.body || {};
  const trimmed = (email || '').trim();
  if (!trimmed) {
    return res.status(400).json({ ok: false, message: 'Email is required.' });
  }
  try {
    const lead = await createLead({
      name: 'Newsletter Subscriber',
      email: trimmed,
      phone: null,
      company: null,
      inquiry_message: 'Newsletter signup',
      conversation_id: null,
      source_page: (source_page || '').trim() || '/news',
    });
    io.to('admin').emit('admin:newLead', lead);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[api][newsletter-subscribe]', err?.message || err);
    return res.status(500).json({ ok: false, message: 'Unable to subscribe. Please try again.' });
  }
});

// ── Contact inquiry (stores to leads) ──
app.post('/api/inquiry', async (req, res) => {
  const { name, email, phone, company, message, source_page } = req.body || {};
  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return res.status(400).json({ ok: false, message: 'Name, email, and message are required.' });
  }
  const cleanName = name.trim();
  const cleanEmail = email.trim();
  const cleanPhone = (phone || '').trim() || null;
  const cleanCompany = (company || '').trim() || null;
  const cleanMessage = message.trim();
  const sourcePage = (source_page || '').trim() || '/contact';
  let conversationId = null;

  try {
    conversationId = crypto.randomUUID();
    await createConversation(conversationId);
    await updateVisitor(conversationId, cleanName, cleanEmail);
    await updateMode(conversationId, 'human');
    await updateStatus(conversationId, 'open');

    const chatMessage = [
      cleanMessage,
      '',
      `Name: ${cleanName}`,
      `Email: ${cleanEmail}`,
      `Phone: ${cleanPhone || 'N/A'}`,
      `Company: ${cleanCompany || 'N/A'}`,
    ].join('\n');

    await addMessage(conversationId, 'user', chatMessage);
    await incrementConversationUnread(conversationId);
    await createOrUpdateVisit(conversationId, conversationId, {
      pages_visited: JSON.stringify([sourcePage]),
      message_count: 1,
      source_page: sourcePage,
      browser: 'contact-form',
    });

    const userMsg = {
      conversation_id: conversationId,
      sender: 'user',
      content: chatMessage,
      created_at: new Date().toISOString(),
    };
    io.to(conversationId).emit('chat:message', userMsg);
    io.to('admin').emit('chat:newMessage', { conversationId, message: userMsg });
    emitConversationsRefresh();
  } catch (err) {
    conversationId = null;
    console.error('[api][inquiry][chat]', err?.message || err);
  }

  try {
    const lead = await createLead({
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      company: cleanCompany,
      inquiry_message: cleanMessage,
      conversation_id: conversationId,
      source_page: sourcePage,
    });
    io.to('admin').emit('admin:newLead', lead);
    emitAnalyticsRefresh();
    return res.json({ ok: true, conversation_id: conversationId, lead_id: lead?.id || null });
  } catch (err) {
    console.error('[api][inquiry][lead]', err?.message || err);
    return res.status(500).json({ ok: false, message: 'Unable to submit inquiry at this time.' });
  }
});

// ── AI Setup (Amalgated Holdings) ──

const SYSTEM_PROMPT = `You are the helpful AI assistant for Amalgated Holdings.
Be professional, concise, and accurate.
Use only provided website/company details for contacts, addresses, and company facts.
If information is not available, say so briefly and suggest contacting the team.
When a "Lending assistant" section is included, follow it strictly and never invent rates, approvals, legal claims, or guarantees.`;

// Static company/office info (aligned with amalgatedlending.com Contact page) for AI context
const WEBSITE_KNOWLEDGE = `
- Amalgated Lending (Amalgated Lending Inc.) — personal and business loans in Davao & Mindanao.
- Address: ACI IT and Corporate Centre, Doña Carolina Uykimpang Building, Cor. JP Laurel Avenue and Iñigo Street, Bajada, Davao City 8000.
- Mobile: 09190675095 (official callback — do not use or repeat any old landline such as (082) 297 8099).
- Email: support@amalgatedlending.com.
- Website: https://amalgatedlending.com.
- Operating hours (typical): Monday–Saturday, 8:30 AM–5:30 PM (confirm by phone if unsure).
- Parent group: Amalgated Holdings — https://amalgatedholdings.com.
- Visitors can use the contact form on the website or this chat; staff may follow up by phone or email.
`;

let websiteContextCache = null;
let websiteContextCachedAt = 0;
const WEBSITE_CONTEXT_CACHE_MS = Math.max(30_000, Number(process.env.WEBSITE_CONTEXT_CACHE_MS || 180_000) || 180_000);

/** Build URL for Laravel RAG endpoint (supports base ending with /api/v1 like LARAVEL_CHAT_SYNC_URL). */
function laravelInternalRagUrl(baseRaw) {
  const base = String(baseRaw || '').trim().replace(/\/$/, '');
  if (!base) return '';
  if (base.includes('/api/v1')) {
    return `${base}/internal/chat/rag/context`;
  }
  return `${base}/api/v1/internal/chat/rag/context`;
}

/** RAG: Laravel MySQL knowledge base (POST …/internal/chat/rag/context, X-Support-Sync-Secret). */
async function fetchLaravelRagContext(userMessage) {
  const base = (
    process.env.LARAVEL_INTERNAL_API_URL
    || process.env.LARAVEL_CHAT_SYNC_URL
    || process.env.LARAVEL_API_BASE
    || ''
  )
    .trim()
    .replace(/\/$/, '');
  const secret = (process.env.LARAVEL_CHAT_SYNC_SECRET || process.env.SUPPORT_CHAT_SYNC_SECRET || '')
    .trim();
  if (!base || !secret) return '';
  if (String(process.env.CHAT_RAG_ENABLED || '1').trim() === '0') return '';
  const url = laravelInternalRagUrl(base);
  const query = String(userMessage || '').trim().slice(0, 8000);
  if (!query) return '';
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), Math.max(3000, Number(process.env.CHAT_RAG_TIMEOUT_MS || 10000) || 10000));
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Support-Sync-Secret': secret,
      },
      body: JSON.stringify({ query }),
      signal: ac.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      console.warn('[rag] http', res.status, await res.text().catch(() => ''));
      return '';
    }
    const json = await res.json().catch(() => ({}));
    return typeof json.context === 'string' ? json.context.trim() : '';
  } catch (e) {
    console.warn('[rag]', e?.message || e);
    return '';
  }
}

async function getWebsiteContext() {
  if (websiteContextCache && (Date.now() - websiteContextCachedAt) < WEBSITE_CONTEXT_CACHE_MS) {
    return websiteContextCache;
  }
  const settings = await getSiteSettings();
  const site = settings.site || {};
  const contactEmail = [site.contactEmail].flat().find(Boolean);
  const contactPhone = [site.contactPhone].flat().find(Boolean);
  const address = [site.address].flat().find(Boolean);
  const parts = [WEBSITE_KNOWLEDGE.trim()];
  if (contactEmail || contactPhone || address) {
    parts.push('Additional contact details from the website settings:');
    if (contactEmail) parts.push(`- General contact email: ${contactEmail}`);
    if (contactPhone) parts.push(`- General contact phone: ${contactPhone}`);
    if (address) parts.push(`- Address: ${address}`);
  }
  websiteContextCache = parts.join('\n');
  websiteContextCachedAt = Date.now();
  return websiteContextCache;
}

function sanitizeGroqApiKey(raw) {
  let s = String(raw || '').trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

const groqApiKey = sanitizeGroqApiKey(process.env.GROQ_API_KEY);
const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;
/** Ordered candidates — next is tried if Groq returns model invalid / decommissioned (400). @see https://console.groq.com/docs/models */
const GROQ_MODEL_CANDIDATES = [
  ...new Set(
    [(process.env.GROQ_MODEL || '').trim(), 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'].filter(Boolean),
  ),
];
const aiContexts = new Map();
const aiQueues = new Map();
const MAX_CONTEXT_MESSAGES = Number.isFinite(Number(process.env.AI_MAX_CONTEXT_MESSAGES))
  ? Math.max(6, Number(process.env.AI_MAX_CONTEXT_MESSAGES))
  : 12;
const MAX_CONTEXT_CHARS = Number.isFinite(Number(process.env.AI_MAX_CONTEXT_CHARS))
  ? Math.max(4000, Number(process.env.AI_MAX_CONTEXT_CHARS))
  : 12000;
const FAST_LENDING_FAQ_RE =
  /\b(apply|application|requirements?|documents?|rates?|interest|monthly|amort|office|address|location|hello|hi|thanks|eligib|qualified|processing time|status|payment|repay|penalty|ofw|borrower portal)\b/i;

function shouldUseFastLendingFaq(conversationId, userMessage, options = {}) {
  if (typeof conversationId !== 'string' || !conversationId.startsWith('lending-')) return false;
  const text = String(userMessage || '').trim();
  if (!text) return false;
  if (options?.forceAi === true) return false;
  return FAST_LENDING_FAQ_RE.test(text);
}

function estimateMessageChars(msg) {
  return String(msg?.content || '').length;
}

function trimContextMessages(messages) {
  if (!Array.isArray(messages) || messages.length <= 1) return messages;
  const [system, ...rest] = messages;
  let totalChars = rest.reduce((sum, m) => sum + estimateMessageChars(m), 0);
  let pruned = [...rest];
  while (pruned.length > MAX_CONTEXT_MESSAGES || totalChars > MAX_CONTEXT_CHARS) {
    const removed = pruned.shift();
    totalChars -= estimateMessageChars(removed);
  }
  return [system, ...pruned];
}

function extractGroqAssistantText(completion) {
  const msg = completion?.choices?.[0]?.message;
  if (!msg) return '';
  const c = msg.content;
  if (typeof c === 'string') return c.trim();
  if (Array.isArray(c)) {
    return c
      .map((part) => (typeof part === 'object' && part?.text ? part.text : ''))
      .join('')
      .trim();
  }
  return '';
}

function isGroqModelReplaceableError(err) {
  const status = err?.status ?? err?.response?.status;
  const msg = String(err?.message || err?.error?.message || err || '');
  if (status === 400 || status === 404) return true;
  return /model.*not found|invalid model|decommission|does not exist|has been deprecated|no longer available/i.test(msg);
}

async function groqChatCreate(messages, { stream = false } = {}) {
  let lastErr = null;
  for (const model of GROQ_MODEL_CANDIDATES) {
    try {
      const maxTok = Number(process.env.GROQ_MAX_TOKENS);
      const temp = Number(process.env.GROQ_TEMPERATURE);
      return await groq.chat.completions.create({
        model,
        messages,
        max_tokens: Number.isFinite(maxTok) && maxTok > 0 ? Math.min(2048, maxTok) : 512,
        temperature: Number.isFinite(temp) && temp >= 0 && temp <= 2 ? temp : 0.65,
        stream,
      });
    } catch (err) {
      lastErr = err;
      if (isGroqModelReplaceableError(err)) {
        console.warn('[ai] Groq model failed, trying next:', model, err?.message || err);
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error('Groq: no working model');
}

function normalizeLang(input) {
  const raw = String(input || '').toLowerCase().trim();
  if (!raw) return 'en';
  const base = raw.split(/[-_]/)[0];
  if (base === 'tl' || base === 'fil') return 'fil';
  if (['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'id', 'vi'].includes(base)) return base;
  return 'en';
}

function languageName(code) {
  switch (code) {
    case 'fil': return 'Filipino (Tagalog)';
    case 'es': return 'Spanish';
    case 'fr': return 'French';
    case 'de': return 'German';
    case 'it': return 'Italian';
    case 'pt': return 'Portuguese';
    case 'ru': return 'Russian';
    case 'ja': return 'Japanese';
    case 'ko': return 'Korean';
    case 'zh': return 'Chinese';
    case 'ar': return 'Arabic';
    case 'hi': return 'Hindi';
    case 'id': return 'Indonesian';
    case 'vi': return 'Vietnamese';
    default: return 'English';
  }
}

function t(lang, key) {
  const l = normalizeLang(lang);
  const dict = {
    en: {
      leadAsk: 'To help you with that, please share your contact details so our team can get back to you.',
      leadThanks: 'Thank you! We have your details and our team will get back to you shortly.',
      aiNotConfigured: 'AI is not configured. Please contact the team directly.',
      aiError: 'Sorry, something went wrong. Please try again.',
    },
    fil: {
      leadAsk: 'Para matulungan ka, pakibigay ang iyong contact details para makabalik sa iyo ang aming team.',
      leadThanks: 'Salamat! Nakuha na namin ang iyong details at babalikan ka ng aming team sa lalong madaling panahon.',
      aiNotConfigured: 'Hindi naka-configure ang AI. Mangyaring kontakin ang aming team.',
      aiError: 'Pasensya na, may nangyari. Pakisubukan ulit.',
    },
    es: {
      leadAsk: 'Para ayudarte mejor, comparte tus datos de contacto para que nuestro equipo pueda comunicarse contigo.',
      leadThanks: '¡Gracias! Ya tenemos tus datos y nuestro equipo se comunicará contigo pronto.',
      aiNotConfigured: 'La IA no está configurada. Por favor, contacta al equipo.',
      aiError: 'Lo siento, algo salió mal. Inténtalo de nuevo.',
    },
  };
  return (dict[l] && dict[l][key]) || dict.en[key] || '';
}

/** Only strong "get a human to follow up" phrases — broad words like "contact" or "rates" were skipping the AI entirely. */
const LEAD_CAPTURE_KEYWORDS =
  /\b(call me back|request a callback|callback please|phone me|contact me by phone|have someone call|speak to (?:a )?(?:human|person|agent)|talk to (?:a )?(?:human|person|representative)|i need (?:a )?(?:human|person|agent)|representative please|loan officer call)\b/i;
function wantsLeadCapture(message) {
  return typeof message === 'string' && LEAD_CAPTURE_KEYWORDS.test(message);
}

function parseUserAgent(ua) {
  if (!ua || typeof ua !== 'string') return { device: 'Unknown', browser: 'Unknown' };
  const isMobile = /Mobile|Android|iPhone|iPad|iPod|webOS/i.test(ua);
  let browser = 'Unknown';
  if (/Chrome\/[.\d]+/i.test(ua) && !/Edge/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\/[.\d]+/i.test(ua)) browser = 'Firefox';
  else if (/Safari\/[.\d]+/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Edge\/[.\d]+/i.test(ua)) browser = 'Edge';
  return { device: isMobile ? 'Mobile' : 'Desktop', browser };
}

function resolveLocationFromIp(visitId, ip, cb) {
  if (!ip || ip === '127.0.0.1' || ip === '::1') return cb();
  const url = `http://ip-api.com/json/${ip}?fields=city,regionName,country`;
  fetch(url)
    .then((r) => r.json())
    .then((data) => {
      if (data && (data.city || data.country)) {
        const loc = [data.city, data.regionName, data.country].filter(Boolean).join(', ');
        Promise.resolve(getVisitByVisitId(visitId))
          .then((visit) => {
            if (visit) return updateVisitLocation(visitId, loc);
          })
          .catch(() => {});
      }
    })
    .catch(() => {})
    .finally(cb);
}

function getHoldingsFallbackReply(userMessage, lang) {
  const m = String(userMessage || '').toLowerCase();
  const l = normalizeLang(lang);
  const phone = '09190675095';
  const email = 'support@amalgatedlending.com';
  const addr =
    'ACI IT and Corporate Centre, Doña Carolina Uykimpang Building, Cor. JP Laurel Avenue and Iñigo Street, Bajada, Davao City 8000';
  if (l === 'fil') {
    return `Salamat sa mensahe mo. Para sa Amalgated Holdings / Amalgated Lending, mobile ${phone}, email ${email}, o bisitahin ang amalgatedlending.com o amalgatedholdings.com.`
  }
  if (/contact|phone|email|address|office|where|location/i.test(m)) {
    return `Amalgated Lending — ${addr}. Mobile: ${phone}. Email: ${email}. Website: https://amalgatedlending.com (Holdings group: https://amalgatedholdings.com).`
  }
  return `Thanks for reaching out. Amalgated Lending: mobile ${phone}, ${email}, https://amalgatedlending.com. Amalgated Holdings group: https://amalgatedholdings.com. How can I help you today?`
}

function optimizeReplyForProfile(reply, contentProfile) {
  const text = String(reply || '').trim();
  if (!text || contentProfile !== 'lite') return text;
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= 280) return compact;
  const firstSentences = compact.match(/[^.!?]+[.!?]+/g)?.slice(0, 2).join(' ').trim();
  return (firstSentences && firstSentences.length >= 40 ? firstSentences : compact.slice(0, 280)).trim();
}

async function prepareAiContext(conversationId, userMessage, lang, options = {}) {
  const l = normalizeLang(lang);
  const fromLending =
    typeof conversationId === 'string' && conversationId.startsWith('lending-');
  const contentProfile = options?.contentProfile || 'full';
  const rawUserText = String(userMessage || '').trim().slice(0, 8000);
  const userText = contentProfile === 'lite'
    ? `${rawUserText}\n\nPlease respond briefly in at most 2 short sentences.`
    : rawUserText;

  if (!groqApiKey || !groq) {
    return {
      key: `${conversationId}:${l}`,
      lang: l,
      userText,
      fallbackReply: fromLending ? getLendingFallbackReply(userText, l) : getHoldingsFallbackReply(userText, l),
      context: null,
    };
  }

  const key = `${conversationId}:${l}`;
  if (!aiContexts.has(key)) {
    const websiteContext = await getWebsiteContext();
    const lendingBlock = fromLending
      ? `\n${LENDING_AI_APPEND}\n\n${LENDING_CUSTOMER_FAQ}\n`
      : '\n';
    aiContexts.set(key, [{
      role: 'system',
      content: `${SYSTEM_PROMPT}${lendingBlock}\nWebsite and company details:\n${websiteContext}\n\nAlways reply in ${languageName(l)}. If the user switches language, follow the latest selected language.`,
    }]);
  }
  const ctx = aiContexts.get(key);
  let userContent = userText;
  if (fromLending) {
    const rag = await fetchLaravelRagContext(rawUserText);
    if (rag) {
      userContent = `${rag}\n\n---\n\nVisitor question:\n${userText}`;
    }
  }
  ctx.push({ role: 'user', content: userContent });
  aiContexts.set(key, trimContextMessages(ctx));
  return {
    key,
    lang: l,
    userText,
    fallbackReply: fromLending ? getLendingFallbackReply(userText, l) : getHoldingsFallbackReply(userText, l),
    context: aiContexts.get(key),
  };
}

async function getAIReply(conversationId, userMessage, lang, options = {}) {
  try {
    if (shouldUseFastLendingFaq(conversationId, userMessage, options)) {
      return getLendingFallbackReply(String(userMessage || '').trim(), normalizeLang(lang));
    }
    const prep = await prepareAiContext(conversationId, userMessage, lang, options);
    if (!prep.context) return prep.fallbackReply;
    const completion = await groqChatCreate(prep.context);
    const reply = extractGroqAssistantText(completion);
    if (!reply) {
      const ctx = aiContexts.get(prep.key) || [];
      if (ctx?.length && ctx[ctx.length - 1]?.role === 'user') ctx.pop();
      return prep.fallbackReply;
    }
    const ctx = aiContexts.get(prep.key) || [];
    const optimizedReply = optimizeReplyForProfile(reply, options?.contentProfile);
    ctx.push({ role: 'assistant', content: optimizedReply });
    aiContexts.set(prep.key, trimContextMessages(ctx));
    return optimizedReply;
  } catch (err) {
    console.error('[ai]', err?.message || err);
    return (typeof conversationId === 'string' && conversationId.startsWith('lending-'))
      ? getLendingFallbackReply(String(userMessage || '').trim(), normalizeLang(lang))
      : getHoldingsFallbackReply(String(userMessage || '').trim(), normalizeLang(lang));
  }
}

async function streamAIReply(conversationId, userMessage, lang, handlers = {}, options = {}) {
  if (shouldUseFastLendingFaq(conversationId, userMessage, options)) {
    const fastReply = getLendingFallbackReply(String(userMessage || '').trim(), normalizeLang(lang));
    handlers.onChunk?.(fastReply);
    handlers.onComplete?.(fastReply);
    return fastReply;
  }
  const prep = await prepareAiContext(conversationId, userMessage, lang, options);
  if (!prep.context) {
    handlers.onChunk?.(prep.fallbackReply);
    handlers.onComplete?.(prep.fallbackReply);
    return prep.fallbackReply;
  }
  let aggregated = '';
  try {
    const stream = await groqChatCreate(prep.context, { stream: true });
    const emitChunks = options?.contentProfile !== 'lite';
    for await (const part of stream) {
      const delta = String(part?.choices?.[0]?.delta?.content || '');
      if (!delta) continue;
      aggregated += delta;
      if (emitChunks) handlers.onChunk?.(delta);
    }
    const finalText = optimizeReplyForProfile(aggregated.trim(), options?.contentProfile);
    if (!finalText) {
      const ctx = aiContexts.get(prep.key) || [];
      if (ctx?.length && ctx[ctx.length - 1]?.role === 'user') ctx.pop();
      handlers.onChunk?.(prep.fallbackReply);
      handlers.onComplete?.(prep.fallbackReply);
      return prep.fallbackReply;
    }
    const ctx = aiContexts.get(prep.key) || [];
    ctx.push({ role: 'assistant', content: finalText });
    aiContexts.set(prep.key, trimContextMessages(ctx));
    handlers.onComplete?.(finalText);
    return finalText;
  } catch (err) {
    console.error('[ai][stream]', err?.message || err);
    handlers.onChunk?.(prep.fallbackReply);
    handlers.onComplete?.(prep.fallbackReply);
    return prep.fallbackReply;
  }
}

function enqueueAiTask(conversationId, task) {
  const previous = aiQueues.get(conversationId) || Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(task)
    .catch((err) => {
      console.error('[ai][queue]', err?.message || err);
    });
  aiQueues.set(conversationId, next);
  return next;
}

// ── Partnerships (Partner With Us form) ──

app.post('/api/partnerships', limitPublicChat, async (req, res) => {
  const { full_name, company, email, phone, partnership_type, message } = req.body || {};
  if (!full_name?.trim() || !email?.trim()) {
    return res.status(400).json({ ok: false, message: 'Full name and email are required.' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({ ok: false, message: 'Please enter a valid email address.' });
  }
  try {
    const row = await createPartnership({
      full_name: full_name.trim(),
      company: company?.trim() || null,
      email: email.trim(),
      phone: phone?.trim() || null,
      partnership_type: partnership_type?.trim() || null,
      message: message?.trim() || null,
    });
    if (!row) {
      return res.status(500).json({ ok: false, message: 'Unable to submit at this time.' });
    }
    io.to('admin').emit('partnerships:refresh');
    return res.json({ ok: true });
  } catch (err) {
    console.error('[api][partnerships]', err?.message || err);
    return res.status(500).json({ ok: false, message: 'Unable to submit at this time.' });
  }
});

// ── Customer Feedback (DB-backed) ──

app.post('/api/feedback', limitPublicChat, async (req, res) => {
  const { conversationId, rating, name, email, subject, comment } = req.body || {};
  const numRating = Number(rating);
  if (!Number.isFinite(numRating) || numRating <= 0 || !comment?.trim()) {
    return res.status(400).json({ ok: false, message: 'Rating and comment are required.' });
  }
  try {
    const normalizedSubject = String(subject || '').trim().slice(0, 191) || null;
    await createFeedback({
      id: crypto.randomUUID(),
      conversationId: conversationId || null,
      rating: numRating,
      name: (name || '').trim() || 'Anonymous',
      email: (email || '').trim() || null,
      subject: normalizedSubject,
      comment: comment.trim(),
    });
    io.to('admin').emit('feedback:refresh');
    syncOutboundFeedback({
      sessionId: conversationId || '',
      rating: numRating,
      subject: normalizedSubject,
      name: (name || '').trim() || null,
      email: (email || '').trim() || null,
      comment: comment.trim(),
    }).catch(() => {});
    return res.json({ ok: true });
  } catch (err) {
    console.error('[api][feedback]', err?.message || err);
    return res.status(500).json({ ok: false, message: 'Unable to submit feedback at this time.' });
  }
});

// ── Admin Authentication ──

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const lendingAdminSecret = String(process.env.LENDING_ADMIN_API_SECRET || '').trim();

function normalizeLaravelMeUrl(value) {
  const raw = String(value || '').trim().replace(/\/$/, '');
  if (!raw) return '';
  if (/\/api\/v1\/admin\/me$/i.test(raw)) return raw;
  if (/\/api\/v1$/i.test(raw)) return `${raw}/admin/me`;
  if (/\/api$/i.test(raw)) return `${raw}/v1/admin/me`;
  return `${raw}/api/v1/admin/me`;
}

function getLaravelAdminVerifyCandidates() {
  const candidates = [];
  const add = (value) => {
    const normalized = normalizeLaravelMeUrl(value);
    if (!normalized || candidates.includes(normalized)) return;
    candidates.push(normalized);
  };

  add(process.env.LENDING_LARAVEL_ADMIN_ME_URL);
  add(process.env.LENDING_API_URL);
  add(process.env.LENDING_API_BASE_URL);
  add(process.env.LENDING_API_VERIFY_URL);

  // Local dev first, then production API host.
  add('http://127.0.0.1:8001');
  add('https://api.amalgatedlending.com');

  return candidates;
}

async function resolveLaravelAdminFromToken(token) {
  const bearer = String(token || '').trim();
  if (!bearer) return null;

  for (const url of getLaravelAdminVerifyCandidates()) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${bearer}`,
        },
      });

      if (!res.ok) {
        continue;
      }

      const data = await res.json().catch(() => null);
      const user = data?.user;
      if (!user || typeof user !== 'object') {
        continue;
      }

      const permissions = Array.isArray(user.permissions)
        ? user.permissions.map((permission) => String(permission?.slug || '').trim()).filter(Boolean)
        : [];

      return {
        id: user.id ?? null,
        username: String(user.username || user.email || user.name || 'lending_admin').trim(),
        role: String(user.role || 'admin').trim() || 'admin',
        permissions,
      };
    } catch {
      // Try the next configured Laravel API host.
    }
  }

  return null;
}

function getClientIp(req) {
  return req?.clientMeta?.ip
    || extractClientIpFromHeaders(req?.headers, req?.ip || req?.socket?.remoteAddress || '');
}

const ALL_PERMISSIONS = [
  'view_dashboard',
  'manage_users',
  'manage_settings',
  'manage_tickets',
  'manage_partnerships',
  'manage_applications',
  'manage_companies',
  'manage_operations',
  'edit_content',
  'create_user',
  'edit_user',
  'delete_user',
  'view_users',
  'manage_roles',
  'view_reports',
];

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  try {
    req.admin = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ ok: false, message: 'Token expired or invalid' });
  }
}

/** Accepts Node JWT, Laravel admin JWT, or LENDING_ADMIN_API_SECRET. */
async function requireAdminOrLendingSecret(req, res, next) {
  const secret = process.env.LENDING_ADMIN_API_SECRET;
  const auth = req.headers.authorization;
  if (secret && auth?.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token === secret) {
      req.admin = {
        username: 'lending_admin',
        role: 'staff',
        permissions: ['manage_tickets', 'view_dashboard'],
      };
      return next();
    }

    const laravelAdmin = await resolveLaravelAdminFromToken(token);
    if (laravelAdmin) {
      req.admin = laravelAdmin;
      return next();
    }
  }
  return requireAdmin(req, res, next);
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.admin) return res.status(401).json({ ok: false, message: 'Unauthorized' });
    if (req.admin.role === 'super_admin') return next();
    if (req.admin.role === 'admin' && !Array.isArray(req.admin.permissions)) return next();
    const perms = req.admin.permissions || [];
    if (perms.includes(permission)) return next();
    res.status(403).json({ ok: false, message: 'Forbidden. You do not have permission.' });
  };
}

function requirePermissionAny(...permissions) {
  return (req, res, next) => {
    if (!req.admin) return res.status(401).json({ ok: false, message: 'Unauthorized' });
    if (req.admin.role === 'super_admin') return next();
    if (req.admin.role === 'admin' && !Array.isArray(req.admin.permissions)) return next();
    const perms = req.admin.permissions || [];
    if (permissions.some((p) => perms.includes(p))) return next();
    res.status(403).json({ ok: false, message: 'Forbidden. You do not have permission.' });
  };
}

app.post('/api/admin/login', limitAdminLogin, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ ok: false, message: 'Username and password are required.' });
  }
  const loginUser = String(username).trim().toLowerCase();
  const primaryAdmin = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();

  if (loginUser === primaryAdmin) {
    let adminHash = process.env.ADMIN_PASSWORD_HASH;
    try {
      const siteSettings = await getSiteSettings();
      if (siteSettings.admin_password_hash_override) adminHash = siteSettings.admin_password_hash_override;
    } catch {
      /* use env hash only */
    }
    if (!adminHash) return res.status(500).json({ ok: false, message: 'Admin auth not configured.' });
    const valid = await bcrypt.compare(password, adminHash);
    if (!valid) return res.status(401).json({ ok: false, message: 'Invalid credentials.' });
    const token = jwt.sign(
      { username: process.env.ADMIN_USERNAME || 'admin', role: 'super_admin', permissions: ALL_PERMISSIONS },
      JWT_SECRET,
      { expiresIn: '24h' },
    );
    logActivity({ action: 'login', adminUsername: process.env.ADMIN_USERNAME, ipAddress: getClientIp(req), details: 'Admin login successful' }).catch(() => {});
    return res.json({ ok: true, token, admin: { username: process.env.ADMIN_USERNAME, role: 'super_admin', permissions: ALL_PERMISSIONS } });
  }

  const staffUser = await getAdminUserByEmail(loginUser);
  if (staffUser?.password_hash) {
    const valid = await bcrypt.compare(password, staffUser.password_hash);
    if (valid) {
      let permissions = [];
      try {
        permissions = await getPermissionsForRole(staffUser.role || 'staff');
      } catch {
        permissions = [];
      }
      const token = jwt.sign(
        { username: staffUser.email, role: staffUser.role || 'staff', permissions },
        JWT_SECRET,
        { expiresIn: '24h' },
      );
      logActivity({ action: 'login', adminUsername: staffUser.email, ipAddress: getClientIp(req), details: 'Staff login successful' }).catch(() => {});
      return res.json({ ok: true, token, admin: { username: staffUser.email, role: staffUser.role, permissions } });
    }
  }

  const appUser = await getAppUserByLogin(loginUser);
  if (appUser?.password_hash) {
    const valid = await bcrypt.compare(password, appUser.password_hash);
    if (valid) {
      let roleName = 'staff';
      let permissions = [];
      try {
        const role = await getAppRoleById(appUser.roleId);
        if (role) {
          roleName = role.name;
          permissions = Object.keys(role.permissions || {}).filter((k) => role.permissions[k]);
        }
      } catch {
        /* use defaults */
      }
      const token = jwt.sign(
        { username: appUser.username, role: roleName, permissions },
        JWT_SECRET,
        { expiresIn: '24h' },
      );
      logActivity({ action: 'login', adminUsername: appUser.username, ipAddress: getClientIp(req), details: 'App user login successful' }).catch(() => {});
      return res.json({ ok: true, token, admin: { username: appUser.username, role: roleName, permissions } });
    }
  }

  return res.status(401).json({ ok: false, message: 'Invalid credentials.' });
});

app.get('/api/admin/verify', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ ok: false });
  try {
    const decoded = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    res.json({ ok: true, admin: { username: decoded.username, role: decoded.role, permissions: decoded.permissions || [] } });
  } catch {
    res.status(401).json({ ok: false });
  }
});

// ── Admin: Feedback ──

app.get('/api/admin/feedback', requireAdminOrLendingSecret, requirePermissionAny('manage_tickets', 'view_dashboard'), async (_req, res) => {
  res.json(await getFeedback());
});

// ── Admin: Stats ──
app.get('/api/admin/stats', requireAdminOrLendingSecret, requirePermission('view_dashboard'), async (_req, res) => {
  const stats = await getAdminStats();
  const feedbackUnread = await countUnreadFeedback();
  const unreadChat = Number(stats.unreadChat) || 0;
  const unreadTickets = Number(stats.unreadTickets) || 0;
  const feedbackCount = Number(feedbackUnread) || 0;
  const notifications = unreadChat + unreadTickets + feedbackCount;
  const recentOpenChatTickets = await getRecentOpenChatTickets(5);
  res.json({
    ok: true,
    stats: {
      ...stats,
      unreadChat,
      unreadTickets,
      feedbackUnread: feedbackCount,
      notifications,
    },
    recentOpenChatTickets,
  });
});

app.delete('/api/admin/feedback/:id', requireAdminOrLendingSecret, requirePermissionAny('manage_tickets', 'view_dashboard'), async (req, res) => {
  await deleteFeedback(req.params.id);
  io.to('admin').emit('feedback:refresh');
  res.json({ ok: true });
});

// ── Admin: Partnerships ──

app.get('/api/admin/partnerships', requireAdmin, requirePermission('manage_partnerships'), async (req, res) => {
  const search = req.query.search || '';
  const list = await getPartnerships({ search });
  res.json({ ok: true, partnerships: list });
});

app.delete('/api/admin/partnerships/:id', requireAdmin, requirePermission('manage_partnerships'), async (req, res) => {
  await deletePartnership(req.params.id);
  io.to('admin').emit('partnerships:refresh');
  res.json({ ok: true });
});

app.patch('/api/admin/partnerships/:id', requireAdmin, requirePermission('manage_partnerships'), async (req, res) => {
  const { status } = req.body || {};
  const updated = await updatePartnership(req.params.id, { status });
  if (!updated) return res.status(400).json({ ok: false, message: 'Invalid status or not found' });
  io.to('admin').emit('partnerships:refresh');
  res.json({ ok: true, partnership: updated });
});

app.post('/api/admin/partnerships/:id/email', requireAdmin, requirePermission('manage_partnerships'), async (req, res) => {
  const { subject, message } = req.body || {};
  if (!subject?.trim() || !message?.trim()) {
    return res.status(400).json({ ok: false, message: 'Subject and message are required.' });
  }
  const list = await getPartnerships({});
  const p = list.find((x) => String(x.id) === String(req.params.id));
  if (!p || !p.email) return res.status(404).json({ ok: false, message: 'Partnership not found' });
  if (!isEmailConfigured()) {
    return res.status(400).json({ ok: false, message: 'No email provider configured.' });
  }
  try {
    const html = message.replace(/\n/g, '<br>');
    await sendCustomEmail({
      to: p.email,
      subject: subject.trim(),
      html: `<!DOCTYPE html><html><body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">${html}</body></html>`,
      text: message,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[api] partnerships/email', err?.message);
    res.status(500).json({ ok: false, message: err?.message || 'Failed to send email' });
  }
});

// ── Admin: Bulk actions ──

app.post('/api/admin/bulk', requireAdminOrLendingSecret, async (req, res) => {
  const { resource, action, ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ ok: false, message: 'ids required' });
  if (!['conversations', 'feedback', 'tickets'].includes(resource)) return res.status(400).json({ ok: false, message: 'invalid resource' });
  if (!['delete', 'markRead', 'markUnread'].includes(action)) return res.status(400).json({ ok: false, message: 'invalid action' });

  if (resource === 'conversations') {
    for (const id of ids) {
      if (action === 'delete') await deleteConversation(id);
      if (action === 'markRead') await clearConversationUnread(id);
      if (action === 'markUnread') await incrementConversationUnread(id);
    }
    emitConversationsRefresh();
    return res.json({ ok: true });
  }

  if (resource === 'tickets') {
    for (const id of ids) {
      const num = Number(id);
      if (!Number.isFinite(num)) return;
      if (action === 'delete') {
        await deleteTicket(num);
        logActivity({ action: 'ticket_deleted', adminUsername: req.admin?.username, ipAddress: getClientIp(req), details: `Chat ticket #${num} deleted` }).catch(() => {});
      }
      if (action === 'markRead') await setTicketUnread(num, false);
      if (action === 'markUnread') await setTicketUnread(num, true);
    }
    io.to('admin').emit('tickets:refresh');
    return res.json({ ok: true });
  }

  if (action === 'delete') {
    for (const id of ids) await deleteFeedback(id);
    io.to('admin').emit('feedback:refresh');
    return res.json({ ok: true });
  }
  if (action === 'markRead') {
    await markFeedbackRead(ids, true);
    io.to('admin').emit('feedback:refresh');
    return res.json({ ok: true });
  }
  if (action === 'markUnread') {
    await markFeedbackRead(ids, false);
    io.to('admin').emit('feedback:refresh');
    return res.json({ ok: true });
  }
  return res.json({ ok: true });
});

// ── Admin: Conversations ──

// ── Admin: Website Settings (legacy) ──
app.get('/api/admin/settings', requireAdmin, requirePermission('manage_settings'), async (_req, res) => {
  const settings = await getSiteSettings();
  res.json({ ok: true, settings: settings.site || {} });
});

app.put('/api/admin/settings', requireAdmin, requirePermission('manage_settings'), async (req, res) => {
  const { settings } = req.body || {};
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ ok: false, message: 'settings object required' });
  }
  const next = await setSiteSettings({ site: settings });
  logActivity({ action: 'settings_updated', adminUsername: req.admin?.username, ipAddress: getClientIp(req), details: 'Website settings updated' }).catch(() => {});
  io.to('admin').emit('settings:updated');
  res.json({ ok: true, settings: next.site || {} });
});

// ── Public settings (no auth) – partnership types, chat config for frontend
app.get('/api/public/settings', async (req, res) => {
  try {
    const { flat } = await getSettings();
    const profile = req.clientMeta || {};
    const isLite = profile.contentProfile === 'lite';
    res.json({
      ok: true,
      partnership_types: Array.isArray(flat?.partnership_types) ? flat.partnership_types : ['Real Estate', 'Retail & Distribution', 'Financial Services', 'LPG Operations', 'IT & Technology', 'Other'],
      chat_enabled: flat?.chat_enabled !== false,
      chat_availability: flat?.chat_availability || 'online',
      chat_auto_reply: isLite
        ? String(flat?.chat_auto_reply || '').replace(/\s+/g, ' ').trim().slice(0, 240)
        : (flat?.chat_auto_reply || ''),
      chat_working_hours: flat?.chat_working_hours || '',
      delivery_profile: {
        routing_tier: profile.routingTier || 'edge-standard',
        content_profile: profile.contentProfile || 'full',
        cache_hint: profile.cacheHint || 'normal',
      },
    });
  } catch (err) {
    console.error('[api][public][settings]', err?.message || err);
    res.status(500).json({ ok: false });
  }
});

// ── Admin: Dynamic Settings (new) ──
app.get('/api/settings', requireAdmin, requirePermission('manage_settings'), async (_req, res) => {
  const { grouped, flat } = await getSettings();
  res.json({ ok: true, settings: grouped, flat });
});

app.post('/api/settings', requireAdmin, requirePermission('manage_settings'), async (req, res) => {
  const input = req.body?.settings ?? req.body;
  if (!input || typeof input !== 'object') {
    return res.status(400).json({ ok: false, message: 'settings must be an object' });
  }
  const { grouped, flat } = await setSettings(input);
  logActivity({ action: 'settings_updated', adminUsername: req.admin?.username, ipAddress: getClientIp(req), details: 'System settings updated' }).catch(() => {});
  io.to('admin').emit('settings:updated');
  io.emit('public:settings'); // notify all (including ChatWidget) for chat_enabled etc.
  res.json({ ok: true, settings: grouped, flat });
});

// ── Admin: Profile (change password) ──
app.post('/api/admin/profile/password', requireAdmin, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ ok: false, message: 'Current password and new password (min 6 chars) required.' });
  }
  const adminHash = process.env.ADMIN_PASSWORD_HASH;
  const valid = await bcrypt.compare(currentPassword, adminHash);
  if (!valid) {
    return res.status(400).json({ ok: false, message: 'Current password is incorrect.' });
  }
  const hash = await bcrypt.hash(newPassword, 10);
  // Persist to site_settings for override (login checks this first)
  await setSiteSettings({ admin_password_hash_override: hash }).catch(() => {});
  logActivity({ action: 'password_changed', adminUsername: req.admin?.username, ipAddress: getClientIp(req), details: 'Admin password changed' }).catch(() => {});
  res.json({ ok: true, message: 'Password changed successfully.' });
});

// ── Admin: Roles (dynamic, from DB) ──
const requireManageRoles = requirePermissionAny('manage_users', 'manage_roles');
const requireViewUsers = requirePermissionAny('manage_users', 'view_users');
const requireCreateUser = requirePermissionAny('manage_users', 'create_user');
const requireEditUser = requirePermissionAny('manage_users', 'edit_user');
const requireDeleteUser = requirePermissionAny('manage_users', 'delete_user');

app.get('/api/admin/roles', requireAdmin, requireManageRoles, async (_req, res) => {
  const roles = await getRolesWithPermissions();
  res.json(roles);
});

app.post('/api/admin/roles', requireAdmin, requireManageRoles, async (req, res) => {
  try {
    const { name, description } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const role = await createRole({ name: name.trim(), description: description?.trim() || null });
    res.status(201).json(role);
  } catch (e) {
    if (e?.code === 'ER_DUP_ENTRY' || e?.message?.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Role name already exists' });
    }
    console.error('[api][admin/roles]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to create role' });
  }
});

app.put('/api/admin/roles/:id', requireAdmin, requireManageRoles, async (req, res) => {
  try {
    const { name, description } = req.body || {};
    const role = await updateRole(Number(req.params.id), { name: name?.trim(), description: description?.trim() });
    if (!role) return res.status(404).json({ error: 'Role not found' });
    res.json(role);
  } catch (e) {
    if (e?.code === 'ER_DUP_ENTRY' || e?.message?.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Role name already exists' });
    }
    console.error('[api][admin/roles]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to update role' });
  }
});

app.delete('/api/admin/roles/:id', requireAdmin, requireManageRoles, async (req, res) => {
  try {
    const result = await deleteRole(Number(req.params.id));
    if (!result.deleted) return res.status(400).json({ error: result.error || 'Cannot delete role' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[api][admin/roles]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to delete role' });
  }
});

app.get('/api/admin/permissions', requireAdmin, requireManageRoles, async (_req, res) => {
  const permissions = await getPermissions();
  const rolePermissions = await getRolePermissions();
  res.json({ ok: true, permissions, rolePermissions });
});

app.post('/api/admin/permissions', requireAdmin, requireManageRoles, async (req, res) => {
  try {
    const { name, description } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const perm = await createPermission({ name: name.trim(), description: description?.trim() || null });
    res.status(201).json(perm);
  } catch (e) {
    if (e?.code === 'ER_DUP_ENTRY' || e?.message?.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Permission name already exists' });
    }
    console.error('[api][admin/permissions]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to create permission' });
  }
});

app.post('/api/admin/roles/:id/permissions', requireAdmin, requireManageRoles, async (req, res) => {
  try {
    const roleId = Number(req.params.id);
    const { permissionIds } = req.body || {};
    const role = await getRoleById(roleId);
    if (!role) return res.status(404).json({ error: 'Role not found' });
    await assignRolePermissions(roleId, Array.isArray(permissionIds) ? permissionIds : []);
    const updated = await getRoleById(roleId);
    const permIds = await getPermissionIdsForRole(roleId);
    res.json({ ...updated, permissionIds: permIds });
  } catch (e) {
    console.error('[api][admin/roles/:id/permissions]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to assign permissions' });
  }
});

app.put('/api/admin/users/:id/role', requireAdmin, requireEditUser, async (req, res) => {
  const id = Number(req.params.id);
  const { roleId } = req.body || {};
  if (!Number.isFinite(id) || !Number.isFinite(Number(roleId))) {
    return res.status(400).json({ ok: false, message: 'Invalid user or roleId.' });
  }
  const user = await updateAdminUserRole(id, Number(roleId));
  if (!user) return res.status(404).json({ ok: false, message: 'User not found' });
  logActivity({ action: 'admin_role_updated', adminUsername: req.admin?.username, ipAddress: getClientIp(req), details: `User ${user.email} → role ${roleId}` }).catch(() => {});
  res.json({ ok: true, user: { ...user, username: user.email } });
});

// ── Roles & Users API (User Management – dynamic, no hardcoding) ──
app.get('/api/roles', requireAdmin, requireManageRoles, async (_req, res) => {
  try {
    const roles = await getAppRoles();
    res.json(roles);
  } catch (e) {
    console.error('[api][roles]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to load roles' });
  }
});

app.post('/api/roles', requireAdmin, requireManageRoles, async (req, res) => {
  try {
    const { name, permissions } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const role = await createAppRole({ name: name.trim(), permissions: permissions || {} });
    res.status(201).json(role);
  } catch (e) {
    if (e?.message?.includes('UNIQUE') || e?.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Role name already exists' });
    }
    console.error('[api][roles]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to create role' });
  }
});

app.put('/api/roles/:id', requireAdmin, requireManageRoles, async (req, res) => {
  try {
    const { name, permissions } = req.body || {};
    const role = await updateAppRole(req.params.id, { name: name?.trim(), permissions });
    if (!role) return res.status(404).json({ error: 'Role not found' });
    res.json(role);
  } catch (e) {
    console.error('[api][roles]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to update role' });
  }
});

app.delete('/api/roles/:id', requireAdmin, requireManageRoles, async (req, res) => {
  try {
    const result = await deleteAppRole(req.params.id);
    if (!result.deleted) {
      return res.status(400).json({ error: result.error || 'Cannot delete role' });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[api][roles]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to delete role' });
  }
});

app.get('/api/users', requireAdmin, requirePermission('manage_users'), async (_req, res) => {
  try {
    const users = await getAppUsers();
    res.json(users);
  } catch (e) {
    console.error('[api][users]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to load users' });
  }
});

app.post('/api/users', requireAdmin, requireCreateUser, async (req, res) => {
  try {
    const { name, username, email, password, roleId } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!username?.trim()) return res.status(400).json({ error: 'Username is required' });
    if (!email?.trim()) return res.status(400).json({ error: 'Email is required' });
    if (!password) return res.status(400).json({ error: 'Password is required' });
    if (!roleId) return res.status(400).json({ error: 'roleId is required' });
    if (name.trim().length < 2) return res.status(400).json({ error: 'Name must be at least 2 characters' });
    if (username.trim().length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const existing = await getAppUserByUsername(username);
    if (existing) return res.status(400).json({ error: 'Username already taken' });
    const hash = await bcrypt.hash(password, 10);
    const user = await createAppUser({
      name: name.trim(),
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      password_hash: hash,
      role_id: roleId,
    });
    logActivity({ action: 'app_user_created', adminUsername: req.admin?.username, ipAddress: getClientIp(req), details: `User: ${username}` }).catch(() => {});
    res.status(201).json(user);
  } catch (e) {
    if (e?.message?.includes('UNIQUE') || e?.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Username or email already taken' });
    }
    console.error('[api][users]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Failed to create user' });
  }
});

// ── Admin: User Management (legacy admin_users table) ──
app.get('/api/admin/users', requireAdmin, requireViewUsers, async (_req, res) => {
  const rows = await getAdminUsers();
  const users = rows.map((u) => ({ ...u, username: u.email }));
  const primaryAdmin = process.env.ADMIN_USERNAME || 'admin';
  const primaryAdminEmail = process.env.PRIMARY_ADMIN_EMAIL || process.env.ADMIN_EMAIL || primaryAdmin;
  res.json({ ok: true, users, primaryAdmin, primaryAdminEmail });
});

app.post('/api/admin/users', requireAdmin, requireCreateUser, async (req, res) => {
  try {
    const { name, username, roleId, password } = req.body || {};
    const login = (username || req.body?.email || '').trim().toLowerCase();
    const primaryAdmin = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
    if (!name?.trim() || !login || !password) {
      return res.status(400).json({ ok: false, message: 'Name, username, and password required.' });
    }
    if (!roleId) return res.status(400).json({ ok: false, message: 'Role is required.' });
    if (name.trim().length < 2) {
      return res.status(400).json({ ok: false, message: 'Name must be at least 2 characters.' });
    }
    if (login.length < 3 || login.length > 30) {
      return res.status(400).json({ ok: false, message: 'Username must be 3–30 characters.' });
    }
    if (!/^[a-z0-9_]+$/.test(login)) {
      return res.status(400).json({ ok: false, message: 'Username: letters, numbers, underscores only (no spaces).' });
    }
    if (login === primaryAdmin) {
      return res.status(400).json({ ok: false, message: 'Username cannot match primary admin.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ ok: false, message: 'Password must be at least 6 characters.' });
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await createAdminUser({ name: name.trim(), email: login, role_id: Number(roleId), password_hash: hash });
    logActivity({ action: 'admin_user_created', adminUsername: req.admin?.username, ipAddress: getClientIp(req), details: `Admin user: ${login}` }).catch(() => {});
    res.status(201).json({ ok: true, user: { ...user, username: user?.email } });
  } catch (e) {
    if (e?.code === 'ER_DUP_ENTRY' || e?.message?.includes('UNIQUE') || e?.message?.includes('unique')) {
      return res.status(400).json({ ok: false, message: 'Username already taken.' });
    }
    console.error('[api][admin/users]', e?.message || e);
    res.status(500).json({ ok: false, message: e?.message || 'Unable to create user.' });
  }
});

app.delete('/api/admin/users/:id', requireAdmin, requireDeleteUser, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ ok: false });
  await deleteAdminUser(id);
  logActivity({ action: 'admin_user_deleted', adminUsername: req.admin?.username, ipAddress: getClientIp(req), details: `Admin user ID ${id}` }).catch(() => {});
  res.json({ ok: true });
});

// ── Admin: Backup ──
app.post('/api/admin/backup', requireAdmin, async (_req, res) => {
  logActivity({ action: 'backup_requested', adminUsername: _req.admin?.username, ipAddress: getClientIp(_req), details: 'Backup triggered' }).catch(() => {});
  res.json({ ok: true, message: 'Backup requested. Use your database tool (phpMyAdmin, mysqldump) for full backup.' });
});

// ── Admin: Activity Logs ──
app.get('/api/admin/activity-logs', requireAdmin, requirePermission('manage_settings'), async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const logs = await getActivityLogs(limit);
    res.json({ ok: true, logs: logs || [] });
  } catch (err) {
    console.error('[api][activity-logs]', err?.message || err);
    res.status(500).json({ ok: false, message: 'Failed to load activity logs', logs: [] });
  }
});

app.get('/api/admin/conversations', requireAdminOrLendingSecret, requirePermission('manage_tickets'), async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 1000);
  const includeArchived = ['1', 'true', 'yes'].includes(String(req.query.archived || '').toLowerCase().trim());
  res.json(await getAllConversations({ limit, includeArchived }));
});

app.get('/api/admin/conversations/archived', requireAdminOrLendingSecret, requirePermission('manage_tickets'), async (_req, res) => {
  res.json(await getArchivedConversations());
});

app.get('/api/admin/conversations/:id/messages', requireAdminOrLendingSecret, requirePermission('manage_tickets'), async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 150, 1), 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const afterId = Math.max(Number(req.query.after_id) || 0, 0);
  await clearConversationUnread(req.params.id);
  const messages = await getMessages(req.params.id, { limit, offset, afterId });
  res.json(messages);
});

app.patch('/api/admin/conversations/:id/status', requireAdminOrLendingSecret, requirePermission('manage_tickets'), async (req, res) => {
  const { status } = req.body;
  if (!['open', 'in_progress', 'resolved'].includes(status)) {
    return res.status(400).json({ ok: false });
  }
  await updateStatus(req.params.id, status);
  io.to('admin').emit('conversation:updated', await getConversation(req.params.id));
  io.to(req.params.id).emit('conversation:statusChanged', { status });
  res.json({ ok: true });
});

app.patch('/api/admin/conversations/:id/mode', requireAdminOrLendingSecret, requirePermission('manage_tickets'), async (req, res) => {
  const { mode, ai_enabled } = req.body;
  const targetMode = mode === 'human' || ai_enabled === false ? 'human' : 'ai';
  await updateMode(req.params.id, targetMode);
  const convo = await getConversation(req.params.id);
  io.to('admin').emit('conversation:updated', convo);
  io.to(req.params.id).emit('conversation:modeChanged', { conversationId: req.params.id, mode: targetMode });
  res.json({ ok: true, mode: targetMode, ai_enabled: targetMode === 'ai' });
});

app.patch('/api/admin/conversations/:id/archive', requireAdminOrLendingSecret, requirePermission('manage_tickets'), async (req, res) => {
  await archiveConversation(req.params.id);
  emitConversationsRefresh();
  io.to(req.params.id).emit('conversation:statusChanged', { status: 'archived' });
  res.json({ ok: true });
});

app.delete('/api/admin/conversations/:id', requireAdminOrLendingSecret, requirePermission('manage_tickets'), async (req, res) => {
  await deleteConversation(req.params.id);
  emitConversationsRefresh();
  res.json({ ok: true });
});

// ── Admin: Leads ──

app.get('/api/admin/leads', requireAdminOrLendingSecret, requirePermission('manage_tickets'), async (req, res) => {
  const { status, search } = req.query;
  res.json(await getLeads({ status: status || undefined, search: search || undefined }));
});

app.get('/api/admin/leads/export', requireAdminOrLendingSecret, requirePermission('manage_tickets'), async (req, res) => {
  const { format, status, search } = req.query;
  const leads = await getLeads({ status: status || undefined, search: search || undefined });
  if (format === 'csv') {
    const header = 'Name,Email,Phone,Company,Inquiry Message,Conversation ID,Source Page,Status,Created At\n';
    const escape = (v) => (v != null ? String(v).replace(/"/g, '""') : '');
    const rows = leads
      .map((l) =>
        [l.name, l.email, l.phone, l.company, l.inquiry_message, l.conversation_id, l.source_page, l.status, l.created_at]
          .map((c) => `"${escape(c)}"`)
          .join(',')
      )
      .join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
    return res.send(header + rows);
  }
  res.json(leads);
});

app.patch('/api/admin/leads/:id', requireAdminOrLendingSecret, requirePermission('manage_tickets'), async (req, res) => {
  const { id } = req.params;
  const { status, name, email, phone, company, inquiry_message } = req.body || {};
  const lead = await getLeadById(Number(id));
  if (!lead) return res.status(404).json({ ok: false, message: 'Lead not found' });
  if (status !== undefined) {
    await updateLeadStatus(Number(id), status);
  } else if (name !== undefined || email !== undefined || phone !== undefined || company !== undefined || inquiry_message !== undefined) {
    await updateLead(Number(id), { name, email, phone, company, inquiry_message, status: lead.status });
  }
  io.to('admin').emit('leads:refresh');
  res.json(await getLeadById(Number(id)));
});

app.post('/api/admin/leads/:id/email', requireAdminOrLendingSecret, requirePermission('manage_tickets'), async (req, res) => {
  const { subject, body } = req.body || {};
  if (!subject?.trim() || !body?.trim()) {
    return res.status(400).json({ ok: false, message: 'Subject and message are required.' });
  }
  const lead = await getLeadById(Number(req.params.id));
  if (!lead || !lead.email) return res.status(404).json({ ok: false, message: 'Lead not found' });
  if (!isEmailConfigured()) {
    return res.status(400).json({ ok: false, message: 'No email provider configured.' });
  }
  try {
    const text = String(body || '');
    const htmlBody = text.replace(/\n/g, '<br>');
    await sendCustomEmail({
      to: lead.email,
      subject: String(subject).trim(),
      html: `<!DOCTYPE html><html><body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">${htmlBody}</body></html>`,
      text,
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[api] leads/email', err?.message || err);
    return res.status(500).json({ ok: false, message: err?.message || 'Failed to send email.' });
  }
});

// ── Admin: Subscribers (Careers & News) ──

app.get('/api/admin/subscribers', requireAdmin, async (req, res) => {
  const { subscription_type, search } = req.query;
  const list = await getSubscribers({
    subscription_type: subscription_type || undefined,
    search: search || undefined,
  });
  const total = await countSubscribers();
  res.json({ ok: true, subscribers: list, total });
});

app.get('/api/admin/subscribers/export', requireAdmin, async (req, res) => {
  const { subscription_type } = req.query;
  const list = await getSubscribers({ subscription_type: subscription_type || undefined });
  const header = 'Email,Subscription Type,Created At\n';
  const escape = (v) => (v != null ? String(v).replace(/"/g, '""') : '');
  const rows = list
    .map((s) => [s.email, s.subscription_type, s.created_at].map((c) => `"${escape(c)}"`).join(','))
    .join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=subscribers.csv');
  res.send(header + rows);
});

app.delete('/api/admin/subscribers/:id', requireAdmin, async (req, res) => {
  const ok = await deleteSubscriber(Number(req.params.id));
  if (!ok) return res.status(404).json({ ok: false });
  res.json({ ok: true });
});

// ── Admin: Email status & test send ──

app.get('/api/admin/email/status', requireAdmin, (_req, res) => {
  const key = (process.env.BREVO_API_KEY || '').trim()
  const smtp = (process.env.SMTP_HOST || '').trim()
  const provider = key ? 'brevo-api'
    : (process.env.MAILERSEND_API_KEY || '').trim() ? 'mailersend'
    : (process.env.RESEND_API_KEY || '').trim() ? 'resend'
    : smtp ? 'smtp'
    : null
  res.json({
    ok: true,
    configured: isEmailConfigured(),
    provider,
    from: process.env.MAIL_FROM || '(not set)',
    smtp_host: smtp || null,
  });
});

app.post('/api/admin/email/test', requireAdmin, async (req, res) => {
  const { to } = req.body || {};
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) {
    return res.status(400).json({ ok: false, message: 'A valid "to" email is required.' });
  }
  if (!isEmailConfigured()) {
    return res.status(400).json({ ok: false, message: 'No email provider configured. Add BREVO_API_KEY or SMTP_HOST to .env' });
  }
  try {
    await sendTestEmail(to.trim());
    res.json({ ok: true, message: `Test email sent to ${to.trim()}` });
  } catch (err) {
    const msg = err?.message || String(err);
    console.error('[api] email/test failed:', msg);
    res.status(500).json({ ok: false, message: msg });
  }
});

// ── Admin: Send notification emails ──

app.post('/api/admin/notifications/send', requireAdmin, async (req, res) => {
  const { type, title, description } = req.body || {};
  if (!type || !['news', 'careers'].includes(type)) {
    return res.status(400).json({ ok: false, message: 'type must be "news" or "careers"' });
  }
  if (!title?.trim()) {
    return res.status(400).json({ ok: false, message: 'title required' });
  }
  if (!isEmailConfigured()) {
    return res.status(400).json({ ok: false, message: 'Configure MailerSend (MAILERSEND_API_KEY), Brevo, or SMTP in .env' });
  }
  try {
    const subs = await getSubscribersForNotification(type);
    sendNotificationEmails(
      { type, title: title.trim(), description: (description || '').trim(), port },
      subs
    );
    res.json({ ok: true, queued: subs.length, message: `Queued ${subs.length} email(s) for delivery` });
  } catch (err) {
    console.error('[api] notifications/send', err?.message || err);
    res.status(500).json({ ok: false, message: 'Failed to send: ' + (err?.message || 'Unknown error') });
  }
});

// ── Admin: Job applications ──
const RESUMES_PUBLIC_DIR = path.join(__dirname, 'storage', 'app', 'public', 'resumes');
function resolveApplicationResumePath(rel) {
  if (!rel || typeof rel !== 'string') return null;
  const base = path.basename(rel.replace(/\\/g, '/'));
  if (!base || base.includes('..')) return null;
  const full = path.resolve(path.join(RESUMES_PUBLIC_DIR, base));
  if (!full.startsWith(path.resolve(RESUMES_PUBLIC_DIR)) || !fs.existsSync(full)) return null;
  return full;
}

app.get('/api/admin/applications', requireAdmin, requirePermissionAny('manage_applications', 'manage_settings'), async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const rows = await listApplications({ search });
    const applications = Array.isArray(rows) ? rows : [];
    console.log('[api][admin][applications] DB:', process.env.MYSQL_DATABASE || 'sqlite', '→', applications.length, 'rows');
    res.json({ ok: true, applications });
  } catch (err) {
    console.error('[api][admin][applications]', err?.message || err);
    res.status(500).json({ ok: false, message: 'Failed to load applications.' });
  }
});

// ── Admin: Amalgated Lending (loan applications from lending site) ──
app.get('/api/admin/lending-applications', requireAdmin, requirePermissionAny('manage_applications', 'manage_settings'), async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 300, 1), 500);
    const applications = await listLendingApplications({ limit });
    res.json({ ok: true, applications });
  } catch (err) {
    console.error('[api][admin][lending-applications]', err?.message || err);
    res.status(500).json({ ok: false, message: 'Failed to load lending applications.' });
  }
});

app.patch('/api/admin/applications/:id/status', requireAdmin, requirePermissionAny('manage_applications', 'manage_settings'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ ok: false, message: 'Invalid id.' });
  const raw = String(req.body?.status || '').trim().toLowerCase();
  const allowed = new Set(['new', 'called', 'ongoing', 'failed']);
  if (!allowed.has(raw)) return res.status(400).json({ ok: false, message: 'Invalid status.' });

  try {
    await updateApplicationStatus(id, raw);
    io.to('admin').emit('applications:refresh');
    res.json({ ok: true });
  } catch (err) {
    console.error('[api][admin][applications][status]', err?.message || err);
    res.status(500).json({ ok: false, message: 'Failed to update status.' });
  }
});

function sanitizeFileName(name) {
  if (!name || typeof name !== 'string') return 'resume';
  return name
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200) || 'resume';
}

app.get('/api/admin/applications/:id/resume', requireAdmin, requirePermissionAny('manage_applications', 'manage_settings'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ ok: false });
  try {
    const row = await getApplicationById(id);
    if (!row) return res.status(404).json({ ok: false, message: 'Not found' });
    const full = resolveApplicationResumePath(row.resume);
    if (!full) return res.status(404).json({ ok: false, message: 'Resume file not found' });
    const ext = path.extname(row.resume || full) || '.pdf';
    const downloadName = sanitizeFileName(row.full_name) + ext;
    return res.download(full, downloadName);
  } catch (err) {
    console.error('[api][admin][applications][resume]', err?.message || err);
    return res.status(500).json({ ok: false });
  }
});

app.delete('/api/admin/applications/:id', requireAdmin, requirePermissionAny('manage_applications', 'manage_settings'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ ok: false });
  try {
    const row = await getApplicationById(id);
    if (!row) return res.status(404).json({ ok: false });
    const full = resolveApplicationResumePath(row.resume);
    if (full) {
      try {
        fs.unlinkSync(full);
      } catch {
        /* file missing or locked */
      }
    }
    await deleteApplication(id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[api][admin][applications][delete]', err?.message || err);
    res.status(500).json({ ok: false });
  }
});

// ── Admin: Careers & News (DB-backed) ──

app.get('/api/admin/careers', requireAdmin, requirePermissionAny('edit_content', 'manage_settings'), async (_req, res) => {
  res.json({ ok: true, positions: await getCareerPositions() });
});

app.post('/api/admin/careers', requireAdmin, requirePermissionAny('edit_content', 'manage_settings'), async (req, res) => {
  const { title, location, department, type, summary } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ ok: false, message: 'title required' });
  const position = await createCareerPosition({
    title: title.trim(),
    location: (location || '').trim() || null,
    department: (department || '').trim() || null,
    type: (type || '').trim() || null,
    summary: (summary || '').trim() || null,
  });
  if (isEmailConfigured()) {
    getSubscribersForNotification('careers')
      .then((subs) => {
        console.log(`[email] Notifying ${subs.length} subscriber(s) about new career: "${position.title}"`);
        return sendNotificationEmails(
          { type: 'careers', title: position.title, description: position.summary || position.location || '', port },
          subs
        );
      })
      .catch((e) => console.error('[email] careers notification error:', e?.message || e));
  }
  res.json({ ok: true, position });
});

app.patch('/api/admin/careers/:id', requireAdmin, requirePermissionAny('edit_content', 'manage_settings'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ ok: false });
  const { title, location, department, type, summary } = req.body || {};
  const updated = await updateCareerPosition(id, {
    title: title !== undefined ? String(title).trim() : undefined,
    location: location !== undefined ? String(location).trim() : undefined,
    department: department !== undefined ? String(department).trim() : undefined,
    type: type !== undefined ? String(type).trim() : undefined,
    summary: summary !== undefined ? String(summary).trim() : undefined,
  });
  if (!updated) return res.status(404).json({ ok: false });
  res.json({ ok: true, position: updated });
});

app.delete('/api/admin/careers/:id', requireAdmin, requirePermissionAny('edit_content', 'manage_settings'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ ok: false });
  await deleteCareerPosition(id);
  res.json({ ok: true });
});

app.get('/api/admin/news-items', requireAdmin, requirePermissionAny('edit_content', 'manage_settings'), async (_req, res) => {
  res.json({ ok: true, items: await getNewsItems() });
});

app.post('/api/admin/news-items', requireAdmin, requirePermissionAny('edit_content', 'manage_settings'), async (req, res) => {
  const { title, category, date, summary } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ ok: false, message: 'title required' });
  const item = await createNewsItem({
    title: title.trim(),
    category: (category || '').trim() || null,
    date: (date || '').trim() || null,
    summary: (summary || '').trim() || null,
  });
  if (isEmailConfigured()) {
    getSubscribersForNotification('news')
      .then((subs) => {
        console.log(`[email] Notifying ${subs.length} subscriber(s) about new news: "${item.title}"`);
        return sendNotificationEmails(
          { type: 'news', title: item.title, description: item.summary || item.category || '', port },
          subs
        );
      })
      .catch((e) => console.error('[email] news notification error:', e?.message || e));
  }
  res.json({ ok: true, item });
});

app.patch('/api/admin/news-items/:id', requireAdmin, requirePermissionAny('edit_content', 'manage_settings'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ ok: false });
  const { title, category, date, summary } = req.body || {};
  const updated = await updateNewsItem(id, {
    title: title !== undefined ? String(title).trim() : undefined,
    category: category !== undefined ? String(category).trim() : undefined,
    date: date !== undefined ? String(date).trim() : undefined,
    summary: summary !== undefined ? String(summary).trim() : undefined,
  });
  if (!updated) return res.status(404).json({ ok: false });
  res.json({ ok: true, item: updated });
});

app.delete('/api/admin/news-items/:id', requireAdmin, requirePermissionAny('edit_content', 'manage_settings'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ ok: false });
  await deleteNewsItem(id);
  res.json({ ok: true });
});

app.get('/api/admin/newsletter-content', requireAdmin, requirePermissionAny('edit_content', 'manage_settings'), async (_req, res) => {
  res.json({ ok: true, content: (await getNewsletterContent()) || {} });
});

app.put('/api/admin/newsletter-content', requireAdmin, requirePermissionAny('edit_content', 'manage_settings'), async (req, res) => {
  const { content } = req.body || {};
  if (!content || typeof content !== 'object') return res.status(400).json({ ok: false, message: 'content object required' });
  const next = await setNewsletterContent(content);
  res.json({ ok: true, content: next });
});

// ── Admin: CMS (edit_content) ──
const requireEditContent = requirePermissionAny('edit_content', 'manage_settings');

app.get('/api/admin/cms/pages', requireAdmin, requireEditContent, async (_req, res) => {
  try {
    const pages = await getCmsPages();
    res.json({ ok: true, pages });
  } catch (err) {
    console.error('[api][admin][cms/pages]', err?.message || err);
    res.status(500).json({ ok: false, message: 'Failed to load pages.' });
  }
});

app.get('/api/admin/cms/pages/:pageName', requireAdmin, requireEditContent, async (req, res) => {
  try {
    const pageName = String(req.params.pageName || '').trim().toLowerCase();
    if (!pageName) return res.status(400).json({ ok: false, message: 'Page name required.' });
    const page = await getCmsPageByName(pageName);
    if (!page) return res.status(404).json({ ok: false, message: 'Page not found.' });
    const sections = await getCmsSectionsByPageId(page.id);
    const sectionsWithContent = [];
    for (const sec of sections) {
      const contents = await getCmsContentsBySectionId(sec.id);
      sectionsWithContent.push({ ...sec, contents });
    }
    res.json({ ok: true, page: { ...page, sections: sectionsWithContent } });
  } catch (err) {
    console.error('[api][admin][cms/pages/:pageName]', err?.message || err);
    res.status(500).json({ ok: false });
  }
});

app.put('/api/admin/cms/pages/:pageName', requireAdmin, requireEditContent, async (req, res) => {
  try {
    const pageName = String(req.params.pageName || '').trim().toLowerCase();
    const { content } = req.body || {};
    if (!pageName) return res.status(400).json({ ok: false, message: 'Page name required.' });
    if (!content || typeof content !== 'object') return res.status(400).json({ ok: false, message: 'content object required.' });
    const page = await getCmsPageByName(pageName);
    if (!page) return res.status(404).json({ ok: false, message: 'Page not found.' });
    for (const [sectionKey, items] of Object.entries(content)) {
      if (!items || typeof items !== 'object') continue;
      const section = await getCmsSectionByPageAndKey(page.id, sectionKey);
      if (!section) continue;
      for (const [contentKey, val] of Object.entries(items)) {
        const value = val != null ? String(val) : '';
        const type = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(value) || value.startsWith('/uploads/') ? 'image' : 'text';
        await upsertCmsContent(section.id, type, contentKey, value);
      }
    }
    const updated = await getCmsPageContent(pageName);
    io.emit('cms:updated', { pageName });
    res.json({ ok: true, content: updated });
  } catch (err) {
    console.error('[api][admin][cms/pages/:pageName] PUT', err?.message || err);
    res.status(500).json({ ok: false });
  }
});

app.post('/api/admin/cms/upload', requireAdmin, requireEditContent, uploadCmsImage.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, message: 'No file uploaded.' });
    const filename = req.file.filename || path.basename(req.file.path);
    const url = `/uploads/cms/${filename}`;
    res.json({ ok: true, url });
  } catch (err) {
    console.error('[api][admin][cms/upload]', err?.message || err);
    res.status(500).json({ ok: false });
  }
});

// ── Admin: Analytics (real-time from visitor_visits in DB) ──

const emptyAnalytics = () => ({
  visits: 0,
  totalVisits: 0,
  totalMessages: 0,
  viewersCount: 0,
  messagedCount: 0,
  avgDurationSeconds: 0,
  byDevice: {},
  byBrowser: {},
  byLocation: {},
  byDeviceMessaged: {},
  byBrowserMessaged: {},
  byLocationMessaged: {},
  recentVisits: [],
  recentViewers: [],
  recentMessaged: [],
});
const analyticsCache = new Map();

app.get('/api/admin/analytics', requireAdminOrLendingSecret, async (req, res) => {
  const { since = '-7 days' } = req.query;
  const cacheKey = String(since || '-7 days');
  const cached = analyticsCache.get(cacheKey);
  if (cached && (Date.now() - cached.cachedAt) < 15000) {
    return res.json(cached.payload);
  }
  let visitsRaw = [];
  let allVisitsRaw = [];
  try {
    visitsRaw = await getVisitsForAnalytics(since);
    allVisitsRaw = await getAllVisits();
  } catch (err) {
    console.error('[api][admin][analytics]', err?.message || err);
    const payload = emptyAnalytics();
    analyticsCache.set(cacheKey, { cachedAt: Date.now(), payload });
    return res.json(payload);
  }

  // Basic hygiene: ignore obvious internal traffic + bots,
  // and cap session duration so a single long tab doesn't skew the average.
  const MAX_SESSION_SECONDS = 3 * 60 * 60; // 3 hours
  const includeLocalVisits = ['1', 'true', 'yes'].includes(
    String(process.env.ANALYTICS_INCLUDE_LOCAL || '').toLowerCase().trim(),
  );
  const isInternalOrBot = (v) => {
    const ip = (v.ip || '').toLowerCase();
    const browser = (v.browser || '').toLowerCase();
    if (!ip && !browser) return false;
    const isLocalOrPrivateIp =
      ip === '::1' ||
      ip === '127.0.0.1' ||
      ip === '::ffff:127.0.0.1' ||
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      ip.startsWith('172.16.');
    if (!includeLocalVisits && ip && isLocalOrPrivateIp) return true;
    if (
      browser &&
      (browser.includes('bot') ||
        browser.includes('crawler') ||
        browser.includes('spider') ||
        browser.includes('headless'))
    ) {
      return true;
    }
    return false;
  };

  const visits = visitsRaw.filter((v) => !isInternalOrBot(v));
  const allVisits = allVisitsRaw.filter((v) => !isInternalOrBot(v));

  // Separate: viewers (no message) vs messaged (sent at least one message)
  const viewers = visits.filter((v) => (v.message_count || 0) === 0);
  const messaged = visits.filter((v) => (v.message_count || 0) >= 1);

  const byDevice = {};
  const byBrowser = {};
  const byLocation = {};
  const byDeviceMessaged = {};
  const byBrowserMessaged = {};
  const byLocationMessaged = {};
  let totalMessages = 0;
  let totalDuration = 0;

  visits.forEach((v) => {
    byDevice[v.device || 'Unknown'] = (byDevice[v.device || 'Unknown'] || 0) + 1;
    byBrowser[v.browser || 'Unknown'] = (byBrowser[v.browser || 'Unknown'] || 0) + 1;
    byLocation[v.location || 'Unknown'] = (byLocation[v.location || 'Unknown'] || 0) + 1;
    totalMessages += v.message_count || 0;
    const rawDuration = Number.isFinite(v.visit_duration_seconds)
      ? v.visit_duration_seconds
      : Number(v.visit_duration_seconds) || 0;
    totalDuration += Math.max(0, Math.min(rawDuration, MAX_SESSION_SECONDS));
    if ((v.message_count || 0) >= 1) {
      byDeviceMessaged[v.device || 'Unknown'] = (byDeviceMessaged[v.device || 'Unknown'] || 0) + 1;
      byBrowserMessaged[v.browser || 'Unknown'] = (byBrowserMessaged[v.browser || 'Unknown'] || 0) + 1;
      byLocationMessaged[v.location || 'Unknown'] = (byLocationMessaged[v.location || 'Unknown'] || 0) + 1;
    }
  });

  const payload = {
    visits: visits.length,
    totalVisits: allVisits.length,
    totalMessages,
    viewersCount: viewers.length,
    messagedCount: messaged.length,
    avgDurationSeconds: visits.length ? Math.round(totalDuration / visits.length) : 0,
    byDevice,
    byBrowser,
    byLocation,
    byDeviceMessaged,
    byBrowserMessaged,
    byLocationMessaged,
    recentVisits: visits.slice(0, 50),
    recentViewers: viewers.slice(0, 30),
    recentMessaged: messaged.slice(0, 30),
  };
  analyticsCache.set(cacheKey, { cachedAt: Date.now(), payload });
  res.json(payload);
});

app.get(
  '/api/admin/ai-session-metrics',
  requireAdminOrLendingSecret,
  requirePermission('manage_tickets'),
  (_req, res) => {
    const samples = recentAiReplyMetrics.slice(0, 50);
    const averageAiResponseMs =
      samples.length > 0
        ? Math.round(samples.reduce((acc, row) => acc + (row.delayMs || 0), 0) / samples.length)
        : null;
    const visitorOnlineByConversation = {};
    visitorPresenceCounts.forEach((count, id) => {
      if (count > 0) visitorOnlineByConversation[id] = true;
    });
    res.json({
      activeVisitorSessions: visitorPresenceCounts.size,
      averageAiResponseMs,
      recentAiReplies: recentAiReplyMetrics.slice(0, 10),
      visitorOnlineByConversation,
    });
  },
);

// ── Admin: Tickets ──

app.get('/api/admin/tickets', requireAdminOrLendingSecret, async (req, res) => {
  const { status, conversationId } = req.query;
  res.json(await getTickets({ status: status || undefined, conversationId: conversationId || undefined }));
});

app.post('/api/admin/tickets', requireAdminOrLendingSecret, async (req, res) => {
  const { conversation_id, priority, status, assigned_staff, notes } = req.body || {};
  if (!conversation_id) return res.status(400).json({ ok: false, message: 'conversation_id required' });
  const ticket = await createTicket(conversation_id, { priority, status, assigned_staff, notes });
  logActivity({ action: 'ticket_created', adminUsername: req.admin?.username, ipAddress: getClientIp(req), details: `Chat ticket #${ticket?.id || ''} for conversation ${conversation_id}` }).catch(() => {});
  io.to('admin').emit('tickets:refresh');
  res.json(ticket);
});

app.patch('/api/admin/tickets/:id', requireAdminOrLendingSecret, async (req, res) => {
  const { id } = req.params;
  const { priority, status, assigned_staff, notes } = req.body || {};
  const ticket = await getTicketById(Number(id));
  if (!ticket) return res.status(404).json({ ok: false, message: 'Ticket not found' });
  const updated = await updateTicket(Number(id), { priority, status, assigned_staff, notes });
  logActivity({ action: 'ticket_updated', adminUsername: req.admin?.username, ipAddress: getClientIp(req), details: `Chat ticket #${id}` }).catch(() => {});
  await setTicketUnread(Number(id), false);
  io.to('admin').emit('tickets:refresh');
  res.json(updated);
});

app.get('/api/admin/tickets/by-conversation/:conversationId', requireAdminOrLendingSecret, async (req, res) => {
  res.json(await getTicketsByConvo(req.params.conversationId));
});

// ── CRM tickets (standalone support system) ──
app.get('/api/tickets', requireAdmin, async (req, res) => {
  const { status, priority, assigned_to, search } = req.query;
  const tickets = await getCrmTickets({
    status: status || undefined,
    priority: priority || undefined,
    assigned_to: assigned_to != null ? Number(assigned_to) : undefined,
    search: search || undefined,
  });
  res.json({ ok: true, tickets });
});

app.get('/api/tickets/:id', requireAdmin, async (req, res) => {
  const ticket = await getCrmTicketById(Number(req.params.id));
  if (!ticket) return res.status(404).json({ ok: false, message: 'Ticket not found' });
  await setCrmTicketUnread(Number(req.params.id), false);
  res.json({ ok: true, ticket });
});

app.post('/api/tickets', requireAdmin, async (req, res) => {
  const { customer_name, email, subject, category, priority, message } = req.body || {};
  if (!customer_name || !email || !subject) {
    return res.status(400).json({ ok: false, message: 'customer_name, email, and subject required' });
  }
  const ticket = await createCrmTicket({ customer_name, email, subject, category, priority, message });
  logActivity({ action: 'ticket_created', adminUsername: req.admin?.username, ipAddress: getClientIp(req), details: `CRM ticket #${ticket?.id || ''} – ${(subject || '').slice(0, 50)}` }).catch(() => {});
  io.to('admin').emit('tickets:refresh');
  res.status(201).json({ ok: true, ticket });
});

app.put('/api/tickets/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const ticket = await getCrmTicketById(id);
  if (!ticket) return res.status(404).json({ ok: false, message: 'Ticket not found' });
  const allowed = ['status', 'priority', 'assigned_to', 'category', 'subject', 'customer_name', 'email'];
  const data = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) data[k] = req.body[k];
  }
  const updated = await updateCrmTicket(id, data);
  logActivity({ action: 'ticket_updated', adminUsername: req.admin?.username, ipAddress: getClientIp(req), details: `CRM ticket #${id}` }).catch(() => {});
  io.to('admin').emit('tickets:refresh');
  res.json({ ok: true, ticket: updated });
});

app.delete('/api/tickets/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const ticket = await getCrmTicketById(id);
  if (!ticket) return res.status(404).json({ ok: false, message: 'Ticket not found' });
  await deleteCrmTicket(id);
  logActivity({ action: 'ticket_deleted', adminUsername: req.admin?.username, ipAddress: getClientIp(req), details: `CRM ticket #${id}` }).catch(() => {});
  io.to('admin').emit('tickets:refresh');
  res.json({ ok: true });
});

app.post('/api/tickets/:id/reply', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { message } = req.body || {};
  if (!message || !String(message).trim()) {
    return res.status(400).json({ ok: false, message: 'message required' });
  }
  const ticket = await addCrmTicketReply(id, String(message).trim());
  if (!ticket) return res.status(404).json({ ok: false, message: 'Ticket not found' });
  io.to('admin').emit('tickets:refresh');
  res.json({ ok: true, ticket, message: ticket.messages[ticket.messages.length - 1] });
});

app.post('/api/tickets/:id/notes', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { note } = req.body || {};
  if (!note || !String(note).trim()) {
    return res.status(400).json({ ok: false, message: 'note required' });
  }
  const adminId = 'admin';
  const ticket = await addCrmTicketNote(id, adminId, String(note).trim());
  if (!ticket) return res.status(404).json({ ok: false, message: 'Ticket not found' });
  res.json({ ok: true, ticket, note: ticket.notes[ticket.notes.length - 1] });
});

// ── Socket.io ──

function getSocketClientIp(socket) {
  const req = socket.request;
  return extractClientIpFromHeaders(
    req?.headers,
    req?.connection?.remoteAddress || socket.handshake?.address || '',
  );
}

function getSocketClientMeta(socket) {
  const req = socket.request || {};
  const baseMeta = parseDeviceMetaFromHeaders(req.headers || socket.handshake?.headers || {});
  const traffic = classifyTrafficProfile(baseMeta);
  return {
    ip: getSocketClientIp(socket),
    ...baseMeta,
    ...traffic,
  };
}

io.on('connection', (socket) => {
  const clientMeta = getSocketClientMeta(socket);
  const { ip, device, browser } = clientMeta;
  socket.data.clientMeta = clientMeta;

  socket.on('visitor:join', async (payload) => {
    try {
      const rawConversationId = typeof payload === 'string' ? payload : payload?.conversationId;
      const conversationId = String(rawConversationId || '').trim();
      const source_page = typeof payload === 'object' ? payload?.source_page : undefined;
      const lang = typeof payload === 'object' ? payload?.lang : undefined;
      if (!conversationId) return;
      await createConversation(conversationId);
      socket.join(conversationId);
      trackVisitorOnline(conversationId);
      socket.data.conversationId = conversationId;
      socket.data.role = 'visitor';
      socket.data.lang = normalizeLang(lang);
      socket.data.clientMeta = clientMeta;

      const pages = source_page ? [source_page] : [];
      await createOrUpdateVisit(conversationId, conversationId, {
        ip,
        location: 'Unknown',
        device,
        browser,
        pages_visited: JSON.stringify(pages),
        message_count: 0,
      });
      emitConversationsRefresh();
      emitAnalyticsRefresh();
      resolveLocationFromIp(conversationId, ip, () => {});

      const msgs = await getMessages(conversationId);
      socket.emit('chat:history', msgs);
    } catch (err) {
      console.error('[socket][visitor:join]', err?.message || err);
    }
  });

  socket.on('admin:join', (payload) => {
    const token = String(payload?.token || '').trim();
    const secret = String(payload?.secret || '').trim();
    if (secret && lendingAdminSecret && secret === lendingAdminSecret) {
      socket.join('admin');
      socket.data.role = 'admin';
      return;
    }
    if (!token) {
      socket.emit('chat:error', { message: 'Admin auth token required.' });
      return;
    }
    try {
      const admin = jwt.verify(token, JWT_SECRET);
      socket.data.admin = admin;
      socket.data.role = 'admin';
      socket.join('admin');
    } catch {
      socket.emit('chat:error', { message: 'Admin authentication failed.' });
    }
  });

  socket.on('admin:joinConversation', (conversationId) => {
    if (socket.data.role !== 'admin') return;
    socket.join(conversationId);
  });

  socket.on('admin:leaveConversation', (conversationId) => {
    if (socket.data.role !== 'admin') return;
    socket.leave(conversationId);
  });

  socket.on('visitor:message', async (payload) => {
    const { conversationId: rawConversationId, content, source_page, lang, dedupe_key: rawClientDedupe } =
      typeof payload === 'object' ? payload : { conversationId: payload?.conversationId, content: payload?.content };
    const conversationId = String(rawConversationId || '').trim();
    if (!conversationId || !content?.trim()) return;
    const startedAt = nowMs();
    const langCode = normalizeLang(lang || socket.data.lang);
    const contentText = content.trim();
    try {
      await createConversation(conversationId);
      await Promise.all([
        addMessage(conversationId, 'user', contentText),
        incrementConversationUnread(conversationId),
      ]);
      perfLog('visitor:message.persisted_user_message', startedAt, { conversation_id: conversationId });

      Promise.resolve()
        .then(async () => {
          const visit = await getVisitByVisitId(conversationId);
          if (visit) {
            let pages = [];
            try {
              pages = JSON.parse(visit.pages_visited || '[]');
            } catch {
              pages = [];
            }
            if (source_page && !pages.includes(source_page)) pages.push(source_page);
            const started = visit.started_at ? new Date(visit.started_at).getTime() : Date.now();
            const durationSec = Math.floor((Date.now() - started) / 1000);
            await createOrUpdateVisit(conversationId, conversationId, {
              pages_visited: JSON.stringify(pages),
              message_count: (visit.message_count || 0) + 1,
              visit_duration_seconds: durationSec,
            });
          } else {
            await createOrUpdateVisit(conversationId, conversationId, {
              ip: getSocketClientIp(socket),
              device,
              browser,
              pages_visited: source_page ? JSON.stringify([source_page]) : '[]',
              message_count: 1,
            });
          }
          emitAnalyticsRefresh();
        })
        .catch((err) => {
          console.error('[socket][visitor:message][analytics]', err?.message || err);
        });

    const userMsg = {
      conversation_id: conversationId,
      sender: 'user',
      content: contentText,
      created_at: new Date().toISOString(),
    };
    io.to(conversationId).emit('chat:message', userMsg);
    io.to('admin').emit('chat:newMessage', { conversationId, message: userMsg });
    perfLog('visitor:message.emitted_user_message', startedAt, { conversation_id: conversationId });

    /** Mirror visitor text → Laravel warehouse (admin CRM inbox). Dedupe aligns with widget HTTP fallback. */
    try {
      const clientDedupe = String(rawClientDedupe || '').trim();
      const isUuidLike =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientDedupe);
      syncOutboundChatMessage({
        sessionId: conversationId,
        visitorId: conversationId,
        senderType: 'customer',
        message: contentText,
        dedupeKey: isUuidLike
          ? clientDedupe
          : deterministicSyncUuid('visitor-msg', [conversationId, contentText, String(startedAt)]),
        conversationPatch: {
          unread_increment: 1,
          last_responder_type: 'customer',
        },
      }).catch(() => {});
    } catch {
      /* ignore sync errors — Node CRM still authoritative for realtime */
    }

    const convo = await getConversation(conversationId);
    if (convo?.mode !== 'ai') {
      socket.emit('chat:expectNoAiStream', { reason: 'human' });
    } else {
      if (wantsLeadCapture(contentText)) {
        const askMsg = t(langCode, 'leadAsk');
        await addMessage(conversationId, 'ai', askMsg);
        const aiMsg = {
          conversation_id: conversationId,
          sender: 'ai',
          content: askMsg,
          created_at: new Date().toISOString(),
        };
        io.to(conversationId).emit('chat:message', aiMsg);
        io.to(conversationId).emit('chat:requestLeadDetails', { inquiry_message: contentText });
        io.to('admin').emit('chat:newMessage', { conversationId, message: aiMsg });
        perfLog('visitor:message.lead_capture_reply', startedAt, { conversation_id: conversationId });
        syncOutboundChatMessage({
          sessionId: conversationId,
          visitorId: conversationId,
          senderType: 'ai',
          message: askMsg,
          dedupeKey: deterministicSyncUuid('ai-leadcapture-reply', [
            conversationId,
            String(startedAt),
            askMsg.slice(0, 200),
          ]),
        }).catch(() => {});
      } else {
        // Queue AI work per conversation so multiple rapid messages don't block each other or interleave responses.
        enqueueAiTask(conversationId, async () => {
          io.to(conversationId).emit('chat:typing', { sender: 'ai' });
          const streamId = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          io.to(conversationId).emit('chat:streamStart', {
            conversation_id: conversationId,
            sender: 'ai',
            stream_id: streamId,
            created_at: new Date().toISOString(),
          });
          let finalReply = '';
          try {
            const contentProfile = socket.data?.clientMeta?.contentProfile || 'full';
            finalReply = await streamAIReply(conversationId, contentText, langCode, {
              onChunk: (delta) => {
                io.to(conversationId).emit('chat:streamDelta', {
                  conversation_id: conversationId,
                  sender: 'ai',
                  stream_id: streamId,
                  delta,
                });
              },
            }, { contentProfile });
            await addMessage(conversationId, 'ai', finalReply);
            const aiMsg = {
              conversation_id: conversationId,
              sender: 'ai',
              content: finalReply,
              created_at: new Date().toISOString(),
            };
            io.to(conversationId).emit('chat:streamEnd', {
              conversation_id: conversationId,
              sender: 'ai',
              stream_id: streamId,
              content: finalReply,
              created_at: aiMsg.created_at,
            });
            perfLog('visitor:message.ai_stream_completed', startedAt, {
              conversation_id: conversationId,
              reply_chars: String(finalReply || '').length,
            });
            recordAiReplyMetric(conversationId, nowMs() - startedAt);
            syncOutboundChatMessage({
              sessionId: conversationId,
              visitorId: conversationId,
              senderType: 'ai',
              message: finalReply,
              aiLogMs: nowMs() - startedAt,
              dedupeKey: deterministicSyncUuid('ai-stream-final', [conversationId, streamId]),
              conversationPatch: await getConversation(conversationId).then((c) => ({
                mode: c?.mode,
                status: c?.status === 'resolved' ? c.status : 'open',
              })),
            }).catch(() => {});
          } catch (err) {
            console.error('[ai]', err?.message || err);
            const errorText = t(langCode, 'aiError');
            io.to(conversationId).emit('chat:streamEnd', {
              conversation_id: conversationId,
              sender: 'ai',
              stream_id: streamId,
              content: errorText,
              created_at: new Date().toISOString(),
            });
            syncOutboundChatMessage({
              sessionId: conversationId,
              visitorId: conversationId,
              senderType: 'system',
              message: errorText,
              dedupeKey: deterministicSyncUuid('ai-stream-fail', [conversationId, streamId]),
              conversationPatch: { last_responder_type: 'system' },
            }).catch(() => {});
          } finally {
            io.to(conversationId).emit('chat:typingStop');
            emitConversationsRefresh();
          }
        });
      }
    }

      emitConversationsRefresh();
    } catch (err) {
      console.error('[socket][visitor:message]', err?.message || err);
      socket.emit('chat:error', { message: 'Unable to send message right now.' });
    }
  });

  socket.on('visitor:leadDetails', async ({ conversationId, name, email, phone, company, inquiry_message, source_page, lang }) => {
    try {
      if (!conversationId || !name?.trim() || !email?.trim()) return;
      const langCode = normalizeLang(lang || socket.data.lang);
      const lead = await createLead({
        name: name.trim(),
        email: email.trim(),
        phone: (phone || '').trim() || null,
        company: (company || '').trim() || null,
        inquiry_message: (inquiry_message || '').trim() || null,
        conversation_id: conversationId,
        source_page: (source_page || '').trim() || null,
      });
      const thankMsg = t(langCode, 'leadThanks');
      await addMessage(conversationId, 'ai', thankMsg);
      const aiMsg = {
        conversation_id: conversationId,
        sender: 'ai',
        content: thankMsg,
        created_at: new Date().toISOString(),
      };
      io.to(conversationId).emit('chat:message', aiMsg);
      io.to(conversationId).emit('chat:leadCaptured');
      io.to('admin').emit('chat:newMessage', { conversationId, message: aiMsg });
      io.to('admin').emit('admin:newLead', lead);
      emitConversationsRefresh();
      syncOutboundChatMessage({
        sessionId: conversationId,
        visitorId: conversationId,
        senderType: 'ai',
        message: thankMsg,
        dedupeKey: deterministicSyncUuid('ai-lead-thanks', [conversationId, String(lead.id), thankMsg.slice(0, 160)]),
      }).catch(() => {});
    } catch (err) {
      console.error('[socket][visitor:leadDetails]', err?.message || err);
    }
  });

  socket.on('visitor:feedback', async (payload, ack) => {
    try {
      const conversationId = String(payload?.conversationId || socket.data?.conversationId || '').trim() || null;
      const rating = Number(payload?.rating);
      const name = String(payload?.name || '').trim() || 'Anonymous';
      const emailRaw = String(payload?.email || '').trim();
      const email = emailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw : null;
      const subject = String(payload?.subject || '').trim().slice(0, 191) || null;
      const comment = String(payload?.comment || '').trim();

      if (!Number.isFinite(rating) || rating <= 0 || !comment) {
        ack?.({ ok: false, message: 'Rating and comment are required.' });
        return;
      }

      await createFeedback({
        id: crypto.randomUUID(),
        conversationId,
        rating,
        name,
        email,
        subject,
        comment,
      });
      io.to('admin').emit('feedback:refresh');
      syncOutboundFeedback({ sessionId: conversationId || '', rating, subject, name, email, comment }).catch(() => {});
      ack?.({ ok: true });
    } catch (err) {
      console.error('[socket][visitor:feedback]', err?.message || err);
      ack?.({ ok: false, message: 'Unable to submit feedback right now.' });
    }
  });

  socket.on('visitor:requestAgent', async ({ conversationId, name, email, concern, phone, company, source_page }) => {
    try {
      if (!conversationId) return;
      await createConversation(conversationId);
      await updateMode(conversationId, 'human');
      await updateStatus(conversationId, 'open');
      if (name) await updateVisitor(conversationId, name, email || '');

      const agentIntro = `[Agent Request] Name: ${name || 'N/A'} | Email: ${email || 'N/A'} | Concern: ${concern || 'N/A'}`;
      await addMessage(conversationId, 'user', agentIntro);
      syncOutboundChatMessage({
        sessionId: conversationId,
        visitorId: conversationId,
        senderType: 'customer',
        message: agentIntro,
        dedupeKey: deterministicSyncUuid('visitor-agent-intake', [
          conversationId,
          name || '',
          email || '',
          String(concern || '').slice(0, 200),
        ]),
        conversationPatch: { unread_increment: 1 },
      }).catch(() => {});

    // Save a lead so it appears in Admin → Leads
    if (name?.trim() && email?.trim()) {
      try {
        const lead = await createLead({
          name: name.trim(),
          email: email.trim(),
          phone: (phone || '').trim() || null,
          company: (company || '').trim() || null,
          inquiry_message: (concern || '').trim() || 'Requested a representative',
          conversation_id: conversationId,
          source_page: (source_page || '').trim() || null,
        });
        io.to('admin').emit('admin:newLead', lead);
      } catch (err) {
        console.error('[lead][requestAgent]', err?.message || err);
      }
    }

      const sysMsg = {
        conversation_id: conversationId,
        sender: 'ai',
        content: "You've been connected to our support queue. A representative will be with you shortly.",
        created_at: new Date().toISOString(),
      };
      await addMessage(conversationId, 'ai', sysMsg.content);
      io.to(conversationId).emit('chat:message', sysMsg);
      emitConversationsRefresh();
      syncOutboundChatMessage({
        sessionId: conversationId,
        visitorId: conversationId,
        senderType: 'system',
        message: sysMsg.content,
        dedupeKey: deterministicSyncUuid('sys-agent-queue', [conversationId, sysMsg.created_at]),
        conversationPatch: {
          escalated: true,
          mode: 'human',
          status: 'in_progress',
          guest_name: name?.trim(),
          guest_email: email?.trim(),
        },
      }).catch(() => {});
    } catch (err) {
      console.error('[socket][visitor:requestAgent]', err?.message || err);
    }
  });

  socket.on('admin:message', async ({ conversationId, content, adminName }) => {
    if (socket.data.role !== 'admin') return;
    if (!conversationId || !content?.trim()) return;
    try {
      await addMessage(conversationId, 'admin', content.trim(), adminName || 'Support Agent');
      await updateMode(conversationId, 'human');
      await updateStatus(conversationId, 'in_progress');
      await clearConversationUnread(conversationId);

    const adminMsg = {
      conversation_id: conversationId,
      sender: 'admin',
      admin_name: adminName || 'Support Agent',
      content: content.trim(),
      created_at: new Date().toISOString(),
    };
      io.to(conversationId).emit('chat:message', adminMsg);
      io.to(conversationId).emit('conversation:modeChanged', { conversationId, mode: 'human' });
      io.to('admin').emit('chat:newMessage', { conversationId, message: adminMsg });
      io.to('admin').emit('conversation:updated', await getConversation(conversationId));
      emitConversationsRefresh();
      syncOutboundChatMessage({
        sessionId: conversationId,
        visitorId: conversationId,
        senderType: 'admin',
        senderName: adminName || 'Support Agent',
        message: content.trim(),
        dedupeKey: deterministicSyncUuid('admin-node-msg', [
          conversationId,
          adminMsg.created_at,
          adminName || 'agent',
          content.trim(),
        ]),
        conversationPatch: { mode: 'human', status: 'in_progress', needs_human: true },
      }).catch(() => {});
    } catch (err) {
      console.error('[socket][admin:message]', err?.message || err);
    }
  });

  socket.on('admin:typing', ({ conversationId }) => {
    io.to(conversationId).emit('chat:typing', { sender: 'admin' });
  });

  socket.on('admin:typingStop', ({ conversationId }) => {
    io.to(conversationId).emit('chat:typingStop');
  });

  socket.on('disconnect', () => {
    if (socket.data?.role === 'visitor' && socket.data?.conversationId) {
      trackVisitorOffline(socket.data.conversationId);
    }
  });
});

app.get('/health', (_req, res) =>
  res.json({ ok: true, service: 'amalgated-lending-chat-server' }),
);

// ── Serve frontend (Vite build from repo root) on same origin ──
// `npm run build` writes to ../dist (amalgated-lending/), not chat-server/dist.

const distParent = path.join(__dirname, '..', 'dist');
const distLocal = path.join(__dirname, 'dist');
const clientDir = fs.existsSync(distParent) ? distParent : distLocal;
const CHAT_SUBDOMAIN = String(process.env.CHAT_SUBDOMAIN || 'chat.amalgatedlending.com').toLowerCase();

function requestHost(req) {
  return String(req?.headers?.host || '').toLowerCase().split(':')[0];
}

function isChatSubdomainRequest(req) {
  const host = requestHost(req);
  return Boolean(host) && host === CHAT_SUBDOMAIN;
}

if (fs.existsSync(clientDir)) {
  /**
   * Serve the Vite SPA. Hashed asset names (Vite output) are safe to cache for a
   * year + immutable; index.html itself is never cached so SPA shell updates
   * always reach users on next page load.
   */
  app.use(
    express.static(clientDir, {
      fallthrough: true,
      etag: true,
      lastModified: true,
      setHeaders(res, filePath) {
        const isHashedAsset = /\\assets\\|\/assets\//.test(filePath);
        if (isHashedAsset) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=86400');
        }
        res.setHeader('Vary', 'Accept-Encoding');
      },
    }),
  );
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return res.status(404).end();
    }
    // Keep chat subdomain focused on CRM/chat interface only.
    if (
      isChatSubdomainRequest(req) &&
      !req.path.startsWith('/admin/chat-crm') &&
      !req.path.startsWith('/assets/') &&
      req.path !== '/favicon.ico'
    ) {
      return res.redirect(302, '/admin/chat-crm');
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(clientDir, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
} else {
  // In dev (npm run dev:full) the UI is served by Vite on :5173 — chat server is API + Socket.IO only.
  const devFrontend = (process.env.VITE_DEV_SERVER_URL || process.env.SITE_URL || '').replace(/\/$/, '');
  if (devFrontend) {
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path.startsWith('/health') || req.path.startsWith('/uploads')) {
        return next();
      }
      if (isChatSubdomainRequest(req) && !req.path.startsWith('/admin/chat-crm')) {
        return res.redirect(302, `${devFrontend}/admin/chat-crm`);
      }
      res.redirect(302, devFrontend + req.originalUrl);
    });
  } else if (process.env.NODE_ENV === 'production') {
    console.warn('[chat] No ../dist — run `npm run build` in the amalgated-lending project root to serve the SPA from this server.');
  } else {
    console.info('[chat] No ../dist (normal for dev). UI: Vite dev server (e.g. http://localhost:5173). Optional: set VITE_DEV_SERVER_URL in chat-server/.env to redirect :8010 → Vite.');
  }
}

function onChatListening() {
  writeChatActivePort(port);
  console.log(`Amalgated Lending chat server listening on http://localhost:${port}`);
}

function startListening(nextPort) {
  port = nextPort;
  // Remove prior handler so a failed listen (EADDRINUSE) does not stack once('listening') callbacks.
  httpServer.off('listening', onChatListening);
  httpServer.once('listening', onChatListening);
  httpServer.listen(port);
}

httpServer.on('error', (err) => {
  if (err?.code === 'EADDRINUSE') {
    const retryPort = Number(port) + 1;
    console.warn(`Port ${port} is in use. Trying ${retryPort}...`);
    setTimeout(() => startListening(retryPort), 250);
    return;
  }
  console.error('Server error:', err);
  process.exit(1);
});

Promise.all([
  ensureApplicationsTable().catch((err) => console.error('[db] ensureApplicationsTable:', err?.message || err)),
  ensureLendingApplicationsTable().catch((err) => console.error('[db] ensureLendingApplicationsTable:', err?.message || err)),
]).finally(() => {
  if (DB_PROVIDER === 'mysql') {
    console.log('[db] MySQL — database:', process.env.MYSQL_DATABASE || 'amalgated_lending_chat', '| job applications in `applications` table.')
  } else {
    console.log('[db] SQLite (chat.db). For MySQL/XAMPP add DB_PROVIDER=mysql and MYSQL_* to .env.')
  }
  if (process.env.LENDING_ADMIN_API_SECRET) {
    console.log('[api] Lending admin API: GET /api/lending/applications (Bearer or X-Lending-Admin-Secret)')
  }
  startListening(port)
})
