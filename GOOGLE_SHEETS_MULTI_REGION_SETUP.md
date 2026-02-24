# 🔧 Multi-Region Google Sheets Backup - Setup Guide

## ✅ What Just Got Fixed

Your Google Sheets backup system now supports **separate sheets per region**!

### Before (Broken)
- All regions tried to sync to ONE global sheet
- US/Indonesia/Brazil stats might have been failing silently
- No clean separation between regions

### After (Fixed!)
- Each region can have its own Google Sheet
- Australia stats → Australia Sheet
- US stats → US Sheet (once configured)
- Clean data separation and regional access control

---

## 🚀 Quick Start - Test It Now

### Step 1: Check Australia (Should Already Work)

1. Log some stats for an Australia campus
2. Check your existing Australia Google Sheet
3. The new entry should appear! ✅

**Why it works:** Your Australia region likely already has the `sheets_spreadsheet_id` configured in the database, OR it's using the fallback to the global `GOOGLE_SHEET_NAME` environment variable.

---

## 🌎 Setup Additional Regions (US, Indonesia, Brazil)

### Option A: Use Existing Australia Sheet for All (Easiest)

**Do nothing!** The system will fall back to your global Australia sheet.

**Pros:**
- ✅ Zero setup
- ✅ All data in one place

**Cons:**
- ❌ Mixed currencies (AUD, USD, IDR, BRL)
- ❌ All regions see each other's data
- ❌ Harder to grant region-specific access

---

### Option B: Create Separate Sheets Per Region (Recommended)

Follow these steps for each region you want to set up:

#### For US Region:

**Step 1: Create the Google Sheet (2 minutes)**

1. Go to Google Drive
2. Copy your Australia sheet (to keep the column structure)
3. Rename it to "Futures Link US Stats"
4. Clear all data rows (keep headers)
5. Share it with:
   - Your US team members
   - Ps Ashley (needs access to all regions)
   - Your service account email (from `GOOGLE_SHEETS_CREDENTIALS`)

**Step 2: Get the Sheet ID (30 seconds)**

1. Open the new US sheet
2. Look at the URL:
   ```
   https://docs.google.com/spreadsheets/d/1abc123xyz789/edit
                                           ↑ Copy this ID
   ```
3. Copy the long ID between `/d/` and `/edit`

**Step 3: Update Database (1 minute)**

Run this SQL command in your Railway database:

```sql
UPDATE regions 
SET sheets_spreadsheet_id = 'YOUR_US_SHEET_ID_HERE',
    sheets_stats_tab = 'Stats',
    sheets_finance_tab = 'Tithe'
WHERE code = 'US';
```

**How to run it:**
- Railway Dashboard → Your Service → Data tab → Query tab
- Paste the SQL
- Replace `YOUR_US_SHEET_ID_HERE` with the ID from Step 2
- Click "Run Query"

**Step 4: Test It! (1 minute)**

1. Go to Pulse → Input page
2. Select a US campus
3. Log some test stats
4. Check the US Google Sheet → New row should appear! 🎉

---

#### For Indonesia Region:

Repeat the same steps but use:
- Sheet name: "Futures Link Indonesia Stats"
- SQL: `WHERE code = 'ID'`

---

#### For Brazil Region:

Repeat the same steps but use:
- Sheet name: "Futures Link Brazil Stats"
- SQL: `WHERE code = 'BR'`

---

## 📊 How It Works Now

### When someone logs stats:

```
1. User inputs stats for "Paradise Campus" (Australia)
   ↓
2. System saves to DATABASE ✅
   ↓
3. System checks: Does Australia region have sheets_spreadsheet_id?
   ├─ YES → Sync to Australia-specific sheet ✅
   └─ NO  → Fall back to global GOOGLE_SHEET_NAME sheet ✅
```

### For multi-region setup:

```
Australia Campus → Database + Australia Sheet
US Campus        → Database + US Sheet
Indonesia Campus → Database + Indonesia Sheet
Brazil Campus    → Database + Brazil Sheet
```

---

## 🔍 How to Check Current Configuration

### Option 1: Railway Dashboard Query

