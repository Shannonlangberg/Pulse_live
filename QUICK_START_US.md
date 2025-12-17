# Quick Start: Add Your First US Campus

## Super Simple 3-Step Process

### Step 1: Add a US Campus (1 minute)

Run this in your database:

```sql
INSERT INTO campuses_v2 (campus_id, name, display_name, region_id, active, pastor_name, pastor_email, city, state, country)
VALUES (
  'los_angeles',           -- campus_id (unique identifier)
  'Los Angeles',           -- name
  'Los Angeles',           -- display_name
  2,                       -- region_id (2 = US)
  1,                       -- active (1 = yes)
  'Pastor Name',           -- pastor_name
  'pastor@futures.church', -- pastor_email
  'Los Angeles',           -- city
  'California',            -- state
  'United States'          -- country
);
```

Or use the terminal:

```bash
cd /Users/shannonlangberg/Pulse_LIVE/Pulse_live/backend

sqlite3 instance/futures_link.db "INSERT INTO campuses_v2 (campus_id, name, display_name, region_id, active) VALUES ('los_angeles', 'Los Angeles', 'Los Angeles', 2, 1);"
```

### Step 2: Log Stats for US Campus (use existing page)

1. Go to your stats input page
2. Select "Los Angeles" campus
3. Enter attendance, salvations, etc.
4. Save

The stats automatically get `region_id = 2` (US)!

### Step 3: View US Regional Dashboard

As Ps Ashley (or any senior leader):

```
GET http://localhost:5000/api/dashboard/regional?region=US&date_filter=last_12_months
```

Done! 🎉

## Add More US Campuses

Just repeat Step 1 with different campus_id:

```sql
-- New York
INSERT INTO campuses_v2 (campus_id, name, display_name, region_id, active)
VALUES ('new_york', 'New York', 'New York', 2, 1);

-- Chicago
INSERT INTO campuses_v2 (campus_id, name, display_name, region_id, active)
VALUES ('chicago', 'Chicago', 'Chicago', 2, 1);
```

## Optional: Create US Regional Leader

If you want a leader who can ONLY see US data:

```bash
# Via API (as admin)
POST /api/users/create
{
  "username": "us_regional_leader",
  "password": "secure_password",
  "full_name": "US Regional Leader",
  "email": "usleader@futures.church",
  "role": "region_leader",
  "campus": "all_campuses",
  "region_id": 2
}
```

This person will:
- ✅ See all US campuses
- ✅ Access US regional dashboard
- ❌ Cannot see Australia, Brazil, or Indonesia

## Same Process for Indonesia & Brazil

**Indonesia**:
```sql
-- Activate region
UPDATE regions SET active = 1, coming_soon = 0 WHERE code = 'ID';

-- Add campus
INSERT INTO campuses_v2 (campus_id, name, display_name, region_id, active)
VALUES ('jakarta', 'Jakarta', 'Jakarta', 4, 1);
```

**Brazil**:
```sql
-- Activate region
UPDATE regions SET active = 1, coming_soon = 0 WHERE code = 'BR';

-- Add campus
INSERT INTO campuses_v2 (campus_id, name, display_name, region_id, active)
VALUES ('sao_paulo', 'São Paulo', 'São Paulo', 3, 1);
```

## That's It!

No code changes needed. Just:
1. Add campuses to database
2. Log stats using existing pages
3. View regional/global dashboards

Everything else is automatic! 🚀

