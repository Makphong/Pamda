import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import { OAuth2Client } from 'google-auth-library';
import { Firestore } from '@google-cloud/firestore';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';

dotenv.config();

const app = express();
app.set('trust proxy', true);
app.use(helmet());
app.use(
  express.json({
    limit: String(process.env.REQUEST_BODY_LIMIT || '10mb'),
    verify: (req, _res, buffer) => {
      req.rawBody = buffer;
    },
  })
);

const allowedOrigins = String(process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS blocked by server policy.'));
    },
  })
);

const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 10);
const USERS_COLLECTION = String(process.env.FIRESTORE_USERS_COLLECTION || 'users').trim();
const OTP_COLLECTION = String(process.env.FIRESTORE_OTP_COLLECTION || 'auth_otps').trim();
const APP_DATA_COLLECTION = String(process.env.FIRESTORE_APP_DATA_COLLECTION || 'app_data').trim();
const PROJECT_INVITES_COLLECTION = String(
  process.env.FIRESTORE_PROJECT_INVITES_COLLECTION || 'project_invites'
).trim();
const PROJECT_INVITES_DOC_ID = String(process.env.FIRESTORE_PROJECT_INVITES_DOC_ID || 'global').trim();
const APP_DATA_CHUNK_COLLECTION = String(
  process.env.FIRESTORE_APP_DATA_CHUNK_COLLECTION || 'chunks'
).trim();
const APP_DATA_CHUNK_SIZE = Math.max(50000, Number(process.env.FIRESTORE_APP_DATA_CHUNK_SIZE || 300000));
const GOOGLE_OAUTH_JSON_PATH = String(process.env.GOOGLE_OAUTH_JSON_PATH || '').trim();
const GOOGLE_CALENDAR_REDIRECT_URI = String(
  process.env.GOOGLE_CALENDAR_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI || ''
).trim();
const GOOGLE_CALENDAR_STATE_TTL_MS = 10 * 60 * 1000;
const GOOGLE_CALENDAR_PROJECT_ID = '__google_calendar__';
const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
];
const FIRESTORE_LINE_REMINDER_COLLECTION = String(
  process.env.FIRESTORE_LINE_REMINDER_COLLECTION || 'line_project_reminders'
).trim();
const FIRESTORE_LINE_REMINDER_LOG_COLLECTION = String(
  process.env.FIRESTORE_LINE_REMINDER_LOG_COLLECTION || 'line_reminder_logs'
).trim();
const FIRESTORE_LINE_WEBHOOK_LOG_COLLECTION = String(
  process.env.FIRESTORE_LINE_WEBHOOK_LOG_COLLECTION || 'line_webhook_logs'
).trim();
const FIRESTORE_ADMIN_COMPLAINT_COLLECTION = String(
  process.env.FIRESTORE_ADMIN_COMPLAINT_COLLECTION || 'support_complaints'
).trim();
const FIRESTORE_SUPPORT_TICKET_COLLECTION = String(
  process.env.FIRESTORE_SUPPORT_TICKET_COLLECTION || 'support_tickets'
).trim();
const FIRESTORE_AI_THREAD_COLLECTION = String(
  process.env.FIRESTORE_AI_THREAD_COLLECTION || 'ai_threads'
).trim();
const LINE_REMINDER_CRON_SECRET = String(process.env.LINE_REMINDER_CRON_SECRET || '').trim();
const DEFAULT_LINE_REMINDER_TIMEZONE = String(
  process.env.LINE_REMINDER_DEFAULT_TIMEZONE || 'Asia/Bangkok'
).trim();
const ADMIN_STATS_TIMEZONE_RAW = String(
  process.env.ADMIN_STATS_TIMEZONE || DEFAULT_LINE_REMINDER_TIMEZONE || 'Asia/Bangkok'
).trim();
const ROOT_ADMIN_EMAIL_RAW = String(
  process.env.ROOT_ADMIN_EMAIL || 'main.thatphong@gmail.com'
).trim();
const SUPPORT_TICKET_MAX_ATTACHMENTS = Math.min(
  3,
  Math.max(0, Number(process.env.SUPPORT_TICKET_MAX_ATTACHMENTS || 3))
);
const SUPPORT_TICKET_MAX_ATTACHMENT_BYTES = Math.max(
  50_000,
  Number(process.env.SUPPORT_TICKET_MAX_ATTACHMENT_BYTES || 220_000)
);
const SUPPORT_TICKET_MAX_MESSAGE_LENGTH = Math.max(
  200,
  Number(process.env.SUPPORT_TICKET_MAX_MESSAGE_LENGTH || 4000)
);
const TASK_COMMENT_NOTIFY_MAX_RECIPIENTS = Math.max(
  1,
  Math.min(30, Number(process.env.TASK_COMMENT_NOTIFY_MAX_RECIPIENTS || 20))
);
const TASK_COMMENT_NOTIFY_MAX_TEXT_LENGTH = Math.max(
  120,
  Number(process.env.TASK_COMMENT_NOTIFY_MAX_TEXT_LENGTH || 2000)
);
const DEFAULT_LINE_REMINDER_HOUR = Math.min(
  23,
  Math.max(0, Number(process.env.LINE_REMINDER_DEFAULT_HOUR || 9))
);
const LINE_REMINDER_DAYS_BEFORE_OPTIONS = [7, 3, 1];
const DEFAULT_LINE_REMINDER_DAYS_BEFORE = [1];
const LINE_CHANNEL_SECRET = String(process.env.LINE_CHANNEL_SECRET || '').trim();
const LINE_WEBHOOK_CHANNEL_ACCESS_TOKEN = String(
  process.env.LINE_WEBHOOK_CHANNEL_ACCESS_TOKEN || process.env.LINE_CHANNEL_ACCESS_TOKEN || ''
).trim();
const LINE_REMINDER_CHANNEL_ACCESS_TOKEN = String(
  process.env.LINE_REMINDER_CHANNEL_ACCESS_TOKEN ||
    process.env.LINE_CHANNEL_ACCESS_TOKEN ||
    LINE_WEBHOOK_CHANNEL_ACCESS_TOKEN ||
    ''
).trim();
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || '').trim();
const OPENAI_MODEL = String(process.env.OPENAI_MODEL || 'gpt-5-mini').trim() || 'gpt-5-mini';
const OPENAI_REASONING_EFFORT = String(process.env.OPENAI_REASONING_EFFORT || 'low')
  .trim()
  .toLowerCase();
const OPENAI_BASE_URL = String(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').trim();
const AI_THREAD_MAX_MESSAGES = Math.max(10, Math.min(200, Number(process.env.AI_THREAD_MAX_MESSAGES || 80)));
const AI_THREAD_MESSAGE_PREVIEW_LIMIT = Math.max(
  40,
  Math.min(800, Number(process.env.AI_THREAD_MESSAGE_PREVIEW_LIMIT || 220))
);
const AI_CHAT_MAX_USER_MESSAGE_LENGTH = Math.max(
  100,
  Math.min(12000, Number(process.env.AI_CHAT_MAX_USER_MESSAGE_LENGTH || 2500))
);
const AI_PENDING_ACTION_TTL_MS = Math.max(
  30_000,
  Math.min(24 * 60 * 60 * 1000, Number(process.env.AI_PENDING_ACTION_TTL_MS || 15 * 60 * 1000))
);
const AI_THREAD_LIST_LIMIT = Math.max(
  5,
  Math.min(80, Number(process.env.AI_THREAD_LIST_LIMIT || 24))
);
const AI_THREAD_HISTORY_LIMIT = Math.max(
  8,
  Math.min(80, Number(process.env.AI_THREAD_HISTORY_LIMIT || 22))
);
const AI_MAX_TOOL_CALL_ROUNDS = Math.max(
  1,
  Math.min(10, Number(process.env.AI_MAX_TOOL_CALL_ROUNDS || 5))
);
const AI_INPUT_ATTACHMENT_MAX_COUNT = Math.max(
  1,
  Math.min(10, Number(process.env.AI_INPUT_ATTACHMENT_MAX_COUNT || 5))
);
const AI_INPUT_ATTACHMENT_TEXT_PREVIEW_LIMIT = Math.max(
  200,
  Math.min(10000, Number(process.env.AI_INPUT_ATTACHMENT_TEXT_PREVIEW_LIMIT || 2500))
);
const AI_INPUT_IMAGE_PREVIEW_MAX_CHARS = Math.max(
  2000,
  Math.min(8_000_000, Number(process.env.AI_INPUT_IMAGE_PREVIEW_MAX_CHARS || 2_400_000))
);
const AI_INPUT_IMAGE_MAX_COUNT = Math.max(
  0,
  Math.min(6, Number(process.env.AI_INPUT_IMAGE_MAX_COUNT || 3))
);

const loadGoogleOauthConfigFromJson = (filePath) => {
  const emptyConfig = { clientId: '', clientSecret: '', redirectUris: [] };
  if (!filePath) return emptyConfig;

  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const oauthSection = parsed?.web || parsed?.installed || {};
    const redirectUris = Array.isArray(oauthSection?.redirect_uris)
      ? oauthSection.redirect_uris.map((uri) => String(uri || '').trim()).filter(Boolean)
      : [];

    return {
      clientId: String(oauthSection?.client_id || '').trim(),
      clientSecret: String(oauthSection?.client_secret || '').trim(),
      redirectUris,
    };
  } catch (error) {
    console.warn(`Failed to read Google OAuth JSON from ${filePath}: ${error.message}`);
    return emptyConfig;
  }
};

const GOOGLE_OAUTH_JSON_CONFIG = loadGoogleOauthConfigFromJson(GOOGLE_OAUTH_JSON_PATH);
const GOOGLE_CLIENT_ID =
  String(process.env.GOOGLE_CLIENT_ID || '').trim() || GOOGLE_OAUTH_JSON_CONFIG.clientId;
const GOOGLE_CLIENT_SECRET =
  String(process.env.GOOGLE_CLIENT_SECRET || '').trim() || GOOGLE_OAUTH_JSON_CONFIG.clientSecret;
const AUTH_TOKEN_SECRET = String(
  process.env.AUTH_TOKEN_SECRET || process.env.PM_CALENDAR_AUTH_TOKEN_SECRET || ''
).trim();
const EFFECTIVE_AUTH_TOKEN_SECRET = AUTH_TOKEN_SECRET || '__pm_calendar_insecure_dev_secret__';
const AUTH_TOKEN_TTL_MS = Math.max(60 * 60 * 1000, Number(process.env.AUTH_TOKEN_TTL_MS || 30 * 24 * 60 * 60 * 1000));

const sanitizeEmail = (value) => String(value || '').trim().toLowerCase();
const sanitizeUsername = (value) => String(value || '').trim().toLowerCase();
const sanitizeUserId = (value) => String(value || '').trim();
const sanitizeAuthToken = (value) => String(value || '').trim();
const ROOT_ADMIN_EMAIL = sanitizeEmail(ROOT_ADMIN_EMAIL_RAW);

const requiredEnv = ['GMAIL_USER', 'GMAIL_APP_PASSWORD', 'OTP_FROM_EMAIL'];
const missingEnv = requiredEnv.filter((key) => !String(process.env[key] || '').trim());
if (!GOOGLE_CLIENT_ID) {
  missingEnv.push('GOOGLE_CLIENT_ID or GOOGLE_OAUTH_JSON_PATH');
}
if (missingEnv.length > 0) {
  console.warn(`Missing required env: ${missingEnv.join(', ')}`);
}
if (!GOOGLE_CLIENT_SECRET) {
  console.warn(
    'Google Calendar linking is disabled until GOOGLE_CLIENT_SECRET (or GOOGLE_OAUTH_JSON_PATH with client_secret) is configured.'
  );
}
if (!AUTH_TOKEN_SECRET) {
  console.warn(
    'AUTH_TOKEN_SECRET is not configured. Falling back to an insecure development secret. Set AUTH_TOKEN_SECRET in production.'
  );
}

const firestore = new Firestore();
const usersRef = firestore.collection(USERS_COLLECTION);
const otpRef = firestore.collection(OTP_COLLECTION);
const appDataRef = firestore.collection(APP_DATA_COLLECTION);
const invitesDocRef = firestore.collection(PROJECT_INVITES_COLLECTION).doc(PROJECT_INVITES_DOC_ID);
const lineReminderConfigRef = firestore.collection(FIRESTORE_LINE_REMINDER_COLLECTION);
const lineReminderLogRef = firestore.collection(FIRESTORE_LINE_REMINDER_LOG_COLLECTION);
const lineWebhookLogRef = firestore.collection(FIRESTORE_LINE_WEBHOOK_LOG_COLLECTION);
const adminComplaintRef = firestore.collection(FIRESTORE_ADMIN_COMPLAINT_COLLECTION);
const supportTicketRef = firestore.collection(FIRESTORE_SUPPORT_TICKET_COLLECTION);
const aiThreadRef = firestore.collection(FIRESTORE_AI_THREAD_COLLECTION);
const oauthClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

const resolveGoogleCalendarRedirectUri = (req) => {
  if (GOOGLE_CALENDAR_REDIRECT_URI) return GOOGLE_CALENDAR_REDIRECT_URI;
  const fallbackFromJson = String(GOOGLE_OAUTH_JSON_CONFIG.redirectUris?.[0] || '').trim();
  if (fallbackFromJson) return fallbackFromJson;

  const protocol = req?.protocol || 'https';
  const host = String(req?.get?.('host') || '').trim();
  if (!host) return '';
  return `${protocol}://${host}/google/calendar/callback`;
};

const createGoogleCalendarOauthClient = (req) => {
  const redirectUri = resolveGoogleCalendarRedirectUri(req);
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !redirectUri) {
    return null;
  }
  return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirectUri);
};

const getGoogleCalendarLinkState = (userData) => {
  if (!userData || typeof userData !== 'object') return null;
  const token = String(userData.googleCalendarLinkState?.token || '').trim();
  const expiresAt = Number(userData.googleCalendarLinkState?.expiresAt || 0);
  if (!token || !Number.isFinite(expiresAt) || expiresAt <= 0) return null;
  return { token, expiresAt };
};

const getGoogleCalendarIntegration = (userData) => {
  if (!userData || typeof userData !== 'object') return null;
  const raw = userData.googleCalendarIntegration;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const linkedEmail = sanitizeEmail(raw.linkedEmail);
  const refreshToken = String(raw.refreshToken || '').trim();
  if (!linkedEmail || !refreshToken) return null;

  return {
    linkedEmail,
    refreshToken,
    accessToken: String(raw.accessToken || '').trim(),
    accessTokenExpiresAt: Number(raw.accessTokenExpiresAt || 0),
    linkedAt: raw.linkedAt ? String(raw.linkedAt) : null,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : null,
    scope: String(raw.scope || '').trim(),
    tokenType: String(raw.tokenType || '').trim(),
    selectedCalendarIds: Array.from(
      new Set(
        (Array.isArray(raw.selectedCalendarIds) ? raw.selectedCalendarIds : [])
          .map((calendarId) => String(calendarId || '').trim())
          .filter(Boolean)
      )
    ),
  };
};

const normalizeGoogleCalendarSelection = (selectedCalendarIds) =>
  Array.from(
    new Set(
      (Array.isArray(selectedCalendarIds) ? selectedCalendarIds : [])
        .map((calendarId) => String(calendarId || '').trim())
        .filter(Boolean)
    )
  );

const filterGoogleCalendarSelectionByAvailableCalendars = (selectedCalendarIds, calendars) => {
  const normalizedSelection = normalizeGoogleCalendarSelection(selectedCalendarIds);
  const availableCalendarIds = new Set(
    (Array.isArray(calendars) ? calendars : [])
      .map((calendar) => String(calendar?.id || '').trim())
      .filter(Boolean)
  );
  return normalizedSelection.filter((calendarId) => availableCalendarIds.has(calendarId));
};

const shiftIsoDateByDays = (dateString, diffDays) => {
  const normalized = String(dateString || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return normalized;
  date.setUTCDate(date.getUTCDate() + diffDays);
  return date.toISOString().slice(0, 10);
};

const isValidIanaTimeZone = (timeZoneInput) => {
  const timeZone = String(timeZoneInput || '').trim();
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

const normalizeLineReminderTimezone = (timeZoneInput) => {
  const normalized = String(timeZoneInput || '').trim();
  if (normalized && isValidIanaTimeZone(normalized)) return normalized;
  if (isValidIanaTimeZone(DEFAULT_LINE_REMINDER_TIMEZONE)) return DEFAULT_LINE_REMINDER_TIMEZONE;
  return 'UTC';
};

const normalizeLineReminderHour = (hourInput) => {
  const parsed = Number.parseInt(String(hourInput ?? ''), 10);
  if (!Number.isInteger(parsed)) return DEFAULT_LINE_REMINDER_HOUR;
  return Math.min(23, Math.max(0, parsed));
};
const normalizeLineReminderDaysBefore = (valueInput) => {
  const source = Array.isArray(valueInput) ? valueInput : [];
  const normalized = source
    .map((value) => Number.parseInt(String(value ?? '').trim(), 10))
    .filter((value) => LINE_REMINDER_DAYS_BEFORE_OPTIONS.includes(value));
  const deduped = Array.from(new Set(normalized)).sort((left, right) => right - left);
  return deduped.length > 0 ? deduped : [...DEFAULT_LINE_REMINDER_DAYS_BEFORE];
};

const lineReminderDocIdFor = (userIdInput, projectIdInput) =>
  crypto
    .createHash('sha256')
    .update(`${sanitizeUserId(userIdInput)}|${String(projectIdInput || '').trim()}`)
    .digest('hex');

const lineReminderLogDocIdFor = (userIdInput, projectIdInput, targetDateInput, daysBeforeInput = 1) =>
  crypto
    .createHash('sha256')
    .update(
      `${sanitizeUserId(userIdInput)}|${String(projectIdInput || '').trim()}|${String(
        targetDateInput || ''
      ).trim()}|${Math.max(1, Number.parseInt(String(daysBeforeInput || 1), 10) || 1)}`
    )
    .digest('hex');

const buildLineTokenPreview = (tokenInput) => {
  const token = String(tokenInput || '').trim();
  if (!token) return '';
  if (token.length <= 10) return `${token.slice(0, 3)}...${token.slice(-2)}`;
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
};

const getIsoDateInTimeZone = (dateInput, timeZoneInput) => {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '';
  const timeZone = normalizeLineReminderTimezone(timeZoneInput);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const partMap = {};
  parts.forEach((part) => {
    partMap[part.type] = part.value;
  });
  const year = String(partMap.year || '').trim();
  const month = String(partMap.month || '').trim();
  const day = String(partMap.day || '').trim();
  if (!year || !month || !day) return '';
  return `${year}-${month}-${day}`;
};

const getHourInTimeZone = (dateInput, timeZoneInput) => {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return -1;
  const timeZone = normalizeLineReminderTimezone(timeZoneInput);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hourPart = parts.find((part) => part.type === 'hour');
  const parsed = Number.parseInt(String(hourPart?.value || ''), 10);
  if (!Number.isInteger(parsed)) return -1;
  return Math.min(23, Math.max(0, parsed));
};
const ADMIN_STATS_TIMEZONE = normalizeLineReminderTimezone(ADMIN_STATS_TIMEZONE_RAW);
const ADMIN_ACTIVE_ACCOUNT_RANGES = new Set(['today', 'month', 'year']);
const ADMIN_COMPLAINT_STATUSES = new Set(['open', 'in_review', 'resolved']);
const normalizeAdminActiveRange = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return ADMIN_ACTIVE_ACCOUNT_RANGES.has(normalized) ? normalized : 'today';
};
const normalizeAdminComplaintStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return ADMIN_COMPLAINT_STATUSES.has(normalized) ? normalized : 'open';
};
const toEpochMs = (value) => {
  const parsed = new Date(String(value || '').trim()).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};
const resolveUserLastActivityIso = (userInput) => {
  const user = userInput && typeof userInput === 'object' ? userInput : {};
  const candidates = [user.lastLoginAt, user.lastActiveAt, user.updatedAt, user.createdAt];
  for (const candidate of candidates) {
    if (toEpochMs(candidate) > 0) {
      return String(candidate).trim();
    }
  }
  return '';
};
const isUserActiveInRange = (userInput, rangeInput, nowInput = new Date()) => {
  const range = normalizeAdminActiveRange(rangeInput);
  const nowIsoDate = getIsoDateInTimeZone(nowInput, ADMIN_STATS_TIMEZONE);
  if (!nowIsoDate) return false;
  const lastActivityIso = resolveUserLastActivityIso(userInput);
  if (!lastActivityIso) return false;
  const activityIsoDate = getIsoDateInTimeZone(lastActivityIso, ADMIN_STATS_TIMEZONE);
  if (!activityIsoDate) return false;
  if (range === 'today') {
    return activityIsoDate === nowIsoDate;
  }
  if (range === 'month') {
    return activityIsoDate.slice(0, 7) === nowIsoDate.slice(0, 7);
  }
  return activityIsoDate.slice(0, 4) === nowIsoDate.slice(0, 4);
};
const toAdminComplaintResponse = (docId, dataInput) => {
  const data = dataInput && typeof dataInput === 'object' ? dataInput : {};
  const createdAtRaw = String(data.createdAt || '').trim();
  const createdAt = toEpochMs(createdAtRaw) > 0 ? createdAtRaw : null;
  const updatedAtRaw = String(data.updatedAt || '').trim();
  const updatedAt = toEpochMs(updatedAtRaw) > 0 ? updatedAtRaw : createdAt;
  return {
    id: String(docId || '').trim(),
    subject: String(data.subject || '').trim(),
    message: String(data.message || '').trim(),
    status: normalizeAdminComplaintStatus(data.status),
    createdAt,
    updatedAt,
    reporterId: sanitizeUserId(data.reporterId),
    reporterUsername: sanitizeUsername(data.reporterUsername),
    reporterEmail: sanitizeEmail(data.reporterEmail),
    adminNote: String(data.adminNote || '').trim(),
    resolvedAt: toEpochMs(data.resolvedAt) > 0 ? String(data.resolvedAt).trim() : null,
    resolvedById: sanitizeUserId(data.resolvedById),
  };
};
const SUPPORT_TICKET_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  CLOSED: 'closed',
};
const SUPPORT_TICKET_STATUS_SET = new Set(Object.values(SUPPORT_TICKET_STATUS));
const normalizeSupportTicketStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return SUPPORT_TICKET_STATUS_SET.has(normalized) ? normalized : SUPPORT_TICKET_STATUS.OPEN;
};
const normalizeTicketAttachment = (attachmentInput) => {
  const attachment =
    attachmentInput && typeof attachmentInput === 'object' && !Array.isArray(attachmentInput)
      ? attachmentInput
      : {};
  const id = String(attachment.id || crypto.randomUUID()).trim();
  const name = String(attachment.name || 'attachment').trim().slice(0, 180);
  const mimeType = String(attachment.mimeType || attachment.type || '').trim().toLowerCase();
  const dataUrl = String(attachment.dataUrl || attachment.base64 || '').trim();
  const size = Number(attachment.size || 0);
  if (!id || !mimeType || !dataUrl) return null;
  if (!/^data:(image|video)\//i.test(dataUrl)) return null;
  if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/')) return null;
  if (size <= 0 || size > SUPPORT_TICKET_MAX_ATTACHMENT_BYTES) return null;
  return {
    id,
    name,
    mimeType,
    size,
    dataUrl,
  };
};
const normalizeTicketAttachmentList = (attachmentsInput) =>
  (Array.isArray(attachmentsInput) ? attachmentsInput : [])
    .map((attachment) => normalizeTicketAttachment(attachment))
    .filter(Boolean)
    .slice(0, SUPPORT_TICKET_MAX_ATTACHMENTS);
const normalizeSupportTicketMessage = (docId, dataInput) => {
  const data = dataInput && typeof dataInput === 'object' && !Array.isArray(dataInput) ? dataInput : {};
  const createdAtRaw = String(data.createdAt || '').trim();
  const createdAt = toEpochMs(createdAtRaw) > 0 ? createdAtRaw : null;
  return {
    id: String(docId || '').trim(),
    ticketId: String(data.ticketId || '').trim(),
    senderUserId: sanitizeUserId(data.senderUserId),
    senderUsername: sanitizeUsername(data.senderUsername),
    senderRole: String(data.senderRole || 'user').trim().toLowerCase(),
    text: String(data.text || '').trim(),
    attachments: normalizeTicketAttachmentList(data.attachments),
    createdAt,
  };
};
const normalizeSupportTicket = (docId, dataInput) => {
  const data = dataInput && typeof dataInput === 'object' && !Array.isArray(dataInput) ? dataInput : {};
  const createdAtRaw = String(data.createdAt || '').trim();
  const createdAt = toEpochMs(createdAtRaw) > 0 ? createdAtRaw : null;
  const updatedAtRaw = String(data.updatedAt || '').trim();
  const updatedAt = toEpochMs(updatedAtRaw) > 0 ? updatedAtRaw : createdAt;
  return {
    id: String(docId || '').trim(),
    ownerUserId: sanitizeUserId(data.ownerUserId),
    ownerUsername: sanitizeUsername(data.ownerUsername),
    ownerEmail: sanitizeEmail(data.ownerEmail),
    subject: String(data.subject || '').trim(),
    status: normalizeSupportTicketStatus(data.status),
    createdAt,
    updatedAt,
    closedAt: toEpochMs(data.closedAt) > 0 ? String(data.closedAt).trim() : null,
    closedById: sanitizeUserId(data.closedById),
    closedByUsername: sanitizeUsername(data.closedByUsername),
    lastMessageAt: toEpochMs(data.lastMessageAt) > 0 ? String(data.lastMessageAt).trim() : createdAt,
    lastMessagePreview: String(data.lastMessagePreview || '').trim(),
  };
};
const toSupportRoleResponse = (userInput) => {
  const user = userInput && typeof userInput === 'object' ? userInput : {};
  const email = sanitizeEmail(user.email);
  const isRootAdmin = Boolean(email && email === ROOT_ADMIN_EMAIL);
  const isSupportAdmin = isRootAdmin || user.supportAdmin === true;
  return {
    isRootAdmin,
    isSupportAdmin,
  };
};
const getAuthUserRecord = async (authUserIdInput) => {
  const authUserId = sanitizeUserId(authUserIdInput);
  if (!authUserId) return null;
  const doc = await usersRef.doc(authUserId).get();
  if (!doc.exists) return null;
  return {
    id: doc.id,
    ...(doc.data() || {}),
  };
};
const buildSupportTicketMessagePreview = (textInput, attachmentsInput) => {
  const text = String(textInput || '').trim();
  if (text) {
    return text.slice(0, 120);
  }
  const attachmentCount = Array.isArray(attachmentsInput) ? attachmentsInput.length : 0;
  if (attachmentCount > 0) {
    return `${attachmentCount} attachment${attachmentCount > 1 ? 's' : ''}`;
  }
  return '';
};
const loadSupportTicketById = async (ticketIdInput) => {
  const ticketId = String(ticketIdInput || '').trim();
  if (!ticketId) return null;
  const doc = await supportTicketRef.doc(ticketId).get();
  if (!doc.exists) return null;
  return {
    ref: supportTicketRef.doc(ticketId),
    ticket: normalizeSupportTicket(doc.id, doc.data() || {}),
  };
};
const ensureSupportTicketAccess = (ticketInput, authUserInput, roleInput) => {
  const ticket = ticketInput && typeof ticketInput === 'object' ? ticketInput : {};
  const authUserId = sanitizeUserId(authUserInput?.id);
  const isSupportAdmin = roleInput?.isSupportAdmin === true;
  if (isSupportAdmin) return true;
  return Boolean(authUserId && ticket.ownerUserId === authUserId);
};
const supportTicketMessagesRef = (ticketIdInput) =>
  supportTicketRef.doc(String(ticketIdInput || '').trim()).collection('messages');

const normalizeLineReminderConfigRecord = (recordInput, options = {}) => {
  const includeSecrets = options?.includeSecrets === true;
  const record = recordInput && typeof recordInput === 'object' ? recordInput : {};
  const normalized = {
    userId: sanitizeUserId(record.userId),
    projectId: String(record.projectId || '').trim(),
    projectName: String(record.projectName || '').trim(),
    enabled: record.enabled === true,
    groupId: String(record.groupId || '').trim(),
    timezone: normalizeLineReminderTimezone(record.timezone),
    reminderHour: normalizeLineReminderHour(record.reminderHour),
    reminderDaysBefore: normalizeLineReminderDaysBefore(record.reminderDaysBefore),
    updatedAt: String(record.updatedAt || '').trim() || null,
    createdAt: String(record.createdAt || '').trim() || null,
    lastTestedAt: String(record.lastTestedAt || '').trim() || null,
    lastOpenTaskDigestAt: String(record.lastOpenTaskDigestAt || '').trim() || null,
    tokenConfigured: Boolean(LINE_REMINDER_CHANNEL_ACCESS_TOKEN),
    tokenPreview: buildLineTokenPreview(LINE_REMINDER_CHANNEL_ACCESS_TOKEN),
  };
  if (includeSecrets) {
    normalized.channelAccessToken = LINE_REMINDER_CHANNEL_ACCESS_TOKEN;
  }
  return normalized;
};

const toLineReminderPublicResponse = (recordInput) => {
  const normalized = normalizeLineReminderConfigRecord(recordInput);
  return {
    enabled: normalized.enabled,
    groupId: normalized.groupId,
    timezone: normalized.timezone,
    reminderHour: normalized.reminderHour,
    reminderDaysBefore: normalized.reminderDaysBefore,
    updatedAt: normalized.updatedAt,
    lastTestedAt: normalized.lastTestedAt,
    lastOpenTaskDigestAt: normalized.lastOpenTaskDigestAt,
  };
};

const clampLineText = (value, maxLength = 160) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

const normalizeLinePushMessages = (options = {}) => {
  const explicitMessages = Array.isArray(options.messages) ? options.messages.filter(Boolean) : [];
  if (explicitMessages.length > 0) return explicitMessages;
  const text = String(options.message || '').trim();
  if (!text) return [];
  return [{ type: 'text', text: text.slice(0, 4900) }];
};

const sendLinePushMessage = async ({
  channelAccessToken,
  to,
  message,
  messages,
  notificationDisabled = false,
}) => {
  const token = String(channelAccessToken || '').trim();
  const target = String(to || '').trim();
  const preparedMessages = normalizeLinePushMessages({ message, messages });
  if (!token) throw new Error('LINE channel access token is not configured.');
  if (!target) throw new Error('LINE group ID is required.');
  if (preparedMessages.length === 0) throw new Error('LINE message is empty.');

  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Line-Retry-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      to: target,
      messages: preparedMessages,
      notificationDisabled: notificationDisabled === true,
    }),
  });
  if (!response.ok) {
    const responseText = String(await response.text()).trim();
    throw new Error(
      `LINE push failed (${response.status})${responseText ? `: ${responseText.slice(0, 300)}` : ''}`
    );
  }
};

