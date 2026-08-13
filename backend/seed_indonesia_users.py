#!/usr/bin/env python3
"""
Seed Indonesian users from users_indonesia.json into the database
"""
import json
import sqlite3
import os
import sys

def seed_indonesia_users(db_path=None):
    """Load Indonesian users from users_indonesia.json into database"""
    
    # Get paths
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    users_json_path = os.path.join(backend_dir, 'users_indonesia.json')
    
    # Use provided db_path or use the same path logic as app.py
    if not db_path:
        # Check DATABASE_URL first (Railway PostgreSQL or custom SQLite)
        database_url = os.getenv('DATABASE_URL', '').strip()
        
        if database_url and database_url.startswith('sqlite:///'):
            # Extract path from DATABASE_URL (handles both sqlite:/// and sqlite:////)
            potential_path = database_url.replace('sqlite:///', '')
            # Handle 4 slashes (sqlite:////) - remove one more slash
            if potential_path.startswith('/'):
                # This is an absolute path (Railway mounted volume)
                db_path = potential_path
                print(f"[SEED_ID] Using DATABASE_URL path: {db_path}")
        
        # If no DATABASE_URL or it's not SQLite, check for Railway volumes (same logic as app.py)
        if not db_path or not database_url.startswith('sqlite:///'):
            volume_paths = [
                '/data',  # Common Railway volume path (RECOMMENDED)
                '/app/backend/instance',  # Alternative Railway volume path
                '/app/data',  # Another common path
            ]
            
            for volume_path in volume_paths:
                if os.path.exists(volume_path) and os.path.isdir(volume_path):
                    db_file = os.path.join(volume_path, 'futures_link.db')
                    db_path = db_file
                    print(f"[SEED_ID] Found volume at {volume_path}, using: {db_path}")
                    break
        
        # Fallback to local development path
        if not db_path:
            instance_path = os.path.join(backend_dir, 'instance', 'futures_link.db')
            if os.path.exists(instance_path):
                db_path = instance_path
                print(f"[SEED_ID] Using local instance path: {db_path}")
            else:
                # Last resort: backend directory
                db_path = os.path.join(backend_dir, 'futures_link.db')
                print(f"[SEED_ID] Using fallback path: {db_path}")
    
    print(f"[SEED_ID] ============================================================")
    print(f"[SEED_ID] SEEDING: Indonesian Users")
    print(f"[SEED_ID] ============================================================")
    print(f"[SEED_ID] Database path: {db_path}")
    
    # Ensure database directory exists (SQLite will create the file if it doesn't exist)
    db_dir = os.path.dirname(db_path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    
    # Connect to database (SQLite will create the file if it doesn't exist)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if users table exists (migrations should create it, but handle gracefully)
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        if not cursor.fetchone():
            print(f"[SEED_ID] WARNING: users table does not exist yet. Migrations may not have run.")
            print(f"[SEED_ID] Users table should be created by migration 012_users_table.sql")
            conn.close()
            return False
        
        # Load users from users_indonesia.json
        users_data = {}
        if os.path.exists(users_json_path):
            try:
                with open(users_json_path, 'r') as f:
                    data = json.load(f)
                    users_data = data.get('users', {})
                print(f"[SEED_ID] ✓ Loaded {len(users_data)} Indonesian users from users_indonesia.json")
            except Exception as e:
                print(f"[SEED_ID] ERROR: Could not load users_indonesia.json: {e}")
                return False
        else:
            print(f"[SEED_ID] ERROR: users_indonesia.json not found at {users_json_path}")
            return False
        
        # Generate password hash for default password
        from werkzeug.security import generate_password_hash
        default_password_hash = generate_password_hash('futures2025')
        
        # Seed all users from users_indonesia.json
        users_seeded = 0
        users_updated = 0
        
        print(f"[SEED_ID]")
        print(f"[SEED_ID] 🔄 Processing Indonesian users...")
        print(f"[SEED_ID] ------------------------------------------------------------")
        
        for user_id, user_data in users_data.items():
            username = user_data.get('username', user_id)
            password_hash = user_data.get('password_hash', default_password_hash)
            full_name = user_data.get('full_name', username)
            email = user_data.get('email', '')
            role = user_data.get('role', 'staff')
            campus = user_data.get('campus', 'all_campuses')
            active = 1 if user_data.get('active', True) else 0
            
            allowed_campuses = user_data.get('allowed_campuses')

            # Check if user exists
            cursor.execute("SELECT id, active, custom_permissions FROM users WHERE username = ?", (username,))
            user_exists = cursor.fetchone()

            if user_exists:
                # Existing users are managed via the app (User Management UI) - never
                # overwrite their password, role, campus, or details on deploy.
                # Exceptions:
                #  - an explicit "active": false in the JSON deactivates the account
                #  - "allowed_campuses" is merged in ONCE, only while the user's
                #    custom_permissions doesn't have the key yet (UI stays authoritative)
                if active == 0 and user_exists[1] != 0:
                    cursor.execute('UPDATE users SET active = 0 WHERE username = ?', (username,))
                    users_updated += 1
                    print(f"[SEED_ID] ✓ Deactivated: {full_name} ({role} @ {campus})")
                elif allowed_campuses:
                    try:
                        current_perms = json.loads(user_exists[2]) if user_exists[2] else {}
                    except (ValueError, TypeError):
                        current_perms = {}
                    if 'allowed_campuses' not in current_perms:
                        current_perms['allowed_campuses'] = allowed_campuses
                        cursor.execute('UPDATE users SET custom_permissions = ? WHERE username = ?',
                                       (json.dumps(current_perms), username))
                        users_updated += 1
                        print(f"[SEED_ID] ✓ Granted campus access {allowed_campuses}: {full_name}")
                    else:
                        print(f"[SEED_ID] - Skipped (exists): {full_name} ({role} @ {campus})")
                else:
                    print(f"[SEED_ID] - Skipped (exists): {full_name} ({role} @ {campus})")
            else:
                # Create new user
                custom_permissions = json.dumps({'allowed_campuses': allowed_campuses}) if allowed_campuses else None
                cursor.execute('''
                    INSERT INTO users (username, password_hash, full_name, email, role, campus, active, custom_permissions)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    username,
                    password_hash,
                    full_name,
                    email,
                    role,
                    campus,
                    active,
                    custom_permissions
                ))
                users_seeded += 1
                print(f"[SEED_ID] ✓ Created: {full_name} ({role} @ {campus})")
        
        conn.commit()
        
        print(f"[SEED_ID]")
        print(f"[SEED_ID] ============================================================")
        print(f"[SEED_ID] COMPLETED")
        print(f"[SEED_ID] ============================================================")
        print(f"[SEED_ID] ✓ Created:  {users_seeded} new users")
        print(f"[SEED_ID] ✓ Deactivated:  {users_updated} retired users")
        print(f"[SEED_ID] ℹ️  Default password for NEW users only: futures2025")
        print(f"[SEED_ID] ============================================================")
        return True
        
    except Exception as e:
        print(f"[SEED_ID] ERROR: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == '__main__':
    success = seed_indonesia_users()
    sys.exit(0 if success else 1)

