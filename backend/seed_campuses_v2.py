"""
Seed campuses_v2 table from campuses.json
This populates the new campuses_v2 table with region support
"""

import os
import sys
import json
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from app import app, db
from models import Region, CampusV2

def seed_campuses_v2():
    """Load campuses from campuses.json into campuses_v2 table"""
    
    with app.app_context():
        print("=" * 60)
        print("SEEDING: Campuses V2 Table")
        print("=" * 60)
        
        # Load campuses.json
        campuses_file = Path(__file__).parent / 'campuses.json'
        if not campuses_file.exists():
            print(f"ERROR: {campuses_file} not found")
            return False
        
        with open(campuses_file, 'r') as f:
            data = json.load(f)
        
        campuses_data = data.get('campuses', {})
        print(f"\n✓ Loaded {len(campuses_data)} campuses from campuses.json")
        
        # Get Australia region (should already exist from migration)
        australia_region = Region.query.filter_by(code='AU').first()
        if not australia_region:
            print("\n⚠️  Australia region not found, creating it...")
            australia_region = Region(
                name='australia',
                code='AU',
                display_name='Australia',
                timezone='Australia/Adelaide',
                currency='AUD',
                active=True,
                coming_soon=False
            )
            db.session.add(australia_region)
            db.session.commit()
            print("✓ Created Australia region")
        
        print(f"✓ Using region: {australia_region.display_name} (ID: {australia_region.id})")
        
        # Check existing campuses
        existing_count = CampusV2.query.count()
        print(f"\n📊 Current campuses in database: {existing_count}")
        
        if existing_count > 0:
            print("\n⚠️  Campuses already exist. Options:")
            print("   1. Skip seeding (default)")
            print("   2. Update existing campuses")
            print("   3. Delete and re-seed")
            
            response = input("\nChoose option (1/2/3) [1]: ").strip() or "1"
            
            if response == "3":
                print("\n🗑️  Deleting existing campuses...")
                CampusV2.query.delete()
                db.session.commit()
                print("✓ Deleted all campuses")
            elif response == "2":
                print("\n🔄 Updating existing campuses...")
            else:
                print("\n⊘ Skipping seed (campuses already exist)")
                return True
        
        # Insert/update each campus
        inserted = 0
        updated = 0
        skipped = 0
        
        print("\n🔄 Processing campuses...")
        print("-" * 60)
        
        for campus_id, campus_data in campuses_data.items():
            # Skip special entries
            if campus_data.get('special'):
                print(f"⊘ Skipping special campus: {campus_id}")
                skipped += 1
                continue
            
            # Check if campus already exists
            existing = CampusV2.query.filter_by(campus_id=campus_data['id']).first()
            
            # Prepare data
            service_times_json = json.dumps(campus_data.get('service_times', []))
            detection_patterns_json = json.dumps(campus_data.get('detection_patterns', []))
            
            if existing:
                # Update existing campus
                existing.name = campus_data['name']
                existing.display_name = campus_data['display_name']
                existing.region_id = australia_region.id
                existing.active = campus_data.get('active', True)
                existing.service_times = service_times_json
                existing.detection_patterns = detection_patterns_json
                updated += 1
                print(f"✓ Updated: {campus_data['display_name']}")
            else:
                # Insert new campus
                campus = CampusV2(
                    campus_id=campus_data['id'],
                    name=campus_data['name'],
                    display_name=campus_data['display_name'],
                    region_id=australia_region.id,
                    active=campus_data.get('active', True),
                    service_times=service_times_json,
                    detection_patterns=detection_patterns_json
                )
                db.session.add(campus)
                inserted += 1
                print(f"✓ Inserted: {campus_data['display_name']}")
        
        # Commit changes
        db.session.commit()
        
        # Summary
        print("\n" + "=" * 60)
        print("SEEDING COMPLETE")
        print("=" * 60)
        print(f"✓ Inserted:  {inserted} campuses")
        print(f"✓ Updated:   {updated} campuses")
        print(f"⊘ Skipped:   {skipped} campuses")
        print("=" * 60)
        
        # Display all campuses
        all_campuses = CampusV2.query.filter_by(active=True).all()
        print(f"\n📋 Active Campuses ({len(all_campuses)}):")
        for campus in all_campuses:
            service_times = json.loads(campus.service_times) if campus.service_times else []
            print(f"   • {campus.display_name}")
            print(f"     ID: {campus.campus_id}")
            print(f"     Service Times: {', '.join(service_times)}")
            print()
        
        return True

if __name__ == '__main__':
    seed_campuses_v2()
