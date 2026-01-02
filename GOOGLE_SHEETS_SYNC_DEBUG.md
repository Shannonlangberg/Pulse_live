# Google Sheets Sync Debugging Guide

## Issue
UAL (Attendance) recording is working in the database but **not syncing to Google Sheets** anymore.

## Changes Made

### 1. Added Diagnostic Endpoint
**New Endpoint:** `GET /api/debug/sheets-sync-status`

This endpoint checks the current state of Google Sheets initialization:
- Whether `sheet`, `client`, and `finance_sheet` variables are initialized
- Which environment variables are set
- Whether sync will happen or not

**How to use:**
```bash
curl http://localhost:5000/api/debug/sheets-sync-status
```

Or visit in browser: `http://localhost:5000/api/debug/sheets-sync-status`

Expected output:
```json
{
  "status": "success",
  "sheet_initialized": true/false,
  "client_initialized": true/false,
  "finance_sheet_initialized": true/false,
  "env_vars": {
    "GOOGLE_SHEETS_CREDENTIALS_BASE64": true/false,
    "GOOGLE_SHEETS_CREDENTIALS": true/false,
    "GOOGLE_SHEET_NAME": "Stats"
  },
  "will_sync_to_sheets": true/false,
  "message": "..."
}
```

### 2. Enhanced Logging
Added comprehensive logging throughout the sync process:

**In `save_attendance_record()`:**
- Logs when attempting to sync to Google Sheets
- Logs the state of `sheet` and `client` variables
- Logs success/failure of sync with clear indicators (✓ / ✗)
- Full stack traces on errors

**In `sync_to_google_sheets()`:**
- Logs at the start of sync with campus/date info
- Logs global variable states
- Logs region-specific sheet detection
- Logs sheet opening success/failure
- Logs row append operation
- Full stack traces on any errors

**Log Markers to Search For:**
- `[SAVE_ATTENDANCE]` - Main save operation logs
- `[SHEETS_SYNC]` - Google Sheets sync operation logs

### 3. Fixed Sync Logic
Changed the condition from:
```python
if sheet:  # Only check sheet
```

To:
```python
if sheet or client:  # Check both sheet AND client
```

This ensures sync happens if either the global `sheet` or `client` variable is initialized.

## How to Diagnose the Problem

### Step 1: Check Initialization Status
1. Start your Flask app
2. Visit or curl: `http://localhost:5000/api/debug/sheets-sync-status`
3. Check the response:
   - If `will_sync_to_sheets` is `false`, Google Sheets is not initialized
   - Check which `env_vars` are set

### Step 2: Check Environment Variables
The app tries to initialize Google Sheets using these variables (in order):
1. `GOOGLE_SHEETS_CREDENTIALS_BASE64` (preferred for Railway)
2. `GOOGLE_SHEETS_CREDENTIALS` (plain JSON)
3. `credentials.json` file in root
4. `credentials.json` file in backend/

Make sure at least ONE of these is available.

### Step 3: Check Application Logs
When you save a UAL record, look for these log patterns:

**Successful sync:**
```
[SAVE_ATTENDANCE] Record saved to database - ID: 123, Campus: ..., Date: ...
[SAVE_ATTENDANCE] Attempting Google Sheets sync - sheet: True, client: True
[SHEETS_SYNC] Starting sync for Campus XYZ on 2026-01-02
[SHEETS_SYNC] Global variables - sheet: True, client: True
[SHEETS_SYNC] Using region-specific sheet for ...
[SHEETS_SYNC] Successfully opened region sheet: ...
[SHEETS_SYNC] Appending row with X values to sheet with Y headers
[SHEETS_SYNC] Successfully appended row to Google Sheets
[SAVE_ATTENDANCE] ✓ Successfully synced to Google Sheets
```

**Failed sync (not initialized):**
```
[SAVE_ATTENDANCE] ✗ Skipping Google Sheets sync - sheet and client are both None
```

**Failed sync (error during sync):**
```
[SAVE_ATTENDANCE] Attempting Google Sheets sync - sheet: True, client: True
[SHEETS_SYNC] Starting sync for ...
[SHEETS_SYNC] ✗ Failed to ... : [error message]
[SHEETS_SYNC] Traceback: ...
[SAVE_ATTENDANCE] ✗ Sync to Google Sheets returned False
```

### Step 4: Check Google Sheets Configuration
For multi-region setup, each region needs:
- `sheets_spreadsheet_id` configured in the `regions` table
- `sheets_stats_tab` (defaults to 'Stats')

The Google Service Account needs:
- **Editor** access to the spreadsheet
- Share the sheet with the service account email (found in credentials JSON)

## Common Issues and Solutions

### Issue 1: `will_sync_to_sheets: false`
**Cause:** Google Sheets client not initialized  
**Solution:** Check environment variables are set correctly

### Issue 2: "Google Sheets client not available (client is None)"
**Cause:** Environment variables not loaded or credentials invalid  
**Solution:** 
- Verify credentials are valid JSON
- Check service account has access to sheets
- Try re-encoding credentials to base64

### Issue 3: "Failed to open region sheet"
**Cause:** Region-specific spreadsheet ID incorrect or no access  
**Solution:**
- Check `sheets_spreadsheet_id` in regions table
- Verify service account has access to that specific sheet
- Check `sheets_stats_tab` name matches actual tab name

### Issue 4: "Failed to append row to Google Sheets"
**Cause:** API quota exceeded, permissions issue, or malformed data  
**Solution:**
- Check Google API quotas
- Verify all required columns exist in sheet
- Check for rate limiting (2 second delay between calls)

## Testing the Fix

### Test 1: Check Status
```bash
curl http://localhost:5000/api/debug/sheets-sync-status
```

Should return `will_sync_to_sheets: true`

### Test 2: Create a Test Record
1. Log into the app
2. Submit a UAL/attendance record
3. Check the application logs for `[SHEETS_SYNC]` messages
4. Verify the record appears in Google Sheets
5. Check the database: `synced_to_sheets` column should be `true`

### Test 3: Check Database Sync Status
```sql
SELECT id, campus_id, date, synced_to_sheets, created_at 
FROM attendance_records 
ORDER BY created_at DESC 
LIMIT 10;
```

Records with `synced_to_sheets = 1` successfully synced.

## Quick Fix Commands

### Re-encode Credentials for Railway
```bash
cat credentials.json | base64 | tr -d '\n'
```

Then set as `GOOGLE_SHEETS_CREDENTIALS_BASE64` environment variable.

### Check Credentials Email
```bash
cat credentials.json | grep client_email
```

Make sure this email has **Editor** access to your Google Sheets.

## Need More Help?

If the issue persists:
1. Save the output from `/api/debug/sheets-sync-status`
2. Save relevant log lines with `[SHEETS_SYNC]` prefix
3. Verify the service account email has access to sheets
4. Check Railway environment variables are set correctly

The sync is **non-fatal** - if it fails, the record still saves to the database. The sync runs asynchronously after the database save, so the primary data is always safe.

