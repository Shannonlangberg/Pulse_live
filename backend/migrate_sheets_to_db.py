"""
Migration script to import existing Google Sheets data into database
Run with --preview to see what will be imported without making changes
Run with --dry-run to test migration without saving
"""

import os
import sys
from datetime import datetime
from dotenv import load_dotenv
import argparse

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

load_dotenv()

from app import app, db, sheet, initialize_google_sheets, safe_sheets_request
from models import AttendanceRecord, CampusV2, Region

def preview_sheets_data():
    """Preview what data exists in Google Sheets"""
    
    with app.app_context():
        print("=" * 60)
        print("PREVIEW: Google Sheets Data")
        print("=" * 60)
        
        # Initialize Google Sheets if needed
        if not sheet:
            print("Initializing Google Sheets connection...")
            try:
                initialize_google_sheets()
            except Exception as e:
                print(f"ERROR: Could not connect to Google Sheets: {e}")
                return False
        
        if not sheet:
            print("ERROR: Google Sheets not available")
            return False
        
        print("\n✓ Google Sheets connected")
        
        # Get all rows
        print("\n📥 Fetching data from Google Sheets...")
        try:
            all_rows = safe_sheets_request(sheet.get_all_records)
            print(f"✓ Retrieved {len(all_rows)} rows from Google Sheets")
        except Exception as e:
            print(f"ERROR: Failed to fetch: {e}")
            return False
        
        if not all_rows:
            print("⚠️  No data found in Google Sheets")
            return False
        
        # Analyze the data
        campuses = set()
        dates = []
        sample_row = None
        
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
            
            if not sample_row and campus and date_str:
                sample_row = row
        
        # Display summary
        print("\n" + "=" * 60)
        print("DATA SUMMARY")
        print("=" * 60)
        print(f"📊 Total Rows: {len(all_rows)}")
        print(f"🏢 Campuses: {len(campuses)}")
        print(f"   {', '.join(sorted(campuses))}")
        
        if dates:
            dates.sort()
            print(f"📅 Date Range: {dates[0]} to {dates[-1]}")
            print(f"   ({(dates[-1] - dates[0]).days} days of data)")
        
        if sample_row:
            print(f"\n📝 Sample Row Fields:")
            print(f"   Available fields: {len(sample_row.keys())}")
            
            # Show first row's non-empty fields
            non_empty = {k: v for k, v in sample_row.items() if v}
            print(f"   Non-empty fields in sample: {len(non_empty)}")
            
            print(f"\n   Sample data from {sample_row.get('Campus')} on {sample_row.get('Date')}:")
            for key, value in list(non_empty.items())[:10]:
                print(f"      • {key}: {value}")
            if len(non_empty) > 10:
                print(f"      ... and {len(non_empty) - 10} more fields")
        
        print("\n" + "=" * 60)
        
        # Check database campuses
        print("\n🗄️  Checking Database Campuses...")
        campuses_in_db = CampusV2.query.filter_by(active=True).all()
        print(f"   Found {len(campuses_in_db)} active campuses in database:")
        for campus in campuses_in_db:
            print(f"      • {campus.display_name} (ID: {campus.campus_id})")
        
        # Check for existing records
        existing_count = AttendanceRecord.query.count()
        print(f"\n📦 Existing Records in Database: {existing_count}")
        
        if existing_count > 0:
            print("   ⚠️  Database already has attendance records!")
            print("   Migration will skip duplicates (same campus + date)")
        
        print("\n" + "=" * 60)
        return True


