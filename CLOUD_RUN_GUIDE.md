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
  --set-env-vars CLIENT_ORIGIN=https://YOUR_FRONTEND_URL,OTP_TTL_MINUTES=10,REQUEST_BODY_LIMIT=10mb,FIRESTORE_USERS_COLLECTION=users,FIRESTORE_OTP_COLLECTION=auth_otps,FIRESTORE_APP_DATA_COLLECTION=app_data,FIRESTORE_APP_DATA_CHUNK_COLLECTION=chunks,FIRESTORE_APP_DATA_CHUNK_SIZE=300000,FIRESTORE_PROJECT_INVITES_COLLECTION=project_invites,FIRESTORE_PROJECT_INVITES_DOC_ID=global,FIRESTORE_SCAM_REPORT_COLLECTION=admin_scam_reports,SCAM_REPORT_IMAGE_MAX_BYTES=600000,GOOGLE_OAUTH_JSON_PATH=/secrets/google/oauth.json,GOOGLE_CALENDAR_REDIRECT_URI=https://YOUR_AUTH_URL/google/calendar/callback \
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
  --set-env-vars AUTH_API_BASE_URL=https://YOUR_AUTH_URL,GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
```

Notes:
1. Frontend now supports runtime env via `runtime-config.js` generated at container startup.
2. You can still use `VITE_AUTH_API_BASE_URL` and `VITE_GOOGLE_CLIENT_ID`, but runtime env above is recommended for Cloud Run.
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

1. Frontend service env has `AUTH_API_BASE_URL` and `GOOGLE_CLIENT_ID`.
2. Auth `/health` returns `ok: true`, `googleClientConfigured: true`, `googleCalendarOAuthConfigured: true`.
3. `CLIENT_ORIGIN` on auth exactly matches frontend URL.
4. OAuth `Authorized JavaScript origins` exactly matches frontend URL.
5. OAuth `Authorized redirect URIs` includes `https://YOUR_AUTH_URL/google/calendar/callback`.
6. Browser console has no CORS error and no popup-blocked error.

## 6) Setup LINE Scam Bot (แยกจาก LINE Project Bot) แบบกดตามหน้า Console

### 6.1 สร้าง LINE Channel ใหม่ (Messaging API)
1. เปิด `LINE Developers Console` -> เลือก `Provider` ของคุณ
2. กด `Create a new channel`
3. เลือก `Messaging API`
4. กรอกชื่อช่องใหม่ เช่น `PM Scam Check Bot`
5. กด `Create`
6. เข้าแท็บ `Messaging API`
7. คัดลอกค่า:
   - `Channel secret`
   - `Channel access token (long-lived)`

### 6.2 ตั้งค่า Webhook ของบอทโกง
1. ในหน้า channel เดิม -> `Messaging API`
2. ที่หัวข้อ `Webhook URL` กด `Edit`
3. ใส่:
   - `https://YOUR_AUTH_URL/line/scam/webhook`
4. กด `Update`
5. กด `Verify` ให้ผ่าน
6. เปิดสวิตช์ `Use webhook` เป็น `Enabled`

### 6.3 สร้าง 3 LIFF App
1. ไปเมนู `LIFF` ใน channel เดียวกัน
2. กด `Add`
3. สร้าง 3 ตัวแยกกัน โดยใช้ URL ดังนี้:
   - Scammer Check: `https://YOUR_AUTH_URL/line/scam/liff/scammer-check`
   - Fake News: `https://YOUR_AUTH_URL/line/scam/liff/fake-news`
   - Risk Assess: `https://YOUR_AUTH_URL/line/scam/liff/risk-assess`
4. Scope แนะนำ:
   - `profile` (ขั้นต่ำ)
5. กด `Add` ทุกตัวให้ครบ
6. คัดลอก LIFF URL ทั้ง 3 อัน (ใช้กรอกในหน้า `LINE Bot Admin` ในแอปได้)

### 6.4 สร้าง Rich Menu 5 ปุ่ม พร้อมข้อความที่ต้องส่ง
1. ใน LINE Developers -> เมนู `Rich menu`
2. กด `Create new rich menu`
3. เลือก layout 5 ช่อง
4. ตั้ง Action แต่ละช่องเป็น `Send message` และใส่ข้อความตรงตามนี้:
   - โดนโกงแล้วทำยังไงดี -> `คำแนะนำเมื่อถูกโกง`
   - เช็คคนโกง -> `ตรวจสอบมิจฉาชีพ`
   - เช็คข่าวปลอม -> `ตรวจสอบข่าวปลอม`
   - ประเมินความเสี่ยงการโดนโกง -> `ประเมินความเสี่ยง`
   - วิธีใช้ -> `เเนะนำวิธีการใช้งาน`
