"""
Quick migration script - imports Google Sheets data without full app initialization
"""
import sys
import os

# Minimal imports
print("Starting quick migration...")

try:
    # First, let's just test Google Sheets connection
    import gspread
    from oauth2client.service_account import ServiceAccountCredentials
    import json
    from datetime import datetime
    
    print("✓ Imports successful")
    
    # Initialize Google Sheets
    scope = [
        "https://spreadsheets.google.com/feeds",
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive"
    ]
    
    creds_file = os.path.join(os.path.dirname(__file__), 'credentials.json')
    if not os.path.exists(creds_file):
        print(f"ERROR: {creds_file} not found")
        sys.exit(1)
    
    print(f"✓ Found credentials file")
    
    creds = ServiceAccountCredentials.from_json_keyfile_name(creds_file, scope)
    client = gspread.authorize(creds)
    
    sheet_name = os.getenv("GOOGLE_SHEET_NAME", "Stats")
    spreadsheet = client.open(sheet_name)
    sheet = spreadsheet.worksheet("Stats")
    
    print(f"✓ Connected to Google Sheets: '{sheet_name}'")
    
    # Get all records
    print("\n📥 Fetching data from Google Sheets...")
    all_rows = sheet.get_all_records()
    print(f"✓ Retrieved {len(all_rows)} rows")
    
    if len(all_rows) == 0:
        print("⚠️  No data to import")
        sys.exit(0)
    
    # Analyze data
    campuses = set()
    dates = []
    
    for row in all_rows:
        campus = row.get('Campus', '').strip()
        if campus:
            campuses.add(campus)
        
        date_str = str(row.get('Date', '')).strip()
        if date_str:
            try:
                date_val = datetime.strptime(date_str, '%Y-%m-%d').date()
                dates.append(date_val)
            except:
                try:
                    date_val = datetime.strptime(date_str, '%m/%d/%Y').date()
                    dates.append(date_val)
                except:
                    pass
    
    print("\n" + "=" * 60)
    print("DATA PREVIEW")
    print("=" * 60)
    print(f"📊 Total Rows: {len(all_rows)}")
    print(f"🏢 Campuses: {len(campuses)}")
    print(f"   {', '.join(sorted(campuses))}")
    
    if dates:
        dates.sort()
        print(f"📅 Date Range: {dates[0]} to {dates[-1]}")
        print(f"   ({(dates[-1] - dates[0]).days} days of data)")
    
    # Show sample
    if all_rows:
        sample = all_rows[0]
        non_empty = {k: v for k, v in sample.items() if v}
        print(f"\n📝 Sample Row ({sample.get('Campus')} on {sample.get('Date')}):")
        for key, value in list(non_empty.items())[:8]:
            print(f"   • {key}: {value}")
    
    print("\n" + "=" * 60)
    print("✅ Google Sheets data is accessible and ready to import!")
    print("\nTo import this data into the database, run:")
    print("  python migrate_sheets_to_db.py")
    print("=" * 60)
    
except Exception as e:
    print(f"\n❌ ERROR: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

