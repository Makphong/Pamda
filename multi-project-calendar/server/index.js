import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 10);

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || '*',
  })
);

const otpStore = new Map();
const googleClientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
const oauthClient = googleClientId ? new OAuth2Client(googleClientId) : null;

const sanitizeEmail = (value) => String(value || '').trim().toLowerCase();
const sanitizeUsername = (value) => String(value || '').trim().toLowerCase();

const toPublicUser = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  avatarUrl: user.avatarUrl || '',
});

const ensureUsersFile = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(USERS_FILE);
  } catch {
    await fs.writeFile(USERS_FILE, '[]', 'utf8');
  }
};

const readUsers = async () => {
  await ensureUsersFile();
  const content = await fs.readFile(USERS_FILE, 'utf8');
  const users = JSON.parse(content || '[]');
  return Array.isArray(users) ? users : [];
};

const writeUsers = async (users) => {
  await ensureUsersFile();
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
};

const makeUniqueUsername = (username, existingUsers) => {
  const safeBase = sanitizeUsername(username).replace(/[^a-z0-9_]/g, '_') || 'user';
  let candidate = safeBase;
  let counter = 1;
  const existingSet = new Set(existingUsers.map((user) => user.username));
  while (existingSet.has(candidate)) {
    candidate = `${safeBase}_${counter}`;
    counter += 1;
  }
  return candidate;
};

const createOtpCode = () => String(Math.floor(100000 + Math.random() * 900000));

const canSendRealEmail = Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
const mailer = canSendRealEmail
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })
  : null;

const sendOtpEmail = async (email, code) => {
  if (!mailer) {
    console.log(`[DEV OTP] ${email} -> ${code}`);
    return false;
  }

  await mailer.sendMail({
    from: process.env.OTP_FROM_EMAIL || process.env.GMAIL_USER,
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

  return true;
};

const validateOtp = (email, otp) => {
  const record = otpStore.get(email);
  if (!record) return { ok: false, message: 'OTP is not requested for this email.' };
  if (Date.now() > record.expiresAt) {
    otpStore.delete(email);
    return { ok: false, message: 'OTP has expired. Please request a new code.' };
  }
  if (record.code !== String(otp || '').trim()) {
    return { ok: false, message: 'Invalid OTP code.' };
  }
  return { ok: true };
};

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'pm-calendar-auth-server' });
});

app.post('/auth/send-otp', async (req, res) => {
  try {
    const email = sanitizeEmail(req.body?.email);
    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'Valid email is required.' });
    }

    const code = createOtpCode();
    otpStore.set(email, {
      code,
      expiresAt: Date.now() + OTP_TTL_MINUTES * 60 * 1000,
    });

    const realEmailSent = await sendOtpEmail(email, code);
    return res.json({
      message: realEmailSent
        ? 'OTP has been sent to your email.'
        : 'OTP generated in dev mode. Check server logs.',
    });
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

    const otpStatus = validateOtp(email, otp);
    if (!otpStatus.ok) {
      return res.status(400).json({ message: otpStatus.message });
    }

    const users = await readUsers();
    if (users.some((user) => user.email === email)) {
      return res.status(409).json({ message: 'This email is already registered.' });
    }
    if (users.some((user) => user.username === username)) {
      return res.status(409).json({ message: 'This username is already taken.' });
    }

    const user = {
      id: crypto.randomUUID(),
      username,
      email,
      avatarUrl: '',
      provider: 'local',
      passwordHash: await bcrypt.hash(password, 10),
      createdAt: new Date().toISOString(),
    };

    users.push(user);
    await writeUsers(users);
    otpStore.delete(email);

    return res.status(201).json({
      message: 'Account created successfully.',
      user: toPublicUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Registration failed.' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const identifier = sanitizeEmail(req.body?.identifier);
    const password = String(req.body?.password || '');
    if (!identifier || !password) {
      return res.status(400).json({ message: 'identifier and password are required.' });
    }

    const users = await readUsers();
    const user = users.find(
      (entry) => entry.email === identifier || entry.username === sanitizeUsername(identifier)
    );

    if (!user) {
      return res.status(401).json({ message: 'Invalid username/email or password.' });
    }
    if (!user.passwordHash) {
      return res.status(400).json({ message: 'This account uses Google sign-in.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid username/email or password.' });
    }

    return res.json({
      message: 'Login successful.',
      user: toPublicUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Login failed.' });
  }
});

app.post('/auth/google', async (req, res) => {
  try {
    if (!oauthClient || !googleClientId) {
      return res.status(500).json({ message: 'GOOGLE_CLIENT_ID is not configured on server.' });
    }

    const idToken = String(req.body?.idToken || '');
    if (!idToken) {
      return res.status(400).json({ message: 'idToken is required.' });
    }

    const ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: googleClientId,
    });
    const payload = ticket.getPayload();
    const email = sanitizeEmail(payload?.email);

    if (!email || !payload?.email_verified) {
      return res.status(401).json({ message: 'Google account email is not verified.' });
    }

    const users = await readUsers();
    let user = users.find((entry) => entry.email === email);

    if (!user) {
      const preferredUsername = sanitizeUsername(payload?.name || email.split('@')[0]);
      user = {
        id: crypto.randomUUID(),
        username: makeUniqueUsername(preferredUsername, users),
        email,
        avatarUrl: String(payload?.picture || '').trim(),
        provider: 'google',
        passwordHash: '',
        createdAt: new Date().toISOString(),
      };
      users.push(user);
    } else if (payload?.picture && user.avatarUrl !== payload.picture) {
      user.avatarUrl = payload.picture;
    }

    await writeUsers(users);

    return res.json({
      message: 'Google sign-in successful.',
      user: toPublicUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Google sign-in failed.' });
  }
});

const port = Number(process.env.PORT || 8080);
app.listen(port, async () => {
  await ensureUsersFile();
  console.log(`Auth server listening on port ${port}`);
});
