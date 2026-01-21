"""
Add Indonesian campuses to the database
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

def seed_indonesia_campuses():
    """Add Indonesian campuses and region"""
    
    with app.app_context():
        print("=" * 60)
        print("ADDING: Indonesian Campuses")
        print("=" * 60)
        
        # Load Indonesian campuses
        campuses_file = Path(__file__).parent / 'campuses_indonesia.json'
        if not campuses_file.exists():
            print(f"ERROR: {campuses_file} not found")
            return False
        
        with open(campuses_file, 'r') as f:
            data = json.load(f)
        
        campuses_data = data.get('campuses', {})
        print(f"\n✓ Loaded {len(campuses_data)} Indonesian campuses")
        
        # Check if Indonesia region exists, create if not
        indonesia_region = Region.query.filter_by(code='ID').first()
        if not indonesia_region:
            print("\n📍 Creating Indonesia region...")
            indonesia_region = Region(
                name='indonesia',
                code='ID',
                display_name='Indonesia',
                timezone='Asia/Jakarta',  # Western Indonesia Time
                currency='IDR',
                active=True,
                coming_soon=False
            )
            db.session.add(indonesia_region)
            db.session.commit()
            print("✓ Created Indonesia region")
        else:
            print(f"\n✓ Using existing Indonesia region (ID: {indonesia_region.id})")
        
        # Add each campus
        inserted = 0
        updated = 0
        
        print("\n🏢 Adding campuses...")
        print("-" * 60)
        
        for campus_id, campus_data in campuses_data.items():
            # Check if campus already exists
            existing = CampusV2.query.filter_by(campus_id=campus_data['id']).first()
            
            # Prepare JSON fields
            service_times_json = json.dumps(campus_data.get('service_times', []))
            detection_patterns_json = json.dumps(campus_data.get('detection_patterns', []))
            
            # Store additional metadata (pastors, emails, admins) in a metadata field
            metadata = {
                'pastors': campus_data.get('pastors', []),
                'campus_emails': campus_data.get('campus_emails', []),
                'administrators': campus_data.get('administrators', [])
            }
            
            if existing:
                # Update existing campus
                existing.name = campus_data['name']
                existing.display_name = campus_data['display_name']
                existing.region_id = indonesia_region.id
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
                    region_id=indonesia_region.id,
                    active=campus_data.get('active', True),
                    service_times=service_times_json,
                    detection_patterns=detection_patterns_json
                )
                db.session.add(campus)
                inserted += 1
                print(f"✓ Inserted: {campus_data['display_name']}")
                
                # Print pastor and admin info
                pastors = campus_data.get('pastors', [])
                if pastors:
                    pastor_names = [p['name'] for p in pastors]
                    print(f"   Pastors: {', '.join(pastor_names)}")
                
                admins = campus_data.get('administrators', [])
                if admins:
                    admin_names = [a['name'] for a in admins]
                    print(f"   Admins: {', '.join(admin_names)}")
        
        # Commit changes
        db.session.commit()
        
        # Summary
        print("\n" + "=" * 60)
        print("COMPLETED")
        print("=" * 60)
        print(f"✓ Inserted:  {inserted} campuses")
        print(f"✓ Updated:   {updated} campuses")
        print("=" * 60)
        
        # Display all Indonesian campuses
        indo_campuses = CampusV2.query.filter_by(region_id=indonesia_region.id, active=True).all()
        print(f"\n📋 Indonesian Campuses ({len(indo_campuses)}):")
        for campus in indo_campuses:
            service_times = json.loads(campus.service_times) if campus.service_times else []
            print(f"   • {campus.display_name}")
            print(f"     ID: {campus.campus_id}")
            print(f"     Service Times: {', '.join(service_times)}")
            print()
        
        return True

if __name__ == '__main__':
    seed_indonesia_campuses()

