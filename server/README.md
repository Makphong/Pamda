# PM Calendar Auth Server (Production)

Backend service for:
1. Email OTP verification (Gmail App Password)
2. Register/Login with username/email + password
3. Google OAuth login (ID token verification)
4. Persistent storage in Firestore (Cloud Run-safe)
5. `/auth/google` accepts `idToken` or `accessToken`
6. Google Calendar Link/Unlink + Merge View sync (`/google/calendar/*`)

## Required Environment Variables

Copy `.env.example` -> `.env` and fill:

```env
PORT=8080
CLIENT_ORIGIN=http://localhost:5173
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
# Recommended explicit callback for Cloud Run:
GOOGLE_CALENDAR_REDIRECT_URI=https://your-auth-service-xxxxx-uc.a.run.app/google/calendar/callback
# Optional alternative to GOOGLE_CLIENT_ID:
# GOOGLE_OAUTH_JSON_PATH=/secrets/google/oauth.json
GMAIL_USER=yourgmail@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password
OTP_FROM_EMAIL=yourgmail@gmail.com
OTP_TTL_MINUTES=10
REQUEST_BODY_LIMIT=10mb
FIRESTORE_USERS_COLLECTION=users
FIRESTORE_OTP_COLLECTION=auth_otps
FIRESTORE_APP_DATA_COLLECTION=app_data
FIRESTORE_APP_DATA_CHUNK_COLLECTION=chunks
FIRESTORE_APP_DATA_CHUNK_SIZE=300000
FIRESTORE_PROJECT_INVITES_COLLECTION=project_invites
FIRESTORE_PROJECT_INVITES_DOC_ID=global
FIRESTORE_SCAM_REPORT_COLLECTION=admin_scam_reports
SCAM_REPORT_IMAGE_MAX_BYTES=600000
FIRESTORE_LINE_SCAM_BOT_COLLECTION=line_scam_bot
FIRESTORE_LINE_SCAM_WEBHOOK_LOG_COLLECTION=line_scam_webhook_logs
SCAM_LIFF_IMAGE_MAX_BYTES=2500000
LINE_SCAM_CHANNEL_SECRET=your_line_scam_channel_secret
LINE_SCAM_CHANNEL_ACCESS_TOKEN=your_line_scam_channel_access_token
LINE_SCAM_LIFF_SCAMMER_CHECK_URL=
LINE_SCAM_LIFF_FAKE_NEWS_URL=
LINE_SCAM_LIFF_RISK_ASSESS_URL=
FIRESTORE_LINE_ESCROW_BOT_COLLECTION=line_escrow_bot
FIRESTORE_LINE_ESCROW_WEBHOOK_LOG_COLLECTION=line_escrow_webhook_logs
FIRESTORE_LINE_ESCROW_DEAL_COLLECTION=line_escrow_deals
LINE_ESCROW_CHANNEL_SECRET=your_line_escrow_channel_secret
LINE_ESCROW_CHANNEL_ACCESS_TOKEN=your_line_escrow_channel_access_token
# Optional: set true to reuse Scam channel credentials for Escrow webhook/reply
LINE_ESCROW_USE_SCAM_CHANNEL=true
LINE_ESCROW_LIFF_DEAL_URL=
LINE_ESCROW_LIFF_SELLER_URL=
LINE_ESCROW_LIFF_BUYER_URL=
LINE_ESCROW_PAYMENT_PROVIDER=opn
OPN_SECRET_KEY=your_opn_secret_key
OPN_PUBLIC_KEY=your_opn_public_key
OPN_API_BASE_URL=https://api.omise.co
TRACKING_API_KEY=your_tracking_api_key
TRACKING_API_BASE_URL=https://api.trackingmore.com/v4
LINE_ESCROW_TRACKING_PROVIDER=trackingmore
LINE_ESCROW_AUTO_RELEASE_HOURS=72
LINE_ESCROW_SLIP_IMAGE_MAX_BYTES=2500000
LINE_ESCROW_CRON_SECRET=your_strong_random_secret
LINE_ESCROW_PAYMENT_WEBHOOK_SECRET=your_strong_random_secret
GEMINI_API_KEY=your_google_ai_studio_api_key
GEMINI_MODEL=gemini-2.5-flash
```

Google OAuth can be configured in either way:
1. `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` directly
2. `GOOGLE_OAUTH_JSON_PATH` (mount OAuth JSON from Secret Manager)

If you use Google Calendar linking, callback URL must match `GOOGLE_CALENDAR_REDIRECT_URI`.

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

# Cloud Run: Detailed Console Steps