const isTaskRecord = (eventInput) => {
  const event = eventInput && typeof eventInput === 'object' ? eventInput : {};
  const recordType = String(event.recordType || '').trim().toLowerCase();
  if (recordType === 'task') return true;
  if (recordType === 'event') return false;
  return Boolean(Array.isArray(event.assigneeIds));
};

const isCompletedTaskRecord = (taskInput) => {
  const task = taskInput && typeof taskInput === 'object' ? taskInput : {};
  const status = String(task.status || '').trim().toLowerCase();
  return status === 'done' || status === 'completed' || task.completed === true;
};
const getTaskParentId = (taskInput) => String(taskInput?.parentTaskId || '').trim();
const isSubtaskTaskRecord = (taskInput) => Boolean(getTaskParentId(taskInput));
const enrichTasksWithParentTitles = (tasksInput, allTasksInput) => {
  const tasks = Array.isArray(tasksInput) ? tasksInput : [];
  const allTasks = Array.isArray(allTasksInput) ? allTasksInput : tasks;
  const taskById = new Map();
  allTasks.forEach((task) => {
    const taskId = String(task?.id || '').trim();
    if (!taskId) return;
    taskById.set(taskId, task);
  });
  return tasks.map((task) => {
    const parentTaskId = getTaskParentId(task);
    if (!parentTaskId) return task;
    const parentTask = taskById.get(parentTaskId);
    const parentTaskTitle =
      String(task?.parentTaskTitle || '').trim() ||
      String(parentTask?.title || '').trim();
    return {
      ...task,
      parentTaskId,
      parentTaskTitle,
      isSubtask: true,
    };
  });
};
const selectLineReminderTasksForNotification = (candidateTasksInput, allOpenTasksInput) => {
  const candidateTasks = enrichTasksWithParentTitles(candidateTasksInput, allOpenTasksInput);
  const allOpenTasks = enrichTasksWithParentTitles(allOpenTasksInput, allOpenTasksInput);
  const parentIdsWithOpenSubtasks = new Set();
  allOpenTasks.forEach((task) => {
    const parentTaskId = getTaskParentId(task);
    if (parentTaskId) parentIdsWithOpenSubtasks.add(parentTaskId);
  });
  const filtered = candidateTasks.filter((task) => {
    if (isSubtaskTaskRecord(task)) return true;
    const taskId = String(task?.id || '').trim();
    if (!taskId) return false;
    return !parentIdsWithOpenSubtasks.has(taskId);
  });
  return filtered.sort((left, right) => {
    const leftDate = String(left?.endDate || left?.startDate || '').trim();
    const rightDate = String(right?.endDate || right?.startDate || '').trim();
    if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
    const leftParent = String(left?.parentTaskTitle || '').trim();
    const rightParent = String(right?.parentTaskTitle || '').trim();
    if (leftParent !== rightParent) {
      return leftParent.localeCompare(rightParent, undefined, { sensitivity: 'base' });
    }
    const leftTitle = String(left?.title || '').trim();
    const rightTitle = String(right?.title || '').trim();
    return leftTitle.localeCompare(rightTitle, undefined, { sensitivity: 'base' });
  });
};

const normalizeTaskAssigneeIds = (taskInput) => {
  const task = taskInput && typeof taskInput === 'object' ? taskInput : {};
  const assigneeSet = new Set();
  (Array.isArray(task.assigneeIds) ? task.assigneeIds : []).forEach((id) => {
    const safeId = String(id || '').trim();
    if (safeId) assigneeSet.add(safeId);
  });
  const fallbackAssigneeId = String(task.assigneeId || '').trim();
  if (fallbackAssigneeId) assigneeSet.add(fallbackAssigneeId);
  return Array.from(assigneeSet);
};

const clampLineMultilineText = (value, maxLength = 400) =>
  String(value || '')
    .replace(/\r/g, '')
    .trim()
    .slice(0, maxLength);

const isSafeHttpUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());

const buildAssigneeAvatarUrl = (nameInput) => {
  const safeName = clampLineText(nameInput || 'User', 48) || 'User';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    safeName
  )}&background=E2E8F0&color=334155&size=64&rounded=true`;
};

const buildCircularRemoteAvatarUrl = (avatarUrlInput, fallbackNameInput) => {
  const rawAvatarUrl = String(avatarUrlInput || '').trim();
  if (isSafeHttpUrl(rawAvatarUrl)) {
    return `https://images.weserv.nl/?url=${encodeURIComponent(
      rawAvatarUrl
    )}&w=128&h=128&fit=cover&mask=circle&maxage=7d`;
  }
  return buildAssigneeAvatarUrl(fallbackNameInput);
};

const resolveLineMemberProfile = (teamMembersById, assigneeIdInput) => {
  const assigneeId = String(assigneeIdInput || '').trim();
  if (!assigneeId) return null;
  const rawMember = teamMembersById instanceof Map ? teamMembersById.get(assigneeId) : null;
  if (rawMember && typeof rawMember === 'object') {
    const name = clampLineText(rawMember.name || rawMember.username || assigneeId, 32) || assigneeId;
    const department = clampLineText(rawMember.department || '', 30);
    const linkedAvatarUrl = String(rawMember.avatarUrl || '').trim();
    const avatarUrl = buildCircularRemoteAvatarUrl(linkedAvatarUrl, name);
    return { id: assigneeId, name, department, avatarUrl };
  }
  const fallbackName = clampLineText(rawMember || assigneeId, 32) || assigneeId;
  return {
    id: assigneeId,
    name: fallbackName,
    department: '',
    avatarUrl: buildAssigneeAvatarUrl(fallbackName),
  };
};

const normalizeHexColor = (value, fallback = '#64748b') => {
  const hex = String(value || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    const r = hex[1];
    const g = hex[2];
    const b = hex[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
};

const tintHexColor = (hexInput, ratioInput = 0.5) => {
  const hex = normalizeHexColor(hexInput, '#64748b').slice(1);
  const ratio = Math.min(1, Math.max(0, Number(ratioInput)));
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  const nr = Math.round(r + (255 - r) * ratio);
  const ng = Math.round(g + (255 - g) * ratio);
  const nb = Math.round(b + (255 - b) * ratio);
  const toHex = (value) => value.toString(16).padStart(2, '0');
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
};

const resolveTaskStatusTone = (statusInput) => {
  const status = String(statusInput || '').trim();
  const normalized = status.toLowerCase();
  if (normalized === 'done' || normalized === 'completed') {
    return {
      label: status || 'Done',
      textColor: '#15803d',
      borderColor: '#bbf7d0',
      backgroundColor: '#dcfce7',
    };
  }
  if (normalized === 'in progress') {
    return {
      label: status || 'In Progress',
      textColor: '#1d4ed8',
      borderColor: '#bfdbfe',
      backgroundColor: '#dbeafe',
    };
  }
  if (normalized === 'review') {
    return {
      label: status || 'Review',
      textColor: '#b45309',
      borderColor: '#fde68a',
      backgroundColor: '#fef3c7',
    };
  }
  return {
    label: status || 'To Do',
    textColor: '#374151',
    borderColor: '#e5e7eb',
    backgroundColor: '#f3f4f6',
  };
};

const resolveDepartmentTone = (departmentNameInput, departmentColorMapInput) => {
  const departmentName = String(departmentNameInput || '').trim() || 'Unassigned';
  const departmentColorMap =
    departmentColorMapInput && typeof departmentColorMapInput === 'object' ? departmentColorMapInput : {};
  const lowerDepartmentName = departmentName.toLowerCase();
  const mapKeys = Object.keys(departmentColorMap);
  const matchedKey =
    mapKeys.find((key) => String(key || '').trim() === departmentName) ||
    mapKeys.find((key) => String(key || '').trim().toLowerCase() === lowerDepartmentName) ||
    '';
  const baseColor =
    lowerDepartmentName === 'unassigned'
      ? '#64748b'
      : normalizeHexColor(matchedKey ? departmentColorMap[matchedKey] : '', '#64748b');
  return {
    label: clampLineText(departmentName, 30) || 'Unassigned',
    textColor: baseColor,
    borderColor: tintHexColor(baseColor, 0.5),
    backgroundColor: tintHexColor(baseColor, 0.86),
  };
};

const splitDepartmentTokens = (rawDepartmentInput) =>
  String(rawDepartmentInput || '')
    .split(/[|,/]/)
    .map((item) => String(item || '').trim())
    .filter(Boolean);

const resolveTaskDepartmentLabels = (taskInput, assigneeProfilesInput) => {
  const task = taskInput && typeof taskInput === 'object' ? taskInput : {};
  const normalizedMap = new Map();
  const addDepartment = (nameInput) => {
    const safeDepartment = String(nameInput || '').trim();
    if (!safeDepartment) return;
    const key = safeDepartment.toLowerCase();
    if (!normalizedMap.has(key)) {
      normalizedMap.set(key, safeDepartment);
    }
  };

  (Array.isArray(assigneeProfilesInput) ? assigneeProfilesInput : []).forEach((profile) => {
    splitDepartmentTokens(profile?.department).forEach(addDepartment);
  });

  if (normalizedMap.size === 0) {
    splitDepartmentTokens(task.department).forEach(addDepartment);
  }

  if (normalizedMap.size === 0) {
    addDepartment('Unassigned');
  }

  return Array.from(normalizedMap.values());
};

const formatIsoDateDmy = (value) => {
  const iso = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return clampLineText(value, 18) || '-';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
};

const dayDiffFromTodayByTimezone = (targetDateInput, timezoneInput) => {
  const targetDate = String(targetDateInput || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return null;
  const todayDate = getIsoDateInTimeZone(new Date(), timezoneInput) || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayDate)) return null;
  const targetUtc = new Date(`${targetDate}T00:00:00.000Z`);
  const todayUtc = new Date(`${todayDate}T00:00:00.000Z`);
  if (Number.isNaN(targetUtc.getTime()) || Number.isNaN(todayUtc.getTime())) return null;
  return Math.round((targetUtc.getTime() - todayUtc.getTime()) / 86400000);
};

const buildDeadlineSummaryLabel = (dateInput, timezoneInput) => {
  const dueDate = String(dateInput || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return 'Deadline not set';
  const dayDiff = dayDiffFromTodayByTimezone(dueDate, timezoneInput);
  if (dayDiff === null) return 'Deadline not set';
  if (dayDiff > 0) return `Due in ${dayDiff} day${dayDiff > 1 ? 's' : ''}`;
  if (dayDiff === 0) return 'Due today';
  const overdueDays = Math.abs(dayDiff);
  return `Overdue ${overdueDays} day${overdueDays > 1 ? 's' : ''}`;
};

const buildLineTaskRowsForFlex = (tasksInput, options = {}) => {
  const tasks = Array.isArray(tasksInput) ? tasksInput : [];
  const maxItems = Math.max(1, Math.min(10, Number(options.maxItems || 6)));
  const memberMap = options.teamMembersById instanceof Map ? options.teamMembersById : null;
  const departmentColorMap =
    options.departmentColorMap && typeof options.departmentColorMap === 'object'
      ? options.departmentColorMap
      : {};
  const timezone = normalizeLineReminderTimezone(options.timezone);
  const displayedTasks = tasks.slice(0, maxItems);
  const rows = displayedTasks.map((task, index) => {
    const title = clampLineText(task?.title || 'Untitled task', 90);
    const parentTaskTitle = clampLineText(task?.parentTaskTitle || '', 90);
    const dueDate = String(task?.endDate || task?.startDate || '').trim();
    const statusTone = resolveTaskStatusTone(task?.status || 'To Do');
    const deadlineSummary = buildDeadlineSummaryLabel(dueDate, timezone);
    const dueDateLabel = formatIsoDateDmy(dueDate);
    const assignees = normalizeTaskAssigneeIds(task)
      .map((assigneeId) => resolveLineMemberProfile(memberMap, assigneeId))
      .filter(Boolean);
    const taskDepartments = resolveTaskDepartmentLabels(task, assignees);
    const departmentBadgeContents = taskDepartments.slice(0, 3).map((departmentName) => {
      const departmentTone = resolveDepartmentTone(departmentName, departmentColorMap);
      return {
        type: 'box',
        layout: 'vertical',
        flex: 0,
        backgroundColor: departmentTone.backgroundColor,
        borderColor: departmentTone.borderColor,
        borderWidth: '1px',
        cornerRadius: '999px',
        paddingTop: '2px',
        paddingBottom: '2px',
        paddingStart: '8px',
        paddingEnd: '8px',
        contents: [
          {
            type: 'text',
            text: departmentTone.label,
            size: 'xxs',
            weight: 'bold',
            color: departmentTone.textColor,
            wrap: true,
          },
        ],
      };
    });
    const extraDepartmentCount = Math.max(0, taskDepartments.length - departmentBadgeContents.length);
    if (extraDepartmentCount > 0) {
      departmentBadgeContents.push({
        type: 'text',
        text: `+${extraDepartmentCount}`,
        size: 'xxs',
        color: '#64748b',
      });
    }
    const assigneeAvatarContents = assignees.slice(0, 5).map((assignee) => ({
      type: 'image',
      url: assignee.avatarUrl,
      size: '32px',
      align: 'start',
      aspectMode: 'cover',
      aspectRatio: '1:1',
      flex: 0,
    }));
    const overflowAssigneeCount = Math.max(0, assignees.length - assigneeAvatarContents.length);
    if (overflowAssigneeCount > 0) {
      assigneeAvatarContents.push({
        type: 'text',
        text: `+${overflowAssigneeCount}`,
        size: 'xs',
        color: '#64748b',
      });
    }
    if (assigneeAvatarContents.length === 0) {
      assigneeAvatarContents.push({
        type: 'text',
        text: '-',
        size: 'xs',
        color: '#94a3b8',
      });
    }
    return {
      type: 'box',
      layout: 'vertical',
      spacing: '8px',
      paddingAll: '12px',
      backgroundColor: '#f8fafc',
      borderColor: '#e2e8f0',
      borderWidth: '1px',
      cornerRadius: '10px',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          alignItems: 'flex-start',
          contents: [
            {
              type: 'text',
              text: `${index + 1}. ${title}`,
              size: 'sm',
              weight: 'bold',
              color: '#0f172a',
              wrap: true,
              flex: 1,
            },
            {
              type: 'box',
              layout: 'vertical',
              flex: 0,
              backgroundColor: statusTone.backgroundColor,
              borderColor: statusTone.borderColor,
              borderWidth: '1px',
              cornerRadius: '999px',
              paddingTop: '2px',
              paddingBottom: '2px',
              paddingStart: '8px',
              paddingEnd: '8px',
              margin: 'sm',
              contents: [
                {
                  type: 'text',
                  text: clampLineText(statusTone.label, 16),
                  size: 'xxs',
                  weight: 'bold',
                  color: statusTone.textColor,
                },
              ],
            },
          ],
        },
        {
          type: 'text',
          text: clampLineText(`${deadlineSummary} | Due ${dueDateLabel}`, 180),
          size: 'xs',
          color: '#334155',
          wrap: true,
        },
        ...(parentTaskTitle
          ? [
              {
                type: 'text',
                text: clampLineText(`Task ใหญ่: ${parentTaskTitle}`, 180),
                size: 'xs',
                color: '#64748b',
                wrap: true,
              },
            ]
          : []),
        {
          type: 'box',
          layout: 'horizontal',
          spacing: '6px',
          alignItems: 'center',
          contents: departmentBadgeContents,
        },
        {
          type: 'box',
          layout: 'horizontal',
          spacing: '4px',
          alignItems: 'center',
          contents: assigneeAvatarContents,
        },
      ],
    };
  });
  return {
    rows,
    remainingCount: Math.max(0, tasks.length - displayedTasks.length),
    displayedCount: displayedTasks.length,
    totalCount: tasks.length,
  };
};

const buildLineCardFlexMessage = ({
  headerLabel = 'PM Calendar',
  altText,
  title,
  subtitle,
  accentColor = '#2563eb',
  statLabel = '',
  statValue = '',
  rows = [],
  footerNote = '',
}) => {
  const safeHeaderLabel = clampLineText(headerLabel, 50) || 'PM Calendar';
  const safeAltText = clampLineText(altText, 380) || 'PM Calendar update';
  const safeTitle = clampLineText(title, 64) || 'PM Calendar';
  const safeSubtitle = clampLineText(subtitle, 120);
  const safeStatLabel = clampLineText(statLabel, 32);
  const safeStatValue = clampLineText(statValue, 42);
  const safeFooterNote = clampLineText(footerNote, 180);
  return {
    type: 'flex',
    altText: safeAltText,
    contents: {
      type: 'bubble',
      size: 'mega',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: '12px',
        paddingAll: '16px',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            spacing: '4px',
            paddingAll: '12px',
            cornerRadius: '12px',
            backgroundColor: accentColor,
            contents: [
              {
                type: 'text',
                text: safeHeaderLabel,
                size: 'xs',
                color: '#ffffffcc',
              },
              {
                type: 'text',
                text: safeTitle,
                size: 'lg',
                weight: 'bold',
                color: '#ffffff',
                wrap: true,
              },
              ...(safeSubtitle
                ? [
                    {
                      type: 'text',
                      text: safeSubtitle,
                      size: 'xs',
                      color: '#ffffffcc',
                      wrap: true,
                    },
                  ]
                : []),
            ],
          },
          ...(safeStatLabel || safeStatValue
            ? [
                {
                  type: 'box',
                  layout: 'horizontal',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingAll: '10px',
                  cornerRadius: '10px',
                  backgroundColor: '#eef2ff',
                  contents: [
                    {
                      type: 'text',
                      text: safeStatLabel || 'Summary',
                      size: 'xs',
                      color: '#475569',
                    },
                    {
                      type: 'text',
                      text: safeStatValue || '-',
                      size: 'sm',
                      weight: 'bold',
                      color: '#1e293b',
                    },
                  ],
                },
              ]
            : []),
          {
            type: 'box',
            layout: 'vertical',
            spacing: '8px',
            contents:
              Array.isArray(rows) && rows.length > 0
                ? rows
                : [
                    {
                      type: 'text',
                      text: 'No data',
                      size: 'sm',
                      color: '#64748b',
                    },
                  ],
          },
          ...(safeFooterNote
            ? [
                {
                  type: 'text',
                  text: safeFooterNote,
                  size: 'xs',
                  color: '#64748b',
                  wrap: true,
                },
              ]
            : []),
        ],
      },
    },
  };
};

const buildLineAnnouncementMessage = ({ projectName, message }) => {
  const safeProjectName = String(projectName || '').trim() || 'Project';
  const content = clampLineMultilineText(message, 700) || '-';
  return {
    type: 'flex',
    altText: clampLineText(`[PM Calendar] ${safeProjectName}: ${content}`, 360),
    contents: {
      type: 'bubble',
      size: 'mega',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: '12px',
        paddingAll: '16px',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            spacing: '8px',
            paddingAll: '14px',
            cornerRadius: '12px',
            backgroundColor: '#0ea5e9',
            contents: [
              {
                type: 'text',
                text: safeProjectName,
                size: 'sm',
                color: '#ffffffcc',
                wrap: true,
              },
              {
                type: 'text',
                text: content,
                size: 'xl',
                weight: 'bold',
                color: '#ffffff',
                wrap: true,
              },
            ],
          },
        ],
      },
    },
  };
};

const buildLineOpenTasksDigestMessage = ({
  projectName,
  tasks,
  teamMembersById,
  departmentColorMap,
  timezone,
}) => {
  const safeProjectName = String(projectName || '').trim() || 'Project';
  const taskList = Array.isArray(tasks) ? tasks : [];
  const taskRows = buildLineTaskRowsForFlex(taskList, {
    maxItems: 6,
    teamMembersById,
    departmentColorMap,
    timezone,
  });
  const footerNote =
    taskRows.remainingCount > 0
      ? `Showing ${taskRows.displayedCount} of ${taskRows.totalCount} tasks`
      : `Total ${taskRows.totalCount} tasks`;
  return buildLineCardFlexMessage({
    headerLabel: safeProjectName,
    altText: `[PM Calendar] Open tasks ${safeProjectName} (${taskRows.totalCount})`,
    title: 'Open Task Summary',
    accentColor: '#2563eb',
    statLabel: 'Open Tasks',
    statValue: `${taskRows.totalCount} tasks`,
    rows: taskRows.rows,
    footerNote,
  });
};

const buildLineReminderMessage = ({
  projectName,
  targetDate,
  daysBefore = 1,
  tasks,
  teamMembersById,
  departmentColorMap,
  timezone,
}) => {
  const safeProjectName = String(projectName || '').trim() || 'Project';
  const safeDate = String(targetDate || '').trim();
  const safeDaysBefore = Math.max(1, Number.parseInt(String(daysBefore || 1), 10) || 1);
  const taskList = Array.isArray(tasks) ? tasks : [];
  const taskRows = buildLineTaskRowsForFlex(taskList, {
    maxItems: 6,
    teamMembersById,
    departmentColorMap,
    timezone,
  });
  const subtitle = safeDate ? `${safeProjectName} | Due ${safeDate}` : safeProjectName;
  const footerNote =
    taskRows.remainingCount > 0
      ? `Showing ${taskRows.displayedCount} of ${taskRows.totalCount} tasks`
      : `Total ${taskRows.totalCount} tasks`;
  return buildLineCardFlexMessage({
    headerLabel: safeProjectName,
    altText: `[PM Calendar] Due in ${safeDaysBefore} day(s) ${safeProjectName} (${taskRows.totalCount})`,
    title: `Tasks Due in ${safeDaysBefore} day${safeDaysBefore > 1 ? 's' : ''}`,
    subtitle,
    accentColor: '#f59e0b',
    statLabel: 'Reminder',
    statValue: `${safeDaysBefore} day${safeDaysBefore > 1 ? 's' : ''} before`,
    rows: taskRows.rows,
    footerNote,
  });
};

const isValidLineWebhookSignature = (req) => {
  if (!LINE_CHANNEL_SECRET) return false;
  const signature = String(req.get('x-line-signature') || '').trim();
  if (!signature || !req.rawBody) return false;
  const expected = crypto
    .createHmac('sha256', LINE_CHANNEL_SECRET)
    .update(req.rawBody)
    .digest('base64');
  const incomingBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (incomingBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(incomingBuffer, expectedBuffer);
};

const sendLineReplyMessage = async ({ replyToken, message }) => {
  const token = String(LINE_WEBHOOK_CHANNEL_ACCESS_TOKEN || '').trim();
  const safeReplyToken = String(replyToken || '').trim();
  const text = String(message || '').trim();
  if (!token || !safeReplyToken || !text) return;
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      replyToken: safeReplyToken,
      messages: [{ type: 'text', text: text.slice(0, 4900) }],
    }),
  });
  if (!response.ok) {
    const responseText = String(await response.text()).trim();
    throw new Error(
      `LINE reply failed (${response.status})${responseText ? `: ${responseText.slice(0, 220)}` : ''}`
    );
  }
};

const normalizeLineCommandText = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

const isLineGroupIdCommand = (value) => {
  const normalized = normalizeLineCommandText(value);
  return new Set([
    '/groupid',
    'groupid',
    '/group-id',
    'group-id',
    '/linegroupid',
    'linegroupid',
    '/gid',
    'gid',
  ]).has(normalized);
};

const normalizeGoogleEventColorId = (value) => {
  const colorId = String(value || '').trim();
  return /^(?:[1-9]|1[0-1])$/.test(colorId) ? colorId : '';
};
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME_PATTERN = /^\d{2}:\d{2}$/;

const normalizeGoogleCalendarEvent = (googleEvent, calendarContext = null) => {
  const googleEventId = String(googleEvent?.id || '').trim();
  if (!googleEventId) return null;
  const pmCalendarEventId = String(
    googleEvent?.extendedProperties?.private?.pmCalendarEventId || ''
  ).trim();
  const recordType = String(
    googleEvent?.extendedProperties?.private?.recordType || ''
  ).trim().toLowerCase();
  const department = String(
    googleEvent?.extendedProperties?.private?.department || ''
  ).trim();
  const calendarId = String(calendarContext?.id || 'primary').trim() || 'primary';
  const calendarName =
    String(calendarContext?.summary || calendarContext?.id || 'Google Calendar').trim() ||
    'Google Calendar';
  const calendarIdKey = calendarId.replace(/[^a-z0-9_-]/gi, '_');

  const startData = googleEvent?.start || {};
  const endData = googleEvent?.end || {};
  let startDate = '';
  let endDate = '';
  let startTime = '00:00';
  let endTime = '23:59';

  if (startData.date) {
    startDate = String(startData.date).trim();
    const endExclusive = String(endData.date || startData.date).trim() || startDate;
    endDate = shiftIsoDateByDays(endExclusive, -1) || startDate;
    if (endDate < startDate) endDate = startDate;
  } else {
    const startDateTime = String(startData.dateTime || '').trim();
    if (!startDateTime.includes('T')) return null;
    startDate = startDateTime.slice(0, 10);
    startTime = startDateTime.slice(11, 16) || '00:00';

    const endDateTime = String(endData.dateTime || '').trim();
    if (endDateTime.includes('T')) {
      endDate = endDateTime.slice(0, 10);
      endTime = endDateTime.slice(11, 16) || '23:59';
    } else if (endData.date) {
      endDate = shiftIsoDateByDays(String(endData.date).trim(), -1) || startDate;
      endTime = '23:59';
    } else {
      endDate = startDate;
      endTime = '23:59';
    }
  }

  if (!startDate) return null;
  if (!endDate || endDate < startDate) endDate = startDate;

  return {
    id: `google-${calendarIdKey}-${googleEventId}`,
    googleEventId,
    iCalUID: String(googleEvent?.iCalUID || '').trim(),
    pmCalendarEventId,
    calendarId,
    calendarName,
    projectId: GOOGLE_CALENDAR_PROJECT_ID,
    source: 'google',
    recordType: recordType === 'task' ? 'task' : 'event',
    department,
    readOnly: true,
    title: String(googleEvent?.summary || '(Untitled Google event)').trim(),
    description: String(googleEvent?.description || '').trim(),
    location: String(googleEvent?.location || '').trim(),
    htmlLink: String(googleEvent?.htmlLink || '').trim(),
    startDate,
    endDate,
    startTime,
    endTime,
  };
};

const fetchGoogleProfileFromAccessToken = async (accessToken) => {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to verify Google account profile.');
  }
  const profile = await response.json();
  return {
    email: sanitizeEmail(profile?.email),
    emailVerified: profile?.email_verified === true || profile?.email_verified === 'true',
  };
};

const verifyGoogleIdentityFromTokens = async ({ idToken, accessToken }) => {
  const normalizedIdToken = String(idToken || '').trim();
  const normalizedAccessToken = String(accessToken || '').trim();
  if (!normalizedIdToken && !normalizedAccessToken) {
    throw new Error('Google token is required.');
  }

  if (normalizedIdToken) {
    if (!oauthClient || !GOOGLE_CLIENT_ID) {
      throw new Error('Google OAuth is not configured.');
    }
    const ticket = await oauthClient.verifyIdToken({
      idToken: normalizedIdToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    return {
      email: sanitizeEmail(payload?.email),
      emailVerified: payload?.email_verified === true || payload?.email_verified === 'true',
    };
  }

  return fetchGoogleProfileFromAccessToken(normalizedAccessToken);
};

const fetchGoogleCalendarList = async (accessToken) => {
  const calendars = [];
  let pageToken = '';

  for (let page = 0; page < 10; page += 1) {
    const params = new URLSearchParams({
      minAccessRole: 'reader',
      showDeleted: 'false',
      showHidden: 'true',
      maxResults: '250',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/users/me/calendarList?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Google Calendar list API request failed (${response.status}).`);
    }

    const payload = await response.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];
    items.forEach((item) => {
      const calendarId = String(item?.id || '').trim();
      if (!calendarId) return;
      calendars.push({
        id: calendarId,
        summary: String(item?.summary || calendarId).trim() || calendarId,
        primary: item?.primary === true,
        accessRole: String(item?.accessRole || '').trim(),
        backgroundColor: String(item?.backgroundColor || '').trim(),
      });
    });

    pageToken = String(payload?.nextPageToken || '').trim();
    if (!pageToken) break;
  }

  return calendars;
};
const GOOGLE_CALENDAR_WRITABLE_ROLES = new Set(['owner', 'writer']);
const canWriteToGoogleCalendar = (calendar) =>
  GOOGLE_CALENDAR_WRITABLE_ROLES.has(String(calendar?.accessRole || '').trim().toLowerCase());

