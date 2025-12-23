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
echo "=== Running Database Migration ==="
cd backend

# Run migration script first
echo "📊 Migrating Google Sheets data to database..."
if python migrate_sheets_to_db.py; then
  echo "✅ Migration completed successfully!"
else
  echo "⚠️  Migration failed or skipped - continuing with server startup"
fi

# Fix ALL attendance records with correct field mapping
echo ""
echo "🔧 Fixing ALL attendance records with correct 'Total People in Campus' field..."
if python fix_all_attendance_records.py; then
  echo "✅ Data fix completed successfully!"
else
  echo "⚠️  Data fix failed or skipped - continuing with server startup"
fi

echo ""
echo "=== Starting Python app ==="

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

