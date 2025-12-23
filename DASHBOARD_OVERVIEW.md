# Dashboard System Overview

## Dashboard Types

Your Pulse system now has **THREE** types of dashboards, each serving different needs:

### 1. 🏢 Campus Dashboard
**Purpose:** View detailed analytics for a single campus  
**Access:** Campus pastors see their assigned campus, senior leadership can view any campus  
**What it shows:**
- Weekly attendance breakdown by service
- Kids, Youth, and Adult ministry stats
- Salvations, baptisms, and new people
- Giving and financial data
- Connect groups participation
- Detailed charts and trends

**How to access:** 
- Select a region → Select a specific campus

---

### 2. 🌏 Regional Dashboard (National Overview)
**Purpose:** Aggregate view of ALL campuses within a region  
**Access:** Senior leadership roles only (superadmin, admin, senior_leader, senior_pastor, lead_pastor)  
**What it shows:**
- Combined attendance from all campuses in the region
- Total salvations, baptisms, visitors across region
- Total giving across all campuses
- Per-campus breakdown showing each campus's performance
- Regional trends and insights

**Regions available:**
- 🇦🇺 Australia
- 🇺🇸 United States  
- 🇧🇷 Brazil
- 🇮🇩 Indonesia

**How it aggregates data:**
- Sums all attendance records from every campus in the region
- Calculates weekly averages based on unique dates
- Shows total metrics across the entire region
- Provides breakdown by individual campus

**How to access:**
- Select a region → Click the "National Overview" card at the top

---

### 3. 🌍 Global Dashboard (NEW!)
**Purpose:** Worldwide view combining ALL regions  
**Access:** Senior leadership roles only (superadmin, admin, senior_leader, senior_pastor, lead_pastor)  
**What it shows:**
- **Global totals:** Combined attendance, salvations, giving from every region
- **Regional breakdown:** Performance cards for each region showing:
  - Average weekly attendance per region
  - Total salvations per region
  - Total giving per region
  - Number of campuses per region
- **Worldwide insights:** Trends across your entire global ministry

**How it aggregates data:**
- Queries ALL attendance records from ALL regions
- Sums totals across Australia, US, Brazil, Indonesia
- Calculates global weekly averages
- Groups data by region for regional comparison
- Shows which regions are most active

**How to access:**
- From the main dashboard, look for the prominent **"Global Ministry Dashboard"** card at the top
- Click it to see worldwide analytics

---

## How Regional & Global Aggregation Works

### Backend API Endpoints

1. **`/api/dashboard/regional?region=US&date_filter=last_7_days`**
   - Filters `AttendanceRecord` by `region_id`
   - Sums all attendance fields (total_attendance, kids, youth, etc.)
   - Calculates weekly averages by counting unique dates
   - Returns per-campus breakdown

2. **`/api/dashboard/global?date_filter=last_7_days`**
   - Queries ALL `AttendanceRecord` entries (no region filter)
   - Sums everything globally
   - Groups by region for breakdown
   - Returns global stats + per-region stats

### Data Accuracy

✅ **Regional dashboards ARE working correctly:**
- They aggregate all campuses in a region
- Math is accurate (sums then divides by week count)
- Campus breakdowns show proper contribution from each campus

✅ **Global dashboard now fully functional:**
- Combines data from all 4 regions
- Shows regional comparison cards
- Accessible from the main selector

---

## Example Use Cases

### Use Case 1: Senior Pastor wants to see US ministry health
1. Click on "United States" region
2. Click "United States National Overview" 
3. See combined stats from Alpharetta and any other US campuses
4. View campus breakdown to see individual campus performance

### Use Case 2: Lead Pastor wants worldwide overview
1. From main dashboard, click "Global Ministry Dashboard" (big card at top)
2. See total attendance across all regions worldwide
3. View regional breakdown cards (Australia, US, Brazil, Indonesia)
4. Compare regional performance at a glance

### Use Case 3: Campus Pastor wants their campus stats
1. Select their region (auto-selected if only assigned to one campus)
2. Their specific campus loads automatically
3. See detailed week-by-week analytics for their campus only

---

## Technical Details

### Date Filters (All Dashboard Types)
- Last 7 days
- Last 30 days  
- Last 90 days
- This year
- Last 12 months (default)
- Custom date range

### Metrics Calculated
- **Attendance:** Total and averages per service
- **Kids/Youth:** Separate tracking with leaders
- **Salvations:** First-time Christians + rededications
- **Baptisms:** Total baptized in period
- **Visitors:** First-time and returning
- **Giving:** Total and weekly averages
- **Connect Groups:** Group participation

### Performance Notes
- All dashboards use indexed database queries
- Caching prevents redundant API calls
- Dashboard refreshes on filter change with 500ms debounce
- Regional/global queries are optimized with SQLite/PostgreSQL

---

## Summary

✅ **Regional Dashboards:** Properly aggregate all campuses within a region  
✅ **Global Dashboard:** Now available - shows worldwide ministry analytics  
✅ **Data Integrity:** All calculations are accurate and working correctly  
✅ **Access Control:** Proper permissions enforced (senior leadership only for rollups)  

The system now provides a complete hierarchy:
**Campus → Region → Global**

Each level serves a specific purpose and provides the right insights for different leadership roles.

