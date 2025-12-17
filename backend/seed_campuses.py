#!/usr/bin/env python3
"""
Seed campuses from campuses.json into the database
"""
import json
import sqlite3
import os
import sys

def seed_campuses(db_path=None):
    """Load campuses from campuses.json into database"""
    
    # Get paths
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    campuses_json_path = os.path.join(backend_dir, 'campuses.json')
    
    # Use provided db_path or fall back to extracting from DATABASE_URL
    if not db_path:
        database_url = os.getenv('DATABASE_URL', '')
        if database_url and database_url.startswith('sqlite:///'):
            db_path = database_url.replace('sqlite:///', '')
            # Handle 4 slashes for absolute paths
            if not db_path.startswith('/'):
                db_path = os.path.join(backend_dir, db_path)
        else:
            # Fallback to default
            db_path = os.path.join(backend_dir, 'instance', 'church_voice.db')
    
    print(f"[SEED] Loading campuses from: {campuses_json_path}")
    print(f"[SEED] Database path: {db_path}")
    
    # Ensure database directory exists (SQLite will create the file if it doesn't exist)
    db_dir = os.path.dirname(db_path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    
    # Load campuses.json
    if not os.path.exists(campuses_json_path):
        print(f"[SEED] ERROR: campuses.json not found at {campuses_json_path}")
        return False
    
    with open(campuses_json_path, 'r') as f:
        data = json.load(f)
    
    campuses = data.get('campuses', {})
    if not campuses:
        print("[SEED] ERROR: No campuses found in campuses.json")
        return False
    
    print(f"[SEED] Found {len(campuses)} campuses in JSON file")
    
    # Connect to database (SQLite will create the file if it doesn't exist)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Get Australia region ID (should be 1)
        cursor.execute("SELECT id FROM regions WHERE code = 'AU'")
        result = cursor.fetchone()
        if not result:
            print("[SEED] ERROR: Australia region not found in database")
            return False
        
        australia_region_id = result[0]
        print(f"[SEED] Using region_id={australia_region_id} for Australia")
        
        # Check how many campuses already exist
        cursor.execute("SELECT COUNT(*) FROM campuses_new")
        existing_count = cursor.fetchone()[0]
        print(f"[SEED] Currently {existing_count} campuses in database")
        
        if existing_count > 0:
            print("[SEED] Campuses already exist, skipping seed")
            return True
        
        # Insert each campus
        inserted = 0
        for campus_id, campus_data in campuses.items():
            # Skip the "all_campuses" special entry
            if campus_data.get('special'):
                print(f"[SEED] Skipping special campus: {campus_id}")
                continue
            
            # Prepare data
            service_times_json = json.dumps(campus_data.get('service_times', []))
            detection_patterns_json = json.dumps(campus_data.get('detection_patterns', []))
            
            # Insert campus
            cursor.execute('''
                INSERT INTO campuses_new 
                (campus_id, name, display_name, region_id, active, service_times, detection_patterns)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                campus_data['id'],
                campus_data['name'],
                campus_data['display_name'],
                australia_region_id,
                1 if campus_data.get('active', True) else 0,
                service_times_json,
                detection_patterns_json
            ))
            
            inserted += 1
            print(f"[SEED] Inserted: {campus_data['name']}")
        
        conn.commit()
        print(f"[SEED] Successfully inserted {inserted} campuses")
        return True
        
    except Exception as e:
        print(f"[SEED] ERROR: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == '__main__':
    success = seed_campuses()
    sys.exit(0 if success else 1)