const fetchGoogleCalendarEvents = async (accessToken, timeMin, timeMax, selectedCalendarIds = []) => {
  const calendars = await fetchGoogleCalendarList(accessToken);
  const selectedIds = filterGoogleCalendarSelectionByAvailableCalendars(selectedCalendarIds, calendars);
  const selectedSet = new Set(selectedIds);
  const filteredCalendars = selectedIds.length > 0
    ? calendars.filter((calendar) => selectedSet.has(calendar.id))
    : calendars;
  const calendarsToFetch = (selectedIds.length > 0
    ? filteredCalendars
    : calendars.length > 0
    ? calendars
    : [{ id: 'primary', summary: 'Primary', primary: true }]).slice(0, 60);
  const dedupeMap = new Map();

  for (const calendar of calendarsToFetch) {
    let pageToken = '';

    for (let page = 0; page < 10; page += 1) {
      const params = new URLSearchParams({
        singleEvents: 'true',
        orderBy: 'startTime',
        timeMin,
        timeMax,
        maxResults: '2500',
      });
      if (pageToken) params.set('pageToken', pageToken);

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          calendar.id
        )}/events?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        // Skip inaccessible calendars instead of failing whole merge view.
        if (response.status === 403 || response.status === 404) {
          console.warn(
            `Skipping Google calendar "${calendar.id}" due to access error (${response.status}).`
          );
          break;
        }
        throw new Error(`Google Calendar API request failed (${response.status}).`);
      }

      const payload = await response.json();
      const items = Array.isArray(payload?.items) ? payload.items : [];
      items.forEach((item) => {
        const normalized = normalizeGoogleCalendarEvent(item, calendar);
        if (!normalized) return;

        const dedupeKey = [
          normalized.iCalUID || normalized.googleEventId,
          normalized.startDate,
          normalized.endDate,
          normalized.startTime,
          normalized.endTime,
          normalized.title,
        ].join('|');

        if (!dedupeMap.has(dedupeKey)) {
          dedupeMap.set(dedupeKey, normalized);
        }
      });

      pageToken = String(payload?.nextPageToken || '').trim();
      if (!pageToken) break;
    }
  }

  const events = Array.from(dedupeMap.values()).sort((a, b) => {
    const aKey = `${a.startDate}T${a.startTime}`;
    const bKey = `${b.startDate}T${b.startTime}`;
    return aKey.localeCompare(bKey);
  });

  return {
    events,
    calendars,
    selectedCalendarIds: selectedIds,
  };
};

const sendGoogleCalendarPopupResponse = (res, payload) => {
  const safePayload = JSON.stringify({
    type: 'PM_CALENDAR_GOOGLE_CALENDAR_LINK',
    ok: payload?.ok === true,
    message: String(payload?.message || ''),
  }).replace(/</g, '\\u003c');

  res
    .status(payload?.ok === true ? 200 : 400)
    .type('html')
    .send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Google Calendar Link</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="font-family:Arial,sans-serif;padding:24px;">
    <p>${payload?.ok === true ? 'Google Calendar linked. You can close this window.' : 'Failed to link Google Calendar.'}</p>
    <script>
      (function () {
        var payload = ${safePayload};
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(payload, '*');
          }
        } catch (error) {}
        window.setTimeout(function () { window.close(); }, 120);
      })();
    </script>
  </body>
</html>`);
};

const splitIntoChunks = (value, chunkSize) => {
  const text = String(value || '');
  if (!text) return [''];
  const parts = [];
  for (let index = 0; index < text.length; index += chunkSize) {
    parts.push(text.slice(index, index + chunkSize));
  }
  return parts;
};

const readAccountPayloadRecordFromStore = async (userId) => {
  const userDataDocRef = appDataRef.doc(userId);
  const metaDoc = await userDataDocRef.get();
  if (!metaDoc.exists) {
    return {
      payload: {},
      version: 0,
      updatedAt: null,
    };
  }

  const metaData = metaDoc.data() || {};
  const version = toSafeInteger(metaData.version, 0);
  const updatedAt = metaData.updatedAt ? String(metaData.updatedAt) : null;
  const directPayload = metaData.payload;
  if (directPayload && typeof directPayload === 'object' && !Array.isArray(directPayload)) {
    return {
      payload: directPayload,
      version,
      updatedAt,
    };
  }

  const chunkCount = Number(metaData.chunkCount || 0);
  if (!Number.isInteger(chunkCount) || chunkCount <= 0) {
    return {
      payload: {},
      version,
      updatedAt,
    };
  }

  const chunksSnapshot = await userDataDocRef
    .collection(APP_DATA_CHUNK_COLLECTION)
    .orderBy('index', 'asc')
    .limit(chunkCount)
    .get();

  if (chunksSnapshot.empty) {
    return {
      payload: {},
      version,
      updatedAt,
    };
  }

  const serialized = chunksSnapshot.docs
    .map((doc) => String(doc.data()?.data || ''))
    .join('');
  if (!serialized) {
    return {
      payload: {},
      version,
      updatedAt,
    };
  }

  try {
    const parsed = JSON.parse(serialized);
    return {
      payload: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {},
      version,
      updatedAt,
    };
  } catch {
    return {
      payload: {},
      version,
      updatedAt,
    };
  }
};

const readAccountPayloadFromStore = async (userId) => {
  const record = await readAccountPayloadRecordFromStore(userId);
  return record?.payload && typeof record.payload === 'object' && !Array.isArray(record.payload)
    ? record.payload
    : {};
};

const loadOwnedProjectById = async ({ userId, projectId, authUsername }) => {
  const normalizedUserId = sanitizeUserId(userId);
  const normalizedProjectId = String(projectId || '').trim();
  if (!normalizedUserId || !normalizedProjectId) {
    return { payload: {}, foundProject: null, project: null, isOwner: false };
  }

  const payload = await readAccountPayloadFromStore(normalizedUserId);
  const projects = Array.isArray(payload?.projects) ? payload.projects : [];
  const foundProject =
    projects.find((project) => String(project?.id || '').trim() === normalizedProjectId) || null;
  if (!foundProject) {
    return { payload, foundProject: null, project: null, isOwner: false };
  }

  const ownerId = sanitizeUserId(foundProject?.ownerId);
  const ownerUsername = sanitizeUsername(foundProject?.ownerUsername);
  const normalizedAuthUsername = sanitizeUsername(authUsername);
  const isOwner =
    (ownerId && ownerId === normalizedUserId) ||
    (!ownerId && normalizedAuthUsername && ownerUsername === normalizedAuthUsername);

  return {
    payload,
    foundProject,
    project: isOwner ? foundProject : null,
    isOwner,
  };
};

const writeAccountPayloadToStore = async (userId, payload, options = {}) => {
  const userDataDocRef = appDataRef.doc(userId);
  const serializedPayload = JSON.stringify(payload);
  const chunks = splitIntoChunks(serializedPayload, APP_DATA_CHUNK_SIZE);
  const requestedBaseVersionRaw = options?.baseVersion;
  const hasRequestedBaseVersion =
    requestedBaseVersionRaw !== undefined && requestedBaseVersionRaw !== null && requestedBaseVersionRaw !== '';
  const requestedBaseVersion = hasRequestedBaseVersion
    ? toSafeInteger(requestedBaseVersionRaw, -1)
    : null;
  const nowIso = new Date().toISOString();
  let nextVersion = 0;

  try {
    await firestore.runTransaction(async (transaction) => {
      const metaSnapshot = await transaction.get(userDataDocRef);
      const metaData = metaSnapshot.exists ? metaSnapshot.data() || {} : {};
      const currentVersion = toSafeInteger(metaData.version, 0);
      if (
        hasRequestedBaseVersion &&
        requestedBaseVersion !== null &&
        requestedBaseVersion >= 0 &&
        requestedBaseVersion !== currentVersion
      ) {
        const conflictError = new Error('Account data version conflict.');
        conflictError.code = 'ACCOUNT_VERSION_CONFLICT';
        throw conflictError;
      }

      const previousChunkCount = toSafeInteger(metaData.chunkCount, 0);
      nextVersion = currentVersion + 1;

      transaction.set(
        userDataDocRef,
        {
          chunkCount: chunks.length,
          updatedAt: nowIso,
          version: nextVersion,
        },
        { merge: true }
      );

      chunks.forEach((chunk, index) => {
        const chunkDocRef = userDataDocRef.collection(APP_DATA_CHUNK_COLLECTION).doc(`part_${index}`);
        transaction.set(chunkDocRef, {
          index,
          data: chunk,
        });
      });

      for (let index = chunks.length; index < previousChunkCount; index += 1) {
        const chunkDocRef = userDataDocRef.collection(APP_DATA_CHUNK_COLLECTION).doc(`part_${index}`);
        transaction.delete(chunkDocRef);
      }
    });
  } catch (error) {
    if (error?.code === 'ACCOUNT_VERSION_CONFLICT') {
      const latest = await readAccountPayloadRecordFromStore(userId);
      const conflictError = new Error('Account data version conflict.');
      conflictError.code = 'ACCOUNT_VERSION_CONFLICT';
      conflictError.currentPayload = latest.payload || {};
      conflictError.currentVersion = toSafeInteger(latest.version, 0);
      conflictError.currentUpdatedAt = latest.updatedAt || null;
      throw conflictError;
    }
    throw error;
  }

  return {
    version: nextVersion,
    updatedAt: nowIso,
  };
};

const AI_ACTION_TYPES = {
  CREATE_TASK: 'create_task',
  DELETE_EVENT: 'delete_event',
  NOTIFY_OPEN_TASKS: 'notify_open_tasks',
};
const AI_VALID_ACTION_TYPES = new Set(Object.values(AI_ACTION_TYPES));

const aiThreadMessagesRef = (threadIdInput) =>
  aiThreadRef.doc(String(threadIdInput || '').trim()).collection('messages');

const buildAiId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return crypto.randomBytes(16).toString('hex');
  }
};

const sanitizeAiThreadTitle = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

const sanitizeAiMessageContent = (value, maxLength = AI_CHAT_MAX_USER_MESSAGE_LENGTH) =>
  String(value || '')
    .replace(/\r/g, '')
    .trim()
    .slice(0, Math.max(1, maxLength));

const buildAiThreadMessagePreview = (value) =>
  sanitizeAiMessageContent(value, AI_THREAD_MESSAGE_PREVIEW_LIMIT);

const normalizeIsoDate = (value) => {
  const date = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
};

const normalizeIsoTime = (value) => {
  const time = String(value || '').trim();
  return /^\d{2}:\d{2}$/.test(time) ? time : '';
};

const clampAiCount = (value, fallback = 5, min = 1, max = 20) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const parseJsonObjectSafe = (value) => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const normalizeAiPendingAction = (valueInput) => {
  const value = valueInput && typeof valueInput === 'object' ? valueInput : {};
  const id = String(value.id || '').trim();
  const type = String(value.type || '').trim();
  const createdAt = String(value.createdAt || '').trim();
  const expiresAt = String(value.expiresAt || '').trim();
  const payload =
    value.payload && typeof value.payload === 'object' && !Array.isArray(value.payload)
      ? value.payload
      : {};
  const summary = String(value.summary || '').trim().slice(0, 300);
  if (!id || !AI_VALID_ACTION_TYPES.has(type) || !createdAt || !expiresAt) return null;
  const expiresAtMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return null;
  return {
    id,
    type,
    summary,
    payload,
    createdAt,
    expiresAt,
  };
};

const toAiThreadPublicResponse = (docId, dataInput) => {
  const data = dataInput && typeof dataInput === 'object' ? dataInput : {};
  const createdAt = String(data.createdAt || '').trim() || null;
  const updatedAt = String(data.updatedAt || '').trim() || createdAt;
  return {
    id: String(docId || '').trim(),
    userId: sanitizeUserId(data.userId),
    title: sanitizeAiThreadTitle(data.title) || 'New chat',
    lastMessagePreview: buildAiThreadMessagePreview(data.lastMessagePreview || ''),
    createdAt,
    updatedAt,
    pendingAction: normalizeAiPendingAction(data.pendingAction),
  };
};

const toAiMessagePublicResponse = (docId, dataInput) => {
  const data = dataInput && typeof dataInput === 'object' ? dataInput : {};
  const roleRaw = String(data.role || '').trim().toLowerCase();
  const role = roleRaw === 'assistant' || roleRaw === 'system' ? roleRaw : 'user';
  return {
    id: String(docId || '').trim(),
    threadId: String(data.threadId || '').trim(),
    role,
    content: sanitizeAiMessageContent(data.content || '', 12000),
    createdAt: String(data.createdAt || '').trim() || null,
    pendingActionId: String(data.pendingActionId || '').trim(),
    attachments: normalizeAiInputAttachments(data.attachments),
  };
};

const loadAiThreadForUser = async ({ threadId, userId }) => {
  const normalizedThreadId = String(threadId || '').trim();
  const normalizedUserId = sanitizeUserId(userId);
  if (!normalizedThreadId || !normalizedUserId) return null;
  const docRef = aiThreadRef.doc(normalizedThreadId);
  const snapshot = await docRef.get();
  if (!snapshot.exists) return null;
  const thread = toAiThreadPublicResponse(snapshot.id, snapshot.data() || {});
  if (thread.userId !== normalizedUserId) return null;
  return {
    ref: docRef,
    thread,
  };
};

const trimAiThreadMessages = async (threadIdInput, keepLimit = AI_THREAD_MAX_MESSAGES) => {
  const threadId = String(threadIdInput || '').trim();
  if (!threadId) return;
  const snapshot = await aiThreadMessagesRef(threadId).orderBy('createdAt', 'asc').get();
  if (snapshot.empty || snapshot.docs.length <= keepLimit) return;
  const overflow = snapshot.docs.length - keepLimit;
  const deletes = snapshot.docs.slice(0, overflow).map((doc) => doc.ref.delete());
  if (deletes.length > 0) {
    await Promise.all(deletes);
  }
};

const deleteAiThreadMessages = async (threadIdInput, pageSize = 250) => {
  const threadId = String(threadIdInput || '').trim();
  if (!threadId) return 0;
  const safePageSize = Math.max(20, Math.min(500, Number(pageSize || 250)));
  let deletedCount = 0;
  while (true) {
    const snapshot = await aiThreadMessagesRef(threadId)
      .orderBy('createdAt', 'asc')
      .limit(safePageSize)
      .get();
    if (snapshot.empty) break;
    await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
    deletedCount += snapshot.docs.length;
    if (snapshot.docs.length < safePageSize) break;
  }
  return deletedCount;
};

const saveAiThreadMessage = async ({
  threadId,
  role,
  content,
  pendingActionId = '',
  attachments = [],
}) => {
  const normalizedThreadId = String(threadId || '').trim();
  if (!normalizedThreadId) return null;
  const safeRole = String(role || '').trim().toLowerCase() === 'assistant' ? 'assistant' : 'user';
  const safeContent = sanitizeAiMessageContent(content, 12000);
  if (!safeContent) return null;
  const safeAttachments = normalizeAiInputAttachments(attachments);
  const createdAt = new Date().toISOString();
  const docRef = aiThreadMessagesRef(normalizedThreadId).doc(buildAiId());
  await docRef.set({
    id: docRef.id,
    threadId: normalizedThreadId,
    role: safeRole,
    content: safeContent,
    pendingActionId: String(pendingActionId || '').trim(),
    attachments: safeAttachments,
    createdAt,
  });
  return toAiMessagePublicResponse(docRef.id, {
    id: docRef.id,
    threadId: normalizedThreadId,
    role: safeRole,
    content: safeContent,
    pendingActionId,
    attachments: safeAttachments,
    createdAt,
  });
};

const getPayloadProjects = (payloadInput) =>
  Array.isArray(payloadInput?.projects) ? payloadInput.projects : [];

const getPayloadEvents = (payloadInput) => (Array.isArray(payloadInput?.events) ? payloadInput.events : []);

const getProjectByIdFromPayload = (payloadInput, projectIdInput) => {
  const projectId = String(projectIdInput || '').trim();
  if (!projectId) return null;
  const projects = getPayloadProjects(payloadInput);
  return projects.find((project) => String(project?.id || '').trim() === projectId) || null;
};

const getProjectNameByIdFromPayload = (payloadInput, projectIdInput) => {
  const project = getProjectByIdFromPayload(payloadInput, projectIdInput);
  return String(project?.name || projectIdInput || '').trim() || '';
};

const AI_PROJECT_SCOPE_MODES = {
  MERGE: 'merge',
  SELECTED: 'selected',
};
const AI_PROJECT_SCOPE_MODE_SET = new Set(Object.values(AI_PROJECT_SCOPE_MODES));

const normalizeAiProjectScopeMode = (valueInput) => {
  const mode = String(valueInput || '').trim().toLowerCase();
  return AI_PROJECT_SCOPE_MODE_SET.has(mode) ? mode : AI_PROJECT_SCOPE_MODES.MERGE;
};

const resolveAiProjectScopeFromRequest = ({ payload, scopeInput }) => {
  const scope = scopeInput && typeof scopeInput === 'object' && !Array.isArray(scopeInput) ? scopeInput : {};
  const mode = normalizeAiProjectScopeMode(scope.mode);
  const projects = getPayloadProjects(payload);
  const validProjectIds = new Set(
    projects.map((project) => String(project?.id || '').trim()).filter(Boolean)
  );
  const requestedProjectIds = Array.from(
    new Set(
      (Array.isArray(scope.projectIds) ? scope.projectIds : [])
        .map((id) => String(id || '').trim())
        .filter((id) => id && validProjectIds.has(id))
    )
  );
  if (mode !== AI_PROJECT_SCOPE_MODES.SELECTED) {
    return {
      mode: AI_PROJECT_SCOPE_MODES.MERGE,
      projectIds: Array.from(validProjectIds),
    };
  }
  if (requestedProjectIds.length === 0) {
    return {
      mode: AI_PROJECT_SCOPE_MODES.MERGE,
      projectIds: Array.from(validProjectIds),
    };
  }
  return {
    mode: AI_PROJECT_SCOPE_MODES.SELECTED,
    projectIds: requestedProjectIds,
  };
};

const applyAiProjectScopeToPayload = ({ payload, scope }) => {
  const safePayload = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const projects = getPayloadProjects(safePayload);
  const events = getPayloadEvents(safePayload);
  const scopeProjectIds = new Set(
    (Array.isArray(scope?.projectIds) ? scope.projectIds : [])
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  );
  if (scopeProjectIds.size === 0) {
    return safePayload;
  }
  const scopedProjects = projects.filter((project) =>
    scopeProjectIds.has(String(project?.id || '').trim())
  );
  const scopedEvents = events.filter((event) =>
    scopeProjectIds.has(String(event?.projectId || '').trim())
  );
  return {
    ...safePayload,
    projects: scopedProjects,
    events: scopedEvents,
  };
};

const normalizeAiInputAttachments = (attachmentsInput) =>
  (Array.isArray(attachmentsInput) ? attachmentsInput : [])
    .slice(0, AI_INPUT_ATTACHMENT_MAX_COUNT)
    .map((item) => (item && typeof item === 'object' && !Array.isArray(item) ? item : null))
    .filter(Boolean)
    .map((attachment) => {
      const mimeType = String(attachment.mimeType || '').trim().slice(0, 120);
      const previewDataUrlRaw = String(attachment.previewDataUrl || '').trim();
      const isImagePreview = /^data:image\//i.test(previewDataUrlRaw);
      return {
        name: String(attachment.name || 'attachment').trim().slice(0, 180) || 'attachment',
        mimeType,
        size: Math.max(0, Number.parseInt(String(attachment.size || 0), 10) || 0),
        textPreview: sanitizeAiMessageContent(
          String(attachment.textPreview || '').trim(),
          AI_INPUT_ATTACHMENT_TEXT_PREVIEW_LIMIT
        ),
        previewDataUrl:
          isImagePreview && previewDataUrlRaw.length <= AI_INPUT_IMAGE_PREVIEW_MAX_CHARS
            ? previewDataUrlRaw
            : '',
      };
    });

const buildAiRequestContextNote = ({ payload, scope, attachments }) => {
  const lines = [];
  if (scope?.mode === AI_PROJECT_SCOPE_MODES.SELECTED) {
    const selectedIds = Array.isArray(scope.projectIds) ? scope.projectIds : [];
    const selectedNames = selectedIds
      .map((projectId) => getProjectNameByIdFromPayload(payload, projectId))
      .filter(Boolean);
    if (selectedNames.length > 0) {
      lines.push(`User selected project scope: ${selectedNames.join(', ')}`);
      lines.push('Only answer and execute actions within selected project scope.');
    }
  } else {
    lines.push('User selected merge view scope (all projects).');
  }
  const safeAttachments = Array.isArray(attachments) ? attachments : [];
  if (safeAttachments.length > 0) {
    const imageAttachmentCount = safeAttachments.filter((attachment) =>
      /^data:image\//i.test(String(attachment?.previewDataUrl || '').trim())
    ).length;
    lines.push('User attached files (metadata and optional text preview):');
    if (imageAttachmentCount > 0) {
      lines.push(`Image attachments available for model vision: ${imageAttachmentCount}`);
    }
    safeAttachments.forEach((attachment, index) => {
      const name = String(attachment?.name || 'attachment').trim() || 'attachment';
      const mimeType = String(attachment?.mimeType || '').trim() || 'unknown';
      const size = Math.max(0, Number.parseInt(String(attachment?.size || 0), 10) || 0);
      lines.push(`${index + 1}. ${name} (${mimeType}, ${size} bytes)`);
      const preview = sanitizeAiMessageContent(
        String(attachment?.textPreview || '').trim(),
        AI_INPUT_ATTACHMENT_TEXT_PREVIEW_LIMIT
      );
      if (preview) {
        lines.push(`Preview:\n${preview}`);
      }
    });
  }
  return sanitizeAiMessageContent(lines.join('\n'), 12000);
};

const toDateTimeMs = (dateInput, timeInput, endOfDayFallback = false) => {
  const date = normalizeIsoDate(dateInput);
  if (!date) return 0;
  const time = normalizeIsoTime(timeInput) || (endOfDayFallback ? '23:59' : '00:00');
  const parsed = new Date(`${date}T${time}:00`).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const isEventOverlappingDate = (eventInput, dateInput) => {
  const date = normalizeIsoDate(dateInput);
  if (!date) return false;
  const event = eventInput && typeof eventInput === 'object' ? eventInput : {};
  const startDate = normalizeIsoDate(event.startDate || event.endDate);
  const endDate = normalizeIsoDate(event.endDate || event.startDate || event.endDate);
  if (!startDate || !endDate) return false;
  return startDate <= date && endDate >= date;
};

const toAiAgendaItem = (payloadInput, eventInput) => {
  const event = eventInput && typeof eventInput === 'object' ? eventInput : {};
  const isTask = isTaskRecord(event);
  return {
    id: String(event.id || '').trim(),
    type: isTask ? 'task' : 'event',
    title: String(event.title || '').trim() || (isTask ? 'Untitled task' : 'Untitled event'),
    projectId: String(event.projectId || '').trim(),
    projectName: getProjectNameByIdFromPayload(payloadInput, event.projectId),
    startDate: normalizeIsoDate(event.startDate || ''),
    startTime: normalizeIsoTime(event.startTime || ''),
    endDate: normalizeIsoDate(event.endDate || ''),
    endTime: normalizeIsoTime(event.endTime || ''),
    status: isTask ? String(event.status || '').trim() || 'To Do' : '',
    department: String(event.department || '').trim(),
    assigneeIds: normalizeTaskAssigneeIds(event),
  };
};

const buildAiAgendaForDate = ({ payload, date, projectId = '' }) => {
  const safeDate = normalizeIsoDate(date) || getIsoDateInTimeZone(new Date(), DEFAULT_LINE_REMINDER_TIMEZONE);
  const targetProjectId = String(projectId || '').trim();
  const events = getPayloadEvents(payload);
  const items = events
    .filter((event) => {
      if (targetProjectId && String(event?.projectId || '').trim() !== targetProjectId) return false;
      if (!isEventOverlappingDate(event, safeDate)) return false;
      if (isTaskRecord(event) && isCompletedTaskRecord(event)) return false;
      return true;
    })
    .map((event) => toAiAgendaItem(payload, event))
    .sort((left, right) => {
      const leftMs = toDateTimeMs(left.startDate || safeDate, left.startTime || '00:00', false);
      const rightMs = toDateTimeMs(right.startDate || safeDate, right.startTime || '00:00', false);
      return leftMs - rightMs;
    })
    .slice(0, 40);

  return {
    date: safeDate,
    projectId: targetProjectId,
    projectName: targetProjectId ? getProjectNameByIdFromPayload(payload, targetProjectId) : '',
    itemCount: items.length,
    items,
  };
};

const enumerateDatesInRange = (startDateInput, endDateInput, maxDays = 40) => {
  const startDate = normalizeIsoDate(startDateInput);
  const endDate = normalizeIsoDate(endDateInput);
  if (!startDate || !endDate || endDate < startDate) return [];
  const dates = [];
  let cursor = startDate;
  while (cursor <= endDate && dates.length < maxDays) {
    dates.push(cursor);
    cursor = shiftIsoDateByDays(cursor, 1);
    if (!cursor) break;
  }
  return dates;
};

const suggestAiTimeSlots = ({
  payload,
  projectId = '',
  startDate,
  endDate,
  durationMinutes = 60,
  maxSuggestions = 5,
}) => {
  const safeProjectId = String(projectId || '').trim();
  const baseStartDate = normalizeIsoDate(startDate) || getIsoDateInTimeZone(new Date(), DEFAULT_LINE_REMINDER_TIMEZONE);
  const baseEndDate = normalizeIsoDate(endDate) || shiftIsoDateByDays(baseStartDate, 14);
  const rangeDates = enumerateDatesInRange(baseStartDate, baseEndDate, 60);
  const durationMs = Math.max(15, Math.min(8 * 60, Number(durationMinutes || 60))) * 60 * 1000;
  const maxItems = clampAiCount(maxSuggestions, 5, 1, 12);
  if (rangeDates.length === 0) {
    return {
      suggestions: [],
      reason: 'Invalid date range.',
    };
  }

  const events = getPayloadEvents(payload).filter((event) => {
    if (safeProjectId && String(event?.projectId || '').trim() !== safeProjectId) return false;
    if (isTaskRecord(event) && isCompletedTaskRecord(event)) return false;
    return true;
  });

  const busyByDate = new Map();
  rangeDates.forEach((date) => busyByDate.set(date, []));

  events.forEach((event) => {
    const startDateIso = normalizeIsoDate(event?.startDate || event?.endDate);
    const endDateIso = normalizeIsoDate(event?.endDate || event?.startDate);
    if (!startDateIso || !endDateIso) return;
    rangeDates.forEach((date) => {
      if (date < startDateIso || date > endDateIso) return;
      const isAllDay =
        !normalizeIsoTime(event?.startTime) &&
        !normalizeIsoTime(event?.endTime) &&
        (String(event?.showTime || '').trim() === '' || event?.showTime === false);
      const busyStart = isAllDay
        ? toDateTimeMs(date, '00:00', false)
        : toDateTimeMs(date, event?.startTime || '00:00', false);
      const busyEnd = isAllDay
        ? toDateTimeMs(date, '23:59', true)
        : toDateTimeMs(date, event?.endTime || event?.startTime || '23:59', true);
      if (!busyStart || !busyEnd || busyEnd <= busyStart) return;
      const current = busyByDate.get(date) || [];
      current.push({ start: busyStart, end: busyEnd });
      busyByDate.set(date, current);
    });
  });

  const suggestions = [];
  const workStartTime = '09:00';
  const workEndTime = '18:00';
  for (const date of rangeDates) {
    const dayBusy = (busyByDate.get(date) || []).sort((left, right) => left.start - right.start);
    const dayStart = toDateTimeMs(date, workStartTime, false);
    const dayEnd = toDateTimeMs(date, workEndTime, true);
    if (!dayStart || !dayEnd || dayEnd <= dayStart) continue;

    for (let cursor = dayStart; cursor + durationMs <= dayEnd; cursor += 30 * 60 * 1000) {
      const candidateStart = cursor;
      const candidateEnd = cursor + durationMs;
      const hasOverlap = dayBusy.some(
        (busy) => candidateStart < busy.end && candidateEnd > busy.start
      );
      if (hasOverlap) continue;
      const start = new Date(candidateStart);
      const end = new Date(candidateEnd);
      suggestions.push({
        date,
        startTime: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(
          2,
          '0'
        )}`,
        endTime: `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`,
      });
      if (suggestions.length >= maxItems) break;
    }
    if (suggestions.length >= maxItems) break;
  }

  return {
    projectId: safeProjectId,
    projectName: safeProjectId ? getProjectNameByIdFromPayload(payload, safeProjectId) : '',
    dateRange: { startDate: baseStartDate, endDate: baseEndDate },
    durationMinutes: Math.round(durationMs / 60000),
    suggestions,
  };
};

