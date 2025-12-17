#!/bin/bash

echo "=== Starting Futures Link ==="
echo "Working directory: $(pwd)"
echo "Listing files:"
ls -la backend/ | head -20

echo ""
echo "Checking critical files:"
[ -f "backend/app.py" ] && echo "✓ app.py exists" || echo "✗ app.py MISSING"
[ -f "backend/users.json" ] && echo "✓ users.json exists" || echo "✗ users.json MISSING"
[ -f "backend/campuses.json" ] && echo "✓ campuses.json exists" || echo "✗ campuses.json MISSING"

echo ""
echo "Environment variables:"
echo "PORT=$PORT"
echo "PYTHONUNBUFFERED=$PYTHONUNBUFFERED"

echo ""
echo "=== Starting Python app ==="
cd backend

if command -v gunicorn >/dev/null 2>&1; then
  WORKERS=${GUNICORN_WORKERS:-2}
  THREADS=${GUNICORN_THREADS:-4}
  TIMEOUT=${GUNICORN_TIMEOUT:-120}
  echo "Using gunicorn with workers=$WORKERS threads=$THREADS timeout=$TIMEOUT"
  exec gunicorn --bind "0.0.0.0:${PORT:-8080}" --workers "$WORKERS" --threads "$THREADS" --timeout "$TIMEOUT" app:app
else
  echo "gunicorn not found, falling back to python app.py (development server)"
  exec python -u app.py
fi

