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
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

---

## 2) รันเว็บ

```bash
python app.py
```

เปิดเว็บ: `http://127.0.0.1:5000/`

---
