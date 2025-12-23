#!/usr/bin/env python3
"""
Script to fix attendance records that have total_attendance = 0
by re-importing them from Google Sheets

This handles the field mapping bug where records were created but
with all zeros because 'Total People in Campus' wasn't mapped to 'total_attendance'
"""

import os
import sys

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, get_db
from models import AttendanceRecord, CampusV2, db
from datetime import datetime

def fix_zero_attendance_records():
    """
    Fix attendance records that have total_attendance = 0
    by reading from Google Sheets and updating the database
    """
    with app.app_context():
        print("=" * 80)
        print("🔧 FIXING ZERO ATTENDANCE RECORDS")
        print("=" * 80)
        print()
        
        # Find all records with total_attendance = 0
        zero_records = AttendanceRecord.query.filter(
            AttendanceRecord.total_attendance == 0
        ).all()
        
        print(f"Found {len(zero_records)} records with total_attendance = 0")
        print()
        
        if not zero_records:
            print("✅ No records need fixing!")
            return
        
        # Get Google Sheets data
        try:
            from app import get_google_sheets_data
            google_data = get_google_sheets_data()
            print(f"✓ Loaded {len(google_data)} rows from Google Sheets")
            print()
        except Exception as e:
            print(f"❌ Failed to load Google Sheets data: {e}")
            return
        
        # Create a lookup dict: {(campus_name, date): google_sheets_row}
        sheets_lookup = {}
        for row in google_data:
            if isinstance(row, dict) and 'Date' in row and 'Campus' in row:
                try:
                    # Parse date from Google Sheets (could be various formats)
                    date_str = str(row['Date'])
                    if '/' in date_str:
                        date_obj = datetime.strptime(date_str, '%m/%d/%Y').date()
                    else:
                        date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
                    
                    campus_name = row['Campus'].strip().lower()
                    sheets_lookup[(campus_name, date_obj)] = row
                except Exception as e:
                    continue
        
        print(f"✓ Created lookup for {len(sheets_lookup)} Google Sheets records")
        print()
        
        # Fix each zero record
        fixed_count = 0
        skipped_count = 0
        
        for record in zero_records:
            try:
                # Get campus
                campus = CampusV2.query.get(record.campus_id)
                if not campus:
                    print(f"⚠ Campus not found for record {record.id}")
                    skipped_count += 1
                    continue
                
                # Look up in Google Sheets
                campus_name = campus.display_name.strip().lower()
                lookup_key = (campus_name, record.date)
                
                if lookup_key not in sheets_lookup:
                    print(f"⚠ No Google Sheets data for {campus.display_name} on {record.date}")
                    skipped_count += 1
                    continue
                
                sheets_row = sheets_lookup[lookup_key]
                
                # Update with Google Sheets data
                def safe_int(val):
                    try:
                        return int(float(val)) if val else 0
                    except:
                        return 0
                
                def safe_float(val):
                    try:
                        return float(val) if val else 0.0
                    except:
                        return 0.0
                
                # Update all fields from Google Sheets
                # Use "Total People in Campus" as the primary attendance field (this is what users enter)
                # Fall back to "Total Attendance" (calculated field) if not present
                total_people = safe_int(sheets_row.get('Total People in Campus', 0)) or safe_int(sheets_row.get('Total Attendance', 0))
                record.total_attendance = total_people
                record.total_people_in_campus = total_people
                record.kids_attendance = safe_int(sheets_row.get('Kids Attendance', 0))
                record.kids_leaders = safe_int(sheets_row.get('Kids Leaders', 0))
                record.new_kids = safe_int(sheets_row.get('New Kids', 0))
                record.new_kids_salvations = safe_int(sheets_row.get('New Kids Salvations', 0))
                record.packs_out = safe_int(sheets_row.get('Packs Out', 0))
                record.youth_attendance = safe_int(sheets_row.get('Youth Attendance', 0))
                record.youth_salvations = safe_int(sheets_row.get('Youth Salvations', 0))
                record.youth_new_people = safe_int(sheets_row.get('Youth New People', 0))
                record.youth_leaders = safe_int(sheets_row.get('Youth Leaders', 0))
                record.first_time_visitors = safe_int(sheets_row.get('First Time Visitors', 0))
                record.visitors = safe_int(sheets_row.get('Visitors', 0))
                record.hands_up = safe_int(sheets_row.get('Hands up', 0))
                record.cards_back = safe_int(sheets_row.get('Cards Back', 0))
                record.first_time_christians = safe_int(sheets_row.get('First Time Christians', 0))
                record.rededications = safe_int(sheets_row.get('Rededications', 0))
                record.salvation_cards_returned = safe_int(sheets_row.get('Salvation Cards Returned', 0))
                record.baptisms = safe_int(sheets_row.get('Baptisms', 0))
                record.child_dedications = safe_int(sheets_row.get('Child Dedications', 0))
                record.connect_groups = safe_int(sheets_row.get('Connect Groups', 0))
                record.dream_team = safe_int(sheets_row.get('Dream Team', 0))
                record.tithe = safe_float(sheets_row.get('Tithe', 0))
                record.updated_at = datetime.utcnow()
                
                print(f"✓ Fixed {campus.display_name} on {record.date}: attendance = {record.total_attendance}")
                fixed_count += 1
                
            except Exception as e:
                print(f"❌ Error fixing record {record.id}: {e}")
                skipped_count += 1
                continue
        
        # Commit all changes
        try:
            db.session.commit()
            print()
            print("=" * 80)
            print("✅ MIGRATION COMPLETE!")
            print("=" * 80)
            print(f"✓ Fixed: {fixed_count} records")
            print(f"⚠ Skipped: {skipped_count} records")
            print(f"━ Total: {len(zero_records)} records processed")
            print("=" * 80)
        except Exception as e:
            db.session.rollback()
            print(f"❌ Failed to commit changes: {e}")

if __name__ == '__main__':
    fix_zero_attendance_records()

