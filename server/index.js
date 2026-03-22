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
import {
  renderLineScamFakeNewsPage,
  renderLineScamPoliceStationsPage,
  renderLineScamRiskAssessPage,
  renderLineScamScammerCheckPage,
} from './lineScamLiffPages.js';
import {
  renderLineEscrowBuyerPage,
  renderLineEscrowDealPage,
  renderLineEscrowSellerPage,
} from './lineEscrowLiffPages.js';

dotenv.config();

const app = express();
app.set('trust proxy', true);
app.use(helmet());
app.use(
  express.json({
    limit: String(process.env.REQUEST_BODY_LIMIT || '150mb'),
    verify: (req, _res, buffer) => {
      req.rawBody = buffer;
    },
  })
);

app.get('/favicon.ico', (_req, res) => {
  res.status(204).end();
});

const allowedOrigins = String(process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const normalizeOriginHost = (originInput) => {
  const origin = String(originInput || '').trim();
  if (!origin) return '';
  try {
    return String(new URL(origin).hostname || '').trim().toLowerCase();
  } catch {
    return '';
  }
};

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const wildcardOriginToRegex = (patternInput) => {
  const pattern = String(patternInput || '').trim();
  if (!pattern || !pattern.includes('*')) return null;
  const regexText = `^${pattern.split('*').map(escapeRegex).join('.*')}$`;
  try {
    return new RegExp(regexText, 'i');
  } catch {
    return null;
  }
};

const isTrustedLineOrigin = (originInput) => {
  const host = normalizeOriginHost(originInput);
  if (!host) return false;
  return host === 'line.me' || host.endsWith('.line.me');
};

const isAllowedByConfiguredOrigins = (originInput) => {
  const origin = String(originInput || '').trim();
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  return allowedOrigins.some((entry) => {
    const regex = wildcardOriginToRegex(entry);
    return regex ? regex.test(origin) : false;
  });
};

app.use(
  cors({
    origin(origin, callback) {
      const shouldAllow =
        !origin ||
        allowedOrigins.length === 0 ||
        isAllowedByConfiguredOrigins(origin) ||
        isTrustedLineOrigin(origin);
      if (shouldAllow) {
        callback(null, true);
        return;
      }
      console.warn(
        `CORS blocked origin: ${String(origin || '').trim()} | configured CLIENT_ORIGIN: ${allowedOrigins.join(', ')}`
      );
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
const FIRESTORE_LINE_SCAM_BOT_COLLECTION = String(
  process.env.FIRESTORE_LINE_SCAM_BOT_COLLECTION || 'line_scam_bot'
).trim();
const FIRESTORE_LINE_SCAM_WEBHOOK_LOG_COLLECTION = String(
  process.env.FIRESTORE_LINE_SCAM_WEBHOOK_LOG_COLLECTION || 'line_scam_webhook_logs'
).trim();
const FIRESTORE_LINE_ESCROW_BOT_COLLECTION = String(
  process.env.FIRESTORE_LINE_ESCROW_BOT_COLLECTION || 'line_escrow_bot'
).trim();
const FIRESTORE_LINE_ESCROW_WEBHOOK_LOG_COLLECTION = String(
  process.env.FIRESTORE_LINE_ESCROW_WEBHOOK_LOG_COLLECTION || 'line_escrow_webhook_logs'
).trim();
const FIRESTORE_LINE_ESCROW_DEAL_COLLECTION = String(
  process.env.FIRESTORE_LINE_ESCROW_DEAL_COLLECTION || 'line_escrow_deals'
).trim();
const FIRESTORE_ADMIN_COMPLAINT_COLLECTION = String(
  process.env.FIRESTORE_ADMIN_COMPLAINT_COLLECTION || 'support_complaints'
).trim();
const FIRESTORE_SUPPORT_TICKET_COLLECTION = String(
  process.env.FIRESTORE_SUPPORT_TICKET_COLLECTION || 'support_tickets'
).trim();
const FIRESTORE_SCAM_REPORT_COLLECTION = String(
  process.env.FIRESTORE_SCAM_REPORT_COLLECTION || 'admin_scam_reports'
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
const SCAM_REPORT_IMAGE_MAX_BYTES = Math.max(
  60_000,
  Number(process.env.SCAM_REPORT_IMAGE_MAX_BYTES || 600_000)
);
const SCAM_LIFF_IMAGE_MAX_BYTES = Math.max(
  120_000,
  Number(process.env.SCAM_LIFF_IMAGE_MAX_BYTES || 10_485_760)
);
const SCAM_LIFF_IMAGE_MAX_COUNT = Math.max(
  1,
  Math.min(10, Number(process.env.SCAM_LIFF_IMAGE_MAX_COUNT || 10))
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
const LINE_SCAM_CHANNEL_SECRET = String(process.env.LINE_SCAM_CHANNEL_SECRET || '').trim();
const LINE_SCAM_CHANNEL_ACCESS_TOKEN = String(process.env.LINE_SCAM_CHANNEL_ACCESS_TOKEN || '').trim();
const LINE_SCAM_LIFF_SCAMMER_CHECK_URL = String(
  process.env.LINE_SCAM_LIFF_SCAMMER_CHECK_URL || ''
).trim();
const LINE_SCAM_LIFF_FAKE_NEWS_URL = String(process.env.LINE_SCAM_LIFF_FAKE_NEWS_URL || '').trim();
const LINE_SCAM_LIFF_RISK_ASSESS_URL = String(
  process.env.LINE_SCAM_LIFF_RISK_ASSESS_URL || ''
).trim();
const LINE_SCAM_LIFF_POLICE_STATIONS_URL = String(
  process.env.LINE_SCAM_LIFF_POLICE_STATIONS_URL || ''
).trim();
const LINE_SCAM_POLICE_STATIONS_OVERPASS_URL = String(
  process.env.LINE_SCAM_POLICE_STATIONS_OVERPASS_URL || 'https://overpass-api.de/api/interpreter'
).trim();
const LINE_SCAM_POLICE_STATIONS_CACHE_TTL_MS = Math.max(
  5 * 60 * 1000,
  Number(process.env.LINE_SCAM_POLICE_STATIONS_CACHE_TTL_MS || 24 * 60 * 60 * 1000)
);
const LINE_SCAM_POLICE_STATIONS_FETCH_TIMEOUT_MS = Math.max(
  10 * 1000,
  Number(process.env.LINE_SCAM_POLICE_STATIONS_FETCH_TIMEOUT_MS || 120 * 1000)
);
const LINE_ESCROW_CHANNEL_SECRET = String(process.env.LINE_ESCROW_CHANNEL_SECRET || '').trim();
const LINE_ESCROW_CHANNEL_ACCESS_TOKEN = String(process.env.LINE_ESCROW_CHANNEL_ACCESS_TOKEN || '').trim();
const LINE_ESCROW_USE_SCAM_CHANNEL = /^(?:1|true|yes|on)$/i.test(
  String(process.env.LINE_ESCROW_USE_SCAM_CHANNEL || '').trim()
);
const LINE_ESCROW_EFFECTIVE_CHANNEL_SECRET = String(
  (LINE_ESCROW_USE_SCAM_CHANNEL ? LINE_SCAM_CHANNEL_SECRET : LINE_ESCROW_CHANNEL_SECRET) || ''
).trim();
const LINE_ESCROW_EFFECTIVE_CHANNEL_ACCESS_TOKEN = String(
  (LINE_ESCROW_USE_SCAM_CHANNEL ? LINE_SCAM_CHANNEL_ACCESS_TOKEN : LINE_ESCROW_CHANNEL_ACCESS_TOKEN) || ''
).trim();
const LINE_ESCROW_SHARED_WITH_SCAM_CHANNEL =
  LINE_ESCROW_USE_SCAM_CHANNEL ||
  Boolean(
    LINE_SCAM_CHANNEL_SECRET &&
      LINE_SCAM_CHANNEL_ACCESS_TOKEN &&
      LINE_ESCROW_EFFECTIVE_CHANNEL_SECRET &&
      LINE_ESCROW_EFFECTIVE_CHANNEL_ACCESS_TOKEN &&
      LINE_SCAM_CHANNEL_SECRET === LINE_ESCROW_EFFECTIVE_CHANNEL_SECRET &&
      LINE_SCAM_CHANNEL_ACCESS_TOKEN === LINE_ESCROW_EFFECTIVE_CHANNEL_ACCESS_TOKEN
  );
const LINE_ESCROW_LIFF_DEAL_URL = String(process.env.LINE_ESCROW_LIFF_DEAL_URL || '').trim();
const LINE_ESCROW_LIFF_SELLER_URL = String(process.env.LINE_ESCROW_LIFF_SELLER_URL || '').trim();
const LINE_ESCROW_LIFF_BUYER_URL = String(process.env.LINE_ESCROW_LIFF_BUYER_URL || '').trim();
const LINE_ESCROW_PAYMENT_PROVIDER = String(process.env.LINE_ESCROW_PAYMENT_PROVIDER || 'opn')
  .trim()
  .toLowerCase();
const LINE_ESCROW_TRACKING_PROVIDER = String(process.env.LINE_ESCROW_TRACKING_PROVIDER || 'trackingmore')
  .trim()
  .toLowerCase();
const LINE_ESCROW_AUTO_RELEASE_HOURS = Math.max(
  1,
  Math.min(168, Number(process.env.LINE_ESCROW_AUTO_RELEASE_HOURS || 72))
);
const LINE_ESCROW_SLIP_IMAGE_MAX_BYTES = Math.max(
  120_000,
  Number(process.env.LINE_ESCROW_SLIP_IMAGE_MAX_BYTES || 10_485_760)
);
const LINE_ESCROW_SLIP_IMAGE_MAX_COUNT = Math.max(
  1,
  Math.min(10, Number(process.env.LINE_ESCROW_SLIP_IMAGE_MAX_COUNT || 10))
);
const LINE_ESCROW_CRON_SECRET = String(process.env.LINE_ESCROW_CRON_SECRET || '').trim();
const LINE_ESCROW_PAYMENT_WEBHOOK_SECRET = String(
  process.env.LINE_ESCROW_PAYMENT_WEBHOOK_SECRET || ''
).trim();
const LINE_ESCROW_MANUAL_PAYMENT_CONFIRM_ENABLED = /^(?:1|true|yes|on)$/i.test(
  String(process.env.LINE_ESCROW_MANUAL_PAYMENT_CONFIRM_ENABLED || '1').trim()
);
const OPN_SECRET_KEY = String(process.env.OPN_SECRET_KEY || '').trim();
const OPN_PUBLIC_KEY = String(process.env.OPN_PUBLIC_KEY || '').trim();
const OPN_API_BASE_URL =
  String(process.env.OPN_API_BASE_URL || 'https://api.omise.co').trim() || 'https://api.omise.co';
const TRACKING_API_KEY = String(process.env.TRACKING_API_KEY || process.env.TRACKINGMORE_API_KEY || '').trim();
const TRACKING_API_BASE_URL =
  String(process.env.TRACKING_API_BASE_URL || 'https://api.trackingmore.com/v4').trim() ||
  'https://api.trackingmore.com/v4';
const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || '').trim();
const GEMINI_MODEL = String(process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim() || 'gemini-2.5-flash';
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
const lineScamBotRef = firestore.collection(FIRESTORE_LINE_SCAM_BOT_COLLECTION);
const lineScamWebhookLogRef = firestore.collection(FIRESTORE_LINE_SCAM_WEBHOOK_LOG_COLLECTION);
const lineScamBotConfigDocRef = lineScamBotRef.doc('global');
const lineEscrowBotRef = firestore.collection(FIRESTORE_LINE_ESCROW_BOT_COLLECTION);
const lineEscrowWebhookLogRef = firestore.collection(FIRESTORE_LINE_ESCROW_WEBHOOK_LOG_COLLECTION);
const lineEscrowDealRef = firestore.collection(FIRESTORE_LINE_ESCROW_DEAL_COLLECTION);
const lineEscrowBotConfigDocRef = lineEscrowBotRef.doc('global');
const adminComplaintRef = firestore.collection(FIRESTORE_ADMIN_COMPLAINT_COLLECTION);
const supportTicketRef = firestore.collection(FIRESTORE_SUPPORT_TICKET_COLLECTION);
const scamReportRef = firestore.collection(FIRESTORE_SCAM_REPORT_COLLECTION);
const aiThreadRef = firestore.collection(FIRESTORE_AI_THREAD_COLLECTION);
const oauthClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
let lineScamPoliceStationsCache = {
  fetchedAtMs: 0,
  stations: [],
};

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
const normalizeScamReportTransferDate = (valueInput) => {
  const value = String(valueInput || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return '';
  return value;
};
const normalizeScamReportAmount = (valueInput) => {
  const value = Number(valueInput || 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(1_000_000_000_000, Math.round(value * 100) / 100);
};
const normalizeScamReportEvidenceImage = (imageInput) => {
  const image = imageInput && typeof imageInput === 'object' && !Array.isArray(imageInput) ? imageInput : {};
  const id = String(image.id || crypto.randomUUID()).trim();
  const name = String(image.name || 'evidence-image').trim().slice(0, 180);
  const mimeType = String(image.mimeType || image.type || '').trim().toLowerCase();
  const dataUrl = String(image.dataUrl || image.base64 || '').trim();
  const size = Number(image.size || 0);
  if (!id || !mimeType || !dataUrl) return null;
  if (!mimeType.startsWith('image/')) return null;
  if (!/^data:image\//i.test(dataUrl)) return null;
  if (!Number.isFinite(size) || size <= 0 || size > SCAM_REPORT_IMAGE_MAX_BYTES) return null;
  return {
    id,
    name,
    mimeType,
    size,
    dataUrl,
  };
};
const toScamReportResponse = (docId, dataInput) => {
  const data = dataInput && typeof dataInput === 'object' && !Array.isArray(dataInput) ? dataInput : {};
  const createdAtRaw = String(data.createdAt || '').trim();
  const createdAt = toEpochMs(createdAtRaw) > 0 ? createdAtRaw : null;
  const updatedAtRaw = String(data.updatedAt || '').trim();
  const updatedAt = toEpochMs(updatedAtRaw) > 0 ? updatedAtRaw : createdAt;
  return {
    id: String(docId || '').trim(),
    sellerAlias: String(data.sellerAlias || '').trim(),
    firstName: String(data.firstName || '').trim(),
    lastName: String(data.lastName || '').trim(),
    citizenId: String(data.citizenId || '').trim(),
    phone: String(data.phone || '').trim(),
    bankAccount: String(data.bankAccount || '').trim(),
    bankName: String(data.bankName || '').trim(),
    product: String(data.product || '').trim(),
    amount: normalizeScamReportAmount(data.amount),
    transferDate: normalizeScamReportTransferDate(data.transferDate),
    pageUrl: String(data.pageUrl || '').trim(),
    province: String(data.province || '').trim(),
    evidenceImage: normalizeScamReportEvidenceImage(data.evidenceImage),
    createdById: sanitizeUserId(data.createdById),
    createdByUsername: sanitizeUsername(data.createdByUsername),
    createdByEmail: sanitizeEmail(data.createdByEmail),
    createdAt,
    updatedAt,
  };
};

const clampPercent = (valueInput) => {
  const value = Number(valueInput);
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value * 100) / 100));
};

const normalizeOptionalString = (valueInput, maxLength = 400) =>
  String(valueInput || '')
    .trim()
    .slice(0, Math.max(20, Number(maxLength || 400)));

const parseImageDataUrlForGemini = (dataUrlInput, maxBytes = SCAM_LIFF_IMAGE_MAX_BYTES) => {
  const dataUrl = String(dataUrlInput || '').trim();
  if (!dataUrl) return null;
  const matched = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=\n\r]+)$/);
  if (!matched) return null;
  const mimeType = String(matched[1] || '').trim().toLowerCase();
  const base64Raw = String(matched[2] || '').replace(/\s+/g, '');
  if (!mimeType.startsWith('image/') || !base64Raw) return null;
  const byteLength = Buffer.byteLength(base64Raw, 'base64');
  if (!Number.isFinite(byteLength) || byteLength <= 0 || byteLength > maxBytes) return null;
  return {
    mimeType,
    data: base64Raw,
    byteLength,
  };
};

const extractJsonObjectFromText = (textInput) => {
  const text = String(textInput || '').trim();
  if (!text) return null;

  const tryParse = (candidateInput) => {
    const candidate = String(candidateInput || '').trim();
    if (!candidate) return null;
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  };

  const direct = tryParse(text);
  if (direct && typeof direct === 'object') return direct;

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const fenced = tryParse(fencedMatch?.[1] || '');
  if (fenced && typeof fenced === 'object') return fenced;

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const sliced = tryParse(text.slice(firstBrace, lastBrace + 1));
    if (sliced && typeof sliced === 'object') return sliced;
  }
  return null;
};

const callGeminiStructuredJson = async ({
  prompt,
  imageDataUrl = '',
  imageDataUrls = [],
  model = GEMINI_MODEL,
  taskName = 'analysis',
}) => {
  if (!GEMINI_API_KEY) {
    const error = new Error('GEMINI_API_KEY is not configured on server.');
    error.status = 503;
    throw error;
  }
  const safePrompt = String(prompt || '').trim();
  if (!safePrompt) {
    const error = new Error('Prompt is empty for Gemini request.');
    error.status = 400;
    throw error;
  }

  const parts = [{ text: safePrompt }];
  const imageCandidates = Array.isArray(imageDataUrls)
    ? imageDataUrls
    : imageDataUrl
      ? [imageDataUrl]
      : [];
  const normalizedImageDataUrls = imageCandidates
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .slice(0, SCAM_LIFF_IMAGE_MAX_COUNT);
  if (normalizedImageDataUrls.length > 0) {
    for (const imageCandidate of normalizedImageDataUrls) {
      const parsedImage = parseImageDataUrlForGemini(imageCandidate, SCAM_LIFF_IMAGE_MAX_BYTES);
      if (!parsedImage) {
        const error = new Error('Invalid image data. Please upload valid image files.');
        error.status = 400;
        throw error;
      }
      parts.push({
        inline_data: {
          mime_type: parsedImage.mimeType,
          data: parsedImage.data,
        },
      });
    }
  } else if (imageDataUrl) {
    const parsedImage = parseImageDataUrlForGemini(imageDataUrl, SCAM_LIFF_IMAGE_MAX_BYTES);
    if (!parsedImage) {
      const error = new Error(
        'Invalid image data. Please upload valid image files.'
      );
      error.status = 400;
      throw error;
    }
    parts.push({
      inline_data: {
        mime_type: parsedImage.mimeType,
        data: parsedImage.data,
      },
    });
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    String(model || GEMINI_MODEL)
  )}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      generationConfig: {
        temperature: 0.15,
        responseMimeType: 'application/json',
      },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      normalizeOptionalString(payload?.error?.message, 280) ||
      `Gemini ${taskName} request failed (${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  const partsOutput = Array.isArray(payload?.candidates?.[0]?.content?.parts)
    ? payload.candidates[0].content.parts
    : [];
  const textOutput = partsOutput
    .map((part) => String(part?.text || '').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
  const parsedJson = extractJsonObjectFromText(textOutput);
  if (!parsedJson || typeof parsedJson !== 'object' || Array.isArray(parsedJson)) {
    const error = new Error('Gemini returned invalid JSON format.');
    error.status = 502;
    throw error;
  }
  return {
    rawText: textOutput,
    json: parsedJson,
  };
};

const normalizeGeminiReferences = (referencesInput) =>
  (Array.isArray(referencesInput) ? referencesInput : [])
    .map((itemInput) => {
      const item = itemInput && typeof itemInput === 'object' && !Array.isArray(itemInput) ? itemInput : {};
      const title = normalizeOptionalString(item.title || item.name || item.source || '', 180);
      const url = normalizeOptionalHttpUrl(item.url || item.link || item.sourceUrl || '', 800);
      if (!title && !url) return null;
      return {
        title: title || url || 'Reference',
        url: url || '',
      };
    })
    .filter(Boolean)
    .slice(0, 8);

const normalizeGeminiStringList = (valuesInput, maxItems = 10, maxLength = 220) =>
  (Array.isArray(valuesInput) ? valuesInput : [])
    .map((value) => normalizeOptionalString(value, maxLength))
    .filter(Boolean)
    .slice(0, Math.max(1, Number(maxItems || 10)));

const resolveLineScamRiskLevel = (riskPercentInput) => {
  const riskPercent = clampPercent(riskPercentInput);
  if (riskPercent >= 70) return 'high';
  if (riskPercent >= 40) return 'medium';
  return 'low';
};

const buildLineScamActionFlexMessage = ({
  title,
  bodyText = '',
  actionLabel = 'เริ่มใช้งานตอนนี้',
  actionUrl = '',
  accentColor = '#0ea5e9',
  altText = '',
}) => {
  const safeActionUrl = normalizeOptionalHttpUrl(actionUrl, 1000);
  return {
    type: 'flex',
    altText: normalizeOptionalString(altText || title || 'LINE Scam Bot', 320) || 'LINE Scam Bot',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: '12px',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            cornerRadius: '12px',
            paddingAll: '12px',
            backgroundColor: accentColor,
            contents: [
              {
                type: 'text',
                text: normalizeOptionalString(title, 64) || 'LINE Scam Bot',
                size: 'lg',
                weight: 'bold',
                color: '#ffffff',
                wrap: true,
              },
            ],
          },
          ...(bodyText
            ? [
                {
                  type: 'text',
                  text: normalizeOptionalString(bodyText, 420),
                  size: 'sm',
                  color: '#334155',
                  wrap: true,
                },
              ]
            : []),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: '8px',
        contents: safeActionUrl
          ? [
              {
                type: 'button',
                style: 'primary',
                color: accentColor,
                action: {
                  type: 'uri',
                  label: normalizeOptionalString(actionLabel, 20) || 'Open',
                  uri: safeActionUrl,
                },
              },
            ]
          : [
              {
                type: 'text',
                text: 'LIFF URL ยังไม่ถูกตั้งค่า โปรดแจ้งผู้ดูแลระบบ',
                size: 'xs',
                color: '#991b1b',
                wrap: true,
              },
            ],
      },
    },
  };
};

const normalizeLineScamActionUri = (valueInput) => {
  const value = String(valueInput || '').trim();
  if (!value) return '';
  if (/^tel:[0-9+#*]+$/i.test(value)) return value;
  return normalizeOptionalHttpUrl(value, 1200) || '';
};

const buildLineScamTimelineActionButton = (actionInput) => {
  const action = actionInput && typeof actionInput === 'object' && !Array.isArray(actionInput) ? actionInput : {};
  const actionType = String(action.type || 'uri').trim().toLowerCase();
  const label = normalizeOptionalString(action.label || '', 20) || 'เปิดลิงก์';
  if (actionType === 'message') {
    const text = normalizeOptionalString(action.text || action.value || '', 300);
    if (!text) return null;
    return {
      type: 'button',
      style: 'secondary',
      color: '#e2e8f0',
      height: 'sm',
      action: {
        type: 'message',
        label,
        text,
      },
    };
  }
  const uri = normalizeLineScamActionUri(action.uri || action.url || action.value || '');
  if (!uri) return null;
  return {
    type: 'button',
    style: 'secondary',
    color: '#e2e8f0',
    height: 'sm',
    action: {
      type: 'uri',
      label,
      uri,
    },
  };
};

const buildLineScamTimelineStepFlexBox = ({
  step = 1,
  title = '',
  detail = '',
  accentColor = '#dc2626',
  actions = [],
} = {}) => {
  const stepText = String(Number(step || 1) || 1).slice(0, 3);
  const safeTitle = normalizeOptionalString(title, 120) || 'ขั้นตอน';
  const safeDetail = normalizeOptionalString(detail, 650);
  const buttons = (Array.isArray(actions) ? actions : [])
    .map((item) => buildLineScamTimelineActionButton(item))
    .filter(Boolean)
    .slice(0, 2);
  return {
    type: 'box',
    layout: 'vertical',
    spacing: '8px',
    paddingAll: '12px',
    cornerRadius: '12px',
    borderWidth: '1px',
    borderColor: '#dbeafe',
    backgroundColor: '#f8fafc',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        spacing: '8px',
        alignItems: 'center',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            flex: 0,
            width: '22px',
            height: '22px',
            cornerRadius: '11px',
            backgroundColor: accentColor,
            justifyContent: 'center',
            alignItems: 'center',
            contents: [
              {
                type: 'text',
                text: stepText,
                size: 'xs',
                color: '#ffffff',
                weight: 'bold',
                align: 'center',
              },
            ],
          },
          {
            type: 'text',
            text: safeTitle,
            size: 'sm',
            weight: 'bold',
            color: '#0f172a',
            wrap: true,
            flex: 1,
          },
        ],
      },
      ...(safeDetail
        ? [
            {
              type: 'text',
              text: safeDetail,
              size: 'xs',
              color: '#334155',
              wrap: true,
            },
          ]
        : []),
      ...(buttons.length
        ? [
            {
              type: 'box',
              layout: 'vertical',
              spacing: '6px',
              contents: buttons,
            },
          ]
        : []),
    ],
  };
};

const buildLineScamTimelineCarouselFlexMessage = ({
  altText = '',
  title = '',
  subtitle = '',
  accentColor = '#dc2626',
  phases = [],
} = {}) => {
  const safePhases = Array.isArray(phases) ? phases : [];
  const bubbles = safePhases
    .map((phaseInput, phaseIndex) => {
      const phase =
        phaseInput && typeof phaseInput === 'object' && !Array.isArray(phaseInput) ? phaseInput : {};
      const phaseTitle = normalizeOptionalString(phase.title || '', 90);
      const phaseSummary = normalizeOptionalString(phase.summary || '', 400);
      const phaseSteps = (Array.isArray(phase.steps) ? phase.steps : [])
        .map((stepInput, stepIndex) => {
          const step = stepInput && typeof stepInput === 'object' && !Array.isArray(stepInput) ? stepInput : {};
          return buildLineScamTimelineStepFlexBox({
            step: Number(step.step || stepIndex + 1) || stepIndex + 1,
            title: step.title || '',
            detail: step.detail || '',
            accentColor: step.accentColor || accentColor,
            actions: Array.isArray(step.actions) ? step.actions : [],
          });
        })
        .filter(Boolean)
        .slice(0, 6);
      const footerButtons = (Array.isArray(phase.footerActions) ? phase.footerActions : [])
        .map((item) => buildLineScamTimelineActionButton(item))
        .filter(Boolean)
        .slice(0, 3);
      return {
        type: 'bubble',
        size: 'mega',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: '12px',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              spacing: '6px',
              paddingAll: '12px',
              cornerRadius: '12px',
              backgroundColor: '#eff6ff',
              contents: [
                {
                  type: 'text',
                  text: normalizeOptionalString(title, 70) || 'คำแนะนำเมื่อถูกโกง',
                  size: 'md',
                  weight: 'bold',
                  color: '#0f172a',
                  wrap: true,
                },
                ...(subtitle
                  ? [
                      {
                        type: 'text',
                        text: normalizeOptionalString(subtitle, 220),
                        size: 'xs',
                        color: '#334155',
                        wrap: true,
                      },
                    ]
                  : []),
                ...(phaseTitle
                  ? [
                      {
                        type: 'text',
                        text: `ช่วง ${phaseIndex + 1}: ${phaseTitle}`,
                        size: 'xs',
                        color: '#1d4ed8',
                        weight: 'bold',
                        wrap: true,
                      },
                    ]
                  : []),
              ],
            },
            ...(phaseSummary
              ? [
                  {
                    type: 'text',
                    text: phaseSummary,
                    size: 'xs',
                    color: '#475569',
                    wrap: true,
                  },
                ]
              : []),
            ...phaseSteps,
          ],
        },
        ...(footerButtons.length
          ? {
              footer: {
                type: 'box',
                layout: 'vertical',
                spacing: '8px',
                contents: footerButtons,
              },
            }
          : {}),
      };
    })
    .filter(Boolean)
    .slice(0, 10);
  if (!bubbles.length) {
    return buildLineScamActionFlexMessage({
      title: 'คำแนะนำเมื่อถูกโกง',
      bodyText: 'ยังไม่พบข้อมูลคำแนะนำ กรุณาลองใหม่อีกครั้ง',
      accentColor: '#dc2626',
      altText: 'คำแนะนำเมื่อถูกโกง',
    });
  }
  return {
    type: 'flex',
    altText: normalizeOptionalString(altText || title || 'คำแนะนำเมื่อถูกโกง', 320) || 'คำแนะนำเมื่อถูกโกง',
    contents: {
      type: 'carousel',
      contents: bubbles,
    },
  };
};

const buildLineScamHelpTypeSelectorFlexMessage = () => ({
  type: 'flex',
  altText: 'คำแนะนำเมื่อถูกโกง',
  contents: {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: '12px',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          spacing: '6px',
          paddingAll: '12px',
          cornerRadius: '12px',
          backgroundColor: '#fee2e2',
          contents: [
            {
              type: 'text',
              text: 'คำแนะนำเมื่อถูกโกง',
              size: 'lg',
              weight: 'bold',
              color: '#7f1d1d',
              wrap: true,
            },
            {
              type: 'text',
              text: 'เลือกประเภทเหตุการณ์ เพื่อรับขั้นตอนแบบไทม์ไลน์ที่ทำตามได้ทันที',
              size: 'xs',
              color: '#991b1b',
              wrap: true,
            },
          ],
        },
        {
          type: 'box',
          layout: 'vertical',
          spacing: '8px',
          paddingAll: '12px',
          cornerRadius: '12px',
          borderWidth: '1px',
          borderColor: '#fecaca',
          backgroundColor: '#fff7ed',
          contents: [
            {
              type: 'text',
              text: 'โกงออนไลน์',
              size: 'md',
              weight: 'bold',
              color: '#9a3412',
            },
            {
              type: 'text',
              text: 'เช่น ซื้อขายออนไลน์ โอนเงินแล้วไม่ได้ของ หรือโดนหลอกให้โอนผ่านแชท/เพจ',
              size: 'xs',
              color: '#7c2d12',
              wrap: true,
            },
            {
              type: 'button',
              style: 'primary',
              color: '#ea580c',
              action: {
                type: 'message',
                label: 'ดูขั้นตอนโกงออนไลน์',
                text: 'ขอคำแนะนำโกงออนไลน์',
              },
            },
          ],
        },
        {
          type: 'box',
          layout: 'vertical',
          spacing: '8px',
          paddingAll: '12px',
          cornerRadius: '12px',
          borderWidth: '1px',
          borderColor: '#bfdbfe',
          backgroundColor: '#f0f9ff',
          contents: [
            {
              type: 'text',
              text: 'โกงคอลเซ็นเตอร์/คอลเวนเตอร์',
              size: 'md',
              weight: 'bold',
              color: '#1d4ed8',
            },
            {
              type: 'text',
              text: 'เช่น อ้างเป็นเจ้าหน้าที่รัฐ/ธนาคาร หลอกให้ติดตั้งแอป กดลิงก์ หรือโอนเงิน',
              size: 'xs',
              color: '#1e3a8a',
              wrap: true,
            },
            {
              type: 'button',
              style: 'primary',
              color: '#2563eb',
              action: {
                type: 'message',
                label: 'ดูขั้นตอนคอลเซ็นเตอร์',
                text: 'ขอคำแนะนำโกงคอลเซ็นเตอร์',
              },
            },
          ],
        },
      ],
    },
  },
});

const buildLineScamOnlineFraudTimelineFlexMessage = ({ urlsInput = {} } = {}) => {
  const urls = urlsInput && typeof urlsInput === 'object' && !Array.isArray(urlsInput) ? urlsInput : {};
  const policeStationsUrl = normalizeOptionalHttpUrl(urls.policeStations || '', 1200) || '';
  return buildLineScamTimelineCarouselFlexMessage({
    altText: 'แนวทางรับมือโกงออนไลน์',
    title: 'โกงออนไลน์: แนวทางตั้งแต่เริ่มจนปิดคดี',
    subtitle: 'ทำตามลำดับนี้ทันทีเพื่อลดความเสียหายและเพิ่มโอกาสติดตามเงิน',
    accentColor: '#ea580c',
    phases: [
      {
        title: '24 ชั่วโมงแรก (เร่งด่วน)',
        summary: 'โฟกัส 3 อย่าง: เก็บหลักฐาน, อายัดเส้นทางเงิน, แจ้งความให้เร็วที่สุด',
        steps: [
          {
            step: 1,
            title: 'หยุดโอนเพิ่มและเก็บหลักฐานทั้งหมด',
            detail:
              'แคปแชท, โปรไฟล์คนขาย, URL เพจ/เว็บ, สลิปโอน, เวลาโอน และเลขบัญชีปลายทาง เก็บเป็นไฟล์เดียวกันเพื่อส่งให้ตำรวจได้ทันที',
          },
          {
            step: 2,
            title: 'โทรแจ้งอายัดด่วน',
            detail: 'แจ้งเหตุหลอกโอนเงินเพื่อประสานอายัดบัญชีปลายทาง และบันทึกเลขรับเรื่อง',
            actions: [
              { type: 'uri', label: 'โทร 1441', uri: 'tel:1441' },
              { type: 'uri', label: 'โทร 191', uri: 'tel:191' },
            ],
          },
          {
            step: 3,
            title: 'แจ้งความออนไลน์ทันที',
            detail:
              'กรอกข้อมูลเหตุการณ์ให้ครบ และอัปโหลดหลักฐานที่ชัดเจน หากมีหลายรายการให้เรียงตามเวลาเพื่อให้สำนวนเดินเร็วขึ้น',
            actions: [
              { type: 'uri', label: 'แจ้งความออนไลน์', uri: 'https://www.thaipoliceonline.go.th' },
              { type: 'uri', label: 'แจ้งความที่สถานี', uri: policeStationsUrl },
            ],
          },
          {
            step: 4,
            title: 'ติดต่อธนาคารที่โอนออกทันที',
            detail: 'แจ้งว่าเป็นคดีหลอกโอนเงิน ขอหมายเลขอ้างอิงธุรกรรมและเอกสารประกอบสำหรับส่งพนักงานสอบสวน',
          },
        ],
      },
      {
        title: 'ติดตามคดีจนปิดคดี',
        summary: 'หลังแจ้งความแล้ว ให้เดินเอกสารและติดตามผลเป็นรอบๆ เพื่อลดโอกาสคดีค้าง',
        steps: [
          {
            step: 5,
            title: 'ส่งหลักฐานเพิ่มตามที่พนักงานสอบสวนร้องขอ',
            detail:
              'เช่น รายการเดินบัญชี, เอกสารยืนยันตัวตน, ภาพหน้าจอเพิ่มเติม และข้อมูลบัญชีที่เกี่ยวข้องทั้งหมด',
          },
          {
            step: 6,
            title: 'พิจารณาดำเนินคดีเพิ่มเติม',
            detail:
              'นอกจากคดีอาญา อาจปรึกษาแนวทางเรียกค่าเสียหายทางแพ่ง โดยเตรียมลำดับเหตุการณ์และมูลค่าความเสียหายให้ชัดเจน',
            actions: [{ type: 'uri', label: 'ข้อมูลยุติธรรม', uri: 'https://www.moj.go.th' }],
          },
          {
            step: 7,
            title: 'ติดตามผลคดีและปิดคดี',
            detail:
              'เก็บเลขคดี/เลขรับแจ้งไว้เสมอ นัดติดตามความคืบหน้าตามรอบ และเก็บเอกสารปิดคดีเพื่อใช้ป้องกันเหตุซ้ำ',
            actions: [{ type: 'message', label: 'เลือกประเภทอื่น', text: 'คำแนะนำเมื่อถูกโกง' }],
          },
        ],
      },
    ],
  });
};

const buildLineScamCallCenterTimelineFlexMessage = ({ urlsInput = {} } = {}) => {
  const urls = urlsInput && typeof urlsInput === 'object' && !Array.isArray(urlsInput) ? urlsInput : {};
  const policeStationsUrl = normalizeOptionalHttpUrl(urls.policeStations || '', 1200) || '';
  return buildLineScamTimelineCarouselFlexMessage({
    altText: 'แนวทางรับมือโกงคอลเซ็นเตอร์',
    title: 'โกงคอลเซ็นเตอร์: แนวทางตั้งแต่เหตุฉุกเฉินจนปิดคดี',
    subtitle: 'หากโดนหลอกให้กดลิงก์/ติดตั้งแอป/ยืนยัน OTP ให้ทำตามขั้นตอนนี้ทันที',
    accentColor: '#2563eb',
    phases: [
      {
        title: 'หยุดความเสียหายทันที',
        summary: 'โฟกัสการตัดการเข้าถึงอุปกรณ์และบัญชี ก่อนที่เงินหรือข้อมูลจะเสียหายเพิ่ม',
        steps: [
          {
            step: 1,
            title: 'ตัดการเชื่อมต่อทันที',
            detail: 'เปิดโหมดเครื่องบินหรือปิดอินเทอร์เน็ตทันที โดยเฉพาะเมื่อเพิ่งกดลิงก์หรือให้สิทธิ์รีโมตหน้าจอ',
          },
          {
            step: 2,
            title: 'ถอนแอปรีโมต/แอปไม่รู้จัก',
            detail:
              'ลบแอปที่คนร้ายให้ติดตั้ง เปลี่ยนรหัสผ่านสำคัญทั้งหมด และปิดการอนุญาตที่ไม่จำเป็นในเครื่อง',
          },
          {
            step: 3,
            title: 'อายัดบัญชีและแจ้งเหตุด่วน',
            detail: 'หากมีการโอนหรือสงสัยว่าบัญชีถูกควบคุม ให้แจ้งอายัดทันทีและเก็บเลขรับเรื่อง',
            actions: [
              { type: 'uri', label: 'โทร 1441', uri: 'tel:1441' },
              { type: 'uri', label: 'โทร 191', uri: 'tel:191' },
            ],
          },
          {
            step: 4,
            title: 'อายัดซิม/เปลี่ยนรหัสทุกระบบ',
            detail:
              'ติดต่อเครือข่ายมือถือเพื่อป้องกันการยึดเบอร์ และรีเซ็ตรหัสผ่านอีเมล/ธนาคาร/โซเชียล พร้อมเปิด 2FA',
          },
        ],
      },
      {
        title: 'ทำสำนวนและติดตามคดี',
        summary: 'รวมพยานหลักฐานให้ครบ แล้วส่งต่อเข้าสำนวนเพื่อดำเนินคดีต่อเนื่องจนปิดเรื่อง',
        steps: [
          {
            step: 5,
            title: 'รวมหลักฐานดิจิทัลทั้งหมด',
            detail:
              'เบอร์โทรต้นทาง, ไฟล์เสียง, ลิงก์ที่ส่งมา, SMS/OTP, ประวัติธุรกรรม และภาพหน้าจอเหตุการณ์เรียงตามเวลา',
          },
          {
            step: 6,
            title: 'แจ้งความพร้อมหลักฐานชุดเดียวกัน',
            detail:
              'ส่งข้อมูลให้ครบในครั้งเดียวเพื่อลดเวลาแก้สำนวน และอ้างอิงเลขรับแจ้งทุกครั้งที่ติดตามผล',
            actions: [
              { type: 'uri', label: 'แจ้งความออนไลน์', uri: 'https://www.thaipoliceonline.go.th' },
              { type: 'uri', label: 'แจ้งความที่สถานี', uri: policeStationsUrl },
            ],
          },
          {
            step: 7,
            title: 'ติดตามคดีจนปิด',
            detail:
              'นัดติดตามสถานะกับหน่วยงานเจ้าของสำนวนเป็นรอบๆ และเก็บเอกสารสรุปผลคดีไว้ใช้อ้างอิงในอนาคต',
            actions: [{ type: 'message', label: 'เลือกประเภทอื่น', text: 'คำแนะนำเมื่อถูกโกง' }],
          },
        ],
      },
    ],
  });
};

const buildLineScamUsageFlexMessage = () =>
  buildLineScamActionFlexMessage({
    title: 'วิธีใช้งาน LINE Scam Bot',
    bodyText:
      'ตรวจสอบมิจฉาชีพ: ค้นฐานข้อมูลเคสโกง\\nตรวจสอบข่าวปลอม: วิเคราะห์ข่าวและแหล่งอ้างอิง\\nประเมินความเสี่ยง: อัปโหลดรูปแชทเพื่อวิเคราะห์\\nเมนูคำแนะนำ: อ่านขั้นตอนป้องกันโดนโกง',
    actionLabel: 'เปิดหน้าตรวจสอบมิจฉาชีพ',
    actionUrl: LINE_SCAM_LIFF_SCAMMER_CHECK_URL,
    accentColor: '#0369a1',
    altText: 'แนะนำวิธีการใช้งาน',
  });

const buildLineScamUnknownCommandText = () =>
  [
    'รองรับคำสั่งจาก Rich Menu ดังนี้:',
    `- ${LINE_SCAM_RICH_MENU_COMMANDS.HELP_WHEN_SCAMMED}`,
    `- ${LINE_SCAM_RICH_MENU_COMMANDS.CHECK_SCAMMER}`,
    `- ${LINE_SCAM_RICH_MENU_COMMANDS.CHECK_FAKE_NEWS}`,
    `- ${LINE_SCAM_RICH_MENU_COMMANDS.ASSESS_RISK}`,
    `- ${LINE_SCAM_RICH_MENU_COMMANDS.HOW_TO_USE}`,
  ].join('\\n');

const buildLineScamCommandReplyMessages = ({ commandKey, liffUrls }) => {
  const urls = liffUrls && typeof liffUrls === 'object' ? liffUrls : {};
  if (commandKey === 'help_when_scammed') {
    return [buildLineScamHelpTypeSelectorFlexMessage()];
  }
  if (commandKey === 'help_online_scam') {
    return [buildLineScamOnlineFraudTimelineFlexMessage({ urlsInput: urls })];
  }
  if (commandKey === 'help_call_center_scam') {
    return [buildLineScamCallCenterTimelineFlexMessage({ urlsInput: urls })];
  }
  if (commandKey === 'check_scammer') {
    return [
      buildLineScamActionFlexMessage({
        title: 'ตรวจสอบมิจฉาชีพ',
        bodyText: 'กดปุ่มด้านล่างเพื่อกรอก ชื่อ บัญชี เบอร์โทรเพื่อค้นหา',
        actionLabel: 'เริ่มใช้งานตอนนี้',
        actionUrl: urls.scammerCheck || '',
        accentColor: '#b91c1c',
        altText: 'ตรวจสอบมิจฉาชีพ',
      }),
    ];
  }
  if (commandKey === 'check_fake_news') {
    return [
      buildLineScamActionFlexMessage({
        title: 'ตรวจสอบข่าวปลอม',
        bodyText: 'ระบบจะให้เปอร์เซ็นต์ข่าวปลอม พร้อมเหตุผลและแหล่งอ้างอิงที่ควรตรวจซ้ำ',
        actionLabel: 'เริ่มใช้งานตอนนี้',
        actionUrl: urls.fakeNews || '',
        accentColor: '#0f766e',
        altText: 'ตรวจสอบข่าวปลอม',
      }),
    ];
  }
  if (commandKey === 'assess_risk') {
    return [
      buildLineScamActionFlexMessage({
        title: 'ประเมินความเสี่ยงการโดนโกง',
        bodyText: 'ระบบจะแสดงเปอร์เซ็นต์ความเสี่ยง สัญญาณเตือน และคำแนะนำที่ควรทำต่อ',
        actionLabel: 'เริ่มใช้งานตอนนี้',
        actionUrl: urls.riskAssess || '',
        accentColor: '#a16207',
        altText: 'ประเมินความเสี่ยง',
      }),
    ];
  }
  if (commandKey === 'how_to_use') {
    const usageCard = buildLineScamUsageFlexMessage();
    const firstUrl = normalizeOptionalHttpUrl(urls.scammerCheck || '');
    if (firstUrl) {
      usageCard.contents.footer = {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#0369a1',
            action: {
              type: 'uri',
              label: 'เริ่มใช้งานตอนนี้',
              uri: firstUrl,
            },
          },
        ],
      };
    }
    return [usageCard];
  }
  return [
    {
      type: 'text',
      text: buildLineScamUnknownCommandText().slice(0, 4900),
    },
  ];
};

const normalizeSearchToken = (valueInput) =>
  String(valueInput || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const toScamReportSearchableText = (reportInput) => {
  const report = reportInput && typeof reportInput === 'object' && !Array.isArray(reportInput) ? reportInput : {};
  return normalizeSearchToken(
    [
      report.sellerAlias,
      report.firstName,
      report.lastName,
      report.citizenId,
      report.phone,
      report.bankAccount,
      report.bankName,
      report.product,
      report.pageUrl,
      report.province,
    ]
      .map((item) => String(item || '').trim())
      .join(' ')
  );
};

const normalizeGeoCoordinate = (valueInput, min, max) => {
  const value = Number(valueInput);
  if (!Number.isFinite(value)) return null;
  if (value < min || value > max) return null;
  return value;
};

const toLineScamPoliceStationAddress = (tagsInput) => {
  const tags = tagsInput && typeof tagsInput === 'object' && !Array.isArray(tagsInput) ? tagsInput : {};
  const addressParts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:subdistrict'],
    tags['addr:quarter'],
    tags['addr:district'],
    tags['addr:city'],
    tags['addr:province'],
    tags['addr:postcode'],
  ]
    .map((value) => normalizeOptionalString(value, 80))
    .filter(Boolean);
  if (addressParts.length > 0) {
    return normalizeOptionalString(addressParts.join(' '), 260) || '-';
  }
  return (
    normalizeOptionalString(
      tags['addr:full'] ||
        tags.description ||
        tags['contact:street'] ||
        tags['is_in'] ||
        tags['is_in:district'] ||
        tags['is_in:province'] ||
        '',
      260
    ) || '-'
  );
};

const mapOverpassElementToLineScamPoliceStation = (elementInput) => {
  const element =
    elementInput && typeof elementInput === 'object' && !Array.isArray(elementInput) ? elementInput : {};
  const tags = element.tags && typeof element.tags === 'object' && !Array.isArray(element.tags) ? element.tags : {};
  const latitude = normalizeGeoCoordinate(
    element.lat ?? element.center?.lat ?? element.geometry?.lat ?? null,
    -90,
    90
  );
  const longitude = normalizeGeoCoordinate(
    element.lon ?? element.center?.lon ?? element.geometry?.lon ?? null,
    -180,
    180
  );
  if (latitude === null || longitude === null) return null;

  const name =
    normalizeOptionalString(
      tags['name:th'] || tags.name || tags.official_name || tags.operator || tags.branch || '',
      160
    ) || 'สถานีตำรวจ';
  const phone =
    normalizeOptionalString(
      tags.phone || tags['contact:phone'] || tags['contact:mobile'] || tags.mobile || '',
      80
    ) || '';
  const province = normalizeOptionalString(tags['addr:province'] || tags['is_in:province'] || tags['addr:state'] || '', 120);
  const district = normalizeOptionalString(tags['addr:district'] || tags['is_in:district'] || tags['addr:city'] || '', 120);
  const address = toLineScamPoliceStationAddress(tags);
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
  const searchable = normalizeSearchToken([name, address, province, district, phone].filter(Boolean).join(' '));
  const idSeed = `${name}|${latitude.toFixed(5)}|${longitude.toFixed(5)}`;
  const id = crypto.createHash('sha1').update(idSeed).digest('hex').slice(0, 16);

  return {
    id,
    name,
    address,
    phone,
    province: province || '',
    district: district || '',
    latitude: Number(latitude.toFixed(7)),
    longitude: Number(longitude.toFixed(7)),
    mapUrl,
    searchable,
    source: 'openstreetmap',
  };
};

const calculateDistanceKm = (lat1, lng1, lat2, lng2) => {
  const aLat = normalizeGeoCoordinate(lat1, -90, 90);
  const aLng = normalizeGeoCoordinate(lng1, -180, 180);
  const bLat = normalizeGeoCoordinate(lat2, -90, 90);
  const bLng = normalizeGeoCoordinate(lng2, -180, 180);
  if (aLat === null || aLng === null || bLat === null || bLng === null) return null;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const startLat = toRad(aLat);
  const endLat = toRad(bLat);
  const inner =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(startLat) * Math.cos(endLat);
  const angle = 2 * Math.atan2(Math.sqrt(inner), Math.sqrt(1 - inner));
  return Number((6371 * angle).toFixed(3));
};

const fetchLineScamPoliceStationsFromOverpass = async () => {
  const overpassUrl = normalizeOptionalHttpUrl(LINE_SCAM_POLICE_STATIONS_OVERPASS_URL, 1200);
  if (!overpassUrl) {
    const error = new Error('LINE_SCAM_POLICE_STATIONS_OVERPASS_URL is invalid.');
    error.status = 500;
    throw error;
  }
  const overpassQuery = [
    '[out:json][timeout:120];',
    'area["ISO3166-1"="TH"][admin_level=2]->.th;',
    '(',
    '  node["amenity"="police"](area.th);',
    '  way["amenity"="police"](area.th);',
    '  relation["amenity"="police"](area.th);',
    ');',
    'out center tags;',
  ].join('\n');
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, LINE_SCAM_POLICE_STATIONS_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(overpassUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: `data=${encodeURIComponent(overpassQuery)}`,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(
        normalizeOptionalString(payload?.remark || payload?.message || `Overpass API failed (${response.status})`, 280)
      );
      error.status = response.status;
      throw error;
    }
    const elements = Array.isArray(payload?.elements) ? payload.elements : [];
    const dedupe = new Map();
    for (const element of elements) {
      const station = mapOverpassElementToLineScamPoliceStation(element);
      if (!station) continue;
      const key = `${station.name}|${station.latitude.toFixed(4)}|${station.longitude.toFixed(4)}`;
      if (!dedupe.has(key)) {
        dedupe.set(key, station);
      }
    }
    return Array.from(dedupe.values()).sort((a, b) => {
      const provinceCmp = String(a.province || '').localeCompare(String(b.province || ''), 'th');
      if (provinceCmp !== 0) return provinceCmp;
      return String(a.name || '').localeCompare(String(b.name || ''), 'th');
    });
  } catch (error) {
    if (String(error?.name || '').toLowerCase() === 'aborterror') {
      const timeoutError = new Error('โหลดข้อมูลสถานีตำรวจจากแหล่งข้อมูลกลางไม่ทันเวลา');
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const loadLineScamPoliceStations = async ({ forceRefresh = false } = {}) => {
  const nowMs = Date.now();
  const cacheStations = Array.isArray(lineScamPoliceStationsCache?.stations)
    ? lineScamPoliceStationsCache.stations
    : [];
  const cacheAgeMs = nowMs - Number(lineScamPoliceStationsCache?.fetchedAtMs || 0);
  const canUseFreshCache = cacheStations.length > 0 && cacheAgeMs >= 0 && cacheAgeMs <= LINE_SCAM_POLICE_STATIONS_CACHE_TTL_MS;
  if (!forceRefresh && canUseFreshCache) {
    return {
      stations: cacheStations,
      source: 'cache',
      fetchedAtMs: Number(lineScamPoliceStationsCache.fetchedAtMs || 0),
    };
  }

  try {
    const stations = await fetchLineScamPoliceStationsFromOverpass();
    if (!stations.length) {
      if (cacheStations.length > 0) {
        return {
          stations: cacheStations,
          source: 'cache_stale',
          fetchedAtMs: Number(lineScamPoliceStationsCache.fetchedAtMs || 0),
        };
      }
      const error = new Error('ไม่พบข้อมูลสถานีตำรวจจากแหล่งข้อมูลกลาง');
      error.status = 502;
      throw error;
    }
    lineScamPoliceStationsCache = {
      fetchedAtMs: nowMs,
      stations,
    };
    return {
      stations,
      source: 'overpass',
      fetchedAtMs: nowMs,
    };
  } catch (error) {
    if (cacheStations.length > 0) {
      return {
        stations: cacheStations,
        source: 'cache_stale',
        fetchedAtMs: Number(lineScamPoliceStationsCache.fetchedAtMs || 0),
      };
    }
    throw error;
  }
};

const searchLineScamPoliceStations = ({
  stationsInput,
  query = '',
  latitude = null,
  longitude = null,
  limit = 80,
}) => {
  const stations = Array.isArray(stationsInput) ? stationsInput : [];
  const lat = normalizeGeoCoordinate(latitude, -90, 90);
  const lng = normalizeGeoCoordinate(longitude, -180, 180);
  const queryToken = normalizeSearchToken(query);
  const queryParts = queryToken.split(' ').filter(Boolean);
  const safeLimit = Math.min(120, Math.max(1, Number(limit || 80)));
  const rows = [];

  for (const stationInput of stations) {
    const station =
      stationInput && typeof stationInput === 'object' && !Array.isArray(stationInput) ? stationInput : {};
    const searchText = normalizeSearchToken(
      station.searchable ||
        [station.name, station.address, station.province, station.district, station.phone]
          .filter(Boolean)
          .join(' ')
    );
    let score = 0;
    let matched = true;
    if (queryParts.length > 0) {
      for (const token of queryParts) {
        const index = searchText.indexOf(token);
        if (index < 0) {
          matched = false;
          break;
        }
        score += Math.max(40, 500 - index);
      }
    }
    if (!matched) continue;
    const distanceKm =
      lat !== null && lng !== null
        ? calculateDistanceKm(lat, lng, station.latitude, station.longitude)
        : null;
    if (distanceKm !== null) {
      score += Math.max(0, 300 - distanceKm * 10);
    }
    rows.push({
      ...station,
      distanceKm: distanceKm !== null ? Number(distanceKm.toFixed(2)) : null,
      _score: score,
    });
  }

  rows.sort((a, b) => {
    if (lat !== null && lng !== null) {
      const aDist = Number.isFinite(Number(a.distanceKm)) ? Number(a.distanceKm) : Number.POSITIVE_INFINITY;
      const bDist = Number.isFinite(Number(b.distanceKm)) ? Number(b.distanceKm) : Number.POSITIVE_INFINITY;
      if (aDist !== bDist) return aDist - bDist;
    }
    if (b._score !== a._score) return b._score - a._score;
    return String(a.name || '').localeCompare(String(b.name || ''), 'th');
  });

  return rows.slice(0, safeLimit).map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    province: row.province,
    district: row.district,
    latitude: row.latitude,
    longitude: row.longitude,
    mapUrl: row.mapUrl,
    distanceKm: row.distanceKm,
    source: row.source,
  }));
};

const setLineScamLiffHtmlHeaders = (res) => {
  res.set(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: https: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'self' https://line.me https://*.line.me"
  );
  // LIFF can be embedded by LINE domains, so avoid restrictive X-Frame-Options here.
  res.removeHeader('X-Frame-Options');
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

const isValidLineWebhookSignatureWithSecret = (req, channelSecretInput) => {
  const channelSecret = String(channelSecretInput || '').trim();
  if (!channelSecret) return false;
  const signature = String(req.get('x-line-signature') || '').trim();
  if (!signature || !req.rawBody) return false;
  const expected = crypto
    .createHmac('sha256', channelSecret)
    .update(req.rawBody)
    .digest('base64');
  const incomingBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (incomingBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(incomingBuffer, expectedBuffer);
};

const isValidLineWebhookSignature = (req) =>
  isValidLineWebhookSignatureWithSecret(req, LINE_CHANNEL_SECRET);

const sendLineReplyMessages = async ({ channelAccessToken, replyToken, messages }) => {
  const token = String(channelAccessToken || '').trim();
  const safeReplyToken = String(replyToken || '').trim();
  const preparedMessages = Array.isArray(messages) ? messages.filter(Boolean).slice(0, 5) : [];
  if (!token || !safeReplyToken || preparedMessages.length === 0) return;
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      replyToken: safeReplyToken,
      messages: preparedMessages,
    }),
  });
  if (!response.ok) {
    const responseText = String(await response.text()).trim();
    throw new Error(
      `LINE reply failed (${response.status})${responseText ? `: ${responseText.slice(0, 220)}` : ''}`
    );
  }
};

const sendLineReplyMessage = async ({ replyToken, message }) => {
  const text = String(message || '').trim();
  if (!text) return;
  await sendLineReplyMessages({
    channelAccessToken: LINE_WEBHOOK_CHANNEL_ACCESS_TOKEN,
    replyToken,
    messages: [{ type: 'text', text: text.slice(0, 4900) }],
  });
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

const isLineEscrowStartCommand = (value) => {
  const normalized = normalizeLineCommandText(value);
  if (!normalized) return false;
  const compact = normalized.replace(/[^\p{L}\p{N}]/gu, '');
  if (LINE_ESCROW_COMMAND_KEYWORDS.has(normalized) || (compact && LINE_ESCROW_COMMAND_KEYWORDS.has(compact))) {
    return true;
  }
  for (const keyword of LINE_ESCROW_COMMAND_KEYWORDS) {
    if (!keyword) continue;
    if (normalized.includes(keyword)) return true;
    if (compact && compact.includes(keyword)) return true;
  }
  return false;
};

const LINE_SCAM_RICH_MENU_COMMANDS = Object.freeze({
  HELP_WHEN_SCAMMED: 'คำแนะนำเมื่อถูกโกง',
  CHECK_SCAMMER: 'ตรวจสอบมิจฉาชีพ',
  CHECK_FAKE_NEWS: 'ตรวจสอบข่าวปลอม',
  ASSESS_RISK: 'ประเมินความเสี่ยง',
  HOW_TO_USE: 'เเนะนำวิธีการใช้งาน',
});
const LINE_SCAM_COMMAND_KEY_BY_TEXT = new Map([
  [LINE_SCAM_RICH_MENU_COMMANDS.HELP_WHEN_SCAMMED, 'help_when_scammed'],
  [LINE_SCAM_RICH_MENU_COMMANDS.CHECK_SCAMMER, 'check_scammer'],
  [LINE_SCAM_RICH_MENU_COMMANDS.CHECK_FAKE_NEWS, 'check_fake_news'],
  [LINE_SCAM_RICH_MENU_COMMANDS.ASSESS_RISK, 'assess_risk'],
  [LINE_SCAM_RICH_MENU_COMMANDS.HOW_TO_USE, 'how_to_use'],
  ['คำแนะนำเมื่อถือถูกโกง', 'help_when_scammed'],
  ['คำแนะนำเมื่อโดนโกง', 'help_when_scammed'],
  ['ขอคำแนะนำโกงออนไลน์', 'help_online_scam'],
  ['ดูขั้นตอนโกงออนไลน์', 'help_online_scam'],
  ['เลือกโกงออนไลน์', 'help_online_scam'],
  ['โกงออนไลน์', 'help_online_scam'],
  ['ขอคำแนะนำโกงคอลเซ็นเตอร์', 'help_call_center_scam'],
  ['ดูขั้นตอนคอลเซ็นเตอร์', 'help_call_center_scam'],
  ['เลือกโกงคอลเซ็นเตอร์', 'help_call_center_scam'],
  ['โกงคอลเซ็นเตอร์', 'help_call_center_scam'],
  ['โกงคอลเซนเตอร์', 'help_call_center_scam'],
  ['โกงคอลเวนเตอร์', 'help_call_center_scam'],
  ['แนะนำวิธีการใช้งาน', 'how_to_use'],
]);
const LINE_SCAM_LIFF_DEFAULT_PATHS = Object.freeze({
  scammerCheck: '/line/scam/liff/scammer-check',
  fakeNews: '/line/scam/liff/fake-news',
  riskAssess: '/line/scam/liff/risk-assess',
  policeStations: '/line/scam/liff/police-stations',
});

const resolveLineScamCommandKey = (textInput) => {
  const text = String(textInput || '').trim();
  if (!text) return '';
  return String(LINE_SCAM_COMMAND_KEY_BY_TEXT.get(text) || '').trim();
};

const resolveRequestOrigin = (req) => {
  const forwardedProtocol = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProtocol || String(req?.protocol || '').trim() || 'https';
  const host = String(req?.get?.('host') || '').trim();
  if (!host) return '';
  return `${protocol}://${host}`;
};

const addQueryParamToHttpUrl = (urlInput, key, value) => {
  const url = normalizeOptionalHttpUrl(urlInput || '', 1200);
  if (!url) return '';
  const queryValue = String(value || '').trim();
  if (!queryValue) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set(String(key || 'value').trim() || 'value', queryValue);
    return parsed.toString();
  } catch {
    return url;
  }
};

const normalizeOptionalHttpUrl = (valueInput, maxLength = 1200) => {
  const value = String(valueInput || '')
    .trim()
    .slice(0, Math.max(10, Number(maxLength || 1200)));
  if (!value) return '';
  return isSafeHttpUrl(value) ? value : null;
};

const normalizeLineScamBotConfigRecord = (recordInput) => {
  const record = recordInput && typeof recordInput === 'object' && !Array.isArray(recordInput) ? recordInput : {};
  return {
    liffScammerCheckUrl: String(record.liffScammerCheckUrl || '').trim(),
    liffFakeNewsUrl: String(record.liffFakeNewsUrl || '').trim(),
    liffRiskAssessUrl: String(record.liffRiskAssessUrl || '').trim(),
    richMenuId: String(record.richMenuId || '').trim(),
    updatedAt: String(record.updatedAt || '').trim() || null,
    updatedById: sanitizeUserId(record.updatedById),
    updatedByEmail: sanitizeEmail(record.updatedByEmail),
  };
};

const resolveLineScamLiffUrls = (req, configInput = {}) => {
  const config = normalizeLineScamBotConfigRecord(configInput);
  const requestOrigin = resolveRequestOrigin(req);
  const envScammerCheck = normalizeOptionalHttpUrl(LINE_SCAM_LIFF_SCAMMER_CHECK_URL);
  const envFakeNews = normalizeOptionalHttpUrl(LINE_SCAM_LIFF_FAKE_NEWS_URL);
  const envRiskAssess = normalizeOptionalHttpUrl(LINE_SCAM_LIFF_RISK_ASSESS_URL);
  const envPoliceStations = normalizeOptionalHttpUrl(LINE_SCAM_LIFF_POLICE_STATIONS_URL);
  const configuredScammerCheck = normalizeOptionalHttpUrl(config.liffScammerCheckUrl);
  const configuredFakeNews = normalizeOptionalHttpUrl(config.liffFakeNewsUrl);
  const configuredRiskAssess = normalizeOptionalHttpUrl(config.liffRiskAssessUrl);
  const buildDefaultUrl = (path) => {
    if (!requestOrigin) return '';
    return `${requestOrigin}${path}`;
  };

  return {
    scammerCheck:
      configuredScammerCheck ||
      envScammerCheck ||
      buildDefaultUrl(LINE_SCAM_LIFF_DEFAULT_PATHS.scammerCheck),
    fakeNews: configuredFakeNews || envFakeNews || buildDefaultUrl(LINE_SCAM_LIFF_DEFAULT_PATHS.fakeNews),
    riskAssess:
      configuredRiskAssess ||
      envRiskAssess ||
      buildDefaultUrl(LINE_SCAM_LIFF_DEFAULT_PATHS.riskAssess),
    policeStations: envPoliceStations || buildDefaultUrl(LINE_SCAM_LIFF_DEFAULT_PATHS.policeStations),
  };
};

const toLineScamBotPublicConfig = (req, configInput = {}) => {
  const normalized = normalizeLineScamBotConfigRecord(configInput);
  const liffUrls = resolveLineScamLiffUrls(req, normalized);
  return {
    webhookPath: '/line/scam/webhook',
    webhookUrl: `${resolveRequestOrigin(req)}/line/scam/webhook`,
    richMenuId: normalized.richMenuId,
    liffUrls,
    commandMap: {
      helpWhenScammed: LINE_SCAM_RICH_MENU_COMMANDS.HELP_WHEN_SCAMMED,
      checkScammer: LINE_SCAM_RICH_MENU_COMMANDS.CHECK_SCAMMER,
      checkFakeNews: LINE_SCAM_RICH_MENU_COMMANDS.CHECK_FAKE_NEWS,
      assessRisk: LINE_SCAM_RICH_MENU_COMMANDS.ASSESS_RISK,
      howToUse: LINE_SCAM_RICH_MENU_COMMANDS.HOW_TO_USE,
    },
    channelSecretConfigured: Boolean(LINE_SCAM_CHANNEL_SECRET),
    channelAccessTokenConfigured: Boolean(LINE_SCAM_CHANNEL_ACCESS_TOKEN),
    geminiConfigured: Boolean(GEMINI_API_KEY),
    geminiModel: GEMINI_MODEL,
    imageUploadMaxBytes: SCAM_LIFF_IMAGE_MAX_BYTES,
    imageUploadMaxCount: SCAM_LIFF_IMAGE_MAX_COUNT,
    updatedAt: normalized.updatedAt,
  };
};

const loadLineScamBotConfigRecord = async () => {
  const doc = await lineScamBotConfigDocRef.get();
  if (!doc.exists) return normalizeLineScamBotConfigRecord({});
  return normalizeLineScamBotConfigRecord(doc.data() || {});
};

const LINE_ESCROW_COMMAND_KEYWORDS = new Set([
  '\u0E40\u0E23\u0E34\u0E48\u0E21',
  '\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19',
  '\u0E40\u0E23\u0E34\u0E48\u0E21\u0E01\u0E25\u0E32\u0E07',
  '\u0E01\u0E25\u0E32\u0E07',
  '/start',
  'start',
  'escrow',
  'escrowbot',
]);
const LINE_ESCROW_LIFF_DEFAULT_PATHS = Object.freeze({
  deal: '/line/escrow/liff/deal',
  seller: '/line/escrow/liff/seller',
  buyer: '/line/escrow/liff/buyer',
});

const normalizeLineEscrowBotConfigRecord = (recordInput) => {
  const record = recordInput && typeof recordInput === 'object' && !Array.isArray(recordInput) ? recordInput : {};
  return {
    liffDealUrl: String(record.liffDealUrl || '').trim(),
    liffSellerUrl: String(record.liffSellerUrl || '').trim(),
    liffBuyerUrl: String(record.liffBuyerUrl || '').trim(),
    richMenuId: String(record.richMenuId || '').trim(),
    trackingCourierDefault: String(record.trackingCourierDefault || '').trim().slice(0, 120),
    updatedAt: String(record.updatedAt || '').trim() || null,
    updatedById: sanitizeUserId(record.updatedById),
    updatedByEmail: sanitizeEmail(record.updatedByEmail),
  };
};

const resolveLineEscrowLiffUrls = (req, configInput = {}) => {
  const config = normalizeLineEscrowBotConfigRecord(configInput);
  const requestOrigin = resolveRequestOrigin(req);
  const envDeal = normalizeOptionalHttpUrl(LINE_ESCROW_LIFF_DEAL_URL);
  const envSeller = normalizeOptionalHttpUrl(LINE_ESCROW_LIFF_SELLER_URL);
  const envBuyer = normalizeOptionalHttpUrl(LINE_ESCROW_LIFF_BUYER_URL);
  const configuredDeal = normalizeOptionalHttpUrl(config.liffDealUrl);
  const configuredSeller = normalizeOptionalHttpUrl(config.liffSellerUrl);
  const configuredBuyer = normalizeOptionalHttpUrl(config.liffBuyerUrl);
  const buildDefaultUrl = (path) => {
    if (!requestOrigin) return '';
    return `${requestOrigin}${path}`;
  };

  return {
    deal: configuredDeal || envDeal || buildDefaultUrl(LINE_ESCROW_LIFF_DEFAULT_PATHS.deal),
    seller: configuredSeller || envSeller || buildDefaultUrl(LINE_ESCROW_LIFF_DEFAULT_PATHS.seller),
    buyer: configuredBuyer || envBuyer || buildDefaultUrl(LINE_ESCROW_LIFF_DEFAULT_PATHS.buyer),
  };
};

const toLineEscrowBotPublicConfig = (req, configInput = {}) => {
  const normalized = normalizeLineEscrowBotConfigRecord(configInput);
  const liffUrls = resolveLineEscrowLiffUrls(req, normalized);
  const requestOrigin = resolveRequestOrigin(req);
  const webhookPath = LINE_ESCROW_SHARED_WITH_SCAM_CHANNEL ? '/line/scam/webhook' : '/line/escrow/webhook';
  return {
    webhookPath,
    webhookUrl: `${requestOrigin}${webhookPath}`,
    paymentWebhookPath: '/line/escrow/payment/webhook',
    paymentWebhookUrl: `${requestOrigin}/line/escrow/payment/webhook`,
    liffUrls,
    richMenuId: normalized.richMenuId,
    trackingCourierDefault: normalized.trackingCourierDefault,
    commandStart: 'เริ่ม',
    channelSecretConfigured: Boolean(LINE_ESCROW_EFFECTIVE_CHANNEL_SECRET),
    channelAccessTokenConfigured: Boolean(LINE_ESCROW_EFFECTIVE_CHANNEL_ACCESS_TOKEN),
    sharedChannelWithScam: LINE_ESCROW_SHARED_WITH_SCAM_CHANNEL,
    sharedChannelMode: LINE_ESCROW_USE_SCAM_CHANNEL ? 'forced' : 'auto',
    paymentProvider: LINE_ESCROW_PAYMENT_PROVIDER,
    paymentConfigured: Boolean(OPN_SECRET_KEY),
    paymentPublicKeyConfigured: Boolean(OPN_PUBLIC_KEY),
    trackingProvider: LINE_ESCROW_TRACKING_PROVIDER,
    trackingConfigured: Boolean(TRACKING_API_KEY),
    autoReleaseHours: LINE_ESCROW_AUTO_RELEASE_HOURS,
    slipUploadMaxBytes: LINE_ESCROW_SLIP_IMAGE_MAX_BYTES,
    slipUploadMaxCount: LINE_ESCROW_SLIP_IMAGE_MAX_COUNT,
    cronSecretConfigured: Boolean(LINE_ESCROW_CRON_SECRET),
    paymentWebhookSecretConfigured: Boolean(LINE_ESCROW_PAYMENT_WEBHOOK_SECRET),
    manualPaymentConfirmEnabled: LINE_ESCROW_MANUAL_PAYMENT_CONFIRM_ENABLED,
    updatedAt: normalized.updatedAt,
  };
};

const loadLineEscrowBotConfigRecord = async () => {
  const doc = await lineEscrowBotConfigDocRef.get();
  if (!doc.exists) return normalizeLineEscrowBotConfigRecord({});
  return normalizeLineEscrowBotConfigRecord(doc.data() || {});
};

const normalizeEscrowMoneySatang = (amountInput) => {
  const amount = Number(amountInput || 0);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.min(500_000_000, Math.round(amount * 100));
};

const toEscrowAmountThb = (satangInput) => {
  const satang = Number(satangInput || 0);
  if (!Number.isFinite(satang) || satang <= 0) return 0;
  return Math.round((satang / 100) * 100) / 100;
};

const normalizeEscrowSlipImage = (imageInput) => {
  const image = imageInput && typeof imageInput === 'object' && !Array.isArray(imageInput) ? imageInput : {};
  const id = String(image.id || crypto.randomUUID()).trim();
  const name = String(image.name || 'shipping-slip').trim().slice(0, 180);
  const mimeType = String(image.mimeType || image.type || '').trim().toLowerCase();
  const dataUrl = String(image.dataUrl || image.base64 || '').trim();
  const size = Number(image.size || 0);
  if (!id || !name || !mimeType || !dataUrl) return null;
  if (!mimeType.startsWith('image/')) return null;
  if (!/^data:image\//i.test(dataUrl)) return null;
  if (!Number.isFinite(size) || size <= 0 || size > LINE_ESCROW_SLIP_IMAGE_MAX_BYTES) return null;
  return {
    id,
    name,
    mimeType,
    size,
    dataUrl,
  };
};

const normalizeEscrowSlipImageList = (imagesInput, maxCount = LINE_ESCROW_SLIP_IMAGE_MAX_COUNT) => {
  const limit = Math.max(1, Math.min(10, Number(maxCount || LINE_ESCROW_SLIP_IMAGE_MAX_COUNT)));
  const source = Array.isArray(imagesInput) ? imagesInput : [];
  const normalized = source.map((image) => normalizeEscrowSlipImage(image)).filter(Boolean);
  return normalized.slice(0, limit);
};

const normalizeEscrowBankBrand = (bankInput) => {
  const raw = String(bankInput || '').trim().toLowerCase();
  if (!raw) return '';
  const key = raw.replace(/\s+/g, '').replace(/[^a-z0-9\u0E00-\u0E7F]/g, '');
  const mappings = [
    ['bbl', ['bbl', 'bangkokbank', 'bualuang', 'ธนาคารกรุงเทพ', 'กรุงเทพ', 'บัวหลวง']],
    ['kbank', ['kbank', 'kasikornbank', 'kasikorn', 'กสิกรไทย', 'ธนาคารกสิกรไทย', 'กสิกร']],
    ['ktb', ['ktb', 'krungthaibank', 'krungthai', 'กรุงไทย', 'ธนาคารกรุงไทย']],
    ['scb', ['scb', 'siamcommercialbank', 'siamcommercial', 'ไทยพาณิชย์', 'ไทยพานิชย์', 'ธนาคารไทยพาณิชย์']],
    ['bay', ['bay', 'krungsri', 'กรุงศรีอยุธยา', 'กรุงศรี', 'ธนาคารกรุงศรีอยุธยา']],
    ['ttb', ['ttb', 'tmbthanachart', 'tmb', 'thanachart', 'ทีทีบี', 'ทหารไทยธนชาต', 'ธนาคารทหารไทยธนชาต', 'ธนชาต']],
    ['gsb', ['gsb', 'governmentsavingsbank', 'ออมสิน', 'ธนาคารออมสิน']],
    ['baac', ['baac', 'ธกส', 'ธ.ก.ส', 'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร', 'เพื่อการเกษตร']],
    ['cimb', ['cimb', 'cimbthai', 'ซีไอเอ็มบี', 'ซีไอเอ็มบีไทย', 'ธนาคารซีไอเอ็มบี']],
    ['uob', ['uob', 'ยูโอบี', 'ธนาคารยูโอบี']],
    ['lhb', ['lhb', 'lhbank', 'แลนด์แอนด์เฮ้าส์', 'แลนด์แอนด์เฮาส์', 'แลนด์แอนด์เฮ้าส์แบงก์']],
  ];
  for (const [brand, aliases] of mappings) {
    if (
      aliases.some((alias) =>
        key.includes(
          String(alias || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[^a-z0-9\u0E00-\u0E7F]/g, '')
        )
      )
    ) {
      return brand;
    }
  }
  return '';
};

const ESCROW_PAYOUT_METHODS = new Set(['bank', 'promptpay']);

const normalizeEscrowPayoutMethod = (valueInput) => {
  const value = String(valueInput || '')
    .trim()
    .toLowerCase();
  return ESCROW_PAYOUT_METHODS.has(value) ? value : '';
};

const normalizeEscrowPromptpayNumber = (valueInput) =>
  String(valueInput || '')
    .replace(/[^0-9]/g, '')
    .trim()
    .slice(0, 20);

const isValidEscrowPromptpayNumber = (valueInput) =>
  /^(?:\d{10}|\d{13}|\d{15})$/.test(normalizeEscrowPromptpayNumber(valueInput));

const normalizeEscrowTrackingStatus = (statusInput) =>
  normalizeOptionalString(statusInput || '', 120)
    .trim()
    .toLowerCase();

const isEscrowTrackingDelivered = (statusInput) => {
  const status = normalizeEscrowTrackingStatus(statusInput);
  if (!status) return false;
  return ['delivered', 'signed', 'complete', 'completed', 'successful'].some((keyword) =>
    status.includes(keyword)
  );
};

const toEscrowDealResponse = (docId, dataInput) => {
  const data = dataInput && typeof dataInput === 'object' && !Array.isArray(dataInput) ? dataInput : {};
  const deliveredAtRaw = String(data.deliveredAt || '').trim();
  const deliveredAt = toEpochMs(deliveredAtRaw) > 0 ? deliveredAtRaw : null;
  const autoReleaseAtRaw = String(data.autoReleaseAt || '').trim();
  const autoReleaseAt = toEpochMs(autoReleaseAtRaw) > 0 ? autoReleaseAtRaw : null;
  const createdAtRaw = String(data.createdAt || '').trim();
  const createdAt = toEpochMs(createdAtRaw) > 0 ? createdAtRaw : null;
  const updatedAtRaw = String(data.updatedAt || '').trim();
  const updatedAt = toEpochMs(updatedAtRaw) > 0 ? updatedAtRaw : createdAt;
  const paymentAmountSatang = Number(data.paymentAmountSatang || 0) || 0;
  const payoutAmountSatang = Number(data.payoutAmountSatang || 0) || paymentAmountSatang;
  const trackingMapUrl = normalizeOptionalHttpUrl(data.trackingMapUrl || '', 1200) || '';
  const trackingPublicUrl = normalizeOptionalHttpUrl(data.trackingPublicUrl || '', 1200) || '';
  const sellerBankName = String(data.sellerBankName || '').trim();
  const sellerBankBrand = String(data.sellerBankBrand || '').trim();
  const sellerBankAccount = String(data.sellerBankAccount || '').trim();
  const sellerBankAccountName = String(data.sellerBankAccountName || '').trim();
  const sellerPromptpayNumber = normalizeEscrowPromptpayNumber(data.sellerPromptpayNumber || '');
  const sellerPayoutMethodRaw = normalizeEscrowPayoutMethod(data.sellerPayoutMethod || '');
  const sellerPayoutMethod = sellerPayoutMethodRaw || (sellerPromptpayNumber ? 'promptpay' : 'bank');
  const shippingSlipImages = normalizeEscrowSlipImageList(
    Array.isArray(data.shippingSlipImages)
      ? data.shippingSlipImages
      : data.shippingSlipImage
        ? [data.shippingSlipImage]
        : []
  );
  const shippingSlipImage = shippingSlipImages[0] || null;
  return {
    id: String(docId || '').trim(),
    groupId: String(data.groupId || '').trim(),
    status: String(data.status || 'created').trim().toLowerCase() || 'created',
    itemName: String(data.itemName || '').trim(),
    productDetails: String(data.productDetails || data.itemName || '').trim(),
    note: String(data.note || '').trim(),
    buyerName: String(data.buyerName || '').trim(),
    buyerContactPhone: String(data.buyerContactPhone || data.buyerName || '').trim(),
    buyerLineUserId: String(data.buyerLineUserId || '').trim(),
    sellerName: String(data.sellerName || '').trim(),
    sellerContactPhone: String(data.sellerContactPhone || data.sellerName || '').trim(),
    sellerLineUserId: String(data.sellerLineUserId || '').trim(),
    paymentProvider: String(data.paymentProvider || LINE_ESCROW_PAYMENT_PROVIDER).trim().toLowerCase(),
    paymentStatus: String(data.paymentStatus || 'pending').trim().toLowerCase(),
    paymentChargeId: String(data.paymentChargeId || '').trim(),
    paymentQrImageUrl: normalizeOptionalHttpUrl(data.paymentQrImageUrl || '', 1200) || '',
    paymentAmountThb: toEscrowAmountThb(paymentAmountSatang),
    paymentAmountSatang,
    paidAt: toEpochMs(data.paidAt) > 0 ? String(data.paidAt).trim() : null,
    paymentManualConfirmedAt:
      toEpochMs(data.paymentManualConfirmedAt) > 0 ? String(data.paymentManualConfirmedAt).trim() : null,
    paymentManualConfirmedSource: String(data.paymentManualConfirmedSource || '').trim(),
    shipmentStatus: String(data.shipmentStatus || 'pending').trim().toLowerCase(),
    courierCode: String(data.courierCode || '').trim(),
    trackingNumber: String(data.trackingNumber || '').trim(),
    shippingSlipImage,
    shippingSlipImages,
    shippingSubmittedAt: toEpochMs(data.shippingSubmittedAt) > 0 ? String(data.shippingSubmittedAt).trim() : null,
    trackingStatus: String(data.trackingStatus || '').trim(),
    trackingStatusText: String(data.trackingStatusText || '').trim(),
    trackingLastEventTime: toEpochMs(data.trackingLastEventTime) > 0 ? String(data.trackingLastEventTime).trim() : null,
    trackingLastEventLocation: String(data.trackingLastEventLocation || '').trim(),
    trackingLastEventDescription: String(data.trackingLastEventDescription || '').trim(),
    trackingMapUrl,
    trackingPublicUrl,
    deliveredAt,
    autoReleaseAt,
    confirmedAt: toEpochMs(data.confirmedAt) > 0 ? String(data.confirmedAt).trim() : null,
    payoutStatus: String(data.payoutStatus || 'pending').trim().toLowerCase(),
    payoutTransferId: String(data.payoutTransferId || '').trim(),
    payoutRecipientId: String(data.payoutRecipientId || '').trim(),
    payoutAmountThb: toEscrowAmountThb(payoutAmountSatang),
    payoutAmountSatang,
    payoutReleasedAt: toEpochMs(data.payoutReleasedAt) > 0 ? String(data.payoutReleasedAt).trim() : null,
    payoutFailedReason: String(data.payoutFailedReason || '').trim(),
    paidStepCardSentAt: toEpochMs(data.paidStepCardSentAt) > 0 ? String(data.paidStepCardSentAt).trim() : null,
    sellerPayoutMethod,
    sellerPromptpayNumber,
    sellerBankName,
    sellerBankBrand,
    sellerBankAccount,
    sellerBankAccountName,
    createdAt,
    updatedAt,
  };
};

const callOpnApi = async ({
  path,
  method = 'GET',
  formData = null,
}) => {
  if (!OPN_SECRET_KEY) {
    const error = new Error('OPN_SECRET_KEY is not configured on server.');
    error.status = 503;
    throw error;
  }
  const requestUrl = `${OPN_API_BASE_URL.replace(/\/+$/, '')}${String(path || '')}`;
  const headers = {
    Authorization: `Basic ${Buffer.from(`${OPN_SECRET_KEY}:`).toString('base64')}`,
  };
  let body = undefined;
  if (formData && typeof formData === 'object') {
    const params = new URLSearchParams();
    Object.entries(formData).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      params.set(String(key), String(value));
    });
    body = params.toString();
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }
  const response = await fetch(requestUrl, {
    method,
    headers,
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      normalizeOptionalString(payload?.message || payload?.failure_message || `OPN API failed (${response.status})`, 500)
    );
    error.status = response.status;
    throw error;
  }
  return payload;
};

