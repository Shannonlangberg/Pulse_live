#!/usr/bin/env python3
"""
Script to fix ALL attendance records by re-importing them from Google Sheets
with the correct field mapping (using 'Total People in Campus' as primary source)

This handles the issue where records were imported using the wrong column.
"""

import os
import sys
import json

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, get_db
from models import AttendanceRecord, CampusV2, db
from datetime import datetime

def fix_all_attendance_records():
    """
    Fix ALL attendance records by reading from Google Sheets
    and updating with the correct 'Total People in Campus' field
    """
    with app.app_context():
        print("=" * 80)
        print("🔧 FIXING ALL ATTENDANCE RECORDS")
        print("=" * 80)
        print()
        
        # Get all records
        all_records = AttendanceRecord.query.all()
        print(f"Found {len(all_records)} total records in database")
        print()
        
        if not all_records:
            print("✅ No records to fix!")
            return
        
        # Get Google Sheets data
        try:
            from app import client
            if not client:
                print("❌ Google Sheets client not available!")
                return
            
            spreadsheet = client.open("Stats")
            sheet = spreadsheet.worksheet("Stats")
            google_data = sheet.get_all_records()
            print(f"✓ Loaded {len(google_data)} rows from Google Sheets")
            print()
        except Exception as e:
            print(f"❌ Failed to load Google Sheets data: {e}")
            import traceback
            traceback.print_exc()
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
        
        # Fix each record
        fixed_count = 0
        skipped_count = 0
        
        for record in all_records:
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
                    # Try alternate campus name variations
                    alt_names = [campus.name.strip().lower(), campus.campus_id.strip().lower()]
                    found = False
                    for alt_name in alt_names:
                        alt_key = (alt_name, record.date)
                        if alt_key in sheets_lookup:
                            lookup_key = alt_key
                            found = True
                            break
                    
                    if not found:
                        print(f"⚠ No Google Sheets data for {campus.display_name} on {record.date}")
                        skipped_count += 1
                        continue
                
                sheets_row = sheets_lookup[lookup_key]
                
                # Helper functions
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
                
                # OLD attendance value
                old_attendance = record.total_attendance
                
                # ALWAYS calculate from service time breakdowns (same logic as dashboards)
                # Sunday Total = Service Times + Saints + Kids + Kids Leaders (NO Youth)
                
                # Adult service times
                adult_total = 0
                for time in ['9:00 AM', '10:00 AM', '11:00 AM', '5:00 PM', '5:30 PM']:
                    adult_total += safe_int(sheets_row.get(time, 0))
                
                # Saints (separate field)
                saints = safe_int(sheets_row.get('Saints', 0))
                
                # Kids = Kids attendance + Kids leaders
                kids_attendance_val = safe_int(sheets_row.get('Kids Attendance', 0))
                kids_leaders_val = safe_int(sheets_row.get('Kids Leaders', 0))
                kids_total = kids_attendance_val + kids_leaders_val
                
                # If Kids Attendance field is empty, calculate from service time breakdown
                if not kids_attendance_val:
                    kids_from_services = 0
                    for time in ['Kids 9:00 AM', 'Kids 10:00 AM', 'Kids 11:00 AM', 'Kids 5:00 PM', 'Kids 5:30 PM']:
                        kids_from_services += safe_int(sheets_row.get(time, 0))
                    kids_total = kids_from_services + kids_leaders_val
                
                # Sunday Total = Adults + Saints + Kids (including leaders)
                # Youth is tracked separately, NOT included in Sunday total
                calculated_total_attendance = adult_total + saints + kids_total
                
                # FALLBACK: If calculated total is 0, try reading "Total Attendance" column
                if not calculated_total_attendance:
                    calculated_total_attendance = safe_int(sheets_row.get('Total Attendance', 0))
                
                # Set the two DIFFERENT metrics:
                # 1. total_attendance = CALCULATED Sunday total (adults + saints + kids + leaders)
                # 2. total_people_in_campus = MANUAL input from "Total People in Campus" column
                record.total_attendance = calculated_total_attendance
                record.total_people_in_campus = safe_int(sheets_row.get('Total People in Campus', 0))
                
                # Update all other fields too
                kids_attendance = safe_int(sheets_row.get('Kids Attendance', 0))
                # FALLBACK: Calculate kids attendance from service time breakdown if empty
                if not kids_attendance:
                    kids_attendance = 0
                    for time in ['Kids 9:00 AM', 'Kids 10:00 AM', 'Kids 11:00 AM', 'Kids 5:00 PM', 'Kids 5:30 PM']:
                        kids_attendance += safe_int(sheets_row.get(time, 0))
                record.kids_attendance = kids_attendance
                record.kids_leaders = safe_int(sheets_row.get('Kids Leaders', 0))
                record.new_kids = safe_int(sheets_row.get('New Kids', 0))
                record.new_kids_salvations = safe_int(sheets_row.get('New Kids Salvations', 0))
                record.packs_out = safe_int(sheets_row.get('Packs Out', 0))
                
                # Build adult service breakdown (JSON)
                adult_breakdown = {}
                for time in ['9:00 AM', '10:00 AM', '11:00 AM', '5:00 PM', '5:30 PM']:
                    value = safe_int(sheets_row.get(time, 0))
                    if value > 0:
                        adult_breakdown[time] = value
                record.adult_service_breakdown = json.dumps(adult_breakdown) if adult_breakdown else None
                
                # Build kids service breakdown (JSON)
                kids_breakdown = {}
                for time in ['Kids 9:00 AM', 'Kids 10:00 AM', 'Kids 11:00 AM', 'Kids 5:00 PM', 'Kids 5:30 PM']:
                    value = safe_int(sheets_row.get(time, 0))
                    if value > 0:
                        kids_breakdown[time] = value
                record.kids_service_breakdown = json.dumps(kids_breakdown) if kids_breakdown else None
                
                record.youth_attendance = safe_int(sheets_row.get('Youth Attendance', 0))
                record.youth_salvations = safe_int(sheets_row.get('Youth Salvations', 0))
                record.youth_new_people = safe_int(sheets_row.get('Youth New People', 0))
                record.youth_leaders = safe_int(sheets_row.get('Youth Leaders', 0))
                record.first_time_visitors = safe_int(sheets_row.get('First Time Visitors', 0)) or safe_int(sheets_row.get('First Time', 0))
                record.visitors = safe_int(sheets_row.get('Visitors', 0))
                record.hands_up = safe_int(sheets_row.get('Hands up', 0))
                record.cards_back = safe_int(sheets_row.get('Cards Back', 0))
                record.first_time_christians = safe_int(sheets_row.get('First Time Christians', 0))
                record.rededications = safe_int(sheets_row.get('Rededications', 0))
                record.salvation_cards_returned = safe_int(sheets_row.get('Salvation Cards Returned', 0))

                # If the sheet only had aggregate columns filled (legacy rows), map into DB fields
                comp_np = (
                    (record.first_time_visitors or 0)
                    + (record.visitors or 0)
                    + (record.youth_new_people or 0)
                )
                sheet_np = safe_int(sheets_row.get('New People', 0))
                if sheet_np > 0 and comp_np == 0:
                    record.visitors = sheet_np

                base_sal = (
                    (record.first_time_christians or 0)
                    + (record.rededications or 0)
                    + (record.youth_salvations or 0)
                    + (record.new_kids_salvations or 0)
                )
                sheet_nc = safe_int(sheets_row.get('New Christians', 0))
                if sheet_nc > 0 and base_sal == 0:
                    record.first_time_christians = sheet_nc
                record.baptisms = safe_int(sheets_row.get('Baptisms', 0))
                record.child_dedications = safe_int(sheets_row.get('Child Dedications', 0))
                record.connect_groups = safe_int(sheets_row.get('Connect Groups', 0))
                record.dream_team = safe_int(sheets_row.get('Dream Team', 0))
                record.tithe = safe_float(sheets_row.get('Tithe', 0))
                record.updated_at = datetime.utcnow()
                
                if old_attendance != total_people:
                    print(f"✓ Fixed {campus.display_name} on {record.date}: {old_attendance} → {total_people}")
                    fixed_count += 1
                else:
                    fixed_count += 1
                
            except Exception as e:
                print(f"❌ Error fixing record {record.id}: {e}")
                import traceback
                traceback.print_exc()
                skipped_count += 1
                continue
        
        # Commit all changes
        try:
            db.session.commit()
            print()
            print("=" * 80)
            print("✅ FIX COMPLETE!")
            print("=" * 80)
            print(f"✓ Updated: {fixed_count} records")
            print(f"⚠ Skipped: {skipped_count} records")
            print(f"━ Total: {len(all_records)} records processed")
            print("=" * 80)
        except Exception as e:
            db.session.rollback()
            print(f"❌ Failed to commit changes: {e}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    fix_all_attendance_records()

