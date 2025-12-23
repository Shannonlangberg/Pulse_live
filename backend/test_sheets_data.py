#!/usr/bin/env python3
"""
Quick test to verify Google Sheets data and field mapping
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app

def test_sheets_data():
    with app.app_context():
        print("=" * 80)
        print("🔍 TESTING GOOGLE SHEETS DATA")
        print("=" * 80)
        print()
        
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
            
            # Find Copper Coast entries
            print("Looking for Copper Coast entries...")
            print()
            
            for row in google_data:
                if isinstance(row, dict) and 'Campus' in row:
                    campus = str(row.get('Campus', '')).lower()
                    if 'copper' in campus:
                        date = row.get('Date', 'N/A')
                        total_people = row.get('Total People in Campus', 'N/A')
                        total_attendance = row.get('Total Attendance', 'N/A')
                        
                        print(f"Date: {date}")
                        print(f"  Campus: {row.get('Campus', 'N/A')}")
                        print(f"  📊 Total People in Campus (Column D): {total_people}")
                        print(f"  📊 Total Attendance (Column 35): {total_attendance}")
                        print(f"  Kids: {row.get('Kids Attendance', 'N/A')}")
                        print(f"  Youth: {row.get('Youth Attendance', 'N/A')}")
                        print()
            
            # Show available column headers
            print("=" * 80)
            print("Available columns in Google Sheets:")
            if google_data:
                sample_row = google_data[0]
                if isinstance(sample_row, dict):
                    for col in sorted(sample_row.keys()):
                        print(f"  - {col}")
            
        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    test_sheets_data()