const createEscrowPromptpayCharge = async ({
  dealId,
  amountSatang,
  itemName,
  groupId,
}) => {
  if (LINE_ESCROW_PAYMENT_PROVIDER !== 'opn') {
    const error = new Error('Unsupported LINE_ESCROW_PAYMENT_PROVIDER. Supported: opn');
    error.status = 400;
    throw error;
  }
  const payload = await callOpnApi({
    path: '/charges',
    method: 'POST',
    formData: {
      amount: amountSatang,
      currency: 'thb',
      description: normalizeOptionalString(itemName || `Escrow ${dealId}`, 180),
      'source[type]': 'promptpay',
      'metadata[deal_id]': dealId,
      'metadata[group_id]': groupId,
    },
  });
  const source = payload?.source && typeof payload.source === 'object' ? payload.source : {};
  const scannableCode = source?.scannable_code && typeof source.scannable_code === 'object' ? source.scannable_code : {};
  const image = scannableCode?.image && typeof scannableCode.image === 'object' ? scannableCode.image : {};
  return {
    chargeId: String(payload?.id || '').trim(),
    chargeStatus: String(payload?.status || '').trim().toLowerCase(),
    qrImageUrl:
      normalizeOptionalHttpUrl(image?.download_uri || image?.url || payload?.qr_code_url || '', 1200) || '',
    expiresAt: String(payload?.expires_at || '').trim() || null,
  };
};

