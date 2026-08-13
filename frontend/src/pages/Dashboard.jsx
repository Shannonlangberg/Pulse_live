import React, { useState, useEffect } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import CampusSelector from './CampusSelector';
import CampusDashboard from './CampusDashboard';
import { useSession } from '../lib/useSession';
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
  const session = useSession();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [campus, setCampus] = useState('');
  const [campuses, setCampuses] = useState([]);
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

  // Read session from the shared hook instead of fetching /api/session here
  useEffect(() => {
    if (session.loading || !session.authenticated) return;
    setCurrentUser({
      id: session.userId || 'unknown',
      username: session.username || 'User',
      full_name: session.fullName || 'User',
      role: session.role || 'user',
      campus: session.campus || 'all_campuses'
    });
    setUserRole(session.role || 'user');
    setUserCampus(session.campus || 'all_campuses');
  }, [session.loading, session.authenticated, session.role, session.campus]);

  useEffect(() => {
    // /api/campuses is already scoped to this user (role, assigned campus,
    // and any allowed_campuses override). Users with more than one campus get
    // the selector; a single campus goes straight to its dashboard.
    if (!userRole || campuses.length === 0) return;
    const realCampuses = campuses.filter(c => c.id !== 'all_campuses');
    if (session.permissions.view_all_campuses || realCampuses.length > 1) {
      setShowCampusSelector(true);
    } else if (realCampuses.length === 1) {
      const only = realCampuses[0];
      setSelectedCampus({
        id: only.id,
        name: only.name || only.display_name || userCampus,
        isRollup: false
      });
    } else {
      setShowCampusSelector(true);
    }
  }, [userRole, userCampus, campuses, session.permissions.view_all_campuses]);

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

  const fetchCampuses = async () => {
    try {
      // /api/campuses is already scoped server-side to the campuses this user
      // may act on, and returns a per-user `default` campus id.
      const response = await fetch('/api/campuses', {
        credentials: 'include',
        cache: 'no-store'
      });
      const result = await response.json();
      const campusesList = result.campuses || [];

      if (Array.isArray(campusesList)) {
        setCampuses(campusesList);
        if (!campus && campusesList.length > 0) {
          // Prefer the server-provided default (correct per-user; campus-scoped
          // users never default to all_campuses, which the API would 403).
          const defaultCampus =
            (result.default && campusesList.find(c => c.id === result.default)) ||
            campusesList[0];
          setCampus(result.default || defaultCampus.id);
        }
      }
    } catch (error) {
      console.error('Error fetching campuses:', error);
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
      
      const response = await fetch(`/api/dashboard_data_public?${params}`, {
        credentials: 'include'
      });
      const result = await response.json();
      if (!response.ok) {
        console.error('[Dashboard] dashboard_data_public error:', result?.error || response.status);
        setData(null);
      } else {
        setData(result);
      }
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
      const response = await fetch(`/api/dashboard_data_public?campus=${selectedCampus}&date_filter=last_7_days`, { credentials: 'include' });
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
      const response = await fetch(`/api/dashboard_data_public?campus=${selectedCampus}&date_filter=last_12_months`, { credentials: 'include' });

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
      const response = await fetch(`/api/dashboard_data_public?campus=${selectedCampus}&date_filter=last_30_days`, { credentials: 'include' });

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
      const response = await fetch(`/api/dashboard_data_public?campus=${selectedCampus}&date_filter=year_to_date`, { credentials: 'include' });
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

  // Permission gate — driven by the server-resolved permissions object.
  // No role-name checks, no redirects: just a clear panel.
  if (!session.loading && !session.permissions.dashboard_access) {
    return (
      <div className="min-h-screen bg-fc-cream flex items-center justify-center">
        <div className="text-center max-w-md px-6 fc-card p-8">
          <div className="w-20 h-20 bg-fc-wash-peach border border-fc-wash-peach-border rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🔒</span>
          </div>
          <div className="text-fc-midnight text-2xl font-semibold mb-2">You don't have dashboard access</div>
          <div className="text-fc-brown text-lg">
            Ask an administrator to grant dashboard access via the Role Manager if you need it.
          </div>
        </div>
      </div>
    );
  }

  if (loading || session.loading) {
    return (
      <div className="min-h-screen bg-fc-cream flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-fc-wash-mint border border-fc-wash-mint-border rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">
            <span className="text-4xl">⛪</span>
          </div>
          <div className="text-fc-midnight text-2xl font-semibold mb-2">Loading Dashboard</div>
          <div className="text-fc-brown text-lg">Fetching ministry data...</div>
          <div className="mt-6 w-64 bg-fc-cream2 rounded-full h-2 mx-auto">
            <div className="bg-fc-olive h-2 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-fc-cream flex items-center justify-center">
        <div className="text-center fc-card p-8">
          <div className="w-20 h-20 bg-fc-wash-peach border border-fc-wash-peach-border rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">⚠️</span>
          </div>
          <div className="text-fc-midnight text-2xl font-semibold mb-2">No Data Available</div>
          <div className="text-fc-brown text-lg">Unable to load ministry data at this time</div>
          <button
            onClick={() => window.location.reload()}
            className="fc-btn-primary mt-6 px-8 py-3"
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
        borderColor: '#639922',
        backgroundColor: 'rgba(99, 153, 34, 0.1)',
        borderWidth: 3,
        tension: 0.4,
      },
      ...(showPreviousYear ? [{
        label: 'Previous Year',
        data: data.previous_year_data?.attendance || [],
        borderColor: '#C5C6A4',
        backgroundColor: 'rgba(197, 198, 164, 0.1)',
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
        borderColor: '#C4A44A',
        backgroundColor: 'rgba(196, 164, 74, 0.1)',
        borderWidth: 3,
        tension: 0.4,
      },
      {
        label: 'New Christians',
        data: data.chart_data?.new_christians || [],
        borderColor: '#C45236',
        backgroundColor: 'rgba(196, 82, 54, 0.1)',
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
          color: '#50482E',
          font: { size: 12 },
          padding: 20
        }
      },
      tooltip: {
        backgroundColor: '#1C1C16',
        titleColor: '#FAF9F4',
        bodyColor: '#F0EDE4',
        borderColor: 'rgba(250, 249, 244, 0.15)',
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
          color: '#50482E',
          font: { size: 11 }
        },
        grid: {
          color: '#F0EDE4',
          drawBorder: false
        }
      },
      y: {
        ticks: {
          color: '#50482E',
          font: { size: 11 },
          callback: function(value) {
            return value.toLocaleString();
          }
        },
        grid: {
          color: '#F0EDE4',
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
      <div className="min-h-screen bg-fc-cream flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-fc-wash-mint border border-fc-wash-mint-border rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">
            <span className="text-4xl">⛪</span>
          </div>
          <div className="text-fc-midnight text-2xl font-semibold mb-2">Loading Dashboard</div>
          <div className="text-fc-brown text-lg">Determining your access level...</div>
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
        isGlobal={selectedCampus.isGlobal}
        onBackToSelector={handleBackToSelector}
      />
    );
  }

  // Fallback: Show campus selector if no campus is selected
  return <CampusSelector onCampusSelect={handleCampusSelect} userRole={userRole} userCampus={userCampus} />;
};

export default Dashboard;