const listAiProjectUpdates = ({ payload, projectId, limit = 12 }) => {
  const project = getProjectByIdFromPayload(payload, projectId);
  if (!project) {
    return {
      projectId: String(projectId || '').trim(),
      updates: [],
      message: 'Project not found.',
    };
  }
  const feed = Array.isArray(project.changeFeed) ? project.changeFeed : [];
  const safeLimit = clampAiCount(limit, 12, 1, 40);
  const updates = feed
    .slice()
    .sort((left, right) => String(right?.createdAt || '').localeCompare(String(left?.createdAt || '')))
    .slice(0, safeLimit)
    .map((entry) => ({
      id: String(entry?.id || '').trim(),
      title: String(entry?.title || '').trim(),
      message: String(entry?.message || '').trim(),
      type: String(entry?.type || '').trim(),
      createdAt: String(entry?.createdAt || '').trim(),
      actorUsername: String(entry?.actorUsername || '').trim(),
    }));
  return {
    projectId: String(project.id || '').trim(),
    projectName: String(project.name || '').trim(),
    updates,
  };
};

const buildAiProjectOverview = ({ payload, projectId }) => {
  const project = getProjectByIdFromPayload(payload, projectId);
  if (!project) {
    return {
      projectId: String(projectId || '').trim(),
      message: 'Project not found.',
    };
  }
  const events = getPayloadEvents(payload).filter(
    (event) => String(event?.projectId || '').trim() === String(project.id || '').trim()
  );
  const tasks = events.filter((event) => isTaskRecord(event));
  const openTasks = tasks.filter((task) => !isCompletedTaskRecord(task));
  const completedTasks = tasks.filter((task) => isCompletedTaskRecord(task));
  const nextDeadlines = openTasks
    .map((task) => ({
      id: String(task?.id || '').trim(),
      title: String(task?.title || '').trim() || 'Untitled task',
      endDate: normalizeIsoDate(task?.endDate || ''),
      status: String(task?.status || '').trim() || 'To Do',
    }))
    .filter((task) => task.endDate)
    .sort((left, right) => left.endDate.localeCompare(right.endDate))
    .slice(0, 6);
  return {
    projectId: String(project.id || '').trim(),
    projectName: String(project.name || '').trim(),
    status: String(project.status || '').trim() || 'on_track',
    taskCount: tasks.length,
    openTaskCount: openTasks.length,
    completedTaskCount: completedTasks.length,
    eventCount: events.filter((event) => !isTaskRecord(event)).length,
    nextDeadlines,
  };
};

const resolveAiProjectByHint = (payload, hintInput) => {
  const hint = String(hintInput || '').trim();
  if (!hint) return null;
  const projects = getPayloadProjects(payload);
  const byId = projects.find((project) => String(project?.id || '').trim() === hint);
  if (byId) return byId;
  const lowerHint = hint.toLowerCase();
  return (
    projects.find((project) => String(project?.name || '').trim().toLowerCase().includes(lowerHint)) ||
    null
  );
};

const resolveAiEventForDeletion = ({ payload, eventId, projectId, titleContains }) => {
  const normalizedEventId = String(eventId || '').trim();
  const normalizedProjectId = String(projectId || '').trim();
  const normalizedTitle = String(titleContains || '').trim().toLowerCase();
  const events = getPayloadEvents(payload);
  if (normalizedEventId) {
    const event = events.find((item) => String(item?.id || '').trim() === normalizedEventId) || null;
    return event;
  }
  if (!normalizedTitle) return null;
  return (
    events.find((event) => {
      if (normalizedProjectId && String(event?.projectId || '').trim() !== normalizedProjectId) return false;
      const title = String(event?.title || '').trim().toLowerCase();
      return title.includes(normalizedTitle);
    }) || null
  );
};

const createAiPendingAction = ({ type, summary, payload }) => {
  const actionType = String(type || '').trim();
  if (!AI_VALID_ACTION_TYPES.has(actionType)) return null;
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + AI_PENDING_ACTION_TTL_MS).toISOString();
  return {
    id: buildAiId(),
    type: actionType,
    summary: String(summary || '').trim().slice(0, 300),
    payload: payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {},
    createdAt,
    expiresAt,
  };
};

const AI_TOOL_DEFINITIONS = [
  {
    type: 'function',
    name: 'get_today_agenda',
    description: 'List events/tasks for a specific date (defaults to today).',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'ISO date YYYY-MM-DD' },
        projectId: { type: 'string', description: 'Optional project id' },
      },
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'suggest_best_time',
    description: 'Suggest available time slots from project schedule density.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        startDate: { type: 'string', description: 'ISO date YYYY-MM-DD' },
        endDate: { type: 'string', description: 'ISO date YYYY-MM-DD' },
        durationMinutes: { type: 'number' },
        maxSuggestions: { type: 'number' },
      },
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'list_project_updates',
    description: 'Read recent project change feed updates.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['projectId'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'get_project_overview',
    description: 'Summarize task/event counts and next deadlines.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
      },
      required: ['projectId'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'draft_create_task',
    description: 'Prepare task creation action for user confirmation.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        projectHint: { type: 'string', description: 'Project id or project name hint' },
        title: { type: 'string' },
        description: { type: 'string' },
        startDate: { type: 'string' },
        startTime: { type: 'string' },
        endDate: { type: 'string' },
        endTime: { type: 'string' },
        status: { type: 'string' },
        department: { type: 'string' },
        assigneeIds: { type: 'array', items: { type: 'string' } },
        assigneeNames: { type: 'array', items: { type: 'string' } },
        parentTaskId: { type: 'string' },
        linkedEventId: { type: 'string' },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'draft_delete_event',
    description: 'Prepare event/task deletion action for user confirmation.',
    parameters: {
      type: 'object',
      properties: {
        eventId: { type: 'string' },
        projectId: { type: 'string' },
        titleContains: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'draft_send_line_open_tasks',
    description: 'Prepare action to send LINE open-task summary for one project.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
      },
      required: ['projectId'],
      additionalProperties: false,
    },
  },
];

const callOpenAiResponsesApi = async ({ input, tools, previousResponseId = '' }) => {
  if (!OPENAI_API_KEY) {
    const configError = new Error('OPENAI_API_KEY is not configured on server.');
    configError.status = 503;
    configError.code = 'openai_key_missing';
    throw configError;
  }
  const endpointBase = String(OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const payload = {
    model: OPENAI_MODEL,
    input,
    tools,
  };
  if (previousResponseId) {
    payload.previous_response_id = String(previousResponseId || '').trim();
  }
  if (OPENAI_REASONING_EFFORT) {
    payload.reasoning = {
      effort: OPENAI_REASONING_EFFORT,
    };
  }
  const response = await fetch(`${endpointBase}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = String(await response.text()).trim();
  let parsed = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = {};
  }
  if (!response.ok) {
    const status = Number(response.status || 500);
    const upstreamMessage = String(parsed?.error?.message || parsed?.message || '').trim();
    const errorCode = String(parsed?.error?.code || parsed?.code || '').trim().toLowerCase();
    const errorType = String(parsed?.error?.type || parsed?.type || '').trim().toLowerCase();
    const fallbackMessage = `OpenAI request failed (${status})${text ? `: ${text.slice(0, 240)}` : ''}`;
    const joinedSignal = `${errorCode} ${errorType} ${upstreamMessage}`.toLowerCase();
    let message = upstreamMessage || fallbackMessage;
    if (
      status === 429 &&
      (joinedSignal.includes('insufficient_quota') ||
        joinedSignal.includes('quota') ||
        joinedSignal.includes('billing'))
    ) {
      message = 'AI quota exceeded. Please check OpenAI plan and billing, then try again.';
    } else if (status === 429) {
      message = 'AI rate limit reached. Please retry in a moment.';
    } else if (status === 401 || status === 403) {
      message = 'OpenAI authentication failed. Please verify OPENAI_API_KEY on server.';
    } else if (status >= 500) {
      message = 'OpenAI service is temporarily unavailable. Please retry shortly.';
    }
    const requestError = new Error(message);
    requestError.status = status;
    if (errorCode) requestError.code = errorCode;
    if (errorType) requestError.type = errorType;
    if (upstreamMessage) requestError.upstreamMessage = upstreamMessage;
    throw requestError;
  }
  return parsed;
};

const extractOpenAiOutputText = (responseInput) => {
  const response = responseInput && typeof responseInput === 'object' ? responseInput : {};
  const direct = String(response.output_text || '').trim();
  if (direct) return direct;
  const output = Array.isArray(response.output) ? response.output : [];
  const textParts = [];
  output.forEach((item) => {
    if (item?.type !== 'message') return;
    const content = Array.isArray(item.content) ? item.content : [];
    content.forEach((part) => {
      const text = String(part?.text || part?.output_text || '').trim();
      if (text) textParts.push(text);
    });
  });
  return textParts.join('\n').trim();
};

const extractOpenAiFunctionCalls = (responseInput) => {
  const response = responseInput && typeof responseInput === 'object' ? responseInput : {};
  const output = Array.isArray(response.output) ? response.output : [];
  const calls = [];
  output.forEach((item) => {
    if (item?.type === 'function_call' || item?.type === 'tool_call') {
      const name = String(item?.name || item?.function?.name || '').trim();
      if (!name) return;
      calls.push({
        callId: String(item?.call_id || item?.id || buildAiId()).trim(),
        name,
        arguments: String(item?.arguments || item?.function?.arguments || '{}'),
      });
      return;
    }
    const content = Array.isArray(item?.content) ? item.content : [];
    content.forEach((part) => {
      if (part?.type !== 'function_call') return;
      const name = String(part?.name || '').trim();
      if (!name) return;
      calls.push({
        callId: String(part?.call_id || part?.id || buildAiId()).trim(),
        name,
        arguments: String(part?.arguments || '{}'),
      });
    });
  });
  return calls;
};

const buildAiContextSummary = ({ payload, userId, username }) => {
  const projects = getPayloadProjects(payload);
  const events = getPayloadEvents(payload);
  const projectSummaries = projects.slice(0, 30).map((project) => {
    const projectId = String(project?.id || '').trim();
    const projectEvents = events.filter((event) => String(event?.projectId || '').trim() === projectId);
    const tasks = projectEvents.filter((event) => isTaskRecord(event));
    const openTasks = tasks.filter((task) => !isCompletedTaskRecord(task));
    const upcomingEvents = projectEvents
      .filter((event) => !isTaskRecord(event))
      .filter((event) => normalizeIsoDate(event?.startDate || event?.endDate))
      .slice(0, 12);
    return {
      id: projectId,
      name: String(project?.name || '').trim() || projectId,
      status: String(project?.status || '').trim() || 'on_track',
      openTasks: openTasks.length,
      totalTasks: tasks.length,
      upcomingEvents: upcomingEvents.length,
    };
  });
  return {
    nowIso: new Date().toISOString(),
    timezone: DEFAULT_LINE_REMINDER_TIMEZONE,
    user: {
      id: sanitizeUserId(userId),
      username: sanitizeUsername(username),
    },
    projects: projectSummaries,
  };
};

const buildAiAssistantSystemPrompt = ({ contextSummary }) => {
  const contextText = JSON.stringify(contextSummary);
  return [
    'You are PM Calendar AI assistant.',
    'Answer in concise Thai by default.',
    'Use tools when a tool can improve accuracy.',
    'Never invent project/task/event ids.',
    'For mutating requests, always call a draft_* tool first and ask user to confirm action.',
    'If user asks today schedule, prioritize get_today_agenda tool.',
    'When suggesting schedule, use suggest_best_time and explain briefly.',
    'Context summary (JSON):',
    contextText,
  ].join('\n');
};

const buildOpenAiInputMessage = (roleInput, textInput) => {
  const role = String(roleInput || '').trim().toLowerCase();
  const safeRole =
    role === 'system' || role === 'assistant' || role === 'developer' ? role : 'user';
  const text = sanitizeAiMessageContent(textInput, 12000);
  return {
    role: safeRole,
    // Use plain string content to avoid role/content-type schema drift across API versions.
    content: text,
  };
};

const getAiImageInputPartsFromAttachments = (attachmentsInput) => {
  const attachments = Array.isArray(attachmentsInput) ? attachmentsInput : [];
  const imageParts = [];
  for (const attachment of attachments) {
    if (imageParts.length >= AI_INPUT_IMAGE_MAX_COUNT) break;
    const previewDataUrl = String(attachment?.previewDataUrl || '').trim();
    const mimeType = String(attachment?.mimeType || '').trim().toLowerCase();
    const isImageMime = mimeType.startsWith('image/');
    const isImageDataUrl = /^data:image\//i.test(previewDataUrl);
    if (!isImageMime || !isImageDataUrl) continue;
    if (previewDataUrl.length > AI_INPUT_IMAGE_PREVIEW_MAX_CHARS) continue;
    imageParts.push({
      type: 'input_image',
      image_url: previewDataUrl,
    });
  }
  return imageParts;
};

const buildOpenAiUserMessageWithAttachments = ({ textInput, attachmentsInput }) => {
  const text =
    sanitizeAiMessageContent(textInput, 12000) ||
    'โปรดวิเคราะห์รูปที่ผู้ใช้แนบมาพร้อมบริบทของโปรเจกต์';
  const imageParts = getAiImageInputPartsFromAttachments(attachmentsInput);
  if (imageParts.length === 0) {
    return buildOpenAiInputMessage('user', text);
  }
  return {
    role: 'user',
    content: [
      {
        type: 'input_text',
        text,
      },
      ...imageParts,
    ],
  };
};

const executeAiToolCall = async ({ payload, args, toolName }) => {
  const toolArgs = args && typeof args === 'object' ? args : {};
  if (toolName === 'get_today_agenda') {
    return buildAiAgendaForDate({
      payload,
      date: toolArgs.date,
      projectId: toolArgs.projectId,
    });
  }
  if (toolName === 'suggest_best_time') {
    return suggestAiTimeSlots({
      payload,
      projectId: toolArgs.projectId,
      startDate: toolArgs.startDate,
      endDate: toolArgs.endDate,
      durationMinutes: toolArgs.durationMinutes,
      maxSuggestions: toolArgs.maxSuggestions,
    });
  }
  if (toolName === 'list_project_updates') {
    return listAiProjectUpdates({
      payload,
      projectId: toolArgs.projectId,
      limit: toolArgs.limit,
    });
  }
  if (toolName === 'get_project_overview') {
    return buildAiProjectOverview({
      payload,
      projectId: toolArgs.projectId,
    });
  }
  if (toolName === 'draft_create_task') {
    const project =
      getProjectByIdFromPayload(payload, toolArgs.projectId) ||
      resolveAiProjectByHint(payload, toolArgs.projectHint);
    const title = sanitizeAiMessageContent(toolArgs.title, 220);
    if (!project || !title) {
      return {
        ok: false,
        message: !project ? 'Project not found for task creation.' : 'Task title is required.',
      };
    }
    const projectId = String(project.id || '').trim();
    const dueDate =
      normalizeIsoDate(toolArgs.endDate) ||
      getIsoDateInTimeZone(new Date(), DEFAULT_LINE_REMINDER_TIMEZONE);
    const pendingAction = createAiPendingAction({
      type: AI_ACTION_TYPES.CREATE_TASK,
      summary: `Create task "${title}" in ${String(project.name || projectId).trim() || projectId}`,
      payload: {
        projectId,
        title,
        description: sanitizeAiMessageContent(toolArgs.description, 2000),
        startDate: normalizeIsoDate(toolArgs.startDate),
        startTime: normalizeIsoTime(toolArgs.startTime),
        endDate: dueDate,
        endTime: normalizeIsoTime(toolArgs.endTime),
        status: String(toolArgs.status || '').trim(),
        department: String(toolArgs.department || '').trim(),
        assigneeIds: Array.isArray(toolArgs.assigneeIds)
          ? toolArgs.assigneeIds.map((id) => String(id || '').trim()).filter(Boolean)
          : [],
        assigneeNames: Array.isArray(toolArgs.assigneeNames)
          ? toolArgs.assigneeNames.map((name) => String(name || '').trim()).filter(Boolean)
          : [],
        parentTaskId: String(toolArgs.parentTaskId || '').trim(),
        linkedEventId: String(toolArgs.linkedEventId || '').trim(),
      },
    });
    return {
      ok: true,
      pendingAction,
      confirmationText:
        'Task draft prepared. Please ask user to confirm before execution.',
    };
  }
  if (toolName === 'draft_delete_event') {
    const targetEvent = resolveAiEventForDeletion({
      payload,
      eventId: toolArgs.eventId,
      projectId: toolArgs.projectId,
      titleContains: toolArgs.titleContains,
    });
    if (!targetEvent) {
      return {
        ok: false,
        message: 'Event or task to delete was not found.',
      };
    }
    const pendingAction = createAiPendingAction({
      type: AI_ACTION_TYPES.DELETE_EVENT,
      summary: `Delete "${String(targetEvent.title || '').trim() || 'Untitled'}"`,
      payload: {
        eventId: String(targetEvent.id || '').trim(),
        projectId: String(targetEvent.projectId || '').trim(),
      },
    });
    return {
      ok: true,
      pendingAction,
      confirmationText:
        'Delete draft prepared. Please ask user to confirm before execution.',
    };
  }
  if (toolName === 'draft_send_line_open_tasks') {
    const project = getProjectByIdFromPayload(payload, toolArgs.projectId);
    if (!project) {
      return {
        ok: false,
        message: 'Project not found for LINE reminder.',
      };
    }
    const pendingAction = createAiPendingAction({
      type: AI_ACTION_TYPES.NOTIFY_OPEN_TASKS,
      summary: `Send LINE open-task summary for ${String(project.name || project.id).trim()}`,
      payload: {
        projectId: String(project.id || '').trim(),
      },
    });
    return {
      ok: true,
      pendingAction,
      confirmationText:
        'LINE notification draft prepared. Please ask user to confirm before execution.',
    };
  }
  return {
    ok: false,
    message: `Unknown tool: ${toolName}`,
  };
};

const runAiAssistant = async ({
  payload,
  threadMessages,
  userMessage,
  userId,
  username,
  userContextNote = '',
  attachments = [],
}) => {
  const history = Array.isArray(threadMessages) ? threadMessages : [];
  const safeAttachments = Array.isArray(attachments) ? attachments : [];
  const attachedImageParts = getAiImageInputPartsFromAttachments(safeAttachments);
  const compactHistory = history
    .filter((message) => ['user', 'assistant'].includes(String(message?.role || '').trim()))
    .slice(-AI_THREAD_HISTORY_LIMIT)
    .map((message) =>
      buildOpenAiInputMessage(
        String(message.role || '').trim(),
        sanitizeAiMessageContent(message.content, 3000)
      )
    );
  const contextSummary = buildAiContextSummary({ payload, userId, username });
  const systemPrompt = buildAiAssistantSystemPrompt({ contextSummary });
  const initialInput = [buildOpenAiInputMessage('system', systemPrompt), ...compactHistory];
  const contextNote = sanitizeAiMessageContent(userContextNote, 12000);
  if (contextNote) {
    initialInput.push(buildOpenAiInputMessage('developer', contextNote));
  }
  const lastHistoryItem = compactHistory[compactHistory.length - 1];
  const lastHistoryRole = String(lastHistoryItem?.role || '').trim().toLowerCase();
  let lastHistoryText = '';
  if (typeof lastHistoryItem?.content === 'string') {
    lastHistoryText = String(lastHistoryItem.content || '').trim();
  } else if (Array.isArray(lastHistoryItem?.content)) {
    lastHistoryText = String(lastHistoryItem?.content?.[0]?.text || lastHistoryItem?.content?.[0]?.output_text || '')
      .trim();
  } else {
    lastHistoryText = String(lastHistoryItem?.content?.text || '').trim();
  }
  const shouldAppendCurrentUserMessage =
    attachedImageParts.length > 0 ||
    lastHistoryRole !== 'user' ||
    lastHistoryText !== String(userMessage || '').trim();
  if (shouldAppendCurrentUserMessage) {
    initialInput.push(
      buildOpenAiUserMessageWithAttachments({
        textInput: userMessage,
        attachmentsInput: safeAttachments,
      })
    );
  }

  let response;
  try {
    response = await callOpenAiResponsesApi({
      input: initialInput,
      tools: AI_TOOL_DEFINITIONS,
    });
  } catch (error) {
    const errorMessage = String(error?.message || '').trim().toLowerCase();
    const shouldRetryTextOnly =
      attachedImageParts.length > 0 &&
      Number(error?.status || 0) === 400 &&
      (errorMessage.includes('input_image') ||
        errorMessage.includes('input_text') ||
        errorMessage.includes('content'));
    if (!shouldRetryTextOnly) {
      throw error;
    }
    const fallbackInput = initialInput.slice();
    if (shouldAppendCurrentUserMessage) {
      fallbackInput.pop();
      const imageCount = attachedImageParts.length;
      const fallbackText = `${String(userMessage || '').trim()}\n\n[แนบรูป ${imageCount} ไฟล์]`;
      fallbackInput.push(buildOpenAiInputMessage('user', fallbackText));
    }
    response = await callOpenAiResponsesApi({
      input: fallbackInput,
      tools: AI_TOOL_DEFINITIONS,
    });
  }
  let pendingAction = null;

  for (let round = 0; round < AI_MAX_TOOL_CALL_ROUNDS; round += 1) {
    const functionCalls = extractOpenAiFunctionCalls(response);
    if (functionCalls.length === 0) break;
    const toolOutputs = [];
    for (const functionCall of functionCalls) {
      const args = parseJsonObjectSafe(functionCall.arguments);
      const toolResult = await executeAiToolCall({
        payload,
        args,
        toolName: functionCall.name,
      });
      const pendingFromTool = normalizeAiPendingAction(toolResult?.pendingAction);
      if (pendingFromTool) {
        pendingAction = pendingFromTool;
      }
      toolOutputs.push({
        type: 'function_call_output',
        call_id: functionCall.callId || buildAiId(),
        output: JSON.stringify(toolResult),
      });
    }
    response = await callOpenAiResponsesApi({
      previousResponseId: String(response?.id || '').trim(),
      input: toolOutputs,
      tools: AI_TOOL_DEFINITIONS,
    });
  }

  const assistantTextRaw = extractOpenAiOutputText(response);
  const assistantText =
    assistantTextRaw ||
    (pendingAction
      ? 'ร่างคำสั่งพร้อมแล้ว กรุณากดยืนยันเพื่อให้ระบบดำเนินการ'
      : 'ขออภัย ระบบยังไม่สามารถสร้างคำตอบได้ในขณะนี้');
  return {
    assistantText: sanitizeAiMessageContent(assistantText, 12000),
    pendingAction,
  };
};

const resolveAiTaskAssigneeIds = ({ project, payloadAssigneeIds, payloadAssigneeNames }) => {
  const teamMembers = Array.isArray(project?.teamMembers) ? project.teamMembers : [];
  const memberById = new Map();
  const memberByName = new Map();
  teamMembers.forEach((member) => {
    const memberId = String(member?.id || '').trim();
    if (!memberId) return;
    memberById.set(memberId, member);
    const candidateNames = [
      String(member?.name || '').trim().toLowerCase(),
      String(member?.username || '').trim().toLowerCase(),
      String(member?.email || '').trim().toLowerCase(),
    ].filter(Boolean);
    candidateNames.forEach((candidate) => memberByName.set(candidate, memberId));
  });

  const result = [];
  (Array.isArray(payloadAssigneeIds) ? payloadAssigneeIds : []).forEach((id) => {
    const safeId = String(id || '').trim();
    if (!safeId || !memberById.has(safeId)) return;
    if (!result.includes(safeId)) result.push(safeId);
  });
  (Array.isArray(payloadAssigneeNames) ? payloadAssigneeNames : []).forEach((name) => {
    const key = String(name || '').trim().toLowerCase();
    if (!key) return;
    const matched = memberByName.get(key);
    if (!matched) return;
    if (!result.includes(matched)) result.push(matched);
  });
  return result.slice(0, 10);
};

const resolveAiTaskDepartment = ({ project, requestedDepartment, assigneeIds }) => {
  const explicit = String(requestedDepartment || '').trim();
  if (explicit) return explicit;
  const teamMembers = Array.isArray(project?.teamMembers) ? project.teamMembers : [];
  const memberMap = new Map();
  teamMembers.forEach((member) => {
    const memberId = String(member?.id || '').trim();
    if (!memberId) return;
    memberMap.set(memberId, String(member?.department || '').trim() || 'Unassigned');
  });
  const departments = Array.from(
    new Set(
      (Array.isArray(assigneeIds) ? assigneeIds : [])
        .map((id) => memberMap.get(String(id || '').trim()))
        .filter(Boolean)
    )
  );
  if (departments.length === 1) return departments[0];
  if (departments.length > 1) return 'Multiple';
  return 'Unassigned';
};

const executeAiCreateTaskAction = async ({ userId, actionPayload }) => {
  const payload = await readAccountPayloadFromStore(userId);
  const projects = getPayloadProjects(payload);
  const events = getPayloadEvents(payload);
  const projectId = String(actionPayload?.projectId || '').trim();
  const targetProject = projects.find((project) => String(project?.id || '').trim() === projectId);
  if (!targetProject) {
    throw new Error('Project not found for task creation.');
  }
  const nowIso = new Date().toISOString();
  const title = sanitizeAiMessageContent(actionPayload?.title, 220);
  if (!title) {
    throw new Error('Task title is required.');
  }
  const endDate =
    normalizeIsoDate(actionPayload?.endDate) ||
    getIsoDateInTimeZone(new Date(), DEFAULT_LINE_REMINDER_TIMEZONE);
  const endTime = normalizeIsoTime(actionPayload?.endTime);
  const startDate = normalizeIsoDate(actionPayload?.startDate);
  const startTime = normalizeIsoTime(actionPayload?.startTime);
  const assigneeIds = resolveAiTaskAssigneeIds({
    project: targetProject,
    payloadAssigneeIds: actionPayload?.assigneeIds,
    payloadAssigneeNames: actionPayload?.assigneeNames,
  });
  const department = resolveAiTaskDepartment({
    project: targetProject,
    requestedDepartment: actionPayload?.department,
    assigneeIds,
  });
  const taskId = buildAiId();
  const parentTaskId = String(actionPayload?.parentTaskId || '').trim();
  const parentTask = parentTaskId
    ? events.find((event) => String(event?.id || '').trim() === parentTaskId && isTaskRecord(event))
    : null;
  const taskRecord = {
    id: taskId,
    recordType: 'task',
    projectId,
    title,
    description: sanitizeAiMessageContent(actionPayload?.description, 2000),
    status: String(actionPayload?.status || '').trim() || 'To Do',
    department,
    assigneeIds,
    assigneeId: assigneeIds[0] || '',
    startDate,
    startTime,
    endDate,
    endTime,
    parentTaskId: parentTask ? String(parentTask.id || '').trim() : '',
    parentTaskTitle: parentTask ? String(parentTask.title || '').trim() : '',
    linkedEventId: String(actionPayload?.linkedEventId || '').trim(),
    comments: [],
    attachments: [],
    taskTodos: [],
    deadlineOriginalEndDate: endDate,
    deadlineOriginalEndTime: endTime || '',
    deadlineExtensionCount: 0,
    deadlineWasExtended: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const nextEvents = [...events, taskRecord];
  const nextProjects = projects.map((project) => {
    if (String(project?.id || '').trim() !== projectId) return project;
    const feed = Array.isArray(project?.changeFeed) ? project.changeFeed : [];
    const nextFeed = [
      {
        id: buildAiId(),
        type: 'task_created',
        title,
        message: 'AI assistant created a task.',
        actorUsername: 'pm_ai',
        actorId: 'pm_ai',
        createdAt: nowIso,
      },
      ...feed,
    ].slice(0, 160);
    return {
      ...project,
      changeFeed: nextFeed,
      updatedAt: nowIso,
    };
  });
  const nextPayload = {
    ...payload,
    projects: nextProjects,
    events: nextEvents,
  };
  await writeAccountPayloadToStore(userId, nextPayload);
  return {
    task: {
      id: taskId,
      title,
      projectId,
      projectName: String(targetProject?.name || projectId).trim(),
      endDate,
      endTime,
    },
  };
};

const executeAiDeleteEventAction = async ({ userId, actionPayload }) => {
  const payload = await readAccountPayloadFromStore(userId);
  const events = getPayloadEvents(payload);
  const projects = getPayloadProjects(payload);
  const eventId = String(actionPayload?.eventId || '').trim();
  if (!eventId) throw new Error('eventId is required for delete action.');
  const targetEvent = events.find((event) => String(event?.id || '').trim() === eventId);
  if (!targetEvent) {
    throw new Error('Event not found.');
  }
  const projectId = String(targetEvent?.projectId || '').trim();
  const nowIso = new Date().toISOString();
  const nextEvents = events.filter((event) => String(event?.id || '').trim() !== eventId);
  const nextProjects = projects.map((project) => {
    if (String(project?.id || '').trim() !== projectId) return project;
    const feed = Array.isArray(project?.changeFeed) ? project.changeFeed : [];
    const nextFeed = [
      {
        id: buildAiId(),
        type: 'event_deleted',
        title: String(targetEvent?.title || '').trim(),
        message: 'AI assistant deleted an event/task.',
        actorUsername: 'pm_ai',
        actorId: 'pm_ai',
        createdAt: nowIso,
      },
      ...feed,
    ].slice(0, 160);
    return {
      ...project,
      changeFeed: nextFeed,
      updatedAt: nowIso,
    };
  });
  const nextPayload = {
    ...payload,
    projects: nextProjects,
    events: nextEvents,
  };
  await writeAccountPayloadToStore(userId, nextPayload);
  return {
    removed: {
      id: eventId,
      title: String(targetEvent?.title || '').trim() || 'Untitled',
      projectId,
      projectName: getProjectNameByIdFromPayload(payload, projectId),
    },
  };
};

const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const toPublicUser = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  avatarUrl: user.avatarUrl || '',
});

const toSafeInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return parsed;
};

const createAuthToken = (user) => {
  const nowMs = Date.now();
  const payload = {
    sub: sanitizeUserId(user?.id),
    email: sanitizeEmail(user?.email),
    username: sanitizeUsername(user?.username),
    iat: nowMs,
    exp: nowMs + AUTH_TOKEN_TTL_MS,
  };
  const payloadPart = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', EFFECTIVE_AUTH_TOKEN_SECRET)
    .update(payloadPart)
    .digest('base64url');
  return `${payloadPart}.${signature}`;
};

const verifyAuthToken = (tokenInput) => {
  const token = sanitizeAuthToken(tokenInput);
  if (!token || !token.includes('.')) return null;
  const [payloadPartRaw, signatureRaw] = token.split('.');
  const payloadPart = String(payloadPartRaw || '').trim();
  const signature = String(signatureRaw || '').trim();
  if (!payloadPart || !signature) return null;

  const expectedSignature = crypto
    .createHmac('sha256', EFFECTIVE_AUTH_TOKEN_SECRET)
    .update(payloadPart)
    .digest('base64url');
  const expectedBuffer = Buffer.from(expectedSignature);
  const incomingBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== incomingBuffer.length) return null;
  if (!crypto.timingSafeEqual(expectedBuffer, incomingBuffer)) return null;

  let payload = null;
  try {
    payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
  } catch {
    payload = null;
  }
  if (!payload || typeof payload !== 'object') return null;

  const sub = sanitizeUserId(payload.sub);
  const email = sanitizeEmail(payload.email);
  const username = sanitizeUsername(payload.username);
  const exp = Number(payload.exp || 0);
  if (!sub || !email || !username || !Number.isFinite(exp) || Date.now() > exp) {
    return null;
  }
  return {
    sub,
    email,
    username,
    iat: Number(payload.iat || 0),
    exp,
  };
};

const getBearerToken = (req) => {
  const authHeader = String(req.headers?.authorization || '').trim();
  if (!authHeader.toLowerCase().startsWith('bearer ')) return '';
  return sanitizeAuthToken(authHeader.slice(7));
};

const requireAuth = (req, res, next) => {
  const token = getBearerToken(req);
  const verified = verifyAuthToken(token);
  if (!verified) {
    return res.status(401).json({ message: 'Unauthorized request.' });
  }
  req.authUser = verified;
  return next();
};

const ensureAuthUserMatches = (req, res, targetUserIdInput) => {
  const targetUserId = sanitizeUserId(targetUserIdInput);
  if (!targetUserId) {
    res.status(400).json({ message: 'userId is required.' });
    return false;
  }
  const authUserId = sanitizeUserId(req.authUser?.sub);
  if (!authUserId || authUserId !== targetUserId) {
    res.status(403).json({ message: 'Forbidden. Cannot access another user account.' });
    return false;
  }
  return true;
};
const requireRootAdmin = async (req, res, next) => {
  try {
    if (!ROOT_ADMIN_EMAIL) {
      return res.status(503).json({ message: 'Root admin is not configured on server.' });
    }
    const authUserId = sanitizeUserId(req.authUser?.sub);
    if (!authUserId) {
      return res.status(401).json({ message: 'Unauthorized request.' });
    }
    const userDoc = await usersRef.doc(authUserId).get();
    if (!userDoc.exists) {
      return res.status(401).json({ message: 'User not found.' });
    }
    const userData = userDoc.data() || {};
    const userEmail = sanitizeEmail(userData.email || req.authUser?.email);
    if (!userEmail || userEmail !== ROOT_ADMIN_EMAIL) {
      return res.status(403).json({ message: 'Admin access denied.' });
    }
    req.rootAdmin = {
      id: authUserId,
      email: userEmail,
      username: sanitizeUsername(userData.username || req.authUser?.username),
      isRootAdmin: true,
      isSupportAdmin: true,
    };
    return next();
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to verify admin access.' });
  }
};
const requireSupportAdmin = async (req, res, next) => {
  try {
    const authUserId = sanitizeUserId(req.authUser?.sub);
    if (!authUserId) {
      return res.status(401).json({ message: 'Unauthorized request.' });
    }
    const userRecord = await getAuthUserRecord(authUserId);
    if (!userRecord) {
      return res.status(401).json({ message: 'User not found.' });
    }
    const role = toSupportRoleResponse(userRecord);
    if (!role.isSupportAdmin) {
      return res.status(403).json({ message: 'Admin access denied.' });
    }
    req.supportAdmin = {
      id: authUserId,
      username: sanitizeUsername(userRecord.username || req.authUser?.username),
      email: sanitizeEmail(userRecord.email || req.authUser?.email),
      isRootAdmin: role.isRootAdmin,
      isSupportAdmin: role.isSupportAdmin,
    };
    return next();
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to verify support admin access.' });
  }
};

const otpDocId = (email) => crypto.createHash('sha256').update(email).digest('hex');
const generateOtpCode = () => String(Math.floor(100000 + Math.random() * 900000));

const getUserByEmail = async (email) => {
  const snapshot = await usersRef.where('email', '==', email).limit(1).get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
};

const getUserByUsername = async (username) => {
  const snapshot = await usersRef.where('username', '==', username).limit(1).get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
};

const makeUniqueUsername = async (baseUsername) => {
  const normalizedBase = sanitizeUsername(baseUsername).replace(/[^a-z0-9_]/g, '_') || 'user';
  let candidate = normalizedBase;
  let suffix = 1;

  while (true) {
    const exists = await getUserByUsername(candidate);
    if (!exists) return candidate;
    candidate = `${normalizedBase}_${suffix}`;
    suffix += 1;
  }
};

const sendOtpEmail = async (email, code) => {
  await mailer.sendMail({
    from: process.env.OTP_FROM_EMAIL,
    to: email,
    subject: 'Your PM Calendar OTP Code',
    text: `Your OTP code is ${code}. It will expire in ${OTP_TTL_MINUTES} minutes.`,
    html: `<div style="font-family:Arial,sans-serif">
      <h2>PM Calendar Email Verification</h2>
      <p>Your OTP code is:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p>
      <p>This code expires in ${OTP_TTL_MINUTES} minutes.</p>
    </div>`,
  });
};
const normalizeTaskCommentNotifyMode = (valueInput) =>
  String(valueInput || '').trim().toLowerCase() === 'reply' ? 'reply' : 'comment';
const normalizeTaskCommentNotifyRecipientList = (recipientsInput) =>
  (Array.isArray(recipientsInput) ? recipientsInput : [])
    .map((recipientInput) => {
      const recipient =
        recipientInput && typeof recipientInput === 'object' && !Array.isArray(recipientInput)
          ? recipientInput
          : {};
      return {
        userId: sanitizeUserId(recipient.userId),
        username: sanitizeUsername(recipient.username),
        email: sanitizeEmail(recipient.email),
      };
    })
    .filter((recipient) => recipient.userId || recipient.username || recipient.email)
    .slice(0, TASK_COMMENT_NOTIFY_MAX_RECIPIENTS);
const resolveTaskCommentNotifyRecipientRecord = async (recipientInput) => {
  const recipient =
    recipientInput && typeof recipientInput === 'object' && !Array.isArray(recipientInput)
      ? recipientInput
      : {};
  const recipientUserId = sanitizeUserId(recipient.userId);
  const recipientUsername = sanitizeUsername(recipient.username);
  const recipientEmail = sanitizeEmail(recipient.email);

  if (recipientUserId) {
    const userById = await getAuthUserRecord(recipientUserId);
    if (userById) {
      return {
        id: sanitizeUserId(userById.id),
        username: sanitizeUsername(userById.username),
        email: sanitizeEmail(userById.email),
      };
    }
  }
  if (recipientEmail) {
    const userByEmail = await getUserByEmail(recipientEmail);
    if (userByEmail) {
      return {
        id: sanitizeUserId(userByEmail.id),
        username: sanitizeUsername(userByEmail.username),
        email: sanitizeEmail(userByEmail.email),
      };
    }
  }
  if (recipientUsername) {
    const userByUsername = await getUserByUsername(recipientUsername);
    if (userByUsername) {
      return {
        id: sanitizeUserId(userByUsername.id),
        username: sanitizeUsername(userByUsername.username),
        email: sanitizeEmail(userByUsername.email),
      };
    }
  }
  return null;
};
const sendTaskCommentNotificationEmail = async ({
  toEmail,
  toUsername = '',
  actorUsername = '',
  taskTitle = '',
  commentText = '',
  mode = 'comment',
}) => {
  const safeToEmail = sanitizeEmail(toEmail);
  if (!safeToEmail) return;
  const safeToUsername = sanitizeUsername(toUsername) || safeToEmail;
  const safeActorUsername = sanitizeUsername(actorUsername) || 'member';
  const safeTaskTitle = String(taskTitle || '').trim() || 'Untitled task';
  const safeCommentText = String(commentText || '')
    .trim()
    .slice(0, TASK_COMMENT_NOTIFY_MAX_TEXT_LENGTH);
  const isReply = normalizeTaskCommentNotifyMode(mode) === 'reply';
  const subject = isReply
    ? `[PM Calendar] Reply on task: ${safeTaskTitle}`
    : `[PM Calendar] New comment on task: ${safeTaskTitle}`;
  const headline = isReply ? 'You have a new reply on a task comment.' : 'You have a new task comment.';
  await mailer.sendMail({
    from: process.env.OTP_FROM_EMAIL,
    to: safeToEmail,
    subject,
    text: [
      headline,
      `Task: ${safeTaskTitle}`,
      `From: ${safeActorUsername}`,
      '',
      safeCommentText || '-',
    ].join('\n'),
    html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <p style="margin:0 0 10px 0;font-size:14px">${headline}</p>
      <p style="margin:0 0 6px 0"><strong>Task:</strong> ${safeTaskTitle}</p>
      <p style="margin:0 0 6px 0"><strong>To:</strong> ${safeToUsername}</p>
      <p style="margin:0 0 12px 0"><strong>From:</strong> ${safeActorUsername}</p>
      <div style="padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;white-space:pre-wrap">${safeCommentText || '-'}</div>
    </div>`,
  });
};

