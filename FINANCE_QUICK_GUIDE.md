# Finance System - Quick Start Guide 🚀

## For Finance Team Members

### 📝 How to Input Tithe Data

1. **Log in** to Pulse LIVE
2. Go to **Portal** → **Finance Input** (or navigate to `/finance`)
3. **Select the service date** using the date picker
4. **Enter tithe amounts** for each campus:
   - General
   - Trust
   - Online Giving
   - Text
   - (Total calculates automatically)
5. Click **"Submit Tithe Data"**
6. ✅ Success! Your data is saved to both database and Google Sheets

### 👀 How to View & Edit Your Entries

1. Go to **Portal** → **Database Viewer**
2. Click the **"💰 Finance Records"** tab
3. You'll see all finance records in a table
4. Use filters to find specific records:
   - Campus dropdown
   - Start date
   - End date
5. Click **"Apply Filters"**

### ✏️ How to Edit a Record

1. Find the record you want to edit
2. Click **"Edit"** in the Actions column
3. A modal opens with editable fields
4. Change the values as needed
5. The total updates automatically
6. Click **"Save Changes"**
7. ✅ Done! The record is updated in both database and sheets

---

## For Super Admins

### 🗑️ How to Delete a Record

1. Go to **Database Viewer** → **Finance Records** tab
2. Find the record to delete
3. Click **"Delete"** in the Actions column
4. Confirm the deletion
5. ✅ Record is permanently deleted

**Note**: Only super admins can delete records. Finance team can only view and edit.

---

## 🔍 Understanding the Finance Tab

### Table Columns:
- **Date**: Service date
- **Campus**: Campus name
- **General**: General tithe amount
- **Trust**: Trust tithe amount
- **Online**: Online giving amount
- **Text**: Text giving amount
- **Total**: Sum of all amounts
- **Synced**: ✓ = synced to sheets, ⏳ = pending
- **Actions**: Edit / Delete buttons

### Filters:
- **Campus**: Filter by specific campus
- **Start Date**: Show records from this date onward
- **End Date**: Show records up to this date
- **Apply Filters**: Click to refresh with filters

---

## ✅ Data Integrity Checks

### Where is my data stored?
Your finance data is stored in **TWO places**:
1. **Database** (primary, fast access)
2. **Google Sheets** (backup, for reporting)

### What happens if I submit the same date/campus twice?
The system will **UPDATE** the existing record instead of creating a duplicate. This prevents data duplication.

### Can I see who entered the data?
Yes! Each record tracks:
- Who created it (`created_by`)
- When it was created (`created_at`)
- Who last updated it (`updated_by`)
- When it was last updated (`updated_at`)

(This info is visible in the database but not shown in the UI to keep it clean)

---

## 🆘 Common Issues

### "Access denied" error
**Problem**: You don't have finance permissions  
**Solution**: Contact your admin to assign you the "Finance" role

### Can't see Finance tab in Database Viewer
**Problem**: You don't have finance permissions  
**Solution**: Contact your admin to assign you the "Finance" role

### Data not saving
**Problem**: Network or permission issue  
**Solution**: 
1. Check your internet connection
2. Try logging out and back in
3. Contact your admin if issue persists

### Can't edit a record
**Problem**: You might not have edit permissions  
**Solution**: Ensure you're logged in with a Finance or Super Admin account

---

## 📞 Need Help?

Contact your system administrator or super admin if you:
- Need finance access permissions
- Encounter errors when submitting data
- Can't see the Finance tab
- Need to recover deleted data

---

## 🎯 Best Practices

1. **Enter data promptly** after each service
2. **Double-check amounts** before submitting
3. **Use the edit feature** if you make a mistake (don't submit twice)
4. **Review the Database Viewer** regularly to ensure data accuracy
5. **Report any discrepancies** to your admin immediately

---

**Last Updated**: January 2, 2026  
**Version**: 1.0