## Step 1: Select GCP Project + Enable APIs
1. Open Google Cloud Console.
2. Top bar -> project selector -> choose project (`pm-calendar-489320` or yours).
3. Open `APIs & Services > Enabled APIs & Services > + ENABLE APIS AND SERVICES`.
4. Enable these 5 APIs:
   - Cloud Run Admin API (`run.googleapis.com`)
   - Cloud Build API (`cloudbuild.googleapis.com`)
   - Artifact Registry API (`artifactregistry.googleapis.com`)
   - Cloud Firestore API (`firestore.googleapis.com`)
   - Secret Manager API (`secretmanager.googleapis.com`)

## Step 2: Create Firestore Database
1. Open `Firestore Database`.
2. Click `Create database`.
3. Choose `Native mode`.
4. Select region (example: `asia-southeast1`) and create.

## Step 3: Configure Google OAuth
1. Open `APIs & Services > OAuth consent screen` and complete required fields.
2. Open `APIs & Services > Credentials > Create credentials > OAuth client ID`.
3. Application type: `Web application`.
4. Add `Authorized JavaScript origins`:
   - `http://localhost:5173`
   - Your frontend Cloud Run URL (`https://...run.app`)
5. Add `Authorized redirect URIs`:
   - `http://localhost:8080/google/calendar/callback` (local backend)
   - `https://YOUR_AUTH_SERVICE_URL/google/calendar/callback` (Cloud Run backend)
6. Save, then copy `Client ID` for:
   - Frontend: `VITE_GOOGLE_CLIENT_ID`
   - Backend: `GOOGLE_CLIENT_ID` (or OAuth JSON mount)
7. Copy `Client Secret` for backend: `GOOGLE_CLIENT_SECRET` (if not using OAuth JSON mount)

## Step 4: Create Secrets
Use Secret Manager to store sensitive values:
1. Open `Security > Secret Manager > Create Secret`.
2. Create these secrets (one-by-one):
   - `gmail-user`
   - `gmail-app-password`
   - `otp-from-email`
3. For Google OAuth choose one method:

Method A (simple):
1. Create secret `google-client-id`.
2. Secret value = OAuth Client ID string.
3. Create secret `google-client-secret`.
4. Secret value = OAuth Client Secret string.

Method B (mount JSON file):
1. Create secret `google-oauth-json`.
2. Secret value = whole OAuth JSON file contents.

## Step 5: Deploy Backend Service
1. Open `Cloud Run > Create service`.
2. Source can be GitHub trigger or image from Artifact Registry.
3. Service name: `pm-calendar-auth`.
4. Region: same region as Firestore.
5. Allow unauthenticated: enable (if frontend needs public access).
6. In `Container(s), Volumes, Networking, Security`:

Set environment variables:
- `CLIENT_ORIGIN=https://your-frontend.run.app`
- `OTP_TTL_MINUTES=10`
- `REQUEST_BODY_LIMIT=10mb`
- `FIRESTORE_USERS_COLLECTION=users`
- `FIRESTORE_OTP_COLLECTION=auth_otps`
- `FIRESTORE_APP_DATA_COLLECTION=app_data`
- `FIRESTORE_APP_DATA_CHUNK_COLLECTION=chunks`
- `FIRESTORE_APP_DATA_CHUNK_SIZE=300000`
- `FIRESTORE_PROJECT_INVITES_COLLECTION=project_invites`
- `FIRESTORE_PROJECT_INVITES_DOC_ID=global`
- `FIRESTORE_SCAM_REPORT_COLLECTION=admin_scam_reports`
- `SCAM_REPORT_IMAGE_MAX_BYTES=600000`
- `GOOGLE_CALENDAR_REDIRECT_URI=https://your-auth-service-url/google/calendar/callback`

Add secrets as environment variables:
- `GMAIL_USER` from secret `gmail-user`
- `GMAIL_APP_PASSWORD` from secret `gmail-app-password`
- `OTP_FROM_EMAIL` from secret `otp-from-email`

Google OAuth setup for backend:
1. If using Method A:
   - Add env secret `GOOGLE_CLIENT_ID` from secret `google-client-id`.
   - Add env secret `GOOGLE_CLIENT_SECRET` from secret `google-client-secret`.
2. If using Method B:
   - Add secret as mounted volume:
     - Secret: `google-oauth-json`
     - Mount path: `/secrets/google`
     - File name: `oauth.json`
   - Add env variable:
     - `GOOGLE_OAUTH_JSON_PATH=/secrets/google/oauth.json`

7. Deploy service.

## Step 6: IAM Permissions
1. Open backend service details in Cloud Run.
2. Note runtime service account (for example `PROJECT_NUMBER-compute@developer.gserviceaccount.com`).
3. Grant roles in `IAM`:
   - `Cloud Datastore User` (Firestore access)
   - `Secret Manager Secret Accessor` (read secrets)

