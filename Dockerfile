# Build the React frontend.
FROM node:24-bookworm-slim AS frontend

WORKDIR /build

COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
RUN npm run build


# Prepare the Python server.
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ANONYMIZED_TELEMETRY=False \
    PORT=8000

WORKDIR /app

COPY requirements-demo.txt ./
RUN pip install --no-cache-dir -r requirements-demo.txt

COPY scripts/ ./scripts/

# Keep seed data outside the directory mounted as persistent storage.
COPY data/saudi_crm_customers_synthetic.csv ./seed/

COPY --from=frontend /build/dist ./frontend/dist/

# Run the application as an unprivileged user.
RUN useradd --create-home --uid 10001 crm \
    && mkdir -p /app/data \
    && chown crm:crm /app/data

USER crm

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.getenv('PORT', '8000') + '/health', timeout=4)"

CMD ["python", "scripts/start_demo.py"]