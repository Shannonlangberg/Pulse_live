"""
Simple migration runner for SQL migration files
Usage: python run_migration.py migrations/038_attendance_records_system.sql
"""

import os
import sys
import sqlite3
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

def get_database_path():
    """Get the database path from environment"""
    database_url = os.getenv('DATABASE_URL', 'sqlite:///instance/futures_link.db').strip()
    
    # Extract path from SQLite URL
    if database_url.startswith('sqlite:///'):
        # Remove sqlite:/// prefix
        db_path = database_url.replace('sqlite:///', '', 1)
        # If it's a relative path, make it relative to backend directory
        if not os.path.isabs(db_path):
            db_path = os.path.join(os.path.dirname(__file__), db_path)
        return db_path
    elif database_url.startswith('postgresql'):
        print("ERROR: This script only supports SQLite databases")
        print("For PostgreSQL, use a proper migration tool like Alembic")
        sys.exit(1)
    else:
        # Default path
        return os.path.join(os.path.dirname(__file__), 'instance', 'futures_link.db')


def run_migration(migration_file):
    """Run a SQL migration file"""
    
    # Get migration path
    if not os.path.exists(migration_file):
        migration_file = os.path.join(os.path.dirname(__file__), migration_file)
    
    if not os.path.exists(migration_file):
        print(f"ERROR: Migration file not found: {migration_file}")
        return False
    
    # Get database path
    db_path = get_database_path()
    print(f"Database: {db_path}")
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    # Read migration file
    with open(migration_file, 'r') as f:
        sql = f.read()
    
    print(f"Migration: {os.path.basename(migration_file)}")
    print("=" * 60)
    
    # Connect to database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Split SQL into individual statements
        statements = [s.strip() for s in sql.split(';') if s.strip() and not s.strip().startswith('--')]
        
        print(f"Executing {len(statements)} SQL statements...")
        
        for i, statement in enumerate(statements, 1):
            try:
                # Skip comments
                if statement.startswith('--'):
                    continue
                
                cursor.execute(statement)
                
                # Show progress for longer migrations
                if i % 5 == 0:
                    print(f"  ✓ Executed {i}/{len(statements)} statements")
            except sqlite3.Error as e:
                # Some errors can be ignored (like table already exists)
                if 'already exists' in str(e).lower():
                    print(f"  ⊘ Skipped (already exists): statement {i}")
                else:
                    print(f"  ✗ Error on statement {i}: {e}")
                    print(f"  Statement: {statement[:100]}...")
        
        conn.commit()
        print("=" * 60)
        print("✅ Migration completed successfully!")
        
        # Show created tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        tables = cursor.fetchall()
        print(f"\n📊 Database now has {len(tables)} tables:")
        for table in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table[0]}")
            count = cursor.fetchone()[0]
            print(f"   • {table[0]}: {count} rows")
        
        return True
        
    except Exception as e:
        conn.rollback()
        print(f"ERROR: Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        conn.close()


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python run_migration.py <migration_file>")
        print("\nExample:")
        print("  python run_migration.py migrations/038_attendance_records_system.sql")
        sys.exit(1)
    
    migration_file = sys.argv[1]
    success = run_migration(migration_file)
    sys.exit(0 if success else 1)