const readEscrowChargeStatus = async (chargeIdInput) => {
  const chargeId = String(chargeIdInput || '').trim();
  if (!chargeId) {
    const error = new Error('chargeId is required.');
    error.status = 400;
    throw error;
  }
  const payload = await callOpnApi({
    path: `/charges/${encodeURIComponent(chargeId)}`,
    method: 'GET',
  });
  const source = payload?.source && typeof payload.source === 'object' ? payload.source : {};
  const scannableCode = source?.scannable_code && typeof source.scannable_code === 'object' ? source.scannable_code : {};
  const image = scannableCode?.image && typeof scannableCode.image === 'object' ? scannableCode.image : {};
  const status = String(payload?.status || '').trim().toLowerCase();
  return {
    chargeId,
    status,
    paid: status === 'successful',
    paidAt: toEpochMs(payload?.paid_at) > 0 ? String(payload.paid_at).trim() : null,
    qrImageUrl:
      normalizeOptionalHttpUrl(image?.download_uri || image?.url || payload?.qr_code_url || '', 1200) || '',
    failureMessage: String(payload?.failure_message || '').trim(),
  };
};

const createEscrowRecipient = async ({
  sellerName,
  sellerBankBrand,
  sellerBankAccount,
  sellerBankAccountName,
}) => {
  const payload = await callOpnApi({
    path: '/recipients',
    method: 'POST',
    formData: {
      name: normalizeOptionalString(sellerName || sellerBankAccountName || 'Escrow Seller', 120),
      type: 'individual',
      'bank_account[brand]': sellerBankBrand,
      'bank_account[number]': sellerBankAccount,
      'bank_account[name]': normalizeOptionalString(sellerBankAccountName || sellerName || 'Seller', 120),
      description: 'LINE escrow payout recipient',
    },
  });
  return {
    recipientId: String(payload?.id || '').trim(),
    active: payload?.active === true,
  };
};

