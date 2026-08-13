# 🎯 Dual-Write System & Migration Guide

## ✅ What's Already Working

### 1. **Dual-Write System** (Database + Google Sheets)
When you log stats through the "Input" form, the system automatically:
- ✅ **Writes to Google Sheets** (backward compatibility)
- ✅ **Writes to `attendance_records` table** (new system)
- ✅ **Links to correct campus and region** via `campuses_v2` table

**Code Location:** `backend/app.py` → `save_attendance_record()` function (lines 11855-12123)

### 2. **Dashboard Data Sources**
- **Old system:** Reads from Google Sheets (via `get_dashboard_data()`)
- **New system:** Reads from `attendance_records` table
  - Regional Dashboard: `/api/dashboard/regional`
  - Weekly Submission Tracker: `/api/weekly-submission-status`

---

## 🚀 Migration Steps

### **Step 1: Run the Migration Script**

This will import all existing Google Sheets data into the database:

```bash
# SSH into Railway or run locally
cd /app/backend  # On Railway
# OR
cd backend  # Locally

# Run the migration
python3 migrate_sheets_to_db.py
```

**What it does:**
1. Reads all records from Google Sheets "Stats" tab
2. Maps each record to the correct campus in `campuses_v2`
3. Creates `AttendanceRecord` entries in the database
4. Skips duplicates (if already migrated)
5. Shows progress and summary

**Expected Output:**
```
📊 MIGRATING GOOGLE SHEETS DATA TO DATABASE
✓ Found 40 records in Google Sheets
✓ Loaded 9 campuses
✓ Migrated 38 records
⚠ Skipped 2 records
━ Total: 40 records
✅ Migration completed successfully!
```

### **Step 2: Verify Data**

After migration, verify the data is showing:

1. **Regional Dashboard:** Go to Australia → National Overview
   - Should show aggregated stats
   - Should show campus breakdown

2. **Weekly Submission Tracker:** Check the indicator lights
   - Green = Submitted this week
   - Red = Not submitted

3. **Individual Campus Dashboards:** Click any campus
   - Should show historical trends
   - Should show all metrics

---

## 🔄 Ongoing System Behavior

### **Adding New Campuses**

When you add a new campus:

1. **Via UI:** Settings → Campus Management → Create Campus
   - Writes to `campuses_v2` table
   - Automatically links to region
   - Available immediately in all dashboards

2. **What happens:**
   ```
   campuses_v2 table
   ├─ campus_id: "new_campus"
   ├─ region_id: 1 (Australia)
   ├─ display_name: "New Campus"
   └─ active: 1
   ```

### **Logging Stats**

When you log stats via "Input" form:

1. **Dual-write happens automatically:**
   ```
   Google Sheets (Stats tab)
   ├─ Row added with all fields
   └─ Backward compatible
   
   Database (attendance_records)
   ├─ Record created
   ├─ campus_id → Links to campuses_v2.id
   ├─ region_id → Links to regions.id
   └─ All metrics stored
   ```

2. **Data appears in:**
   - ✅ Google Sheets (immediately)
   - ✅ Database (immediately)
   - ✅ Regional Dashboard (immediately)
   - ✅ Weekly Submission Tracker (immediately)
   - ✅ Campus Dashboard (immediately)

### **Data Never Lost**

Your data is stored in **THREE places**:

1. **Google Sheets** - Original system, always updated
2. **Database (`attendance_records`)** - New system, always updated
3. **Railway Volume** - Database persists across deployments

**Recovery options:**
- If database corrupts → Re-run migration from Google Sheets
- If Google Sheets corrupts → Export from database
- Railway Volume → Automatic backups

---

## 🔍 Testing Checklist

After migration, test these scenarios:

### ✅ **Test 1: Submit New Stats**
1. Go to Input → Log Stats
2. Select "Copper Coast"
3. Enter attendance numbers
4. Submit
5. **Verify:**
   - [ ] Shows in Google Sheets
   - [ ] Green light appears in submission tracker
   - [ ] Shows in Australia Regional Dashboard
   - [ ] Shows in Copper Coast Campus Dashboard

### ✅ **Test 2: View Regional Dashboard**
1. Go to Dashboard → Australia → National Overview
2. **Verify:**
   - [ ] Shows total attendance
   - [ ] Shows campus breakdown
   - [ ] Shows historical trends
   - [ ] Charts display correctly

### ✅ **Test 3: Weekly Submission Tracker**
1. View Australia Campuses page
2. **Verify:**
   - [ ] Copper Coast = Green (submitted)
   - [ ] Other campuses = Red/Green based on submissions
   - [ ] Progress shows correct count (e.g., "1/8")

### ✅ **Test 4: Add New Campus**
1. Settings → Campus Management
2. Create new campus (e.g., "Test Campus")
3. **Verify:**
   - [ ] Appears in campus list immediately
   - [ ] Can select in Log Stats form
   - [ ] Appears in regional dashboard
   - [ ] Has red indicator (no submissions yet)

### ✅ **Test 5: Log Stats for New Campus**
1. Log stats for newly created campus
2. **Verify:**
   - [ ] Saves to both Google Sheets & Database
   - [ ] Indicator turns green
   - [ ] Shows in regional dashboard
   - [ ] Has its own campus dashboard

---

## 📊 Database Schema

```
regions
├─ id (1 = Australia, 2 = US)
├─ code (AU, US)
└─ display_name

campuses_v2
├─ id (auto-increment primary key)
├─ campus_id (e.g., "copper_coast")
├─ region_id → references regions.id
├─ display_name (e.g., "Copper Coast")
└─ active

attendance_records
├─ id (auto-increment primary key)
├─ campus_id → references campuses_v2.id
├─ region_id → references regions.id
├─ date
├─ total_attendance
├─ kids_attendance
├─ youth_attendance
├─ first_time_visitors
├─ baptisms
└─ ... (30+ fields)
```

---

## 🛠️ Troubleshooting

### **Issue: Migration script fails**
```bash
# Check if Google Sheets credentials are working
python3 -c "from app import sheet; print(len(sheet.get_all_records()))"
```

### **Issue: Campus not found during migration**
- Check campus names in Google Sheets match `campuses_v2.campus_id`
- The script tries multiple lookup strategies (exact, lowercase, with underscores)

### **Issue: Dashboard shows no data**
```bash
# Check if records were migrated
sqlite3 /data/futures_link.db
SELECT COUNT(*) FROM attendance_records;
SELECT campus_id, date, total_attendance FROM attendance_records LIMIT 5;
```

### **Issue: Dual-write not working**
- Check logs for `[SAVE_ATTENDANCE]` messages
- Verify `save_attendance_record()` function is being called
- Check both Google Sheets and database after submitting

---

## 🎉 Success Criteria

After migration, you should have:

✅ All historical data in database  
✅ Regional dashboards showing data  
✅ Weekly submission tracker working  
✅ New submissions going to both systems  
✅ No data loss (Google Sheets still updated)  
✅ Zero downtime (both systems work in parallel)

---

## 📝 Next Steps

1. **Run migration script** (takes ~30 seconds)
2. **Test all dashboards** (5 minutes)
3. **Submit test stat** for Copper Coast (verify dual-write)
4. **Monitor logs** for any errors

Once verified, the system is production-ready! 🚀


