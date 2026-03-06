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
  --set-env-vars CLIENT_ORIGIN=https://your-frontend-url,OTP_TTL_MINUTES=10,REQUEST_BODY_LIMIT=10mb,FIRESTORE_USERS_COLLECTION=users,FIRESTORE_OTP_COLLECTION=auth_otps,FIRESTORE_APP_DATA_COLLECTION=app_data,FIRESTORE_APP_DATA_CHUNK_COLLECTION=chunks,FIRESTORE_APP_DATA_CHUNK_SIZE=300000,FIRESTORE_PROJECT_INVITES_COLLECTION=project_invites,FIRESTORE_PROJECT_INVITES_DOC_ID=global,GOOGLE_CALENDAR_REDIRECT_URI=https://YOUR_AUTH_SERVICE_URL/google/calendar/callback \
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