const createEscrowTransfer = async ({
  amountSatang,
  recipientId,
}) => {
  const payload = await callOpnApi({
    path: '/transfers',
    method: 'POST',
    formData: {
      amount: amountSatang,
      currency: 'thb',
      recipient: recipientId,
    },
  });
  return {
    transferId: String(payload?.id || '').trim(),
    sent: payload?.sent === true,
  };
};

const findLatestTrackingEvent = (eventsInput) => {
  const events = Array.isArray(eventsInput) ? eventsInput : [];
  const normalized = events
    .map((eventInput) => {
      const event = eventInput && typeof eventInput === 'object' && !Array.isArray(eventInput) ? eventInput : {};
      const timeText = String(
        event.date ||
          event.time ||
          event.occurred_at ||
          event.latest_event_time ||
          event.EventDate ||
          event.created_at ||
          ''
      ).trim();
      const location = String(event.location || event.city || event.Location || event.checkpoint_location || '').trim();
      const description = String(
        event.description || event.status || event.EventDescription || event.checkpoint_status || ''
      ).trim();
      const timestamp = toEpochMs(timeText);
      return {
        timeText: timestamp > 0 ? new Date(timestamp).toISOString() : '',
        location,
        description,
        timestamp,
      };
    })
    .filter((event) => event.timestamp > 0 || event.location || event.description)
    .sort((left, right) => right.timestamp - left.timestamp);
  return normalized[0] || null;
};

