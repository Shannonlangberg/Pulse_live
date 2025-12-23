#!/bin/bash
# Railway Migration Runner
# This script is designed to run on Railway to populate the production database

echo "🚀 Starting Railway Database Migration..."
echo "========================================"

# Check if we're in Railway environment
if [ -z "$RAILWAY_ENVIRONMENT" ]; then
    echo "⚠️  Warning: RAILWAY_ENVIRONMENT not set. This should run on Railway."
fi

# Check for required environment variables
if [ -z "$GOOGLE_SHEETS_CREDENTIALS_BASE64" ] && [ -z "$GOOGLE_SHEETS_CREDENTIALS" ]; then
    echo "❌ Error: Google Sheets credentials not found!"
    echo "Set GOOGLE_SHEETS_CREDENTIALS_BASE64 or GOOGLE_SHEETS_CREDENTIALS"
    exit 1
fi

# Check database path
if [ ! -z "$DATABASE_PATH" ]; then
    echo "✓ Database path: $DATABASE_PATH"
else
    echo "✓ Using default database location"
fi

# Run the migration
echo ""
echo "Running migration script..."
python migrate_sheets_to_db.py

# Capture exit code
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo "✅ Regional dashboards will now show historical data"
else
    echo ""
    echo "❌ Migration failed with exit code: $EXIT_CODE"
    echo "Check logs above for details"
fi

exit $EXIT_CODE

