import React, { useState, useEffect } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import CampusSelector from './CampusSelector';
import CampusDashboard from './CampusDashboard';
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

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [campus, setCampus] = useState('');
  const [campuses, setCampuses] = useState([
    { id: 'all_campuses', name: 'All Campuses' },
    { id: 'paradise', name: 'Paradise Campus' },
    { id: 'adelaide_city', name: 'Adelaide City Campus' },
    { id: 'salisbury', name: 'Salisbury Campus' },
    { id: 'south', name: 'South Campus' },
    { id: 'mt_barker', name: 'Mt Barker Campus' },
    { id: 'clare_valley', name: 'Clare Valley Campus' },
    { id: 'victor_harbour', name: 'Victor Harbor Campus' },
    { id: 'copper_coast', name: 'Copper Coast Campus' }
  ]);
  const [showPreviousYear, setShowPreviousYear] = useState(true);
  const [dateFilter, setDateFilter] = useState('last_12_months');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState('');
  const [userCampus, setUserCampus] = useState('');
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCampus, setSelectedCampus] = useState(null);
  const [showCampusSelector, setShowCampusSelector] = useState(false);

  useEffect(() => {
    fetchUserSession();
  }, []);

  useEffect(() => {
    // Show campus selector for senior leadership or if no campus is selected
    if (userRole && (userRole === 'senior_leader' || userRole === 'admin' || userRole === 'senior_pastor' || userRole === 'lead_pastor')) {
      setShowCampusSelector(true);
    } else if (userRole && userCampus && userCampus !== 'all_campuses' && campuses.length > 0) {
      // Auto-select campus for campus pastors and other users with a campus
      // Normalize campus ID for matching (lowercase, handle spaces/underscores)
      const normalizedUserCampus = userCampus.toLowerCase().trim().replace(/\s+/g, '_');
      
      // Try to find campus with multiple matching strategies
      const foundCampus = campuses.find(c => {
        const campusId = (c.id || '').toLowerCase().trim();
        const campusName = (c.name || '').toLowerCase().trim();
        return campusId === normalizedUserCampus || 
               campusId === userCampus.toLowerCase().trim() ||
               campusName === userCampus.toLowerCase().trim() ||
               campusName.includes(userCampus.toLowerCase().trim()) ||
               campusId.includes(normalizedUserCampus);
      });
      
      if (foundCampus) {
        setSelectedCampus({
          id: foundCampus.id,
          name: foundCampus.name || foundCampus.display_name || userCampus,
          isRollup: false
        });
      } else {
        // If campus not found, log for debugging and show selector
        console.warn(`[Dashboard] Campus not found for user: ${userCampus}. Available campuses:`, campuses.map(c => c.id));
        setShowCampusSelector(true);
      }
    } else if (userRole && campuses.length > 0 && (!userCampus || userCampus === 'all_campuses')) {
      // If user has no specific campus but campuses are loaded, show selector
      setShowCampusSelector(true);
    }
  }, [userRole, userCampus, campuses]);

  useEffect(() => {
    if (campus) {
      fetchData();
    }
  }, [campus, dateFilter, customStartDate, customEndDate, showPreviousYear]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (campus && !isRefreshing) {
        fetchData(true);
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [campus, isRefreshing]);

  const fetchUserSession = async () => {
    try {
      const response = await fetch('/api/session', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        credentials: 'include'
      });
      const data = await response.json();
      if (data.authenticated) {
        setCurrentUser({
          id: data.id || 'unknown',
          username: data.username || 'User',
          full_name: data.full_name || 'User',
          role: data.role || 'user',
          campus: data.campus || 'all_campuses'
        });
        setUserRole(data.role || 'user');
        setUserCampus(data.campus || 'all_campuses');
        
        if (data.role === 'campus_pastor' && data.campus && data.campus !== 'all_campuses') {
          setCampus(data.campus);
        }
      }
    } catch (error) {
      console.error('Error fetching user session:', error);
    }
  };

  const fetchCampuses = async () => {
    try {
      const response = await fetch('/api/campuses/public');
      const result = await response.json();
      const campusesList = result.campuses || [];
      
      if (Array.isArray(campusesList)) {
        if (userRole === 'campus_pastor' && userCampus && userCampus !== 'all_campuses') {
          // Normalize campus ID for matching
          const normalizedUserCampus = userCampus.toLowerCase().trim().replace(/\s+/g, '_');
          
          // Try multiple matching strategies
          const userCampusData = campusesList.find(c => {
            const campusId = (c.id || '').toLowerCase().trim();
            const campusName = (c.name || '').toLowerCase().trim();
            return campusId === normalizedUserCampus || 
                   campusId === userCampus.toLowerCase().trim() ||
                   campusName === userCampus.toLowerCase().trim() ||
                   campusName.includes(userCampus.toLowerCase().trim()) ||
                   campusId.includes(normalizedUserCampus);
          });
          
          if (userCampusData) {
            setCampuses([userCampusData]);
            setCampus(userCampusData.id); // Use the actual campus ID from the found campus
          } else {
            // If campus not found, log for debugging
            console.warn(`[Dashboard] Campus pastor campus "${userCampus}" not found in campuses list. Available:`, campusesList.map(c => `${c.id} (${c.name})`));
            // Still set campuses so user can see what's available
            setCampuses(campusesList);
          }
        } else {
          setCampuses(campusesList);
          if (!campus && campusesList.length > 0) {
            const defaultCampus = campusesList.find(c => c.id === 'all_campuses') || campusesList[0];
            setCampus(defaultCampus.id);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching campuses:', error);
      if (!campus) {
        setCampus('all_campuses');
      }
    }
  };

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
      setLoading(true);
      }
      
      const params = new URLSearchParams({
        campus: campus,
        date_filter: dateFilter,
        _t: Date.now()
      });
      
      if (dateFilter === 'custom' && customStartDate && customEndDate) {
        params.append('custom_start_date', customStartDate);
        params.append('custom_end_date', customEndDate);
      }
      
      if (showPreviousYear) {
        params.append('show_previous_year', 'true');
      }
      
      const response = await fetch(`/api/dashboard_data_public?${params}`);
      const result = await response.json();
      setData(result);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchData(true);
  };

  const handleCampusSelect = (campus) => {
    setSelectedCampus(campus);
    setShowCampusSelector(false);
  };

  const handleBackToSelector = () => {
    setSelectedCampus(null);
    setShowCampusSelector(true);
  };

  useEffect(() => {
    if (userRole) {
      fetchCampuses();
    }
  }, [userRole, userCampus]);

  // AI Functions
  const generateWeekendReport = async () => {
    try {
      setAiLoading(true);
      const selectedCampus = campus === 'all_campuses' ? 'all_campuses' : campus;
      const response = await fetch(`/api/dashboard_data_public?campus=${selectedCampus}&date_filter=last_7_days`);
      const data = await response.json();
      
      const campusName = campus === 'all_campuses' ? 'All Campuses' : (Array.isArray(campuses) ? campuses.find(c => c.id === campus)?.name : 'Selected Campus') || 'Selected Campus';
      
      const report = `# Weekend Report (Last 7 Days) - ${campusName}

**📊 Attendance Overview**
- Total Attendance: ${data.stats?.total_attendance?.toLocaleString() || 'N/A'}
- Average per Service: ${Math.round(data.stats?.avg_attendance || 0)}
- Services Count: ${data.stats?.entry_count || 'N/A'}

**🎯 Key Metrics**
- New People: ${data.stats?.new_people || 'N/A'} (Avg: ${Math.round(data.stats?.avg_new_people || 0)} per service)
- New Christians: ${data.stats?.new_christians || 'N/A'} (Avg: ${Math.round(data.stats?.avg_new_christians || 0)} per service)
- Youth Attendance: ${data.stats?.youth_attendance || 'N/A'} (Avg: ${Math.round(data.stats?.avg_youth_attendance || 0)} per service)
- Kids Attendance: ${data.stats?.kids_attendance || 'N/A'} (Avg: ${Math.round(data.stats?.avg_kids_attendance || 0)} per service)
- Connect Groups: ${data.stats?.connect_groups || 'N/A'} (Avg: ${Math.round(data.stats?.avg_connect_groups || 0)} per service)
- Volunteers: ${data.stats?.volunteers || 'N/A'} (Avg: ${Math.round(data.stats?.avg_volunteers || 0)} per service)

**📈 Campus-Specific Insights**
- Campus Focus: ${campusName}
- Data Period: Last 7 Days
- Report Type: Weekend Performance Analysis`;
      
      setAiResponse(report);
    } catch (error) {
      setAiResponse('Error generating weekend report. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const generateGrowthAnalysis = async () => {
    try {
      setAiLoading(true);
      const selectedCampus = campus === 'all_campuses' ? 'all_campuses' : campus;
      const response = await fetch(`/api/dashboard_data_public?campus=${selectedCampus}&date_filter=last_12_months`);

      const data = await response.json();
      
      const campusName = campus === 'all_campuses' ? 'All Campuses' : (Array.isArray(campuses) ? campuses.find(c => c.id === campus)?.name : 'Selected Campus') || 'Selected Campus';
      
      const report = `# Growth Analysis Report (Last 12 Months) - ${campusName}

**📈 Growth Trends**
- Attendance Growth: ${data.stats?.total_attendance ? '📈 Growing' : '📊 Stable'}
- New People Trend: ${data.stats?.new_people > 0 ? '🆕 Consistent new people' : '🔄 Focus on outreach needed'}
- Salvation Impact: ${data.stats?.new_christians > 0 ? '✝️ Lives being changed' : '🙏 Pray for salvation opportunities'}

**🎯 Key Performance Indicators**
- Total Attendance: ${data.stats?.total_attendance?.toLocaleString() || 'N/A'} (Avg: ${Math.round(data.stats?.avg_attendance || 0)} per service)
- New People: ${data.stats?.new_people || 'N/A'} (Avg: ${Math.round(data.stats?.avg_new_people || 0)} per service)
- New Christians: ${data.stats?.new_christians || 'N/A'} (Avg: ${Math.round(data.stats?.avg_new_christians || 0)} per service)
- Youth Engagement: ${data.stats?.youth_attendance || 'N/A'} (Avg: ${Math.round(data.stats?.avg_youth_attendance || 0)} per service)
- Kids Ministry: ${data.stats?.kids_attendance || 'N/A'} (Avg: ${Math.round(data.stats?.avg_kids_attendance || 0)} per service)
- Connect Groups: ${data.stats?.connect_groups || 'N/A'} (Avg: ${Math.round(data.stats?.avg_connect_groups || 0)} per service)
- Volunteer Team: ${data.stats?.volunteers || 'N/A'} (Avg: ${Math.round(data.stats?.avg_volunteers || 0)} per service)

**🚀 Strategic Insights**
- Ministry Health: ${data.stats?.total_attendance > 1000 ? 'Excellent' : data.stats?.total_attendance > 500 ? 'Good' : 'Growing'}
- Outreach Effectiveness: ${data.stats?.new_people > 50 ? 'Strong' : data.stats?.new_people > 20 ? 'Moderate' : 'Needs improvement'}
- Discipleship Pipeline: ${data.stats?.new_christians > 10 ? 'Active' : 'Developing'}

**📈 Campus-Specific Insights**
- Campus Focus: ${campusName}
- Data Period: Last 12 Months
- Report Type: Growth & Trend Analysis`;
      
      setAiResponse(report);
    } catch (error) {
      setAiResponse('Error generating growth analysis. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const generateInsightsReport = async () => {
    try {
      setAiLoading(true);
      const selectedCampus = campus === 'all_campuses' ? 'all_campuses' : campus;
      const response = await fetch(`/api/dashboard_data_public?campus=${selectedCampus}&date_filter=last_30_days`);

      const data = await response.json();
      
      const campusName = campus === 'all_campuses' ? 'All Campuses' : (Array.isArray(campuses) ? campuses.find(c => c.id === campus)?.name : 'Selected Campus') || 'Selected Campus';
      
      const report = `# AI Insights Report (Last 30 Days) - ${campusName}

**🧠 AI-Powered Analysis**
- Campus Performance: ${data.stats?.total_attendance > 500 ? '🌟 Exceptional' : data.stats?.total_attendance > 300 ? '⭐ Strong' : '📈 Growing'}
- Growth Trajectory: ${data.stats?.new_people > 20 ? '🚀 Accelerating' : data.stats?.new_people > 10 ? '📈 Steady' : '🔄 Stable'}
- Ministry Health: ${data.stats?.new_christians > 5 ? '💪 Very Healthy' : data.stats?.new_christians > 2 ? '👍 Healthy' : '🌱 Developing'}

**🎯 Key Insights**
- Attendance Pattern: ${data.stats?.avg_attendance > 200 ? 'Consistent large gatherings' : data.stats?.avg_attendance > 100 ? 'Steady growth' : 'Building momentum'}
- New People Flow: ${data.stats?.new_people > 0 ? 'Active outreach working' : 'Focus on visitor engagement needed'}
- Salvation Impact: ${data.stats?.new_christians > 0 ? 'Gospel is bearing fruit' : 'Pray for harvest opportunities'}

**📊 Performance Metrics**
- Total Attendance: ${data.stats?.total_attendance?.toLocaleString() || 'N/A'} (Avg: ${Math.round(data.stats?.avg_attendance || 0)} per service)
- New People: ${data.stats?.new_people || 'N/A'} (Avg: ${Math.round(data.stats?.avg_new_people || 0)} per service)
- New Christians: ${data.stats?.new_christians || 'N/A'} (Avg: ${Math.round(data.stats?.avg_new_christians || 0)} per service)
- Youth Ministry: ${data.stats?.youth_attendance || 'N/A'} (Avg: ${Math.round(data.stats?.avg_youth_attendance || 0)} per service)
- Kids Ministry: ${data.stats?.kids_attendance || 'N/A'} (Avg: ${Math.round(data.stats?.avg_kids_attendance || 0)} per service)
- Connect Groups: ${data.stats?.connect_groups || 'N/A'} (Avg: ${Math.round(data.stats?.avg_connect_groups || 0)} per service)

**💡 Strategic Recommendations**
- ${data.stats?.new_people > 20 ? 'Maintain strong outreach momentum' : 'Increase visitor follow-up systems'}
- ${data.stats?.new_christians > 5 ? 'Celebrate and disciple new believers' : 'Focus on gospel presentation'}
- ${data.stats?.youth_attendance > 50 ? 'Youth ministry is thriving' : 'Develop youth engagement strategies'}

**📈 Campus-Specific Insights**
- Campus Focus: ${campusName}
- Data Period: Last 30 Days
- Report Type: AI-Powered Strategic Insights`;
      
      setAiResponse(report);
    } catch (error) {
      setAiResponse('Error generating insights report. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const generateAnnualReport = async () => {
    try {
      setAiLoading(true);
      const selectedCampus = campus === 'all_campuses' ? 'all_campuses' : campus;
      const response = await fetch(`/api/dashboard_data_public?campus=${selectedCampus}&date_filter=year_to_date`);
      const data = await response.json();
      
      const campusName = campus === 'all_campuses' ? 'All Campuses' : (Array.isArray(campuses) ? campuses.find(c => c.id === campus)?.name : 'Selected Campus') || 'Selected Campus';
      
      const report = `# Annual Report (Year to Date) - ${campusName}

**📊 Annual Overview**
- Total Attendance: ${data.stats?.total_attendance?.toLocaleString() || 'N/A'} (Avg: ${Math.round(data.stats?.avg_attendance || 0)} per service)
- Total New People: ${data.stats?.new_people?.toLocaleString() || 'N/A'} (Avg: ${Math.round(data.stats?.avg_new_people || 0)} per service)
- Total New Christians: ${data.stats?.new_christians?.toLocaleString() || 'N/A'} (Avg: ${Math.round(data.stats?.avg_new_christians || 0)} per service)

**🎯 Ministry Growth**
- Youth Ministry: ${data.stats?.youth_attendance?.toLocaleString() || 'N/A'} total (Avg: ${Math.round(data.stats?.avg_youth_attendance || 0)} per service)
- Kids Ministry: ${data.stats?.kids_attendance?.toLocaleString() || 'N/A'} total (Avg: ${Math.round(data.stats?.avg_kids_attendance || 0)} per service)
- Volunteer Team: ${data.stats?.volunteers?.toLocaleString() || 'N/A'} total (Avg: ${Math.round(data.stats?.avg_volunteers || 0)} per service)
- Connect Groups: ${data.stats?.connect_groups?.toLocaleString() || 'N/A'} total (Avg: ${Math.round(data.stats?.avg_connect_groups || 0)} per service)

**📈 Campus-Specific Insights**
- Campus Focus: ${campusName}
- Data Period: Year to Date
- Report Type: Annual Performance Analysis`;
      
      setAiResponse(report);
    } catch (error) {
      setAiResponse('Error generating annual report. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAIQuery = async () => {
    if (!aiQuery.trim()) return;
    
    setAiLoading(true);
    setAiResponse('');
    
    const query = aiQuery.toLowerCase();
    
    if (query.includes('weekend') || query.includes('weekly') || query.includes('7 days')) {
      await generateWeekendReport();
    } else if (query.includes('annual') || query.includes('year') || query.includes('yearly')) {
      await generateAnnualReport();
    } else if (query.includes('growth') || query.includes('trend') || query.includes('12 months')) {
      await generateGrowthAnalysis();
    } else if (query.includes('insight') || query.includes('analysis') || query.includes('30 days')) {
      await generateInsightsReport();
    } else if (query.includes('campus') || query.includes('location')) {
      // Generate a campus overview report
      const campusName = campus === 'all_campuses' ? 'All Campuses' : (Array.isArray(campuses) ? campuses.find(c => c.id === campus)?.name : 'Selected Campus') || 'Selected Campus';
      setAiResponse(`# Campus Overview - ${campusName}

**📍 Campus Information**
- Selected Campus: ${campusName}
- Campus ID: ${campus}
- Available Data: Weekend, Annual, Growth, and Insights reports

**📊 Quick Report Options**
- Type "weekend" for last 7 days performance
- Type "annual" for year-to-date overview  
- Type "growth" for 12-month trend analysis
- Type "insights" for AI-powered strategic analysis

**🎯 Campus-Specific Features**
- All reports automatically filter to selected campus
- Switch campuses to see different data views
- Compare performance across locations`);
    } else {
      // Default to weekend report
      await generateWeekendReport();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">
            <span className="text-4xl">⛪</span>
          </div>
          <div className="text-white text-2xl font-bold mb-2">Loading Dashboard</div>
          <div className="text-white/60 text-lg">Fetching ministry data...</div>
          <div className="mt-6 w-64 bg-white/10 rounded-full h-2 mx-auto">
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full animate-pulse"></div>
          </div>
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
          <div className="text-white/60 text-lg">Unable to load ministry data at this time</div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-6 bg-gradient-to-r from-blue-500 to-purple-500 text-white px-8 py-3 rounded-2xl font-semibold hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-blue-500/25"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const attendanceChartData = {
    labels: data.chart_data?.labels || [],
    datasets: [
      {
        label: 'Current Year',
        data: data.chart_data?.attendance || [],
        borderColor: '#62b4ff',
        backgroundColor: 'rgba(98, 180, 255, 0.1)',
        borderWidth: 3,
        tension: 0.4,
      },
      ...(showPreviousYear ? [{
        label: 'Previous Year',
        data: data.previous_year_data?.attendance || [],
        borderColor: '#e444b9',
        backgroundColor: 'rgba(228, 68, 185, 0.1)',
        borderWidth: 3,
        borderDash: [5, 5],
        tension: 0.4,
      }] : [])
    ]
  };

  const newPeopleChartData = {
    labels: data.chart_data?.labels || [],
    datasets: [
      {
        label: 'New People',
        data: data.chart_data?.new_people || [],
        borderColor: '#ffff5f',
        backgroundColor: 'rgba(255, 255, 95, 0.1)',
        borderWidth: 3,
        tension: 0.4,
      },
      {
        label: 'New Christians',
        data: data.chart_data?.new_christians || [],
        borderColor: '#ff8432',
        backgroundColor: 'rgba(255, 132, 50, 0.1)',
        borderWidth: 3,
        tension: 0.4,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        labels: {
          color: 'rgba(255, 255, 255, 0.8)',
          font: { size: 12 },
          padding: 20
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'rgba(255, 255, 255, 0.9)',
        bodyColor: 'rgba(255, 255, 255, 0.8)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          title: function(context) {
            return context[0].label;
          },
          label: function(context) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${value.toLocaleString()}`;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: 'rgba(255, 255, 255, 0.6)',
          font: { size: 11 }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
          drawBorder: false
        }
      },
      y: {
        ticks: {
          color: 'rgba(255, 255, 255, 0.6)',
          font: { size: 11 },
          callback: function(value) {
            return value.toLocaleString();
          }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
          drawBorder: false
        }
      }
    },
    elements: {
      point: {
        radius: 4,
        hoverRadius: 6,
        borderWidth: 2
      },
      line: {
        tension: 0.4
      }
    }
  };

  // Show loading while determining what to show
  if (loading || !userRole) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">
            <span className="text-4xl">⛪</span>
          </div>
          <div className="text-white text-2xl font-bold mb-2">Loading Dashboard</div>
          <div className="text-white/60 text-lg">Determining your access level...</div>
        </div>
      </div>
    );
  }

  // Show campus selector if needed (for senior leadership or users without a selected campus)
  if (showCampusSelector && !selectedCampus) {
    return <CampusSelector onCampusSelect={handleCampusSelect} userRole={userRole} userCampus={userCampus} />;
  }

  // Show campus dashboard if campus is selected (this is the main view everyone should see)
  if (selectedCampus) {
    return (
      <CampusDashboard 
        campusId={selectedCampus.id} 
        campusName={selectedCampus.name} 
        isRollup={selectedCampus.isRollup}
        onBackToSelector={handleBackToSelector}
      />
    );
  }

  // Fallback: Show campus selector if no campus is selected
  return <CampusSelector onCampusSelect={handleCampusSelect} userRole={userRole} userCampus={userCampus} />;
};

export default Dashboard;