const queryEscrowTrackingStatus = async ({
  trackingNumber,
  courierCode = '',
}) => {
  const normalizedTrackingNumber = String(trackingNumber || '').trim();
  const normalizedCourierCode = String(courierCode || '').trim();
  if (!normalizedTrackingNumber) {
    const error = new Error('trackingNumber is required.');
    error.status = 400;
    throw error;
  }
  if (!TRACKING_API_KEY) {
    const error = new Error('TRACKING_API_KEY is not configured on server.');
    error.status = 503;
    throw error;
  }
  const response = await fetch(`${TRACKING_API_BASE_URL.replace(/\/+$/, '')}/trackings/realtime`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Tracking-Api-Key': TRACKING_API_KEY,
      'tracking-api-key': TRACKING_API_KEY,
      'x-api-key': TRACKING_API_KEY,
    },
    body: JSON.stringify({
      tracking_number: normalizedTrackingNumber,
      courier_code: normalizedCourierCode || undefined,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      normalizeOptionalString(
        payload?.message || payload?.meta?.message || `Tracking API failed (${response.status})`,
        400
      )
    );
    error.status = response.status;
    throw error;
  }
  const container = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const item =
    (Array.isArray(container?.items) ? container.items[0] : null) ||
    (Array.isArray(container?.trackings) ? container.trackings[0] : null) ||
    (Array.isArray(container) ? container[0] : null) ||
    container;
  const trackingItem = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
  const statusText =
    normalizeOptionalString(
      trackingItem.delivery_status ||
        trackingItem.status ||
        trackingItem.tag ||
        trackingItem.state ||
        trackingItem.latest_status ||
        '',
      140
    ) || 'unknown';
  const eventList =
    trackingItem.origin_info?.trackinfo ||
    trackingItem.events ||
    trackingItem.checkpoints ||
    trackingItem.track_info ||
    [];
  const latestEvent = findLatestTrackingEvent(eventList);
  const location = String(
    latestEvent?.location ||
      trackingItem.latest_event_location ||
      trackingItem.latest_location ||
      trackingItem.location ||
      ''
  ).trim();
  const description = String(
    latestEvent?.description ||
      trackingItem.latest_event_description ||
      trackingItem.latest_status_description ||
      ''
  ).trim();
  const mapUrl = location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
    : '';
  const delivered =
    trackingItem.delivered === true ||
    isEscrowTrackingDelivered(statusText) ||
    isEscrowTrackingDelivered(description);

  return {
    provider: LINE_ESCROW_TRACKING_PROVIDER,
    trackingNumber: normalizedTrackingNumber,
    courierCode: normalizedCourierCode,
    statusText,
    delivered,
    lastEventTime: latestEvent?.timeText || '',
    lastEventLocation: location,
    lastEventDescription: description,
    mapUrl,
    publicUrl: `https://www.17track.net/en/track?nums=${encodeURIComponent(normalizedTrackingNumber)}`,
    raw: payload,
  };
};

const buildLineEscrowMainMenuFlexMessage = ({ liffUrlsInput = {}, stage = 'all' } = {}) => {
  const liffUrls =
    liffUrlsInput && typeof liffUrlsInput === 'object' && !Array.isArray(liffUrlsInput) ? liffUrlsInput : {};
  const dealUrl = normalizeOptionalHttpUrl(liffUrls.deal || '', 1000);
  const sellerUrl = normalizeOptionalHttpUrl(liffUrls.seller || '', 1000);
  const buyerUrl = normalizeOptionalHttpUrl(liffUrls.buyer || '', 1000);
  const currentStage = normalizeOptionalString(stage || '', 40).toLowerCase() || 'all';
  const isStartStage = currentStage === 'start';
  const footerButtons = [];

  const buildStepCard = (stepText, stepNumber) => ({
    type: 'box',
    layout: 'horizontal',
    spacing: '10px',
    paddingAll: '10px',
    cornerRadius: '12px',
    borderWidth: '1px',
    borderColor: '#cbd5e1',
    backgroundColor: '#f1f5f9',
    contents: [
      {
        type: 'box',
        layout: 'vertical',
        width: '24px',
        height: '24px',
        flex: 0,
        justifyContent: 'center',
        alignItems: 'center',
        cornerRadius: '100px',
        backgroundColor: '#16a34a',
        contents: [
          {
            type: 'text',
            text: String(stepNumber),
            size: 'xs',
            weight: 'bold',
            color: '#ffffff',
            align: 'center',
          },
        ],
      },
      {
        type: 'text',
        text: stepText,
        size: 'sm',
        weight: 'bold',
        color: '#0f172a',
        wrap: true,
        flex: 1,
      },
    ],
  });

  if (dealUrl) {
    footerButtons.push({
      type: 'button',
      style: 'primary',
      color: '#16a34a',
      action: { type: 'uri', label: '\u0e40\u0e23\u0e34\u0e48\u0e21\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e14\u0e34\u0e25', uri: dealUrl },
    });
  }
  if (!isStartStage && sellerUrl) {
    footerButtons.push({
      type: 'button',
      style: 'primary',
      color: '#15803d',
      action: { type: 'uri', label: '\u0e1c\u0e39\u0e49\u0e02\u0e32\u0e22\u0e2a\u0e48\u0e07\u0e1e\u0e31\u0e2a\u0e14\u0e38', uri: sellerUrl },
    });
  }
  if (!isStartStage && buyerUrl) {
    footerButtons.push({
      type: 'button',
      style: 'primary',
      color: '#047857',
      action: {
        type: 'uri',
        label: '\u0e1c\u0e39\u0e49\u0e0b\u0e37\u0e49\u0e2d\u0e40\u0e0a\u0e47\u0e01\u0e41\u0e25\u0e30\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e23\u0e31\u0e1a\u0e02\u0e2d\u0e07',
        uri: buyerUrl,
      },
    });
  }
  if (footerButtons.length === 0) {
    footerButtons.push({
      type: 'text',
      text: '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e15\u0e31\u0e49\u0e07\u0e04\u0e48\u0e32 LIFF URL \u0e01\u0e23\u0e38\u0e13\u0e32\u0e43\u0e2b\u0e49\u0e41\u0e2d\u0e14\u0e21\u0e34\u0e19\u0e15\u0e31\u0e49\u0e07\u0e04\u0e48\u0e32\u0e43\u0e19 LINE Bot Admin',
      size: 'xs',
      color: '#991b1b',
      wrap: true,
    });
  }

  return {
    type: 'flex',
    altText: '\u0e40\u0e21\u0e19\u0e39\u0e1a\u0e2d\u0e17\u0e15\u0e31\u0e27\u0e01\u0e25\u0e32\u0e07\u0e0b\u0e37\u0e49\u0e2d\u0e02\u0e32\u0e22',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: '10px',
        contents: [
          {
            type: 'text',
            text: 'LINE \u0e1a\u0e2d\u0e17\u0e15\u0e31\u0e27\u0e01\u0e25\u0e32\u0e07\u0e0b\u0e37\u0e49\u0e2d\u0e02\u0e32\u0e22',
            weight: 'bold',
            size: 'lg',
            color: '#111827',
            wrap: true,
          },
          {
            type: 'text',
            text: '\u0e23\u0e30\u0e1a\u0e1a\u0e15\u0e31\u0e27\u0e0a\u0e48\u0e27\u0e22\u0e1b\u0e49\u0e2d\u0e07\u0e01\u0e31\u0e19\u0e01\u0e32\u0e23\u0e42\u0e01\u0e07\u0e40\u0e07\u0e34\u0e19\u0e08\u0e30\u0e16\u0e39\u0e01\u0e40\u0e01\u0e49\u0e1a\u0e44\u0e27\u0e49\u0e08\u0e19\u0e01\u0e27\u0e48\u0e32\u0e08\u0e30\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32',
            size: 'sm',
            color: '#334155',
            wrap: true,
          },
          {
            type: 'text',
            text: '\u0e02\u0e31\u0e49\u0e19\u0e15\u0e2d\u0e19\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19',
            size: 'xs',
            weight: 'bold',
            color: '#475569',
          },
          buildStepCard('\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e14\u0e35\u0e25', 1),
          buildStepCard('\u0e1c\u0e39\u0e49\u0e0b\u0e37\u0e49\u0e2d\u0e0a\u0e33\u0e23\u0e30\u0e40\u0e07\u0e34\u0e19', 2),
          buildStepCard('\u0e23\u0e30\u0e1a\u0e1a\u0e40\u0e01\u0e47\u0e1a\u0e23\u0e31\u0e01\u0e29\u0e32\u0e40\u0e07\u0e34\u0e19', 3),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: '8px',
        contents: footerButtons,
      },
    },
  };
};
const buildLineEscrowTrackingArrivedFlexMessage = (dealInput) => {
  const deal = dealInput && typeof dealInput === 'object' && !Array.isArray(dealInput) ? dealInput : {};
  const amountThb = toEscrowAmountThb(deal.paymentAmountSatang || 0);
  const buyerUrl = normalizeOptionalHttpUrl(deal.buyerLiffUrl || '', 1200);
  return {
    type: 'flex',
    altText: `พัสดุดีล ${String(deal.id || '').trim()} ถึงปลายทางแล้ว`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: '10px',
        contents: [
          {
            type: 'text',
            text: 'พัสดุถึงปลายทางแล้ว',
            weight: 'bold',
            size: 'lg',
            color: '#166534',
          },
          {
            type: 'text',
            text: `ดีล: ${String(deal.id || '-').trim()}`,
            size: 'sm',
            color: '#334155',
            wrap: true,
          },
          {
            type: 'text',
            text: `สินค้า: ${normalizeOptionalString(deal.itemName || '-', 80)}`,
            size: 'sm',
            color: '#334155',
            wrap: true,
          },
          {
            type: 'text',
            text: `ยอดคุ้มครอง: ${Number(amountThb || 0).toLocaleString()} THB`,
            size: 'sm',
            color: '#334155',
            wrap: true,
          },
          {
            type: 'text',
            text: `กรุณากดยืนยันรับของภายใน ${LINE_ESCROW_AUTO_RELEASE_HOURS} ชั่วโมง ไม่เช่นนั้นระบบจะยืนยันอัตโนมัติ`,
            size: 'xs',
            color: '#6b7280',
            wrap: true,
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: '8px',
        contents: buyerUrl
          ? [
              {
                type: 'button',
                style: 'primary',
                color: '#7c3aed',
                action: {
                  type: 'uri',
                  label: 'เปิดหน้ายืนยันรับของ',
                  uri: buyerUrl,
                },
              },
            ]
          : [
              {
                type: 'text',
                text: 'ไม่พบ LIFF URL สำหรับผู้ซื้อ',
                size: 'xs',
                color: '#991b1b',
                wrap: true,
              },
            ],
      },
    },
  };
};

const buildLineEscrowPaymentSuccessFlexMessage = (dealInput) => {
  const deal = dealInput && typeof dealInput === 'object' && !Array.isArray(dealInput) ? dealInput : {};
  const sellerLiffUrl = normalizeOptionalHttpUrl(deal.sellerLiffUrl || '', 1200);
  const safeDealId = normalizeOptionalString(deal.id || '', 180);
  const footerButtons = [];

  if (safeDealId) {
    footerButtons.push({
      type: 'button',
      style: 'secondary',
      color: '#e0e7ff',
      action: {
        type: 'clipboard',
        label: '\u0E04\u0E31\u0E14\u0E25\u0E2D\u0E01\u0E23\u0E2B\u0E31\u0E2A\u0E14\u0E35\u0E25',
        clipboardText: safeDealId,
      },
    });
  }

  if (sellerLiffUrl) {
    footerButtons.push({
      type: 'button',
      style: 'primary',
      color: '#0f766e',
      action: {
        type: 'uri',
        label: 'Open Seller LIFF',
        uri: sellerLiffUrl,
      },
    });
  } else {
    footerButtons.push({
      type: 'text',
      text: 'Seller LIFF URL is not configured yet.',
      size: 'xs',
      color: '#991b1b',
      wrap: true,
    });
  }

  return {
    type: 'flex',
    altText: 'Deal ' + String(deal.id || '').trim() + ' paid',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: '8px',
        contents: [
          { type: 'text', text: 'Payment completed', size: 'lg', weight: 'bold', color: '#166534' },
          { type: 'text', text: 'Deal: ' + String(deal.id || '-').trim(), size: 'sm', color: '#334155' },
          {
            type: 'text',
            text:
              'Protected amount ' +
              Number(toEscrowAmountThb(deal.paymentAmountSatang || 0)).toLocaleString() +
              ' THB',
            size: 'sm',
            color: '#334155',
            wrap: true,
          },
          {
            type: 'text',
            text: 'Next step: seller submits tracking number and shipping slip in seller LIFF page.',
            size: 'xs',
            color: '#6b7280',
            wrap: true,
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: '8px',
        contents: footerButtons,
      },
    },
  };
};

const markEscrowDealPaidWaitingShipment = async ({ dealRef, dealInput, manualConfirmed = false, manualSource = '' }) => {
  const deal = dealInput && typeof dealInput === 'object' && !Array.isArray(dealInput) ? dealInput : {};
  if (!dealRef || typeof dealRef.set !== 'function') {
    const error = new Error('dealRef is required.');
    error.status = 500;
    throw error;
  }
  const nowIso = new Date().toISOString();
  const patch = {
    paymentStatus: 'paid',
    status: 'paid_waiting_shipment',
    shipmentStatus: 'pending',
    paidAt: normalizeOptionalString(deal.paidAt || nowIso, 60) || nowIso,
    updatedAt: nowIso,
  };
  if (manualConfirmed) {
    patch.paymentManualConfirmedAt = nowIso;
    patch.paymentManualConfirmedSource = normalizeOptionalString(manualSource || 'liff_manual_confirm', 80);
  }
  await dealRef.set(patch, { merge: true });
  return {
    ...deal,
    ...patch,
  };
};

const sendEscrowPaidStepCardIfNeeded = async ({ req, dealInput, configInput = null, force = false } = {}) => {
  const deal = dealInput && typeof dealInput === 'object' && !Array.isArray(dealInput) ? dealInput : {};
  const dealId = String(deal.id || '').trim();
  const groupId = String(deal.groupId || '').trim();
  const paymentStatus = String(deal.paymentStatus || '').trim().toLowerCase();
  if (!dealId || !groupId || paymentStatus !== 'paid') return deal;
  if (!force && toEpochMs(deal.paidStepCardSentAt) > 0) return deal;

  const config = configInput || (await loadLineEscrowBotConfigRecord());
  const dealWithLiff = buildEscrowDealQueryWithLiffUrls(req, deal, config);
  try {
    await sendLinePushMessage({
      channelAccessToken: LINE_ESCROW_EFFECTIVE_CHANNEL_ACCESS_TOKEN,
      to: groupId,
      messages: [buildLineEscrowPaymentSuccessFlexMessage(dealWithLiff)],
    });
    const nowIso = new Date().toISOString();
    await lineEscrowDealRef.doc(dealId).set(
      {
        paidStepCardSentAt: nowIso,
        updatedAt: nowIso,
      },
      { merge: true }
    );
    return {
      ...dealWithLiff,
      paidStepCardSentAt: nowIso,
      updatedAt: nowIso,
    };
  } catch (error) {
    console.warn(`Failed to push paid step card for deal ${dealId}:`, error.message);
    return dealWithLiff;
  }
};

const isEscrowDealAwaitingPayment = (dealInput) => {
  const deal = dealInput && typeof dealInput === 'object' && !Array.isArray(dealInput) ? dealInput : {};
  const status = String(deal.status || '').trim().toLowerCase();
  const paymentStatus = String(deal.paymentStatus || '').trim().toLowerCase();
  return status === 'awaiting_payment' && paymentStatus !== 'paid' && paymentStatus !== 'cancelled';
};

const loadLatestEscrowAwaitingPaymentDealByGroup = async (groupIdInput) => {
  const groupId = normalizeOptionalString(groupIdInput || '', 120);
  if (!groupId) return null;
  const snapshot = await lineEscrowDealRef.where('groupId', '==', groupId).get();
  if (snapshot.empty) return null;
  const candidates = snapshot.docs
    .map((doc) => ({
      ref: lineEscrowDealRef.doc(doc.id),
      deal: toEscrowDealResponse(doc.id, doc.data() || {}),
    }))
    .filter((entry) => isEscrowDealAwaitingPayment(entry.deal));
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    const aScore = Math.max(toEpochMs(a.deal.updatedAt), toEpochMs(a.deal.createdAt));
    const bScore = Math.max(toEpochMs(b.deal.updatedAt), toEpochMs(b.deal.createdAt));
    if (bScore !== aScore) return bScore - aScore;
    return String(b.deal.id || '').localeCompare(String(a.deal.id || ''));
  });
  return candidates[0];
};

const loadEscrowDealWithRef = async (dealIdInput) => {
  const dealId = String(dealIdInput || '').trim();
  if (!dealId) return null;
  const ref = lineEscrowDealRef.doc(dealId);
  const doc = await ref.get();
  if (!doc.exists) return null;
  return {
    ref,
    deal: toEscrowDealResponse(doc.id, doc.data() || {}),
  };
};

const buildEscrowDealQueryWithLiffUrls = (req, dealInput, configInput = {}) => {
  const deal = dealInput && typeof dealInput === 'object' && !Array.isArray(dealInput) ? dealInput : {};
  const liffUrls = resolveLineEscrowLiffUrls(req, configInput);
  const id = String(deal.id || '').trim();
  const appendDealId = (urlInput) => {
    const url = normalizeOptionalHttpUrl(urlInput || '', 1200);
    if (!url || !id) return url || '';
    try {
      const parsed = new URL(url);
      parsed.searchParams.set('dealId', id);
      return parsed.toString();
    } catch {
      return url;
    }
  };
  return {
    ...deal,
    sellerLiffUrl: appendDealId(liffUrls.seller),
    buyerLiffUrl: appendDealId(liffUrls.buyer),
    dealLiffUrl: appendDealId(liffUrls.deal),
  };
};

const refreshEscrowDealPaymentStatus = async (dealInput) => {
  const deal = dealInput && typeof dealInput === 'object' && !Array.isArray(dealInput) ? dealInput : {};
  const chargeId = String(deal.paymentChargeId || '').trim();
  if (!chargeId || LINE_ESCROW_PAYMENT_PROVIDER !== 'opn' || !OPN_SECRET_KEY) {
    return deal;
  }
  const charge = await readEscrowChargeStatus(chargeId);
  const nowIso = new Date().toISOString();
  const paymentStatus = charge.paid ? 'paid' : charge.status || 'pending';
  const patch = {
    paymentStatus,
    paymentUpdatedAt: nowIso,
    paymentQrImageUrl: charge.qrImageUrl || String(deal.paymentQrImageUrl || '').trim(),
    paidAt: charge.paidAt || deal.paidAt || null,
    updatedAt: nowIso,
  };
  await lineEscrowDealRef.doc(String(deal.id || '').trim()).set(patch, { merge: true });
  return {
    ...deal,
    ...patch,
  };
};

const releaseEscrowDealPayout = async ({
  dealInput,
  reason = 'buyer_confirmed',
}) => {
  const deal = dealInput && typeof dealInput === 'object' && !Array.isArray(dealInput) ? dealInput : {};
  const dealId = String(deal.id || '').trim();
  if (!dealId) {
    const error = new Error('dealId is required.');
    error.status = 400;
    throw error;
  }
  if (String(deal.paymentStatus || '').trim().toLowerCase() !== 'paid') {
    const error = new Error('Payment is not completed yet.');
    error.status = 400;
    throw error;
  }
  if (String(deal.payoutStatus || '').trim().toLowerCase() === 'released') {
    return {
      ok: true,
      deal: deal,
      transferId: String(deal.payoutTransferId || '').trim(),
    };
  }
  if (LINE_ESCROW_PAYMENT_PROVIDER !== 'opn') {
    const error = new Error('Unsupported payment provider for payout release.');
    error.status = 400;
    throw error;
  }
  const amountSatang = Number(deal.payoutAmountSatang || deal.paymentAmountSatang || 0);
  if (!Number.isFinite(amountSatang) || amountSatang <= 0) {
    const error = new Error('Invalid payout amount.');
    error.status = 400;
    throw error;
  }
  const markManualRequired = async (reasonTextInput, extraPatchInput = {}) => {
    const nowIso = new Date().toISOString();
    const patch = {
      payoutStatus: 'manual_required',
      payoutFailedReason: normalizeOptionalString(reasonTextInput || 'Auto payout is not available.', 320),
      updatedAt: nowIso,
      ...extraPatchInput,
    };
    await lineEscrowDealRef.doc(dealId).set(patch, { merge: true });
    return {
      ok: false,
      manualRequired: true,
      deal: {
        ...deal,
        ...patch,
      },
      transferId: '',
    };
  };
  const sellerPayoutMethod = normalizeEscrowPayoutMethod(deal.sellerPayoutMethod || '') || 'bank';
  if (sellerPayoutMethod !== 'bank' && sellerPayoutMethod !== 'promptpay') {
    return markManualRequired(`Auto payout is not supported for method: ${sellerPayoutMethod}`);
  }
  const sellerBankBrand =
    String(deal.sellerBankBrand || '').trim().toLowerCase() || normalizeEscrowBankBrand(deal.sellerBankName);
  const sellerBankAccount =
    sellerPayoutMethod === 'promptpay'
      ? normalizeEscrowPromptpayNumber(deal.sellerPromptpayNumber || deal.sellerBankAccount || '')
      : String(deal.sellerBankAccount || '').replace(/[^0-9]/g, '').trim();
  const sellerBankAccountName = String(deal.sellerBankAccountName || deal.sellerName || '').trim();
  if (!sellerBankBrand || !sellerBankAccount || !sellerBankAccountName) {
    return markManualRequired(
      sellerPayoutMethod === 'promptpay'
        ? 'PromptPay auto payout information is incomplete.'
        : 'Seller payout bank information is incomplete.'
    );
  }

  let recipientId = String(deal.payoutRecipientId || '').trim();
  try {
    if (!recipientId) {
      const recipient = await createEscrowRecipient({
        sellerName: deal.sellerName,
        sellerBankBrand,
        sellerBankAccount,
        sellerBankAccountName,
      });
      recipientId = recipient.recipientId;
      if (!recipientId) {
        const error = new Error('Failed to create payout recipient.');
        error.status = 502;
        throw error;
      }
    }

    const transfer = await createEscrowTransfer({
      amountSatang,
      recipientId,
    });
    const nowIso = new Date().toISOString();
    const patch = {
      status: 'released',
      payoutStatus: 'released',
      payoutTransferId: transfer.transferId,
      payoutRecipientId: recipientId,
      payoutReleasedAt: nowIso,
      payoutFailedReason: '',
      releasedReason: normalizeOptionalString(reason || '', 80),
      updatedAt: nowIso,
    };
    await lineEscrowDealRef.doc(dealId).set(patch, { merge: true });
    return {
      ok: true,
      deal: {
        ...deal,
        ...patch,
      },
      transferId: transfer.transferId,
    };
  } catch (error) {
    return markManualRequired(error?.message || 'Auto payout failed.', {
      payoutRecipientId: recipientId || String(deal.payoutRecipientId || '').trim(),
    });
  }
};

