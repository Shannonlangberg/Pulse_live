#!/usr/bin/env python3
"""
Emergency Password Reset Script
Use this to reset a user's password when locked out
"""
import sqlite3
import sys
from werkzeug.security import generate_password_hash

def reset_password(username, new_password):
    """Reset password for a user"""
    try:
        # Connect to the database
        conn = sqlite3.connect('instance/futures_link.db')
        cursor = conn.cursor()
        
        # Check if user exists
        cursor.execute('SELECT id, username, email FROM users WHERE username = ?', (username,))
        user = cursor.fetchone()
        
        if not user:
            print(f"❌ User '{username}' not found!")
            conn.close()
            return False
        
        user_id, username, email = user
        print(f"✅ Found user: {username} (ID: {user_id}, Email: {email})")
        
        # Generate new password hash
        password_hash = generate_password_hash(new_password)
        
        # Update password
        cursor.execute('UPDATE users SET password_hash = ? WHERE id = ?', (password_hash, user_id))
        conn.commit()
        
        print(f"✅ Password reset successfully for user '{username}'!")
        print(f"   New password: {new_password}")
        print(f"\nYou can now log in with:")
        print(f"   Username: {username}")
        print(f"   Password: {new_password}")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error resetting password: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python emergency_password_reset.py <username> <new_password>")
        print("\nExample:")
        print("  python emergency_password_reset.py superadmin futures2025")
        sys.exit(1)
    
    username = sys.argv[1]
    new_password = sys.argv[2]
    
    print(f"🔧 Emergency Password Reset")
    print(f"=" * 50)
    print(f"Username: {username}")
    print(f"New Password: {new_password}")
    print(f"=" * 50)
    print()
    
    confirm = input("Are you sure you want to reset this password? (yes/no): ")
    if confirm.lower() != 'yes':
        print("❌ Password reset cancelled")
        sys.exit(0)
    
    if reset_password(username, new_password):
        print("\n✅ Done! You can now log in.")
    else:
        print("\n❌ Failed to reset password")
        sys.exit(1)

