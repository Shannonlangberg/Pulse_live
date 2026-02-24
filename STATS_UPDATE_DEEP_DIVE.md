# Stats Update Flow – Deep Dive Analysis

## Overview

This document traces the full path from clicking "Edit" on a Recent Entry to saving updated stats, including permissions, data flow, and potential gaps.

---

## 1. Frontend Flow (LogStats.jsx)

### 1.1 Page Access
- **Route**: Input page (`/input` or similar)
- **Permission check**: `useEffect` fetches `/api/session` and checks `custom_permissions.input` or role
- **Roles with input access**: superadmin, admin, senior_leadership, senior_leader, senior_pastor, lead_pastor, campus_pastor, pastor, user, member
- **Redirect**: If no input access → `navigate('/')`

### 1.2 Recent Entries List
- **Source**: `/api/recent_entries?campus={selectedCampus}`
- **Data**: Last 30 days from database (attendance_records table)
- **Campus filter**: Uses `selectedCampus` from dropdown (filtered by region)
- **Click handler**: Entire card is clickable → `handleEditFromRecent(recentEntries[index])`

### 1.3 handleEditFromRecent (lines 281–386)
1. **Refetch**: Fetches `/api/recent_entries` with cache-buster to get latest data
2. **Match entry**: Finds entry by `date` + `campus` (or campusId)
3. **Populate form**: Maps `entry.stats` to `quickInputStats` (backend keys → frontend keys)
4. **Set state**: `setEditingEntry({ originalCampus, originalDate, campusId })`, `setIsEditMode(true)`, `setShowQuickInput(true)`
5. **Campus**: Does NOT change `selectedCampus` (keeps list filter)

### 1.4 handleQuickInputSubmit (lines 387–540)
1. **Validation**: Requires `selectedCampus` and `quickInputDate` (but in edit mode uses `editingEntry.campusId` for payload)
2. **Payload**: Sends ALL stat keys (including 0) so backend doesn’t overwrite with defaults
3. **Endpoint**: `POST /api/quick_input/update` when `isEditMode`
4. **Body**:
   ```json
   {
     "campus": "adelaide_city",        // from editingEntry.campusId
     "date": "2026-02-22",
     "stats": { "Total People in Campus": 1590, "9:00 AM": 209, ... },
     "originalDate": "2026-02-22",
     "originalCampus": "adelaide_city"
   }
   ```
5. **On success**: `loadRecentEntries(true)` to refresh list, close modal, reset form

---

## 2. Backend Flow

### 2.1 quick_input_update (app.py ~14540)
- **Auth**: `@login_required`
- **Permission**: `current_user.has_permission('log_stats')` only
- **Campus check**: None – does not verify user can edit this campus
- **Lookup**: Uses `originalCampus` + `originalDate` to find existing record
- **Save**: Calls `save_attendance_record(save_data, user_id)`

### 2.2 save_attendance_record (app.py ~14201)
- **Campus lookup**: Resolves `campus` / `originalCampus` to `CampusV2` (by campus_id, display_name, name)
- **Record lookup**: If `originalCampus` + `originalDate` provided → find by those; else by `campus` + `date`
- **Update logic**: For existing records, only overwrites fields present in `data` (partial update)
- **Dual-write**: Updates database and syncs to Google Sheets

---

## 3. Permission Analysis

### 3.1 Who Has log_stats
| Role           | log_stats | recall_stats   |
|----------------|-----------|----------------|
| superadmin     | True      | True           |
| admin          | True      | True           |
| senior_leadership | True   | True           |
| senior_leader  | True      | True           |
| senior_pastor  | True      | True           |
| lead_pastor    | True      | True           |
| campus_pastor  | True      | own_campus     |
| pastor         | True      | own_campus     |
| finance        | False     | False          |
| member         | False     | False          |

### 3.2 Campus-Level Restriction (FIXED)

- **quick_input** and **quick_input_update** now call:
  ```python
  if not current_user.has_permission('log_stats', campus):
      return 403  # "You can only log/update stats for your assigned campus"
  ```
- They pass the target `campus` to `has_permission`.
- For `own_campus` roles (campus_pastor, pastor): `has_permission('log_stats', campus)` returns True only when campus matches user's assigned campus (normalized comparison).
- **Effect**: Campus pastors can only create/update stats for their own campus. Super admins, lead pastors, etc. retain full access.

### 3.3 Frontend vs Backend
- **Frontend**: `/api/campuses` filters campuses by role (e.g. campus pastors see only their campus).
- **Backend**: No check that the campus in the update matches the user’s allowed campuses.
- **Risk**: A campus pastor could call the API directly for another campus and update it.

---

## 4. Data Flow Summary

```
User clicks Recent Entry card
  → handleEditFromRecent(entry)
  → Refetch /api/recent_entries (fresh data)
  → Populate form, set editingEntry, open modal
  → User edits, clicks Save
  → handleQuickInputSubmit()
  → POST /api/quick_input/update
      { campus, date, stats, originalCampus, originalDate }
  → Backend: has_permission('log_stats') ✓
  → save_attendance_record() finds by originalCampus+originalDate
  → Updates record in DB, syncs to Sheets
  → loadRecentEntries(true) refreshes list
```

---

## 5. Potential Issues & Recommendations

### 5.1 Campus-Level Restriction (IMPLEMENTED)
Both `quick_input` and `quick_input_update` now use `has_permission('log_stats', campus)` so `own_campus` roles are restricted. `User.has_permission` normalizes campus strings (adelaide_city, Adelaide City, etc.) before comparing.

### 5.2 Lock Old Data (Optional)
No date-based lock exists. Consider blocking edits for entries older than X days (e.g. 7 or 14).

### 5.3 Edit vs Create
- Create: `POST /api/quick_input`
- Update: `POST /api/quick_input/update` with `originalCampus` + `originalDate`
- Both use the same `log_stats` check and the same campus-restriction gap.

### 5.4 Validation
- Backend does not validate stat ranges (e.g. negative numbers, unreasonably large values).
- Dates are parsed but not checked for future dates.

---

## 6. Files Involved

| File              | Key Functions / Routes                          |
|-------------------|-------------------------------------------------|
| LogStats.jsx      | handleEditFromRecent, handleQuickInputSubmit    |
| app.py            | quick_input, quick_input_update                 |
| app.py            | save_attendance_record                          |
| app.py            | get_recent_entries                              |
| app.py            | User.has_permission (log_stats)                 |