5. อัปโหลดรูป Rich Menu
6. กด `Apply` ให้กับ bot channel นี้

### 6.5 เปิด Gemini API Key
1. เปิด `Google AI Studio`
2. กด `Get API key`
3. สร้าง key ใหม่ หรือเลือก project เดิม
4. คัดลอก API key

### 6.6 ใส่ Environment Variables บน Cloud Run (`pm-calendar-auth`)
1. เปิด `Cloud Run` -> เลือก service `pm-calendar-auth`
2. กด `Edit and deploy new revision`
3. ไปส่วน `Variables & Secrets`
4. กด `Add variable` แล้วเพิ่ม:
   - `LINE_SCAM_CHANNEL_SECRET=...`
   - `LINE_SCAM_CHANNEL_ACCESS_TOKEN=...`
   - `GEMINI_API_KEY=...`
   - `GEMINI_MODEL=gemini-2.5-flash`
   - `FIRESTORE_LINE_SCAM_BOT_COLLECTION=line_scam_bot`
   - `FIRESTORE_LINE_SCAM_WEBHOOK_LOG_COLLECTION=line_scam_webhook_logs`
   - `SCAM_LIFF_IMAGE_MAX_BYTES=2500000`
5. (Optional) ถ้าต้องการบังคับ URL ภายนอกเอง:
   - `LINE_SCAM_LIFF_SCAMMER_CHECK_URL=https://...`
   - `LINE_SCAM_LIFF_FAKE_NEWS_URL=https://...`
   - `LINE_SCAM_LIFF_RISK_ASSESS_URL=https://...`
6. กด `Deploy`

### 6.7 ตั้งค่าในหน้า Admin ของเว็บ
1. Login ด้วย Root Admin
2. ไป `Profile > แชทเช็คโกง`
3. กดปุ่ม `LINE Bot Admin` (ขวาของ `Add Report`)
4. ตรวจสถานะ:
   - Channel Secret = Configured
   - Channel Access Token = Configured
   - Gemini API = Configured
5. กรอก/แก้ LIFF URL ทั้ง 3 ช่อง
6. กด `Save settings`

### 6.8 ตรวจสอบหลังติดตั้ง
1. เรียก `https://YOUR_AUTH_URL/health`
2. ต้องเห็นค่า:
   - `lineScamWebhookConfigured: true`
   - `lineScamReplyConfigured: true`
   - `lineScamGeminiConfigured: true`
3. ทดลองกดแต่ละปุ่มใน Rich Menu จริงใน LINE
4. ปุ่ม `ตรวจสอบมิจฉาชีพ`, `ตรวจสอบข่าวปลอม`, `ประเมินความเสี่ยง` ต้องเปิด LIFF ได้

## 7) Setup LINE Escrow Bot (ไลน์บอทตัวกลางซื้อขาย) แบบใช้งานจริง

### 7.1 สร้าง LINE Channel แยกสำหรับ Escrow
1. เปิด `LINE Developers Console`
2. เลือก `Provider` เดิม
3. กด `Create a new channel` -> เลือก `Messaging API`
4. ตั้งชื่อเช่น `PM Escrow Bot`
5. เข้าแท็บ `Messaging API`
6. คัดลอก:
   - `Channel secret`
   - `Channel access token (long-lived)`
7. Optional one-bot mode: you can skip this separate channel and reuse Scam bot channel by setting `LINE_ESCROW_USE_SCAM_CHANNEL=true` in Cloud Run.

### 7.2 ตั้ง Webhook ของ Escrow Bot
1. ใน channel Escrow -> `Messaging API`
2. ที่ `Webhook URL` กด `Edit`
3. ใส่:
   - `https://YOUR_AUTH_URL/line/escrow/webhook`
   - If using one shared bot channel (scam+escrow in same channel), use `https://YOUR_AUTH_URL/line/scam/webhook` instead.
4. กด `Update` และ `Verify`
5. เปิด `Use webhook` เป็น `Enabled`

### 7.3 สร้าง LIFF 3 หน้า สำหรับ Escrow
1. ใช้ `LINE Login channel` (Published) สำหรับสร้าง LIFF
2. ไปเมนู `LIFF` -> `Add`
3. สร้าง 3 ตัว:
   - Deal/Pay: `https://YOUR_AUTH_URL/line/escrow/liff/deal`
   - Seller Ship: `https://YOUR_AUTH_URL/line/escrow/liff/seller`
   - Buyer Status: `https://YOUR_AUTH_URL/line/escrow/liff/buyer`
4. คัดลอก `LIFF URL` (รูปแบบ `https://liff.line.me/...`) เก็บไว้

