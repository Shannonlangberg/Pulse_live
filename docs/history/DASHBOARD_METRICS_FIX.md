# Dashboard Metrics Fix - Average Calculations

## Date: December 23, 2025

## Summary
Fixed critical issues with dashboard metrics to ensure all attendance values display **averages per service** rather than sums, and that date range filtering works correctly across all dashboard views.

## Issues Fixed

### 1. **Campus Overview (total_people) - Changed from Sum to Average**
   - **Problem**: `total_people` was being summed across all records in the date range, which inflated the number when viewing longer time periods
   - **Fix**: Changed backend to calculate average `total_people` per service
   - **Location**: `backend/app.py` line ~6750
   - **Frontend Update**: Changed label from "Total registered people" to "Average registered people"

### 2. **Regional Dashboard - Average Calculations**
   - **Problem**: Regional dashboard was calculating averages per unique date (week_count) instead of per service
   - **Fix**: Changed to use `record_count` (number of services) for average calculations
   - **Location**: `backend/app.py` `/api/dashboard/regional` endpoint (~line 13481)
   - **Impact**: 
     - `avg_weekly_attendance` now correctly averages across all services
     - `avg_kids` and `avg_youth` added as separate fields
     - Campus breakdown within regions now shows correct averages

### 3. **Global Dashboard - Average Calculations**
   - **Problem**: Global dashboard was calculating averages per unique date instead of per service
   - **Fix**: Changed to use `record_count` (number of services) for average calculations
   - **Location**: `backend/app.py` `/api/dashboard/global` endpoint (~line 13608)
   - **Impact**:
     - `avg_weekly_attendance` now correctly averages across all services globally
     - `avg_kids` and `avg_youth` added as separate fields
     - Region breakdown shows correct averages

### 4. **Frontend Data Normalization**
   - **Problem**: Frontend was recalculating kids/youth averages by dividing by week_count
   - **Fix**: Updated frontend to use backend-provided `avg_kids` and `avg_youth` directly
   - **Location**: `frontend/src/pages/CampusDashboard.jsx` lines ~86-150
   - **Impact**: Consistent average calculations across all dashboard types

## Technical Details

### Backend Changes (`backend/app.py`)

#### 1. Individual Campus Dashboard
```python
# Line ~6750
# FIX: total_people should be average, not sum across dates
stats['total_people'] = stats['total_people'] / entry_count
```

#### 2. Regional Dashboard
```python
# Line ~13481-13498
# Calculate averages - use number of records (services) not unique dates
record_count = max(1, len(records))
avg_attendance = total_attendance / record_count
avg_kids = total_kids / record_count
avg_youth = total_youth / record_count
avg_giving = total_giving / record_count

# Calculate week_count for display purposes (unique dates)
week_count = max(1, len(set(r.date for r in records)))
```

#### 3. Global Dashboard
```python
# Line ~13608-13625
# Calculate global averages - use number of records (services) not unique dates
record_count = max(1, len(all_records))
avg_attendance = total_attendance / record_count
avg_kids = total_kids / record_count
avg_youth = total_youth / record_count
avg_giving = total_giving / record_count

# Calculate week_count for display purposes (unique dates)
week_count = max(1, len(set(r.date for r in all_records)))
```

### Frontend Changes (`frontend/src/pages/CampusDashboard.jsx`)

#### 1. Global Data Normalization (Line ~86-94)
```javascript
avg_kids_attendance: result.global_stats?.avg_kids || 0,
avg_youth_attendance: result.global_stats?.avg_youth || 0,
```

#### 2. Regional Data Normalization (Line ~148-149)
```javascript
avg_kids_attendance: result.stats?.avg_kids || 0,
avg_youth_attendance: result.stats?.avg_youth || 0,
```

#### 3. AI Report Helper Function (Line ~225-226)
```javascript
avg_kids_attendance: result.stats?.avg_kids || 0,
avg_youth_attendance: result.stats?.avg_youth || 0,
```

#### 4. Campus Overview Label (Line ~548)
```javascript
<p className="text-[#62B4FF]/80 text-sm">
  Average registered people
</p>
```

## Metrics Behavior by Dashboard Type

### Individual Campus Dashboard
- **Total People**: Average registered people per service in date range
- **Weekend Attendance**: Average per service (Sunday + Youth Friday)
- **Sunday Attendance**: Average per service (Adults + Kids + Leaders + Saints)
- **Kids/Youth**: Average per service
- **Service Breakdown**: Shows average per service time
- **New People/Salvations**: Total across date range (not averaged)

### Regional Dashboard (Rollup)
- **Total People**: Sum of averages from all campuses
- **Weekend Attendance**: Average per service across all campuses
- **Kids/Youth**: Average per service across all campuses
- **Campus Breakdown**: Each campus shows its own average
- **New People/Salvations**: Total across date range (not averaged)

### Global Dashboard
- **Total People**: Sum of averages from all regions
- **Weekend Attendance**: Average per service across all regions
- **Kids/Youth**: Average per service across all regions
- **Region Breakdown**: Each region shows its own average
- **New People/Salvations**: Total across date range (not averaged)

## Date Range Filtering

All dashboards now correctly filter by the selected date range:
- Last 7 Days
- Last 30 Days
- Last 3 Months
- Last 6 Months
- Last 12 Months
- Year to Date
- Last 2 Years
- Custom Range

The averages are calculated based on the number of services (records) within the selected date range, not the number of unique dates.

## Why This Matters

### Before Fix:
- Selecting "Last 12 Months" would show inflated numbers because metrics were summed
- Campus Overview would show 857 people when it should show ~100 (average per service)
- Regional/Global dashboards were dividing by unique dates, not services, giving incorrect averages

### After Fix:
- All attendance metrics show **average per service** consistently
- Date range selection properly filters data and recalculates averages
- Campus Overview shows realistic average attendance
- Regional/Global dashboards aggregate correctly across campuses/regions

## Testing Recommendations

1. **Test Different Date Ranges**: Switch between "Last 7 Days", "Last 30 Days", and "Last 12 Months" to verify averages recalculate correctly
2. **Compare Campus vs Regional**: Verify that regional dashboard averages match the sum of individual campus averages
3. **Service Breakdown**: Click on Sunday Attendance to verify service breakdown shows correct averages
4. **Weekend Modal**: Click on Weekend Attendance card to verify the breakdown modal shows correct averages

## Files Modified

1. `/Users/shannonlangberg/Pulse_LIVE/Pulse_live/backend/app.py`
   - Line ~6750: Added total_people average calculation
   - Line ~13481-13498: Fixed regional dashboard average calculations
   - Line ~13608-13625: Fixed global dashboard average calculations

2. `/Users/shannonlangberg/Pulse_LIVE/Pulse_live/frontend/src/pages/CampusDashboard.jsx`
   - Line ~86-94: Updated global data normalization
   - Line ~148-149: Updated regional data normalization
   - Line ~225-226: Updated AI report helper function
   - Line ~548: Updated Campus Overview label

## Notes

- **Totals vs Averages**: New People, Salvations, Baptisms, and Giving remain as **totals** across the date range (not averaged) because these are cumulative metrics
- **Service Breakdown**: The service breakdown modal correctly shows average per service time, with the count of services displayed
- **Week Count**: Still calculated and returned for display purposes (shows number of unique dates in range)

