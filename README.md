# PM Multi-Project Calendar (Python + HTML + CSS)

เว็บปฏิทินสำหรับ PM เพื่อบริหารหลายโปรเจกต์พร้อมกัน (สูงสุด 4 โปรเจกต์บนหน้าหลัก)
- เลือก/ยกเลิกโปรเจกต์จากปุ่มด้านบน (กดซ้ำเพื่อยกเลิก)
- เลือกช่วงเดือน/ปี (Start–End) เพื่อดูย้อนหลัง/อนาคต
- คลิก “วัน” เพื่อจดโน้ต (แยกตาม Project) — วันไหนมีโน้ตจะมี **กรอบแดง**
- ธีม Day/Night
- (ออปชัน) เชื่อม Google Calendar แบบ server-side OAuth แล้วดึงกิจกรรมมาโชว์เป็น “จุดเล็กๆ” ในวันนั้น เพื่อไม่กินพื้นที่โน้ต

> Tech Stack: **Python + HTML + CSS เท่านั้น** (ไม่มี JavaScript)

---

## 1) ติดตั้ง

### Windows / macOS / Linux
```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
```

---

## 2) รันเว็บ

```bash
# ตั้ง secret key (แนะนำ)
# Windows (PowerShell):
setx FLASK_SECRET_KEY "change-me-please"
# macOS/Linux:
export FLASK_SECRET_KEY="change-me-please"

python app.py
```

เปิดเว็บ: `http://127.0.0.1:5000/`

---

## 3) เชื่อม Google Calendar (ถ้าต้องการ)

### 3.1 สร้าง OAuth Client
1. ไปที่ Google Cloud Console
2. สร้าง/เลือก Project
3. Enable API: **Google Calendar API**
4. สร้าง Credentials → **OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URIs ใส่:
     - `http://127.0.0.1:5000/gcal/oauth2callback`

### 3.2 วางไฟล์ client secret
ดาวน์โหลดไฟล์ JSON จาก Google แล้ววางที่:
```
secrets/client_secret.json
```

รีสตาร์ทแอป แล้วกดปุ่ม **Google Calendar → Link** ที่แถบ Tools

> การล็อกอินจะ “ค้าง” ได้ เพราะ token ถูกเก็บฝั่งเซิร์ฟเวอร์ใน SQLite (instance/app.db) และ session cookie ถูกตั้งแบบ persistent

---

## โครงสร้างโปรเจกต์
- `app.py` : Flask app + SQLite + Google Calendar integration
- `templates/` : HTML templates
- `static/styles.css` : CSS ธีม minimal
- `instance/app.db` : ฐานข้อมูล (สร้างอัตโนมัติ)
- `secrets/client_secret.json` : (คุณต้องใส่เอง) Google OAuth client secret

---

## หมายเหตุ
- ลบโปรเจกต์: จะซ่อนโปรเจกต์จาก UI (โน้ตเดิมยังอยู่ใน DB แต่ไม่แสดง)
- ถ้าจะย้ายเครื่อง/backup แค่ copy `instance/app.db`

