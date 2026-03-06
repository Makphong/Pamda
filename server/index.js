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
app.use(helmet());
app.use(express.json({ limit: String(process.env.REQUEST_BODY_LIMIT || '10mb') }));

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

const loadGoogleClientIdFromJson = (filePath) => {
  if (!filePath) return '';

  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return String(parsed?.web?.client_id || parsed?.installed?.client_id || '').trim();
  } catch (error) {
    console.warn(`Failed to read Google OAuth JSON from ${filePath}: ${error.message}`);
    return '';
  }
};

const GOOGLE_CLIENT_ID =
  String(process.env.GOOGLE_CLIENT_ID || '').trim() || loadGoogleClientIdFromJson(GOOGLE_OAUTH_JSON_PATH);

const sanitizeEmail = (value) => String(value || '').trim().toLowerCase();
const sanitizeUsername = (value) => String(value || '').trim().toLowerCase();
const sanitizeUserId = (value) => String(value || '').trim();

const requiredEnv = ['GMAIL_USER', 'GMAIL_APP_PASSWORD', 'OTP_FROM_EMAIL'];
const missingEnv = requiredEnv.filter((key) => !String(process.env[key] || '').trim());
if (!GOOGLE_CLIENT_ID) {
  missingEnv.push('GOOGLE_CLIENT_ID or GOOGLE_OAUTH_JSON_PATH');
}
if (missingEnv.length > 0) {
  console.warn(`Missing required env: ${missingEnv.join(', ')}`);
}

const firestore = new Firestore();
const usersRef = firestore.collection(USERS_COLLECTION);
const otpRef = firestore.collection(OTP_COLLECTION);
const appDataRef = firestore.collection(APP_DATA_COLLECTION);
const invitesDocRef = firestore.collection(PROJECT_INVITES_COLLECTION).doc(PROJECT_INVITES_DOC_ID);
const oauthClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

const splitIntoChunks = (value, chunkSize) => {
  const text = String(value || '');
  if (!text) return [''];
  const parts = [];
  for (let index = 0; index < text.length; index += chunkSize) {
    parts.push(text.slice(index, index + chunkSize));
  }
  return parts;
};

const readAccountPayloadFromStore = async (userId) => {
  const userDataDocRef = appDataRef.doc(userId);
  const metaDoc = await userDataDocRef.get();
  if (!metaDoc.exists) return {};

  const metaData = metaDoc.data() || {};
  const directPayload = metaData.payload;
  if (directPayload && typeof directPayload === 'object' && !Array.isArray(directPayload)) {
    return directPayload;
  }

  const chunkCount = Number(metaData.chunkCount || 0);
  if (!Number.isInteger(chunkCount) || chunkCount <= 0) return {};

  const chunksSnapshot = await userDataDocRef
    .collection(APP_DATA_CHUNK_COLLECTION)
    .orderBy('index', 'asc')
    .limit(chunkCount)
    .get();

  if (chunksSnapshot.empty) return {};

  const serialized = chunksSnapshot.docs
    .map((doc) => String(doc.data()?.data || ''))
    .join('');
  if (!serialized) return {};

  try {
    const parsed = JSON.parse(serialized);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const writeAccountPayloadToStore = async (userId, payload) => {
  const userDataDocRef = appDataRef.doc(userId);
  const serializedPayload = JSON.stringify(payload);
  const chunks = splitIntoChunks(serializedPayload, APP_DATA_CHUNK_SIZE);
  const batch = firestore.batch();

  const existingChunksSnapshot = await userDataDocRef.collection(APP_DATA_CHUNK_COLLECTION).get();
  existingChunksSnapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  batch.set(
    userDataDocRef,
    {
      chunkCount: chunks.length,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  chunks.forEach((chunk, index) => {
    const chunkDocRef = userDataDocRef.collection(APP_DATA_CHUNK_COLLECTION).doc(`part_${index}`);
    batch.set(chunkDocRef, {
      index,
      data: chunk,
    });
  });

  await batch.commit();
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
  res.json({
    ok: true,
    service: 'pm-calendar-auth-server',
    firestoreCollectionUsers: USERS_COLLECTION,
    firestoreCollectionOtp: OTP_COLLECTION,
    firestoreCollectionAppData: APP_DATA_COLLECTION,
    firestoreCollectionAppDataChunks: APP_DATA_CHUNK_COLLECTION,
    firestoreCollectionProjectInvites: PROJECT_INVITES_COLLECTION,
    firestoreProjectInvitesDocId: PROJECT_INVITES_DOC_ID,
    googleClientConfigured: Boolean(GOOGLE_CLIENT_ID),
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

    return res.status(201).json({
      message: 'Account created successfully.',
      user: toPublicUser({ id: userId, ...user }),
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

    return res.json({
      message: 'Google sign-in successful.',
      user: toPublicUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Google sign-in failed.' });
  }
});

app.get('/users/lookup', async (req, res) => {
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

app.get('/data/account/:userId', async (req, res) => {
  try {
    const userId = sanitizeUserId(req.params?.userId);
    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }

    const userDoc = await usersRef.doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const payload = await readAccountPayloadFromStore(userId);

    return res.json({ payload });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch account data.' });
  }
});

app.put('/data/account/:userId', async (req, res) => {
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

    await writeAccountPayloadToStore(userId, incomingPayload);

    return res.json({ message: 'Account data saved.' });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to save account data.' });
  }
});

app.get('/data/project-invites', async (_req, res) => {
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

app.put('/data/project-invites', async (req, res) => {
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

app.use((error, _req, res, _next) => {
  res.status(500).json({ message: error.message || 'Internal server error.' });
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  console.log(`Auth server listening on port ${port}`);
});
