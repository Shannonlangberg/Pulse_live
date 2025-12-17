#!/usr/bin/env python3
"""
Seed users from users.json into the database
"""
import json
import sqlite3
import os
import sys

def seed_users(db_path=None):
    """Load users from users.json into database"""
    
    # Get paths
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    users_json_path = os.path.join(backend_dir, 'users.json')
    
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
                print(f"[SEED] Using DATABASE_URL path: {db_path}")
        
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
                    print(f"[SEED] Found volume at {volume_path}, using: {db_path}")
                    break
        
        # Fallback to local development path
        if not db_path:
            instance_path = os.path.join(backend_dir, 'instance', 'futures_link.db')
            if os.path.exists(instance_path):
                db_path = instance_path
                print(f"[SEED] Using local instance path: {db_path}")
            else:
                # Last resort: backend directory
                db_path = os.path.join(backend_dir, 'futures_link.db')
                print(f"[SEED] Using fallback path: {db_path}")
    
    print(f"[SEED] Ensuring admin user exists")
    print(f"[SEED] Database path: {db_path}")
    
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
            print(f"[SEED] WARNING: users table does not exist yet. Migrations may not have run.")
            print(f"[SEED] Users table should be created by migration 012_users_table.sql")
            conn.close()
            return False
        
        # Load users from users.json
        users_data = {}
        if os.path.exists(users_json_path):
            try:
                with open(users_json_path, 'r') as f:
                    data = json.load(f)
                    users_data = data.get('users', {})
                print(f"[SEED] Loaded {len(users_data)} users from users.json")
            except Exception as e:
                print(f"[SEED] WARNING: Could not load users.json: {e}")
                users_data = {}
        
        # If no users in JSON, create default admin
        if not users_data:
            from werkzeug.security import generate_password_hash
            admin_password_hash = generate_password_hash('futures2025')
            users_data = {
                'admin': {
                    'username': 'admin',
                    'password_hash': admin_password_hash,
                    'full_name': 'Administrator',
                    'email': 'admin@futures.church',
                    'role': 'admin',
                    'campus': 'all_campuses',
                    'active': True
                }
            }
            print("[SEED] No users.json found, creating default admin user")
        
        # Seed all users from users.json
        users_seeded = 0
        users_updated = 0
        
        for user_id, user_data in users_data.items():
            username = user_data.get('username', user_id)
            password_hash = user_data.get('password_hash', '')
            full_name = user_data.get('full_name', username)
            email = user_data.get('email', '')
            role = user_data.get('role', 'pastor')
            campus = user_data.get('campus', 'all_campuses')
            active = 1 if user_data.get('active', True) else 0
            
            # If password_hash is not provided, generate default password hash
            if not password_hash:
                from werkzeug.security import generate_password_hash
                password_hash = generate_password_hash('futures2025')
            
            # Check if user exists
            cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
            user_exists = cursor.fetchone()
            
            if user_exists:
                # Update existing user
                cursor.execute('''
                    UPDATE users 
                    SET password_hash = ?, full_name = ?, email = ?, role = ?, campus = ?, active = ?
                    WHERE username = ?
                ''', (
                    password_hash,
                    full_name,
                    email,
                    role,
                    campus,
                    active,
                    username
                ))
                users_updated += 1
                print(f"[SEED] Updated user: {username} ({role})")
            else:
                # Create new user
                cursor.execute('''
                    INSERT INTO users (username, password_hash, full_name, email, role, campus, active)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    username,
                    password_hash,
                    full_name,
                    email,
                    role,
                    campus,
                    active
                ))
                users_seeded += 1
                print(f"[SEED] Created user: {username} ({role})")
        
        conn.commit()
        print(f"[SEED] Successfully seeded {users_seeded} new users and updated {users_updated} existing users")
        return True
        
    except Exception as e:
        print(f"[SEED] ERROR: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == '__main__':
    success = seed_users()
    sys.exit(0 if success else 1)

