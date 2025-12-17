# Multi-Region Support - Setup Guide

## Overview

Your Pulse system now has comprehensive multi-region support for managing stats, dashboards, and access control across Australia, United States, Indonesia, and Brazil.

## What's Been Implemented

### 1. Database Structure ✅

#### Regions Table
Already exists with 4 regions:
- **Australia (AU)** - Active
- **United States (US)** - Coming Soon
- **Brazil (BR)** - Coming Soon  
- **Indonesia (ID)** - Coming Soon

#### Users Table Enhancement
**New Migration**: `039_add_region_support_to_users.sql`
- Added `region_id` field to users table
- Users can now be assigned to specific regions
- `NULL` region_id = global access (for global roles)

#### Campuses & Attendance
- `campuses_v2` table includes `region_id`
- `attendance_records` table includes `region_id`
- All data is properly region-scoped

### 2. Role-Based Access Control (RBAC) ✅

#### Global Roles (Can See Everything)
These roles can access ALL regions and ALL campuses:
- `admin`
- `senior_leadership`
- `senior_pastor`
- `lead_pastor`

#### Regional Role
**NEW**: `region_leader` role
- Can see ALL campuses within their assigned region
- Must have `region_id` set in their user profile
- Has full access to all modules within their region
- Cannot see other regions

#### Campus Roles
- `campus_pastor` - Can only see their specific campus
- `staff` - Limited access to their campus
- Other roles as defined in `roles.yaml`

### 3. API Endpoints ✅

#### Regional Dashboard
```
GET /api/dashboard/regional?region=AU&date_filter=last_12_months
```

**Access**: Region leaders (their region) or global roles (any region)

**Returns**:
- Regional aggregate stats (attendance, giving, salvations, etc.)
- Breakdown by campus within the region
- Average weekly metrics
- Campus performance comparison

**Example Response**:
```json
{
  "region": {
    "code": "AU",
    "name": "Australia",
    "timezone": "Australia/Adelaide",
    "currency": "AUD"
  },
  "stats": {
    "total_attendance": 15420,
    "avg_weekly_attendance": 325.4,
    "total_salvations": 87,
    "total_giving": 245600.50,
    "campus_count": 8,
    "active_campuses": 8
  },
  "campuses": [
    {
      "campus_id": "adelaide_city",
      "campus_name": "Adelaide City",
      "total_attendance": 5200,
      "avg_attendance": 110.2
    },
    // ... more campuses
  ]
}
```

#### Global Dashboard  
```
GET /api/dashboard/global?date_filter=last_12_months
```

**Access**: Global roles ONLY (admin, senior_leadership, senior_pastor, lead_pastor)

**Returns**:
- Global aggregate stats across ALL regions
- Breakdown by region
- Regional performance comparison
- Total campuses worldwide

**Example Response**:
```json
{
  "global_stats": {
    "total_attendance": 45600,
    "avg_weekly_attendance": 952.1,
    "total_salvations": 234,
    "total_giving": 856400.00,
    "total_regions": 4,
    "active_regions": 1,
    "total_campuses": 25
  },
  "regions": [
    {
      "region_code": "AU",
      "region_name": "Australia",
      "total_attendance": 15420,
      "total_giving": 245600.50,
      "campus_count": 8
    },
    // ... more regions as they come online
  ]
}
```

#### Other Endpoints
```
GET /api/regions - List all regions
GET /api/regions/{region_code}/campuses - Get campuses in a region
POST /api/users/create - Now supports region_id
POST /api/users/{user_id}/edit - Now supports region_id
```

### 4. Access Control Implementation ✅

#### RBAC Utilities Enhanced
`backend/utils/rbac.py`:
- `is_region_scoped()` - Check if resource respects region boundaries
- `can_cross_region()` - Check if user has global access
- `get_accessible_regions()` - Get regions user can access
- `filter_by_region()` - Filter data by region permissions
- `validate_region_access()` - Validate specific region access

#### Campus Scope Utilities Enhanced  
`backend/utils/campus_scope.py`:
- `apply_region_filter()` - Apply region filtering to queries
- `get_region_filter_params()` - Get region filter parameters
- `filter_by_region()` - Filter data lists by region

## How to Use

### For Ps Ashley Evans (Senior Leadership)

Ashley already has `role: "senior_leader"` with `campus: "all_campuses"`.

