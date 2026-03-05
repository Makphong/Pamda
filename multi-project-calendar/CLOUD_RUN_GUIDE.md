# Cloud Run Deployment Guide (Frontend + Auth API)

This project uses:
1. `pm-calendar-frontend` (Vite static app)
2. `pm-calendar-auth` (Node.js API in `server/`)

## 1) Deploy Auth API first
Follow: `server/README.md`

After deploy, keep this URL:

```text
https://pm-calendar-auth-xxxxx-uc.a.run.app
```

## 2) Build and deploy Frontend

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

## 3) Verify production
1. Open frontend URL.
2. Register (email + OTP) should hit auth service.
3. Login with Google should work.
4. Ensure browser console has no CORS errors.