### 7.4 เปิดใช้งาน Payment Provider (Opn / Omise)
1. สมัครบัญชีที่ `https://dashboard.omise.co/` (Opn Payments)
2. ทำ KYC/เปิดใช้งาน PromptPay QR และ Transfer ให้เรียบร้อย
3. คัดลอกคีย์:
   - `Secret key` -> ใช้เป็น `OPN_SECRET_KEY`
   - `Public key` -> ใช้เป็น `OPN_PUBLIC_KEY`
4. ตั้ง webhook จาก Opn มาที่:
   - `https://YOUR_AUTH_URL/line/escrow/payment/webhook`
5. เพิ่ม custom header ใน webhook (ถ้าระบบรองรับ):
   - `x-line-escrow-webhook-secret: <ค่าจาก LINE_ESCROW_PAYMENT_WEBHOOK_SECRET>`

### 7.5 เปิดใช้งาน Tracking API (multi-carrier)
1. สมัคร Tracking API provider (ตัวอย่าง TrackingMore)
2. สร้าง API key
3. เตรียมค่า:
   - `TRACKING_API_KEY`
   - `TRACKING_API_BASE_URL` (default: `https://api.trackingmore.com/v4`)

### 7.6 เพิ่ม Environment Variables ใน Cloud Run (`pm-calendar-auth`)
1. เปิด `Cloud Run` -> `pm-calendar-auth` -> `Edit and deploy new revision`
2. ไป `Variables & Secrets`
3. เพิ่มค่าเหล่านี้:
   - `LINE_ESCROW_CHANNEL_SECRET=...`
   - `LINE_ESCROW_CHANNEL_ACCESS_TOKEN=...`
   - `LINE_ESCROW_USE_SCAM_CHANNEL=true` (set this when you want Escrow to reuse Scam channel in one bot mode)
   - `FIRESTORE_LINE_ESCROW_BOT_COLLECTION=line_escrow_bot`
   - `FIRESTORE_LINE_ESCROW_WEBHOOK_LOG_COLLECTION=line_escrow_webhook_logs`
   - `FIRESTORE_LINE_ESCROW_DEAL_COLLECTION=line_escrow_deals`
   - `LINE_ESCROW_LIFF_DEAL_URL=https://liff.line.me/...`
   - `LINE_ESCROW_LIFF_SELLER_URL=https://liff.line.me/...`
   - `LINE_ESCROW_LIFF_BUYER_URL=https://liff.line.me/...`
   - `LINE_ESCROW_PAYMENT_PROVIDER=opn`
   - `OPN_SECRET_KEY=...`
   - `OPN_PUBLIC_KEY=...`
   - `OPN_API_BASE_URL=https://api.omise.co`
   - `TRACKING_API_KEY=...`
   - `TRACKING_API_BASE_URL=https://api.trackingmore.com/v4`
   - `LINE_ESCROW_TRACKING_PROVIDER=trackingmore`
   - `LINE_ESCROW_AUTO_RELEASE_HOURS=72`
   - `LINE_ESCROW_SLIP_IMAGE_MAX_BYTES=2500000`
   - `LINE_ESCROW_CRON_SECRET=<random-strong-secret>`
   - `LINE_ESCROW_PAYMENT_WEBHOOK_SECRET=<random-strong-secret>`
4. กด `Deploy`

### 7.7 ตั้งค่าในหน้าแอดมินเว็บ
1. Login ด้วย Root Admin
2. ไป `Profile > แชทเช็คโกง`
3. กดปุ่ม `ไลน์บอทตัวกลาง`
4. ใส่ LIFF URL ทั้ง 3 ช่อง
5. กด `Save settings`

### 7.8 ตั้ง Cloud Scheduler สำหรับ auto release (ครบ 72 ชั่วโมง)
1. เปิด `Cloud Scheduler` -> `Create job`
2. Name: `line-escrow-auto-release`
3. Frequency: ทุก 15 นาที (เช่น `*/15 * * * *`)
4. Target type: `HTTP`
5. URL:
   - `https://YOUR_AUTH_URL/line/escrow/cron/auto-release`
6. Method: `POST`
7. Header:
   - `x-cron-secret: <ค่าเดียวกับ LINE_ESCROW_CRON_SECRET>`
8. Body (optional):
   - `{}`
9. กด `Create`

### 7.9 Test Flow จริงในกลุ่ม LINE
1. เชิญ Escrow bot เข้ากลุ่ม
2. พิมพ์ `เริ่ม`
3. Bot ต้องส่ง Flex card เมนู 3 ขั้นตอน
4. ผู้ซื้อสร้างดีลและได้ QR ชำระเงินจริง
5. ผู้ขายส่งเลขพัสดุ + รูปสลิป
6. ผู้ซื้อเปิดหน้าสถานะ ดู tracking/map และยืนยันรับของ
7. ถ้าไม่กดยืนยัน ระบบต้องปล่อยเงินอัตโนมัติเมื่อครบเวลา
