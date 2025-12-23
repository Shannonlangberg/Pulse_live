# Role Permissions Fix - Campus Pastors

## Problem
Campus pastors were seeing admin pages in the Settings section (Users, Role Manager, Campuses, etc.) when they should only see "My Profile".

## Root Cause
1. Navigation components were checking role-based permissions correctly
2. BUT custom permissions were overriding role defaults
3. Campus pastors with NO custom permissions set were falling back to role defaults
4. The role arrays in navigation included `campus_pastor` for many settings pages

## Solution Implemented

### 1. Updated Navigation Role Arrays
**Files Modified:**
- `/frontend/src/components/TopNavigation.jsx`
- `/frontend/src/components/EnhancedNavigation.jsx`

**Changes:**
- Removed `campus_pastor` from settings pages role arrays (Users, Role Manager, Campuses, Beacons, Resource Manager, TV Manager, Events Manager, Notifications, Attendance Data)
- Kept `campus_pastor` in: My Profile (always visible)

### 2. Updated Role Manager Defaults
**File:** `/frontend/src/pages/RoleManager.jsx`

**Changes:**
- Set all `campus_pastor` role defaults for settings pages to `false`
- Settings pages campus pastors CANNOT see:
  - `user_management` (Users & Role Manager pages)
  - `campus_management` (Campuses page)
  - `region_access` (Region settings)
  - `homepage_manager` (Homepage Manager)
  - `beacon_management` (Beacons)
  - `pathway_manager` (Journey Manager)
  - `resource_manager` (Resource Manager)
  - `tv_manager` (TV Manager)
  - `events_manager` (Events Manager)
  - `notifications` (Push Notifications)
  - `data_export` (Data Export)

### 3. Updated Backend Role Configuration
**File:** `/backend/config/roles.yaml`

**Changes:**
- Clarified campus_pastor permissions
- Set `users: []` (no user management)
- Set `campuses: []` (no campus management)
- Set `system: []` (no system settings)
- Set `settings: []` (no settings pages - only My Profile is visible)
- Added clear comments explaining restrictions

### 4. Enhanced Role Manager UI
**File:** `/frontend/src/pages/RoleManager.jsx`

**Improvements:**
- Added informational box explaining how permissions work
- Reorganized table headers to distinguish "Main Pages" from "Settings Sub-Pages"
- Added visual distinction with gradient backgrounds
- Added descriptions to settings features
- Improved comments in role defaults

## How It Works Now

### Permission Check Flow
1. **Navigation components** check if user's role is in the `roles` array
2. If user has a `featureKey`, check `customPermissions[featureKey]`
3. Custom permissions OVERRIDE role defaults
4. If no custom permission set, fall back to role array check

### Campus Pastor Access
**What they CAN see:**
- Home
- Portal section: Input, Dashboard, Resources
- Main navigation pages: People, Heartbeat, Connect Groups, Prayer, Pulse TV, Events, Serving, Communications, Devotions
- Settings section: **Only "My Profile"**

**What they CANNOT see:**
- Finance pages
- Settings admin pages (Users, Role Manager, Campuses, etc.)

## Testing

To test campus pastor permissions:
1. Log in as a campus pastor user
2. Navigate to Settings section
3. Verify only "My Profile" tab appears at the top
4. Verify cannot access `/users`, `/role-manager`, `/campuses`, etc. directly

## Role Manager Matrix

The Role Manager now provides a comprehensive matrix where you can:
- See all users and their role defaults
- Toggle any permission for any user (creates custom override)
- Blue dot indicates custom permission
- Settings sub-pages clearly separated from main pages
- Bulk operations for enabling/disabling features by role

## Notes

- "My Profile" is always visible to all roles (no featureKey check)
- Custom permissions in Role Manager override all role defaults
- Changes save to database `users.custom_permissions` column
- Frontend checks both role arrays AND custom permissions


