#!/usr/bin/env python3
"""
Reset attendance_records database table
Clears all attendance records for a fresh start
Google Sheets remains as backup/source of truth
"""

import os
import sys

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, get_db
from models import AttendanceRecord, db

def reset_attendance_records():
    """Clear all attendance records from database"""
    with app.app_context():
        print("=" * 80)
        print("🗑️  RESETTING ATTENDANCE RECORDS DATABASE")
        print("=" * 80)
        print()
        
        # Count existing records
        count = AttendanceRecord.query.count()
        print(f"📊 Current records in database: {count}")
        print()
        
        if count == 0:
            print("✅ Database is already empty!")
            return
        
        # Confirm deletion
        print("⚠️  WARNING: This will delete ALL attendance records from the database!")
        print("   Google Sheets will remain unchanged (your backup is safe)")
        print()
        response = input("Are you sure you want to continue? (type 'YES' to confirm): ")
        
        if response.strip().upper() != 'YES':
            print("❌ Aborted - no records deleted")
            return
        
        print()
        print("🗑️  Deleting all attendance records...")
        
        try:
            # Delete all records
            deleted = AttendanceRecord.query.delete()
            db.session.commit()
            
            print(f"✅ Successfully deleted {deleted} records!")
            print()
            print("=" * 80)
            print("🎉 DATABASE RESET COMPLETE")
            print("=" * 80)
            print()
            print("Next steps:")
            print("1. Go to Stats Input and log new stats")
            print("2. Or run migrate_sheets_to_db.py to re-import from Google Sheets")
            print()
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error deleting records: {e}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    reset_attendance_records()

