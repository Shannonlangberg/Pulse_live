#!/bin/bash
# Trigger redeploy to run fix_all_attendance_records.py - 2025-12-23 (third run)

echo "=== Starting Futures Link ==="
echo "Working directory: $(pwd)"

# Ensure we're in the backend directory
if [ -d "backend" ]; then
  cd backend
  echo "Changed to backend directory"
elif [ -f "app.py" ]; then
  echo "Already in backend directory"
else
  echo "ERROR: Cannot find backend directory or app.py"
  exit 1
fi

echo "Current directory: $(pwd)"
echo "Listing files:"
ls -la | head -20

echo ""
echo "Checking critical files:"
[ -f "app.py" ] && echo "✓ app.py exists" || echo "✗ app.py MISSING"
[ -f "users.json" ] && echo "✓ users.json exists" || echo "✗ users.json MISSING"
[ -f "campuses.json" ] && echo "✓ campuses.json exists" || echo "✗ campuses.json MISSING"
[ -f "models.py" ] && echo "✓ models.py exists" || echo "✗ models.py MISSING"

echo ""
echo "Environment variables:"
echo "PORT=$PORT"
echo "PYTHONUNBUFFERED=$PYTHONUNBUFFERED"

echo ""
echo "=== Running Database Migration ==="

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
  TIMEOUT=${GUNICORN_TIMEOUT:-300}
  echo "Using gunicorn with workers=$WORKERS threads=$THREADS timeout=$TIMEOUT"
  exec gunicorn --bind "0.0.0.0:${PORT:-8080}" \
    --workers "$WORKERS" \
    --threads "$THREADS" \
    --timeout "$TIMEOUT" \
    --limit-request-line 8190 \
    --limit-request-field_size 8190 \
    app:app
else
  echo "gunicorn not found, falling back to python app.py (development server)"
  exec python -u app.py
fi

