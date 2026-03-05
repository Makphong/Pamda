# PM Calendar Auth Server (Production)

Backend service for:
1. Email OTP verification (Gmail App Password)
2. Register/Login with username/email + password
3. Google OAuth login (ID token verification)
4. Persistent storage in Firestore (Cloud Run-safe)

## Architecture
1. Frontend (`multi-project-calendar`) calls Auth API
2. Auth API (`server`) runs on Cloud Run
3. User + OTP data stored in Firestore
4. OTP email sent by Gmail SMTP (App Password)

## Required Env

Copy `.env.example` -> `.env` and fill:

```env
PORT=8080
CLIENT_ORIGIN=http://localhost:5173
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GMAIL_USER=yourgmail@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password
OTP_FROM_EMAIL=yourgmail@gmail.com
OTP_TTL_MINUTES=10
FIRESTORE_USERS_COLLECTION=users
FIRESTORE_OTP_COLLECTION=auth_otps
```

## Local Run

```bash
cd multi-project-calendar/server
npm install
npm run dev
```

Health check:

```bash
curl http://localhost:8080/health
```

---

# Cloud Run Hand-Holding Steps

## Step 1: Prepare GCP Project
1. Create/select GCP project.
2. Install Google Cloud SDK and login:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```
3. Enable APIs:
   ```bash
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com firestore.googleapis.com secretmanager.googleapis.com
   ```

## Step 2: Setup Firestore
1. Open Firestore in GCP Console.
2. Create database in Native mode.
3. Choose region close to Cloud Run (example `asia-southeast1`).

## Step 3: Setup Google OAuth
1. Open Google Cloud Console -> APIs & Services -> Credentials.
2. Create OAuth Client ID (Web application).
3. Add Authorized JavaScript origins:
   - Local: `http://localhost:5173`
   - Production frontend URL (Cloud Run URL of frontend service)
4. Copy Client ID -> `GOOGLE_CLIENT_ID` and frontend `VITE_GOOGLE_CLIENT_ID`.

## Step 4: Setup Gmail App Password
1. Enable 2-Step Verification on Gmail account.
2. Create App Password.
3. Keep both values:
   - Gmail address (`GMAIL_USER`, `OTP_FROM_EMAIL`)
   - App password (`GMAIL_APP_PASSWORD`)

## Step 5: Store secrets in Secret Manager
```bash
echo -n "yourgmail@gmail.com" | gcloud secrets create GMAIL_USER --data-file=-
echo -n "your_app_password" | gcloud secrets create GMAIL_APP_PASSWORD --data-file=-
echo -n "yourgmail@gmail.com" | gcloud secrets create OTP_FROM_EMAIL --data-file=-
echo -n "your_google_client_id.apps.googleusercontent.com" | gcloud secrets create GOOGLE_CLIENT_ID --data-file=-
```

## Step 6: Deploy Auth API to Cloud Run
```bash
cd multi-project-calendar/server
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/pm-calendar-auth

gcloud run deploy pm-calendar-auth \
  --image gcr.io/YOUR_PROJECT_ID/pm-calendar-auth \
  --region asia-southeast1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars CLIENT_ORIGIN=https://your-frontend-url,OTP_TTL_MINUTES=10,FIRESTORE_USERS_COLLECTION=users,FIRESTORE_OTP_COLLECTION=auth_otps \
  --set-secrets GMAIL_USER=GMAIL_USER:latest,GMAIL_APP_PASSWORD=GMAIL_APP_PASSWORD:latest,OTP_FROM_EMAIL=OTP_FROM_EMAIL:latest,GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest
```

Important IAM:
1. Cloud Run runtime service account needs:
   - `Cloud Datastore User` (Firestore access)
   - `Secret Manager Secret Accessor`

## Step 7: Configure Frontend env
Create `multi-project-calendar/.env`:

```env
VITE_AUTH_API_BASE_URL=https://pm-calendar-auth-xxxxx-uc.a.run.app
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

## Step 8: Deploy Frontend to Cloud Run
```bash
cd multi-project-calendar
gcloud builds submit \
  --tag gcr.io/YOUR_PROJECT_ID/pm-calendar-frontend \
  --build-arg VITE_AUTH_API_BASE_URL=https://pm-calendar-auth-xxxxx-uc.a.run.app \
  --build-arg VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com

gcloud run deploy pm-calendar-frontend \
  --image gcr.io/YOUR_PROJECT_ID/pm-calendar-frontend \
  --region asia-southeast1 \
  --platform managed \
  --allow-unauthenticated
```

## Step 9: Wire CORS + OAuth origins
1. Update `CLIENT_ORIGIN` in auth service to frontend URL.
2. Ensure frontend URL is in Google OAuth authorized JS origins.

## Step 10: End-to-End test
1. Register with email.
2. Receive OTP in Gmail.
3. Confirm register/login works.
4. Test `Login with Google`.
5. Verify users + OTP docs in Firestore.

---

## Production Notes
1. In-memory OTP is removed; OTP is now stored in Firestore so multiple Cloud Run instances are safe.
2. Local file storage is removed; user data is persisted in Firestore.
3. If env or permissions are missing, `/auth/*` returns proper errors for troubleshooting.
