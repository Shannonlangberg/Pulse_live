# Password Change Bug Fix

## Problem
Users were unable to change their passwords or update their email addresses through the My Profile page. The endpoints were returning 404 errors.

## Root Cause
The bug was in two endpoints:
- `/api/profile/change-password`
- `/api/profile/update-email`

Both endpoints were using `load_users_database()` which returns users indexed by **username**, but the code was trying to look up users by **user_id**:

```python
users_data = load_users_database()  # Returns: {'users': {username: {...}, ...}}
user_id = str(session.get('user_id'))
user = users_data.get('users', {}).get(user_id)  # ❌ Looking up by ID in a username-indexed dict!
```

This would always return `None`, causing the endpoints to return "User not found" (404).

## Solution
Changed both endpoints to query the database directly using the user_id instead of loading all users and trying to index by ID:

### Password Change Fix
```python
# Get user directly from database using user_id
user_id = session.get('user_id')
conn = get_db()
cursor = conn.cursor()
cursor.execute('SELECT id, username, password_hash FROM users WHERE id = ? AND active = 1', (user_id,))
user_row = cursor.fetchone()

if not user_row:
    return jsonify({"error": "User not found"}), 404

# Verify and update password
if not check_password_hash(user_row[2], current_password):
    return jsonify({"error": "Current password is incorrect"}), 401

new_password_hash = generate_password_hash(new_password)
cursor.execute('UPDATE users SET password_hash = ? WHERE id = ?', (new_password_hash, user_id))
conn.commit()
```

### Email Update Fix
```python
# Get user directly from database using user_id
user_id = session.get('user_id')
conn = get_db()
cursor = conn.cursor()
cursor.execute('SELECT id FROM users WHERE id = ? AND active = 1', (user_id,))
user_row = cursor.fetchone()

if not user_row:
    return jsonify({"error": "User not found"}), 404

# Update email in database
cursor.execute('UPDATE users SET email = ? WHERE id = ?', (email, user_id))
conn.commit()
```

## Files Modified
- `backend/app.py` - Fixed both `profile_change_password()` and `profile_update_email()` endpoints

## Testing
After deployment, users should be able to:
1. ✅ Change their password from the My Profile page
2. ✅ Update their email address from the My Profile page
3. ✅ See success messages after successful updates
4. ✅ Get proper error messages if current password is incorrect

## Deployment
Push the changes and redeploy. The fix will take effect immediately after the new version is deployed.

