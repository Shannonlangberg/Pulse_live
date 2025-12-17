import React, { useState, useEffect } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
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

const CampusDashboard = ({ campusId, campusName, isRollup = false, onBackToSelector }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [campusData, setCampusData] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [modalData, setModalData] = useState(null);
  const [dateFilter, setDateFilter] = useState('last_7_days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showPreviousYear, setShowPreviousYear] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReportData, setAiReportData] = useState(null);
  const [aiReportType, setAiReportType] = useState('');

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
  }, [campusId, dateFilter, customStartDate, customEndDate, showPreviousYear]);

  const fetchCampusData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }

      const params = new URLSearchParams({
        campus_id: campusId,
        date_filter: dateFilter,
        custom_start_date: customStartDate,
        custom_end_date: customEndDate,
        show_previous_year: showPreviousYear.toString(),
        _t: Date.now()
      });

      const cacheBuster = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const response = await fetch(`/api/dashboard_data_public?campus=${campusId}&date_filter=${dateFilter}&custom_start_date=${customStartDate}&custom_end_date=${customEndDate}&show_previous_year=${showPreviousYear}&_t=${cacheBuster}`);
      const result = await response.json();
      setData(result);
      setCampusData(result);
      setLastRefresh(new Date());
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

  // AI Report Generation Functions
  const generateWeekendReport = async () => {
    try {
      setAiLoading(true);
      setAiReportType('weekend');
      const response = await fetch(`/api/dashboard_data_public?campus=${campusId}&date_filter=last_7_days&_t=${Date.now()}`);
      const fetchedData = await response.json();
      setAiReportData(fetchedData);
    } catch (error) {
      setAiReportData({ error: 'Error generating weekend report. Please try again.' });
    } finally {
      setAiLoading(false);
    }
  };

  const generateMonthlyReport = async () => {
    try {
      setAiLoading(true);
      setAiReportType('monthly');
      const response = await fetch(`/api/dashboard_data_public?campus=${campusId}&date_filter=last_30_days&_t=${Date.now()}`);
      const fetchedData = await response.json();
      setAiReportData(fetchedData);
    } catch (error) {
      setAiReportData({ error: 'Error generating monthly report. Please try again.' });
    } finally {
      setAiLoading(false);
    }
  };

  const generateAnnualReport = async () => {
    try {
      setAiLoading(true);
      setAiReportType('annual');
      const response = await fetch(`/api/dashboard_data_public?campus=${campusId}&date_filter=year_to_date&_t=${Date.now()}`);
      const fetchedData = await response.json();
      setAiReportData(fetchedData);
    } catch (error) {
      setAiReportData({ error: 'Error generating annual report. Please try again.' });
    } finally {
      setAiLoading(false);
    }
  };

  const generateGrowthAnalysis = async () => {
    try {
      setAiLoading(true);
      setAiReportType('growth');
      const response = await fetch(`/api/dashboard_data_public?campus=${campusId}&date_filter=last_12_months&_t=${Date.now()}`);
      const fetchedData = await response.json();
      setAiReportData(fetchedData);
    } catch (error) {
      setAiReportData({ error: 'Error generating growth analysis. Please try again.' });
    } finally {
      setAiLoading(false);
    }
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">
            <span className="text-4xl">⛪</span>
          </div>
          <div className="text-white text-2xl font-bold mb-2">Loading Campus Dashboard</div>
          <div className="text-white/60 text-lg">Fetching {campusName} data...</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">⚠️</span>
          </div>
          <div className="text-white text-2xl font-bold mb-2">No Data Available</div>
          <div className="text-white/60 text-lg">Unable to load {campusName} data</div>
        </div>
      </div>
    );
  }

  // ATTENDANCE: ALWAYS show AVERAGES (per service) - regardless of date filter
  // NEW PEOPLE / SALVATIONS: ALWAYS show TOTALS - regardless of date filter
  // This ensures consistent reporting across all date ranges
  
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
  const services = Object.keys(serviceBreakdown).map(service => ({
    name: service,
    attendance: serviceBreakdown[service]?.average || 0,
    count: serviceBreakdown[service]?.count || 0,
    total: serviceBreakdown[service]?.total || 0
  })).sort((a, b) => parseServiceTime(a.name) - parseServiceTime(b.name));
  
  // Calculate Sunday attendance from service breakdown AVERAGES (not totals)
  // Sum the averages across all service times to get total average Sunday attendance
  const sundayAttendanceFromServices = services.reduce((sum, service) => {
    // Use the average (attendance) per service, not the total across all weeks
    return sum + (service.attendance || 0);
  }, 0);
  
  // Calculate percentages and metrics
  const totalPeople = data.stats?.total_people || 0;
  // Use service breakdown sum if it exists and has data, otherwise fall back to avg_attendance
  const sundayAdultAttendance = Math.round(sundayAttendanceFromServices > 0 ? sundayAttendanceFromServices : (data.stats?.avg_attendance || 0));
  const youthAttendance = Math.round(data.stats?.avg_youth_attendance || 0); // ALWAYS average
  const kidsAttendance = Math.round(data.stats?.avg_kids_attendance || 0); // Kids only
  const kidsLeaders = Math.round(data.stats?.avg_kids_leaders || 0); // Leaders only
  const kidsTotalForSunday = kidsAttendance + kidsLeaders; // Kids + leaders
  const saintsAttendance = Math.round(data.stats?.avg_saints || 0); // Saints average
  const sundayCombinedAttendance = sundayAdultAttendance + kidsTotalForSunday + saintsAttendance;
  const totalAttendance = sundayAdultAttendance + youthAttendance + kidsAttendance + kidsLeaders + saintsAttendance; // Weekend = Sunday + Youth + Kids + Kids Leaders + Saints
  const attendancePercentage = totalPeople > 0 ? Math.round((totalAttendance / totalPeople) * 100) : 0;
  const connectGroupPercentage = sundayAdultAttendance > 0 ? Math.round((data.stats?.avg_connect_groups || 0) / sundayAdultAttendance * 100) : 0;

  return (
    <div key={`campus-dashboard-${campusId}-${lastRefresh.getTime()}`} className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-500/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Header */}
      <div className="relative bg-gradient-to-r from-blue-600/90 via-purple-600/90 to-pink-600/90 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex-1 w-full">
              {onBackToSelector && (
                <button
                  onClick={onBackToSelector}
                  className="group relative bg-gradient-to-r from-slate-600 to-slate-700 text-white px-6 py-3 rounded-2xl font-semibold hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-slate-500/25 overflow-hidden mb-4"
                >
                  <div className="relative flex items-center gap-3">
                    <span className="text-xl">←</span>
                    <span>Back to Campuses</span>
                  </div>
                </button>
              )}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 flex-shrink-0 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <span className="text-2xl">⛪</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl sm:text-2xl lg:text-5xl font-bold text-white tracking-tight leading-tight break-words">
                    {isRollup ? 'Australia' : campusName}
                  </h1>
                  <p className="text-white/80 text-xs sm:text-sm lg:text-lg font-medium mt-0.5 lg:mt-1">
                    {isRollup ? 'National Ministry Overview' : 'Campus Ministry Dashboard'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Date Range Selector */}
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-300"
                >
                  <option value="last_7_days" className="bg-slate-800 text-white">Last 7 Days</option>
                  <option value="last_30_days" className="bg-slate-800 text-white">Last 30 Days</option>
                  <option value="last_3_months" className="bg-slate-800 text-white">Last 3 Months</option>
                  <option value="last_6_months" className="bg-slate-800 text-white">Last 6 Months</option>
                  <option value="last_12_months" className="bg-slate-800 text-white">Last 12 Months</option>
                  <option value="year_to_date" className="bg-slate-800 text-white">YTD</option>
                  <option value="last_2_years" className="bg-slate-800 text-white">Last 2 Years</option>
                  <option value="custom" className="bg-slate-800 text-white">Custom Range</option>
                </select>

                {dateFilter === 'custom' && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-300"
                      placeholder="Start Date"
                    />
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-300"
                      placeholder="End Date"
                    />
                  </div>
                )}

              </div>

              {/* AI Assistant Button */}
              <button
                onClick={() => setShowAIModal(true)}
                className="flex items-center gap-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-emerald-500/25 whitespace-nowrap"
              >
                <span className="text-xl">🤖</span>
                <span>AI Assistant</span>
              </button>

              <div className="text-right">
                <div className="text-white/60 text-sm">Last Updated</div>
                <div className="text-white font-medium">
                  {lastRefresh.toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-8">
        {/* Campus Cards Grid */}
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-1 h-12 bg-gradient-to-b from-blue-400 to-purple-400 rounded-full"></div>
            <div>
              <h2 className="text-3xl font-bold text-white">
                Campus Overview
              </h2>
              <p className="text-white/60 text-lg">
                {isRollup ? 'All campuses combined' : `${campusName} ministry metrics`}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* Campus Overview */}
            <div 
              className="group relative bg-gradient-to-br from-[#62B4FF]/20 to-[#5D1FEC]/20 backdrop-blur-sm rounded-2xl p-6 border border-[#62B4FF]/20 shadow-2xl hover:shadow-[#62B4FF]/25 transition-all duration-500 hover:scale-105 cursor-pointer"
              onClick={() => openModal('campus-overview', { 
                total: totalPeople,
                dreamTeam: Math.round(data.stats?.avg_dream_team || 0),
                baptisms: data.stats?.baptisms || 0,
                childDedications: data.stats?.child_dedications || 0,
                campus: campusName 
              })}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#62B4FF]/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-[#62B4FF]/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <span className="text-2xl">🏢</span>
                  </div>
                  <div className="text-[#62B4FF] text-sm font-semibold">Overview</div>
                </div>
                <h3 className="text-white/80 text-sm font-medium mb-2">Campus Overview</h3>
                <div className="text-4xl font-bold text-white mb-2">
                  {totalPeople.toLocaleString()}
                </div>
                <p className="text-[#62B4FF]/80 text-sm">
                  Total registered people
                </p>
              </div>
            </div>

            {/* Total Weekend Attendance */}
            <div 
              className="group relative bg-gradient-to-br from-[#AC9B25]/20 to-[#FF8432]/20 backdrop-blur-sm rounded-2xl p-6 border border-[#AC9B25]/20 shadow-2xl hover:shadow-[#AC9B25]/25 transition-all duration-500 hover:scale-105 cursor-pointer"
              onClick={() => openModal('weekend-attendance', { 
                total: totalAttendance,
                sunday: sundayAdultAttendance,
                youth: youthAttendance,
                percentage: attendancePercentage,
                campus: campusName
              })}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#AC9B25]/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-[#AC9B25]/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <span className="text-2xl">📅</span>
                  </div>
                  <div className="text-[#AC9B25] text-sm font-semibold">Weekend</div>
                </div>
                <h3 className="text-white/80 text-sm font-medium mb-2">Total Weekend Attendance</h3>
                <div className="text-4xl font-bold text-white mb-2">
                  {totalAttendance.toLocaleString()}
                </div>
                <p className="text-[#AC9B25]/80 text-sm">
                  Average per service
                </p>
              </div>
            </div>

            {/* Sunday Attendance */}
            <div 
              className="group relative bg-gradient-to-br from-purple-500/20 to-purple-600/20 backdrop-blur-sm rounded-2xl p-6 border border-purple-400/20 shadow-2xl hover:shadow-purple-500/25 transition-all duration-500 hover:scale-105 cursor-pointer"
              onClick={() => {
                openModal('sunday-attendance', { 
                  total: sundayCombinedAttendance, 
                  adults: sundayAdultAttendance,
                  kids: kidsTotalForSunday, // Kids + leaders for clarity in modal
                  saints: saintsAttendance,
                  services: services,
                  campus: campusName
                });
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <span className="text-2xl">⛪</span>
                  </div>
                  <div className="text-purple-400 text-sm font-semibold">Sunday</div>
                </div>
                <h3 className="text-white/80 text-sm font-medium mb-2">Sunday Attendance</h3>
                <div className="text-4xl font-bold text-white mb-2">
                  {sundayCombinedAttendance.toLocaleString()}
                </div>
                <p className="text-purple-200/80 text-sm">
                  Adults + Kids (incl. leaders) + Saints = Total
                </p>
                <p className="text-purple-200/60 text-xs mt-1">
                  {services.length > 1 ? `${services.length} services • Average per service` : 'Average per service'}
                </p>
              </div>
            </div>

            {/* Souls */}
            <div 
              className="group relative bg-gradient-to-br from-red-500/20 to-red-600/20 backdrop-blur-sm rounded-2xl p-6 border border-red-400/20 shadow-2xl hover:shadow-red-500/25 transition-all duration-500 hover:scale-105 cursor-pointer"
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
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <span className="text-2xl">✝️</span>
                  </div>
                  <div className="text-red-400 text-sm font-semibold">Souls</div>
                </div>
                <h3 className="text-white/80 text-sm font-medium mb-2">Souls Saved</h3>
                <div className="text-4xl font-bold text-white mb-2">
                  {((data.stats?.first_time_christians || 0) + (data.stats?.youth_salvations || 0) + (data.stats?.new_kids_salvations || 0) + (data.stats?.rededications || 0)).toLocaleString()}
                </div>
                <p className="text-red-200/80 text-sm">
                  All spiritual decisions
                </p>
              </div>
            </div>

            {/* Just Visiting */}
            <div 
              className="group relative bg-gradient-to-br from-orange-500/20 to-orange-600/20 backdrop-blur-sm rounded-2xl p-6 border border-orange-400/20 shadow-2xl hover:shadow-orange-500/25 transition-all duration-500 hover:scale-105 cursor-pointer"
              onClick={() => openModal('new-people', { 
                total: data.stats?.new_people || 0,
                firstTime: data.stats?.first_time_visitors || 0,
                visiting: data.stats?.visitors || 0,
                infoGathered: data.stats?.information_gathered || 0,
                packsOut: data.stats?.packs_out || 0,
                campus: campusName 
              })}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <span className="text-2xl">🆕</span>
                  </div>
                  <div className="text-orange-400 text-sm font-semibold">Growth</div>
                </div>
                <h3 className="text-white/80 text-sm font-medium mb-2">New People</h3>
                <div className="text-4xl font-bold text-white mb-2">
                  {(data.stats?.new_people || 0).toLocaleString()}
                </div>
                <p className="text-orange-200/80 text-sm">
                  First-time + visiting
                </p>
              </div>
            </div>

            {/* Kids */}
            <div 
              className="group relative bg-gradient-to-br from-pink-500/20 to-pink-600/20 backdrop-blur-sm rounded-2xl p-6 border border-pink-400/20 shadow-2xl hover:shadow-pink-500/25 transition-all duration-500 hover:scale-105 cursor-pointer"
              onClick={() => openModal('kids', { 
                attendance: kidsAttendance,
                leaders: Math.round(data.stats?.avg_kids_leaders || 0),
                newKids: data.stats?.new_kids || 0,
                salvations: data.stats?.new_kids_salvations || 0,
                campus: campusName,
                kidsServiceBreakdown: data.service_breakdown?.kids || {}
              })}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <span className="text-2xl">🧒</span>
                  </div>
                  <div className="text-pink-400 text-sm font-semibold">Kids</div>
                </div>
                <h3 className="text-white/80 text-sm font-medium mb-2">Kids Church</h3>
                <div className="text-4xl font-bold text-white mb-2">
                  {(kidsAttendance + Math.round(data.stats?.avg_kids_leaders || 0)).toLocaleString()}
                </div>
                <p className="text-pink-200/80 text-sm">
                  {kidsAttendance} kids + {Math.round(data.stats?.avg_kids_leaders || 0)} leaders
                </p>
              </div>
            </div>

            {/* Youth */}
            <div 
              className="group relative bg-gradient-to-br from-indigo-500/20 to-indigo-600/20 backdrop-blur-sm rounded-2xl p-6 border border-indigo-400/20 shadow-2xl hover:shadow-indigo-500/25 transition-all duration-500 hover:scale-105 cursor-pointer"
              onClick={() => openModal('youth', { 
                attendance: youthAttendance,
                leaders: data.stats?.youth_leaders || 0,
                salvations: data.stats?.youth_salvations || 0,
                newPeople: data.stats?.youth_new_people || 0,
                campus: campusName 
              })}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <span className="text-2xl">🎯</span>
                  </div>
                  <div className="text-indigo-400 text-sm font-semibold">Youth</div>
                </div>
                <h3 className="text-white/80 text-sm font-medium mb-2">Youth Ministry</h3>
                <div className="text-4xl font-bold text-white mb-2">
                  {youthAttendance.toLocaleString()}
                </div>
                <p className="text-indigo-200/80 text-sm">
                  {data.stats?.youth_salvations || 0} salvations (total)
                </p>
              </div>
            </div>

            {/* Giving */}
            <div 
              className="group relative bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 backdrop-blur-sm rounded-2xl p-6 border border-yellow-400/20 shadow-2xl hover:shadow-yellow-500/25 transition-all duration-500 hover:scale-105 cursor-pointer"
              onClick={() => openModal('giving', { 
                total: data.stats?.tithe || 0,
                average: data.stats?.avg_tithe || 0,
                breakdown: data.tithe_breakdown || {general: 0, trust: 0, online: 0, text: 0},
                campus: campusName 
              })}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <span className="text-2xl">💰</span>
                  </div>
                  <div className="text-yellow-400 text-sm font-semibold">Finance</div>
                </div>
                <h3 className="text-white/80 text-sm font-medium mb-2">Average Giving</h3>
                <div className="text-4xl font-bold text-white mb-2">
                  ${((data.tithe_breakdown?.general || 0) + (data.tithe_breakdown?.trust || 0) + (data.tithe_breakdown?.online || 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </div>
                <p className="text-yellow-200/80 text-sm">
                  Financial stewardship
                </p>
              </div>
            </div>

            {/* Connect Groups */}
            <div 
              className="group relative bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 backdrop-blur-sm rounded-2xl p-6 border border-cyan-400/20 shadow-2xl hover:shadow-cyan-500/25 transition-all duration-500 hover:scale-105 cursor-pointer"
              onClick={() => openModal('connect-groups', { 
                total: Math.round(data.stats?.avg_connect_groups || 0),
                percentage: connectGroupPercentage,
                sundayAttendance: sundayAdultAttendance,
                campus: campusName 
              })}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <span className="text-2xl">🤝</span>
                  </div>
                  <div className="text-cyan-400 text-sm font-semibold">Community</div>
                </div>
                <h3 className="text-white/80 text-sm font-medium mb-2">Total Number of Connect Groups</h3>
                <div className="text-4xl font-bold text-white mb-2">
                  {Math.round(data.stats?.avg_connect_groups || 0).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Insights and Charts */}
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-1 h-12 bg-gradient-to-b from-emerald-400 to-cyan-400 rounded-full"></div>
            <div>
              <h2 className="text-3xl font-bold text-white">
                Campus Insights
              </h2>
              <p className="text-white/60 text-lg">
                Detailed analytics and trends for {campusName}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Attendance Trends */}
            <div className="group relative bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 shadow-2xl hover:shadow-blue-500/10 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <span className="text-xl">📈</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Attendance YTD</h3>
                      <p className="text-white/60 text-sm">Year-to-date attendance trends</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showPreviousYear}
                        onChange={(e) => setShowPreviousYear(e.target.checked)}
                        className="w-4 h-4 text-blue-500 bg-white/10 border-white/20 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <span className="text-white/80 text-sm">Show previous year</span>
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
                          borderColor: '#3b82f6',
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          borderWidth: 3,
                          tension: 0.4,
                          fill: true,
                          pointRadius: 5,
                          pointHoverRadius: 7,
                          pointBackgroundColor: '#3b82f6',
                          pointBorderColor: '#ffffff',
                          pointBorderWidth: 2
                        },
                        ...(showPreviousYear ? [{
                          label: 'Previous Year',
                          data: data.chart_data?.attendance_previous_year || [],
                          borderColor: '#94a3b8',
                          backgroundColor: 'rgba(148, 163, 184, 0.1)',
                          borderWidth: 2,
                          tension: 0.4,
                          fill: false,
                          borderDash: [5, 5],
                          pointRadius: 4,
                          pointHoverRadius: 6,
                          pointBackgroundColor: '#94a3b8',
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
                            color: 'rgba(255, 255, 255, 0.8)'
                          }
                        }
                      },
                      scales: {
                        x: {
                          ticks: {
                            color: 'rgba(255, 255, 255, 0.6)'
                          },
                          grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                          }
                        },
                        y: {
                          ticks: {
                            color: 'rgba(255, 255, 255, 0.6)'
                          },
                          grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                          }
                        }
                      }
                    }} 
                  />
                </div>
              </div>
            </div>

            {/* Tithe YTD Chart */}
            <div className="group relative bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 shadow-2xl hover:shadow-green-500/10 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <span className="text-xl">💰</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Tithe YTD</h3>
                      <p className="text-white/60 text-sm">Year-to-date giving with comparison</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-white/80">
                      <input
                        type="checkbox"
                        checked={showPreviousYear}
                        onChange={(e) => setShowPreviousYear(e.target.checked)}
                        className="w-4 h-4 text-green-500 bg-white/10 border-white/20 rounded focus:ring-green-500 focus:ring-2"
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
                          borderColor: '#10b981',
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          borderWidth: 3,
                          tension: 0.4,
                          fill: true,
                          pointRadius: 5,
                          pointHoverRadius: 7,
                          pointBackgroundColor: '#10b981',
                          pointBorderColor: '#ffffff',
                          pointBorderWidth: 2
                        },
                        ...(showPreviousYear ? [{
                          label: '2024',
                          data: data.chart_data?.tithe_previous_year || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                          borderColor: '#6b7280',
                          backgroundColor: 'rgba(107, 114, 128, 0.1)',
                          borderWidth: 2,
                          tension: 0.4,
                          fill: false,
                          borderDash: [5, 5],
                          pointRadius: 4,
                          pointHoverRadius: 6,
                          pointBackgroundColor: '#6b7280',
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
                            color: 'rgba(255, 255, 255, 0.8)'
                          }
                        }
                      },
                      scales: {
                        x: {
                          ticks: {
                            color: 'rgba(255, 255, 255, 0.6)'
                          },
                          grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                          }
                        },
                        y: {
                          ticks: {
                            color: 'rgba(255, 255, 255, 0.6)',
                            callback: function(value) {
                              return '$' + value.toLocaleString();
                            }
                          },
                          grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                          }
                        }
                      }
                    }} 
                  />
                </div>
                <div className="mt-4 flex justify-between items-center text-sm">
                  <div className="text-white/60">
                    Current YTD: <span className="text-green-400 font-semibold">
                      ${(data.stats?.tithe_ytd || 0).toLocaleString()}
                    </span>
                  </div>
                  {showPreviousYear && (
                    <div className="text-white/60">
                      Previous Year: <span className="text-gray-400 font-semibold">
                        ${(data.stats?.tithe_previous_year || 0).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
                {showPreviousYear && (
                  <div className="mt-2 text-center">
                    <div className="text-white/60 text-sm">
                      % Increase YTD: <span className={`font-semibold ${(() => {
                        const current = data.stats?.tithe_ytd || 0;
                        const previous = data.stats?.tithe_previous_year || 0;
                        if (previous === 0) return 'text-gray-400';
                        const increase = ((current - previous) / previous) * 100;
                        return increase >= 0 ? 'text-green-400' : 'text-red-400';
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
      </div>

      {/* Modal for Drill-down Details */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-3xl font-bold text-white">
                  {modalType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} Details
                </h2>
                <p className="text-white/60 text-lg mt-1">
                  {campusName} - Detailed Breakdown
                </p>
              </div>
              <button
                onClick={closeModal}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center text-white/60 hover:text-white transition-all duration-300"
              >
                <span className="text-xl">×</span>
              </button>
            </div>

            <div className="space-y-6">
              {modalType === 'campus-overview' && (
                <div className="space-y-6">
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                    <h3 className="text-xl font-bold text-white mb-4">Campus Overview</h3>
                    <div className="text-4xl font-bold text-[#62B4FF] mb-2">
                      {modalData.total.toLocaleString()}
                    </div>
                    <p className="text-white/60">Total on database in {modalData.campus}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-4">Dream Team</h3>
                      <div className="text-4xl font-bold text-[#FF8432] mb-2">
                        {modalData.dreamTeam.toLocaleString()}
                      </div>
                      <p className="text-white/60">Average volunteers serving this period</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-4">Baptisms</h3>
                      <div className="text-4xl font-bold text-[#E43CB9] mb-2">
                        {modalData.baptisms.toLocaleString()}
                      </div>
                      <p className="text-white/60">People baptized this period</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-4">Child Dedications</h3>
                      <div className="text-4xl font-bold text-[#5D1FEC] mb-2">
                        {modalData.childDedications.toLocaleString()}
                      </div>
                      <p className="text-white/60">Children dedicated this period</p>
                    </div>
                  </div>
                </div>
              )}

              {modalType === 'sunday-attendance' && (
                <div className="space-y-6">
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                    <h3 className="text-xl font-bold text-white mb-4">Sunday Attendance</h3>
                    <div className="text-4xl font-bold text-purple-400 mb-2">
                      {modalData.total.toLocaleString()}
                    </div>
                    <p className="text-white/60">
                      {isRollup 
                        ? 'Average attendance across all campuses (adults + kids + kids leaders + saints, excluding youth)' 
                        : 'Average per service: Adults + Kids (incl. leaders) + Saints'}
                    </p>
                    <p className="text-white/50 text-sm mt-2">
                      Adults: {(modalData?.adults ?? sundayAdultAttendance).toLocaleString()} • Kids (incl. leaders): {(modalData?.kids ?? kidsTotalForSunday).toLocaleString()} • Saints: {(modalData?.saints ?? saintsAttendance).toLocaleString()}
                    </p>
                  </div>
                  
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
                        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                          <h3 className="text-xl font-bold text-white mb-4">Service Breakdown (Adults + Kids incl. leaders)</h3>
                          <div className="space-y-4">
                            {Array.from(allServiceTimes).sort((a, b) => parseServiceTime(a) - parseServiceTime(b)).map((serviceTime, index) => {
                              const adultData = adultBreakdown[serviceTime] || { average: 0, count: 0 };
                              const kidsData = kidsBreakdown[serviceTime] || { average: 0, count: 0 };
                              const adultAvg = Math.round(adultData.average || 0);
                              const kidsAvg = Math.round(kidsData.average || 0);
                              const totalAvg = adultAvg + kidsAvg;
                              const serviceCount = Math.max(adultData.count || 0, kidsData.count || 0);
                              
                              return (
                                <div key={index} className="p-4 bg-white/5 rounded-xl">
                                  <div className="flex justify-between items-center mb-3">
                                    <div>
                                      <div className="text-lg font-semibold text-white">{serviceTime}</div>
                                      <div className="text-sm text-white/60">{serviceCount} services</div>
                                    </div>
                                    <div className="text-2xl font-bold text-purple-400">
                                      {totalAvg.toLocaleString()}
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-white/10">
                                    <div className="text-center">
                                      <div className="text-xs text-white/50 mb-1">Adults</div>
                                      <div className="text-lg font-semibold text-blue-400">{adultAvg.toLocaleString()}</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-xs text-white/50 mb-1">Kids (incl. leaders)</div>
                                      <div className="text-lg font-semibold text-pink-400">{kidsAvg.toLocaleString()}</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-xs text-white/50 mb-1">Total</div>
                                      <div className="text-lg font-semibold text-purple-400">{totalAvg.toLocaleString()}</div>
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
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                    <h3 className="text-xl font-bold text-white mb-4">Weekend Attendance Breakdown</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                      <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-400/20">
                        <h4 className="text-lg font-semibold text-purple-300 mb-2">Sunday Services</h4>
                        <div className="text-3xl font-bold text-purple-400 mb-1">
                          {(modalData?.sunday ?? sundayAdultAttendance).toLocaleString()}
                        </div>
                        <p className="text-purple-200/80 text-sm">Average Sunday attendance</p>
                      </div>
                      <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-400/20">
                        <h4 className="text-lg font-semibold text-blue-300 mb-2">Youth Friday</h4>
                        <div className="text-3xl font-bold text-blue-400 mb-1">
                          {youthAttendance.toLocaleString()}
                        </div>
                        <p className="text-blue-200/80 text-sm">Average youth attendance</p>
                      </div>
                      <div className="bg-pink-500/10 rounded-xl p-4 border border-pink-400/20">
                        <h4 className="text-lg font-semibold text-pink-300 mb-2">Kids</h4>
                        <div className="text-3xl font-bold text-pink-400 mb-1">
                          {kidsAttendance.toLocaleString()}
                        </div>
                        <p className="text-pink-200/80 text-sm">Average kids attendance</p>
                      </div>
                      <div className="bg-orange-500/10 rounded-xl p-4 border border-orange-400/20">
                        <h4 className="text-lg font-semibold text-orange-300 mb-2">Kids Leaders</h4>
                        <div className="text-3xl font-bold text-orange-400 mb-1">
                          {kidsLeaders.toLocaleString()}
                        </div>
                        <p className="text-orange-200/80 text-sm">Average kids leaders</p>
                      </div>
                      <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-400/20">
                        <h4 className="text-lg font-semibold text-emerald-300 mb-2">Saints</h4>
                        <div className="text-3xl font-bold text-emerald-400 mb-1">
                          {saintsAttendance.toLocaleString()}
                        </div>
                        <p className="text-emerald-200/80 text-sm">Average saints attendance</p>
                      </div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-white/10">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold text-white">Average Weekend Total</span>
                        <div className="text-2xl font-bold text-emerald-400">
                          {totalAttendance.toLocaleString()}
                        </div>
                      </div>
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
                        attendance: serviceBreakdown[service]?.average || 0,
                        count: serviceBreakdown[service]?.count || 0
                      })).sort((a, b) => parseServiceTime(a.name) - parseServiceTime(b.name));
                    }
                    
                    if (servicesToShow && servicesToShow.length > 0) {
                      return (
                        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                          <h3 className="text-xl font-bold text-white mb-4">Service Breakdown</h3>
                          <div className="space-y-4">
                            {servicesToShow.map((service, index) => {
                              const avgPerService = Math.round(service.attendance);
                              // Use actual total from backend, not recalculated
                              const totalForTimeSlot = service.total || Math.round(service.attendance * service.count);
                              return (
                                <div key={index} className="flex justify-between items-center p-4 bg-white/5 rounded-xl">
                                  <div>
                                    <div className="text-lg font-semibold text-white">{service.name}</div>
                                    <div className="text-sm text-white/60">
                                      {service.count} {service.count === 1 ? 'service' : 'services'} · Avg: {avgPerService.toLocaleString()} per service
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-2xl font-bold text-purple-400">
                                      {avgPerService.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-white/50">Avg per service</div>
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
                  
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                    <h3 className="text-xl font-bold text-white mb-4">Engagement Rate</h3>
                    <div className="text-4xl font-bold text-cyan-400 mb-2">
                      {modalData.percentage}%
                    </div>
                    <p className="text-white/60">Attendance/Campus total</p>
                  </div>
                </div>
              )}

              {modalType === 'souls' && (
                <div className="space-y-6">
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                    <h3 className="text-xl font-bold text-white mb-4">Total Souls</h3>
                    <div className="text-4xl font-bold text-red-400 mb-2">
                      {modalData.total.toLocaleString()}
                    </div>
                    <p className="text-white/60">All spiritual decisions made</p>
                  </div>
                  
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">Adult Salvations</h3>
              <div className="text-4xl font-bold text-orange-400 mb-2">
                {modalData.adults.toLocaleString()}
              </div>
              <p className="text-white/60">Adults saved</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">Youth Salvations</h3>
              <div className="text-4xl font-bold text-purple-400 mb-2">
                {modalData.youth.toLocaleString()}
              </div>
              <p className="text-white/60">Young people saved</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">Kids Salvations</h3>
              <div className="text-4xl font-bold text-green-400 mb-2">
                {modalData.kids.toLocaleString()}
              </div>
              <p className="text-white/60">Children saved</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">Rededications</h3>
              <div className="text-4xl font-bold text-blue-400 mb-2">
                {modalData.rededications.toLocaleString()}
              </div>
              <p className="text-white/60">People recommitting</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">Salvation Cards Returned</h3>
              <div className="text-4xl font-bold text-teal-400 mb-2">
                {modalData.salvationCardsReturned?.toLocaleString() || 0}
              </div>
              <p className="text-white/60">Salvation cards collected</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">Hands Up</h3>
              <div className="text-4xl font-bold text-yellow-400 mb-2">
                {modalData.handsUp?.toLocaleString() || 0}
              </div>
              <p className="text-white/60">People who responded (may differ from actual salvations)</p>
            </div>
          </div>
                </div>
              )}

              {modalType === 'new-people' && (
                <div className="space-y-6">
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                    <h3 className="text-xl font-bold text-white mb-4">Total New People</h3>
                    <div className="text-4xl font-bold text-orange-400 mb-2">
                      {modalData.total.toLocaleString()}
                    </div>
                    <p className="text-white/60">Total new people this period</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-4">First-Time Visitors</h3>
                      <div className="text-4xl font-bold text-blue-400 mb-2">
                        {modalData.firstTime.toLocaleString()}
                      </div>
                      <p className="text-white/60">First time at church</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-4">Visitors</h3>
                      <div className="text-4xl font-bold text-purple-400 mb-2">
                        {modalData.visiting.toLocaleString()}
                      </div>
                      <p className="text-white/60">Just visiting</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-4">Cards Returned</h3>
                      <div className="text-4xl font-bold text-green-400 mb-2">
                        {modalData.infoGathered.toLocaleString()}
                      </div>
                      <p className="text-white/60">Contact information collected</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-4">Packs Out</h3>
                      <div className="text-4xl font-bold text-cyan-400 mb-2">
                        {modalData.packsOut?.toLocaleString() || 0}
                      </div>
                      <p className="text-white/60">New people packs handed out</p>
                    </div>
                  </div>
                </div>
              )}

              {modalType === 'kids' && (
                <div className="space-y-6">
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                    <h3 className="text-xl font-bold text-white mb-4">Kids Ministry Overview</h3>
                    <div className="text-4xl font-bold text-pink-400 mb-2">
                      {(modalData.attendance + modalData.leaders).toLocaleString()}
                    </div>
                    <p className="text-white/60">{modalData.attendance} kids + {modalData.leaders} leaders</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-4">Kids Attendance</h3>
                      <div className="text-4xl font-bold text-pink-400 mb-2">
                        {modalData.attendance.toLocaleString()}
                      </div>
                      <p className="text-white/60">Average children in attendance</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-4">Kids Leaders</h3>
                      <div className="text-4xl font-bold text-purple-400 mb-2">
                        {modalData.leaders.toLocaleString()}
                      </div>
                      <p className="text-white/60">Average volunteers serving</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-4">New Kids</h3>
                      <div className="text-4xl font-bold text-orange-400 mb-2">
                        {modalData.newKids.toLocaleString()}
                      </div>
                      <p className="text-white/60">Total new children this period</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-4">Kids Salvations</h3>
                      <div className="text-4xl font-bold text-green-400 mb-2">
                        {modalData.salvations.toLocaleString()}
                      </div>
                      <p className="text-white/60">Total children saved this period</p>
                    </div>
                  </div>
                  
                  {modalData.kidsServiceBreakdown && Object.keys(modalData.kidsServiceBreakdown).length > 0 && (
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-4">Kids by Service Time</h3>
                      <div className="space-y-4">
                        {Object.entries(modalData.kidsServiceBreakdown).map(([serviceTime, data]) => (
                          data.count > 0 && (
                            <div key={serviceTime} className="flex justify-between items-center p-4 bg-white/5 rounded-xl">
                              <div>
                                <div className="text-lg font-semibold text-white">{serviceTime}</div>
                                <div className="text-sm text-white/60">{data.count} services</div>
                              </div>
                              <div className="text-2xl font-bold text-pink-400">
                                {Math.round(data.average).toLocaleString()}
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
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                    <h3 className="text-xl font-bold text-white mb-4">Youth Ministry Overview</h3>
                    <div className="text-4xl font-bold text-indigo-400 mb-2">
                      {modalData.attendance.toLocaleString()}
                    </div>
                    <p className="text-white/60">Average youth attendance this period</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-4">Youth Attendance</h3>
                      <div className="text-4xl font-bold text-indigo-400 mb-2">
                        {modalData.attendance.toLocaleString()}
                      </div>
                      <p className="text-white/60">Average young people in attendance</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-4">Youth Leaders</h3>
                      <div className="text-4xl font-bold text-cyan-400 mb-2">
                        {modalData.leaders?.toLocaleString() || 'N/A'}
                      </div>
                      <p className="text-white/60">Average volunteers serving</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-4">Youth Salvations</h3>
                      <div className="text-4xl font-bold text-purple-400 mb-2">
                        {modalData.salvations.toLocaleString()}
                      </div>
                      <p className="text-white/60">Total young people saved this period</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-4">Youth New People</h3>
                      <div className="text-4xl font-bold text-orange-400 mb-2">
                        {modalData.newPeople.toLocaleString()}
                      </div>
                      <p className="text-white/60">Total new youth this period</p>
                    </div>
                  </div>
                </div>
              )}

              {modalType === 'giving' && (
                <div className="space-y-6">
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                    <h3 className="text-xl font-bold text-white mb-4">Giving Overview</h3>
                    <div className="text-4xl font-bold text-yellow-400 mb-2">
                      ${((modalData.breakdown?.general || 0) + (modalData.breakdown?.trust || 0) + (modalData.breakdown?.online || 0) + (modalData.breakdown?.text || 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </div>
                    <p className="text-white/60">Average weekly giving for this period</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-4">General</h3>
                      <div className="text-4xl font-bold text-green-400 mb-2">
                        ${(modalData.breakdown?.general || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </div>
                      <p className="text-white/60">Regular giving</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-4">Trust</h3>
                      <div className="text-4xl font-bold text-blue-400 mb-2">
                        ${(modalData.breakdown?.trust || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </div>
                      <p className="text-white/60">Trust fund giving</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-4">Online</h3>
                      <div className="text-4xl font-bold text-purple-400 mb-2">
                        ${(modalData.breakdown?.online || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </div>
                      <p className="text-white/60">Online contributions</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-4">Text</h3>
                      <div className="text-4xl font-bold text-orange-400 mb-2">
                        ${(modalData.breakdown?.text || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </div>
                      <p className="text-white/60">Text giving</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Add more modal types as needed */}
            </div>
          </div>
        </div>
      )}

      {/* AI Assistant Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto border border-white/10">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 px-8 py-6 rounded-t-3xl border-b border-white/10 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <span className="text-2xl">🤖</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">AI Assistant</h2>
                    <p className="text-white/80 text-sm">Get insights about {isRollup ? 'all Australia campuses' : campusName}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowAIModal(false);
                    setAiReportData(null);
                    setAiReportType('');
                  }}
                  className="text-white/80 hover:text-white text-3xl font-light transition-colors"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-8">
              {/* Quick Reports Section */}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span>⚡</span> Quick Reports
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <button
                    onClick={generateWeekendReport}
                    disabled={aiLoading}
                    className="group relative bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-sm border border-purple-400/20 text-white px-6 py-4 rounded-2xl font-semibold hover:scale-105 disabled:opacity-50 disabled:scale-100 transition-all duration-300 shadow-lg hover:shadow-purple-500/25"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📅</span>
                      <span>Weekend</span>
                    </div>
                  </button>
                  <button
                    onClick={generateMonthlyReport}
                    disabled={aiLoading}
                    className="group relative bg-gradient-to-r from-blue-600/20 to-cyan-600/20 backdrop-blur-sm border border-blue-400/20 text-white px-6 py-4 rounded-2xl font-semibold hover:scale-105 disabled:opacity-50 disabled:scale-100 transition-all duration-300 shadow-lg hover:shadow-blue-500/25"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📊</span>
                      <span>Monthly</span>
                    </div>
                  </button>
                  <button
                    onClick={generateAnnualReport}
                    disabled={aiLoading}
                    className="group relative bg-gradient-to-r from-emerald-500/20 to-blue-600/20 backdrop-blur-sm border border-emerald-400/20 text-white px-6 py-4 rounded-2xl font-semibold hover:scale-105 disabled:opacity-50 disabled:scale-100 transition-all duration-300 shadow-lg hover:shadow-emerald-500/25"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📈</span>
                      <span>Annual</span>
                    </div>
                  </button>
                  <button
                    onClick={generateGrowthAnalysis}
                    disabled={aiLoading}
                    className="group relative bg-gradient-to-r from-pink-600/20 to-orange-600/20 backdrop-blur-sm border border-pink-400/20 text-white px-6 py-4 rounded-2xl font-semibold hover:scale-105 disabled:opacity-50 disabled:scale-100 transition-all duration-300 shadow-lg hover:shadow-pink-500/25"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🚀</span>
                      <span>Growth</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* AI Report Section */}
              {(aiLoading || aiReportData) && (
                <div className="space-y-6">
                  {aiLoading ? (
                    <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 min-h-[300px]">
                    <div className="flex flex-col items-center justify-center h-64">
                      <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mb-4 animate-pulse">
                        <span className="text-3xl">🤖</span>
                      </div>
                      <div className="text-white text-lg font-semibold mb-2">Generating Report...</div>
                      <div className="text-white/60">Analyzing your ministry data</div>
                      </div>
                    </div>
                  ) : aiReportData?.error ? (
                    <div className="bg-red-500/10 backdrop-blur-sm rounded-2xl p-6 border border-red-400/20">
                      <div className="text-red-400 text-lg font-semibold">{aiReportData.error}</div>
                    </div>
                  ) : (
                    <>
                      {/* Report Header */}
                      <div className="bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-2xl font-bold text-white mb-2">
                              {aiReportType === 'weekend' && '📅 Weekend Report (Last 7 Days)'}
                              {aiReportType === 'monthly' && '📊 Monthly Report (Last 30 Days)'}
                              {aiReportType === 'annual' && '📈 Annual Report (Year to Date)'}
                              {aiReportType === 'growth' && '🚀 Growth Trends (Last 12 Months)'}
                            </h3>
                            <p className="text-white/60">{campusName} - {new Date().toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-white/60">Services Logged</div>
                            <div className="text-3xl font-bold text-white">{aiReportData?.stats?.entry_count || 0}</div>
                          </div>
                        </div>
                      </div>

                      {/* Growth Report - Special Layout with Trend Charts */}
                      {aiReportType === 'growth' ? (
                        <>
                          {/* Growth Trend Charts */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Attendance Growth Trend */}
                            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                              <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                                  <span className="text-xl">👥</span>
                                </div>
                                <h4 className="text-xl font-bold text-white">Attendance Growth</h4>
                              </div>
                              <div className="h-64">
                                <Line
                                  data={{
                                    labels: aiReportData?.chart_data?.labels || [],
                                    datasets: [{
                                      label: 'Attendance',
                                      data: aiReportData?.chart_data?.attendance || [],
                                      borderColor: '#3b82f6',
                                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                      borderWidth: 3,
                                      tension: 0.4,
                                      fill: true,
                                      pointRadius: 5,
                                      pointBackgroundColor: '#3b82f6',
                                      pointBorderColor: '#fff',
                                      pointBorderWidth: 2
                                    }]
                                  }}
                                  options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                      legend: { display: false }
                                    },
                                    scales: {
                                      x: {
                                        ticks: { color: 'rgba(255, 255, 255, 0.6)' },
                                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                                      },
                                      y: {
                                        ticks: { color: 'rgba(255, 255, 255, 0.6)' },
                                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                                      }
                                    }
                                  }}
                                />
                              </div>
                              <div className="mt-4 text-center">
                                <div className="text-sm text-white/60">Total: <span className="text-white font-semibold">{(aiReportData?.stats?.total_attendance || 0).toLocaleString()}</span></div>
                              </div>
                            </div>

                            {/* New People Growth Trend */}
                            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                              <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                                  <span className="text-xl">🆕</span>
                                </div>
                                <h4 className="text-xl font-bold text-white">New People Growth</h4>
                              </div>
                              <div className="h-64">
                                <Line
                                  data={{
                                    labels: aiReportData?.chart_data?.labels || [],
                                    datasets: [{
                                      label: 'New People',
                                      data: aiReportData?.chart_data?.new_people || [],
                                      borderColor: '#fb923c',
                                      backgroundColor: 'rgba(251, 146, 60, 0.1)',
                                      borderWidth: 3,
                                      tension: 0.4,
                                      fill: true,
                                      pointRadius: 5,
                                      pointBackgroundColor: '#fb923c',
                                      pointBorderColor: '#fff',
                                      pointBorderWidth: 2
                                    }]
                                  }}
                                  options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                      legend: { display: false }
                                    },
                                    scales: {
                                      x: {
                                        ticks: { color: 'rgba(255, 255, 255, 0.6)' },
                                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                                      },
                                      y: {
                                        ticks: { color: 'rgba(255, 255, 255, 0.6)' },
                                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                                      }
                                    }
                                  }}
                                />
                              </div>
                              <div className="mt-4 text-center">
                                <div className="text-sm text-white/60">Total: <span className="text-white font-semibold">{(aiReportData?.stats?.new_people || 0).toLocaleString()}</span></div>
                              </div>
                            </div>

                            {/* Salvations Growth Trend */}
                            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                              <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                                  <span className="text-xl">✝️</span>
                                </div>
                                <h4 className="text-xl font-bold text-white">Salvations Growth</h4>
                              </div>
                              <div className="h-64">
                                <Line
                                  data={{
                                    labels: aiReportData?.chart_data?.labels || [],
                                    datasets: [{
                                      label: 'New Christians',
                                      data: aiReportData?.chart_data?.new_christians || [],
                                      borderColor: '#ef4444',
                                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                      borderWidth: 3,
                                      tension: 0.4,
                                      fill: true,
                                      pointRadius: 5,
                                      pointBackgroundColor: '#ef4444',
                                      pointBorderColor: '#fff',
                                      pointBorderWidth: 2
                                    }]
                                  }}
                                  options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                      legend: { display: false }
                                    },
                                    scales: {
                                      x: {
                                        ticks: { color: 'rgba(255, 255, 255, 0.6)' },
                                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                                      },
                                      y: {
                                        ticks: { color: 'rgba(255, 255, 255, 0.6)' },
                                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                                      }
                                    }
                                  }}
                                />
                              </div>
                              <div className="mt-4 text-center">
                                <div className="text-sm text-white/60">Total: <span className="text-white font-semibold">{(aiReportData?.stats?.first_time_christians || 0).toLocaleString()}</span></div>
                              </div>
                            </div>

                            {/* Youth Growth Trend */}
                            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                              <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                                  <span className="text-xl">🎯</span>
                                </div>
                                <h4 className="text-xl font-bold text-white">Youth Growth</h4>
                              </div>
                              <div className="h-64">
                                <Line
                                  data={{
                                    labels: aiReportData?.chart_data?.labels || [],
                                    datasets: [{
                                      label: 'Youth',
                                      data: aiReportData?.chart_data?.youth || [],
                                      borderColor: '#8b5cf6',
                                      backgroundColor: 'rgba(139, 92, 246, 0.1)',
                                      borderWidth: 3,
                                      tension: 0.4,
                                      fill: true,
                                      pointRadius: 5,
                                      pointBackgroundColor: '#8b5cf6',
                                      pointBorderColor: '#fff',
                                      pointBorderWidth: 2
                                    }]
                                  }}
                                  options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                      legend: { display: false }
                                    },
                                    scales: {
                                      x: {
                                        ticks: { color: 'rgba(255, 255, 255, 0.6)' },
                                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                                      },
                                      y: {
                                        ticks: { color: 'rgba(255, 255, 255, 0.6)' },
                                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                                      }
                                    }
                                  }}
                                />
                              </div>
                              <div className="mt-4 text-center">
                                <div className="text-sm text-white/60">Total: <span className="text-white font-semibold">{(aiReportData?.stats?.youth_attendance || 0).toLocaleString()}</span></div>
                              </div>
                            </div>

                            {/* Kids Growth Trend */}
                            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                              <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-pink-500/20 rounded-lg flex items-center justify-center">
                                  <span className="text-xl">🧒</span>
                                </div>
                                <h4 className="text-xl font-bold text-white">Kids Growth</h4>
                              </div>
                              <div className="h-64">
                                <Line
                                  data={{
                                    labels: aiReportData?.chart_data?.labels || [],
                                    datasets: [{
                                      label: 'Kids',
                                      data: aiReportData?.chart_data?.kids || [],
                                      borderColor: '#ec4899',
                                      backgroundColor: 'rgba(236, 72, 153, 0.1)',
                                      borderWidth: 3,
                                      tension: 0.4,
                                      fill: true,
                                      pointRadius: 5,
                                      pointBackgroundColor: '#ec4899',
                                      pointBorderColor: '#fff',
                                      pointBorderWidth: 2
                                    }]
                                  }}
                                  options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                      legend: { display: false }
                                    },
                                    scales: {
                                      x: {
                                        ticks: { color: 'rgba(255, 255, 255, 0.6)' },
                                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                                      },
                                      y: {
                                        ticks: { color: 'rgba(255, 255, 255, 0.6)' },
                                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                                      }
                                    }
                                  }}
                                />
                              </div>
                              <div className="mt-4 text-center">
                                <div className="text-sm text-white/60">Total: <span className="text-white font-semibold">{(aiReportData?.stats?.kids_attendance || 0).toLocaleString()}</span></div>
                              </div>
                            </div>

                            {/* Tithe Growth Trend */}
                            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                              <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                                  <span className="text-xl">💰</span>
                                </div>
                                <h4 className="text-xl font-bold text-white">Giving Growth</h4>
                              </div>
                              <div className="h-64">
                                <Line
                                  data={{
                                    labels: aiReportData?.chart_data?.tithe_labels || [],
                                    datasets: [{
                                      label: 'Tithe',
                                      data: aiReportData?.chart_data?.tithe_ytd || [],
                                      borderColor: '#10b981',
                                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                      borderWidth: 3,
                                      tension: 0.4,
                                      fill: true,
                                      pointRadius: 5,
                                      pointBackgroundColor: '#10b981',
                                      pointBorderColor: '#fff',
                                      pointBorderWidth: 2
                                    }]
                                  }}
                                  options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                      legend: { display: false }
                                    },
                                    scales: {
                                      x: {
                                        ticks: { color: 'rgba(255, 255, 255, 0.6)' },
                                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                                      },
                                      y: {
                                        ticks: {
                                          color: 'rgba(255, 255, 255, 0.6)',
                                          callback: function(value) {
                                            return '$' + value.toLocaleString();
                                          }
                                        },
                                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                                      }
                                    }
                                  }}
                                />
                              </div>
                              <div className="mt-4 text-center">
                                <div className="text-sm text-white/60">YTD Total: <span className="text-white font-semibold">${(aiReportData?.stats?.tithe_ytd || 0).toLocaleString()}</span></div>
                              </div>
                            </div>
                          </div>

                          {/* Growth Summary Cards */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 backdrop-blur-sm rounded-xl p-4 border border-blue-400/20">
                              <div className="text-sm text-white/60 mb-1">Avg Attendance</div>
                              <div className="text-2xl font-bold text-white">{Math.round(aiReportData?.stats?.avg_attendance || 0)}</div>
                            </div>
                            <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 backdrop-blur-sm rounded-xl p-4 border border-orange-400/20">
                              <div className="text-sm text-white/60 mb-1">Avg New People</div>
                              <div className="text-2xl font-bold text-white">{Math.round(aiReportData?.stats?.avg_new_people || 0)}</div>
                            </div>
                            <div className="bg-gradient-to-br from-red-500/20 to-red-600/20 backdrop-blur-sm rounded-xl p-4 border border-red-400/20">
                              <div className="text-sm text-white/60 mb-1">Avg Salvations</div>
                              <div className="text-2xl font-bold text-white">{Math.round(aiReportData?.stats?.avg_first_time_christians || 0)}</div>
                            </div>
                            <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 backdrop-blur-sm rounded-xl p-4 border border-green-400/20">
                              <div className="text-sm text-white/60 mb-1">Avg Giving</div>
                              <div className="text-2xl font-bold text-white">${Math.round(aiReportData?.stats?.avg_tithe || 0).toLocaleString()}</div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Standard Report Layout for Weekend, Monthly, Annual */}
                          {/* Key Metrics Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 backdrop-blur-sm rounded-xl p-6 border border-blue-400/20">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                              <span className="text-xl">👥</span>
                            </div>
                            <h4 className="text-white/80 text-sm font-medium">Total Attendance</h4>
                          </div>
                          <div className="text-3xl font-bold text-white mb-1">
                            {Math.round(aiReportData?.stats?.avg_attendance || 0).toLocaleString()}
                          </div>
                          <p className="text-blue-200/60 text-sm">
                            {Math.round(aiReportData?.stats?.avg_attendance || 0)} avg per service
                          </p>
                        </div>

                        <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 backdrop-blur-sm rounded-xl p-6 border border-orange-400/20">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                              <span className="text-xl">🆕</span>
                            </div>
                            <h4 className="text-white/80 text-sm font-medium">New People</h4>
                          </div>
                          <div className="text-3xl font-bold text-white mb-1">
                            {(aiReportData?.stats?.new_people || 0).toLocaleString()}
                          </div>
                          <p className="text-orange-200/60 text-sm">
                            Avg: {Math.round(aiReportData?.stats?.avg_new_people || 0)} per service
                          </p>
                        </div>

                        <div className="bg-gradient-to-br from-red-500/20 to-red-600/20 backdrop-blur-sm rounded-xl p-6 border border-red-400/20">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                              <span className="text-xl">✝️</span>
                            </div>
                            <h4 className="text-white/80 text-sm font-medium">Salvations</h4>
                          </div>
                          <div className="text-3xl font-bold text-white mb-1">
                            {(aiReportData?.stats?.first_time_christians || 0).toLocaleString()}
                          </div>
                          <p className="text-red-200/60 text-sm">
                            Avg: {Math.round(aiReportData?.stats?.avg_first_time_christians || 0)} per service
                          </p>
                        </div>

                        <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 backdrop-blur-sm rounded-xl p-6 border border-green-400/20">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                              <span className="text-xl">🤝</span>
                            </div>
                            <h4 className="text-white/80 text-sm font-medium">Volunteers</h4>
                          </div>
                          <div className="text-3xl font-bold text-white mb-1">
                            {Math.round(aiReportData?.stats?.avg_volunteers || aiReportData?.stats?.avg_dream_team || 0).toLocaleString()}
                          </div>
                          <p className="text-green-200/60 text-sm">
                            Average serving
                          </p>
                        </div>
                      </div>

                      {/* Ministry Breakdown Charts */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Ministry Distribution Doughnut Chart */}
                        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                          <h4 className="text-xl font-bold text-white mb-4">Ministry Distribution</h4>
                          <div className="h-64">
                            <Doughnut
                              data={{
                                labels: ['Adults', 'Youth', 'Kids', 'Leaders'],
                                datasets: [{
                                  data: [
                                    Math.round(aiReportData?.stats?.avg_attendance || 0),
                                    Math.round(aiReportData?.stats?.avg_youth_attendance || 0),
                                    Math.round(aiReportData?.stats?.avg_kids_attendance || 0),
                                    Math.round(aiReportData?.stats?.avg_kids_leaders || 0) + Math.round(aiReportData?.stats?.avg_volunteers || 0)
                                  ],
                                  backgroundColor: [
                                    'rgba(59, 130, 246, 0.8)',
                                    'rgba(139, 92, 246, 0.8)',
                                    'rgba(236, 72, 153, 0.8)',
                                    'rgba(34, 197, 94, 0.8)'
                                  ],
                                  borderColor: [
                                    'rgba(59, 130, 246, 1)',
                                    'rgba(139, 92, 246, 1)',
                                    'rgba(236, 72, 153, 1)',
                                    'rgba(34, 197, 94, 1)'
                                  ],
                                  borderWidth: 2
                                }]
                              }}
                              options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                  legend: {
                                    position: 'bottom',
                                    labels: {
                                      color: 'rgba(255, 255, 255, 0.8)',
                                      padding: 15,
                                      font: { size: 12 }
                                    }
                                  }
                                }
                              }}
                            />
                      </div>
                      </div>

                        {/* Monthly Giving/Tithe Chart */}
                        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                          <h4 className="text-xl font-bold text-white mb-4">Monthly Giving</h4>
                          <div className="h-64">
                            <Bar
                              data={{
                                labels: aiReportData?.chart_data?.labels || ['Current Period'],
                                datasets: [{
                                  label: 'Giving ($)',
                                  data: aiReportData?.chart_data?.tithe_ytd?.length > 0 
                                    ? aiReportData.chart_data.tithe_ytd 
                                    : [aiReportData?.stats?.tithe || 0],
                                  backgroundColor: 'rgba(34, 197, 94, 0.8)',
                                  borderColor: 'rgba(34, 197, 94, 1)',
                                  borderWidth: 2
                                }]
                              }}
                              options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                  legend: { display: false },
                                  tooltip: {
                                    callbacks: {
                                      label: function(context) {
                                        let label = context.dataset.label || '';
                                        if (label) {
                                          label += ': ';
                                        }
                                        if (context.parsed.y !== null) {
                                          label += '$' + context.parsed.y.toLocaleString();
                                        }
                                        return label;
                                      }
                                    }
                                  }
                                },
                                scales: {
                                  x: {
                                    ticks: { color: 'rgba(255, 255, 255, 0.6)' },
                                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                                  },
                                  y: {
                                    ticks: { 
                                      color: 'rgba(255, 255, 255, 0.6)',
                                      callback: function(value) {
                                        return '$' + value.toLocaleString();
                                      }
                                    },
                                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                                  }
                                }
                              }}
                            />
                    </div>
                        </div>
                      </div>

                      {/* Additional Stats */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                          <div className="text-sm text-white/60 mb-2">Youth Ministry</div>
                          <div className="text-2xl font-bold text-purple-400">
                            {Math.round(aiReportData?.stats?.avg_youth_attendance || 0).toLocaleString()}
                          </div>
                          <div className="text-sm text-white/60 mt-1">
                            {Math.round(aiReportData?.stats?.avg_youth_attendance || 0)} avg per service
                          </div>
                        </div>

                        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                          <div className="text-sm text-white/60 mb-2">Kids Ministry</div>
                          <div className="text-2xl font-bold text-pink-400">
                            {Math.round(aiReportData?.stats?.avg_kids_attendance || 0).toLocaleString()}
                          </div>
                          <div className="text-sm text-white/60 mt-1">
                            {Math.round(aiReportData?.stats?.avg_kids_attendance || 0)} avg per service
                          </div>
                        </div>

                        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                          <div className="text-sm text-white/60 mb-2">Connect Groups</div>
                          <div className="text-2xl font-bold text-cyan-400">
                            {Math.round(aiReportData?.stats?.avg_connect_groups || 0).toLocaleString()}
                          </div>
                          <div className="text-sm text-white/60 mt-1">
                            Average attendance
                          </div>
                        </div>
                      </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampusDashboard;
