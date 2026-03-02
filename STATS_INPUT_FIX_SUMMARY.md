# Stats Input & Edit Fix Summary

## Issues Fixed

### 1. **Backend Keys Overwriting Frontend Keys During Edit**
**Problem:** When editing an existing entry, both backend keys (`"First Time Christians"`) and frontend keys (`"First Time Decision"`) were stored in state/ref. During payload construction, we iterated over ALL keys, causing backend keys to overwrite the mapped values.

**Fix:** Modified `handleEditFromRecent` to ONLY store frontend keys. Backend keys are now mapped to their frontend equivalents and only the frontend key is stored.

**File:** `frontend/src/pages/LogStats.jsx` (lines 384-394)

### 2. **Sending Empty Fields as 0 During Edits**
**Problem:** When editing, we were sending ALL fields (even untouched ones) as `0` to the backend. The backend's conditional update logic (`if (not existing or 'Field Name' in data)`) would then overwrite untouched fields with `0`.

**Fix:** Changed payload construction to ONLY send non-empty fields. Now we iterate over `nonEmptyStats` instead of all `latestStats` keys.

**File:** `frontend/src/pages/LogStats.jsx` (lines 473-480)

### 3. **Removed DOM Reading That Was Corrupting Ref**
**Problem:** `getStatsForSubmit` was reading ALL inputs from DOM and overwriting `latestValuesRef.current`, which could contain stale values for controlled inputs.

**Fix:** Simplified `getStatsForSubmit` to just merge `quickInputStats` (initial values) with `latestValuesRef.current` (user changes). No more DOM reads.

**File:** `frontend/src/pages/LogStats.jsx` (lines 67-76)

## How It Works Now

### New Entry Flow:
1. User clicks "Start Input" → `latestValuesRef.current` is initialized with empty stats
2. User types in fields → `onChange` calls `updateStat` → updates `latestValuesRef.current` synchronously
3. User clicks "Save" → `getStatsForSubmit` merges initial state + ref changes
4. Only non-empty fields are sent to backend
5. Backend creates new record with provided fields

### Edit Entry Flow:
1. User clicks "Edit" on recent entry → `handleEditFromRecent` loads entry data
2. Backend keys are mapped to frontend keys (e.g., `"First Time Christians"` → `"First Time Decision"`)
3. ONLY frontend keys are stored in `quickInputStats` and `latestValuesRef.current`
4. User modifies fields → `onChange` updates `latestValuesRef.current` synchronously
5. User clicks "Save" → `getStatsForSubmit` merges initial + changes
6. Only non-empty fields are sent to backend
7. Backend finds existing record and updates ONLY the provided fields (preserves untouched fields)

## Field Mappings (Frontend → Backend)

| Frontend Key | Backend Key |
|--------------|-------------|
| First Time | First Time Visitors |
| First Time Decision | First Time Christians |
| Rededication | Rededications |
| Youth Total | Youth Attendance |
| Youth NP | Youth New People |
| Kids Salvations | New Kids Salvations |
| Cards Returned | Cards Back |

## Backend Update Logic

The backend uses conditional updates for existing records:
```python
record.field = int(data.get('Backend Key', 0) or 0) if (not existing or 'Backend Key' in data) else (record.field or 0)
```

This means:
- If it's a NEW record → use provided value (or 0 if not provided)
- If it's an EXISTING record AND the key is in the data → update it
- If it's an EXISTING record AND the key is NOT in the data → keep old value

**This is why we now only send non-empty fields!**

## Testing Checklist

### New Entry:
- [ ] Select a campus
- [ ] Enter stats for multiple fields (e.g., "First Time": 5, "Saints": 10, "Youth Total": 20)
- [ ] Click "Save Stats"
- [ ] Verify success message
- [ ] Check dashboard shows correct values
- [ ] Check database has correct values

### Edit Entry:
- [ ] Click "Edit" on a recent entry
- [ ] Verify all existing values are loaded correctly
- [ ] Change ONE field (e.g., change "First Time Decision" from 5 to 10)
- [ ] Click "Save Stats"
- [ ] Verify success message
- [ ] Check dashboard shows updated value for changed field
- [ ] Check dashboard shows UNCHANGED values for other fields (not reset to 0)
- [ ] Check database has correct values

### Multiple Campuses:
- [ ] Test with Adelaide City
- [ ] Test with Adelaide North
- [ ] Test with Adelaide South
- [ ] Test with any Indonesian campus
- [ ] Verify each campus can create new entries
- [ ] Verify each campus can edit existing entries
- [ ] Verify dashboard shows correct data for each campus

## Debug Logs

The following console logs are available for debugging:

### Frontend (Browser Console):
- `[UPDATE_STAT]` - Shows when a field is updated via onChange
- `[GET_STATS]` - Shows the ref and state values before merging
- `[SUBMIT_DEBUG]` - Shows the full payload being sent to backend
- `[EDIT_FROM_RECENT]` - Shows the entry being loaded for editing

### Backend (Server Logs):
- `[SAVE_ATTENDANCE]` - Shows received data and field mappings
- `[QUICK_INPUT]` - Shows incoming request data
- `[EDIT_REQUEST]` - Shows edit request details

## Known Limitations

1. **Service Times:** Dynamic service times (e.g., "7:00PM (Brazilian)") are supported but must be configured in campus settings
2. **Calculated Fields:** `Total Attendance` is calculated by backend, not sent from frontend
3. **Google Sheets Sync:** Dual-write to Google Sheets is attempted but non-fatal if it fails

## Files Modified

1. `frontend/src/pages/LogStats.jsx` - Main stats input component
2. `backend/app.py` - Backend save logic (no changes in this fix, but documented for reference)

## Deployment

Changes have been deployed via git push to Railway. The deployment should be live within 2-3 minutes.

## Next Steps

1. Test with real data across multiple campuses
2. Verify dashboard displays are correct
3. Check Google Sheets sync is working
4. Monitor server logs for any errors
