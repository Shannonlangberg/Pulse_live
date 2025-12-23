# Service Breakdown "1 Service" Issue

## Date: December 23, 2025

## Problem
Dashboard shows "1 service" for Copper Coast in the last 30 days, when it should show ~4 services (4 Sundays).

## Root Cause
1. **Database is EMPTY** - Has 0 records for ALL campuses
2. **Currently using Google Sheets fallback** - Dashboard works but service breakdown may be incomplete
3. **Migration script fails** - Cannot import Google Sheets data due to duplicate column headers error

## Current Status
- ✅ Dashboard metrics are correctly showing averages (129, 114, etc.)
- ❌ Database has no data (needs to be populated from Google Sheets)
- ❌ Service breakdown shows incorrect count (shows 1 instead of 4)
- ⚠️ Migration script error: "the header row in the worksheet is not unique"

## Investigation Results

### Database Status
```bash
✓ Found campus: Copper Coast (ID: 6, campus_id: copper_coast)
📊 Total records for Copper Coast: 0
📊 Total records in entire database: 0
```

### Migration Error
```
[1/5] Fetching data from Google Sheets...
❌ Migration failed: the header row in the worksheet is not unique
```

## Why Service Breakdown Shows "1 Service"

When using Google Sheets as fallback, the `calculate_service_breakdown()` function (line 5883-6037 in app.py) should:
1. Loop through all filtered_rows (e.g., 4 rows for 4 Sundays)
2. For each row, extract service time data (9:00 AM, 10:00 AM, 11:00 AM, etc.)
3. Increment the `count` for each service time found
4. Calculate `average = total / count`

The fact that it shows "1 service" suggests either:
- Only 1 row in Google Sheets for the last 30 days (unlikely)
- The `count` isn't being incremented properly (bug in aggregation)
- Frontend is displaying the wrong value

## Recommended Solutions

### Option 1: Fix Google Sheets Duplicate Headers (RECOMMENDED)
1. Open the Google Sheets "Stats" tab
2. Look for duplicate column headers in row 1
3. Rename or remove duplicates (e.g., if "Total Attendance" appears twice, rename second to "Total Attendance 2")
4. Run migration script: `/usr/bin/python3 backend/migrate_sheets_to_db.py`
5. This will populate the database with all historical data
6. Future dashboard queries will use database (faster, more reliable)

### Option 2: Debug Service Breakdown Count
Check if the issue is in how the count is being calculated:
1. Add logging to see how many rows are being processed
2. Verify `service_breakdown[service_time]['count']` is incrementing
3. Check if the modal is displaying `service.count` correctly

### Option 3: Manual Database Population
If migration script continues to fail:
1. Use the Input page to manually enter recent attendance records
2. This will populate the database going forward
3. Historical data will remain in Google Sheets only

## Files Involved

### Backend (`backend/app.py`)
- Line 5883-6037: `calculate_service_breakdown()` - Builds service breakdown from Google Sheets
- Line 6685-6707: Database service breakdown aggregation
- Line 7486: Calls `calculate_service_breakdown()` for Google Sheets data
- Line 7802-7803: Returns service_breakdown in API response

### Frontend (`frontend/src/pages/CampusDashboard.jsx`)
- Line 370-377: Parses service_breakdown from API response
- Line 1296-1340: Displays service breakdown in modal
- Line 1323: Displays service count (`{service.count} services`)

## Next Steps

1. **Immediate**: Check Google Sheets for duplicate column headers
2. **Fix Headers**: Rename/remove duplicates in Google Sheets "Stats" tab
3. **Run Migration**: `cd backend && /usr/bin/python3 migrate_sheets_to_db.py`
4. **Verify**: Check database has records: `SELECT COUNT(*) FROM attendance_records;`
5. **Test**: Refresh dashboard and verify service count shows correctly

## Testing Checklist

Once migration is complete:
- [ ] Database has records for all campuses
- [ ] Copper Coast shows 4+ services for "Last 30 Days"
- [ ] Service breakdown modal shows correct counts
- [ ] Average calculations remain accurate
- [ ] Weekend Total = Sunday + Youth (averages)

## Technical Notes

- Migration script path: `/Users/shannonlangberg/Pulse_LIVE/Pulse_live/backend/migrate_sheets_to_db.py`
- Local database path: `/Users/shannonlangberg/Pulse_LIVE/Pulse_live/backend/instance/futures_link.db`
- Railway database: Uses environment variable for connection
- Service breakdown structure:
  ```python
  {
    '10:00 AM': {
      'total': 396,      # Sum of all 10 AM services
      'count': 4,        # Number of 10 AM services
      'average': 99.0    # 396 / 4
    }
  }
  ```

