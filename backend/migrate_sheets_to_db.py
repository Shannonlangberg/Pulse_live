#!/usr/bin/env python3
"""
Migration Script: Import Google Sheets Stats Data into Database
Migrates all existing attendance data from Google Sheets to attendance_records table
"""
import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, logger, sheet, get_db
from models import db, CampusV2, Region, AttendanceRecord
from datetime import datetime
import json

def migrate_sheets_to_database():
    """Migrate all existing Google Sheets data to attendance_records table"""
    
    with app.app_context():
        try:
            print("\n" + "="*80)
            print("📊 MIGRATING GOOGLE SHEETS DATA TO DATABASE")
            print("="*80 + "\n")
            
            # Get all records from Google Sheets Stats tab
            print("[1/5] Fetching data from Google Sheets...")
            all_records = sheet.get_all_records()
            print(f"✓ Found {len(all_records)} records in Google Sheets\n")
            
            # Get all campuses and create lookup dict
            print("[2/5] Loading campus mappings...")
            campuses = CampusV2.query.all()
            campus_lookup = {}
            
            for campus in campuses:
                # Map by campus_id (primary)
                campus_lookup[campus.campus_id] = campus
                # Also map by display_name
                campus_lookup[campus.display_name] = campus
                # Also map by name
                campus_lookup[campus.name] = campus
                # Lowercase versions
                campus_lookup[campus.campus_id.lower()] = campus
                campus_lookup[campus.display_name.lower()] = campus
            
            print(f"✓ Loaded {len(campuses)} campuses\n")
            
            # Get regions using raw SQL (avoid model column issues)
            print("[3/5] Loading regions...")
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT id, name, code FROM regions WHERE active = 1")
            region_rows = cursor.fetchall()
            region_by_id = {row[0]: {'id': row[0], 'name': row[1], 'code': row[2]} for row in region_rows}
            print(f"✓ Loaded {len(region_rows)} regions\n")
            
            # Process each record
            print("[4/5] Processing records...")
            migrated_count = 0
            skipped_count = 0
            error_count = 0
            
            for idx, row in enumerate(all_records, 1):
                try:
                    # Parse date
                    date_str = row.get('Date', '')
                    if not date_str:
                        print(f"  ⚠ Row {idx}: Skipping - no date")
                        skipped_count += 1
                        continue
                    
                    try:
                        date_val = datetime.strptime(date_str, '%m/%d/%Y').date()
                    except:
                        try:
                            date_val = datetime.strptime(date_str, '%Y-%m-%d').date()
                        except:
                            print(f"  ⚠ Row {idx}: Skipping - invalid date format: {date_str}")
                            skipped_count += 1
                            continue
                    
                    # Find campus
                    campus_name = row.get('Campus', '').strip()
                    if not campus_name:
                        print(f"  ⚠ Row {idx}: Skipping - no campus")
                        skipped_count += 1
                        continue
                    
                    # Try multiple lookup strategies
                    campus = None
                    lookup_keys = [
                        campus_name,
                        campus_name.lower(),
                        campus_name.lower().replace(' ', '_'),
                    ]
                    
                    for key in lookup_keys:
                        if key in campus_lookup:
                            campus = campus_lookup[key]
                            break
                    
                    if not campus:
                        print(f"  ⚠ Row {idx}: Skipping - campus not found: {campus_name}")
                        skipped_count += 1
                        continue
                    
                    # Check if record already exists
                    existing = AttendanceRecord.query.filter_by(
                        campus_id=campus.id,
                        date=date_val
                    ).first()
                    
                    if existing:
                        print(f"  → Row {idx}: Skipping - record already exists for {campus.display_name} on {date_val}")
                        skipped_count += 1
                        continue
                    
                    # Parse service breakdown
                    service_breakdown = {}
                    service_times = json.loads(campus.service_times) if campus.service_times else []
                    for service_time in service_times:
                        col_name = f"Adult {service_time}"
                        if col_name in row:
                            try:
                                service_breakdown[service_time] = int(row[col_name] or 0)
                            except:
                                pass
                    
                    # Use "Total People in Campus" as primary attendance field
                    # This is the actual number entered by users in the Google Sheet (Column D)
                    # Fall back to calculated total only if not present
                    total_people = int(row.get('Total People in Campus', 0) or 0)
                    if not total_people:
                        # Fallback: calculate from service breakdowns
                        total_people = sum(service_breakdown.values())
                        kids_attendance = int(row.get('Kids Attendance', 0) or 0)
                        youth_attendance = int(row.get('Youth Attendance', 0) or 0)
                        total_people += kids_attendance + youth_attendance
                    
                    kids_attendance = int(row.get('Kids Attendance', 0) or 0)
                    youth_attendance = int(row.get('Youth Attendance', 0) or 0)

                    ftv_m = int(row.get('First Time Visitors', 0) or 0)
                    visitors_m = int(row.get('Visitors', 0) or 0)
                    youth_np_m = int(row.get('Youth New People', 0) or 0)
                    if int(row.get('New People', 0) or 0) > 0 and (ftv_m + visitors_m + youth_np_m) == 0:
                        visitors_m = int(row.get('New People', 0) or 0)
                    ftc_m = int(row.get('First Time Christians', 0) or 0)
                    reded_m = int(row.get('Rededications', 0) or 0)
                    ys_m = int(row.get('Youth Salvations', 0) or 0)
                    nks_m = int(row.get('Kids Salvations', 0) or 0)
                    if int(row.get('New Christians', 0) or 0) > 0 and (ftc_m + reded_m + ys_m + nks_m) == 0:
                        ftc_m = int(row.get('New Christians', 0) or 0)
                    
                    # Create attendance record
                    record = AttendanceRecord(
                        campus_id=campus.id,
                        region_id=campus.region_id,
                        date=date_val,
                        total_attendance=total_people,
                        total_people_in_campus=total_people,
                        adult_service_breakdown=json.dumps(service_breakdown) if service_breakdown else None,
                        
                        # Kids
                        kids_attendance=kids_attendance,
                        kids_leaders=int(row.get('Kids Leaders', 0) or 0),
                        new_kids=int(row.get('New Kids', 0) or 0),
                        new_kids_salvations=nks_m,
                        packs_out=int(row.get('Packs Out', 0) or 0),
                        
                        # Youth
                        youth_attendance=youth_attendance,
                        youth_salvations=ys_m,
                        youth_new_people=youth_np_m,
                        youth_leaders=int(row.get('Youth Leaders', 0) or 0),
                        
                        # Visitors & Salvations
                        first_time_visitors=ftv_m,
                        visitors=visitors_m,
                        hands_up=int(row.get('Hands Up', 0) or 0),
                        cards_back=int(row.get('Cards Back', 0) or 0),
                        first_time_christians=ftc_m,
                        rededications=reded_m,
                        salvation_cards_returned=int(row.get('Salvation Cards Returned', 0) or 0),
                        
                        # Milestones
                        baptisms=int(row.get('Baptisms', 0) or 0),
                        child_dedications=int(row.get('Child Dedications', 0) or 0),
                        
                        # Engagement
                        connect_groups=int(row.get('Connect Groups', 0) or 0),
                        dream_team=int(row.get('Dream Team', 0) or 0),
                        
                        # Financial
                        tithe=float(row.get('Tithe', 0) or 0),
                        
                        # Metadata
                        synced_to_sheets=True,  # Already in sheets
                        notes=row.get('Notes', '')
                    )
                    
                    db.session.add(record)
                    migrated_count += 1
                    
                    if migrated_count % 10 == 0:
                        print(f"  ✓ Migrated {migrated_count} records...")
                
                except Exception as e:
                    print(f"  ✗ Row {idx}: Error - {e}")
                    error_count += 1
                    continue
            
            # Commit all records
            print(f"\n[5/5] Committing {migrated_count} records to database...")
            db.session.commit()
            print(f"✓ Successfully committed all records\n")
            
            # Print summary
            print("="*80)
            print("📊 MIGRATION SUMMARY")
            print("="*80)
            print(f"✓ Migrated:  {migrated_count} records")
            print(f"⚠ Skipped:   {skipped_count} records")
            print(f"✗ Errors:    {error_count} records")
            print(f"━ Total:     {len(all_records)} records")
            print("="*80 + "\n")
            
            if migrated_count > 0:
                print("✅ Migration completed successfully!")
                print("\nNext steps:")
                print("1. Regional dashboards will now show historical data")
                print("2. Weekly submission tracker will reflect past submissions")
                print("3. All new stats will continue dual-writing to both systems")
                print()
            
            return True
            
        except Exception as e:
            db.session.rollback()
            print(f"\n❌ Migration failed: {e}")
            import traceback
            print(traceback.format_exc())
            return False

if __name__ == '__main__':
    print("\n🚀 Starting Google Sheets to Database Migration\n")
    success = migrate_sheets_to_database()
    sys.exit(0 if success else 1)
