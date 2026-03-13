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
const LINE_REMINDER_CRON_SECRET = String(process.env.LINE_REMINDER_CRON_SECRET || '').trim();
const DEFAULT_LINE_REMINDER_TIMEZONE = String(
  process.env.LINE_REMINDER_DEFAULT_TIMEZONE || 'Asia/Bangkok'
).trim();
const DEFAULT_LINE_REMINDER_HOUR = Math.min(
  23,
  Math.max(0, Number(process.env.LINE_REMINDER_DEFAULT_HOUR || 9))
);
const LINE_CHANNEL_SECRET = String(process.env.LINE_CHANNEL_SECRET || '').trim();
const LINE_WEBHOOK_CHANNEL_ACCESS_TOKEN = String(
  process.env.LINE_WEBHOOK_CHANNEL_ACCESS_TOKEN || process.env.LINE_CHANNEL_ACCESS_TOKEN || ''
).trim();

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

const lineReminderDocIdFor = (userIdInput, projectIdInput) =>
  crypto
    .createHash('sha256')
    .update(`${sanitizeUserId(userIdInput)}|${String(projectIdInput || '').trim()}`)
    .digest('hex');

const lineReminderLogDocIdFor = (userIdInput, projectIdInput, targetDateInput) =>
  crypto
    .createHash('sha256')
    .update(
      `${sanitizeUserId(userIdInput)}|${String(projectIdInput || '').trim()}|${String(
        targetDateInput || ''
      ).trim()}`
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

const normalizeLineReminderConfigRecord = (recordInput, options = {}) => {
  const includeSecrets = options?.includeSecrets === true;
  const record = recordInput && typeof recordInput === 'object' ? recordInput : {};
  const channelAccessToken = String(record.channelAccessToken || '').trim();
  const normalized = {
    userId: sanitizeUserId(record.userId),
    projectId: String(record.projectId || '').trim(),
    projectName: String(record.projectName || '').trim(),
    enabled: record.enabled === true,
    groupId: String(record.groupId || '').trim(),
    timezone: normalizeLineReminderTimezone(record.timezone),
    reminderHour: normalizeLineReminderHour(record.reminderHour),
    updatedAt: String(record.updatedAt || '').trim() || null,
    createdAt: String(record.createdAt || '').trim() || null,
    lastTestedAt: String(record.lastTestedAt || '').trim() || null,
    tokenConfigured: Boolean(channelAccessToken),
    tokenPreview: buildLineTokenPreview(channelAccessToken),
  };
  if (includeSecrets) {
    normalized.channelAccessToken = channelAccessToken;
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
    tokenConfigured: normalized.tokenConfigured,
    tokenPreview: normalized.tokenPreview,
    updatedAt: normalized.updatedAt,
    lastTestedAt: normalized.lastTestedAt,
  };
};

const sendLinePushMessage = async ({
  channelAccessToken,
  to,
  message,
  notificationDisabled = false,
}) => {
  const token = String(channelAccessToken || '').trim();
  const target = String(to || '').trim();
  const text = String(message || '').trim();
  if (!token) throw new Error('LINE channel access token is not configured.');
  if (!target) throw new Error('LINE group ID is required.');
  if (!text) throw new Error('LINE message is empty.');

  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Line-Retry-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      to: target,
      messages: [{ type: 'text', text }],
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

const buildLineReminderMessage = ({ projectName, targetDate, tasks }) => {
  const safeProjectName = String(projectName || '').trim() || 'Project';
  const safeDate = String(targetDate || '').trim();
  const taskList = Array.isArray(tasks) ? tasks : [];

  const titleLines = [
    '[PM Calendar] แจ้งเตือนงานล่วงหน้า 1 วัน',
    `โปรเจกต์: ${safeProjectName}`,
    `กำหนดส่ง: ${safeDate}`,
    '',
  ];

  const taskLines = taskList.slice(0, 20).map((task, index) => {
    const taskTitle = String(task?.title || '').trim() || 'Untitled task';
    const department = String(task?.department || '').trim();
    return `${index + 1}. ${taskTitle}${department ? ` (${department})` : ''}`;
  });

  const remaining = taskList.length - taskLines.length;
  if (remaining > 0) {
    taskLines.push(`... และอีก ${remaining} งาน`);
  }

  return [...titleLines, ...taskLines].join('\n').slice(0, 4900);
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
    googleClientConfigured: Boolean(GOOGLE_CLIENT_ID),
    googleCalendarOAuthConfigured: Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
    googleCalendarRedirectUriPreview: redirectUriPreview,
    lineReminderCronConfigured: Boolean(LINE_REMINDER_CRON_SECRET),
    lineReminderDefaultTimezone: normalizeLineReminderTimezone(DEFAULT_LINE_REMINDER_TIMEZONE),
    lineReminderDefaultHour: DEFAULT_LINE_REMINDER_HOUR,
    lineWebhookConfigured: Boolean(LINE_CHANNEL_SECRET),
    lineWebhookReplyConfigured: Boolean(LINE_WEBHOOK_CHANNEL_ACCESS_TOKEN),
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
    const user = {
      username,
      email,
      avatarUrl: '',
      provider: 'local',
      passwordHash: await bcrypt.hash(password, 10),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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

    if (!passwordHash && legacyPassword) {
      await usersRef.doc(user.id).set(
        {
          passwordHash: await bcrypt.hash(password, 10),
          password: '',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }

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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await usersRef.doc(userId).set(newUser);
      user = { id: userId, ...newUser };
    } else if (picture && user.avatarUrl !== picture) {
      user.avatarUrl = picture;
      user.updatedAt = new Date().toISOString();
      await usersRef.doc(user.id).set(
        {
          avatarUrl: user.avatarUrl,
          updatedAt: user.updatedAt,
        },
        { merge: true }
      );
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

      const normalizedMessageText = messageText.toLowerCase();
      const shouldReplyGroupId =
        groupId &&
        eventType === 'message' &&
        messageType === 'text' &&
        ['/groupid', '/group-id', '/linegroupid'].includes(normalizedMessageText);
      if (shouldReplyGroupId && event?.replyToken) {
        const helperText = [
          'PM Calendar LINE Group ID',
          groupId,
          '',
          'นำค่า Group ID นี้ไปใส่ในหน้า Manage Project > Announcements > LINE Reminder',
        ].join('\n');
        writes.push(
          sendLineReplyMessage({
            replyToken: String(event.replyToken || '').trim(),
            message: helperText,
          }).catch((error) => {
            console.warn('Failed to send LINE webhook helper reply:', error.message);
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

    const clearChannelAccessToken = req.body?.clearChannelAccessToken === true;
    const nextChannelAccessTokenInput = String(req.body?.channelAccessToken || '').trim();
    const nextChannelAccessToken = clearChannelAccessToken
      ? ''
      : nextChannelAccessTokenInput || String(existingConfig.channelAccessToken || '').trim();
    const nextEnabled = req.body?.enabled === true;
    const nextGroupId = String(req.body?.groupId || '').trim();
    const nextTimezone = normalizeLineReminderTimezone(req.body?.timezone);
    const nextReminderHour = normalizeLineReminderHour(req.body?.reminderHour);

    if (nextEnabled && !nextChannelAccessToken) {
      return res.status(400).json({
        message: 'LINE channel access token is required before enabling reminders.',
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
      channelAccessToken: nextChannelAccessToken,
      createdAt: String(existingConfig.createdAt || '').trim() || nowIso,
      updatedAt: nowIso,
      lastTestedAt: String(existingConfig.lastTestedAt || '').trim() || null,
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
        .json({ message: 'Only project host can send LINE test messages for this project.' });
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

    const nowIso = new Date().toISOString();
    const userMessage = String(req.body?.message || '').trim();
    const message =
      userMessage ||
      `[PM Calendar] Test message\nProject: ${
        String(ownership.project?.name || '').trim() || projectId
      }\nTime: ${nowIso}`;

    await sendLinePushMessage({
      channelAccessToken: config.channelAccessToken,
      to: config.groupId,
      message,
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
      message: 'LINE test message sent.',
      sentAt: nowIso,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to send LINE test message.' });
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
      const targetDate = shiftIsoDateByDays(todayByTimezone, 1);
      if (!targetDate) {
        stats.failed += 1;
        continue;
      }

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
      const dueTasks = ownerEvents.filter((event) => {
        if (!isTaskRecord(event)) return false;
        if (String(event?.projectId || '').trim() !== projectId) return false;
        if (String(event?.endDate || '').trim() !== targetDate) return false;
        const status = String(event?.status || '').trim().toLowerCase();
        if (status === 'done' || status === 'completed') return false;
        return true;
      });

      if (dueTasks.length === 0) {
        stats.skippedNoTask += 1;
        continue;
      }

      const logDocRef = lineReminderLogRef.doc(lineReminderLogDocIdFor(userId, projectId, targetDate));
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
          tasks: dueTasks,
        });
        await sendLinePushMessage({
          channelAccessToken: config.channelAccessToken,
          to: config.groupId,
          message,
        });

        await logDocRef.set(
          {
            status: 'sent',
            sentAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            taskCount: dueTasks.length,
          },
          { merge: true }
        );
        stats.sent += 1;
      } catch (error) {
        await logDocRef.set(
          {
            status: 'failed',
            errorMessage: String(error.message || '').slice(0, 400),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        stats.failed += 1;
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
