# Campus Pastor & Staff Permissions Fix

## Issue
Campus Pastors and Staff members were able to access admin settings pages (Role Manager, Users, Campuses, etc.) that they shouldn't have access to. Even though the backend API was protected, users could navigate to these pages via URL.

## Root Cause
1. **Navigation Access**: Campus Pastors and Staff couldn't see the Settings section in navigation to access "My Profile" 
2. **No Frontend Guards**: Admin pages (RoleManager, UserManagement, CampusManagement) had no component-level authorization checks
3. **Direct URL Access**: Users could navigate directly to `/role-manager`, `/users`, `/campuses` etc. via URL, bypassing navigation restrictions

## Solution Implemented

### 1. Frontend Navigation Updates

#### `frontend/src/components/EnhancedNavigation.jsx`
- **Added** `campus_pastor`, `pastor`, `user`, `staff`, `finance` to Settings section roles
- This allows these roles to see the Settings section ONLY to access "My Profile"
- Individual settings items (Users, Role Manager, etc.) remain restricted to admin/leadership roles

#### `frontend/src/components/TopNavigation.jsx`
- **Added comments** clarifying that Campus Pastors and Staff should only see "My Profile" by default
- Other settings pages still require `['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor']` roles

### 2. Component-Level Authorization Guards

Added authorization checks to three critical admin pages:

#### `frontend/src/pages/RoleManager.jsx`
- **Added**: Session check on component mount
- **Allowed Roles**: `['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor']`
- **Behavior**: Redirects unauthorized users to `/profile`
- **Loading State**: Shows "Checking authorization..." while validating

#### `frontend/src/pages/UserManagement.jsx`
- **Added**: Session check on component mount
- **Allowed Roles**: `['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor']`
- **Behavior**: Redirects unauthorized users to `/profile`
- **Loading State**: Shows "Checking authorization..." while validating

#### `frontend/src/pages/CampusManagement.jsx`
- **Added**: Session check on component mount
- **Allowed Roles**: `['superadmin', 'admin', 'senior_leadership', 'senior_leader', 'senior_pastor', 'lead_pastor']`
- **Behavior**: Redirects unauthorized users to `/profile`
- **Loading State**: Shows "Checking authorization..." while validating

### 3. Backend Configuration (Already Correct)

#### `backend/config/roles.yaml`
```yaml
campus_pastor:
  permissions:
    users: []          # NO access to user management
    campuses: []       # NO access to campus management
    system: []         # NO access to system settings
    settings: []       # NO access to settings pages

staff:
  permissions:
    users: []          # NO access to user management
    campuses: []       # NO access to campus management
    system: []         # NO access to system settings
    settings: ["view"] # Only profile view access
```

#### Backend API Protection (Already in Place)
- `/api/users` - Protected with role check
- `/api/users/permissions` - Protected with role check
- `/api/campuses` - Protected with role check

## How It Works Now

### For Campus Pastors:
1. ✅ Can see "Settings" in left navigation
2. ✅ Clicking "Settings" navigates to `/profile` (My Profile)
3. ✅ Can see ONLY "My Profile" in the Settings top navigation
4. ❌ Cannot see: Users, Role Manager, Campuses, Beacons, etc.
5. ❌ If they try to navigate directly to `/role-manager` or `/users`, they are immediately redirected to `/profile`

### For Staff Members:
1. ✅ Can see "Settings" in left navigation
2. ✅ Clicking "Settings" navigates to `/profile` (My Profile)
3. ✅ Can see ONLY "My Profile" in the Settings top navigation
4. ❌ Cannot see: Users, Role Manager, Campuses, Beacons, etc.
5. ❌ If they try to navigate directly to admin pages, they are immediately redirected to `/profile`

### For Admin/Leadership:
1. ✅ Can see "Settings" in left navigation
2. ✅ Can see ALL settings pages: My Profile, Users, Role Manager, Campuses, Beacons, etc.
3. ✅ Can access all admin pages
4. ✅ Can use Role Manager to grant custom permissions to specific users if needed

## Security Layers

The system now has **3 layers of security**:

1. **Navigation Layer**: Only shows links user has permission to see
2. **Component Layer**: Redirects unauthorized users before page loads
3. **API Layer**: Rejects unauthorized API requests with 403 Forbidden

## Custom Permissions Override

Admins can still use the Role Manager to grant specific Campus Pastors or Staff members access to admin features by:
1. Going to Role Manager
2. Finding the user
3. Toggling the specific feature permission (e.g., `user_management`)
4. Saving changes

When a custom permission is granted, it overrides the role default and the user will see that feature in navigation.

## Testing Checklist

- [ ] Log in as Campus Pastor → Settings shows only "My Profile"
- [ ] Try navigating to `/role-manager` as Campus Pastor → Redirected to `/profile`
- [ ] Try navigating to `/users` as Campus Pastor → Redirected to `/profile`
- [ ] Try navigating to `/campuses` as Campus Pastor → Redirected to `/profile`
- [ ] Log in as Staff → Settings shows only "My Profile"
- [ ] Try navigating to `/role-manager` as Staff → Redirected to `/profile`
- [ ] Log in as Admin → Settings shows all admin pages
- [ ] Admin can access all pages without redirect
- [ ] Grant custom permission via Role Manager → User can now access that feature

## Files Modified

1. `frontend/src/components/EnhancedNavigation.jsx` - Added campus_pastor/staff to Settings section
2. `frontend/src/components/TopNavigation.jsx` - Added clarifying comments
3. `frontend/src/pages/RoleManager.jsx` - Added authorization guard
4. `frontend/src/pages/UserManagement.jsx` - Added authorization guard
5. `frontend/src/pages/CampusManagement.jsx` - Added authorization guard

## No Backend Changes Required

The backend was already properly configured with correct permissions in `roles.yaml` and API endpoints were already protected.