const validateOtp = async (email, otp) => {
  const doc = await otpRef.doc(otpDocId(email)).get();
  if (!doc.exists) {
    return { ok: false, message: 'OTP is not requested for this email.' };
  }

  const data = doc.data();
  const expiresAt = Number(data.expiresAt || 0);
  if (Date.now() > expiresAt) {
    await otpRef.doc(otpDocId(email)).delete();
    return { ok: false, message: 'OTP has expired. Please request a new code.' };
  }

  const isValid = await bcrypt.compare(String(otp || '').trim(), String(data.codeHash || ''));
  if (!isValid) {
    return { ok: false, message: 'Invalid OTP code.' };
  }

  return { ok: true };
};

app.get('/health', (_req, res) => {
  const redirectUriPreview =
    GOOGLE_CALENDAR_REDIRECT_URI ||
    String(GOOGLE_OAUTH_JSON_CONFIG.redirectUris?.[0] || '').trim() ||
    '/google/calendar/callback (dynamic host fallback)';
  res.json({
    ok: true,
    service: 'pm-calendar-auth-server',
    firestoreCollectionUsers: USERS_COLLECTION,
    firestoreCollectionOtp: OTP_COLLECTION,
    firestoreCollectionAppData: APP_DATA_COLLECTION,
    firestoreCollectionAppDataChunks: APP_DATA_CHUNK_COLLECTION,
    firestoreCollectionProjectInvites: PROJECT_INVITES_COLLECTION,
    firestoreProjectInvitesDocId: PROJECT_INVITES_DOC_ID,
    firestoreLineReminderCollection: FIRESTORE_LINE_REMINDER_COLLECTION,
    firestoreLineReminderLogCollection: FIRESTORE_LINE_REMINDER_LOG_COLLECTION,
    firestoreLineWebhookLogCollection: FIRESTORE_LINE_WEBHOOK_LOG_COLLECTION,
    firestoreAdminComplaintCollection: FIRESTORE_ADMIN_COMPLAINT_COLLECTION,
    firestoreSupportTicketCollection: FIRESTORE_SUPPORT_TICKET_COLLECTION,
    googleClientConfigured: Boolean(GOOGLE_CLIENT_ID),
    googleCalendarOAuthConfigured: Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
    googleCalendarRedirectUriPreview: redirectUriPreview,
    lineReminderCronConfigured: Boolean(LINE_REMINDER_CRON_SECRET),
    lineReminderPushConfigured: Boolean(LINE_REMINDER_CHANNEL_ACCESS_TOKEN),
    lineReminderDefaultTimezone: normalizeLineReminderTimezone(DEFAULT_LINE_REMINDER_TIMEZONE),
    lineReminderDefaultHour: DEFAULT_LINE_REMINDER_HOUR,
    lineReminderDefaultDaysBefore: DEFAULT_LINE_REMINDER_DAYS_BEFORE,
    lineWebhookConfigured: Boolean(LINE_CHANNEL_SECRET),
    lineWebhookReplyConfigured: Boolean(LINE_WEBHOOK_CHANNEL_ACCESS_TOKEN),
    openAiConfigured: Boolean(OPENAI_API_KEY),
    openAiModel: OPENAI_MODEL,
    openAiReasoningEffort: OPENAI_REASONING_EFFORT,
    rootAdminConfigured: Boolean(ROOT_ADMIN_EMAIL),
    adminStatsTimezone: ADMIN_STATS_TIMEZONE,
    supportTicketAttachmentLimit: SUPPORT_TICKET_MAX_ATTACHMENTS,
    supportTicketAttachmentMaxBytes: SUPPORT_TICKET_MAX_ATTACHMENT_BYTES,
  });
});

app.post('/auth/send-otp', async (req, res) => {
  try {
    const email = sanitizeEmail(req.body?.email);
    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'Valid email is required.' });
    }

    const code = generateOtpCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = Date.now() + OTP_TTL_MINUTES * 60 * 1000;

    await otpRef.doc(otpDocId(email)).set({
      email,
      codeHash,
      expiresAt,
      createdAt: new Date().toISOString(),
    });

    await sendOtpEmail(email, code);

    return res.json({ message: 'OTP has been sent to your email.' });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to send OTP.' });
  }
});

