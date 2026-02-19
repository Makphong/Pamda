FROM python:3.11-slim

WORKDIR /app

# กัน cache พัง ๆ และทำให้ log โผล่ทันที
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Cloud Run ส่งพอร์ตมาในตัวแปร PORT (ปกติ 8080)
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 app:app
