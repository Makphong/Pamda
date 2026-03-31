# Cloud Run Deployment Guide (Production)

This project must run as 2 separate Cloud Run services:
1. `pm-calendar-auth` (backend API in `server/`)
2. `pm-calendar-frontend` (Vite static app at repo root)

Do not mount OAuth JSON secret on frontend service. Mount it on auth service only.

## 1) Deploy Auth Service (`pm-calendar-auth`)

Build image from `server/`:

```bash
gcloud builds submit ./server --tag gcr.io/YOUR_PROJECT_ID/pm-calendar-auth
```

Deploy:

```bash
gcloud run deploy pm-calendar-auth \
  --image gcr.io/YOUR_PROJECT_ID/pm-calendar-auth \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars CLIENT_ORIGIN=https://YOUR_FRONTEND_URL,OTP_TTL_MINUTES=10,REQUEST_BODY_LIMIT=10mb,FIRESTORE_USERS_COLLECTION=users,FIRESTORE_OTP_COLLECTION=auth_otps,FIRESTORE_APP_DATA_COLLECTION=app_data,FIRESTORE_APP_DATA_CHUNK_COLLECTION=chunks,FIRESTORE_APP_DATA_CHUNK_SIZE=300000,FIRESTORE_PROJECT_INVITES_COLLECTION=project_invites,FIRESTORE_PROJECT_INVITES_DOC_ID=global,GOOGLE_OAUTH_JSON_PATH=/secrets/google/oauth.json,GOOGLE_CALENDAR_REDIRECT_URI=https://YOUR_AUTH_URL/google/calendar/callback \
  --set-secrets GMAIL_USER=gmail-user:latest,GMAIL_APP_PASSWORD=gmail-app-password:latest,OTP_FROM_EMAIL=otp-from-email:latest,/secrets/google/oauth.json=oauth2:latest
```

Verify auth service:

```bash
curl https://YOUR_AUTH_URL/health
```

`googleClientConfigured` and `googleCalendarOAuthConfigured` must be `true`.

## 2) Deploy Frontend Service (`pm-calendar-frontend`)

Build image from repo root:

```bash
gcloud builds submit . --tag gcr.io/YOUR_PROJECT_ID/pm-calendar-frontend
```

Deploy with runtime env:

```bash
gcloud run deploy pm-calendar-frontend \
  --image gcr.io/YOUR_PROJECT_ID/pm-calendar-frontend \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars AUTH_API_BASE_URL=https://YOUR_AUTH_URL,GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com,LINE_LIFF_ID=YOUR_LINE_LIFF_ID,WEB_APP_BASE_URL=https://YOUR_FRONTEND_URL
```

Notes:
1. Frontend now supports runtime env via `runtime-config.js` generated at container startup.
2. You can still use `VITE_AUTH_API_BASE_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_LINE_LIFF_ID`, and `VITE_WEB_APP_BASE_URL`, but runtime env above is recommended for Cloud Run.
3. No Secret Manager mount is required on frontend service.

## 3) Google OAuth Console Settings

In Google Cloud Console -> OAuth Client (Web application):
1. `Authorized JavaScript origins`: add frontend URL only, example `https://pm-calendar-frontend-xxxxx-uc.a.run.app`
2. `Authorized redirect URIs`: must include backend callback URL:
   - `https://YOUR_AUTH_URL/google/calendar/callback`

## 4) Required IAM

For auth service account:
1. `Cloud Datastore User`
2. `Secret Manager Secret Accessor`

## 5) Quick Debug Checklist (If Login/Google button still fails)

1. Frontend service env has `AUTH_API_BASE_URL`, `GOOGLE_CLIENT_ID`, `LINE_LIFF_ID`, and `WEB_APP_BASE_URL`.
2. Auth `/health` returns `ok: true`, `googleClientConfigured: true`, `googleCalendarOAuthConfigured: true`.
3. `CLIENT_ORIGIN` on auth exactly matches frontend URL.
4. OAuth `Authorized JavaScript origins` exactly matches frontend URL.
5. OAuth `Authorized redirect URIs` includes `https://YOUR_AUTH_URL/google/calendar/callback`.
6. Browser console has no CORS error and no popup-blocked error.