def migrate_sheets_data(dry_run=False):
    """Import all existing Google Sheets data into database"""
    
    with app.app_context():
        print("=" * 60)
        if dry_run:
            print("DRY RUN: Testing Migration (no changes will be made)")
        else:
            print("MIGRATION: Google Sheets → PostgreSQL Database")
        print("=" * 60)
        
        # Initialize Google Sheets if needed
        if not sheet:
            print("Initializing Google Sheets connection...")
            try:
                initialize_google_sheets()
            except Exception as e:
                print(f"ERROR: Could not connect to Google Sheets: {e}")
                return False
        
        if not sheet:
            print("ERROR: Google Sheets not available")
            return False
        
        print("\n✓ Google Sheets connected")
        
        # Get all campuses from database
        campuses = CampusV2.query.filter_by(active=True).all()
        print(f"\n✓ Found {len(campuses)} active campuses in database")
        
        if len(campuses) == 0:
            print("\n⚠️  ERROR: No campuses found in database!")
            print("   Please run campus seeding first:")
            print("   python seed_campuses_v2.py")
            return False
        
        # Get all rows from Google Sheets
        print("\n📥 Fetching data from Google Sheets...")
        try:
            all_rows = safe_sheets_request(sheet.get_all_records)
            print(f"✓ Retrieved {len(all_rows)} rows from Google Sheets")
        except Exception as e:
            print(f"ERROR: Failed to fetch from Google Sheets: {e}")
            return False
        
        if len(all_rows) == 0:
            print("⚠️  No data to import")
            return False
        
        # Create campus name lookup
        campus_lookup = {}
        for c in campuses:
            campus_lookup[c.display_name] = c
            campus_lookup[c.name] = c
            campus_lookup[c.campus_id] = c
            # Add lowercase versions
            campus_lookup[c.display_name.lower()] = c
            campus_lookup[c.name.lower()] = c
        
        print(f"\n✓ Campus lookup created with {len(campus_lookup)} entries")
        
        # Import each row
        imported = 0
        skipped = 0
        errors = 0
        error_details = []
        
        print("\n🔄 Processing records...")
        print("-" * 60)
        
        for i, row in enumerate(all_rows, 1):
            try:
                # Get campus
                campus_name = row.get('Campus', '').strip()
                if not campus_name:
                    skipped += 1
                    continue
                
                # Try to find campus
                campus = campus_lookup.get(campus_name)
                if not campus:
                    # Try case-insensitive match
                    campus_name_lower = campus_name.lower()
                    campus = campus_lookup.get(campus_name_lower)
                
                if not campus:
                    if errors < 10:  # Only show first 10 errors
                        error_details.append(f"Campus not found: '{campus_name}'")
                    errors += 1
                    continue
                
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
                        if errors < 10:
                            error_details.append(f"Invalid date format: '{date_str}'")
                        errors += 1
                        continue
                
                # Check if already exists
                existing = AttendanceRecord.query.filter_by(
                    campus_id=campus.id,
                    date=date_val
                ).first()
                
                if existing:
                    skipped += 1
                    continue
                
                if not dry_run:
                    # Create record from sheet row
                    record = AttendanceRecord.from_sheets_row(row, campus)
                    
                    if record.date:  # Only add if we got a valid date
                        db.session.add(record)
                        imported += 1
                        
                        # Commit in batches of 100
                        if imported % 100 == 0:
                            db.session.commit()
                            print(f"  ✓ Imported {imported} records so far...")
                    else:
                        skipped += 1
                else:
                    # Dry run - just count
                    imported += 1
                    if imported % 100 == 0:
                        print(f"  Would import {imported} records so far...")
                
            except Exception as e:
                if errors < 10:
                    error_details.append(f"Row {i}: {str(e)}")
                errors += 1
                continue
        
        # Final commit
        if not dry_run:
            db.session.commit()
        
        # Summary
        print("\n" + "=" * 60)
        if dry_run:
            print("DRY RUN COMPLETE - No changes made")
        else:
            print("MIGRATION COMPLETE")
        print("=" * 60)
        print(f"✓ Would import / Imported: {imported} records")
        print(f"⊘ Skipped (duplicates/empty): {skipped} records")
        print(f"✗ Errors:                     {errors} records")
        
        if error_details:
            print(f"\n⚠️  First {len(error_details)} errors:")
            for detail in error_details:
                print(f"   • {detail}")
        
        print("=" * 60)
        
        if not dry_run and imported > 0:
            print("\n✅ SUCCESS! Your historical data is now in the database.")
            print("   You can now use the dual-write system for new entries.")
        
        return True


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Migrate Google Sheets data to database')
    parser.add_argument('--preview', action='store_true', 
                       help='Preview data without importing')
    parser.add_argument('--dry-run', action='store_true', 
                       help='Test migration without making changes')
    
    args = parser.parse_args()
    
    if args.preview:
        preview_sheets_data()
    else:
        migrate_sheets_data(dry_run=args.dry_run)