const refreshEscrowDealTrackingStatus = async ({
  dealInput,
  req,
  configInput = {},
  notifyDelivered = false,
}) => {
  const deal = dealInput && typeof dealInput === 'object' && !Array.isArray(dealInput) ? dealInput : {};
  const dealId = String(deal.id || '').trim();
  if (!dealId) {
    const error = new Error('dealId is required.');
    error.status = 400;
    throw error;
  }
  const trackingNumber = String(deal.trackingNumber || '').trim();
  if (!trackingNumber) {
    const error = new Error('trackingNumber is missing.');
    error.status = 400;
    throw error;
  }
  const tracking = await queryEscrowTrackingStatus({
    trackingNumber,
    courierCode: String(deal.courierCode || '').trim(),
  });
  const nowIso = new Date().toISOString();
  const deliveredBefore = toEpochMs(deal.deliveredAt) > 0;
  const deliveredNow = tracking.delivered === true;
  const nextStatus = deliveredNow ? 'delivered_waiting_confirmation' : 'shipped';
  const autoReleaseAtIso = deliveredNow
    ? new Date(Date.now() + LINE_ESCROW_AUTO_RELEASE_HOURS * 60 * 60 * 1000).toISOString()
    : null;
  const patch = {
    shipmentStatus: nextStatus,
    status: nextStatus,
    trackingStatus: String(tracking.statusText || '').trim(),
    trackingStatusText: String(tracking.statusText || '').trim(),
    trackingLastEventTime: String(tracking.lastEventTime || '').trim(),
    trackingLastEventLocation: String(tracking.lastEventLocation || '').trim(),
    trackingLastEventDescription: String(tracking.lastEventDescription || '').trim(),
    trackingMapUrl: String(tracking.mapUrl || '').trim(),
    trackingPublicUrl: String(tracking.publicUrl || '').trim(),
    trackingUpdatedAt: nowIso,
    deliveredAt: deliveredNow ? nowIso : deal.deliveredAt || null,
    autoReleaseAt: deliveredNow ? autoReleaseAtIso : deal.autoReleaseAt || null,
    updatedAt: nowIso,
  };
  await lineEscrowDealRef.doc(dealId).set(patch, { merge: true });
  const updatedDeal = {
    ...deal,
    ...patch,
  };

  if (notifyDelivered && !deliveredBefore && deliveredNow && String(updatedDeal.groupId || '').trim()) {
    try {
      const dealForFlex = buildEscrowDealQueryWithLiffUrls(req, updatedDeal, configInput);
      await sendLinePushMessage({
        channelAccessToken: LINE_ESCROW_EFFECTIVE_CHANNEL_ACCESS_TOKEN,
        to: String(updatedDeal.groupId || '').trim(),
        messages: [buildLineEscrowTrackingArrivedFlexMessage(dealForFlex)],
      });
    } catch (error) {
      console.warn(`Failed to push delivered notification for escrow deal ${dealId}:`, error.message);
    }
  }

  return updatedDeal;
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
    firestoreLineScamBotCollection: FIRESTORE_LINE_SCAM_BOT_COLLECTION,
    firestoreLineScamWebhookLogCollection: FIRESTORE_LINE_SCAM_WEBHOOK_LOG_COLLECTION,
    firestoreLineEscrowBotCollection: FIRESTORE_LINE_ESCROW_BOT_COLLECTION,
    firestoreLineEscrowWebhookLogCollection: FIRESTORE_LINE_ESCROW_WEBHOOK_LOG_COLLECTION,
    firestoreLineEscrowDealCollection: FIRESTORE_LINE_ESCROW_DEAL_COLLECTION,
    firestoreAdminComplaintCollection: FIRESTORE_ADMIN_COMPLAINT_COLLECTION,
    firestoreSupportTicketCollection: FIRESTORE_SUPPORT_TICKET_COLLECTION,
    firestoreScamReportCollection: FIRESTORE_SCAM_REPORT_COLLECTION,
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
    lineScamWebhookConfigured: Boolean(LINE_SCAM_CHANNEL_SECRET),
    lineScamReplyConfigured: Boolean(LINE_SCAM_CHANNEL_ACCESS_TOKEN),
    lineScamGeminiConfigured: Boolean(GEMINI_API_KEY),
    lineScamGeminiModel: GEMINI_MODEL,
    lineEscrowWebhookConfigured: Boolean(LINE_ESCROW_EFFECTIVE_CHANNEL_SECRET),
    lineEscrowReplyConfigured: Boolean(LINE_ESCROW_EFFECTIVE_CHANNEL_ACCESS_TOKEN),
    lineEscrowSharedWithScamChannel: LINE_ESCROW_SHARED_WITH_SCAM_CHANNEL,
    lineEscrowPaymentProvider: LINE_ESCROW_PAYMENT_PROVIDER,
    lineEscrowPaymentConfigured: Boolean(OPN_SECRET_KEY),
    lineEscrowPaymentPublicKeyConfigured: Boolean(OPN_PUBLIC_KEY),
    lineEscrowTrackingProvider: LINE_ESCROW_TRACKING_PROVIDER,
    lineEscrowTrackingConfigured: Boolean(TRACKING_API_KEY),
    lineEscrowAutoReleaseHours: LINE_ESCROW_AUTO_RELEASE_HOURS,
    lineEscrowSlipImageMaxBytes: LINE_ESCROW_SLIP_IMAGE_MAX_BYTES,
    lineEscrowCronConfigured: Boolean(LINE_ESCROW_CRON_SECRET),
    lineEscrowPaymentWebhookSecretConfigured: Boolean(LINE_ESCROW_PAYMENT_WEBHOOK_SECRET),
    lineEscrowManualPaymentConfirmEnabled: LINE_ESCROW_MANUAL_PAYMENT_CONFIRM_ENABLED,
    openAiConfigured: Boolean(OPENAI_API_KEY),
    openAiModel: OPENAI_MODEL,
    openAiReasoningEffort: OPENAI_REASONING_EFFORT,
    rootAdminConfigured: Boolean(ROOT_ADMIN_EMAIL),
    adminStatsTimezone: ADMIN_STATS_TIMEZONE,
    supportTicketAttachmentLimit: SUPPORT_TICKET_MAX_ATTACHMENTS,
    supportTicketAttachmentMaxBytes: SUPPORT_TICKET_MAX_ATTACHMENT_BYTES,
    scamReportImageMaxBytes: SCAM_REPORT_IMAGE_MAX_BYTES,
    scamLiffImageMaxBytes: SCAM_LIFF_IMAGE_MAX_BYTES,
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
      message: 'Google sign-in successful.',
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

app.get('/admin/scam-reports', requireAuth, requireRootAdmin, async (req, res) => {
  try {
    const limitRaw = Number.parseInt(String(req.query?.limit || '300'), 10);
    const limit = Number.isInteger(limitRaw) ? Math.min(500, Math.max(1, limitRaw)) : 300;
    const snapshot = await scamReportRef.orderBy('createdAt', 'desc').limit(limit).get();
    const reports = snapshot.docs.map((doc) => toScamReportResponse(doc.id, doc.data() || {}));
    return res.json({
      reports,
      total: reports.length,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load scam reports.' });
  }
});

app.post('/admin/scam-reports', requireAuth, requireRootAdmin, async (req, res) => {
  try {
    const sellerAlias = String(req.body?.sellerAlias || '')
      .trim()
      .slice(0, 220);
    const firstName = String(req.body?.firstName || '')
      .trim()
      .slice(0, 120);
    const lastName = String(req.body?.lastName || '')
      .trim()
      .slice(0, 120);
    const citizenId = String(req.body?.citizenId || '')
      .trim()
      .slice(0, 30);
    const phone = String(req.body?.phone || '')
      .trim()
      .slice(0, 40);
    const bankAccount = String(req.body?.bankAccount || '')
      .trim()
      .slice(0, 80);
    const bankName = String(req.body?.bankName || '')
      .trim()
      .slice(0, 140);
    const product = String(req.body?.product || '')
      .trim()
      .slice(0, 220);
    const amount = normalizeScamReportAmount(req.body?.amount);
    const transferDate = normalizeScamReportTransferDate(req.body?.transferDate);
    const pageUrl = String(req.body?.pageUrl || '')
      .trim()
      .slice(0, 500);
    const province = String(req.body?.province || '')
      .trim()
      .slice(0, 140);
    const evidenceImageRaw = req.body?.evidenceImage;
    const evidenceImage = evidenceImageRaw ? normalizeScamReportEvidenceImage(evidenceImageRaw) : null;
    if (evidenceImageRaw && !evidenceImage) {
      return res.status(400).json({
        message: `Invalid evidence image. Only image/* data URL is allowed. Max ${SCAM_REPORT_IMAGE_MAX_BYTES} bytes.`,
      });
    }
    if (!sellerAlias || !firstName || !lastName || !bankAccount || !bankName || !product || !transferDate || amount <= 0) {
      return res.status(400).json({
        message:
          'sellerAlias, firstName, lastName, bankAccount, bankName, product, transferDate and amount are required.',
      });
    }

    const reportId = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const record = {
      sellerAlias,
      firstName,
      lastName,
      citizenId,
      phone,
      bankAccount,
      bankName,
      product,
      amount,
      transferDate,
      pageUrl,
      province,
      evidenceImage,
      createdById: sanitizeUserId(req.rootAdmin?.id),
      createdByUsername: sanitizeUsername(req.rootAdmin?.username),
      createdByEmail: sanitizeEmail(req.rootAdmin?.email),
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await scamReportRef.doc(reportId).set(record, { merge: true });

    return res.status(201).json({
      message: 'Scam report submitted successfully.',
      report: toScamReportResponse(reportId, record),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to submit scam report.' });
  }
});

app.get('/admin/line-scam-bot/config', requireAuth, requireRootAdmin, async (req, res) => {
  try {
    const config = await loadLineScamBotConfigRecord();
    return res.json({
      config: toLineScamBotPublicConfig(req, config),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load LINE scam bot config.' });
  }
});

app.put('/admin/line-scam-bot/config', requireAuth, requireRootAdmin, async (req, res) => {
  try {
    const liffScammerCheckUrl = normalizeOptionalHttpUrl(req.body?.liffScammerCheckUrl || '', 1000);
    const liffFakeNewsUrl = normalizeOptionalHttpUrl(req.body?.liffFakeNewsUrl || '', 1000);
    const liffRiskAssessUrl = normalizeOptionalHttpUrl(req.body?.liffRiskAssessUrl || '', 1000);
    if (
      liffScammerCheckUrl === null ||
      liffFakeNewsUrl === null ||
      liffRiskAssessUrl === null
    ) {
      return res.status(400).json({
        message: 'LIFF URL must be empty or start with http:// or https://',
      });
    }
    const richMenuId = normalizeOptionalString(req.body?.richMenuId, 180);
    const nowIso = new Date().toISOString();
    await lineScamBotConfigDocRef.set(
      {
        liffScammerCheckUrl: liffScammerCheckUrl || '',
        liffFakeNewsUrl: liffFakeNewsUrl || '',
        liffRiskAssessUrl: liffRiskAssessUrl || '',
        richMenuId: richMenuId || '',
        updatedAt: nowIso,
        updatedById: sanitizeUserId(req.rootAdmin?.id),
        updatedByEmail: sanitizeEmail(req.rootAdmin?.email),
      },
      { merge: true }
    );
    const updatedConfig = await loadLineScamBotConfigRecord();
    return res.json({
      message: 'LINE scam bot settings saved.',
      config: toLineScamBotPublicConfig(req, updatedConfig),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to save LINE scam bot config.' });
  }
});

app.get('/line/scam/liff/scammer-check', (_req, res) => {
  setLineScamLiffHtmlHeaders(res);
  return res.status(200).type('html').send(renderLineScamScammerCheckPage());
});

app.get('/line/scam/liff/fake-news', (_req, res) => {
  setLineScamLiffHtmlHeaders(res);
  return res
    .status(200)
    .type('html')
    .send(
      renderLineScamFakeNewsPage({
        maxImageBytes: SCAM_LIFF_IMAGE_MAX_BYTES,
        maxImageCount: SCAM_LIFF_IMAGE_MAX_COUNT,
      })
    );
});

app.get('/line/scam/liff/risk-assess', (_req, res) => {
  setLineScamLiffHtmlHeaders(res);
  return res
    .status(200)
    .type('html')
    .send(
      renderLineScamRiskAssessPage({
        maxImageBytes: SCAM_LIFF_IMAGE_MAX_BYTES,
        maxImageCount: SCAM_LIFF_IMAGE_MAX_COUNT,
      })
    );
});

app.get('/line/scam/liff/police-stations', (_req, res) => {
  setLineScamLiffHtmlHeaders(res);
  return res.status(200).type('html').send(renderLineScamPoliceStationsPage());
});

app.get('/line/scam/liff/api/police-stations', async (req, res) => {
  try {
    const query = normalizeOptionalString(req.query?.query || req.query?.q || '', 140);
    const latitude = normalizeGeoCoordinate(req.query?.lat, -90, 90);
    const longitude = normalizeGeoCoordinate(req.query?.lng, -180, 180);
    const limitRaw = Number.parseInt(String(req.query?.limit || '80'), 10);
    const limit = Number.isInteger(limitRaw) ? Math.min(120, Math.max(1, limitRaw)) : 80;
    const forceRefresh = /^(?:1|true|yes)$/i.test(String(req.query?.refresh || '').trim());

    const sourceResult = await loadLineScamPoliceStations({ forceRefresh });
    const filteredStations = searchLineScamPoliceStations({
      stationsInput: sourceResult.stations,
      query,
      latitude,
      longitude,
      limit,
    });
    const nearestDistanceKm =
      latitude !== null &&
      longitude !== null &&
      filteredStations.length > 0 &&
      Number.isFinite(Number(filteredStations[0]?.distanceKm))
        ? Number(filteredStations[0].distanceKm)
        : null;
    const fetchedAtMs = Number(sourceResult.fetchedAtMs || 0);
    const fetchedAt =
      Number.isFinite(fetchedAtMs) && fetchedAtMs > 0 ? new Date(fetchedAtMs).toISOString() : null;

    return res.json({
      query,
      usedGps: latitude !== null && longitude !== null,
      latitude,
      longitude,
      total: filteredStations.length,
      source: sourceResult.source,
      fetchedAt,
      nearestDistanceKm,
      stations: filteredStations,
    });
  } catch (error) {
    const status = Number(error?.status || 0);
    if (status >= 400 && status < 600) {
      return res.status(status).json({ message: error.message || 'Failed to load police stations.' });
    }
    return res.status(500).json({ message: error.message || 'Failed to load police stations.' });
  }
});

app.post('/line/scam/liff/api/scammer-check', async (req, res) => {
  try {
    const query = normalizeOptionalString(req.body?.query || req.body?.text || '', 140);
    if (!query) {
      return res.status(400).json({ message: 'query is required.' });
    }
    const queryToken = normalizeSearchToken(query);
    if (!queryToken || queryToken.length < 2) {
      return res.status(400).json({ message: 'Please enter at least 2 characters to search.' });
    }
    const resultLimitRaw = Number.parseInt(String(req.body?.limit || '20'), 10);
    const resultLimit = Number.isInteger(resultLimitRaw)
      ? Math.min(50, Math.max(1, resultLimitRaw))
      : 20;

    const snapshot = await scamReportRef.orderBy('createdAt', 'desc').limit(700).get();
    const reports = snapshot.docs.map((doc) => toScamReportResponse(doc.id, doc.data() || {}));
    const matches = reports
      .filter((report) => toScamReportSearchableText(report).includes(queryToken))
      .slice(0, resultLimit);
    const totalDamageAmount = matches.reduce(
      (sum, report) => sum + normalizeScamReportAmount(report.amount),
      0
    );
    return res.json({
      query,
      isScammer: matches.length > 0,
      totalMatches: matches.length,
      totalDamageAmount,
      matches: matches.map((report) => ({
        id: report.id,
        sellerAlias: report.sellerAlias,
        firstName: report.firstName,
        lastName: report.lastName,
        citizenId: report.citizenId,
        phone: report.phone,
        bankAccount: report.bankAccount,
        bankName: report.bankName,
        product: report.product,
        amount: report.amount,
        transferDate: report.transferDate,
        pageUrl: report.pageUrl,
        province: report.province,
        createdAt: report.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to search scam database.' });
  }
});

app.post('/line/scam/liff/api/fake-news', async (req, res) => {
  try {
    const text = normalizeOptionalString(req.body?.text || req.body?.newsText || '', 5000);
    const imageDataUrls = (Array.isArray(req.body?.imageDataUrls) ? req.body.imageDataUrls : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    const fallbackImageDataUrl = String(req.body?.imageDataUrl || '').trim();
    const mergedImageDataUrls = imageDataUrls.length
      ? imageDataUrls
      : fallbackImageDataUrl
        ? [fallbackImageDataUrl]
        : [];
    if (mergedImageDataUrls.length > SCAM_LIFF_IMAGE_MAX_COUNT) {
      return res
        .status(400)
        .json({ message: `รองรับรูปสูงสุด ${SCAM_LIFF_IMAGE_MAX_COUNT} รูปต่อครั้ง` });
    }
    if (!text && mergedImageDataUrls.length === 0) {
      return res.status(400).json({ message: 'text or imageDataUrls is required.' });
    }

    const analysisPrompt = [
      'คุณคือผู้ช่วยตรวจสอบข่าวปลอมสำหรับผู้ใช้ไทย',
      'วิเคราะห์ข่าวจากข้อมูลที่ได้รับ แล้วตอบเป็น JSON เท่านั้นโดยไม่ใส่ markdown',
      'โครงสร้าง JSON:',
      '{',
      '  "verdict": "true|likely_true|uncertain|likely_fake|fake",',
      '  "fakePercent": 0-100,',
      '  "confidencePercent": 0-100,',
      '  "summary": "สรุปสั้นภาษาไทย",',
      '  "reasons": ["เหตุผลหลัก 2-6 ข้อ"],',
      '  "references": [{"title":"ชื่อแหล่ง","url":"https://..."}],',
      '  "trustedChannels": ["ช่องทางข่าวจริงที่น่าเชื่อถือ"]',
      '}',
      'ห้ามใส่ข้อมูลเกินโครงสร้างนี้',
      '',
      `ข้อความข่าวจากผู้ใช้: ${text || '(ผู้ใช้ส่งเฉพาะรูปภาพ)'}`,
    ].join('\n');

    const gemini = await callGeminiStructuredJson({
      prompt: analysisPrompt,
      imageDataUrls: mergedImageDataUrls,
      taskName: 'fake-news',
    });
    const json = gemini.json || {};

    const fakePercent = clampPercent(
      json.fakePercent ??
        json.fake_percent ??
        json.fakeProbabilityPercent ??
        json.probabilityFake ??
        0
    );
    const confidencePercent = clampPercent(
      json.confidencePercent ?? json.confidence ?? json.modelConfidence ?? 0
    );
    const verdict = normalizeOptionalString(json.verdict || json.label || 'uncertain', 40).toLowerCase();
    const summary = normalizeOptionalString(
      json.summary || json.brief || 'ยังไม่สามารถยืนยันความจริงของข่าวได้ชัดเจน',
      1200
    );
    const reasons = normalizeGeminiStringList(
      json.reasons || json.reasoning || json.keyPoints || [],
      8,
      360
    );
    const references = normalizeGeminiReferences(
      json.references || json.sources || json.citations || []
    );
    const trustedChannels = normalizeGeminiStringList(
      json.trustedChannels || json.trusted_sources || json.recommendedChannels || [],
      10,
      220
    );

    return res.json({
      verdict,
      fakePercent,
      confidencePercent,
      summary,
      reasons,
      references,
      trustedChannels,
      model: GEMINI_MODEL,
    });
  } catch (error) {
    const status = Number(error?.status || 0);
    if (status >= 400 && status < 600) {
      return res.status(status).json({ message: error.message || 'Failed to analyze fake news.' });
    }
    return res.status(500).json({ message: error.message || 'Failed to analyze fake news.' });
  }
});

app.post('/line/scam/liff/api/risk-assess', async (req, res) => {
  try {
    const imageDataUrls = (Array.isArray(req.body?.imageDataUrls) ? req.body.imageDataUrls : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    const fallbackImageDataUrl = String(req.body?.imageDataUrl || '').trim();
    const mergedImageDataUrls = imageDataUrls.length
      ? imageDataUrls
      : fallbackImageDataUrl
        ? [fallbackImageDataUrl]
        : [];
    const contextText = normalizeOptionalString(req.body?.contextText || '', 2000);
    if (mergedImageDataUrls.length > SCAM_LIFF_IMAGE_MAX_COUNT) {
      return res
        .status(400)
        .json({ message: `รองรับรูปสูงสุด ${SCAM_LIFF_IMAGE_MAX_COUNT} รูปต่อครั้ง` });
    }
    if (mergedImageDataUrls.length === 0) {
      return res.status(400).json({ message: 'imageDataUrls is required.' });
    }

    const analysisPrompt = [
      'คุณคือผู้ช่วยประเมินความเสี่ยงโดนโกงจากรูปแชท',
      'อ่านข้อมูลจากภาพและข้อความเสริม แล้วตอบเป็น JSON เท่านั้นโดยไม่ใส่ markdown',
      'โครงสร้าง JSON:',
      '{',
      '  "riskPercent": 0-100,',
      '  "riskLevel": "low|medium|high",',
      '  "summary": "สรุปความเสี่ยงภาษาไทย",',
      '  "signals": ["สัญญาณเตือนที่พบ"],',
      '  "recommendations": ["วิธีป้องกันหรือการกระทำถัดไป"],',
      '  "shouldReport": true/false',
      '}',
      'หากข้อมูลไม่ชัดเจน ให้ประเมินแบบระมัดระวังและแนะนำผู้ใช้ตรวจสอบเพิ่ม',
      '',
      `ข้อความเสริมจากผู้ใช้: ${contextText || '(ไม่มีข้อความเสริม)'}`,
    ].join('\n');

    const gemini = await callGeminiStructuredJson({
      prompt: analysisPrompt,
      imageDataUrls: mergedImageDataUrls,
      taskName: 'risk-assess',
    });
    const json = gemini.json || {};
    const riskPercent = clampPercent(
      json.riskPercent ?? json.risk_score ?? json.scamRiskPercent ?? json.probabilityScam ?? 0
    );
    const riskLevelRaw = normalizeOptionalString(json.riskLevel || json.level || '', 32).toLowerCase();
    const riskLevel =
      riskLevelRaw === 'high' || riskLevelRaw === 'medium' || riskLevelRaw === 'low'
        ? riskLevelRaw
        : resolveLineScamRiskLevel(riskPercent);
    const summary = normalizeOptionalString(
      json.summary || json.brief || 'ยังไม่สามารถประเมินความเสี่ยงได้ชัดเจน',
      1200
    );
    const signals = normalizeGeminiStringList(
      json.signals || json.warningSignals || json.redFlags || [],
      10,
      320
    );
    const recommendations = normalizeGeminiStringList(
      json.recommendations || json.actions || json.nextSteps || [],
      12,
      320
    );
    const shouldReport = json.shouldReport === true || riskPercent >= 70;

    return res.json({
      riskPercent,
      riskLevel,
      summary,
      signals,
      recommendations,
      shouldReport,
      model: GEMINI_MODEL,
    });
  } catch (error) {
    const status = Number(error?.status || 0);
    if (status >= 400 && status < 600) {
      return res.status(status).json({ message: error.message || 'Failed to assess scam risk.' });
    }
    return res.status(500).json({ message: error.message || 'Failed to assess scam risk.' });
  }
});

app.get('/admin/line-escrow-bot/config', requireAuth, requireRootAdmin, async (req, res) => {
  try {
    const config = await loadLineEscrowBotConfigRecord();
    return res.json({
      config: toLineEscrowBotPublicConfig(req, config),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load LINE escrow bot config.' });
  }
});

app.put('/admin/line-escrow-bot/config', requireAuth, requireRootAdmin, async (req, res) => {
  try {
    const liffDealUrl = normalizeOptionalHttpUrl(req.body?.liffDealUrl || '', 1000);
    const liffSellerUrl = normalizeOptionalHttpUrl(req.body?.liffSellerUrl || '', 1000);
    const liffBuyerUrl = normalizeOptionalHttpUrl(req.body?.liffBuyerUrl || '', 1000);
    if (liffDealUrl === null || liffSellerUrl === null || liffBuyerUrl === null) {
      return res.status(400).json({
        message: 'LIFF URL must be empty or start with http:// or https://',
      });
    }
    const richMenuId = normalizeOptionalString(req.body?.richMenuId || '', 180);
    const trackingCourierDefault = normalizeOptionalString(req.body?.trackingCourierDefault || '', 120);
    const nowIso = new Date().toISOString();
    await lineEscrowBotConfigDocRef.set(
      {
        liffDealUrl: liffDealUrl || '',
        liffSellerUrl: liffSellerUrl || '',
        liffBuyerUrl: liffBuyerUrl || '',
        richMenuId: richMenuId || '',
        trackingCourierDefault: trackingCourierDefault || '',
        updatedAt: nowIso,
        updatedById: sanitizeUserId(req.rootAdmin?.id),
        updatedByEmail: sanitizeEmail(req.rootAdmin?.email),
      },
      { merge: true }
    );
    const updatedConfig = await loadLineEscrowBotConfigRecord();
    return res.json({
      message: 'LINE escrow bot settings saved.',
      config: toLineEscrowBotPublicConfig(req, updatedConfig),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to save LINE escrow bot config.' });
  }
});

app.get('/line/escrow/liff/deal', (_req, res) => {
  setLineScamLiffHtmlHeaders(res);
  return res
    .status(200)
    .type('html')
    .send(renderLineEscrowDealPage({ maxSlipImageBytes: LINE_ESCROW_SLIP_IMAGE_MAX_BYTES }));
});

app.get('/line/escrow/liff/seller', (_req, res) => {
  setLineScamLiffHtmlHeaders(res);
  return res
    .status(200)
    .type('html')
    .send(
      renderLineEscrowSellerPage({
        maxSlipImageBytes: LINE_ESCROW_SLIP_IMAGE_MAX_BYTES,
        maxSlipImageCount: LINE_ESCROW_SLIP_IMAGE_MAX_COUNT,
      })
    );
});

app.get('/line/escrow/liff/buyer', (_req, res) => {
  setLineScamLiffHtmlHeaders(res);
  return res.status(200).type('html').send(renderLineEscrowBuyerPage());
});

app.post('/line/escrow/liff/api/deals/create', async (req, res) => {
  try {
    const groupId = normalizeOptionalString(req.body?.groupId || '', 120);
    const buyerContactPhone = normalizeOptionalString(req.body?.buyerContactPhone || req.body?.buyerName || '', 40);
    const sellerContactPhone = normalizeOptionalString(req.body?.sellerContactPhone || req.body?.sellerName || '', 40);
    const productDetails = normalizeOptionalString(req.body?.productDetails || req.body?.itemName || '', 1200);
    const buyerName = normalizeOptionalString(req.body?.buyerName || buyerContactPhone || '', 120);
    const buyerLineUserId = normalizeOptionalString(req.body?.buyerLineUserId || '', 120);
    const sellerName = normalizeOptionalString(req.body?.sellerName || sellerContactPhone || '', 120);
    const sellerLineUserId = normalizeOptionalString(req.body?.sellerLineUserId || '', 120);
    const itemName = normalizeOptionalString(req.body?.itemName || productDetails || '', 220);
    const note = normalizeOptionalString(req.body?.note || '', 1200);
    const sellerPayoutMethodInput = normalizeEscrowPayoutMethod(req.body?.sellerPayoutMethod || '');
    const sellerPromptpayNumber = normalizeEscrowPromptpayNumber(req.body?.sellerPromptpayNumber || '');
    const sellerBankName = normalizeOptionalString(req.body?.sellerBankName || '', 140);
    const sellerBankBrand = normalizeEscrowBankBrand(req.body?.sellerBankBrand || sellerBankName || '');
    const sellerBankAccount = String(req.body?.sellerBankAccount || '')
      .replace(/[^0-9]/g, '')
      .trim()
      .slice(0, 80);
    const sellerBankAccountName = normalizeOptionalString(req.body?.sellerBankAccountName || sellerName || '', 120);
    const amountThb = Number(req.body?.amountThb || req.body?.amount || 0);
    const amountSatang = normalizeEscrowMoneySatang(amountThb);
    const sellerPayoutMethod = sellerPayoutMethodInput || (sellerPromptpayNumber ? 'promptpay' : 'bank');

    if (!groupId || !buyerContactPhone || !sellerContactPhone || !productDetails || amountSatang <= 0) {
      return res.status(400).json({
        message: 'groupId, buyerContactPhone, sellerContactPhone, productDetails and amountThb are required.',
      });
    }
    if (sellerPayoutMethod === 'bank' && (!sellerBankBrand || !sellerBankAccount)) {
      const missing = [];
      if (!sellerBankBrand) missing.push('sellerBankBrand/sellerBankName');
      if (!sellerBankAccount) missing.push('sellerBankAccount');
      return res.status(400).json({
        message:
          `${missing.join(', ')} are required for auto payout.`,
        details: {
          sellerBankName,
          supportedBankBrands: ['bbl', 'kbank', 'ktb', 'scb', 'bay', 'ttb', 'gsb', 'baac', 'cimb', 'uob', 'lhb'],
        },
      });
    }
    if (sellerPayoutMethod === 'promptpay' && !isValidEscrowPromptpayNumber(sellerPromptpayNumber)) {
      return res.status(400).json({
        message: 'sellerPromptpayNumber must be 10, 13 or 15 digits.',
      });
    }
    if (String(req.body?.sellerPayoutMethod || '').trim().toLowerCase() === 'seller_qr') {
      return res.status(400).json({
        message: 'seller_qr payout method is no longer supported. Please use bank or promptpay.',
      });
    }
    const sellerPayoutBankAccount = sellerPayoutMethod === 'promptpay' ? sellerPromptpayNumber : sellerBankAccount;
    const activePaymentDeal = await loadLatestEscrowAwaitingPaymentDealByGroup(groupId);
    if (activePaymentDeal) {
      const config = await loadLineEscrowBotConfigRecord();
      return res.status(200).json({
        message: 'พบดีลที่รอชำระอยู่แล้ว ระบบเปิดดีลเดิมให้',
        deal: buildEscrowDealQueryWithLiffUrls(req, activePaymentDeal.deal, config),
      });
    }

    const dealId = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    let paymentStatus = 'pending';
    let paymentChargeId = '';
    let paymentQrImageUrl = '';
    let paymentExpiresAt = null;
    let paidAt = null;
    let paymentFailureReason = '';

    if (LINE_ESCROW_PAYMENT_PROVIDER === 'opn' && OPN_SECRET_KEY) {
      try {
        const payment = await createEscrowPromptpayCharge({
          dealId,
          amountSatang,
          itemName,
          groupId,
        });
        paymentChargeId = payment.chargeId;
        paymentQrImageUrl = payment.qrImageUrl;
        paymentExpiresAt = payment.expiresAt;
        paymentStatus = payment.chargeStatus || 'pending';
        if (paymentStatus === 'successful') {
          paymentStatus = 'paid';
          paidAt = nowIso;
        }
      } catch (error) {
        paymentFailureReason = normalizeOptionalString(error.message || 'Payment initialization failed.', 320);
      }
    }

    const dealRecord = {
      groupId,
      status: paymentStatus === 'paid' ? 'paid_waiting_shipment' : 'awaiting_payment',
      itemName,
      productDetails,
      note,
      buyerName,
      buyerContactPhone,
      buyerLineUserId,
      sellerName,
      sellerContactPhone,
      sellerLineUserId,
      paymentProvider: LINE_ESCROW_PAYMENT_PROVIDER,
      paymentStatus: paymentStatus === 'successful' ? 'paid' : paymentStatus,
      paymentChargeId,
      paymentQrImageUrl,
      paymentExpiresAt,
      paymentFailureReason,
      paymentAmountSatang: amountSatang,
      paidAt,
      shipmentStatus: 'pending',
      trackingNumber: '',
      courierCode: '',
      shippingSlipImage: null,
      trackingStatus: '',
      trackingStatusText: '',
      trackingMapUrl: '',
      trackingPublicUrl: '',
      deliveredAt: null,
      autoReleaseAt: null,
      confirmedAt: null,
      payoutStatus: 'pending',
      payoutTransferId: '',
      payoutRecipientId: '',
      payoutReleasedAt: null,
      payoutFailedReason: '',
      payoutAmountSatang: amountSatang,
      sellerPayoutMethod,
      sellerPromptpayNumber: sellerPayoutMethod === 'promptpay' ? sellerPromptpayNumber : '',
      sellerPayoutQrImage: null,
      sellerBankName,
      sellerBankBrand,
      sellerBankAccount: sellerPayoutBankAccount,
      sellerBankAccountName,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await lineEscrowDealRef.doc(dealId).set(dealRecord, { merge: true });

    const config = await loadLineEscrowBotConfigRecord();
    const dealForResponse = buildEscrowDealQueryWithLiffUrls(
      req,
      toEscrowDealResponse(dealId, dealRecord),
      config
    );
    return res.status(201).json({
      message:
        paymentFailureReason && !paymentChargeId
          ? `Deal created but payment QR was not generated: ${paymentFailureReason}`
          : 'Escrow deal created.',
      deal: dealForResponse,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to create escrow deal.' });
  }
});

app.get('/line/escrow/liff/api/deals/active-payment', async (req, res) => {
  try {
    const groupId = normalizeOptionalString(req.query?.groupId || '', 120);
    if (!groupId) {
      return res.status(400).json({ message: 'groupId is required.' });
    }
    const found = await loadLatestEscrowAwaitingPaymentDealByGroup(groupId);
    if (!found) {
      return res.json({ deal: null });
    }
    let deal = found.deal;
    const shouldRefreshPayment = String(req.query?.refreshPayment || '').trim() !== '0';
    if (shouldRefreshPayment && String(deal.paymentStatus || '').trim().toLowerCase() !== 'paid') {
      deal = await refreshEscrowDealPaymentStatus(deal);
    }
    if (
      String(deal.paymentStatus || '').trim().toLowerCase() === 'paid' &&
      String(deal.status || '').trim().toLowerCase() === 'awaiting_payment'
    ) {
      deal = await markEscrowDealPaidWaitingShipment({
        dealRef: found.ref,
        dealInput: deal,
      });
      deal = await sendEscrowPaidStepCardIfNeeded({
        req,
        dealInput: deal,
      });
      return res.json({
        deal: null,
        message: 'ดีลนี้ชำระเงินแล้ว ระบบส่งขั้นตอนถัดไปในกลุ่มเรียบร้อย',
      });
    }
    const config = await loadLineEscrowBotConfigRecord();
    return res.json({
      deal: buildEscrowDealQueryWithLiffUrls(req, deal, config),
    });
  } catch (error) {
    const status = Number(error?.status || 0);
    if (status >= 400 && status < 600) {
      return res.status(status).json({ message: error.message || 'Failed to load active payment deal.' });
    }
    return res.status(500).json({ message: error.message || 'Failed to load active payment deal.' });
  }
});

app.post('/line/escrow/liff/api/deals/:dealId/check-payment', async (req, res) => {
  try {
    const found = await loadEscrowDealWithRef(req.params?.dealId);
    if (!found) {
      return res.status(404).json({ message: 'Deal not found.' });
    }
    let deal = found.deal;
    if (String(deal.paymentStatus || '').trim().toLowerCase() !== 'paid') {
      deal = await refreshEscrowDealPaymentStatus(deal);
    }
    if (
      String(deal.paymentStatus || '').trim().toLowerCase() === 'paid' &&
      String(deal.status || '').trim().toLowerCase() === 'awaiting_payment'
    ) {
      deal = await markEscrowDealPaidWaitingShipment({
        dealRef: found.ref,
        dealInput: deal,
      });
    }
    if (String(deal.paymentStatus || '').trim().toLowerCase() === 'paid') {
      deal = await sendEscrowPaidStepCardIfNeeded({
        req,
        dealInput: deal,
      });
    }
    const config = await loadLineEscrowBotConfigRecord();
    return res.json({
      deal: buildEscrowDealQueryWithLiffUrls(req, deal, config),
    });
  } catch (error) {
    const status = Number(error?.status || 0);
    if (status >= 400 && status < 600) {
      return res.status(status).json({ message: error.message || 'Failed to check payment status.' });
    }
    return res.status(500).json({ message: error.message || 'Failed to check payment status.' });
  }
});

app.post('/line/escrow/liff/api/deals/:dealId/cancel', async (req, res) => {
  try {
    const found = await loadEscrowDealWithRef(req.params?.dealId);
    if (!found) {
      return res.status(404).json({ message: 'Deal not found.' });
    }
    const status = String(found.deal.status || '').trim().toLowerCase();
    const paymentStatus = String(found.deal.paymentStatus || '').trim().toLowerCase();
    if (status === 'cancelled') {
      const config = await loadLineEscrowBotConfigRecord();
      return res.json({
        message: 'ดีลนี้ถูกยกเลิกแล้ว',
        deal: buildEscrowDealQueryWithLiffUrls(req, found.deal, config),
      });
    }
    if (
      paymentStatus === 'paid' ||
      ['paid_waiting_shipment', 'shipped', 'delivered_waiting_confirmation', 'confirmed_release_pending', 'released'].includes(
        status
      )
    ) {
      return res.status(400).json({
        message: 'ไม่สามารถยกเลิกดีลหลังชำระเงินหรือเข้าขั้นตอนจัดส่งแล้ว',
      });
    }
    const nowIso = new Date().toISOString();
    const patch = {
      status: 'cancelled',
      shipmentStatus: 'cancelled',
      paymentStatus: paymentStatus === 'failed' ? 'failed' : 'cancelled',
      paymentQrImageUrl: '',
      paymentExpiresAt: null,
      cancelledAt: nowIso,
      updatedAt: nowIso,
    };
    await found.ref.set(patch, { merge: true });
    const updatedDeal = {
      ...found.deal,
      ...patch,
    };
    const config = await loadLineEscrowBotConfigRecord();
    return res.json({
      message: 'ยกเลิกดีลเรียบร้อยแล้ว',
      deal: buildEscrowDealQueryWithLiffUrls(req, updatedDeal, config),
    });
  } catch (error) {
    const status = Number(error?.status || 0);
    if (status >= 400 && status < 600) {
      return res.status(status).json({ message: error.message || 'Failed to cancel deal.' });
    }
    return res.status(500).json({ message: error.message || 'Failed to cancel deal.' });
  }
});

app.post('/line/escrow/liff/api/deals/:dealId/manual-confirm-paid', async (req, res) => {
  try {
    if (!LINE_ESCROW_MANUAL_PAYMENT_CONFIRM_ENABLED) {
      return res.status(403).json({ message: 'Manual payment confirmation is disabled on server.' });
    }
    const found = await loadEscrowDealWithRef(req.params?.dealId);
    if (!found) {
      return res.status(404).json({ message: 'Deal not found.' });
    }
    const status = String(found.deal.status || '').trim().toLowerCase();
    const paymentStatus = String(found.deal.paymentStatus || '').trim().toLowerCase();
    if (status === 'cancelled') {
      return res.status(400).json({ message: 'ดีลนี้ถูกยกเลิกแล้ว ไม่สามารถยืนยันชำระเงินได้' });
    }
    let deal = found.deal;
    if (!(paymentStatus === 'paid' && status === 'paid_waiting_shipment')) {
      deal = await markEscrowDealPaidWaitingShipment({
        dealRef: found.ref,
        dealInput: deal,
        manualConfirmed: true,
        manualSource: 'liff_test_confirm',
      });
    }
    deal = await sendEscrowPaidStepCardIfNeeded({
      req,
      dealInput: deal,
    });
    const config = await loadLineEscrowBotConfigRecord();
    return res.json({
      message: 'ยืนยันการชำระเงินแล้ว และส่งขั้นตอนถัดไปในกลุ่มเรียบร้อย',
      deal: buildEscrowDealQueryWithLiffUrls(req, deal, config),
    });
  } catch (error) {
    const status = Number(error?.status || 0);
    if (status >= 400 && status < 600) {
      return res.status(status).json({ message: error.message || 'Failed to confirm payment manually.' });
    }
    return res.status(500).json({ message: error.message || 'Failed to confirm payment manually.' });
  }
});

app.post('/line/escrow/payment/webhook', async (req, res) => {
  try {
    if (LINE_ESCROW_PAYMENT_WEBHOOK_SECRET) {
      const provided = String(
        req.headers?.['x-line-escrow-webhook-secret'] ||
          req.headers?.['x-escrow-webhook-secret'] ||
          req.query?.secret ||
          req.body?.secret ||
          ''
      ).trim();
      if (!provided || provided !== LINE_ESCROW_PAYMENT_WEBHOOK_SECRET) {
        return res.status(401).json({ message: 'Invalid escrow payment webhook secret.' });
      }
    }
    const eventType = normalizeOptionalString(req.body?.key || req.body?.type || '', 120).toLowerCase();
    const eventData =
      req.body?.data && typeof req.body.data === 'object' && !Array.isArray(req.body.data)
        ? req.body.data
        : {};
    const chargeObject =
      eventData?.id && typeof eventData === 'object' && !Array.isArray(eventData)
        ? eventData
        : req.body && typeof req.body === 'object' && !Array.isArray(req.body)
          ? req.body
          : {};
    const chargeId = String(chargeObject.id || '').trim();
    if (!chargeId) {
      return res.status(400).json({ message: 'charge id is required in webhook payload.' });
    }
    const metadata =
      chargeObject.metadata && typeof chargeObject.metadata === 'object' && !Array.isArray(chargeObject.metadata)
        ? chargeObject.metadata
        : {};
    const metadataDealId = String(metadata.deal_id || metadata.dealId || '').trim();
    let foundDeal = metadataDealId ? await loadEscrowDealWithRef(metadataDealId) : null;
    if (!foundDeal) {
      const querySnapshot = await lineEscrowDealRef.where('paymentChargeId', '==', chargeId).limit(1).get();
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        foundDeal = {
          ref: lineEscrowDealRef.doc(doc.id),
          deal: toEscrowDealResponse(doc.id, doc.data() || {}),
        };
      }
    }
    if (!foundDeal) {
      return res.json({ ok: true, message: 'No escrow deal matched this payment event.' });
    }
    const chargeStatus = String(chargeObject.status || '').trim().toLowerCase();
    const paid = chargeStatus === 'successful' || eventType === 'charge.complete';
    const nowIso = new Date().toISOString();
    const patch = {
      paymentStatus: paid ? 'paid' : chargeStatus || 'pending',
      paidAt: paid ? nowIso : foundDeal.deal.paidAt || null,
      paymentFailureReason: normalizeOptionalString(chargeObject.failure_message || '', 320),
      updatedAt: nowIso,
    };
    if (paid && String(foundDeal.deal.status || '').trim().toLowerCase() === 'awaiting_payment') {
      patch.status = 'paid_waiting_shipment';
      patch.shipmentStatus = 'pending';
    }
    await foundDeal.ref.set(patch, { merge: true });
    let updatedDeal = {
      ...foundDeal.deal,
      ...patch,
    };

    if (paid) {
      updatedDeal = await sendEscrowPaidStepCardIfNeeded({
        req,
        dealInput: updatedDeal,
      });
    }

    return res.json({
      ok: true,
      dealId: updatedDeal.id,
      paymentStatus: patch.paymentStatus,
      paid,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to process escrow payment webhook.' });
  }
});

app.get('/line/escrow/liff/api/deals/:dealId', async (req, res) => {
  try {
    const found = await loadEscrowDealWithRef(req.params?.dealId);
    if (!found) {
      return res.status(404).json({ message: 'Deal not found.' });
    }
    let deal = found.deal;
    const shouldRefreshPayment = String(req.query?.refreshPayment || '').trim() === '1';
    if (shouldRefreshPayment && String(deal.paymentStatus || '').trim().toLowerCase() !== 'paid') {
      deal = await refreshEscrowDealPaymentStatus(deal);
    }
    const config = await loadLineEscrowBotConfigRecord();
    return res.json({
      deal: buildEscrowDealQueryWithLiffUrls(req, deal, config),
    });
  } catch (error) {
    const status = Number(error?.status || 0);
    if (status >= 400 && status < 600) {
      return res.status(status).json({ message: error.message || 'Failed to load escrow deal.' });
    }
    return res.status(500).json({ message: error.message || 'Failed to load escrow deal.' });
  }
});

app.post('/line/escrow/liff/api/deals/submit-shipment', async (req, res) => {
  try {
    const dealId = normalizeOptionalString(req.body?.dealId || '', 120);
    if (!dealId) {
      return res.status(400).json({ message: 'dealId is required.' });
    }
    const found = await loadEscrowDealWithRef(dealId);
    if (!found) {
      return res.status(404).json({ message: 'Deal not found.' });
    }
    let deal = found.deal;
    if (String(deal.paymentStatus || '').trim().toLowerCase() !== 'paid') {
      deal = await refreshEscrowDealPaymentStatus(deal);
    }
    if (String(deal.paymentStatus || '').trim().toLowerCase() !== 'paid') {
      return res.status(400).json({ message: 'Payment is not completed yet. Buyer must pay first.' });
    }
    const trackingNumber = normalizeOptionalString(req.body?.trackingNumber || '', 120);
    const courierCode = normalizeOptionalString(req.body?.courierCode || '', 120);
    if (!trackingNumber) {
      return res.status(400).json({ message: 'trackingNumber is required.' });
    }
    const incomingSlipImages = Array.isArray(req.body?.shippingSlipImages)
      ? req.body.shippingSlipImages
      : req.body?.shippingSlipImage
        ? [req.body.shippingSlipImage]
        : [];
    const shippingSlipImages = normalizeEscrowSlipImageList(
      incomingSlipImages,
      LINE_ESCROW_SLIP_IMAGE_MAX_COUNT
    );
    const shippingSlipImage = shippingSlipImages[0] || null;
    if (!shippingSlipImage || shippingSlipImages.length === 0) {
      return res.status(400).json({
        message: 'shippingSlipImages is required and each image must be valid.',
      });
    }
    if (incomingSlipImages.length > LINE_ESCROW_SLIP_IMAGE_MAX_COUNT) {
      return res
        .status(400)
        .json({ message: `รองรับรูปสูงสุด ${LINE_ESCROW_SLIP_IMAGE_MAX_COUNT} รูปต่อครั้ง` });
    }
    const nowIso = new Date().toISOString();
    const patch = {
      status: 'shipped',
      shipmentStatus: 'shipped',
      trackingNumber,
      courierCode,
      shippingSlipImage,
      shippingSlipImages,
      shippingSubmittedAt: nowIso,
      updatedAt: nowIso,
    };
    await found.ref.set(patch, { merge: true });
    deal = {
      ...deal,
      ...patch,
    };
    const config = await loadLineEscrowBotConfigRecord();
    let refreshedDeal = deal;
    try {
      refreshedDeal = await refreshEscrowDealTrackingStatus({
        dealInput: deal,
        req,
        configInput: config,
        notifyDelivered: true,
      });
    } catch (trackingError) {
      console.warn(`Failed to refresh tracking on shipment submit for deal ${dealId}:`, trackingError.message);
    }

    const buyerDeal = buildEscrowDealQueryWithLiffUrls(req, refreshedDeal, config);
    if (String(refreshedDeal.groupId || '').trim()) {
      const statusCard = {
        type: 'flex',
        altText: `ผู้ขายส่งพัสดุแล้ว ดีล ${dealId}`,
        contents: {
          type: 'bubble',
          body: {
            type: 'box',
            layout: 'vertical',
            spacing: '8px',
            contents: [
              { type: 'text', text: 'ผู้ขายส่งพัสดุแล้ว', size: 'lg', weight: 'bold', color: '#0f766e' },
              { type: 'text', text: `ดีล: ${dealId}`, size: 'sm', color: '#334155', wrap: true },
              { type: 'text', text: `เลขพัสดุ: ${trackingNumber}`, size: 'sm', color: '#334155', wrap: true },
              {
                type: 'text',
                text: `สินค้า: ${normalizeOptionalString(refreshedDeal.itemName || '-', 120)}`,
                size: 'sm',
                color: '#334155',
                wrap: true,
              },
            ],
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            spacing: '8px',
            contents: buyerDeal.buyerLiffUrl
              ? [
                  {
                    type: 'button',
                    style: 'primary',
                    color: '#7c3aed',
                    action: {
                      type: 'uri',
                      label: 'เปิดหน้าเช็กสถานะและยืนยันรับของ',
                      uri: buyerDeal.buyerLiffUrl,
                    },
                  },
                ]
              : [
                  {
                    type: 'text',
                    text: 'ไม่พบ LIFF URL สำหรับผู้ซื้อ',
                    size: 'xs',
                    color: '#991b1b',
                    wrap: true,
                  },
                ],
          },
        },
      };
      await sendLinePushMessage({
        channelAccessToken: LINE_ESCROW_EFFECTIVE_CHANNEL_ACCESS_TOKEN,
        to: String(refreshedDeal.groupId || '').trim(),
        messages: [statusCard],
      });
    }

    return res.json({
      message: 'Shipment details submitted.',
      deal: buyerDeal,
    });
  } catch (error) {
    const status = Number(error?.status || 0);
    if (status >= 400 && status < 600) {
      return res.status(status).json({ message: error.message || 'Failed to submit shipment.' });
    }
    return res.status(500).json({ message: error.message || 'Failed to submit shipment.' });
  }
});

app.post('/line/escrow/liff/api/deals/:dealId/refresh-tracking', async (req, res) => {
  try {
    const found = await loadEscrowDealWithRef(req.params?.dealId);
    if (!found) {
      return res.status(404).json({ message: 'Deal not found.' });
    }
    if (!String(found.deal.trackingNumber || '').trim()) {
      return res.status(400).json({ message: 'This deal does not have tracking number yet.' });
    }
    const config = await loadLineEscrowBotConfigRecord();
    const updatedDeal = await refreshEscrowDealTrackingStatus({
      dealInput: found.deal,
      req,
      configInput: config,
      notifyDelivered: true,
    });
    return res.json({
      deal: buildEscrowDealQueryWithLiffUrls(req, updatedDeal, config),
    });
  } catch (error) {
    const status = Number(error?.status || 0);
    if (status >= 400 && status < 600) {
      return res.status(status).json({ message: error.message || 'Failed to refresh tracking status.' });
    }
    return res.status(500).json({ message: error.message || 'Failed to refresh tracking status.' });
  }
});

app.post('/line/escrow/liff/api/deals/:dealId/confirm-delivery', async (req, res) => {
  try {
    const found = await loadEscrowDealWithRef(req.params?.dealId);
    if (!found) {
      return res.status(404).json({ message: 'Deal not found.' });
    }
    const nowIso = new Date().toISOString();
    await found.ref.set(
      {
        status: 'confirmed_release_pending',
        confirmedAt: nowIso,
        updatedAt: nowIso,
      },
      { merge: true }
    );
    let deal = {
      ...found.deal,
      status: 'confirmed_release_pending',
      confirmedAt: nowIso,
      updatedAt: nowIso,
    };
    const releaseResult = await releaseEscrowDealPayout({
      dealInput: deal,
      reason: 'buyer_confirmed',
    });
    deal = releaseResult.deal || deal;
    const payoutStatus = String(deal.payoutStatus || '').trim().toLowerCase();
    const payoutReleased = payoutStatus === 'released' && releaseResult?.ok === true;
    const manualPayoutRequired = payoutStatus === 'manual_required' || releaseResult?.manualRequired === true;
    const payoutMethodLabel =
      String(deal.sellerPayoutMethod || '').trim().toLowerCase() === 'promptpay' ? 'PromptPay' : 'ธนาคาร';
    const config = await loadLineEscrowBotConfigRecord();
    const finalDeal = buildEscrowDealQueryWithLiffUrls(req, deal, config);

    if (String(deal.groupId || '').trim()) {
      const payoutCard = {
        type: 'flex',
        altText: payoutReleased
          ? `ดีล ${deal.id} โอนเงินให้ผู้ขายแล้ว`
          : `ดีล ${deal.id} รอแอดมินโอนเงินให้ผู้ขาย`,
        contents: {
          type: 'bubble',
          body: {
            type: 'box',
            layout: 'vertical',
            spacing: '8px',
            contents: [
              {
                type: 'text',
                text: payoutReleased ? 'ยืนยันรับของเรียบร้อย' : 'ยืนยันรับของแล้ว (รอโอนให้ผู้ขาย)',
                size: 'lg',
                weight: 'bold',
                color: payoutReleased ? '#166534' : '#b45309',
              },
              { type: 'text', text: `ดีล: ${deal.id}`, size: 'sm', color: '#334155' },
              {
                type: 'text',
                text: payoutReleased
                  ? `โอนเงินให้ผู้ขายแล้ว ${Number(finalDeal.payoutAmountThb || 0).toLocaleString()} THB`
                  : `ดีลนี้ใช้ช่องทางรับเงินแบบ ${payoutMethodLabel} ต้องโอนให้ผู้ขายแบบ manual`,
                size: 'sm',
                color: '#334155',
                wrap: true,
              },
              ...(payoutReleased
                ? [
                    {
                      type: 'text',
                      text: `รหัสโอนเงิน: ${String(finalDeal.payoutTransferId || '-').slice(0, 64)}`,
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
      await sendLinePushMessage({
        channelAccessToken: LINE_ESCROW_EFFECTIVE_CHANNEL_ACCESS_TOKEN,
        to: String(deal.groupId || '').trim(),
        messages: [payoutCard],
      });
    }

    return res.json({
      message: payoutReleased
        ? 'Delivery confirmed and payout released.'
        : `Delivery confirmed. Auto payout failed for ${payoutMethodLabel}. Please transfer manually.`,
      deal: finalDeal,
      manualPayoutRequired,
    });
  } catch (error) {
    const status = Number(error?.status || 0);
    if (status >= 400 && status < 600) {
      return res.status(status).json({ message: error.message || 'Failed to confirm delivery.' });
    }
    return res.status(500).json({ message: error.message || 'Failed to confirm delivery.' });
  }
});

app.post('/line/escrow/cron/auto-release', async (req, res) => {
  try {
    if (!LINE_ESCROW_CRON_SECRET) {
      return res.status(503).json({ message: 'LINE_ESCROW_CRON_SECRET is not configured on server.' });
    }
    const providedSecret = String(
      req.headers?.['x-cron-secret'] || req.query?.secret || req.body?.secret || ''
    ).trim();
    if (!providedSecret || providedSecret !== LINE_ESCROW_CRON_SECRET) {
      return res.status(401).json({ message: 'Invalid cron secret.' });
    }
    const config = await loadLineEscrowBotConfigRecord();
    const snapshot = await lineEscrowDealRef.orderBy('updatedAt', 'desc').limit(500).get();
    const docs = snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
    let trackingRefreshed = 0;
    let autoReleased = 0;
    const errors = [];
    const nowMs = Date.now();
    for (const entry of docs) {
      const deal = toEscrowDealResponse(entry.id, entry.data);
      try {
        const status = String(deal.status || '').trim().toLowerCase();
        if (status === 'shipped' && String(deal.trackingNumber || '').trim()) {
          await refreshEscrowDealTrackingStatus({
            dealInput: deal,
            req,
            configInput: config,
            notifyDelivered: true,
          });
          trackingRefreshed += 1;
          continue;
        }
        if (status === 'delivered_waiting_confirmation') {
          const autoReleaseAtMs = toEpochMs(deal.autoReleaseAt);
          if (autoReleaseAtMs > 0 && nowMs >= autoReleaseAtMs) {
            await lineEscrowDealRef.doc(deal.id).set(
              {
                status: 'confirmed_release_pending',
                confirmedAt: new Date(nowMs).toISOString(),
                updatedAt: new Date(nowMs).toISOString(),
              },
              { merge: true }
            );
            const released = await releaseEscrowDealPayout({
              dealInput: {
                ...deal,
                status: 'confirmed_release_pending',
                confirmedAt: new Date(nowMs).toISOString(),
              },
              reason: 'auto_timeout',
            });
            autoReleased += released.ok ? 1 : 0;
          }
        }
      } catch (error) {
        errors.push({
          dealId: deal.id,
          message: String(error.message || 'Unknown error'),
        });
      }
    }
    return res.json({
      ok: true,
      scanned: docs.length,
      trackingRefreshed,
      autoReleased,
      errors,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to run escrow auto-release cron.' });
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

app.post('/line/scam/webhook', async (req, res) => {
  try {
    if (!LINE_SCAM_CHANNEL_SECRET) {
      return res.status(503).json({
        message: 'LINE_SCAM_CHANNEL_SECRET is not configured on server.',
      });
    }
    if (!LINE_SCAM_CHANNEL_ACCESS_TOKEN) {
      return res.status(503).json({
        message: 'LINE_SCAM_CHANNEL_ACCESS_TOKEN is not configured on server.',
      });
    }
    if (!isValidLineWebhookSignatureWithSecret(req, LINE_SCAM_CHANNEL_SECRET)) {
      return res.status(401).json({ message: 'Invalid LINE scam webhook signature.' });
    }

    const events = Array.isArray(req.body?.events) ? req.body.events : [];
    const destination = String(req.body?.destination || '').trim();
    const nowIso = new Date().toISOString();
    const lineScamConfig = await loadLineScamBotConfigRecord();
    const lineScamPublicConfig = toLineScamBotPublicConfig(req, lineScamConfig);
    const liffUrls =
      lineScamPublicConfig.liffUrls &&
      typeof lineScamPublicConfig.liffUrls === 'object' &&
      !Array.isArray(lineScamPublicConfig.liffUrls)
        ? lineScamPublicConfig.liffUrls
        : {};
    const escrowInScamWebhookEnabled = Boolean(LINE_SCAM_CHANNEL_ACCESS_TOKEN);
    let escrowLiffUrls = { deal: '', seller: '', buyer: '' };
    if (escrowInScamWebhookEnabled) {
      const escrowConfig = await loadLineEscrowBotConfigRecord();
      escrowLiffUrls = resolveLineEscrowLiffUrls(req, escrowConfig);
    }

    const writes = [];
    for (const event of events) {
      const source = event?.source && typeof event.source === 'object' ? event.source : {};
      const sourceType = normalizeOptionalString(source.type, 40);
      const isGroupContext = sourceType === 'group' || sourceType === 'room';
      const groupId = normalizeOptionalString(source.groupId, 80);
      const roomId = normalizeOptionalString(source.roomId, 80);
      const contextId = groupId || roomId;
      const userId = normalizeOptionalString(source.userId, 80);
      const eventType = normalizeOptionalString(event?.type, 40);
      const messageType = normalizeOptionalString(event?.message?.type, 40);
      const messageText =
        messageType === 'text' ? normalizeOptionalString(event?.message?.text, 500) : '';
      const commandKey = resolveLineScamCommandKey(messageText);
      const eventTimestamp = Number(event?.timestamp || Date.now());
      const replyToken = String(event?.replyToken || '').trim();

      if (groupId || roomId || userId) {
        const logId = crypto
          .createHash('sha256')
          .update(`${groupId}|${roomId}|${userId}|${eventTimestamp}|${eventType}|${messageText}`)
          .digest('hex');
        writes.push(
          lineScamWebhookLogRef.doc(logId).set(
            {
              destination,
              sourceType,
              groupId,
              roomId,
              userId,
              eventType,
              messageType,
              messageText,
              commandKey,
              eventTimestamp,
              receivedAt: nowIso,
            },
            { merge: true }
          )
        );
      }

      if (escrowInScamWebhookEnabled && (groupId || roomId || userId)) {
        const logId = crypto
          .createHash('sha256')
          .update(`${groupId}|${roomId}|${userId}|${eventTimestamp}|${eventType}|${messageText}`)
          .digest('hex');
        writes.push(
          lineEscrowWebhookLogRef.doc(logId).set(
            {
              destination,
              sourceType,
              groupId,
              roomId,
              userId,
              eventType,
              messageType,
              messageText,
              eventTimestamp,
              receivedAt: nowIso,
            },
            { merge: true }
          )
        );
      }

      if (escrowInScamWebhookEnabled && isGroupContext) {
        const shouldReplyStartMenu =
          (eventType === 'message' && messageType === 'text' && isLineEscrowStartCommand(messageText)) ||
          eventType === 'join' ||
          eventType === 'memberJoined';
        if (shouldReplyStartMenu && replyToken) {
          const scopedLiffUrls = {
            deal: addQueryParamToHttpUrl(escrowLiffUrls.deal, 'groupId', contextId),
            seller: addQueryParamToHttpUrl(escrowLiffUrls.seller, 'groupId', contextId),
            buyer: addQueryParamToHttpUrl(escrowLiffUrls.buyer, 'groupId', contextId),
          };
          writes.push(
            sendLineReplyMessages({
              channelAccessToken: LINE_SCAM_CHANNEL_ACCESS_TOKEN,
              replyToken,
              messages: [
                buildLineEscrowMainMenuFlexMessage({
                  liffUrlsInput: scopedLiffUrls,
                  stage: 'start',
                  groupId: contextId,
                }),
              ],
            }).catch((error) => {
              console.warn('Failed to reply LINE escrow bot message from shared webhook:', error.message);
            })
          );
        }
        continue;
      }

      if (
        commandKey &&
        sourceType === 'user' &&
        eventType === 'message' &&
        messageType === 'text' &&
        replyToken
      ) {
        const replyMessages = buildLineScamCommandReplyMessages({
          commandKey,
          liffUrls,
        });
        writes.push(
          sendLineReplyMessages({
            channelAccessToken: LINE_SCAM_CHANNEL_ACCESS_TOKEN,
            replyToken,
            messages: replyMessages,
          }).catch((error) => {
            console.warn('Failed to reply LINE scam bot message:', error.message);
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
    return res.status(500).json({ message: error.message || 'Failed to process LINE scam webhook.' });
  }
});

app.post('/line/escrow/webhook', async (req, res) => {
  try {
    if (!LINE_ESCROW_EFFECTIVE_CHANNEL_SECRET) {
      return res.status(503).json({
        message:
          'LINE_ESCROW_CHANNEL_SECRET is not configured on server (or LINE_SCAM_CHANNEL_SECRET when LINE_ESCROW_USE_SCAM_CHANNEL=true).',
      });
    }
    if (!LINE_ESCROW_EFFECTIVE_CHANNEL_ACCESS_TOKEN) {
      return res.status(503).json({
        message:
          'LINE_ESCROW_CHANNEL_ACCESS_TOKEN is not configured on server (or LINE_SCAM_CHANNEL_ACCESS_TOKEN when LINE_ESCROW_USE_SCAM_CHANNEL=true).',
      });
    }
    if (!isValidLineWebhookSignatureWithSecret(req, LINE_ESCROW_EFFECTIVE_CHANNEL_SECRET)) {
      return res.status(401).json({ message: 'Invalid LINE escrow webhook signature.' });
    }

    const events = Array.isArray(req.body?.events) ? req.body.events : [];
    const destination = String(req.body?.destination || '').trim();
    const nowIso = new Date().toISOString();
    const escrowConfig = await loadLineEscrowBotConfigRecord();
    const liffUrls = resolveLineEscrowLiffUrls(req, escrowConfig);

    const writes = [];
    for (const event of events) {
      const source = event?.source && typeof event.source === 'object' ? event.source : {};
      const sourceType = normalizeOptionalString(source.type, 40);
      const groupId = normalizeOptionalString(source.groupId, 80);
      const roomId = normalizeOptionalString(source.roomId, 80);
      const contextId = groupId || roomId;
      const userId = normalizeOptionalString(source.userId, 80);
      const eventType = normalizeOptionalString(event?.type, 40);
      const messageType = normalizeOptionalString(event?.message?.type, 40);
      const messageText =
        messageType === 'text' ? normalizeOptionalString(event?.message?.text, 500) : '';
      const eventTimestamp = Number(event?.timestamp || Date.now());

      if (groupId || roomId || userId) {
        const logId = crypto
          .createHash('sha256')
          .update(`${groupId}|${roomId}|${userId}|${eventTimestamp}|${eventType}|${messageText}`)
          .digest('hex');
        writes.push(
          lineEscrowWebhookLogRef.doc(logId).set(
            {
              destination,
              sourceType,
              groupId,
              roomId,
              userId,
              eventType,
              messageType,
              messageText,
              eventTimestamp,
              receivedAt: nowIso,
            },
            { merge: true }
          )
        );
      }

      const shouldReplyStartMenu =
        (eventType === 'message' && messageType === 'text' && isLineEscrowStartCommand(messageText)) ||
        eventType === 'join' ||
        eventType === 'memberJoined';
      if (shouldReplyStartMenu && String(event?.replyToken || '').trim()) {
        const scopedLiffUrls = {
          deal: addQueryParamToHttpUrl(liffUrls.deal, 'groupId', contextId),
          seller: addQueryParamToHttpUrl(liffUrls.seller, 'groupId', contextId),
          buyer: addQueryParamToHttpUrl(liffUrls.buyer, 'groupId', contextId),
        };
        writes.push(
          sendLineReplyMessages({
            channelAccessToken: LINE_ESCROW_EFFECTIVE_CHANNEL_ACCESS_TOKEN,
            replyToken: String(event.replyToken || '').trim(),
            messages: [
              buildLineEscrowMainMenuFlexMessage({
                liffUrlsInput: scopedLiffUrls,
                stage: 'start',
                groupId: contextId,
              }),
            ],
          }).catch((error) => {
            console.warn('Failed to reply LINE escrow bot message:', error.message);
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
    return res.status(500).json({ message: error.message || 'Failed to process LINE escrow webhook.' });
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