app.post('/auth/register', async (req, res) => {
  try {
    const username = sanitizeUsername(req.body?.username);
    const email = sanitizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const otp = String(req.body?.otp || '').trim();

    if (!username || !email || !password || !otp) {
      return res.status(400).json({ message: 'username, email, password and otp are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const otpStatus = await validateOtp(email, otp);
    if (!otpStatus.ok) {
      return res.status(400).json({ message: otpStatus.message });
    }

    const emailExists = await getUserByEmail(email);
    if (emailExists) {
      return res.status(409).json({ message: 'This email is already registered.' });
    }

    const usernameExists = await getUserByUsername(username);
    if (usernameExists) {
      return res.status(409).json({ message: 'This username is already taken.' });
    }

    const userId = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const user = {
      username,
      email,
      avatarUrl: '',
      provider: 'local',
      passwordHash: await bcrypt.hash(password, 10),
      createdAt: nowIso,
      updatedAt: nowIso,
      lastLoginAt: nowIso,
    };

    await usersRef.doc(userId).set(user);
    await otpRef.doc(otpDocId(email)).delete();

    const publicUser = toPublicUser({ id: userId, ...user });
    return res.status(201).json({
      message: 'Account created successfully.',
      user: publicUser,
      token: createAuthToken(publicUser),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Registration failed.' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const identifierRaw = String(req.body?.identifier || '').trim();
    const identifier = identifierRaw.toLowerCase();
    const password = String(req.body?.password || '');

    if (!identifier || !password) {
      return res.status(400).json({ message: 'identifier and password are required.' });
    }

    const user = identifier.includes('@')
      ? await getUserByEmail(identifier)
      : await getUserByUsername(identifier);

    if (!user) {
      return res.status(401).json({ message: 'Invalid username/email or password.' });
    }

    const passwordHash = String(user.passwordHash || '').trim();
    const legacyPassword = String(user.password || '');
    if (!passwordHash && !legacyPassword) {
      return res.status(400).json({ message: 'This account uses Google sign-in.' });
    }

    const isPasswordValid = passwordHash
      ? await bcrypt.compare(password, passwordHash)
      : legacyPassword === password;
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid username/email or password.' });
    }

    const nowIso = new Date().toISOString();
    const loginPatch = {
      lastLoginAt: nowIso,
      updatedAt: nowIso,
    };
    if (!passwordHash && legacyPassword) {
      loginPatch.passwordHash = await bcrypt.hash(password, 10);
      loginPatch.password = '';
    }
    await usersRef.doc(user.id).set(loginPatch, { merge: true });

    const publicUser = toPublicUser(user);
    return res.json({
      message: 'Login successful.',
      user: publicUser,
      token: createAuthToken(publicUser),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Login failed.' });
  }
});

app.post('/auth/google', async (req, res) => {
  try {
    const idToken = String(req.body?.idToken || '').trim();
    const accessToken = String(req.body?.accessToken || '').trim();
    const requestedMode = String(req.body?.mode || 'register').trim().toLowerCase();
    const authMode = requestedMode || 'register';
    if (authMode !== 'login' && authMode !== 'register') {
      return res.status(400).json({ message: 'Invalid Google auth mode. Use "login" or "register".' });
    }

    if (!idToken && !accessToken) {
      return res.status(400).json({ message: 'idToken or accessToken is required.' });
    }

    let email = '';
    let name = '';
    let picture = '';
    let emailVerified = false;

    if (idToken) {
      if (!oauthClient || !GOOGLE_CLIENT_ID) {
        return res.status(500).json({
          message: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID or GOOGLE_OAUTH_JSON_PATH.',
        });
      }

      const ticket = await oauthClient.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      email = sanitizeEmail(payload?.email);
      name = String(payload?.name || '').trim();
      picture = String(payload?.picture || '').trim();
      emailVerified = payload?.email_verified === true || payload?.email_verified === 'true';
    } else {
      const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!profileResponse.ok) {
        return res.status(401).json({ message: 'Invalid Google access token.' });
      }

      const profile = await profileResponse.json();
      email = sanitizeEmail(profile?.email);
      name = String(profile?.name || '').trim();
      picture = String(profile?.picture || '').trim();
      emailVerified = profile?.email_verified === true || profile?.email_verified === 'true';
    }

    if (!email || !emailVerified) {
      return res.status(401).json({ message: 'Google account email is not verified.' });
    }

    const loginAtIso = new Date().toISOString();
    let user = await getUserByEmail(email);

    if (!user) {
      if (authMode === 'login') {
        return res.status(404).json({
          message: 'No PM Calendar account found for this Google email. Please register first.',
          code: 'ACCOUNT_NOT_FOUND',
        });
      }
      const preferredUsername = sanitizeUsername(name || email.split('@')[0]);
      const uniqueUsername = await makeUniqueUsername(preferredUsername);
      const userId = crypto.randomUUID();
      const newUser = {
        username: uniqueUsername,
        email,
        avatarUrl: picture,
        provider: 'google',
        passwordHash: '',
        createdAt: loginAtIso,
        updatedAt: loginAtIso,
        lastLoginAt: loginAtIso,
      };
      await usersRef.doc(userId).set(newUser);
      user = { id: userId, ...newUser };
    } else {
      const profilePatch = {
        lastLoginAt: loginAtIso,
        updatedAt: loginAtIso,
      };
      if (picture && user.avatarUrl !== picture) {
        profilePatch.avatarUrl = picture;
        user.avatarUrl = picture;
      }
      await usersRef.doc(user.id).set(profilePatch, { merge: true });
    }

    const publicUser = toPublicUser(user);
    return res.json({
      message: authMode === 'login' ? 'Google login successful.' : 'Google sign-in successful.',
      user: publicUser,
      token: createAuthToken(publicUser),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Google sign-in failed.' });
  }
});

app.post('/auth/verify-otp', async (req, res) => {
  try {
    const email = sanitizeEmail(req.body?.email);
    const otp = String(req.body?.otp || '').trim();
    if (!email || !otp) {
      return res.status(400).json({ message: 'email and otp are required.' });
    }

    const otpStatus = await validateOtp(email, otp);
    if (!otpStatus.ok) {
      return res.status(400).json({ message: otpStatus.message });
    }

    return res.json({ message: 'OTP verified successfully.' });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to verify OTP.' });
  }
});

app.get('/google/calendar/auth-url', requireAuth, async (req, res) => {
  try {
    const userId = sanitizeUserId(req.query?.userId);
    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }
    if (!ensureAuthUserMatches(req, res, userId)) {
      return;
    }

    const oauthForCalendar = createGoogleCalendarOauthClient(req);
    if (!oauthForCalendar) {
      return res.status(503).json({
        message:
          'Google Calendar OAuth is not configured. Set GOOGLE_CLIENT_SECRET and GOOGLE_CALENDAR_REDIRECT_URI (or GOOGLE_OAUTH_JSON_PATH).',
      });
    }

    const userDoc = await usersRef.doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const user = userDoc.data() || {};
    const userEmail = sanitizeEmail(user.email);
    if (!userEmail) {
      return res.status(400).json({ message: 'This account has no email and cannot link Google Calendar.' });
    }

    const stateToken = crypto.randomBytes(24).toString('hex');
    await usersRef.doc(userId).set(
      {
        googleCalendarLinkState: {
          token: stateToken,
          expiresAt: Date.now() + GOOGLE_CALENDAR_STATE_TTL_MS,
          createdAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    const authUrl = oauthForCalendar.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: GOOGLE_CALENDAR_SCOPES,
      state: stateToken,
    });

    return res.json({
      authUrl,
      redirectUri: resolveGoogleCalendarRedirectUri(req),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to generate Google Calendar auth URL.' });
  }
});

app.get('/google/calendar/callback', async (req, res) => {
  try {
    const stateToken = String(req.query?.state || '').trim();
    const code = String(req.query?.code || '').trim();
    const oauthError = String(req.query?.error || '').trim();

    if (oauthError) {
      return sendGoogleCalendarPopupResponse(res, {
        ok: false,
        message: `Google authorization failed: ${oauthError}.`,
      });
    }
    if (!stateToken || !code) {
      return sendGoogleCalendarPopupResponse(res, {
        ok: false,
        message: 'Missing OAuth state or authorization code.',
      });
    }

    const oauthForCalendar = createGoogleCalendarOauthClient(req);
    if (!oauthForCalendar) {
      return sendGoogleCalendarPopupResponse(res, {
        ok: false,
        message: 'Server Google Calendar OAuth is not configured.',
      });
    }

    const userSnapshot = await usersRef
      .where('googleCalendarLinkState.token', '==', stateToken)
      .limit(1)
      .get();
    if (userSnapshot.empty) {
      return sendGoogleCalendarPopupResponse(res, {
        ok: false,
        message: 'Invalid or expired Google Calendar linking state.',
      });
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data() || {};
    const userEmail = sanitizeEmail(userData.email);
    const stateData = getGoogleCalendarLinkState(userData);
    if (!stateData || stateData.token !== stateToken || Date.now() > stateData.expiresAt) {
      await usersRef.doc(userDoc.id).set(
        {
          googleCalendarLinkState: null,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      return sendGoogleCalendarPopupResponse(res, {
        ok: false,
        message: 'Google Calendar linking request expired. Please try again.',
      });
    }

    await usersRef.doc(userDoc.id).set(
      {
        googleCalendarLinkState: null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    const tokenResult = await oauthForCalendar.getToken(code);
    const tokens = tokenResult?.tokens || {};
    oauthForCalendar.setCredentials(tokens);

    const issuedAccessToken =
      String(tokens.access_token || '').trim() ||
      String((await oauthForCalendar.getAccessToken())?.token || '').trim();
    if (!issuedAccessToken) {
      return sendGoogleCalendarPopupResponse(res, {
        ok: false,
        message: 'Could not obtain access token from Google.',
      });
    }

    const googleProfile = await fetchGoogleProfileFromAccessToken(issuedAccessToken);
    if (!googleProfile.email || !googleProfile.emailVerified) {
      return sendGoogleCalendarPopupResponse(res, {
        ok: false,
        message: 'Google account email is not verified.',
      });
    }

    if (googleProfile.email !== userEmail) {
      return sendGoogleCalendarPopupResponse(res, {
        ok: false,
        message: `Please link with your registered email (${userEmail}).`,
      });
    }

    const previousIntegration = getGoogleCalendarIntegration(userData);
    const refreshToken =
      String(tokens.refresh_token || '').trim() || String(previousIntegration?.refreshToken || '').trim();
    if (!refreshToken) {
      return sendGoogleCalendarPopupResponse(res, {
        ok: false,
        message: 'Google did not return a refresh token. Please unlink and try linking again.',
      });
    }

    const nowIso = new Date().toISOString();
    await usersRef.doc(userDoc.id).set(
      {
        googleCalendarLinkState: null,
        googleCalendarIntegration: {
          linkedEmail: googleProfile.email,
          refreshToken,
          accessToken: issuedAccessToken,
          accessTokenExpiresAt: Number(tokens.expiry_date || 0),
          scope: String(tokens.scope || '').trim(),
          tokenType: String(tokens.token_type || '').trim(),
          linkedAt: previousIntegration?.linkedAt || nowIso,
          updatedAt: nowIso,
          selectedCalendarIds: previousIntegration?.selectedCalendarIds || [],
        },
        updatedAt: nowIso,
      },
      { merge: true }
    );

    return sendGoogleCalendarPopupResponse(res, {
      ok: true,
      message: `Linked Google Calendar for ${googleProfile.email}.`,
    });
  } catch (error) {
    return sendGoogleCalendarPopupResponse(res, {
      ok: false,
      message: error.message || 'Failed to complete Google Calendar linking.',
    });
  }
});

app.get('/google/calendar/status', requireAuth, async (req, res) => {
  try {
    const userId = sanitizeUserId(req.query?.userId);
    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }
    if (!ensureAuthUserMatches(req, res, userId)) {
      return;
    }

    const userDoc = await usersRef.doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const userData = userDoc.data() || {};
    const linkedGoogleCalendar = getGoogleCalendarIntegration(userData);

    return res.json({
      linked: Boolean(linkedGoogleCalendar),
      linkedEmail: linkedGoogleCalendar?.linkedEmail || '',
      linkedAt: linkedGoogleCalendar?.linkedAt || null,
      updatedAt: linkedGoogleCalendar?.updatedAt || null,
      selectedCalendarIds: linkedGoogleCalendar?.selectedCalendarIds || [],
      configured: Boolean(createGoogleCalendarOauthClient(req)),
      redirectUri: resolveGoogleCalendarRedirectUri(req),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to get Google Calendar status.' });
  }
});

app.get('/google/calendar/calendars', requireAuth, async (req, res) => {
  try {
    const userId = sanitizeUserId(req.query?.userId);
    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }
    if (!ensureAuthUserMatches(req, res, userId)) {
      return;
    }

    const oauthForCalendar = createGoogleCalendarOauthClient(req);
    if (!oauthForCalendar) {
      return res.status(503).json({
        message:
          'Google Calendar OAuth is not configured. Set GOOGLE_CLIENT_SECRET and GOOGLE_CALENDAR_REDIRECT_URI (or GOOGLE_OAUTH_JSON_PATH).',
      });
    }

    const userDoc = await usersRef.doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const userData = userDoc.data() || {};
    const googleCalendarIntegration = getGoogleCalendarIntegration(userData);
    if (!googleCalendarIntegration) {
      return res.status(404).json({ message: 'Google Calendar is not linked for this user.' });
    }

    oauthForCalendar.setCredentials({
      refresh_token: googleCalendarIntegration.refreshToken,
      access_token: googleCalendarIntegration.accessToken || undefined,
      expiry_date:
        Number.isFinite(googleCalendarIntegration.accessTokenExpiresAt) &&
        googleCalendarIntegration.accessTokenExpiresAt > 0
          ? googleCalendarIntegration.accessTokenExpiresAt
          : undefined,
    });

    const accessToken = String((await oauthForCalendar.getAccessToken())?.token || '').trim();
    if (!accessToken) {
      return res.status(401).json({
        message: 'Unable to refresh Google Calendar access token. Please unlink and link again.',
      });
    }

    const calendars = await fetchGoogleCalendarList(accessToken);
    const selectedCalendarIds = filterGoogleCalendarSelectionByAvailableCalendars(
      googleCalendarIntegration.selectedCalendarIds,
      calendars
    );
    const refreshedCredentials = oauthForCalendar.credentials || {};
    const nextRefreshToken =
      String(refreshedCredentials.refresh_token || '').trim() || googleCalendarIntegration.refreshToken;
    const nowIso = new Date().toISOString();

    await usersRef.doc(userId).set(
      {
        googleCalendarIntegration: {
          linkedEmail: googleCalendarIntegration.linkedEmail,
          refreshToken: nextRefreshToken,
          accessToken,
          accessTokenExpiresAt: Number(refreshedCredentials.expiry_date || 0),
          scope: String(refreshedCredentials.scope || googleCalendarIntegration.scope || '').trim(),
          tokenType: String(refreshedCredentials.token_type || googleCalendarIntegration.tokenType || '').trim(),
          linkedAt: googleCalendarIntegration.linkedAt || nowIso,
          updatedAt: nowIso,
          selectedCalendarIds,
        },
        updatedAt: nowIso,
      },
      { merge: true }
    );

    return res.json({
      source: 'google_calendar',
      linkedEmail: googleCalendarIntegration.linkedEmail,
      calendars,
      selectedCalendarIds,
      count: calendars.length,
      updatedAt: nowIso,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch Google Calendar list.' });
  }
});

app.put('/google/calendar/calendars', requireAuth, async (req, res) => {
  try {
    const userId = sanitizeUserId(req.query?.userId || req.body?.userId);
    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }
    if (!ensureAuthUserMatches(req, res, userId)) {
      return;
    }

    const oauthForCalendar = createGoogleCalendarOauthClient(req);
    if (!oauthForCalendar) {
      return res.status(503).json({
        message:
          'Google Calendar OAuth is not configured. Set GOOGLE_CLIENT_SECRET and GOOGLE_CALENDAR_REDIRECT_URI (or GOOGLE_OAUTH_JSON_PATH).',
      });
    }

    const userDoc = await usersRef.doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const userData = userDoc.data() || {};
    const googleCalendarIntegration = getGoogleCalendarIntegration(userData);
    if (!googleCalendarIntegration) {
      return res.status(404).json({ message: 'Google Calendar is not linked for this user.' });
    }

    const requestedSelection = normalizeGoogleCalendarSelection(req.body?.selectedCalendarIds);

    oauthForCalendar.setCredentials({
      refresh_token: googleCalendarIntegration.refreshToken,
      access_token: googleCalendarIntegration.accessToken || undefined,
      expiry_date:
        Number.isFinite(googleCalendarIntegration.accessTokenExpiresAt) &&
        googleCalendarIntegration.accessTokenExpiresAt > 0
          ? googleCalendarIntegration.accessTokenExpiresAt
          : undefined,
    });

    const accessToken = String((await oauthForCalendar.getAccessToken())?.token || '').trim();
    if (!accessToken) {
      return res.status(401).json({
        message: 'Unable to refresh Google Calendar access token. Please unlink and link again.',
      });
    }

    const calendars = await fetchGoogleCalendarList(accessToken);
    const selectedCalendarIds = filterGoogleCalendarSelectionByAvailableCalendars(
      requestedSelection,
      calendars
    );
    const refreshedCredentials = oauthForCalendar.credentials || {};
    const nextRefreshToken =
      String(refreshedCredentials.refresh_token || '').trim() || googleCalendarIntegration.refreshToken;
    const nowIso = new Date().toISOString();

    await usersRef.doc(userId).set(
      {
        googleCalendarIntegration: {
          linkedEmail: googleCalendarIntegration.linkedEmail,
          refreshToken: nextRefreshToken,
          accessToken,
          accessTokenExpiresAt: Number(refreshedCredentials.expiry_date || 0),
          scope: String(refreshedCredentials.scope || googleCalendarIntegration.scope || '').trim(),
          tokenType: String(refreshedCredentials.token_type || googleCalendarIntegration.tokenType || '').trim(),
          linkedAt: googleCalendarIntegration.linkedAt || nowIso,
          updatedAt: nowIso,
          selectedCalendarIds,
        },
        updatedAt: nowIso,
      },
      { merge: true }
    );

    return res.json({
      ok: true,
      source: 'google_calendar',
      linkedEmail: googleCalendarIntegration.linkedEmail,
      calendars,
      selectedCalendarIds,
      count: calendars.length,
      updatedAt: nowIso,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to save Google Calendar selection.' });
  }
});

app.delete('/google/calendar/link', requireAuth, async (req, res) => {
  try {
    const userId = sanitizeUserId(req.query?.userId || req.body?.userId);
    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }
    if (!ensureAuthUserMatches(req, res, userId)) {
      return;
    }

    const userDoc = await usersRef.doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found.' });
    }

    await usersRef.doc(userId).set(
      {
        googleCalendarLinkState: null,
        googleCalendarIntegration: null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return res.json({
      ok: true,
      message: 'Google Calendar disconnected.',
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to unlink Google Calendar.' });
  }
});

app.get('/google/calendar/events', requireAuth, async (req, res) => {
  try {
    const userId = sanitizeUserId(req.query?.userId);
    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }
    if (!ensureAuthUserMatches(req, res, userId)) {
      return;
    }

    const oauthForCalendar = createGoogleCalendarOauthClient(req);
    if (!oauthForCalendar) {
      return res.status(503).json({
        message:
          'Google Calendar OAuth is not configured. Set GOOGLE_CLIENT_SECRET and GOOGLE_CALENDAR_REDIRECT_URI (or GOOGLE_OAUTH_JSON_PATH).',
      });
    }

    const userDoc = await usersRef.doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const userData = userDoc.data() || {};
    const googleCalendarIntegration = getGoogleCalendarIntegration(userData);
    if (!googleCalendarIntegration) {
      return res.status(404).json({ message: 'Google Calendar is not linked for this user.' });
    }

    const rawTimeMin = String(req.query?.timeMin || '').trim();
    const rawTimeMax = String(req.query?.timeMax || '').trim();
    const timeMinIso = rawTimeMin || new Date().toISOString();
    const timeMaxIso = rawTimeMax || new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();
    const timeMinDate = new Date(timeMinIso);
    const timeMaxDate = new Date(timeMaxIso);
    if (Number.isNaN(timeMinDate.getTime()) || Number.isNaN(timeMaxDate.getTime())) {
      return res.status(400).json({ message: 'timeMin/timeMax must be valid ISO datetime.' });
    }
    if (timeMaxDate <= timeMinDate) {
      return res.status(400).json({ message: 'timeMax must be after timeMin.' });
    }

    oauthForCalendar.setCredentials({
      refresh_token: googleCalendarIntegration.refreshToken,
      access_token: googleCalendarIntegration.accessToken || undefined,
      expiry_date:
        Number.isFinite(googleCalendarIntegration.accessTokenExpiresAt) &&
        googleCalendarIntegration.accessTokenExpiresAt > 0
          ? googleCalendarIntegration.accessTokenExpiresAt
          : undefined,
    });

    const accessToken = String((await oauthForCalendar.getAccessToken())?.token || '').trim();
    if (!accessToken) {
      return res.status(401).json({
        message: 'Unable to refresh Google Calendar access token. Please unlink and link again.',
      });
    }

    const eventsResult = await fetchGoogleCalendarEvents(
      accessToken,
      timeMinDate.toISOString(),
      timeMaxDate.toISOString(),
      googleCalendarIntegration.selectedCalendarIds
    );
    const events = Array.isArray(eventsResult?.events) ? eventsResult.events : [];
    const calendars = Array.isArray(eventsResult?.calendars) ? eventsResult.calendars : [];
    const selectedCalendarIds = filterGoogleCalendarSelectionByAvailableCalendars(
      eventsResult?.selectedCalendarIds,
      calendars
    );
    const refreshedCredentials = oauthForCalendar.credentials || {};
    const nextRefreshToken =
      String(refreshedCredentials.refresh_token || '').trim() || googleCalendarIntegration.refreshToken;
    const nowIso = new Date().toISOString();

    await usersRef.doc(userId).set(
      {
        googleCalendarIntegration: {
          linkedEmail: googleCalendarIntegration.linkedEmail,
          refreshToken: nextRefreshToken,
          accessToken,
          accessTokenExpiresAt: Number(refreshedCredentials.expiry_date || 0),
          scope: String(refreshedCredentials.scope || googleCalendarIntegration.scope || '').trim(),
          tokenType: String(refreshedCredentials.token_type || googleCalendarIntegration.tokenType || '').trim(),
          linkedAt: googleCalendarIntegration.linkedAt || nowIso,
          updatedAt: nowIso,
          selectedCalendarIds,
        },
        updatedAt: nowIso,
      },
      { merge: true }
    );

    return res.json({
      events,
      source: 'google_calendar',
      projectId: GOOGLE_CALENDAR_PROJECT_ID,
      linkedEmail: googleCalendarIntegration.linkedEmail,
      calendars,
      selectedCalendarIds,
      count: events.length,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch Google Calendar events.' });
  }
});

app.post('/google/calendar/events', requireAuth, async (req, res) => {
  try {
    const userId = sanitizeUserId(req.query?.userId || req.body?.userId);
    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }
    if (!ensureAuthUserMatches(req, res, userId)) {
      return;
    }

    const oauthForCalendar = createGoogleCalendarOauthClient(req);
    if (!oauthForCalendar) {
      return res.status(503).json({
        message:
          'Google Calendar OAuth is not configured. Set GOOGLE_CLIENT_SECRET and GOOGLE_CALENDAR_REDIRECT_URI (or GOOGLE_OAUTH_JSON_PATH).',
      });
    }

    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();
    const location = String(req.body?.location || '').trim();
    const startDate = String(req.body?.startDate || '').trim();
    const endDate = String(req.body?.endDate || startDate).trim();
    const showTime = req.body?.showTime !== false;
    const startTime = String(req.body?.startTime || '09:00').trim();
    const endTime = String(req.body?.endTime || '10:00').trim();
    const requestedCalendarId = String(req.body?.calendarId || '').trim();
    const colorId = normalizeGoogleEventColorId(req.body?.colorId);
    const pmCalendarEventId = String(req.body?.pmCalendarEventId || '').trim();
    const requestedGoogleEventId = String(req.body?.googleEventId || '').trim();
    const recordType = String(req.body?.recordType || '').trim().toLowerCase();
    const department = String(req.body?.department || '').trim();
    const timeZone = String(req.body?.timeZone || '').trim() || 'UTC';

    if (!title) {
      return res.status(400).json({ message: 'title is required.' });
    }
    if (!ISO_DATE_PATTERN.test(startDate) || !ISO_DATE_PATTERN.test(endDate)) {
      return res.status(400).json({ message: 'startDate/endDate must be in YYYY-MM-DD format.' });
    }
    if (endDate < startDate) {
      return res.status(400).json({ message: 'endDate must be on or after startDate.' });
    }
    if (showTime && (!ISO_TIME_PATTERN.test(startTime) || !ISO_TIME_PATTERN.test(endTime))) {
      return res.status(400).json({ message: 'startTime/endTime must be in HH:mm format.' });
    }
    if (showTime && endDate === startDate && endTime <= startTime) {
      return res.status(400).json({ message: 'endTime must be after startTime for same-day events.' });
    }

    const userDoc = await usersRef.doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const userData = userDoc.data() || {};
    const googleCalendarIntegration = getGoogleCalendarIntegration(userData);
    if (!googleCalendarIntegration) {
      return res.status(404).json({ message: 'Google Calendar is not linked for this user.' });
    }

    oauthForCalendar.setCredentials({
      refresh_token: googleCalendarIntegration.refreshToken,
      access_token: googleCalendarIntegration.accessToken || undefined,
      expiry_date:
        Number.isFinite(googleCalendarIntegration.accessTokenExpiresAt) &&
        googleCalendarIntegration.accessTokenExpiresAt > 0
          ? googleCalendarIntegration.accessTokenExpiresAt
          : undefined,
    });

    const accessToken = String((await oauthForCalendar.getAccessToken())?.token || '').trim();
    if (!accessToken) {
      return res.status(401).json({
        message: 'Unable to refresh Google Calendar access token. Please unlink and link again.',
      });
    }

    const calendars = await fetchGoogleCalendarList(accessToken);
    const availableCalendarIds = new Set(
      calendars.map((calendar) => String(calendar.id || '').trim()).filter(Boolean)
    );
    const writableCalendars = calendars.filter((calendar) => canWriteToGoogleCalendar(calendar));
    const writableCalendarIds = new Set(
      writableCalendars.map((calendar) => String(calendar.id || '').trim()).filter(Boolean)
    );
    const selectedCalendarIds = filterGoogleCalendarSelectionByAvailableCalendars(
      googleCalendarIntegration.selectedCalendarIds,
      calendars
    );

    let calendarId = requestedCalendarId;
    if (calendarId && !availableCalendarIds.has(calendarId)) {
      return res.status(400).json({ message: 'Selected Google Calendar is not available.' });
    }
    if (calendarId && !writableCalendarIds.has(calendarId)) {
      return res.status(403).json({
        message: 'You need to have writer access to this calendar.',
      });
    }
    if (!calendarId) {
      calendarId =
        selectedCalendarIds.find((id) => writableCalendarIds.has(String(id || '').trim())) ||
        writableCalendars[0]?.id ||
        '';
    }
    if (!calendarId) {
      return res.status(403).json({
        message:
          'No writable Google Calendar found. Grant "Make changes to events" permission and try again.',
      });
    }

    const calendarContext =
      calendars.find((calendar) => calendar.id === calendarId) ||
      ({ id: calendarId, summary: calendarId === 'primary' ? 'Primary' : calendarId });

    const googlePayload = {
      summary: title,
      description: description || undefined,
      location: location || undefined,
    };
    if (recordType === 'task') {
      googlePayload.transparency = 'transparent';
    }
    if (colorId) {
      googlePayload.colorId = colorId;
    }
    if (pmCalendarEventId || recordType || department) {
      googlePayload.extendedProperties = {
        private: {
          ...(pmCalendarEventId ? { pmCalendarEventId } : {}),
          ...(recordType ? { recordType } : {}),
          ...(department ? { department } : {}),
        },
      };
    }

    if (showTime) {
      googlePayload.start = {
        dateTime: `${startDate}T${startTime}:00`,
        timeZone,
      };
      googlePayload.end = {
        dateTime: `${endDate}T${endTime}:00`,
        timeZone,
      };
    } else {
      googlePayload.start = { date: startDate };
      googlePayload.end = { date: shiftIsoDateByDays(endDate, 1) };
    }

    let targetGoogleEventId = requestedGoogleEventId;
    if (!targetGoogleEventId && pmCalendarEventId) {
      const lookupParams = new URLSearchParams({
        maxResults: '1',
        singleEvents: 'true',
      });
      lookupParams.set('privateExtendedProperty', `pmCalendarEventId=${pmCalendarEventId}`);
      const lookupResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          calendarId
        )}/events?${lookupParams.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (lookupResponse.ok) {
        const lookupPayload = await lookupResponse.json();
        const existingEvent = Array.isArray(lookupPayload?.items)
          ? lookupPayload.items.find((item) => String(item?.id || '').trim())
          : null;
        targetGoogleEventId = String(existingEvent?.id || '').trim();
      }
    }

    const upsertMethod = targetGoogleEventId ? 'PATCH' : 'POST';
    const upsertUrl = targetGoogleEventId
      ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          calendarId
        )}/events/${encodeURIComponent(targetGoogleEventId)}`
      : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

    const insertResponse = await fetch(upsertUrl, {
      method: upsertMethod,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(googlePayload),
    });

    if (!insertResponse.ok) {
      let googleErrorMessage = '';
      try {
        const googleErrorPayload = await insertResponse.json();
        googleErrorMessage = String(
          googleErrorPayload?.error?.message || googleErrorPayload?.message || ''
        ).trim();
      } catch {
        googleErrorMessage = '';
      }

      if (insertResponse.status === 403) {
        return res.status(403).json({
          message:
            googleErrorMessage ||
            'Google permission denied. Please unlink and link Google Calendar again to grant event write access.',
        });
      }

      return res.status(502).json({
        message:
          googleErrorMessage ||
          `Google Calendar event insert failed (${insertResponse.status}).`,
      });
    }

    const createdGoogleEvent = await insertResponse.json();
    const normalizedCreatedEvent = normalizeGoogleCalendarEvent(createdGoogleEvent, calendarContext);

    const refreshedCredentials = oauthForCalendar.credentials || {};
    const nextRefreshToken =
      String(refreshedCredentials.refresh_token || '').trim() || googleCalendarIntegration.refreshToken;
    const nowIso = new Date().toISOString();

    await usersRef.doc(userId).set(
      {
        googleCalendarIntegration: {
          linkedEmail: googleCalendarIntegration.linkedEmail,
          refreshToken: nextRefreshToken,
          accessToken,
          accessTokenExpiresAt: Number(refreshedCredentials.expiry_date || 0),
          scope: String(refreshedCredentials.scope || googleCalendarIntegration.scope || '').trim(),
          tokenType: String(refreshedCredentials.token_type || googleCalendarIntegration.tokenType || '').trim(),
          linkedAt: googleCalendarIntegration.linkedAt || nowIso,
          updatedAt: nowIso,
          selectedCalendarIds,
        },
        updatedAt: nowIso,
      },
      { merge: true }
    );

    return res.json({
      ok: true,
      source: 'google_calendar',
      calendarId,
      colorId: colorId || null,
      event: normalizedCreatedEvent,
      updatedAt: nowIso,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to create Google Calendar event.' });
  }
});

app.delete('/google/calendar/events', requireAuth, async (req, res) => {
  try {
    const userId = sanitizeUserId(req.query?.userId || req.body?.userId);
    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }
    if (!ensureAuthUserMatches(req, res, userId)) {
      return;
    }

    const oauthForCalendar = createGoogleCalendarOauthClient(req);
    if (!oauthForCalendar) {
      return res.status(503).json({
        message:
          'Google Calendar OAuth is not configured. Set GOOGLE_CLIENT_SECRET and GOOGLE_CALENDAR_REDIRECT_URI (or GOOGLE_OAUTH_JSON_PATH).',
      });
    }

    const calendarId = String(req.body?.calendarId || '').trim();
    const googleEventId = String(req.body?.googleEventId || '').trim();
    if (!calendarId || !googleEventId) {
      return res.status(400).json({ message: 'calendarId and googleEventId are required.' });
    }

    const userDoc = await usersRef.doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const userData = userDoc.data() || {};
    const googleCalendarIntegration = getGoogleCalendarIntegration(userData);
    if (!googleCalendarIntegration) {
      return res.status(404).json({ message: 'Google Calendar is not linked for this user.' });
    }

    oauthForCalendar.setCredentials({
      refresh_token: googleCalendarIntegration.refreshToken,
      access_token: googleCalendarIntegration.accessToken || undefined,
      expiry_date:
        Number.isFinite(googleCalendarIntegration.accessTokenExpiresAt) &&
        googleCalendarIntegration.accessTokenExpiresAt > 0
          ? googleCalendarIntegration.accessTokenExpiresAt
          : undefined,
    });

    const accessToken = String((await oauthForCalendar.getAccessToken())?.token || '').trim();
    if (!accessToken) {
      return res.status(401).json({
        message: 'Unable to refresh Google Calendar access token. Please unlink and link again.',
      });
    }

    const deleteResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId
      )}/events/${encodeURIComponent(googleEventId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!deleteResponse.ok && deleteResponse.status !== 404) {
      let googleErrorMessage = '';
      try {
        const googleErrorPayload = await deleteResponse.json();
        googleErrorMessage = String(
          googleErrorPayload?.error?.message || googleErrorPayload?.message || ''
        ).trim();
      } catch {
        googleErrorMessage = '';
      }
      return res.status(deleteResponse.status).json({
        message:
          googleErrorMessage ||
          `Google Calendar event delete failed (${deleteResponse.status}).`,
      });
    }

    return res.json({
      ok: true,
      calendarId,
      googleEventId,
      deletedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to delete Google Calendar event.' });
  }
});

app.get('/users/lookup', requireAuth, async (req, res) => {
  try {
    const identifierRaw = String(req.query?.identifier || '').trim();
    if (!identifierRaw) {
      return res.status(400).json({ message: 'identifier is required.' });
    }

    const identifier = identifierRaw.toLowerCase();
    const user = identifier.includes('@')
      ? await getUserByEmail(identifier)
      : await getUserByUsername(identifier);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.json({ user: toPublicUser(user) });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to lookup user.' });
  }
});

app.put('/users/:userId/profile', requireAuth, async (req, res) => {
  try {
    const userId = sanitizeUserId(req.params?.userId);
    if (!ensureAuthUserMatches(req, res, userId)) {
      return;
    }

    const username = sanitizeUsername(req.body?.username);
    const avatarUrl = String(req.body?.avatarUrl || '').trim();
    if (!username) {
      return res.status(400).json({ message: 'username is required.' });
    }

    const userDocRef = usersRef.doc(userId);
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const existingUser = { id: userDoc.id, ...userDoc.data() };
    const existingByUsername = await getUserByUsername(username);
    if (existingByUsername && existingByUsername.id !== userId) {
      return res.status(409).json({ message: 'This username is already taken.' });
    }

    const updatedAt = new Date().toISOString();
    await userDocRef.set(
      {
        username,
        avatarUrl,
        updatedAt,
      },
      { merge: true }
    );

    return res.json({
      message: 'Profile updated successfully.',
      user: toPublicUser({
        ...existingUser,
        username,
        avatarUrl,
      }),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to update profile.' });
  }
});

app.put('/users/:userId/password', requireAuth, async (req, res) => {
  try {
    const userId = sanitizeUserId(req.params?.userId);
    if (!ensureAuthUserMatches(req, res, userId)) {
      return;
    }

    const newPassword = String(req.body?.newPassword || '');
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }

    const verificationMethod = String(req.body?.verificationMethod || '').trim().toLowerCase();
    if (!verificationMethod) {
      return res.status(400).json({ message: 'verificationMethod is required.' });
    }

    const userDocRef = usersRef.doc(userId);
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const user = { id: userDoc.id, ...userDoc.data() };
    const userEmail = sanitizeEmail(user.email);

    if (verificationMethod === 'otp') {
      const otp = String(req.body?.otp || '').trim();
      if (!otp) {
        return res.status(400).json({ message: 'otp is required for OTP verification.' });
      }
      const otpStatus = await validateOtp(userEmail, otp);
      if (!otpStatus.ok) {
        return res.status(400).json({ message: otpStatus.message });
      }
    } else if (verificationMethod === 'google') {
      const identity = await verifyGoogleIdentityFromTokens({
        idToken: req.body?.idToken,
        accessToken: req.body?.accessToken,
      });
      if (!identity?.email || !identity.emailVerified) {
        return res.status(401).json({ message: 'Google account email is not verified.' });
      }
      if (identity.email !== userEmail) {
        return res
          .status(403)
          .json({ message: 'Google account does not match this user email.' });
      }
    } else {
      return res.status(400).json({ message: 'Unsupported verification method.' });
    }

    await userDocRef.set(
      {
        passwordHash: await bcrypt.hash(newPassword, 10),
        password: '',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to change password.' });
  }
});

app.get('/admin/me', requireAuth, requireRootAdmin, async (req, res) => {
  return res.json({
    isRootAdmin: true,
    user: {
      id: sanitizeUserId(req.rootAdmin?.id),
      email: sanitizeEmail(req.rootAdmin?.email),
      username: sanitizeUsername(req.rootAdmin?.username),
    },
  });
});

app.get('/admin/stats/accounts', requireAuth, requireRootAdmin, async (req, res) => {
  try {
    const range = normalizeAdminActiveRange(req.query?.range);
    const usersSnapshot = await usersRef.get();
    const users = usersSnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
    const totalAccounts = users.length;
    const activeAccounts = users.filter((user) => isUserActiveInRange(user, range)).length;
    return res.json({
      range,
      totalAccounts,
      activeAccounts,
      timezone: ADMIN_STATS_TIMEZONE,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load admin account stats.' });
  }
});

app.get('/admin/complaints', requireAuth, requireRootAdmin, async (req, res) => {
  try {
    const statusRaw = String(req.query?.status || 'all')
      .trim()
      .toLowerCase();
    const status = statusRaw === 'all' ? 'all' : normalizeAdminComplaintStatus(statusRaw);
    const limitRaw = Number.parseInt(String(req.query?.limit || '200'), 10);
    const limit = Number.isInteger(limitRaw) ? Math.min(500, Math.max(1, limitRaw)) : 200;
    const snapshot = await adminComplaintRef.orderBy('createdAt', 'desc').limit(limit).get();
    let complaints = snapshot.docs.map((doc) => toAdminComplaintResponse(doc.id, doc.data() || {}));
    if (status !== 'all') {
      complaints = complaints.filter((complaint) => complaint.status === status);
    }
    return res.json({
      complaints,
      status,
      total: complaints.length,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load complaints.' });
  }
});

app.patch('/admin/complaints/:complaintId', requireAuth, requireRootAdmin, async (req, res) => {
  try {
    const complaintId = String(req.params?.complaintId || '').trim();
    if (!complaintId) {
      return res.status(400).json({ message: 'complaintId is required.' });
    }
    const complaintDocRef = adminComplaintRef.doc(complaintId);
    const complaintDoc = await complaintDocRef.get();
    if (!complaintDoc.exists) {
      return res.status(404).json({ message: 'Complaint not found.' });
    }
    const nextStatus = normalizeAdminComplaintStatus(req.body?.status);
    const adminNote = String(req.body?.adminNote || '')
      .trim()
      .slice(0, 2000);
    const nowIso = new Date().toISOString();
    await complaintDocRef.set(
      {
        status: nextStatus,
        adminNote,
        updatedAt: nowIso,
        resolvedAt: nextStatus === 'resolved' ? nowIso : null,
        resolvedById: sanitizeUserId(req.rootAdmin?.id),
      },
      { merge: true }
    );
    const updatedDoc = await complaintDocRef.get();
    return res.json({
      message: 'Complaint updated.',
      complaint: toAdminComplaintResponse(updatedDoc.id, updatedDoc.data() || {}),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to update complaint.' });
  }
});

app.post('/support/complaints', requireAuth, async (req, res) => {
  try {
    const reporterId = sanitizeUserId(req.authUser?.sub);
    if (!reporterId) {
      return res.status(401).json({ message: 'Unauthorized request.' });
    }
    const userDoc = await usersRef.doc(reporterId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const userData = userDoc.data() || {};
    const subject = String(req.body?.subject || '')
      .trim()
      .slice(0, 140);
    const message = String(req.body?.message || '')
      .trim()
      .slice(0, 4000);
    if (message.length < 5) {
      return res.status(400).json({ message: 'Complaint message must be at least 5 characters.' });
    }
    const nowIso = new Date().toISOString();
    const complaintId = crypto.randomUUID();
    await adminComplaintRef.doc(complaintId).set(
      {
        subject,
        message,
        status: 'open',
        createdAt: nowIso,
        updatedAt: nowIso,
        reporterId,
        reporterUsername: sanitizeUsername(userData.username || req.authUser?.username),
        reporterEmail: sanitizeEmail(userData.email || req.authUser?.email),
        adminNote: '',
        resolvedAt: null,
        resolvedById: '',
      },
      { merge: true }
    );
    return res.status(201).json({
      message: 'Complaint submitted successfully.',
      complaint: toAdminComplaintResponse(complaintId, {
        subject,
        message,
        status: 'open',
        createdAt: nowIso,
        updatedAt: nowIso,
        reporterId,
        reporterUsername: sanitizeUsername(userData.username || req.authUser?.username),
        reporterEmail: sanitizeEmail(userData.email || req.authUser?.email),
        adminNote: '',
        resolvedAt: null,
        resolvedById: '',
      }),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to submit complaint.' });
  }
});

app.get('/support/role', requireAuth, async (req, res) => {
  try {
    const authUserId = sanitizeUserId(req.authUser?.sub);
    if (!authUserId) {
      return res.status(401).json({ message: 'Unauthorized request.' });
    }
    const userRecord = await getAuthUserRecord(authUserId);
    if (!userRecord) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const role = toSupportRoleResponse(userRecord);
    return res.json({
      ...role,
      user: toPublicUser(userRecord),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load support role.' });
  }
});

app.get('/admin/support-admins', requireAuth, requireRootAdmin, async (_req, res) => {
  try {
    const snapshot = await usersRef.where('supportAdmin', '==', true).get();
    const adminUsers = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
    const rootUser = await getUserByEmail(ROOT_ADMIN_EMAIL);
    const mergedAdmins = new Map();
    adminUsers.forEach((user) => {
      mergedAdmins.set(user.id, {
        id: user.id,
        username: sanitizeUsername(user.username),
        email: sanitizeEmail(user.email),
        isRootAdmin: false,
      });
    });
    if (rootUser?.id) {
      mergedAdmins.set(rootUser.id, {
        id: rootUser.id,
        username: sanitizeUsername(rootUser.username),
        email: sanitizeEmail(rootUser.email),
        isRootAdmin: true,
      });
    }
    const admins = Array.from(mergedAdmins.values()).sort((left, right) => {
      if (left.isRootAdmin && !right.isRootAdmin) return -1;
      if (!left.isRootAdmin && right.isRootAdmin) return 1;
      return String(left.username || '').localeCompare(String(right.username || ''), undefined, {
        sensitivity: 'base',
      });
    });
    return res.json({ admins });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load support admin list.' });
  }
});

app.post('/admin/support-admins', requireAuth, requireRootAdmin, async (req, res) => {
  try {
    const identifierRaw = String(req.body?.identifier || '').trim();
    if (!identifierRaw) {
      return res.status(400).json({ message: 'identifier is required.' });
    }
    const identifier = identifierRaw.toLowerCase();
    const targetUser = identifier.includes('@')
      ? await getUserByEmail(identifier)
      : await getUserByUsername(identifier);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const targetEmail = sanitizeEmail(targetUser.email);
    if (targetEmail === ROOT_ADMIN_EMAIL) {
      return res.status(400).json({ message: 'Root account is already an admin.' });
    }
    await usersRef.doc(targetUser.id).set(
      {
        supportAdmin: true,
        supportAdminUpdatedAt: new Date().toISOString(),
        supportAdminUpdatedBy: sanitizeUserId(req.rootAdmin?.id),
      },
      { merge: true }
    );
    return res.json({
      message: 'Support admin added.',
      user: toPublicUser(targetUser),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to add support admin.' });
  }
});

app.delete('/admin/support-admins/:userId', requireAuth, requireRootAdmin, async (req, res) => {
  try {
    const targetUserId = sanitizeUserId(req.params?.userId);
    if (!targetUserId) {
      return res.status(400).json({ message: 'userId is required.' });
    }
    const targetUserRecord = await getAuthUserRecord(targetUserId);
    if (!targetUserRecord) {
      return res.status(404).json({ message: 'User not found.' });
    }
    if (sanitizeEmail(targetUserRecord.email) === ROOT_ADMIN_EMAIL) {
      return res.status(400).json({ message: 'Root account cannot be removed from admin.' });
    }
    await usersRef.doc(targetUserId).set(
      {
        supportAdmin: false,
        supportAdminUpdatedAt: new Date().toISOString(),
        supportAdminUpdatedBy: sanitizeUserId(req.rootAdmin?.id),
      },
      { merge: true }
    );
    return res.json({ message: 'Support admin removed.' });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to remove support admin.' });
  }
});

app.post('/support/tickets', requireAuth, async (req, res) => {
  try {
    const authUserId = sanitizeUserId(req.authUser?.sub);
    if (!authUserId) {
      return res.status(401).json({ message: 'Unauthorized request.' });
    }
    const userRecord = await getAuthUserRecord(authUserId);
    if (!userRecord) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const role = toSupportRoleResponse(userRecord);
    if (role.isSupportAdmin) {
      return res.status(403).json({ message: 'Support admins cannot open user tickets.' });
    }

    const subject = String(req.body?.subject || '')
      .trim()
      .slice(0, 160);
    const text = String(req.body?.message || req.body?.text || '')
      .trim()
      .slice(0, SUPPORT_TICKET_MAX_MESSAGE_LENGTH);
    const rawAttachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];
    if (rawAttachments.length > SUPPORT_TICKET_MAX_ATTACHMENTS) {
      return res.status(400).json({ message: `Attachments limit is ${SUPPORT_TICKET_MAX_ATTACHMENTS}.` });
    }
    const attachments = normalizeTicketAttachmentList(rawAttachments);
    if (rawAttachments.length !== attachments.length) {
      return res.status(400).json({
        message: `Only image/video attachments are allowed. Max ${SUPPORT_TICKET_MAX_ATTACHMENT_BYTES} bytes each.`,
      });
    }
    if (!text && attachments.length === 0) {
      return res.status(400).json({ message: 'Ticket message is required.' });
    }

    const ticketId = crypto.randomUUID();
    const messageId = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const preview = buildSupportTicketMessagePreview(text, attachments);
    await supportTicketRef.doc(ticketId).set({
      ownerUserId: authUserId,
      ownerUsername: sanitizeUsername(userRecord.username),
      ownerEmail: sanitizeEmail(userRecord.email),
      subject,
      status: SUPPORT_TICKET_STATUS.OPEN,
      createdAt: nowIso,
      updatedAt: nowIso,
      closedAt: null,
      closedById: '',
      closedByUsername: '',
      lastMessageAt: nowIso,
      lastMessagePreview: preview,
    });
    await supportTicketMessagesRef(ticketId).doc(messageId).set({
      ticketId,
      senderUserId: authUserId,
      senderUsername: sanitizeUsername(userRecord.username),
      senderRole: 'user',
      text,
      attachments,
      createdAt: nowIso,
    });

    const ticket = normalizeSupportTicket(ticketId, {
      ownerUserId: authUserId,
      ownerUsername: sanitizeUsername(userRecord.username),
      ownerEmail: sanitizeEmail(userRecord.email),
      subject,
      status: SUPPORT_TICKET_STATUS.OPEN,
      createdAt: nowIso,
      updatedAt: nowIso,
      lastMessageAt: nowIso,
      lastMessagePreview: preview,
    });
    const firstMessage = normalizeSupportTicketMessage(messageId, {
      ticketId,
      senderUserId: authUserId,
      senderUsername: sanitizeUsername(userRecord.username),
      senderRole: 'user',
      text,
      attachments,
      createdAt: nowIso,
    });
    return res.status(201).json({
      message: 'Ticket opened successfully.',
      ticket,
      firstMessage,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to open ticket.' });
  }
});

app.get('/support/tickets/my', requireAuth, async (req, res) => {
  try {
    const authUserId = sanitizeUserId(req.authUser?.sub);
    if (!authUserId) {
      return res.status(401).json({ message: 'Unauthorized request.' });
    }
    const snapshot = await supportTicketRef.where('ownerUserId', '==', authUserId).limit(200).get();
    const tickets = snapshot.docs
      .map((doc) => normalizeSupportTicket(doc.id, doc.data() || {}))
      .sort((left, right) => toEpochMs(right.updatedAt) - toEpochMs(left.updatedAt));
    return res.json({ tickets });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load user tickets.' });
  }
});

app.get('/support/tickets', requireAuth, requireSupportAdmin, async (_req, res) => {
  try {
    const snapshot = await supportTicketRef.limit(400).get();
    const tickets = snapshot.docs
      .map((doc) => normalizeSupportTicket(doc.id, doc.data() || {}))
      .sort((left, right) => toEpochMs(right.updatedAt) - toEpochMs(left.updatedAt));
    return res.json({ tickets });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load tickets.' });
  }
});

app.get('/support/tickets/:ticketId', requireAuth, async (req, res) => {
  try {
    const authUserId = sanitizeUserId(req.authUser?.sub);
    if (!authUserId) {
      return res.status(401).json({ message: 'Unauthorized request.' });
    }
    const userRecord = await getAuthUserRecord(authUserId);
    if (!userRecord) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const role = toSupportRoleResponse(userRecord);
    const ticketWithRef = await loadSupportTicketById(req.params?.ticketId);
    if (!ticketWithRef) {
      return res.status(404).json({ message: 'Ticket not found.' });
    }
    if (!ensureSupportTicketAccess(ticketWithRef.ticket, { id: authUserId }, role)) {
      return res.status(403).json({ message: 'Forbidden ticket access.' });
    }
    const messagesSnapshot = await supportTicketMessagesRef(ticketWithRef.ticket.id)
      .orderBy('createdAt', 'asc')
      .limit(300)
      .get();
    const messages = messagesSnapshot.docs.map((doc) =>
      normalizeSupportTicketMessage(doc.id, doc.data() || {})
    );
    return res.json({
      ticket: ticketWithRef.ticket,
      messages,
      role,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load ticket detail.' });
  }
});

app.post('/support/tickets/:ticketId/messages', requireAuth, async (req, res) => {
  try {
    const authUserId = sanitizeUserId(req.authUser?.sub);
    if (!authUserId) {
      return res.status(401).json({ message: 'Unauthorized request.' });
    }
    const userRecord = await getAuthUserRecord(authUserId);
    if (!userRecord) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const role = toSupportRoleResponse(userRecord);
    const ticketWithRef = await loadSupportTicketById(req.params?.ticketId);
    if (!ticketWithRef) {
      return res.status(404).json({ message: 'Ticket not found.' });
    }
    if (!ensureSupportTicketAccess(ticketWithRef.ticket, { id: authUserId }, role)) {
      return res.status(403).json({ message: 'Forbidden ticket access.' });
    }
    if (!role.isSupportAdmin && ticketWithRef.ticket.status === SUPPORT_TICKET_STATUS.CLOSED) {
      return res.status(400).json({ message: 'Ticket is already closed.' });
    }

    const text = String(req.body?.message || req.body?.text || '')
      .trim()
      .slice(0, SUPPORT_TICKET_MAX_MESSAGE_LENGTH);
    const rawAttachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];
    if (rawAttachments.length > SUPPORT_TICKET_MAX_ATTACHMENTS) {
      return res.status(400).json({ message: `Attachments limit is ${SUPPORT_TICKET_MAX_ATTACHMENTS}.` });
    }
    const attachments = normalizeTicketAttachmentList(rawAttachments);
    if (rawAttachments.length !== attachments.length) {
      return res.status(400).json({
        message: `Only image/video attachments are allowed. Max ${SUPPORT_TICKET_MAX_ATTACHMENT_BYTES} bytes each.`,
      });
    }
    if (!text && attachments.length === 0) {
      return res.status(400).json({ message: 'Message content is required.' });
    }

    const nowIso = new Date().toISOString();
    const messageId = crypto.randomUUID();
    const senderRole = role.isSupportAdmin ? 'admin' : 'user';
    const senderUsername = sanitizeUsername(userRecord.username);
    await supportTicketMessagesRef(ticketWithRef.ticket.id).doc(messageId).set({
      ticketId: ticketWithRef.ticket.id,
      senderUserId: authUserId,
      senderUsername,
      senderRole,
      text,
      attachments,
      createdAt: nowIso,
    });

    const nextStatus =
      role.isSupportAdmin && ticketWithRef.ticket.status === SUPPORT_TICKET_STATUS.OPEN
        ? SUPPORT_TICKET_STATUS.IN_PROGRESS
        : ticketWithRef.ticket.status;
    await ticketWithRef.ref.set(
      {
        updatedAt: nowIso,
        status: nextStatus,
        lastMessageAt: nowIso,
        lastMessagePreview: buildSupportTicketMessagePreview(text, attachments),
      },
      { merge: true }
    );

    return res.status(201).json({
      message: 'Message sent.',
      messageItem: normalizeSupportTicketMessage(messageId, {
        ticketId: ticketWithRef.ticket.id,
        senderUserId: authUserId,
        senderUsername,
        senderRole,
        text,
        attachments,
        createdAt: nowIso,
      }),
      ticketStatus: nextStatus,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to send message.' });
  }
});

app.patch('/support/tickets/:ticketId/status', requireAuth, requireSupportAdmin, async (req, res) => {
  try {
    const ticketWithRef = await loadSupportTicketById(req.params?.ticketId);
    if (!ticketWithRef) {
      return res.status(404).json({ message: 'Ticket not found.' });
    }
    const nextStatus = normalizeSupportTicketStatus(req.body?.status);
    const nowIso = new Date().toISOString();
    const patch = {
      status: nextStatus,
      updatedAt: nowIso,
    };
    if (nextStatus === SUPPORT_TICKET_STATUS.CLOSED) {
      patch.closedAt = nowIso;
      patch.closedById = sanitizeUserId(req.supportAdmin?.id);
      patch.closedByUsername = sanitizeUsername(req.supportAdmin?.username);
    } else {
      patch.closedAt = null;
      patch.closedById = '';
      patch.closedByUsername = '';
    }
    await ticketWithRef.ref.set(patch, { merge: true });
    const updatedTicket = normalizeSupportTicket(ticketWithRef.ticket.id, {
      ...ticketWithRef.ticket,
      ...patch,
    });
    return res.json({
      message: 'Ticket status updated.',
      ticket: updatedTicket,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to update ticket status.' });
  }
});

app.post('/task-comments/notify', requireAuth, async (req, res) => {
  try {
    const authUserId = sanitizeUserId(req.authUser?.sub);
    if (!authUserId) {
      return res.status(401).json({ message: 'Unauthorized request.' });
    }
    const userRecord = await getAuthUserRecord(authUserId);
    if (!userRecord) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const notifyMode = normalizeTaskCommentNotifyMode(req.body?.mode);
    const projectId = String(req.body?.projectId || '').trim();
    const taskId = String(req.body?.taskId || '').trim();
    const taskTitle = String(req.body?.taskTitle || '').trim();
    const commentText = String(req.body?.commentText || '')
      .trim()
      .slice(0, TASK_COMMENT_NOTIFY_MAX_TEXT_LENGTH);
    if (!projectId || !taskId) {
      return res.status(400).json({ message: 'projectId and taskId are required.' });
    }
    if (!commentText) {
      return res.status(400).json({ message: 'commentText is required.' });
    }

    const rawRecipients = normalizeTaskCommentNotifyRecipientList(req.body?.recipients);
    if (rawRecipients.length === 0) {
      return res.status(400).json({ message: 'At least one recipient is required.' });
    }

    const resolvedRecipients = [];
    for (const rawRecipient of rawRecipients) {
      const resolvedRecipient = await resolveTaskCommentNotifyRecipientRecord(rawRecipient);
      if (!resolvedRecipient) continue;
      if (!resolvedRecipient.email) continue;
      if (
        resolvedRecipient.id &&
        resolvedRecipient.id === authUserId
      ) {
        continue;
      }
      if (
        resolvedRecipient.email &&
        sanitizeEmail(resolvedRecipient.email) === sanitizeEmail(userRecord.email)
      ) {
        continue;
      }
      resolvedRecipients.push(resolvedRecipient);
    }

    const uniqueRecipientMap = new Map();
    resolvedRecipients.forEach((recipient) => {
      const email = sanitizeEmail(recipient.email);
      if (!email || uniqueRecipientMap.has(email)) return;
      uniqueRecipientMap.set(email, recipient);
    });
    let finalRecipients = Array.from(uniqueRecipientMap.values());
    if (notifyMode === 'reply' && finalRecipients.length > 1) {
      finalRecipients = [finalRecipients[0]];
    }
    if (finalRecipients.length === 0) {
      return res.json({
        message: 'No eligible recipients.',
        mode: notifyMode,
        sentCount: 0,
        failedCount: 0,
      });
    }

    const actorUsername = sanitizeUsername(userRecord.username || req.authUser?.username);
    const failedRecipients = [];
    let sentCount = 0;
    for (const recipient of finalRecipients) {
      try {
        await sendTaskCommentNotificationEmail({
          toEmail: recipient.email,
          toUsername: recipient.username,
          actorUsername,
          taskTitle,
          commentText,
          mode: notifyMode,
        });
        sentCount += 1;
      } catch (error) {
        failedRecipients.push({
          email: recipient.email,
          reason: error?.message || 'send_failed',
        });
      }
    }

    return res.json({
      message:
        sentCount > 0
          ? 'Task comment email notifications sent.'
          : 'Task comment email notification failed.',
      mode: notifyMode,
      sentCount,
      failedCount: failedRecipients.length,
      failedRecipients,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to send task comment notifications.' });
  }
});

app.get('/data/account/:userId', requireAuth, async (req, res) => {
  try {
    const userId = sanitizeUserId(req.params?.userId);
    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }

    const userDoc = await usersRef.doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const record = await readAccountPayloadRecordFromStore(userId);

    return res.json({
      payload: record.payload || {},
      version: toSafeInteger(record.version, 0),
      updatedAt: record.updatedAt || null,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch account data.' });
  }
});

app.put('/data/account/:userId', requireAuth, async (req, res) => {
  try {
    const userId = sanitizeUserId(req.params?.userId);
    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }

    const userDoc = await usersRef.doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const incomingPayload = req.body?.payload;
    if (!incomingPayload || typeof incomingPayload !== 'object' || Array.isArray(incomingPayload)) {
      return res.status(400).json({ message: 'payload must be an object.' });
    }

    const baseVersionRaw = req.body?.baseVersion;
    const hasBaseVersion =
      baseVersionRaw !== undefined && baseVersionRaw !== null && String(baseVersionRaw).trim() !== '';
    const baseVersion = hasBaseVersion ? toSafeInteger(baseVersionRaw, -1) : null;
    const writeResult = await writeAccountPayloadToStore(userId, incomingPayload, {
      baseVersion,
    });

    return res.json({
      message: 'Account data saved.',
      version: toSafeInteger(writeResult?.version, 0),
      updatedAt: writeResult?.updatedAt || null,
    });
  } catch (error) {
    if (error?.code === 'ACCOUNT_VERSION_CONFLICT') {
      return res.status(409).json({
        message: 'Account data is out of date. Please retry with latest version.',
        payload: error.currentPayload || {},
        version: toSafeInteger(error.currentVersion, 0),
        updatedAt: error.currentUpdatedAt || null,
      });
    }
    return res.status(500).json({ message: error.message || 'Failed to save account data.' });
  }
});

app.get('/data/project-invites', requireAuth, async (_req, res) => {
  try {
    const doc = await invitesDocRef.get();
    const rawInvites = doc.exists ? doc.data()?.invites : [];
    const invites = Array.isArray(rawInvites)
      ? rawInvites.filter((invite) => invite && typeof invite === 'object')
      : [];
    return res.json({ invites });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch project invites.' });
  }
});

app.put('/data/project-invites', requireAuth, async (req, res) => {
  try {
    const rawInvites = req.body?.invites;
    if (!Array.isArray(rawInvites)) {
      return res.status(400).json({ message: 'invites must be an array.' });
    }

    const invites = rawInvites.filter((invite) => invite && typeof invite === 'object');
    await invitesDocRef.set(
      {
        invites,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return res.json({ message: 'Project invites saved.', count: invites.length });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to save project invites.' });
  }
});

app.post('/line/webhook', async (req, res) => {
  try {
    if (!LINE_CHANNEL_SECRET) {
      return res.status(503).json({
        message: 'LINE_CHANNEL_SECRET is not configured on server.',
      });
    }
    if (!isValidLineWebhookSignature(req)) {
      return res.status(401).json({ message: 'Invalid LINE webhook signature.' });
    }

    const events = Array.isArray(req.body?.events) ? req.body.events : [];
    const destination = String(req.body?.destination || '').trim();
    const nowIso = new Date().toISOString();

    const writes = [];
    for (const event of events) {
      const source = event?.source && typeof event.source === 'object' ? event.source : {};
      const sourceType = String(source.type || '').trim();
      const groupId = String(source.groupId || '').trim();
      const userId = String(source.userId || '').trim();
      const eventType = String(event?.type || '').trim();
      const messageType = String(event?.message?.type || '').trim();
      const messageText =
        messageType === 'text' ? String(event?.message?.text || '').trim().slice(0, 300) : '';
      const eventTimestamp = Number(event?.timestamp || Date.now());

      if (groupId) {
        const logId = crypto
          .createHash('sha256')
          .update(`${groupId}|${eventTimestamp}|${eventType}|${messageText}`)
          .digest('hex');
        writes.push(
          lineWebhookLogRef.doc(logId).set(
            {
              destination,
              sourceType,
              eventType,
              messageType,
              messageText,
              groupId,
              userId,
              eventTimestamp,
              receivedAt: nowIso,
            },
            { merge: true }
          )
        );
      }

      const shouldReplyGroupId =
        groupId &&
        eventType === 'message' &&
        messageType === 'text' &&
        isLineGroupIdCommand(messageText);
      if (shouldReplyGroupId && event?.replyToken) {
        const helperText = [
          'PM Calendar LINE Group ID',
          groupId,
          '',
          'Paste this value into Manage Project > Announcements > LINE Reminder.',
        ].join('\n');
        writes.push(
          sendLineReplyMessage({
            replyToken: String(event.replyToken || '').trim(),
            message: helperText,
          }).catch((error) => {
            console.warn('Failed to send LINE webhook helper reply:', error.message);
            return sendLinePushMessage({
              channelAccessToken: LINE_WEBHOOK_CHANNEL_ACCESS_TOKEN,
              to: groupId,
              message: helperText,
              notificationDisabled: true,
            }).catch((pushError) => {
              console.warn('Failed to send LINE webhook helper fallback push:', pushError.message);
            });
          })
        );
      }
    }

    if (writes.length > 0) {
      await Promise.all(writes);
    }

    return res.json({
      ok: true,
      received: events.length,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to process LINE webhook.' });
  }
});

app.get('/line/reminder/config', requireAuth, async (req, res) => {
  try {
    const userId = sanitizeUserId(req.query?.userId);
    const projectId = String(req.query?.projectId || '').trim();
    if (!userId || !projectId) {
      return res.status(400).json({ message: 'userId and projectId are required.' });
    }
    if (!ensureAuthUserMatches(req, res, userId)) {
      return;
    }

    const ownership = await loadOwnedProjectById({
      userId,
      projectId,
      authUsername: req.authUser?.username,
    });
    if (!ownership.foundProject) {
      return res.status(404).json({ message: 'Project not found.' });
    }
    if (!ownership.isOwner) {
      return res
        .status(403)
        .json({ message: 'Only project host can configure LINE reminders for this project.' });
    }

    const docRef = lineReminderConfigRef.doc(lineReminderDocIdFor(userId, projectId));
    const snapshot = await docRef.get();
    const config = snapshot.exists
      ? toLineReminderPublicResponse(snapshot.data() || {})
      : toLineReminderPublicResponse({
          enabled: false,
          groupId: '',
          timezone: DEFAULT_LINE_REMINDER_TIMEZONE,
          reminderHour: DEFAULT_LINE_REMINDER_HOUR,
          reminderDaysBefore: DEFAULT_LINE_REMINDER_DAYS_BEFORE,
        });

    return res.json({ config });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load LINE reminder config.' });
  }
});

app.put('/line/reminder/config', requireAuth, async (req, res) => {
  try {
    const userId = sanitizeUserId(req.body?.userId);
    const projectId = String(req.body?.projectId || '').trim();
    if (!userId || !projectId) {
      return res.status(400).json({ message: 'userId and projectId are required.' });
    }
    if (!ensureAuthUserMatches(req, res, userId)) {
      return;
    }

    const ownership = await loadOwnedProjectById({
      userId,
      projectId,
      authUsername: req.authUser?.username,
    });
    if (!ownership.foundProject) {
      return res.status(404).json({ message: 'Project not found.' });
    }
    if (!ownership.isOwner) {
      return res
        .status(403)
        .json({ message: 'Only project host can configure LINE reminders for this project.' });
    }

    const docRef = lineReminderConfigRef.doc(lineReminderDocIdFor(userId, projectId));
    const existingDoc = await docRef.get();
    const existingConfig = normalizeLineReminderConfigRecord(existingDoc.exists ? existingDoc.data() : {}, {
      includeSecrets: true,
    });

    const nextEnabled = req.body?.enabled === true;
    const nextGroupId = String(req.body?.groupId || '').trim();
    const nextTimezone = normalizeLineReminderTimezone(req.body?.timezone);
    const nextReminderHour = normalizeLineReminderHour(req.body?.reminderHour);
    const nextReminderDaysBefore = normalizeLineReminderDaysBefore(req.body?.reminderDaysBefore);

    if (nextEnabled && !LINE_REMINDER_CHANNEL_ACCESS_TOKEN) {
      return res.status(503).json({
        message: 'LINE reminder channel access token is not configured on server.',
      });
    }
    if (nextEnabled && !nextGroupId) {
      return res.status(400).json({
        message: 'LINE group ID is required before enabling reminders.',
      });
    }

    const nowIso = new Date().toISOString();
    const nextConfig = {
      userId,
      projectId,
      projectName: String(ownership.project?.name || '').trim(),
      enabled: nextEnabled,
      groupId: nextGroupId,
      timezone: nextTimezone,
      reminderHour: nextReminderHour,
      reminderDaysBefore: nextReminderDaysBefore,
      channelAccessToken: '',
      createdAt: String(existingConfig.createdAt || '').trim() || nowIso,
      updatedAt: nowIso,
      lastTestedAt: String(existingConfig.lastTestedAt || '').trim() || null,
      lastOpenTaskDigestAt: String(existingConfig.lastOpenTaskDigestAt || '').trim() || null,
    };

    await docRef.set(nextConfig, { merge: true });

    return res.json({
      message: 'LINE reminder settings saved.',
      config: toLineReminderPublicResponse(nextConfig),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to save LINE reminder config.' });
  }
});

app.post('/line/reminder/test-push', requireAuth, async (req, res) => {
  try {
    const userId = sanitizeUserId(req.body?.userId);
    const projectId = String(req.body?.projectId || '').trim();
    if (!userId || !projectId) {
      return res.status(400).json({ message: 'userId and projectId are required.' });
    }
    if (!ensureAuthUserMatches(req, res, userId)) {
      return;
    }

    const ownership = await loadOwnedProjectById({
      userId,
      projectId,
      authUsername: req.authUser?.username,
    });
    if (!ownership.foundProject) {
      return res.status(404).json({ message: 'Project not found.' });
    }
    if (!ownership.isOwner) {
      return res
        .status(403)
        .json({ message: 'Only project host can send LINE announcement messages for this project.' });
    }

    const docRef = lineReminderConfigRef.doc(lineReminderDocIdFor(userId, projectId));
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return res.status(404).json({ message: 'LINE reminder settings not found for this project.' });
    }
    const config = normalizeLineReminderConfigRecord(snapshot.data() || {}, { includeSecrets: true });
    if (!config.channelAccessToken) {
      return res.status(400).json({ message: 'LINE channel access token is not configured.' });
    }
    if (!config.groupId) {
      return res.status(400).json({ message: 'LINE group ID is not configured.' });
    }

    const userMessage = String(req.body?.message || '').trim();
    if (!userMessage) {
      return res.status(400).json({ message: 'message is required.' });
    }

    const nowIso = new Date().toISOString();
    const announcementMessage = buildLineAnnouncementMessage({
      projectName: ownership.project?.name || projectId,
      message: userMessage,
    });

    await sendLinePushMessage({
      channelAccessToken: config.channelAccessToken,
      to: config.groupId,
      messages: [announcementMessage],
    });

    await docRef.set(
      {
        lastTestedAt: nowIso,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    return res.json({
      ok: true,
      message: 'LINE announcement message sent.',
      sentAt: nowIso,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to send LINE announcement message.' });
  }
});

const sendLineOpenTaskDigestForProject = async ({ userId, projectId, authUsername = '' }) => {
  const normalizedUserId = sanitizeUserId(userId);
  const normalizedProjectId = String(projectId || '').trim();
  if (!normalizedUserId || !normalizedProjectId) {
    throw new Error('userId and projectId are required.');
  }

  const ownership = await loadOwnedProjectById({
    userId: normalizedUserId,
    projectId: normalizedProjectId,
    authUsername,
  });
  if (!ownership.foundProject) {
    const notFoundError = new Error('Project not found.');
    notFoundError.status = 404;
    throw notFoundError;
  }
  if (!ownership.isOwner) {
    const forbiddenError = new Error('Only project host can notify open tasks for this project.');
    forbiddenError.status = 403;
    throw forbiddenError;
  }

  const docRef = lineReminderConfigRef.doc(lineReminderDocIdFor(normalizedUserId, normalizedProjectId));
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    const missingConfigError = new Error('LINE reminder settings not found for this project.');
    missingConfigError.status = 404;
    throw missingConfigError;
  }
  const config = normalizeLineReminderConfigRecord(snapshot.data() || {}, { includeSecrets: true });
  if (!config.channelAccessToken) {
    const missingTokenError = new Error('LINE channel access token is not configured.');
    missingTokenError.status = 400;
    throw missingTokenError;
  }
  if (!config.groupId) {
    const missingGroupError = new Error('LINE group ID is not configured.');
    missingGroupError.status = 400;
    throw missingGroupError;
  }

  const ownerEvents = Array.isArray(ownership.payload?.events) ? ownership.payload.events : [];
  const allOpenProjectTasks = ownerEvents.filter((event) => {
    if (!isTaskRecord(event)) return false;
    if (String(event?.projectId || '').trim() !== normalizedProjectId) return false;
    return !isCompletedTaskRecord(event);
  });
  const openTasks = selectLineReminderTasksForNotification(allOpenProjectTasks, allOpenProjectTasks);

  if (openTasks.length === 0) {
    return {
      ok: true,
      message: 'No open tasks found for this project.',
      openTaskCount: 0,
      sentAt: null,
    };
  }

  const teamMembers = Array.isArray(ownership.project?.teamMembers) ? ownership.project.teamMembers : [];
  const teamMembersById = new Map();
  teamMembers.forEach((member) => {
    const memberId = String(member?.id || '').trim();
    if (!memberId) return;
    const memberName = String(member?.name || member?.username || '').trim() || memberId;
    const memberAvatarUrl = String(member?.avatarUrl || '').trim();
    const memberDepartment = String(member?.department || '').trim();
    teamMembersById.set(memberId, {
      id: memberId,
      name: memberName,
      avatarUrl: memberAvatarUrl,
      department: memberDepartment,
    });
  });

  const nowIso = new Date().toISOString();
  const digestMessage = buildLineOpenTasksDigestMessage({
    projectName: ownership.project?.name || normalizedProjectId,
    tasks: openTasks,
    teamMembersById,
    departmentColorMap: ownership.project?.departmentColors,
    timezone: config.timezone,
  });

  await sendLinePushMessage({
    channelAccessToken: config.channelAccessToken,
    to: config.groupId,
    messages: [digestMessage],
  });

  await docRef.set(
    {
      lastOpenTaskDigestAt: nowIso,
      updatedAt: nowIso,
    },
    { merge: true }
  );

  return {
    ok: true,
    message: 'Open task summary sent.',
    openTaskCount: openTasks.length,
    sentAt: nowIso,
  };
};

app.post('/line/reminder/notify-open-tasks', requireAuth, async (req, res) => {
  try {
    const userId = sanitizeUserId(req.body?.userId);
    const projectId = String(req.body?.projectId || '').trim();
    if (!userId || !projectId) {
      return res.status(400).json({ message: 'userId and projectId are required.' });
    }
    if (!ensureAuthUserMatches(req, res, userId)) {
      return;
    }
    const result = await sendLineOpenTaskDigestForProject({
      userId,
      projectId,
      authUsername: req.authUser?.username,
    });
    return res.json(result);
  } catch (error) {
    if (Number(error?.status || 0) >= 400 && Number(error?.status || 0) < 500) {
      return res.status(Number(error.status)).json({ message: error.message || 'Invalid request.' });
    }
    return res.status(500).json({ message: error.message || 'Failed to notify open tasks.' });
  }
});

app.get('/ai/threads', requireAuth, async (req, res) => {
  try {
    const userId = sanitizeUserId(req.query?.userId);
    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }
    if (!ensureAuthUserMatches(req, res, userId)) {
      return;
    }
    const limit = clampAiCount(req.query?.limit, AI_THREAD_LIST_LIMIT, 1, AI_THREAD_LIST_LIMIT);
    const snapshot = await aiThreadRef.where('userId', '==', userId).get();
    const threads = snapshot.docs
      .map((doc) => toAiThreadPublicResponse(doc.id, doc.data() || {}))
      .sort((left, right) => String(right?.updatedAt || '').localeCompare(String(left?.updatedAt || '')))
      .slice(0, limit);
    return res.json({ threads });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load AI threads.' });
  }
});

app.post('/ai/threads', requireAuth, async (req, res) => {
  try {
    const userId = sanitizeUserId(req.body?.userId);
    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }
    if (!ensureAuthUserMatches(req, res, userId)) {
      return;
    }
    const nowIso = new Date().toISOString();
    const title = sanitizeAiThreadTitle(req.body?.title) || 'New chat';
    const docRef = aiThreadRef.doc(buildAiId());
    await docRef.set({
      id: docRef.id,
      userId,
      title,
      lastMessagePreview: '',
      createdAt: nowIso,
      updatedAt: nowIso,
      pendingAction: null,
    });
    return res.status(201).json({
      thread: toAiThreadPublicResponse(docRef.id, {
        id: docRef.id,
        userId,
        title,
        lastMessagePreview: '',
        createdAt: nowIso,
        updatedAt: nowIso,
        pendingAction: null,
      }),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to create AI thread.' });
  }
});

app.delete('/ai/threads/:threadId', requireAuth, async (req, res) => {
  try {
    const userId = sanitizeUserId(req.body?.userId || req.query?.userId);
    const threadId = String(req.params?.threadId || '').trim();
    if (!userId || !threadId) {
      return res.status(400).json({ message: 'userId and threadId are required.' });
    }
    if (!ensureAuthUserMatches(req, res, userId)) {
      return;
    }
    const threadRecord = await loadAiThreadForUser({ threadId, userId });
    if (!threadRecord) {
      return res.status(404).json({ message: 'AI thread not found.' });
    }
    const deletedMessages = await deleteAiThreadMessages(threadId);
    await threadRecord.ref.delete();
    return res.json({
      ok: true,
      deletedThreadId: threadId,
      deletedMessages,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to delete AI thread.' });
  }
});

app.get('/ai/threads/:threadId/messages', requireAuth, async (req, res) => {
  try {
    const userId = sanitizeUserId(req.query?.userId);
    const threadId = String(req.params?.threadId || '').trim();
    if (!userId || !threadId) {
      return res.status(400).json({ message: 'userId and threadId are required.' });
    }
    if (!ensureAuthUserMatches(req, res, userId)) {
      return;
    }
    const threadRecord = await loadAiThreadForUser({ threadId, userId });
    if (!threadRecord) {
      return res.status(404).json({ message: 'AI thread not found.' });
    }
    const limit = clampAiCount(req.query?.limit, AI_THREAD_MAX_MESSAGES, 10, AI_THREAD_MAX_MESSAGES);
    const snapshot = await aiThreadMessagesRef(threadId).orderBy('createdAt', 'desc').limit(limit).get();
    const messages = snapshot.docs
      .map((doc) => toAiMessagePublicResponse(doc.id, doc.data() || {}))
      .reverse();
    return res.json({
      thread: threadRecord.thread,
      pendingAction: normalizeAiPendingAction(threadRecord.thread.pendingAction),
      messages,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load AI messages.' });
  }
});

app.post('/ai/threads/:threadId/chat', requireAuth, async (req, res) => {
  try {
    const userId = sanitizeUserId(req.body?.userId);
    const threadId = String(req.params?.threadId || '').trim();
    if (!userId || !threadId) {
      return res.status(400).json({ message: 'userId and threadId are required.' });
    }
    if (!ensureAuthUserMatches(req, res, userId)) {
      return;
    }
    if (!OPENAI_API_KEY) {
      return res.status(503).json({ message: 'OPENAI_API_KEY is not configured on server.' });
    }
    const threadRecord = await loadAiThreadForUser({ threadId, userId });
    if (!threadRecord) {
      return res.status(404).json({ message: 'AI thread not found.' });
    }
    const userMessage = sanitizeAiMessageContent(req.body?.message, AI_CHAT_MAX_USER_MESSAGE_LENGTH);
    if (!userMessage) {
      return res.status(400).json({ message: 'message is required.' });
    }

    const nowIso = new Date().toISOString();
    const existingPendingAction = normalizeAiPendingAction(threadRecord.thread.pendingAction);
    if (existingPendingAction) {
      await threadRecord.ref.set(
        {
          pendingAction: null,
          updatedAt: nowIso,
        },
        { merge: true }
      );
    }

    const attachments = normalizeAiInputAttachments(req.body?.attachments);
    await saveAiThreadMessage({
      threadId,
      role: 'user',
      content: userMessage,
      attachments,
    });

    const historySnapshot = await aiThreadMessagesRef(threadId)
      .orderBy('createdAt', 'desc')
      .limit(AI_THREAD_HISTORY_LIMIT * 2)
      .get();
    const historyMessages = historySnapshot.docs
      .map((doc) => toAiMessagePublicResponse(doc.id, doc.data() || {}))
      .reverse();
    const payload = await readAccountPayloadFromStore(userId);
    const projectScope = resolveAiProjectScopeFromRequest({
      payload,
      scopeInput: req.body?.projectScope,
    });
    const scopedPayload = applyAiProjectScopeToPayload({
      payload,
      scope: projectScope,
    });
    const userContextNote = buildAiRequestContextNote({
      payload,
      scope: projectScope,
      attachments,
    });
    const assistantResult = await runAiAssistant({
      payload: scopedPayload,
      threadMessages: historyMessages,
      userMessage,
      userId,
      username: req.authUser?.username,
      userContextNote,
      attachments,
    });
    const pendingAction = normalizeAiPendingAction(assistantResult.pendingAction);
    const assistantMessage = await saveAiThreadMessage({
      threadId,
      role: 'assistant',
      content: assistantResult.assistantText,
      pendingActionId: pendingAction?.id || '',
    });

    const defaultTitle = sanitizeAiThreadTitle(threadRecord.thread.title).toLowerCase() === 'new chat';
    const nextTitle =
      defaultTitle && userMessage
        ? sanitizeAiThreadTitle(userMessage.slice(0, 60)) || threadRecord.thread.title
        : threadRecord.thread.title;
    await threadRecord.ref.set(
      {
        title: nextTitle,
        lastMessagePreview: buildAiThreadMessagePreview(assistantResult.assistantText || userMessage),
        updatedAt: nowIso,
        pendingAction: pendingAction || null,
      },
      { merge: true }
    );
    await trimAiThreadMessages(threadId, AI_THREAD_MAX_MESSAGES);
    const updatedThreadSnapshot = await threadRecord.ref.get();
    const updatedThread = toAiThreadPublicResponse(
      updatedThreadSnapshot.id,
      updatedThreadSnapshot.data() || {}
    );
    return res.json({
      thread: updatedThread,
      pendingAction: normalizeAiPendingAction(updatedThread.pendingAction),
      message: assistantMessage,
    });
  } catch (error) {
    const status = Number(error?.status || 0);
    if (status >= 400 && status < 600) {
      return res.status(status).json({
        message: error.message || (status >= 500 ? 'AI service is unavailable.' : 'Invalid request.'),
        code: String(error?.code || '').trim() || undefined,
      });
    }
    return res.status(500).json({ message: error.message || 'Failed to process AI chat.' });
  }
});

app.post('/ai/threads/:threadId/confirm-action', requireAuth, async (req, res) => {
  try {
    const userId = sanitizeUserId(req.body?.userId);
    const threadId = String(req.params?.threadId || '').trim();
    const actionId = String(req.body?.actionId || '').trim();
    const decision = String(req.body?.decision || '').trim().toLowerCase();
    if (!userId || !threadId || !actionId) {
      return res.status(400).json({ message: 'userId, threadId and actionId are required.' });
    }
    if (!ensureAuthUserMatches(req, res, userId)) {
      return;
    }
    if (decision !== 'confirm' && decision !== 'cancel') {
      return res.status(400).json({ message: 'decision must be confirm or cancel.' });
    }
    const threadRecord = await loadAiThreadForUser({ threadId, userId });
    if (!threadRecord) {
      return res.status(404).json({ message: 'AI thread not found.' });
    }
    const pendingAction = normalizeAiPendingAction(threadRecord.thread.pendingAction);
    if (!pendingAction || pendingAction.id !== actionId) {
      return res.status(404).json({ message: 'Pending action not found or expired.' });
    }

    const nowIso = new Date().toISOString();
    let assistantText = '';
    let actionResult = null;
    if (decision === 'cancel') {
      assistantText = 'ยกเลิกคำสั่งเรียบร้อยแล้ว';
    } else if (pendingAction.type === AI_ACTION_TYPES.CREATE_TASK) {
      actionResult = await executeAiCreateTaskAction({
        userId,
        actionPayload: pendingAction.payload,
      });
      assistantText = `สร้าง Task "${actionResult?.task?.title || ''}" เรียบร้อยแล้ว`;
    } else if (pendingAction.type === AI_ACTION_TYPES.DELETE_EVENT) {
      actionResult = await executeAiDeleteEventAction({
        userId,
        actionPayload: pendingAction.payload,
      });
      assistantText = `ลบรายการ "${actionResult?.removed?.title || ''}" เรียบร้อยแล้ว`;
    } else if (pendingAction.type === AI_ACTION_TYPES.NOTIFY_OPEN_TASKS) {
      actionResult = await sendLineOpenTaskDigestForProject({
        userId,
        projectId: pendingAction.payload?.projectId,
        authUsername: req.authUser?.username,
      });
      assistantText =
        actionResult?.openTaskCount > 0
          ? `ส่ง LINE open task summary แล้ว (${actionResult.openTaskCount} tasks)`
          : 'ยังไม่มี Open task ที่ต้องส่งในตอนนี้';
    } else {
      throw new Error('Unsupported pending action type.');
    }

    await threadRecord.ref.set(
      {
        pendingAction: null,
        updatedAt: nowIso,
        lastMessagePreview: buildAiThreadMessagePreview(assistantText),
      },
      { merge: true }
    );
    const assistantMessage = await saveAiThreadMessage({
      threadId,
      role: 'assistant',
      content: assistantText,
    });
    await trimAiThreadMessages(threadId, AI_THREAD_MAX_MESSAGES);
    const updatedThreadSnapshot = await threadRecord.ref.get();
    const updatedThread = toAiThreadPublicResponse(
      updatedThreadSnapshot.id,
      updatedThreadSnapshot.data() || {}
    );
    return res.json({
      thread: updatedThread,
      pendingAction: null,
      message: assistantMessage,
      actionResult,
    });
  } catch (error) {
    if (Number(error?.status || 0) >= 400 && Number(error?.status || 0) < 500) {
      return res.status(Number(error.status)).json({ message: error.message || 'Invalid request.' });
    }
    return res.status(500).json({ message: error.message || 'Failed to execute pending action.' });
  }
});

app.post('/internal/jobs/line/remind-due-tomorrow', async (req, res) => {
  try {
    if (!LINE_REMINDER_CRON_SECRET) {
      return res.status(503).json({
        message: 'LINE reminder cron secret is not configured on server.',
      });
    }
    const incomingSecret = String(req.get('x-cron-secret') || '').trim();
    if (!incomingSecret || incomingSecret !== LINE_REMINDER_CRON_SECRET) {
      return res.status(401).json({ message: 'Unauthorized cron request.' });
    }

    const enabledConfigs = await lineReminderConfigRef.where('enabled', '==', true).get();
    if (enabledConfigs.empty) {
      return res.json({
        ok: true,
        checkedConfigs: 0,
        sent: 0,
        skippedNoTask: 0,
        skippedTimeWindow: 0,
        skippedAlreadySent: 0,
        failed: 0,
      });
    }

    const now = new Date();
    const stats = {
      checkedConfigs: 0,
      sent: 0,
      skippedNoTask: 0,
      skippedTimeWindow: 0,
      skippedAlreadySent: 0,
      failed: 0,
    };

    for (const doc of enabledConfigs.docs) {
      stats.checkedConfigs += 1;
      const config = normalizeLineReminderConfigRecord(doc.data() || {}, { includeSecrets: true });
      const userId = sanitizeUserId(config.userId);
      const projectId = String(config.projectId || '').trim();
      if (!userId || !projectId || !config.channelAccessToken || !config.groupId) {
        stats.failed += 1;
        continue;
      }

      const timezone = normalizeLineReminderTimezone(config.timezone);
      const currentHour = getHourInTimeZone(now, timezone);
      const reminderHour = normalizeLineReminderHour(config.reminderHour);
      if (currentHour !== reminderHour) {
        stats.skippedTimeWindow += 1;
        continue;
      }

      const todayByTimezone = getIsoDateInTimeZone(now, timezone);
      if (!todayByTimezone) {
        stats.failed += 1;
        continue;
      }
      const selectedReminderDays = normalizeLineReminderDaysBefore(config.reminderDaysBefore);

      const ownership = await loadOwnedProjectById({
        userId,
        projectId,
        authUsername: '',
      });
      if (!ownership.project) {
        stats.failed += 1;
        continue;
      }

      const ownerEvents = Array.isArray(ownership.payload?.events) ? ownership.payload.events : [];
      const allOpenProjectTasks = ownerEvents.filter((event) => {
        if (!isTaskRecord(event)) return false;
        if (String(event?.projectId || '').trim() !== projectId) return false;
        return !isCompletedTaskRecord(event);
      });

      if (allOpenProjectTasks.length === 0) {
        stats.skippedNoTask += 1;
        continue;
      }

      const teamMembers = Array.isArray(ownership.project?.teamMembers) ? ownership.project.teamMembers : [];
      const teamMembersById = new Map();
      teamMembers.forEach((member) => {
        const memberId = String(member?.id || '').trim();
        if (!memberId) return;
        const memberName = String(member?.name || member?.username || '').trim() || memberId;
        const memberAvatarUrl = String(member?.avatarUrl || '').trim();
        const memberDepartment = String(member?.department || '').trim();
        teamMembersById.set(memberId, {
          id: memberId,
          name: memberName,
          avatarUrl: memberAvatarUrl,
          department: memberDepartment,
        });
      });

      for (const daysBefore of selectedReminderDays) {
        const targetDate = shiftIsoDateByDays(todayByTimezone, daysBefore);
        if (!targetDate) {
          stats.failed += 1;
          continue;
        }
        const dueCandidateTasks = allOpenProjectTasks.filter(
          (event) => String(event?.endDate || '').trim() === targetDate
        );
        const dueTasks = selectLineReminderTasksForNotification(
          dueCandidateTasks,
          allOpenProjectTasks
        );
        if (dueTasks.length === 0) {
          stats.skippedNoTask += 1;
          continue;
        }

        const logDocRef = lineReminderLogRef.doc(
          lineReminderLogDocIdFor(userId, projectId, targetDate, daysBefore)
        );
        const shouldSend = await firestore.runTransaction(async (transaction) => {
          const existingLogDoc = await transaction.get(logDocRef);
          const logStatus = String(existingLogDoc.data()?.status || '').trim().toLowerCase();
          if (existingLogDoc.exists && logStatus === 'sent') {
            return false;
          }

          transaction.set(
            logDocRef,
            {
              userId,
              projectId,
              targetDate,
              timezone,
              reminderHour,
              reminderDaysBefore: daysBefore,
              status: 'sending',
              taskCount: dueTasks.length,
              updatedAt: now.toISOString(),
              createdAt:
                String(existingLogDoc.data()?.createdAt || '').trim() || now.toISOString(),
            },
            { merge: true }
          );
          return true;
        });
        if (!shouldSend) {
          stats.skippedAlreadySent += 1;
          continue;
        }

        try {
          const message = buildLineReminderMessage({
            projectName: ownership.project?.name || projectId,
            targetDate,
            daysBefore,
            tasks: dueTasks,
            teamMembersById,
            departmentColorMap: ownership.project?.departmentColors,
            timezone: timezone,
          });
          await sendLinePushMessage({
            channelAccessToken: config.channelAccessToken,
            to: config.groupId,
            messages: [message],
          });

          await logDocRef.set(
            {
              status: 'sent',
              sentAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              reminderDaysBefore: daysBefore,
              taskCount: dueTasks.length,
            },
            { merge: true }
          );
          stats.sent += 1;
        } catch (error) {
          await logDocRef.set(
            {
              status: 'failed',
              reminderDaysBefore: daysBefore,
              errorMessage: String(error.message || '').slice(0, 400),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
          stats.failed += 1;
        }
      }
    }

    return res.json({
      ok: true,
      ...stats,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to execute LINE reminder job.' });
  }
});

app.use((error, _req, res, _next) => {
  res.status(500).json({ message: error.message || 'Internal server error.' });
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  console.log(`Auth server listening on port ${port}`);
});
