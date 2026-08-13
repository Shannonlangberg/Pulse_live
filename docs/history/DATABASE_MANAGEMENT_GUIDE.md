# 📊 Database Management Guide

## Overview

You now have two powerful tools to manage your attendance records database:

1. **Database Viewer** - Visual web interface to see all records
2. **Reset Script** - Clean slate for fresh start

---

## 🔍 Database Viewer (Web Interface)

### Access:
Navigate to: `/database-viewer` in your app (or from Portal menu)

### Features:
- ✅ **View all attendance records** in a table
- 📅 **Filter by date range** (start date / end date)
- 🏢 **Filter by campus**
- 🔄 **Refresh** to see latest data
- 📊 **Summary stats** (total records, total attendance, sync status)
- 🗑️ **Delete individual records**

### What You See:
| Column | Description |
|--------|-------------|
| Date | Service date |
| Campus | Campus name |
| Attendance | Total attendance count |
| Kids | Kids attendance |
| Youth | Youth attendance |
| New People | First-time + visitors |
| Salvations | First-time Christians + rededications |
| Tithe | Total giving |
| Synced | ✓ (synced to Sheets) or ⏳ (pending) |
| Actions | Delete button |

---

## 🗑️ Reset Database (Script)

### When to Use:
- Database has messy/duplicate test data
- Want to start fresh from Google Sheets
- Need to clean up errors

### How to Run:

**On Railway (Production):**
```bash
# Option 1: Via Railway CLI
railway run python backend/reset_attendance_database.py

# Option 2: Via Railway Dashboard
# Settings → Deploy → Custom Start Command:
cd backend && python reset_attendance_database.py && gunicorn app:app
# (Then redeploy)
```

**Locally (Testing):**
```bash
cd backend
python reset_attendance_database.py
```

### What It Does:
1. Counts current records
2. Asks for confirmation (type 'YES')
3. Deletes ALL attendance records from database
4. **Google Sheets remains untouched** (your backup is safe!)

---

## 🔄 Fresh Start Workflow

### Recommended Process:

1. **Reset Database**
   ```bash
   python backend/reset_attendance_database.py
   ```

2. **Re-import from Google Sheets**
   ```bash
   python backend/migrate_sheets_to_db.py
   ```

3. **Verify in Database Viewer**
   - Go to `/database-viewer`
   - Check that records look correct
   - Verify attendance numbers match Google Sheets

4. **Start Logging New Stats**
   - New submissions will go to both database + Google Sheets
   - All dashboards will read from database

---

## 📋 Quick Reference

### Google Sheets = Source of Truth (For Now)
- All historical data (Oct 5 - Dec 23)
- Manual edits go here
- Backup/archive

### Database = Primary (Going Forward)
- All new submissions (Dec 23+)
- All dashboards read from here
- Fast queries, no API limits

### Dual-Write System
- New stats → **Both** database + Google Sheets
- Ensures no data loss during transition

---

## 🛠️ Troubleshooting

### "Database Viewer shows no records"
→ Database is empty - run migration script

### "Dashboards showing 0s"
→ Database has records but they're all zeros - run reset + migration

### "Recent Entries not showing"
→ Check campus filter - superadmin sees all, others see their campus

### "Can't delete a record"
→ Need admin/superadmin role

---

## 🚀 Next Steps

1. **Deploy to Railway** (~2-3 min)
2. **Access Database Viewer** at `/database-viewer`
3. **Check current state** - see if records need cleaning
4. **If needed:** Reset database and re-import from Sheets
5. **Going forward:** All new stats will work perfectly!

---

## ⚠️ Important Notes

- **Resetting database does NOT affect Google Sheets**
- **Always verify in Database Viewer after reset**
- **Migration script skips duplicates** (safe to run multiple times)
- **Individual campus dashboards** now read from database (faster!)
- **Regional dashboards** read from database (consistent!)

---

## 📞 Support

If you see any issues:
1. Check Database Viewer first
2. Compare with Google Sheets
3. Run reset + migration if needed
4. Log a test submission to verify

**Google Sheets is your safety net** - data is never lost!

