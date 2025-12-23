# 🚂 Running Migration on Railway Production

## ⚠️ **Important Context**

The migration script you ran earlier was **local** (on your Mac). Your **Railway production database** still needs to be populated with historical data from Google Sheets.

### Why Regional Dashboards Are Empty:
- ✅ **Individual campus dashboards** read from Google Sheets (working)
- ❌ **Regional dashboards** read from database (empty on Railway)
- ✅ **Today's submissions** are dual-written (Google Sheets + Database)
- ❌ **Historical data** (before today) is only in Google Sheets

---

## 🎯 **Solution: Run Migration on Railway**

### **Method 1: Railway CLI (Recommended)**

1. **Install Railway CLI** (if not already installed):
```bash
npm i -g @railway/cli
```

2. **Login to Railway**:
```bash
railway login
```

3. **Link to your project**:
```bash
cd /Users/shannonlangberg/Pulse_LIVE/Pulse_live
railway link
```

4. **Run the migration on Railway**:
```bash
railway run python backend/migrate_sheets_to_db.py
```

This will:
- ✅ Connect to your Railway production database
- ✅ Pull data from Google Sheets
- ✅ Populate `attendance_records` table with historical data
- ✅ Make regional dashboards show all data

---

### **Method 2: Railway Dashboard (One-Time Command)**

1. Go to: https://railway.app/dashboard
2. Select your **Pulse_live** project
3. Click on your **backend service**
4. Go to **Settings** → **Deploy**
5. Under **Start Command**, temporarily add:
```
python migrate_sheets_to_db.py && gunicorn app:app
```

6. Click **Save** and **Redeploy**
7. Watch the logs - you'll see the migration run
8. After successful migration, change Start Command back to:
```
gunicorn app:app
```

---

### **Method 3: Railway Console (Interactive)**

1. Go to Railway Dashboard
2. Select your service
3. Open **Console** tab (if available in your plan)
4. Run:
```bash
cd backend && python migrate_sheets_to_db.py
```

---

## ✅ **After Migration - What to Verify:**

### 1. **Weekly Submission Tracker**
- Go to: Dashboard home
- Check indicator lights
- ✅ Copper Coast should show as submitted (green)
- ✅ New US campus should show as submitted (green)

### 2. **Australia Regional Dashboard**
- Go to: Dashboard → Australia → National Overview
- ✅ Should show ~39+ historical records
- ✅ Charts populated with trends
- ✅ Campus breakdown visible

### 3. **US Regional Dashboard**
- Go to: Dashboard → United States → National Overview
- ✅ Should show today's submission + any historical US data
- ✅ Regional stats aggregated correctly

### 4. **Individual Campus Dashboards**
- Click: Copper Coast (or any campus)
- ✅ All historical data visible
- ✅ Charts showing long-term trends
- ✅ Stats match Google Sheets

---

## 🔄 **Future State (After Migration):**

Once migration runs on Railway:

1. ✅ **Historical data**: In database (from Google Sheets)
2. ✅ **New submissions**: Dual-write (Google Sheets + Database)
3. ✅ **Individual dashboards**: Read from Google Sheets (backup)
4. ✅ **Regional dashboards**: Read from Database (now populated!)
5. ✅ **Data persistence**: Railway volume ensures nothing is lost
6. ✅ **New campuses**: Immediately saved to database

---

## 🐛 **Troubleshooting**

### If Migration Fails:

1. **Check Railway logs** for error messages
2. **Verify Google Sheets credentials** are set:
   - `GOOGLE_SHEETS_CREDENTIALS_BASE64` or
   - `GOOGLE_SHEETS_CREDENTIALS`
3. **Check database volume** is mounted (`/data`)
4. **Verify campuses exist** in `campuses_v2` table

### Expected Output:
```
🚀 Starting Google Sheets to Database Migration
================================================================================
📊 MIGRATING GOOGLE SHEETS DATA TO DATABASE
================================================================================

[1/5] Fetching data from Google Sheets...
✓ Found 40 records in Google Sheets

[2/5] Loading campus mappings...
✓ Loaded 8 campuses

[3/5] Loading regions...
✓ Loaded 4 regions

[4/5] Processing records...
  ✓ Migrated 10 records...
  ✓ Migrated 20 records...
  ✓ Migrated 30 records...
  ✓ Migrated 40 records...

[5/5] Committing 40 records to database...
✓ Successfully committed all records

================================================================================
📊 MIGRATION SUMMARY
================================================================================
✓ Migrated:  40 records
⚠ Skipped:   0 records
✗ Errors:    0 records
━ Total:     40 records
================================================================================

✅ Migration completed successfully!
```

---

## 📞 **Questions?**

- Migration script: `backend/migrate_sheets_to_db.py`
- Full guide: `MIGRATION_GUIDE.md`
- Issues? Check Railway logs and database volume status

**Ready to populate your production database!** 🚀


