"""
Import Google Sheets data directly into database
Efficient version without full app initialization
"""
import sys
import os
import sqlite3
import json
from datetime import datetime

# Minimal Google Sheets imports
import gspread
from oauth2client.service_account import ServiceAccountCredentials

print("=" * 60)
print("IMPORTING GOOGLE SHEETS DATA TO DATABASE")
print("=" * 60)

# Database path
db_path = os.path.join(os.path.dirname(__file__), 'instance', 'futures_link.db')
if not os.path.exists(db_path):
    print(f"ERROR: Database not found at {db_path}")
    sys.exit(1)

print(f"\n✓ Database: {db_path}")

# Connect to Google Sheets
scope = [
    "https://spreadsheets.google.com/feeds",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive"
]

creds_file = os.path.join(os.path.dirname(__file__), 'credentials.json')
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

# Connect to database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get campus mapping
cursor.execute("SELECT id, display_name, campus_id, service_times FROM campuses_v2")
campuses_db = cursor.fetchall()
campus_lookup = {}
for campus_id, display_name, campus_code, service_times_json in campuses_db:
    campus_lookup[display_name.lower()] = {
        'id': campus_id,
        'display_name': display_name,
        'service_times': json.loads(service_times_json) if service_times_json else []
    }
    campus_lookup[campus_code.lower()] = campus_lookup[display_name.lower()]

print(f"\n✓ Found {len(campuses_db)} campuses in database")

# Get Australia region ID
cursor.execute("SELECT id FROM regions WHERE code = 'AU'")
region_result = cursor.fetchone()
if not region_result:
    print("ERROR: Australia region not found")
    sys.exit(1)

au_region_id = region_result[0]
print(f"✓ Australia region ID: {au_region_id}")

# Import records
print("\n🔄 Importing records...")
print("-" * 60)

imported = 0
skipped = 0
errors = 0

for row in all_rows:
    try:
        # Get campus
        campus_name = row.get('Campus', '').strip().lower()
        if not campus_name or campus_name not in campus_lookup:
            skipped += 1
            continue
        
        campus_info = campus_lookup[campus_name]
        campus_id = campus_info['id']
        service_times = campus_info['service_times']
        
        # Parse date
        date_str = str(row.get('Date', '')).strip()
        if not date_str:
            skipped += 1
            continue
        
        try:
            date_val = datetime.strptime(date_str, '%Y-%m-%d').date()
        except:
            try:
                date_val = datetime.strptime(date_str, '%m/%d/%Y').date()
            except:
                skipped += 1
                continue
        
        # Check if already exists
        cursor.execute(
            "SELECT id FROM attendance_records WHERE campus_id = ? AND date = ?",
            (campus_id, date_val.isoformat())
        )
        if cursor.fetchone():
            skipped += 1
            continue
        
        # Build service breakdowns
        adult_breakdown = {}
        kids_breakdown = {}
        for service_time in service_times:
            if service_time in row:
                val = row[service_time]
                if val:
                    adult_breakdown[service_time] = int(val)
            kids_key = f'Kids {service_time}'
            if kids_key in row:
                val = row[kids_key]
                if val:
                    kids_breakdown[kids_key] = int(val)
        
        # Helper to safely convert to int
        def safe_int(val):
            try:
                return int(val) if val else 0
            except:
                return 0
        
        # Insert record
        cursor.execute("""
            INSERT INTO attendance_records (
                campus_id, region_id, date,
                total_attendance, total_people_in_campus,
                adult_service_breakdown, kids_service_breakdown,
                kids_attendance, kids_leaders, new_kids, new_kids_salvations, packs_out,
                youth_attendance, youth_salvations, youth_new_people, youth_leaders,
                first_time_visitors, visitors, hands_up, cards_back,
                first_time_christians, rededications, salvation_cards_returned,
                baptisms, child_dedications, connect_groups, dream_team, tithe,
                synced_to_sheets, created_at
            ) VALUES (
                ?, ?, ?,
                ?, ?,
                ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?, ?,
                1, CURRENT_TIMESTAMP
            )
        """, (
            campus_id, au_region_id, date_val.isoformat(),
            safe_int(row.get('Total Attendance')), safe_int(row.get('Total People in Campus')),
            json.dumps(adult_breakdown) if adult_breakdown else None,
            json.dumps(kids_breakdown) if kids_breakdown else None,
            safe_int(row.get('Kids Attendance')), safe_int(row.get('Kids Leaders')),
            safe_int(row.get('New Kids')), safe_int(row.get('New Kids Salvations')),
            safe_int(row.get('Packs Out')),
            safe_int(row.get('Youth Attendance')), safe_int(row.get('Youth Salvations')),
            safe_int(row.get('Youth New People')), safe_int(row.get('Youth Leaders')),
            safe_int(row.get('First Time Visitors')), safe_int(row.get('Visitors')),
            safe_int(row.get('Hands up')), safe_int(row.get('Cards Back')),
            safe_int(row.get('First Time Christians')), safe_int(row.get('Rededications')),
            safe_int(row.get('Salvation Cards Returned')),
            safe_int(row.get('Baptisms')), safe_int(row.get('Child Dedications')),
            safe_int(row.get('Connect Groups')), safe_int(row.get('Dream Team')),
            float(row.get('Tithe', 0) or 0)
        ))
        
        imported += 1
        
        if imported % 10 == 0:
            print(f"  ✓ Imported {imported} records...")
    
    except Exception as e:
        errors += 1
        if errors <= 5:
            print(f"  ✗ Error: {e}")

# Commit changes
conn.commit()
conn.close()

# Summary
print("\n" + "=" * 60)
print("IMPORT COMPLETE")
print("=" * 60)
print(f"✓ Imported:  {imported} records")
print(f"⊘ Skipped:   {skipped} records")
print(f"✗ Errors:    {errors} records")
print("=" * 60)

if imported > 0:
    print("\n✅ SUCCESS! Your historical data is now in the database.")
    print("   New stats entries will be dual-written to both database and Google Sheets.")
    print("\n🎉 You're now ready for multi-region scaling!")