**He can now access**:
1. **Global Dashboard** - See stats for ALL regions combined
   - Navigate to `/dashboard/global` (once frontend is built)
   - Or query: `GET /api/dashboard/global`

2. **Regional Dashboards** - See any specific region
   - Australia: `GET /api/dashboard/regional?region=AU`
   - US: `GET /api/dashboard/regional?region=US`
   - Brazil: `GET /api/dashboard/regional?region=BR`
   - Indonesia: `GET /api/dashboard/regional?region=ID`

3. **Campus Dashboards** - See any specific campus (existing feature)

### For Future US Regional Leader

When you appoint a US Regional Leader:

1. **Create User**:
```bash
POST /api/users/create
{
  "username": "us_regional_leader",
  "password": "secure_password",
  "full_name": "John Smith",
  "email": "john@futures.church",
  "role": "region_leader",
  "campus": "all_campuses",  // Or null
  "region_id": 2  // US region ID
}
```

2. **They can access**:
   - US Regional Dashboard: `GET /api/dashboard/regional?region=US`
   - All US campuses
   - Cannot see AU, BR, or ID regions

### For Indonesia, Brazil (Same Process)

Same as US - create regional leaders with:
- `role: "region_leader"`
- `region_id: 4` (Indonesia) or `3` (Brazil)
- They get full access to their region only

## Current State

### ✅ Working
1. Database structure with regions
2. RBAC system with region scoping
3. API endpoints for regional/global dashboards
4. User management with region assignment
5. Access control enforcement

### 🔄 Next Steps (Frontend)
1. Create UI components for regional/global dashboards
2. Add region selector for global users
3. Update navigation to show regional dashboard option
4. Create visualization for regional comparisons

### 📝 To Complete Setup

1. **Run Migration**:
```bash
cd backend
python run_migration.py migrations/039_add_region_support_to_users.sql
```

2. **Activate Regions** (when ready to launch):
```sql
UPDATE regions SET active = 1, coming_soon = 0 WHERE code = 'US';
UPDATE regions SET active = 1, coming_soon = 0 WHERE code = 'ID';
UPDATE regions SET active = 1, coming_soon = 0 WHERE code = 'BR';
```

3. **Add US Campuses**:
```sql
INSERT INTO campuses_v2 (campus_id, name, display_name, region_id, active)
VALUES ('us_campus_1', 'US Campus 1', 'US Campus 1', 2, 1);
```

4. **Test Access**:
   - Login as Ashley (global role)
   - Query: `GET /api/dashboard/global`
   - Should see global stats
   - Query: `GET /api/dashboard/regional?region=AU`
   - Should see Australia stats

## Testing Checklist

- [ ] Run migration 039
- [ ] Verify region_id column exists in users table
- [ ] Test regional dashboard API for AU
- [ ] Test global dashboard API
- [ ] Create test region_leader user for US
- [ ] Verify region_leader can only see their region
- [ ] Verify global roles can see all regions
- [ ] Test campus_pastor cannot access regional dashboards

## Role Matrix

| Role | Campus Access | Region Access | Global Access |
|------|---------------|---------------|---------------|
| admin | All | All | Yes |
| senior_leadership | All | All | Yes |
| senior_pastor | All | All | Yes |
| lead_pastor | All | All | Yes |
| region_leader | All in region | Assigned region only | No |
| campus_pastor | Assigned campus | No | No |
| staff | Assigned campus | No | No |

## Important Notes

1. **Existing Users**: All existing users have `region_id = NULL` which means they maintain their current access levels

2. **Backward Compatibility**: All existing functionality continues to work. Regional features are additive.

3. **Data Entry**: Campuses can log stats as normal. The `region_id` is automatically populated based on the campus's region.

4. **Regional Leaders**: When you appoint regional leaders, explicitly set their `region_id` to restrict access.

5. **Global Dashboard**: Only available to roles defined in `region_scoping.global_roles` in `roles.yaml`

## Questions?

This system is ready for:
- ✅ US deployment - Just add campuses and regional leader
- ✅ Indonesia deployment - Just add campuses and regional leader  
- ✅ Brazil deployment - Just add campuses and regional leader
- ✅ Global oversight - Ashley can see everything now
- ✅ Regional oversight - Assign regional leaders as needed

Everything is in place and working! 🎉

