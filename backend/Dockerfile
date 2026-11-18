FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY kb/ ./kb/
COPY eval/ ./eval/
COPY seed_demo_data.py ./seed_demo_data.py

RUN mkdir -p /app/data

EXPOSE 8000

CMD ["sh", "-c", "python seed_demo_data.py && uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
