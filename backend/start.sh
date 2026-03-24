#!/bin/bash
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Starting Celery worker + beat..."
celery -A celery_app worker --beat --concurrency 2 --loglevel=info &

echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
