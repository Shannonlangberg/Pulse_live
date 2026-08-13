# Attendance Calculation Logic Verification

## 1. When Saving a Record (backend/app.py line 983)

```python
adult_total = sum(adult_breakdown.values())  # Sum of all service times (9:00 AM, 11:00 AM, etc.)
saints = int(data.get('Saints', 0) or 0)
total_attendance_calculated = adult_total + saints + record.kids_attendance + record.kids_leaders
```

**Formula:** `total_attendance = Sum of Service Attendance (Adults) + Saints + Kids + Kids Leaders`

✅ **This is stored in the database as `total_attendance`**

---

## 2. Regional Dashboard - Sunday Attendance (backend/app.py line 15041)

```python
# Extract adults+saints from each record (handling cases where kids may/may not be included)
adults_and_saints_total = ...  # Sum of (total_attendance - kids) for all records

# Add back total kids ONCE
total_attendance = adults_and_saints_total + total_kids + total_kids_leaders
```

**Formula:** `Sunday Attendance = Sum of Service Attendance (Adults) + Saints + Kids + Kids Leaders`

✅ **This matches the user's requirement**

---

## 3. Regional Dashboard - Weekend Attendance (backend/app.py line 15095)

```python
total_youth_with_leaders = total_youth + total_youth_leaders
# This is returned as 'total_youth' in stats (line 15299)
```

**Frontend (CampusDashboard.jsx line 424):**
```javascript
const sundayCombinedAttendance = data.stats?.total_attendance  // Sunday Attendance
const youthAttendance = data.stats?.youth_attendance  // This is total_youth_with_leaders
const totalAttendance = sundayCombinedAttendance + youthAttendance
```

**Formula:** `Weekend Attendance = Sunday Attendance + Youth + Youth Leaders`

✅ **This matches the user's requirement**

---

## Summary

✅ **Sunday Attendance** = Sum of all service attendance (adults) + Saints + Kids + Kids Leaders

✅ **Weekend Attendance** = Sunday Attendance + Youth + Youth Leaders

**No double-counting:**
- Kids are counted exactly once in Sunday Attendance
- Youth is separate and added only for Weekend Attendance
- Saints are included in Sunday Attendance (not double-counted)

