# PM Calendar Auth Server

Backend for:
- Email OTP verification (via Gmail App Password)
- Local register/login
- Google OAuth sign-in (ID token verification)

## 1) Install

```bash
cd multi-project-calendar/server
npm install
```

## 2) Configure `.env`

Copy `.env.example` to `.env` and fill:

- `CLIENT_ORIGIN` = frontend URL (`http://localhost:5173` in local dev)
- `GOOGLE_CLIENT_ID` = OAuth client ID (Web application)
- `GMAIL_USER` / `GMAIL_APP_PASSWORD` = Gmail SMTP credentials
- `OTP_FROM_EMAIL` = sender address

## 3) Run local

```bash
npm run dev
```

Default: `http://localhost:8080`

## 4) Frontend env

In `multi-project-calendar/.env`:

```bash
VITE_AUTH_API_BASE_URL=http://localhost:8080
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

## 5) Deploy to Google Cloud Run

```bash
cd multi-project-calendar/server
gcloud builds submit --tag gcr.io/PROJECT_ID/pm-calendar-auth
gcloud run deploy pm-calendar-auth \
  --image gcr.io/PROJECT_ID/pm-calendar-auth \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars CLIENT_ORIGIN=https://your-frontend-domain,GOOGLE_CLIENT_ID=...,GMAIL_USER=...,GMAIL_APP_PASSWORD=...,OTP_FROM_EMAIL=...
```

Then set frontend:

```bash
VITE_AUTH_API_BASE_URL=https://your-cloud-run-url
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```