```sql
SELECT 
  code,
  name,
  sheets_spreadsheet_id,
  sheets_stats_tab,
  sheets_finance_tab
FROM regions
WHERE active = 1;
```

**Expected Output:**
```
code | name      | sheets_spreadsheet_id | sheets_stats_tab | sheets_finance_tab
-----|-----------|----------------------|------------------|-------------------
AU   | Australia | 1abc123xyz789        | Stats            | Tithe
US   | USA       | NULL (or your US ID) | Stats            | Tithe
ID   | Indonesia | NULL (or your ID ID) | Stats            | Tithe
BR   | Brazil    | NULL (or your BR ID) | Stats            | Tithe
```

### Option 2: Check Railway Logs

After logging stats, look for these log messages:

```
[SHEETS_SYNC] Using region-specific sheet for Australia: 1abc123xyz789...
[SHEETS_SYNC] Successfully opened region sheet: Australia/Stats
[SHEETS_SYNC] Successfully synced record to Google Sheets: Paradise - 2025-01-02
```

OR (if no region sheet configured):

```
[SHEETS_SYNC] No region-specific sheet configured, using global sheet
```

---

## ❓ FAQ

### Q: Do I NEED to set up separate sheets?

**A:** No! The system will fall back to your global Australia sheet if no region-specific sheet is configured. It will still work.

### Q: What if I only want to set up US and leave the others?

**A:** That's fine! Set up US with its own sheet, and Australia/Indonesia/Brazil will use the global fallback sheet.

### Q: Can I move existing data to region-specific sheets?

**A:** Yes! Export from your global sheet, filter by campus/region, and import to the region-specific sheet. But the database already has all the data, so this is optional.

### Q: What if my service account doesn't have access to the new sheet?

**A:** The sync will fail silently (logged as a warning). The data will still be saved to the database, but won't backup to Google Sheets. Just share the sheet with your service account email.

### Q: How do I find my service account email?

**A:** It's in your `GOOGLE_SHEETS_CREDENTIALS` environment variable. Look for the `client_email` field. Usually looks like:
```
pulse-stats@your-project.iam.gserviceaccount.com
```

---

## 🎯 Recommended Setup

For your organization, I recommend:

1. **Australia**: Use existing sheet (already working)
2. **US**: Create new US sheet (launching now, worth 5 minutes to set up)
3. **Indonesia**: Create new sheet before launch
4. **Brazil**: Create new sheet before launch

This gives you:
- ✅ Clean data separation
- ✅ Regional access control (Indo team only sees Indo sheet)
- ✅ Currency clarity (each sheet in its own currency)
- ✅ Better performance (smaller sheets load faster)
- ✅ Data sovereignty (Indo data in Indo-accessible sheet)

**Total time: ~20 minutes** (5 min per region × 4 regions, but Australia is done)

---

## 🚨 Troubleshooting

### Sync not working?

1. **Check Railway logs** for `[SHEETS_SYNC]` messages
2. **Verify service account access**: Share the sheet with your service account email
3. **Confirm sheet ID is correct**: Check the database with the SQL query above
4. **Check sheet tab name**: Must be "Stats" (case-sensitive) or match `sheets_stats_tab` in database

### How to fix a wrong sheet ID?

```sql
UPDATE regions 
SET sheets_spreadsheet_id = 'CORRECT_SHEET_ID_HERE'
WHERE code = 'US';  -- or AU, ID, BR
```

### How to disable region-specific sheet (use global fallback)?

```sql
UPDATE regions 
SET sheets_spreadsheet_id = NULL
WHERE code = 'US';  -- or AU, ID, BR
```

---

## 📝 Next Steps

After Railway finishes deploying (~3 minutes):

1. ✅ Test Australia - log stats, check existing sheet
2. ⏭️ Decide: Separate sheets per region? (recommended) OR all regions to one sheet?
3. ⏭️ If separate sheets: Follow "Setup Additional Regions" steps above
4. ✅ Verify: Check Railway logs for `[SHEETS_SYNC]` success messages

---

**Your Google Sheets backup is now multi-region ready! 🚀**