## Step 7: Deploy Frontend
1. Build frontend image with build args:
   - `VITE_AUTH_API_BASE_URL=https://pm-calendar-auth-xxxxx-uc.a.run.app`
   - `VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com`
2. Deploy frontend as separate Cloud Run service (`pm-calendar-frontend`).

## Step 8: Verify End-to-End
1. Open frontend URL.
2. Register account via OTP email.
3. Login by email/username + password.
4. Test `Login with Google`.
5. In `Manage Project` -> test Link Google Calendar and verify Merge view shows Google events.
6. Check backend `/health` and ensure:
   - `googleClientConfigured: true`
   - `googleCalendarOAuthConfigured: true`

## LINE Scam Bot (Separate Channel)

New routes:
1. Admin config (root admin only):
   - `GET /admin/line-scam-bot/config`
   - `PUT /admin/line-scam-bot/config`
   - `GET /admin/line-escrow-bot/config`
   - `PUT /admin/line-escrow-bot/config`
2. Webhook (separate from project bot):
   - `POST /line/scam/webhook`
   - `POST /line/escrow/webhook`
3. LIFF pages:
   - `/line/scam/liff/scammer-check`
   - `/line/scam/liff/fake-news`
   - `/line/scam/liff/risk-assess`
   - `/line/escrow/liff/deal`
   - `/line/escrow/liff/seller`
   - `/line/escrow/liff/buyer`
4. LIFF APIs:
   - `POST /line/scam/liff/api/scammer-check`
   - `POST /line/scam/liff/api/fake-news`
   - `POST /line/scam/liff/api/risk-assess`
   - `POST /line/escrow/liff/api/deals/create`
   - `POST /line/escrow/liff/api/deals/:dealId/check-payment`
   - `POST /line/escrow/liff/api/deals/submit-shipment`
   - `GET /line/escrow/liff/api/deals/:dealId`
   - `POST /line/escrow/liff/api/deals/:dealId/refresh-tracking`
   - `POST /line/escrow/liff/api/deals/:dealId/confirm-delivery`
   - `POST /line/escrow/payment/webhook`
   - `POST /line/escrow/cron/auto-release`

Rich menu command text mapping:
1. โดนโกงแล้วทำยังไงดี -> `คำแนะนำเมื่อถูกโกง`
2. เช็คคนโกง -> `ตรวจสอบมิจฉาชีพ`
3. เช็คข่าวปลอม -> `ตรวจสอบข่าวปลอม`
4. ประเมินความเสี่ยงการโดนโกง -> `ประเมินความเสี่ยง`
5. วิธีใช้ -> `เเนะนำวิธีการใช้งาน`

---

## CLI Shortcut (Optional)

```bash
cd multi-project-calendar/server
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/pm-calendar-auth

gcloud run deploy pm-calendar-auth \
  --image gcr.io/YOUR_PROJECT_ID/pm-calendar-auth \
  --region asia-southeast1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars CLIENT_ORIGIN=https://your-frontend-url,OTP_TTL_MINUTES=10,REQUEST_BODY_LIMIT=10mb,FIRESTORE_USERS_COLLECTION=users,FIRESTORE_OTP_COLLECTION=auth_otps,FIRESTORE_APP_DATA_COLLECTION=app_data,FIRESTORE_APP_DATA_CHUNK_COLLECTION=chunks,FIRESTORE_APP_DATA_CHUNK_SIZE=300000,FIRESTORE_PROJECT_INVITES_COLLECTION=project_invites,FIRESTORE_PROJECT_INVITES_DOC_ID=global,FIRESTORE_SCAM_REPORT_COLLECTION=admin_scam_reports,SCAM_REPORT_IMAGE_MAX_BYTES=600000,GOOGLE_CALENDAR_REDIRECT_URI=https://YOUR_AUTH_SERVICE_URL/google/calendar/callback \
  --set-secrets GMAIL_USER=gmail-user:latest,GMAIL_APP_PASSWORD=gmail-app-password:latest,OTP_FROM_EMAIL=otp-from-email:latest,GOOGLE_CLIENT_ID=google-client-id:latest,GOOGLE_CLIENT_SECRET=google-client-secret:latest
```

If using JSON mount via CLI:

```bash
gcloud run services update pm-calendar-auth \
  --region asia-southeast1 \
  --update-secrets=/secrets/google/oauth.json=google-oauth-json:latest \
  --update-env-vars=GOOGLE_OAUTH_JSON_PATH=/secrets/google/oauth.json
```

If using client id secret via CLI:

```bash
gcloud run services update pm-calendar-auth \
  --region asia-southeast1 \
  --set-secrets=GOOGLE_CLIENT_ID=google-client-id:latest,GOOGLE_CLIENT_SECRET=google-client-secret:latest
```
