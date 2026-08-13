import React, { useState, useEffect, useMemo } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { DocumentChartBarIcon } from '@heroicons/react/24/outline';
import CampusAttendanceReportModal from '../components/reports/CampusAttendanceReportModal';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/** Shown in UI; legacy API values (rollup_only, sundays_only) map away on next effect */
const DASHBOARD_METRICS_SCOPES = ['default', 'sundays_rollup_only', 'special_events_only'];

const CampusDashboard = ({ campusId, campusName, isRollup = false, isGlobal = false, onBackToSelector }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [campusData, setCampusData] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [modalData, setModalData] = useState(null);
  const [dateFilter, setDateFilter] = useState('last_weekend');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showPreviousYear, setShowPreviousYear] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [metricsScope, setMetricsScope] = useState('default');

  useEffect(() => {
    if (!DASHBOARD_METRICS_SCOPES.includes(metricsScope)) {
      setMetricsScope('default');
    }
  }, [metricsScope]);

  const reportScope = useMemo(() => {
    if (isGlobal) {
      return {
        regionCode: '',
        campusesCsv: '',
        regionTitle: 'All regions',
        scopeLabel: campusName || 'Global',
      };
    }
    if (isRollup && campusId) {
      const code = String(campusId).trim().toUpperCase();
      return {
        regionCode: code,
        campusesCsv: '',
        regionTitle: campusName || code,
        scopeLabel: campusName || code,
      };
    }
    return {
      regionCode: '',
      campusesCsv: campusId ? String(campusId) : '',
      regionTitle: 'All regions',
      scopeLabel: campusName || 'Campus',
    };
  }, [isGlobal, isRollup, campusId, campusName]);

  // Debounced effect to prevent rapid API calls when filters change
  useEffect(() => {
    // Clear data immediately when filter changes to prevent showing stale data
    setData(null);
    setCampusData(null);
    setLoading(true);
    
    const timeoutId = setTimeout(() => {
      fetchCampusData();
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [campusId, dateFilter, customStartDate, customEndDate, showPreviousYear, metricsScope]);

  const fetchCampusData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }

      const cacheBuster = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // If this is a global dashboard, use the global API endpoint
      if (isGlobal) {
        console.log(`[CampusDashboard] Fetching GLOBAL dashboard`);
        const response = await fetch(`/api/dashboard/global?date_filter=${dateFilter}&custom_start_date=${customStartDate}&custom_end_date=${customEndDate}&metrics_scope=${encodeURIComponent(metricsScope)}&_t=${cacheBuster}`, {
          credentials: 'include',
          cache: 'no-store',
          headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
        });
        
        if (!response.ok) {
          throw new Error(`Global dashboard API error: ${response.status}`);
        }
        
        const result = await response.json();
        console.log(`[CampusDashboard] Global dashboard data:`, result);
        
        // Normalize global data structure to match campus dashboard format
        const weekCount = result.global_stats?.week_count || 1;
        const normalizedData = {
          stats: {
            total_attendance: result.global_stats?.total_attendance || 0,
            avg_attendance: result.global_stats?.avg_weekly_attendance || 0,
            total_people: result.global_stats?.total_attendance || 0,
            kids_attendance: result.global_stats?.total_kids || 0,
            youth_attendance: result.global_stats?.total_youth || 0,
            entry_count: weekCount,
            avg_kids_attendance: result.global_stats?.avg_kids || 0,
            avg_youth_attendance: result.global_stats?.avg_youth || 0,
            avg_kids_leaders: 0,
            avg_connect_groups: 0,
            avg_dream_team: 0,
            first_time_christians: result.global_stats?.total_salvations || 0,
            youth_salvations: 0,
            new_kids_salvations: 0,
            rededications: 0,
            baptisms: result.global_stats?.total_baptisms || 0,
            child_dedications: 0,
            new_people: result.global_stats?.total_visitors || 0,
            first_time_visitors: result.global_stats?.total_visitors || 0,
            visitors: 0,
            information_gathered: 0,
            packs_out: 0,
            new_kids: 0,
            hands_up: 0,
            salvation_cards_returned: 0,
            avg_saints: 0,
            tithe: result.global_stats?.total_giving || 0,
            avg_tithe: result.global_stats?.avg_weekly_giving || 0
          },
          service_breakdown: {},
          regions: result.regions || [],
          global_stats: result.global_stats,
          date_range: result.date_range || {},
          week_count: weekCount,
          isGlobal: true,
          metrics_scope: result.metrics_scope || 'default',
        };
        
        setData(normalizedData);
        setCampusData(normalizedData);
        setLastRefresh(new Date());
      } else if (isRollup) {
        console.log(`[CampusDashboard] Fetching regional dashboard for region: ${campusId}`);
        const response = await fetch(`/api/dashboard/regional?region=${campusId}&date_filter=${dateFilter}&custom_start_date=${customStartDate}&custom_end_date=${customEndDate}&show_previous_year=${showPreviousYear}&metrics_scope=${encodeURIComponent(metricsScope)}&_t=${cacheBuster}`, {
          credentials: 'include',
          cache: 'no-store',
          headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
        });
        
        if (!response.ok) {
          throw new Error(`Regional dashboard API error: ${response.status}`);
        }
        
        const result = await response.json();
        console.log(`[CampusDashboard] Regional dashboard data:`, result);
        
        // Normalize regional data structure to match campus dashboard format
        const weekCount = result.stats?.week_count || 1; // Avoid division by zero
        const normalizedData = {
          stats: {
            // Map regional fields to campus dashboard fields
            total_attendance: result.stats?.total_attendance || 0,
            avg_attendance: result.stats?.avg_weekly_attendance || 0,
            total_people: result.stats?.total_attendance || 0,
            // Map both total and average for kids - needed for rollup views
            kids_attendance: result.stats?.total_kids || 0,
            avg_kids_attendance: result.stats?.avg_kids || 0,
            kids_leaders: result.stats?.total_kids_leaders || 0,
            avg_kids_leaders: result.stats?.avg_kids_leaders || 0,
            youth_attendance: result.stats?.total_youth || 0,  // Total youth for rollups
            avg_youth_attendance: result.stats?.avg_youth || 0,  // Average for single campuses
            avg_connect_groups: result.stats?.avg_connect_groups || 0,
            connect_groups: result.stats?.total_connect_groups || 0,  // Total connect groups for regional
            avg_dream_team: result.stats?.avg_dream_team || 0,
            dream_team: result.stats?.total_dream_team || 0,  // Total dream team for regional
            first_time_christians: result.stats?.first_time_christians || 0,  // Adult salvations
            youth_salvations: result.stats?.youth_salvations || 0,  // Youth salvations
            new_kids_salvations: result.stats?.new_kids_salvations || 0,  // Kids salvations
            rededications: result.stats?.rededications || 0,  // Rededications
            baptisms: result.stats?.total_baptisms || 0,
            child_dedications: result.stats?.total_child_dedications || 0,
            new_people: result.stats?.new_people || 0,  // First time + visitors + youth (not just total_visitors)
            first_time_visitors: result.stats?.total_visitors || 0,  // total_visitors = first time visitors in backend
            visitors: 0,
            information_gathered: 0,
            packs_out: 0,
            new_kids: 0,
            hands_up: 0,
            salvation_cards_returned: 0,
            avg_saints: result.stats?.avg_saints ?? 0,
            tithe: result.stats?.total_giving || 0,
            avg_tithe: result.stats?.avg_weekly_giving || 0,
            entry_count: result.recent_records ?? weekCount,
            saints: result.stats?.total_saints ?? 0,
          },
          service_breakdown: {},
          region: result.region,
          campuses: result.campuses || [],
          date_range: result.date_range || {},
          week_count: weekCount,
          chart_data: result.chart_data || null,  // Include chart_data from regional endpoint
          metrics_scope: result.metrics_scope || 'default',
        };
        
        setData(normalizedData);
        setCampusData(normalizedData);
        setLastRefresh(new Date());
      } else {
        // Regular campus dashboard
        console.log(`[CampusDashboard] Fetching campus dashboard for campus: ${campusId}`);
        const response = await fetch(`/api/dashboard_data_public?campus=${campusId}&date_filter=${dateFilter}&custom_start_date=${customStartDate}&custom_end_date=${customEndDate}&show_previous_year=${showPreviousYear}&metrics_scope=${encodeURIComponent(metricsScope)}&_t=${cacheBuster}`, {
          credentials: 'include',
          cache: 'no-store',
          headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
        });
        
        if (!response.ok) {
          throw new Error(`Campus dashboard API error: ${response.status}`);
        }
        
        const result = await response.json();
        setData(result);
        setCampusData(result);
        setLastRefresh(new Date());
      }
    } catch (error) {
      console.error('Error fetching campus data:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    // Force clear any cached data
    setData({});
    setCampusData({});
    
    // Add a small delay to ensure state is cleared
    setTimeout(() => {
      fetchCampusData(true);
    }, 100);
  };

  const openModal = (type, data) => {
    setModalType(type);
    setModalData(data);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType('');
    setModalData(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-fc-cream flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-fc-olive rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">
            <span className="text-4xl">⛪</span>
          </div>
          <div className="text-fc-midnight text-2xl font-bold mb-2">Loading Campus Dashboard</div>
          <div className="text-fc-brown text-lg">Fetching {campusName} data...</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-fc-cream flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-fc-copper rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">⚠️</span>
          </div>
          <div className="text-fc-midnight text-2xl font-bold mb-2">No Data Available</div>
          <div className="text-fc-brown text-lg">Unable to load {campusName} data</div>
        </div>
      </div>
    );
  }

  // Single campus: over multi-entry date ranges, show average attendance per service/row (API avg_*).
  // Last weekend stays summed totals. Souls, new people, baptisms, dedications stay period sums.
  const isSingleCampusDashboard = !isRollup && !isGlobal;
  const periodEntryCount = data.stats?.entry_count ?? data.week_count ?? null;
  const useAttendancePeriodAverages =
    isSingleCampusDashboard &&
    dateFilter !== 'last_weekend' &&
    (periodEntryCount ?? 0) > 1;
  const attendancePeriodCaption = useAttendancePeriodAverages
    ? 'Average per service'
    : 'Total for selected period';

  // Helper function to parse service time and convert to minutes for sorting
  const parseServiceTime = (timeStr) => {
    // Handle formats like "9:00 AM", "10:00 AM", "5:30 PM", etc.
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return 0; // If can't parse, put at start
    
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].toUpperCase();
    
    // Convert to 24-hour format
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    return hours * 60 + minutes; // Return total minutes for easy sorting
  };

  // Get service breakdown from the data FIRST (needed for Sunday attendance calculation)
  const serviceBreakdown = data.service_breakdown || {};
  const services = Object.keys(serviceBreakdown)
    .filter((service) => service !== 'kids')
    .map((service) => ({
      name: service,
      attendance: isSingleCampusDashboard
        ? (useAttendancePeriodAverages
          ? (serviceBreakdown[service]?.average ?? 0)
          : (serviceBreakdown[service]?.total ?? 0))
        : (serviceBreakdown[service]?.average || 0),
      count: serviceBreakdown[service]?.count || 0,
      total: serviceBreakdown[service]?.total || 0,
    }))
    .sort((a, b) => parseServiceTime(a.name) - parseServiceTime(b.name));

  const sundayAttendanceFromServices = services.reduce((sum, service) => {
    const part = isSingleCampusDashboard
      ? (useAttendancePeriodAverages ? (service.attendance || 0) : (service.total || 0))
      : (service.attendance || 0);
    return sum + part;
  }, 0);
  
  // Calculate percentages and metrics
  // For Campus Overview card: use total_people_in_campus (manually entered) for rollups
  const totalPeople = isRollup 
    ? (data.stats?.total_people_in_campus || data.stats?.total_people || 0)
    : (data.stats?.total_people || 0);
  
  const sundayCombinedAttendance = Math.round(
    useAttendancePeriodAverages
      ? (data.stats?.avg_attendance ?? 0)
      : (data.stats?.total_attendance || 0)
  );

  const sundayAdultAttendance = Math.round(
    useAttendancePeriodAverages
      ? Math.max(
          0,
          (data.stats?.avg_attendance ?? 0) -
            (data.stats?.avg_kids_attendance ?? 0) -
            (data.stats?.avg_kids_leaders ?? 0) -
            (data.stats?.avg_saints ?? 0)
        )
      : sundayAttendanceFromServices > 0
        ? sundayAttendanceFromServices
        : Math.max(
            0,
            (data.stats?.total_attendance || 0) -
              (data.stats?.kids_attendance || 0) -
              (data.stats?.kids_leaders || 0) -
              (data.stats?.saints || 0)
          )
  );
  const youthAttendance = Math.round(
    useAttendancePeriodAverages
      ? (data.stats?.avg_youth_attendance ?? 0)
      : (data.stats?.youth_attendance || 0)
  );
  const kidsAttendance = Math.round(
    useAttendancePeriodAverages
      ? (data.stats?.avg_kids_attendance ?? 0)
      : (data.stats?.kids_attendance || 0)
  );
  const kidsLeaders = Math.round(
    useAttendancePeriodAverages
      ? (data.stats?.avg_kids_leaders ?? 0)
      : (data.stats?.kids_leaders || 0)
  );
  const kidsTotalForSunday = kidsAttendance + kidsLeaders;
  const saintsAttendance = Math.round(
    useAttendancePeriodAverages
      ? (data.stats?.avg_saints ?? 0)
      : (data.stats?.saints || data.stats?.avg_saints || 0)
  );
  const seniorsAttendance = Math.round(
    useAttendancePeriodAverages
      ? (data.stats?.avg_seniors ?? data.stats?.seniors ?? 0)
      : (data.stats?.seniors || data.stats?.avg_seniors || 0)
  );
  
  // WEEKEND TOTAL = Sunday (pre-calculated) + Youth (Friday)
  const totalAttendance = sundayCombinedAttendance + youthAttendance;
  
  const attendancePercentage = totalPeople > 0 ? Math.round((totalAttendance / totalPeople) * 100) : 0;
  const connectGroupsTotal = useAttendancePeriodAverages
    ? (data.stats?.avg_connect_groups || 0)
    : (data.stats?.connect_groups ?? (data.stats?.avg_connect_groups || 0) * (periodEntryCount || 1));
  const connectGroupPercentage = sundayAdultAttendance > 0 ? Math.round((connectGroupsTotal || 0) / sundayAdultAttendance * 100) : 0;

  return (
    <div key={`campus-dashboard-${campusId}-${lastRefresh.getTime()}`} className="min-h-screen bg-fc-cream">
      {/* Header */}
      <div className="relative bg-white border-b border-fc-cream2">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex-1 w-full">
              {onBackToSelector && (
                <button
                  onClick={onBackToSelector}
                  className="fc-btn-secondary mb-4"
                >
                  <span className="text-lg">←</span>
                  <span>Back to Campuses</span>
                </button>
              )}
              <div>
                <div className="fc-label mb-2">{isRollup ? 'National Ministry Overview' : 'Campus Ministry Dashboard'}</div>
                <h1 className="fc-display fc-display-md break-words">
                  {campusName}
                </h1>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-4">
              {/* Date Range Selector */}
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="fc-input"
                >
                  <option value="last_weekend">Last Weekend</option>
                  <option value="last_7_days">Last 7 Days</option>
                  <option value="last_30_days">Last 30 Days</option>
                  <option value="last_3_months">Last 3 Months</option>
                  <option value="last_6_months">Last 6 Months</option>
                  <option value="last_12_months">Last 12 Months</option>
                  <option value="year_to_date">YTD</option>
                  <option value="last_2_years">Last 2 Years</option>
                  <option value="custom">Custom Range</option>
                </select>

                {dateFilter === 'custom' && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="fc-input"
                      placeholder="Start Date"
                    />
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="fc-input"
                      placeholder="End Date"
                    />
                  </div>
                )}

                <select
                  value={metricsScope}
                  onChange={(e) => setMetricsScope(e.target.value)}
                  title="All services: everything you saved. Sundays (standard): calendar Sundays that are not flagged as special events. Special events only: rows you marked as special when logging."
                  className="fc-input max-w-[min(100%,320px)]"
                >
                  <option value="default">All services (Sundays + special events)</option>
                  <option value="sundays_rollup_only">Sundays only (standard services)</option>
                  <option value="special_events_only">Special events only</option>
                </select>

              </div>

              <button
                type="button"
                onClick={() => setShowReportModal(true)}
                className="fc-btn-primary whitespace-nowrap"
              >
                <DocumentChartBarIcon className="h-5 w-5 shrink-0" aria-hidden />
                <span>Report</span>
              </button>

              <div className="text-right">
                <div className="text-fc-brown text-sm">Last Updated</div>
                <div className="text-fc-midnight font-medium font-mono">
                  {lastRefresh.toLocaleTimeString()}
                </div>
                {!isRollup && !isGlobal && data?.data_source && (
                  <div className="text-fc-brown/70 text-xs mt-1" title={data.data_source}>
                    {data.data_source.startsWith('Database') ? '✓ Database' : data.data_source}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-8">
        {/* Campus Cards Grid */}
        <div className="mb-12">
          <div className="mb-6">
            <div className="fc-label mb-2">{isRollup ? 'All campuses combined' : `${campusName} ministry metrics`}</div>
            <h2 className="fc-display fc-display-md">
              {isRollup ? 'Ministry Overview' : 'Campus Overview'}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Campus/Ministry Overview */}
            <div
              className="bg-white rounded-xl shadow-card hover:shadow-card-hover border-l-[3px] border-fc-teal p-5 transition-shadow cursor-pointer"
              onClick={() => openModal('campus-overview', {
                total: isRollup ? (data.stats?.dream_team || 0) : totalPeople,
                dreamTeam: isRollup ? (data.stats?.dream_team || 0) : Math.round(data.stats?.avg_dream_team || 0),
                baptisms: data.stats?.baptisms || 0,
                childDedications: data.stats?.child_dedications || 0,
                campus: campusName,
                isRollup: isRollup
              })}
            >
              <div className="fc-label mb-2">
                {isRollup ? 'Ministry Overview' : 'Campus Overview'}
              </div>
              {isRollup ? (
                <>
                  <div className="font-mono text-[28px] text-fc-midnight leading-none">
                    {(data.stats?.dream_team || 0).toLocaleString()}
                  </div>
                  <p className="text-fc-brown text-xs mt-2">
                    People served (Dream Team)
                  </p>
                </>
              ) : (
                <>
                  <div className="font-mono text-[28px] text-fc-midnight leading-none">
                    {Math.round(totalPeople).toLocaleString()}
                  </div>
                  <p className="text-fc-brown text-xs mt-2">
                    Average registered people
                  </p>
                </>
              )}
            </div>

            {/* Total Weekend Attendance */}
            <div
              className="bg-white rounded-xl shadow-card hover:shadow-card-hover border-l-[3px] border-fc-gold p-5 transition-shadow cursor-pointer"
              onClick={() => openModal('weekend-attendance', {
                total: totalAttendance,
                sunday: sundayCombinedAttendance,  // Pass complete Sunday total, not just adults
                sundayAdults: sundayAdultAttendance,
                kids: kidsTotalForSunday,
                saints: saintsAttendance,
                seniors: seniorsAttendance,
                youth: youthAttendance,
                percentage: attendancePercentage,
                campus: campusName
              })}
            >
              <div className="fc-label mb-2">
                {useAttendancePeriodAverages ? 'Average Weekend Attendance' : 'Total Weekend Attendance'}
              </div>
              <div className="font-mono text-[28px] text-fc-midnight leading-none">
                {totalAttendance.toLocaleString()}
              </div>
              <p className="text-fc-brown text-xs mt-2">
                Sunday + Youth (Friday)
              </p>
              <p className="text-fc-brown/70 text-xs mt-1">{attendancePeriodCaption}</p>
            </div>

            {/* Sunday Attendance */}
            <div
              className="bg-white rounded-xl shadow-card hover:shadow-card-hover border-l-[3px] border-fc-violet p-5 transition-shadow cursor-pointer"
              onClick={() => {
                openModal('sunday-attendance', { 
                  total: sundayCombinedAttendance, 
                  adults: sundayAdultAttendance,
                  kids: kidsTotalForSunday, // Kids + leaders for clarity in modal
                  saints: saintsAttendance,
                  seniors: seniorsAttendance,
                  services: services,
                  campus: campusName
                });
              }}
            >
              <div className="fc-label mb-2">
                {useAttendancePeriodAverages ? 'Average Sunday Attendance' : 'Sunday Attendance'}
              </div>
              <div className="font-mono text-[28px] text-fc-midnight leading-none">
                {sundayCombinedAttendance.toLocaleString()}
              </div>
              <p className="text-fc-brown text-xs mt-2">
                Adults + Kids (incl. leaders) + Saints {seniorsAttendance > 0 && '+ Seniors'} (No Youth)
              </p>
              <p className="text-fc-brown/70 text-xs mt-1">
                {services.length > 1
                  ? `${services.length} services • ${attendancePeriodCaption.toLowerCase()}`
                  : attendancePeriodCaption}
              </p>
            </div>

            {/* Souls */}
            <div
              className="bg-white rounded-xl shadow-card hover:shadow-card-hover border-l-[3px] border-fc-copper p-5 transition-shadow cursor-pointer"
              onClick={() => openModal('souls', {
                total: (data.stats?.first_time_christians || 0) + (data.stats?.youth_salvations || 0) + (data.stats?.new_kids_salvations || 0) + (data.stats?.rededications || 0),
                youth: data.stats?.youth_salvations || 0,
                adults: data.stats?.first_time_christians || 0,
                rededications: data.stats?.rededications || 0,
                kids: data.stats?.new_kids_salvations || 0,
                salvationCardsReturned: data.stats?.salvation_cards_returned || 0,
                handsUp: data.stats?.hands_up || 0,
                campus: campusName
              })}
            >
              <div className="fc-label mb-2">Souls Saved</div>
              <div className="font-mono text-[28px] text-fc-midnight leading-none">
                {((data.stats?.first_time_christians || 0) + (data.stats?.youth_salvations || 0) + (data.stats?.new_kids_salvations || 0) + (data.stats?.rededications || 0)).toLocaleString()}
              </div>
              <p className="text-fc-brown text-xs mt-2">
                All spiritual decisions
              </p>
              <p className="text-fc-brown/70 text-xs mt-1">Total for selected period</p>
            </div>

            {/* Just Visiting */}
            <div
              className="bg-white rounded-xl shadow-card hover:shadow-card-hover border-l-[3px] border-fc-gold p-5 transition-shadow cursor-pointer"
              onClick={() => openModal('new-people', {
                total: data.stats?.new_people || 0,  // Now includes youth_new_people from backend
                firstTime: data.stats?.first_time_visitors || 0,
                visiting: data.stats?.visitors || 0,
                youthNP: data.stats?.youth_new_people || 0,  // Add youth NP for display
                infoGathered: data.stats?.information_gathered || 0,
                packsOut: data.stats?.packs_out || 0,
                campus: campusName
              })}
            >
              <div className="fc-label mb-2">New People</div>
              <div className="font-mono text-[28px] text-fc-midnight leading-none">
                {(data.stats?.new_people || 0).toLocaleString()}
              </div>
              <p className="text-fc-brown text-xs mt-2">
                First-time + visiting
              </p>
              <p className="text-fc-brown/70 text-xs mt-1">Total for selected period</p>
            </div>

            {/* Kids */}
            <div
              className="bg-white rounded-xl shadow-card hover:shadow-card-hover border-l-[3px] border-fc-copper p-5 transition-shadow cursor-pointer"
              onClick={() => openModal('kids', {
                attendance: kidsAttendance,
                leaders: kidsLeaders,
                newKids: data.stats?.new_kids || 0,
                salvations: data.stats?.new_kids_salvations || 0,
                campus: campusName,
                kidsServiceBreakdown: data.kids_service_breakdown || {}
              })}
            >
              <div className="fc-label mb-2">Kids Church</div>
              <div className="font-mono text-[28px] text-fc-midnight leading-none">
                {(kidsAttendance + kidsLeaders).toLocaleString()}
              </div>
              <p className="text-fc-brown text-xs mt-2">
                {kidsAttendance} kids + {kidsLeaders} leaders
              </p>
              <p className="text-fc-brown/70 text-xs mt-1">{attendancePeriodCaption}</p>
            </div>

            {/* Youth */}
            <div
              className="bg-white rounded-xl shadow-card hover:shadow-card-hover border-l-[3px] border-fc-violet p-5 transition-shadow cursor-pointer"
              onClick={() => openModal('youth', {
                attendance: youthAttendance,
                leaders: useAttendancePeriodAverages && periodEntryCount
                  ? Math.round((data.stats?.youth_leaders || 0) / periodEntryCount)
                  : (data.stats?.youth_leaders || 0),
                salvations: data.stats?.youth_salvations || 0,
                newPeople: data.stats?.youth_new_people || 0,
                saints: saintsAttendance,
                campus: campusName
              })}
            >
              <div className="fc-label mb-2">Youth Ministry</div>
              <div className="font-mono text-[28px] text-fc-midnight leading-none">
                {youthAttendance.toLocaleString()}
              </div>
              <p className="text-fc-brown text-xs mt-2">
                {data.stats?.youth_salvations || 0} salvations (total)
              </p>
              <p className="text-fc-brown/70 text-xs mt-1">{attendancePeriodCaption}</p>
            </div>

            {/* Giving */}
            <div
              className="bg-white rounded-xl shadow-card hover:shadow-card-hover border-l-[3px] border-fc-gold p-5 transition-shadow cursor-pointer"
              onClick={() => openModal('giving', {
                total: data.stats?.tithe || 0,
                average: data.stats?.avg_tithe || 0,
                breakdown: data.tithe_breakdown || {general: 0, trust: 0, online: 0, text: 0},
                campus: campusName
              })}
            >
              <div className="fc-label mb-2">Average Giving</div>
              <div className="font-mono text-[28px] text-fc-midnight leading-none">
                ${((data.tithe_breakdown?.general || 0) + (data.tithe_breakdown?.trust || 0) + (data.tithe_breakdown?.online || 0) + (data.tithe_breakdown?.text || 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </div>
              <p className="text-fc-brown text-xs mt-2">
                Financial stewardship
              </p>
            </div>

            {/* Connect Groups */}
            <div
              className="bg-white rounded-xl shadow-card hover:shadow-card-hover border-l-[3px] border-fc-teal p-5 transition-shadow cursor-pointer"
              onClick={() => openModal('connect-groups', {
                total: isRollup ? (data.stats?.connect_groups || 0) : Math.round(data.stats?.avg_connect_groups || 0),
                percentage: connectGroupPercentage,
                sundayAttendance: sundayAdultAttendance,
                campus: campusName,
                isRollup: isRollup
              })}
            >
              <div className="fc-label mb-2">Total Number of Connect Groups</div>
              <div className="font-mono text-[28px] text-fc-midnight leading-none">
                {isRollup
                  ? (data.stats?.connect_groups || 0).toLocaleString()
                  : Math.round(data.stats?.avg_connect_groups || 0).toLocaleString()}
              </div>
              <p className="text-fc-brown text-xs mt-2">
                {isRollup ? 'Active connect groups' : 'Average per service'}
              </p>
            </div>
          </div>
        </div>

        {/* Global Dashboard: Regions Breakdown */}
        {isGlobal && data?.regions && data.regions.length > 0 && (
          <div className="mb-12">
            <div className="mb-6">
              <div className="fc-label mb-2">Performance across all {data.regions.length} regions</div>
              <h2 className="fc-display fc-display-md">
                Regional Breakdown
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {data.regions.map((region) => (
                <div
                  key={region.region_code}
                  className="bg-white rounded-xl shadow-card border-l-[3px] border-fc-violet p-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">
                      {region.region_code === 'AU' ? '🇦🇺' :
                       region.region_code === 'US' ? '🇺🇸' :
                       region.region_code === 'BR' ? '🇧🇷' :
                       region.region_code === 'ID' ? '🇮🇩' : '🌏'}
                    </span>
                    <div className="fc-label">{region.campus_count} campuses</div>
                  </div>

                  <h3 className="text-fc-midnight text-lg font-semibold mb-4">{region.region_name}</h3>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center border-t border-fc-cream2 pt-2">
                      <span className="text-fc-brown text-sm">Avg Attendance</span>
                      <span className="text-fc-midnight font-mono font-semibold">{region.avg_weekly_attendance.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-fc-cream2 pt-2">
                      <span className="text-fc-brown text-sm">Total Salvations</span>
                      <span className="text-fc-olive font-mono font-semibold">{region.total_salvations.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-fc-cream2 pt-2">
                      <span className="text-fc-brown text-sm">Total Giving</span>
                      <span className="text-fc-gold font-mono font-semibold">${region.total_giving.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Insights and Charts */}
        <div className="mb-12">
          <div className="mb-6">
            <div className="fc-label mb-2">Detailed analytics and trends for {campusName}</div>
            <h2 className="fc-display fc-display-md">
              {isGlobal ? 'Global Insights' : 'Campus Insights'}
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Attendance Trends */}
            <div className="bg-white rounded-xl shadow-card p-6">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                  <h3 className="font-display text-[20px] font-normal text-fc-midnight">Attendance YTD</h3>
                  <p className="text-fc-brown text-sm">Year-to-date attendance trends</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPreviousYear}
                      onChange={(e) => setShowPreviousYear(e.target.checked)}
                      className="w-4 h-4 text-fc-olive bg-white border-fc-cream2 rounded focus:ring-fc-olive focus:ring-2"
                    />
                    <span className="text-fc-brown text-sm">Show previous year</span>
                  </label>
                </div>
              </div>
              <div className="h-64">
                <Line
                    data={{
                      labels: data.chart_data?.labels || [],
                      datasets: [
                        {
                          label: 'Attendance YTD',
                          data: data.chart_data?.attendance || [],
                          borderColor: '#639922',
                          backgroundColor: 'rgba(99, 153, 34, 0.08)',
                          borderWidth: 2.5,
                          tension: 0.4,
                          fill: true,
                          pointRadius: 4,
                          pointHoverRadius: 6,
                          pointBackgroundColor: '#639922',
                          pointBorderColor: '#ffffff',
                          pointBorderWidth: 2
                        },
                        ...(showPreviousYear ? [{
                          label: 'Previous Year',
                          data: data.chart_data?.attendance_previous_year || [],
                          borderColor: '#C5C6A4',
                          backgroundColor: 'rgba(197, 198, 164, 0.08)',
                          borderWidth: 2,
                          tension: 0.4,
                          fill: false,
                          borderDash: [5, 5],
                          pointRadius: 3,
                          pointHoverRadius: 5,
                          pointBackgroundColor: '#C5C6A4',
                          pointBorderColor: '#ffffff',
                          pointBorderWidth: 2
                        }] : [])
                      ]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          labels: {
                            color: '#50482E'
                          }
                        }
                      },
                      scales: {
                        x: {
                          ticks: {
                            color: '#50482E'
                          },
                          grid: {
                            color: '#F0EDE4'
                          }
                        },
                        y: {
                          ticks: {
                            color: '#50482E'
                          },
                          grid: {
                            color: '#F0EDE4'
                          }
                        }
                      }
                    }}
                  />
                </div>
            </div>

            {/* Tithe YTD Chart */}
            <div className="bg-white rounded-xl shadow-card p-6">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                  <h3 className="font-display text-[20px] font-normal text-fc-midnight">Tithe YTD</h3>
                  <p className="text-fc-brown text-sm">Year-to-date giving with comparison</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-fc-brown">
                    <input
                      type="checkbox"
                      checked={showPreviousYear}
                      onChange={(e) => setShowPreviousYear(e.target.checked)}
                      className="w-4 h-4 text-fc-olive bg-white border-fc-cream2 rounded focus:ring-fc-olive focus:ring-2"
                    />
                    Show Previous Year
                  </label>
                </div>
              </div>
              <div className="h-64">
                <Line
                    data={{
                      labels: data.chart_data?.tithe_labels || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                      datasets: [
                        {
                          label: '2025 YTD',
                          data: data.chart_data?.tithe_ytd || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                          borderColor: '#639922',
                          backgroundColor: 'rgba(99, 153, 34, 0.08)',
                          borderWidth: 2.5,
                          tension: 0.4,
                          fill: true,
                          pointRadius: 4,
                          pointHoverRadius: 6,
                          pointBackgroundColor: '#639922',
                          pointBorderColor: '#ffffff',
                          pointBorderWidth: 2
                        },
                        ...(showPreviousYear ? [{
                          label: '2024',
                          data: data.chart_data?.tithe_previous_year || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                          borderColor: '#C5C6A4',
                          backgroundColor: 'rgba(197, 198, 164, 0.08)',
                          borderWidth: 2,
                          tension: 0.4,
                          fill: false,
                          borderDash: [5, 5],
                          pointRadius: 3,
                          pointHoverRadius: 5,
                          pointBackgroundColor: '#C5C6A4',
                          pointBorderColor: '#ffffff',
                          pointBorderWidth: 2
                        }] : [])
                      ]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          labels: {
                            color: '#50482E'
                          }
                        }
                      },
                      scales: {
                        x: {
                          ticks: {
                            color: '#50482E'
                          },
                          grid: {
                            color: '#F0EDE4'
                          }
                        },
                        y: {
                          ticks: {
                            color: '#50482E',
                            callback: function(value) {
                              return '$' + value.toLocaleString();
                            }
                          },
                          grid: {
                            color: '#F0EDE4'
                          }
                        }
                      }
                    }}
                  />
                </div>
                <div className="mt-4 flex justify-between items-center text-sm">
                  <div className="text-fc-brown">
                    Current YTD: <span className="text-fc-olive font-mono font-semibold">
                      ${(data.stats?.tithe_ytd || 0).toLocaleString()}
                    </span>
                  </div>
                  {showPreviousYear && (
                    <div className="text-fc-brown">
                      Previous Year: <span className="text-fc-brown/70 font-mono font-semibold">
                        ${(data.stats?.tithe_previous_year || 0).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
                {showPreviousYear && (
                  <div className="mt-2 text-center">
                    <div className="text-fc-brown text-sm">
                      % Increase YTD: <span className={`font-mono font-semibold ${(() => {
                        const current = data.stats?.tithe_ytd || 0;
                        const previous = data.stats?.tithe_previous_year || 0;
                        if (previous === 0) return 'text-fc-brown/70';
                        const increase = ((current - previous) / previous) * 100;
                        return increase >= 0 ? 'text-fc-olive' : 'text-fc-copper';
                      })()}`}>
                        {(() => {
                          const current = data.stats?.tithe_ytd || 0;
                          const previous = data.stats?.tithe_previous_year || 0;
                          if (previous === 0) return '0%';
                          const increase = ((current - previous) / previous) * 100;
                          return `${increase >= 0 ? '+' : ''}${increase.toFixed(1)}%`;
                        })()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      {/* Modal for Drill-down Details */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-pop">
            <div className="flex justify-between items-start mb-8">
              <div>
                <div className="fc-label mb-2">{campusName} — Detailed Breakdown</div>
                <h2 className="fc-display fc-display-sm">
                  {modalType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} Details
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="w-10 h-10 bg-fc-cream2 hover:bg-fc-cream2/70 rounded-xl flex items-center justify-center text-fc-brown hover:text-fc-midnight transition-colors"
              >
                <span className="text-xl">×</span>
              </button>
            </div>

            <div className="space-y-6">
              {modalType === 'campus-overview' && (
                <div className="space-y-6">
                  <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                    <h3 className="text-xl font-bold text-fc-midnight mb-4">
                      {modalData.isRollup ? 'Ministry Overview' : 'Campus Overview'}
                    </h3>
                    {modalData.isRollup ? (
                      <>
                        <div className="text-4xl font-bold text-[#62B4FF] mb-2">
                          {modalData.dreamTeam.toLocaleString()}
                        </div>
                        <p className="text-fc-brown">Total people served (Dream Team) across all campuses</p>
                      </>
                    ) : (
                      <>
                        <div className="text-4xl font-bold text-[#62B4FF] mb-2">
                          {modalData.total.toLocaleString()}
                        </div>
                        <p className="text-fc-brown">Total on database in {modalData.campus}</p>
                      </>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                      <h3 className="text-xl font-bold text-fc-midnight mb-4">Dream Team</h3>
                      <div className="text-4xl font-bold text-[#FF8432] mb-2">
                        {modalData.dreamTeam.toLocaleString()}
                      </div>
                      <p className="text-fc-brown">
                        {modalData.isRollup ? 'Total people served this period' : 'Average volunteers serving this period'}
                      </p>
                    </div>
                    <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                      <h3 className="text-xl font-bold text-fc-midnight mb-4">Baptisms</h3>
                      <div className="text-4xl font-bold text-[#E43CB9] mb-2">
                        {modalData.baptisms.toLocaleString()}
                      </div>
                      <p className="text-fc-brown">People baptized this period</p>
                    </div>
                    <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                      <h3 className="text-xl font-bold text-fc-midnight mb-4">Child Dedications</h3>
                      <div className="text-4xl font-bold text-[#5D1FEC] mb-2">
                        {modalData.childDedications.toLocaleString()}
                      </div>
                      <p className="text-fc-brown">Children dedicated this period</p>
                    </div>
                  </div>
                </div>
              )}

              {modalType === 'sunday-attendance' && (
                <div className="space-y-6">
                  <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                    <h3 className="text-xl font-bold text-fc-midnight mb-4">Sunday Attendance</h3>
                    <div className="text-4xl font-bold text-fc-violet mb-2">
                      {modalData.total.toLocaleString()}
                    </div>
                    <p className="text-fc-brown">
                      {isRollup 
                        ? 'Total attendance across all campuses (adults + kids + kids leaders + saints, excluding youth)' 
                        : 'Total for the selected period: Adults + Kids (incl. leaders) + Saints + Seniors (no youth — youth is Friday)'}
                    </p>
                    <p className="text-fc-brown/70 text-sm mt-2">
                      Adults: {(modalData?.adults ?? sundayAdultAttendance).toLocaleString()} • Kids (incl. leaders): {(modalData?.kids ?? kidsTotalForSunday).toLocaleString()} • Saints: {(modalData?.saints ?? saintsAttendance).toLocaleString()}{(modalData?.seniors ?? seniorsAttendance) > 0 && ` • Seniors: ${(modalData?.seniors ?? seniorsAttendance).toLocaleString()}`}
                    </p>
                  </div>
                  
                  {isRollup && data?.campuses && data.campuses.length > 0 && (
                    <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                      <h3 className="text-xl font-bold text-fc-midnight mb-4">Campus Breakdown</h3>
                      <div className="space-y-3">
                        {data.campuses.map((campus, index) => (
                          <div key={index} className="p-4 bg-fc-cream rounded-xl border border-fc-cream2">
                            <div className="flex justify-between items-center mb-2">
                              <div className="text-lg font-semibold text-fc-midnight">{campus.campus_name}</div>
                              <div className="text-2xl font-bold text-fc-violet">
                                {Math.round(campus.total_attendance || 0).toLocaleString()}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-fc-cream2">
                              <div>
                                <div className="text-xs text-fc-brown/70 mb-1">Adults + Saints</div>
                                <div className="text-sm font-semibold text-fc-teal">
                                  {Math.round((campus.total_attendance || 0) - (campus.total_kids_with_leaders || 0)).toLocaleString()}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-fc-brown/70 mb-1">Kids (incl. leaders)</div>
                                <div className="text-sm font-semibold text-fc-copper">
                                  {Math.round(campus.total_kids_with_leaders || 0).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <div className="text-xs text-fc-midnight/40 mt-2">
                              {campus.record_count || 0} services
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {!isRollup && (() => {
                    // Only show service breakdown for individual campuses, not rollup views
                    // Get service breakdowns from data
                    const adultBreakdown = data.service_breakdown || {};
                    const kidsBreakdown = data.kids_service_breakdown || {};
                    
                    // Get all service times from both breakdowns
                    const allServiceTimes = new Set([
                      ...Object.keys(adultBreakdown),
                      ...Object.keys(kidsBreakdown)
                    ]);
                    
                    if (allServiceTimes.size > 0) {
                      return (
                        <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                          <h3 className="text-xl font-bold text-fc-midnight mb-4">Service Breakdown (Adults + Kids incl. leaders)</h3>
                          <div className="space-y-4">
                            {Array.from(allServiceTimes).sort((a, b) => parseServiceTime(a) - parseServiceTime(b)).map((serviceTime, index) => {
                              const adultData = adultBreakdown[serviceTime] || { average: 0, total: 0, count: 0 };
                              const kidsData = kidsBreakdown[serviceTime] || { average: 0, total: 0, count: 0 };
                              const useSlotTotals = isSingleCampusDashboard || isGlobal;
                              const adultVal = Math.round(
                                useSlotTotals
                                  ? (adultData.total ?? adultData.average ?? 0)
                                  : (adultData.average || 0)
                              );
                              const kidsVal = Math.round(
                                useSlotTotals
                                  ? (kidsData.total ?? kidsData.average ?? 0)
                                  : (kidsData.average || 0)
                              );
                              const slotTotal = adultVal + kidsVal;
                              const serviceCount = Math.max(adultData.count || 0, kidsData.count || 0);
                              
                              return (
                                <div key={index} className="p-4 bg-fc-cream rounded-xl">
                                  <div className="flex justify-between items-center mb-3">
                                    <div>
                                      <div className="text-lg font-semibold text-fc-midnight">{serviceTime}</div>
                                      <div className="text-sm text-fc-brown">{serviceCount} services</div>
                                    </div>
                                    <div className="text-2xl font-bold text-fc-violet">
                                      {slotTotal.toLocaleString()}
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-fc-cream2">
                                    <div className="text-center">
                                      <div className="text-xs text-fc-brown/70 mb-1">Adults</div>
                                      <div className="text-lg font-semibold text-fc-teal">{adultVal.toLocaleString()}</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-xs text-fc-brown/70 mb-1">Kids (incl. leaders)</div>
                                      <div className="text-lg font-semibold text-fc-copper">{kidsVal.toLocaleString()}</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-xs text-fc-brown/70 mb-1">Total</div>
                                      <div className="text-lg font-semibold text-fc-violet">{slotTotal.toLocaleString()}</div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}

              {modalType === 'weekend-attendance' && (
                <div className="space-y-6">
                  <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                    <h3 className="text-xl font-bold text-fc-midnight mb-4">Weekend Attendance Breakdown</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                      <div className="bg-fc-wash-violet rounded-xl p-4 border border-fc-violet/20">
                        <h4 className="text-lg font-semibold text-fc-violet mb-2">Sunday Services</h4>
                        <div className="text-3xl font-bold text-fc-violet mb-1">
                          {(modalData?.sundayAdults ?? sundayAdultAttendance).toLocaleString()}
                        </div>
                        <p className="text-fc-brown text-sm">Adult service times only</p>
                      </div>
                      <div className="bg-fc-wash-sky rounded-xl p-4 border border-fc-wash-sky-border">
                        <h4 className="text-lg font-semibold text-fc-teal mb-2">Youth Friday</h4>
                        <div className="text-3xl font-bold text-fc-teal mb-1">
                          {youthAttendance.toLocaleString()}
                        </div>
                        <p className="text-fc-brown text-sm">Total for selected period (Friday)</p>
                      </div>
                      <div className="bg-fc-wash-peach rounded-xl p-4 border border-fc-wash-peach-border">
                        <h4 className="text-lg font-semibold text-fc-copper mb-2">Kids</h4>
                        <div className="text-3xl font-bold text-fc-copper mb-1">
                          {kidsAttendance.toLocaleString()}
                        </div>
                        <p className="text-fc-brown text-sm">Total kids across all services</p>
                      </div>
                      <div className="bg-fc-wash-butter rounded-xl p-4 border border-fc-wash-butter-border">
                        <h4 className="text-lg font-semibold text-fc-gold mb-2">Kids Leaders</h4>
                        <div className="text-3xl font-bold text-fc-gold mb-1">
                          {kidsLeaders.toLocaleString()}
                        </div>
                        <p className="text-fc-brown text-sm">Total leaders across all services</p>
                      </div>
                      <div className="bg-fc-wash-mint rounded-xl p-4 border border-fc-wash-mint-border">
                        <h4 className="text-lg font-semibold text-fc-olive mb-2">Saints</h4>
                        <div className="text-3xl font-bold text-fc-olive mb-1">
                          {saintsAttendance.toLocaleString()}
                        </div>
                        <p className="text-fc-brown text-sm">Total for selected period</p>
                      </div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-fc-cream2">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold text-fc-midnight">Weekend total</span>
                        <div className="text-2xl font-bold text-fc-olive">
                          {totalAttendance.toLocaleString()}
                        </div>
                      </div>
                      <p className="text-fc-brown/70 text-xs mt-2">
                        Sunday ({(modalData?.sunday ?? sundayCombinedAttendance).toLocaleString()}) + Youth Friday ({youthAttendance.toLocaleString()})
                      </p>
                    </div>
                  </div>
                  
                  {!isRollup && (() => {
                    // Only show service breakdown for individual campuses, not rollup views
                    // Try to get services from modalData or fallback to data
                    let servicesToShow = modalData.services;
                    
                    // If no services in modalData, try to build from serviceBreakdown
                    if (!servicesToShow || servicesToShow.length === 0) {
                      const serviceBreakdown = modalData.serviceBreakdown || data.service_breakdown || {};
                      servicesToShow = Object.keys(serviceBreakdown).map(service => ({
                        name: service,
                        attendance: (isSingleCampusDashboard || isGlobal)
                          ? (serviceBreakdown[service]?.total ?? 0)
                          : (serviceBreakdown[service]?.average || 0),
                        count: serviceBreakdown[service]?.count || 0,
                        total: serviceBreakdown[service]?.total || 0,
                      })).sort((a, b) => parseServiceTime(a.name) - parseServiceTime(b.name));
                    }
                    
                    if (servicesToShow && servicesToShow.length > 0) {
                      return (
                        <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                          <h3 className="text-xl font-bold text-fc-midnight mb-4">Service Breakdown</h3>
                          <div className="space-y-4">
                            {servicesToShow.map((service, index) => {
                              const useTotals = isSingleCampusDashboard || isGlobal;
                              const displayVal = useTotals
                                ? Math.round(service.total || service.attendance)
                                : Math.round(service.attendance);
                              const avgPerService = Math.round(service.attendance);
                              return (
                                <div key={index} className="flex justify-between items-center p-4 bg-fc-cream rounded-xl">
                                  <div>
                                    <div className="text-lg font-semibold text-fc-midnight">{service.name}</div>
                                    <div className="text-sm text-fc-brown">
                                      {service.count} {service.count === 1 ? 'service' : 'services'}
                                      {useTotals
                                        ? ' · total for period'
                                        : ` · avg ${avgPerService.toLocaleString()} per service`}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-2xl font-bold text-fc-violet">
                                      {displayVal.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-fc-brown/70">
                                      {useTotals ? 'Total for period' : 'Avg per service'}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}

              {modalType === 'souls' && (
                <div className="space-y-6">
                  <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                    <h3 className="text-xl font-bold text-fc-midnight mb-4">Total Souls</h3>
                    <div className="text-4xl font-bold text-fc-copper mb-2">
                      {modalData.total.toLocaleString()}
                    </div>
                    <p className="text-fc-brown">All spiritual decisions made</p>
                  </div>
                  
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
              <h3 className="text-xl font-bold text-fc-midnight mb-4">Adult Salvations</h3>
              <div className="text-4xl font-bold text-fc-gold mb-2">
                {modalData.adults.toLocaleString()}
              </div>
              <p className="text-fc-brown">Adults saved</p>
            </div>
            <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
              <h3 className="text-xl font-bold text-fc-midnight mb-4">Youth Salvations</h3>
              <div className="text-4xl font-bold text-fc-violet mb-2">
                {modalData.youth.toLocaleString()}
              </div>
              <p className="text-fc-brown">Young people saved</p>
            </div>
            <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
              <h3 className="text-xl font-bold text-fc-midnight mb-4">Kids Salvations</h3>
              <div className="text-4xl font-bold text-fc-olive mb-2">
                {modalData.kids.toLocaleString()}
              </div>
              <p className="text-fc-brown">Children saved</p>
            </div>
            <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
              <h3 className="text-xl font-bold text-fc-midnight mb-4">Rededications</h3>
              <div className="text-4xl font-bold text-fc-teal mb-2">
                {modalData.rededications.toLocaleString()}
              </div>
              <p className="text-fc-brown">People recommitting</p>
            </div>
            <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
              <h3 className="text-xl font-bold text-fc-midnight mb-4">Salvation Cards Returned</h3>
              <div className="text-4xl font-bold text-fc-teal mb-2">
                {modalData.salvationCardsReturned?.toLocaleString() || 0}
              </div>
              <p className="text-fc-brown">Salvation cards collected</p>
            </div>
            <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
              <h3 className="text-xl font-bold text-fc-midnight mb-4">Hands Up</h3>
              <div className="text-4xl font-bold text-fc-gold mb-2">
                {modalData.handsUp?.toLocaleString() || 0}
              </div>
              <p className="text-fc-brown">People who responded (may differ from actual salvations)</p>
            </div>
          </div>
                </div>
              )}

              {modalType === 'new-people' && (
                <div className="space-y-6">
                  <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                    <h3 className="text-xl font-bold text-fc-midnight mb-4">Total New People</h3>
                    <div className="text-4xl font-bold text-fc-gold mb-2">
                      {modalData.total.toLocaleString()}
                    </div>
                    <p className="text-fc-brown">Total new people this period (includes Youth NP)</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                      <h3 className="text-xl font-bold text-fc-midnight mb-4">First-Time Visitors</h3>
                      <div className="text-4xl font-bold text-fc-teal mb-2">
                        {modalData.firstTime.toLocaleString()}
                      </div>
                      <p className="text-fc-brown">First time at church</p>
                    </div>
                    <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                      <h3 className="text-xl font-bold text-fc-midnight mb-4">Visitors</h3>
                      <div className="text-4xl font-bold text-fc-violet mb-2">
                        {modalData.visiting.toLocaleString()}
                      </div>
                      <p className="text-fc-brown">Just visiting</p>
                    </div>
                    <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                      <h3 className="text-xl font-bold text-fc-midnight mb-4">Cards Returned</h3>
                      <div className="text-4xl font-bold text-fc-olive mb-2">
                        {modalData.infoGathered.toLocaleString()}
                      </div>
                      <p className="text-fc-brown">Contact information collected</p>
                    </div>
                    <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                      <h3 className="text-xl font-bold text-fc-midnight mb-4">Packs Out</h3>
                      <div className="text-4xl font-bold text-fc-teal mb-2">
                        {modalData.packsOut?.toLocaleString() || 0}
                      </div>
                      <p className="text-fc-brown">New people packs handed out</p>
                    </div>
                    {modalData.youthNP !== undefined && modalData.youthNP > 0 && (
                      <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                        <h3 className="text-xl font-bold text-fc-midnight mb-4">Youth New People</h3>
                        <div className="text-4xl font-bold text-fc-violet mb-2">
                          {modalData.youthNP.toLocaleString()}
                        </div>
                        <p className="text-fc-brown">New youth this period (included in total)</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {modalType === 'kids' && (
                <div className="space-y-6">
                  <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                    <h3 className="text-xl font-bold text-fc-midnight mb-4">Kids Ministry Overview</h3>
                    <div className="text-4xl font-bold text-fc-copper mb-2">
                      {(modalData.attendance + modalData.leaders).toLocaleString()}
                    </div>
                    <p className="text-fc-brown">
                      {isRollup ? `Total kids + leaders across all campuses` : `${modalData.attendance} kids + ${modalData.leaders} leaders`}
                    </p>
                  </div>
                  
                  {isRollup && data?.campuses && data.campuses.length > 0 && (
                    <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                      <h3 className="text-xl font-bold text-fc-midnight mb-4">Campus Breakdown</h3>
                      <div className="space-y-3">
                        {data.campuses.map((campus, index) => (
                          <div key={index} className="p-4 bg-fc-cream rounded-xl border border-fc-cream2">
                            <div className="flex justify-between items-center mb-2">
                              <div className="text-lg font-semibold text-fc-midnight">{campus.campus_name}</div>
                              <div className="text-2xl font-bold text-fc-copper">
                                {Math.round(campus.total_kids_with_leaders || 0).toLocaleString()}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-fc-cream2">
                              <div>
                                <div className="text-xs text-fc-brown/70 mb-1">Kids</div>
                                <div className="text-sm font-semibold text-fc-copper">
                                  {Math.round(campus.total_kids || 0).toLocaleString()}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-fc-brown/70 mb-1">Leaders</div>
                                <div className="text-sm font-semibold text-fc-teal">
                                  {Math.round(campus.total_kids_leaders || 0).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <div className="text-xs text-fc-midnight/40 mt-2">
                              {campus.record_count || 0} services
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                      <h3 className="text-xl font-bold text-fc-midnight mb-4">Kids Attendance</h3>
                      <div className="text-4xl font-bold text-fc-copper mb-2">
                        {modalData.attendance.toLocaleString()}
                      </div>
                      <p className="text-fc-brown">
                        {isRollup ? 'Total kids' : 'Total kids across all services'}
                      </p>
                    </div>
                    <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                      <h3 className="text-xl font-bold text-fc-midnight mb-4">Kids Leaders</h3>
                      <div className="text-4xl font-bold text-fc-violet mb-2">
                        {modalData.leaders.toLocaleString()}
                      </div>
                      <p className="text-fc-brown">Total leaders across all services</p>
                    </div>
                    <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                      <h3 className="text-xl font-bold text-fc-midnight mb-4">New Kids</h3>
                      <div className="text-4xl font-bold text-fc-gold mb-2">
                        {modalData.newKids.toLocaleString()}
                      </div>
                      <p className="text-fc-brown">Total new children this period</p>
                    </div>
                    <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                      <h3 className="text-xl font-bold text-fc-midnight mb-4">Kids Salvations</h3>
                      <div className="text-4xl font-bold text-fc-olive mb-2">
                        {modalData.salvations.toLocaleString()}
                      </div>
                      <p className="text-fc-brown">Total children saved this period</p>
                    </div>
                  </div>
                  
                  {!isRollup && modalData.kidsServiceBreakdown && Object.keys(modalData.kidsServiceBreakdown).length > 0 && (
                    <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                      <h3 className="text-xl font-bold text-fc-midnight mb-4">Kids by Service Time</h3>
                      <div className="space-y-4">
                        {Object.entries(modalData.kidsServiceBreakdown).map(([serviceTime, data]) => (
                          data.count > 0 && (
                            <div key={serviceTime} className="flex justify-between items-center p-4 bg-fc-cream rounded-xl">
                              <div>
                                <div className="text-lg font-semibold text-fc-midnight">{serviceTime}</div>
                                <div className="text-sm text-fc-brown">{data.count} services</div>
                              </div>
                              <div className="text-2xl font-bold text-fc-copper">
                                {Math.round(
                                  (isSingleCampusDashboard || isGlobal)
                                    ? (data.total ?? data.average ?? 0)
                                    : (data.average || 0)
                                ).toLocaleString()}
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {modalType === 'youth' && (
                <div className="space-y-6">
                  <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                    <h3 className="text-xl font-bold text-fc-midnight mb-4">Youth Ministry Overview</h3>
                    <div className="text-4xl font-bold text-fc-violet mb-2">
                      {modalData.attendance.toLocaleString()}
                    </div>
                    <p className="text-fc-brown">
                      {isRollup ? 'Total youth + leaders across all campuses' : 'Total youth + leaders (average per service)'}
                    </p>
                  </div>
                  
                  {isRollup && data?.campuses && data.campuses.length > 0 && (
                    <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                      <h3 className="text-xl font-bold text-fc-midnight mb-4">Campus Breakdown</h3>
                      <div className="space-y-3">
                        {data.campuses.map((campus, index) => (
                          <div key={index} className="p-4 bg-fc-cream rounded-xl border border-fc-cream2">
                            <div className="flex justify-between items-center mb-2">
                              <div className="text-lg font-semibold text-fc-midnight">{campus.campus_name}</div>
                              <div className="text-2xl font-bold text-fc-violet">
                                {Math.round(campus.total_youth || 0).toLocaleString()}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-fc-cream2">
                              <div>
                                <div className="text-xs text-fc-brown/70 mb-1">Youth</div>
                                <div className="text-sm font-semibold text-fc-violet">
                                  {Math.round(campus.total_youth_attendance || 0).toLocaleString()}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-fc-brown/70 mb-1">Leaders</div>
                                <div className="text-sm font-semibold text-fc-teal">
                                  {Math.round(campus.total_youth_leaders || 0).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <div className="text-xs text-fc-midnight/40 mt-2">
                              {campus.record_count || 0} services
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                      <h3 className="text-xl font-bold text-fc-midnight mb-4">Youth Attendance</h3>
                      <div className="text-4xl font-bold text-fc-violet mb-2">
                        {modalData.attendance.toLocaleString()}
                      </div>
                      <p className="text-fc-brown">
                        {isRollup ? 'Total youth + leaders' : 'Total youth + leaders (average per service)'}
                      </p>
                    </div>
                    <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                      <h3 className="text-xl font-bold text-fc-midnight mb-4">Youth Leaders</h3>
                      <div className="text-4xl font-bold text-fc-teal mb-2">
                        {modalData.leaders?.toLocaleString() || 'N/A'}
                      </div>
                      <p className="text-fc-brown">Average volunteers serving</p>
                    </div>
                    <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                      <h3 className="text-xl font-bold text-fc-midnight mb-4">Youth Salvations</h3>
                      <div className="text-4xl font-bold text-fc-violet mb-2">
                        {modalData.salvations.toLocaleString()}
                      </div>
                      <p className="text-fc-brown">Total young people saved this period</p>
                    </div>
                    <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                      <h3 className="text-xl font-bold text-fc-midnight mb-4">Youth New People</h3>
                      <div className="text-4xl font-bold text-fc-gold mb-2">
                        {modalData.newPeople.toLocaleString()}
                      </div>
                      <p className="text-fc-brown">Total new youth this period</p>
                    </div>
                    <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                      <h3 className="text-xl font-bold text-fc-midnight mb-4">Saints</h3>
                      <div className="text-4xl font-bold text-fc-gold mb-2">
                        {modalData.saints?.toLocaleString() || 0}
                      </div>
                      <p className="text-fc-brown">Average saints attendance this period</p>
                    </div>
                  </div>
                </div>
              )}

              {modalType === 'giving' && (
                <div className="space-y-6">
                  <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                    <h3 className="text-xl font-bold text-fc-midnight mb-4">Giving Overview</h3>
                    <div className="text-4xl font-bold text-fc-gold mb-2">
                      ${((modalData.breakdown?.general || 0) + (modalData.breakdown?.trust || 0) + (modalData.breakdown?.online || 0) + (modalData.breakdown?.text || 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </div>
                    <p className="text-fc-brown">Average weekly giving for this period</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                      <h3 className="text-xl font-bold text-fc-midnight mb-4">General</h3>
                      <div className="text-4xl font-bold text-fc-olive mb-2">
                        ${(modalData.breakdown?.general || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </div>
                      <p className="text-fc-brown">Regular giving</p>
                    </div>
                    <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                      <h3 className="text-xl font-bold text-fc-midnight mb-4">Trust</h3>
                      <div className="text-4xl font-bold text-fc-teal mb-2">
                        ${(modalData.breakdown?.trust || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </div>
                      <p className="text-fc-brown">Trust fund giving</p>
                    </div>
                    <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                      <h3 className="text-xl font-bold text-fc-midnight mb-4">Online</h3>
                      <div className="text-4xl font-bold text-fc-violet mb-2">
                        ${(modalData.breakdown?.online || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </div>
                      <p className="text-fc-brown">Online contributions</p>
                    </div>
                    <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                      <h3 className="text-xl font-bold text-fc-midnight mb-4">Text</h3>
                      <div className="text-4xl font-bold text-fc-gold mb-2">
                        ${(modalData.breakdown?.text || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </div>
                      <p className="text-fc-brown">Text giving</p>
                    </div>
                  </div>
                </div>
              )}

              {modalType === 'connect-groups' && (
                <div className="space-y-6">
                  <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                    <h3 className="text-xl font-bold text-fc-midnight mb-4">Connect Groups Overview</h3>
                    <div className="text-4xl font-bold text-fc-teal mb-2">
                      {modalData.total.toLocaleString()}
                    </div>
                    <p className="text-fc-brown">
                      {modalData.isRollup ? 'Total active connect groups across all campuses' : 'Average connect groups per service'}
                    </p>
                    {modalData.percentage > 0 && (
                      <p className="text-fc-brown/70 text-sm mt-2">
                        {modalData.percentage}% of Sunday attendance
                      </p>
                    )}
                  </div>
                  
                  {modalData.isRollup && data?.campuses && data.campuses.length > 0 && (
                    <div className="bg-fc-cream rounded-2xl p-6 border border-fc-cream2">
                      <h3 className="text-xl font-bold text-fc-midnight mb-4">Campus Breakdown</h3>
                      <div className="space-y-3">
                        {data.campuses.map((campus, index) => (
                          <div key={index} className="p-4 bg-fc-cream rounded-xl border border-fc-cream2">
                            <div className="flex justify-between items-center">
                              <div className="text-lg font-semibold text-fc-midnight">{campus.campus_name}</div>
                              <div className="text-2xl font-bold text-fc-teal">
                                {Math.round(campus.total_connect_groups || 0).toLocaleString()}
                              </div>
                            </div>
                            <div className="text-xs text-fc-midnight/40 mt-2">
                              {campus.record_count || 0} services
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Add more modal types as needed */}
            </div>
          </div>
        </div>
      )}

      <CampusAttendanceReportModal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportRegionCode={reportScope.regionCode}
        reportCampusesCsv={reportScope.campusesCsv}
        regionTitle={reportScope.regionTitle}
        campusScopeLabel={reportScope.scopeLabel}
        metricsScope={metricsScope}
      />
    </div>
  );
};

export default CampusDashboard;
