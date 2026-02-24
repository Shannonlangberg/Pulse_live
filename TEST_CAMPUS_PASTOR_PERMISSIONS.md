# Testing Campus Pastor Permissions

## Test Checklist

### 1. Login as Campus Pastor
- [ ] Log in with a campus pastor account
- [ ] Verify you see the main navigation sidebar

### 2. Check Main Navigation Sections
- [ ] **Home** - Should be visible and accessible
- [ ] **Portal** - Should be visible and accessible
- [ ] **Settings** - Should be visible and accessible

### 3. Check Portal Sub-Pages (Top Navigation)
When in Portal section, verify these tabs appear:
- [ ] **Input** ✓ (Should see)
- [ ] **Dashboard** ✓ (Should see)
- [ ] **Resources** ✓ (Should see)
- [ ] **Finance Input** ✗ (Should NOT see)

### 4. Check Settings Sub-Pages (Top Navigation) ⚠️ CRITICAL
When in Settings section, verify ONLY this tab appears:
- [ ] **My Profile** ✓ (Should see - ONLY THIS ONE)

Should NOT see any of these:
- [ ] **Users** ✗ (Should NOT see)
- [ ] **Role Manager** ✗ (Should NOT see)
- [ ] **Homepage Manager** ✗ (Should NOT see)
- [ ] **Campuses** ✗ (Should NOT see)
- [ ] **Beacons** ✗ (Should NOT see)
- [ ] **Resource Manager** ✗ (Should NOT see)
- [ ] **TV Manager** ✗ (Should NOT see)
- [ ] **Events Manager** ✗ (Should NOT see)
- [ ] **Notifications** ✗ (Should NOT see)
- [ ] **Attendance Data** ✗ (Should NOT see)

### 5. Check Direct URL Access
Try accessing these URLs directly - should be blocked or redirect:
- [ ] `/users` - Should not be accessible
- [ ] `/role-manager` - Should not be accessible
- [ ] `/campuses` - Should not be accessible
- [ ] `/beacons` - Should not be accessible
- [ ] `/resources/manage` - Should not be accessible
- [ ] `/tv/manage` - Should not be accessible
- [ ] `/events/manage` - Should not be accessible
- [ ] `/notifications` - Should not be accessible
- [ ] `/attendance-data` - Should not be accessible
- [ ] `/homepage-manager` - Should not be accessible

### 6. Check Profile Page
- [ ] Can access `/profile`
- [ ] Can update email
- [ ] Can change password
- [ ] No admin controls visible

### 7. Check Role Manager (as Admin)
As an admin user:
- [ ] Open Role Manager
- [ ] Find a campus pastor user
- [ ] Verify all settings features show as disabled (red X) by default
- [ ] Toggle one setting feature to enabled (green check)
- [ ] Save changes
- [ ] Log in as that campus pastor
- [ ] Verify they now see that one settings page

## Expected Results

### Campus Pastor Default Access
**CAN Access:**
- Home page
- Portal → Input, Dashboard, Resources
- Settings → My Profile ONLY
- Main app pages: People, Heartbeat, Connect Groups, Prayer, Pulse TV, Events, Serving, Communications, Devotions

**CANNOT Access:**
- Finance pages
- Any Settings admin pages (Users, Role Manager, Campuses, etc.)

### Custom Permissions Override
- If admin grants custom permission via Role Manager, campus pastor will see that specific page
- Custom permissions override role defaults
- Blue dot in Role Manager indicates custom override

## Troubleshooting

### If campus pastor still sees admin pages:
1. Check if they have custom permissions set in Role Manager
2. Clear any custom permissions for that user
3. Save changes in Role Manager
4. Have user log out and log back in
5. Check browser cache - hard refresh (Cmd+Shift+R or Ctrl+Shift+R)

### If changes don't take effect:
1. Verify changes saved in Role Manager (look for success message)
2. User must log out and log back in for permission changes to take effect
3. Check browser console for errors
4. Verify backend is running latest code

## Test Users

Create test users if needed:
```sql
-- Campus Pastor test user
INSERT INTO users (username, password_hash, full_name, email, role, campus, active)
VALUES ('campus.pastor.test', '<hashed_password>', 'Test Campus Pastor', 'campus.pastor@test.com', 'campus_pastor', 'Perth', 1);
```

## Success Criteria

✅ Campus pastor sees ONLY "My Profile" in Settings section
✅ Campus pastor cannot access admin URLs directly
✅ Role Manager shows all settings features disabled for campus_pastor role
✅ Custom permissions in Role Manager can grant access to specific pages
✅ Changes persist after logout/login










