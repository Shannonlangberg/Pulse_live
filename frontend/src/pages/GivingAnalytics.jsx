import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CurrencyDollarIcon, 
  BuildingOfficeIcon, 
  ChartBarIcon,
  QrCodeIcon,
  DevicePhoneMobileIcon,
  GlobeAltIcon,
  HandRaisedIcon,
  CalendarIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
import QRCode from 'qrcode';
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
  Legend
);

const GivingAnalytics = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [qrAnalytics, setQrAnalytics] = useState(null);
  const [campuses, setCampuses] = useState([]);
  const [qrCodes, setQrCodes] = useState([]);
  const [qrCodeImages, setQrCodeImages] = useState({});
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedQRCode, setSelectedQRCode] = useState(null);
  
  // Filters
  const [selectedCampus, setSelectedCampus] = useState('all_campuses');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedSource, setSelectedSource] = useState('all');
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'qr', 'transactions'

  useEffect(() => {
    loadCampuses();
    loadQRCodes();
  }, []);

  useEffect(() => {
    if (campuses.length > 0) {
      loadAnalytics();
    }
  }, [selectedCampus, selectedType, selectedSource, startDate, endDate, campuses]);

  useEffect(() => {
    loadQRAnalytics();
  }, [selectedCampus, startDate, endDate]);

  const loadCampuses = async () => {
    try {
      const response = await fetch('/api/campuses', { credentials: 'include' });
      const data = await response.json();
      setCampuses(data.campuses?.filter(c => c.id !== 'all_campuses') || []);
    } catch (error) {
      console.error('Error loading campuses:', error);
    }
  };

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCampus !== 'all_campuses') params.append('campus', selectedCampus);
      if (selectedType !== 'all') params.append('giving_type', selectedType);
      if (selectedSource !== 'all') params.append('source', selectedSource);
      params.append('start_date', startDate);
      params.append('end_date', endDate);

      const response = await fetch(`/api/giving/analytics?${params}`, {
        credentials: 'include'
      });
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadQRAnalytics = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCampus !== 'all_campuses') params.append('campus', selectedCampus);
      params.append('start_date', startDate);
      params.append('end_date', endDate);

      const response = await fetch(`/api/giving/analytics/qr-scans?${params}`, {
        credentials: 'include'
      });
      const data = await response.json();
      setQrAnalytics(data);
    } catch (error) {
      console.error('Error loading QR analytics:', error);
    }
  };

  const loadQRCodes = async () => {
    try {
      const response = await fetch('/api/giving/qr-codes', {
        credentials: 'include'
      });
      const data = await response.json();
      setQrCodes(data.qr_codes || []);
    } catch (error) {
      console.error('Error loading QR codes:', error);
    }
  };

  const handleCreateQRCode = async (codeType = 'qr') => {
    const campus = prompt('Enter campus:');
    if (!campus) return;
    
    const zone = prompt('Enter zone (optional):') || null;
    const seatNumber = prompt('Enter seat number (optional):') || null;
    const count = parseInt(prompt('How many codes?', '1')) || 1;

    try {
      const response = await fetch('/api/giving/qr-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          campus, 
          zone, 
          seat_number: seatNumber, 
          count,
          type: codeType  // 'qr' or 'nfc'
        })
      });
      const data = await response.json();
      if (data.success) {
        alert(`Created ${count} ${codeType.toUpperCase()} code(s)`);
        loadQRCodes();
        // Generate QR images for new codes
        generateQRImages(data.qr_codes || []);
      }
    } catch (error) {
      alert('Error creating codes');
    }
  };

  const generateQRImages = async (codes) => {
    const images = {};
    for (const code of codes) {
      try {
        const url = `${window.location.origin}/give?${code.qr_code_id.startsWith('nfc_') ? 'nfc' : 'qr'}=${code.qr_code_id}`;
        const qrImage = await QRCode.toDataURL(url, {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
    }
        });
        images[code.qr_code_id] = qrImage;
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    }
    setQrCodeImages(prev => ({ ...prev, ...images }));
  };

  useEffect(() => {
    // Generate QR images for existing codes
    if (qrCodes.length > 0) {
      const codesToGenerate = qrCodes.filter(q => !qrCodeImages[q.qr_code_id]);
      if (codesToGenerate.length > 0) {
        generateQRImages(codesToGenerate);
      }
    }
  }, [qrCodes]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const sourceIcon = (source) => {
    switch (source) {
      case 'app': return <DevicePhoneMobileIcon className="h-5 w-5" />;
      case 'qr_code': case 'tap_to_give': return <QrCodeIcon className="h-5 w-5" />;
      case 'web': return <GlobeAltIcon className="h-5 w-5" />;
      default: return <HandRaisedIcon className="h-5 w-5" />;
    }
  };

  const sourceLabel = (source) => {
    switch (source) {
      case 'app': return 'Mobile App';
      case 'qr_code': case 'tap_to_give': return 'Tap to Give (QR)';
      case 'web': return 'Web';
      case 'manual': return 'Manual';
      default: return source;
    }
  };

  if (loading && !analytics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Giving Analytics</h1>
              <p className="text-slate-400">Track giving across all campuses and sources</p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Campus</label>
                <select
                  value={selectedCampus}
                  onChange={(e) => setSelectedCampus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white"
                >
                  <option value="all_campuses">All Campuses</option>
                  {campuses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white"
                >
                  <option value="all">All Types</option>
                  <option value="tithe">Tithe</option>
                  <option value="offering">Offering</option>
                  <option value="missions">Missions</option>
                  <option value="event">Event</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Source</label>
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white"
                >
                  <option value="all">All Sources</option>
                  <option value="app">Mobile App</option>
                  <option value="qr_code">QR Code</option>
                  <option value="tap_to_give">Tap to Give</option>
                  <option value="web">Web</option>
                  <option value="manual">Manual</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white"
                />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-2 mb-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('qr')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'qr'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              Tap to Give (QR)
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'transactions'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              Transactions
            </button>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && analytics && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 backdrop-blur-sm rounded-xl p-6 border border-green-400/20">
                <div className="flex items-center justify-between mb-2">
                  <CurrencyDollarIcon className="h-8 w-8 text-green-400" />
                </div>
                <div className="text-sm text-slate-300 mb-1">Total Giving</div>
                <div className="text-2xl font-bold text-white">
                  {formatCurrency(analytics.summary?.total_amount || 0)}
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 backdrop-blur-sm rounded-xl p-6 border border-blue-400/20">
                <div className="flex items-center justify-between mb-2">
                  <ChartBarIcon className="h-8 w-8 text-blue-400" />
                </div>
                <div className="text-sm text-slate-300 mb-1">Transactions</div>
                <div className="text-2xl font-bold text-white">
                  {(analytics.summary?.transaction_count || 0).toLocaleString()}
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 backdrop-blur-sm rounded-xl p-6 border border-purple-400/20">
                <div className="flex items-center justify-between mb-2">
                  <CurrencyDollarIcon className="h-8 w-8 text-purple-400" />
                </div>
                <div className="text-sm text-slate-300 mb-1">Average Gift</div>
                <div className="text-2xl font-bold text-white">
                  {formatCurrency(analytics.summary?.average_transaction || 0)}
                </div>
              </div>

              <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 backdrop-blur-sm rounded-xl p-6 border border-orange-400/20">
                <div className="flex items-center justify-between mb-2">
                  <BuildingOfficeIcon className="h-8 w-8 text-orange-400" />
                </div>
                <div className="text-sm text-slate-300 mb-1">Active Campuses</div>
                <div className="text-2xl font-bold text-white">
                  {Object.keys(analytics.breakdowns?.by_campus || {}).length}
                </div>
              </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* By Campus */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                <h3 className="text-xl font-bold text-white mb-4">By Campus</h3>
                {Object.keys(analytics.breakdowns?.by_campus || {}).length > 0 ? (
                  <Bar
                    data={{
                      labels: Object.keys(analytics.breakdowns.by_campus),
                      datasets: [{
                        label: 'Amount',
                        data: Object.values(analytics.breakdowns.by_campus),
                        backgroundColor: 'rgba(99, 102, 241, 0.8)',
                        borderColor: 'rgba(99, 102, 241, 1)',
                        borderWidth: 2
                      }]
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          callbacks: {
                            label: (context) => formatCurrency(context.parsed.y)
                          }
                        }
                      },
                      scales: {
                        y: {
                          ticks: {
                            color: 'rgba(255, 255, 255, 0.6)',
                            callback: (value) => '$' + value.toLocaleString()
                          },
                          grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        },
                        x: {
                          ticks: { color: 'rgba(255, 255, 255, 0.6)' },
                          grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        }
                      }
                    }}
                  />
                ) : (
                  <div className="text-slate-400 text-center py-8">No data</div>
                )}
              </div>

              {/* By Type */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                <h3 className="text-xl font-bold text-white mb-4">By Type</h3>
                {Object.keys(analytics.breakdowns?.by_type || {}).length > 0 ? (
                  <Doughnut
                    data={{
                      labels: Object.keys(analytics.breakdowns.by_type),
                      datasets: [{
                        data: Object.values(analytics.breakdowns.by_type),
                        backgroundColor: [
                          'rgba(99, 102, 241, 0.8)',
                          'rgba(139, 92, 246, 0.8)',
                          'rgba(16, 185, 129, 0.8)',
                          'rgba(245, 158, 11, 0.8)'
                        ]
                      }]
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: { color: 'rgba(255, 255, 255, 0.8)' }
                        },
                        tooltip: {
                          callbacks: {
                            label: (context) => formatCurrency(context.parsed)
                          }
                        }
                      }
                    }}
                  />
                ) : (
                  <div className="text-slate-400 text-center py-8">No data</div>
                )}
              </div>
            </div>

            {/* By Source */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                <h3 className="text-xl font-bold text-white mb-4">By Source</h3>
                {Object.keys(analytics.breakdowns?.by_source || {}).length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(analytics.breakdowns.by_source).map(([source, data]) => (
                      <div key={source} className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="text-2xl">
                            {sourceIcon(source)}
                          </div>
                          <div>
                            <div className="text-white font-semibold">{sourceLabel(source)}</div>
                            <div className="text-sm text-slate-400">{data.count} transactions</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-white">{formatCurrency(data.amount)}</div>
                          <div className="text-xs text-slate-400">
                            {((data.amount / (analytics.summary?.total_amount || 1)) * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-400 text-center py-8">No data</div>
                )}
              </div>

              {/* Daily Trend */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                <h3 className="text-xl font-bold text-white mb-4">Daily Trend</h3>
                {Object.keys(analytics.breakdowns?.by_date || {}).length > 0 ? (
                  <Line
                    data={{
                      labels: Object.keys(analytics.breakdowns.by_date).slice(-30).map(d => 
                        new Date(d).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
                      ),
                      datasets: [{
                        label: 'Amount',
                        data: Object.values(analytics.breakdowns.by_date).slice(-30).map(d => d.amount),
                        borderColor: 'rgba(99, 102, 241, 1)',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        fill: true,
                        tension: 0.4
                      }]
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          callbacks: {
                            label: (context) => formatCurrency(context.parsed.y)
                          }
                        }
                      },
                      scales: {
                        y: {
                          ticks: {
                            color: 'rgba(255, 255, 255, 0.6)',
                            callback: (value) => '$' + value.toLocaleString()
                          },
                          grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        },
                        x: {
                          ticks: { color: 'rgba(255, 255, 255, 0.6)' },
                          grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        }
                      }
                    }}
                  />
                ) : (
                  <div className="text-slate-400 text-center py-8">No data</div>
                )}
              </div>
            </div>
          </>
        )}

        {/* QR Analytics Tab */}
        {activeTab === 'qr' && (
          <>
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">Tap to Give Analytics</h2>
              <div className="flex gap-3">
              <button
                  onClick={() => handleCreateQRCode('qr')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-2"
              >
                  <QrCodeIcon className="h-5 w-5" />
                Generate QR Codes
              </button>
                <button
                  onClick={() => handleCreateQRCode('nfc')}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold flex items-center gap-2"
                >
                  <DevicePhoneMobileIcon className="h-5 w-5" />
                  Generate NFC Tags
                </button>
              </div>
            </div>

            {/* QR Stats */}
            {qrAnalytics && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                  <div className="text-sm text-slate-300 mb-2">Total Scans</div>
                  <div className="text-3xl font-bold text-white">{qrAnalytics.total_scans || 0}</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                  <div className="text-sm text-slate-300 mb-2">Active QR Codes</div>
                  <div className="text-3xl font-bold text-white">{qrCodes.filter(q => q.is_active).length}</div>
                </div>
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                  <div className="text-sm text-slate-300 mb-2">QR Codes Used</div>
                  <div className="text-3xl font-bold text-white">{Object.keys(qrAnalytics.qr_codes_used || {}).length}</div>
                </div>
              </div>
            )}

            {/* Scans by Service Date */}
            {qrAnalytics && qrAnalytics.by_service_date && qrAnalytics.by_service_date.length > 0 && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 mb-6">
                <h3 className="text-xl font-bold text-white mb-4">Taps per Service</h3>
                <Bar
                  data={{
                    labels: qrAnalytics.by_service_date.map(d => 
                      new Date(d.date).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
                    ),
                    datasets: [
                      {
                        label: 'Scans',
                        data: qrAnalytics.by_service_date.map(d => d.scans),
                        backgroundColor: 'rgba(99, 102, 241, 0.8)'
                      },
                      {
                        label: 'Gifts',
                        data: qrAnalytics.by_service_date.map(d => d.gifts),
                        backgroundColor: 'rgba(16, 185, 129, 0.8)'
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: {
                        labels: { color: 'rgba(255, 255, 255, 0.8)' }
                      }
                    },
                    scales: {
                      y: {
                        ticks: { color: 'rgba(255, 255, 255, 0.6)' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                      },
                      x: {
                        ticks: { color: 'rgba(255, 255, 255, 0.6)' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                      }
                    }
                  }}
                />
              </div>
            )}

            {/* QR Codes List */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
              <h3 className="text-xl font-bold text-white mb-4">QR Codes</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 text-slate-300">Type</th>
                      <th className="text-left py-3 px-4 text-slate-300">Campus</th>
                      <th className="text-left py-3 px-4 text-slate-300">Zone</th>
                      <th className="text-left py-3 px-4 text-slate-300">Seat</th>
                      <th className="text-left py-3 px-4 text-slate-300">Scans</th>
                      <th className="text-left py-3 px-4 text-slate-300">Last Scan</th>
                      <th className="text-left py-3 px-4 text-slate-300">QR Code</th>
                      <th className="text-left py-3 px-4 text-slate-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qrCodes.filter(q => q.is_active).map(qr => (
                      <tr key={qr.id} className="border-b border-slate-700/50">
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            qr.qr_code_id.startsWith('nfc_') 
                              ? 'bg-purple-500/20 text-purple-300' 
                              : 'bg-blue-500/20 text-blue-300'
                          }`}>
                            {qr.qr_code_id.startsWith('nfc_') ? 'NFC' : 'QR'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-white">{qr.campus}</td>
                        <td className="py-3 px-4 text-slate-300">{qr.zone || '-'}</td>
                        <td className="py-3 px-4 text-slate-300">{qr.seat_number || '-'}</td>
                        <td className="py-3 px-4 text-white font-semibold">{qr.scan_count}</td>
                        <td className="py-3 px-4 text-slate-300">
                          {qr.last_scan_at ? new Date(qr.last_scan_at).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="py-3 px-4">
                          {qrCodeImages[qr.qr_code_id] ? (
                            <button
                              onClick={() => {
                                setSelectedQRCode(qr);
                                setShowQRModal(true);
                              }}
                              className="text-blue-400 hover:text-blue-300 text-sm underline"
                            >
                              View QR Code
                            </button>
                          ) : (
                            <span className="text-slate-500 text-sm">Generating...</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <a
                            href={`${window.location.origin}/give?${qr.qr_code_id.startsWith('nfc_') ? 'nfc' : 'qr'}=${qr.qr_code_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-sm"
                          >
                            Test Link
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* QR Code Modal */}
        {showQRModal && selectedQRCode && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">
                  {selectedQRCode.qr_code_id.startsWith('nfc_') ? 'NFC Tag' : 'QR Code'}
                </h3>
                <button
                  onClick={() => {
                    setShowQRModal(false);
                    setSelectedQRCode(null);
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              {selectedQRCode.qr_code_id.startsWith('nfc_') ? (
                // NFC Tag - Show URL to program
                <div className="text-center">
                  <div className="mb-4">
                    <DevicePhoneMobileIcon className="h-16 w-16 text-purple-400 mx-auto mb-3" />
                    <p className="text-slate-300 text-sm mb-2">
                      {selectedQRCode.campus} - {selectedQRCode.zone || 'No zone'} - {selectedQRCode.seat_number || 'No seat'}
                    </p>
                    <p className="text-slate-400 text-xs mb-4">
                      Program this URL into your NFC tag:
                    </p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4 mb-4">
                    <code className="text-green-400 text-sm break-all">
                      {`${window.location.origin}/give?nfc=${selectedQRCode.qr_code_id}`}
                    </code>
                  </div>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/give?nfc=${selectedQRCode.qr_code_id}`;
                        navigator.clipboard.writeText(url);
                        alert('URL copied to clipboard!');
                      }}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold"
                    >
                      Copy URL
                    </button>
                  </div>
                  <p className="text-slate-500 text-xs mt-4">
                    Use an NFC writer app to program this URL into your NFC tag
                  </p>
                </div>
              ) : qrCodeImages[selectedQRCode.qr_code_id] ? (
                // QR Code - Show image
                <div className="text-center">
                  <div className="bg-white p-4 rounded-lg inline-block mb-4">
                    <img 
                      src={qrCodeImages[selectedQRCode.qr_code_id]} 
                      alt="QR Code" 
                      className="w-64 h-64"
                    />
                  </div>
                  <p className="text-slate-300 text-sm mb-2">
                    {selectedQRCode.campus} - {selectedQRCode.zone || 'No zone'} - {selectedQRCode.seat_number || 'No seat'}
                  </p>
                  <p className="text-slate-400 text-xs mb-4">
                    Scan this QR code to give
                  </p>
                  <a
                    href={qrCodeImages[selectedQRCode.qr_code_id]}
                    download={`${selectedQRCode.qr_code_id}.png`}
                    className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
                  >
                    Download QR Code
                  </a>
                </div>
              ) : (
                <div className="text-center text-slate-400">
                  {selectedQRCode.qr_code_id.startsWith('nfc_') ? 'Loading NFC tag info...' : 'Generating QR code...'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && analytics && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
            <h3 className="text-xl font-bold text-white mb-4">Recent Transactions</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-300">Date</th>
                    <th className="text-left py-3 px-4 text-slate-300">Person</th>
                    <th className="text-left py-3 px-4 text-slate-300">Campus</th>
                    <th className="text-left py-3 px-4 text-slate-300">Type</th>
                    <th className="text-left py-3 px-4 text-slate-300">Source</th>
                    <th className="text-right py-3 px-4 text-slate-300">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.transactions?.map(t => (
                    <tr key={t.id} className="border-b border-slate-700/50">
                      <td className="py-3 px-4 text-white">
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-white">{t.person_name || '-'}</td>
                      <td className="py-3 px-4 text-slate-300">{t.campus}</td>
                      <td className="py-3 px-4 text-slate-300 capitalize">{t.giving_type}</td>
                      <td className="py-3 px-4 text-slate-300">{sourceLabel(t.source)}</td>
                      <td className="py-3 px-4 text-right text-white font-semibold">
                        {formatCurrency(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {analytics.total_transactions > analytics.transactions?.length && (
              <div className="mt-4 text-center text-slate-400">
                Showing last {analytics.transactions?.length} of {analytics.total_transactions} transactions
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GivingAnalytics;

