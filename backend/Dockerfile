FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for pdfplumber / psycopg2 builds
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose API port
EXPOSE 8000

# Default command: run the API server
# Override with `celery -A celery_app worker --beat` for the worker container
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
