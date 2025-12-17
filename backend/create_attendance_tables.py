"""
Create attendance tracking tables using SQLAlchemy
This is more reliable than running raw SQL
"""

import os
import sys
from dotenv import load_dotenv

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

load_dotenv()

from app import app, db
from models import Region, CampusV2, AttendanceRecord

def create_tables():
    """Create all attendance-related tables"""
    
    with app.app_context():
        print("=" * 60)
        print("CREATING ATTENDANCE TRACKING TABLES")
        print("=" * 60)
        
        try:
            # Create all tables
            print("\n📦 Creating tables...")
            db.create_all()
            print("✓ Tables created successfully")
            
            # Check if regions exist
            region_count = Region.query.count()
            print(f"\n📊 Current regions: {region_count}")
            
            if region_count == 0:
                print("\n🌍 Seeding default regions...")
                
                regions_data = [
                    {
                        'name': 'australia',
                        'code': 'AU',
                        'display_name': 'Australia',
                        'timezone': 'Australia/Adelaide',
                        'currency': 'AUD',
                        'active': True,
                        'coming_soon': False
                    },
                    {
                        'name': 'united_states',
                        'code': 'US',
                        'display_name': 'United States',
                        'timezone': 'America/Los_Angeles',
                        'currency': 'USD',
                        'active': False,
                        'coming_soon': True
                    },
                    {
                        'name': 'brazil',
                        'code': 'BR',
                        'display_name': 'Brazil',
                        'timezone': 'America/Sao_Paulo',
                        'currency': 'BRL',
                        'active': False,
                        'coming_soon': True
                    },
                    {
                        'name': 'indonesia',
                        'code': 'ID',
                        'display_name': 'Indonesia',
                        'timezone': 'Asia/Jakarta',
                        'currency': 'IDR',
                        'active': False,
                        'coming_soon': True
                    }
                ]
                
                for region_data in regions_data:
                    region = Region(**region_data)
                    db.session.add(region)
                    print(f"  ✓ Added region: {region_data['display_name']}")
                
                db.session.commit()
                print("✓ Regions seeded")
            
            # Show final state
            print("\n" + "=" * 60)
            print("DATABASE STATE")
            print("=" * 60)
            
            # Inspect database
            from sqlalchemy import inspect
            inspector = inspect(db.engine)
            tables = inspector.get_table_names()
            
            print(f"\n📊 Total tables: {len(tables)}")
            
            # Show our new tables
            new_tables = ['regions', 'campuses_v2', 'attendance_records']
            print(f"\n📋 Attendance tracking tables:")
            for table in new_tables:
                if table in tables:
                    # Count rows
                    if table == 'regions':
                        count = Region.query.count()
                    elif table == 'campuses_v2':
                        count = CampusV2.query.count()
                    elif table == 'attendance_records':
                        count = AttendanceRecord.query.count()
                    else:
                        count = 0
                    print(f"   ✓ {table}: {count} rows")
                else:
                    print(f"   ✗ {table}: NOT FOUND")
            
            print("\n" + "=" * 60)
            print("✅ Setup complete!")
            print("=" * 60)
            
            print("\n📝 Next steps:")
            print("   1. Run: python seed_campuses_v2.py")
            print("   2. Run: python migrate_sheets_to_db.py --preview")
            print("   3. Run: python migrate_sheets_to_db.py")
            
            return True
            
        except Exception as e:
            print(f"\n✗ ERROR: {e}")
            import traceback
            traceback.print_exc()
            return False

if __name__ == '__main__':
    success = create_tables()
    sys.exit(0 if success else 1)

