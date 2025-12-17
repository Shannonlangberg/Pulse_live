import React, { useState, useEffect } from 'react';
import { CalendarIcon, CurrencyDollarIcon, BuildingOfficeIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';

const Finance = () => {
  const [selectedDate, setSelectedDate] = useState('');
  const [campuses, setCampuses] = useState([]);
  const [titheData, setTitheData] = useState({});
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ message: '', type: '' });

  useEffect(() => {
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
    
    // Load campuses
    loadCampuses();
  }, []);

  useEffect(() => {
    if (selectedDate && campuses.length > 0) {
      loadExistingData();
    }
  }, [selectedDate, campuses]);

  const loadCampuses = async () => {
    try {
      const response = await fetch('/api/campuses', {
        credentials: 'include',
      });
      const data = await response.json();
      
      // Filter out "all_campuses" and sort by name
      const filteredCampuses = data.campuses
        .filter(campus => campus.id !== 'all_campuses')
        .sort((a, b) => a.name.localeCompare(b.name));
      
      setCampuses(filteredCampuses);
    } catch (error) {
      console.error('Error loading campuses:', error);
    }
  };

  const loadExistingData = async () => {
    try {
      const response = await fetch(`/api/finance/existing?date=${selectedDate}`, {
        credentials: 'include',
      });
      const data = await response.json();
      
      if (data.success) {
        setTitheData(data.existing_data || {});
      }
    } catch (error) {
      console.error('Error loading existing data:', error);
    }
  };

  const handleTitheChange = (campusId, field, value) => {
    setTitheData(prev => ({
      ...prev,
      [campusId]: {
        ...prev[campusId],
        [field]: value
      }
    }));
  };
  
  const getCampusTotal = (campusId) => {
    const campus = titheData[campusId] || {};
    const general = parseFloat(campus.general || 0);
    const trust = parseFloat(campus.trust || 0);
    const online = parseFloat(campus.online || 0);
    const text = parseFloat(campus.text || 0);
    return general + trust + online + text;
  };

  const handleSubmit = async () => {
    if (!selectedDate) {
      setStatus({ message: 'Please select a service date', type: 'error' });
      return;
    }

    // Check if at least one campus has tithe data
    const hasTitheData = Object.keys(titheData).some(campusId => {
      const total = getCampusTotal(campusId);
      return total > 0;
    });
    if (!hasTitheData) {
      setStatus({ message: 'Please enter tithe data for at least one campus', type: 'error' });
      return;
    }

    setLoading(true);
    setStatus({ message: '', type: '' });

    try {
      const response = await fetch('/api/finance/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          date: selectedDate,
          tithe_data: titheData
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStatus({ message: result.message || 'Tithe data submitted successfully!', type: 'success' });
        // Reload existing data to show updated values
        await loadExistingData();
      } else {
        console.error('Finance submit error:', result);
        const errorMsg = result.error || result.message || 'Failed to submit tithe data';
        setStatus({ message: errorMsg, type: 'error' });
      }
    } catch (error) {
      console.error('Error submitting tithe data:', error);
      setStatus({ message: 'Network error. Please try again.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    if (!value) return '';
    const num = parseFloat(value);
    return isNaN(num) ? '' : Math.round(num).toString();
  };

  const getStatusIcon = () => {
    switch (status.type) {
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'error':
        return <ExclamationCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Finance Dashboard</h1>
              <p className="text-slate-400">Tithe Logging System</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-slate-400">Service Date</p>
                <p className="text-white font-medium">{selectedDate}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Date Selection */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
            <div className="mb-4">
              <label htmlFor="date" className="block text-sm font-medium text-slate-300 mb-2">
                Service Date
              </label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="date"
                  id="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Campus Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {campuses.map((campus) => (
            <div key={campus.id} className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-slate-600/70 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <BuildingOfficeIcon className="h-6 w-6 text-blue-400 mr-3" />
                  <h3 className="text-lg font-semibold text-white">{campus.name}</h3>
                </div>
                {getCampusTotal(campus.id) > 0 && (
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Total</div>
                    <div className="text-lg font-bold text-green-400">
                      ${getCampusTotal(campus.id).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Tithe Breakdown Fields - Order matches Google Sheets: General, Trust, Online, Text */}
              <div className="grid grid-cols-2 gap-3">
                {/* General */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    General
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={titheData[campus.id]?.general || ''}
                      onChange={(e) => handleTitheChange(campus.id, 'general', e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-6 pr-3 py-2 text-sm bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Trust */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Trust
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={titheData[campus.id]?.trust || ''}
                      onChange={(e) => handleTitheChange(campus.id, 'trust', e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-6 pr-3 py-2 text-sm bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Online */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Online
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={titheData[campus.id]?.online || ''}
                      onChange={(e) => handleTitheChange(campus.id, 'online', e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-6 pr-3 py-2 text-sm bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Text */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Text
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={titheData[campus.id]?.text || ''}
                      onChange={(e) => handleTitheChange(campus.id, 'text', e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-6 pr-3 py-2 text-sm bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Submit Button */}
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? 'Submitting...' : 'Submit Tithe Data'}
          </button>
        </div>

        {/* Status Message */}
        {status.message && (
          <div className="max-w-2xl mx-auto mt-6">
            <div className={`flex items-center p-4 rounded-lg ${
              status.type === 'success' 
                ? 'bg-green-900/20 border border-green-500/30 text-green-400' 
                : 'bg-red-900/20 border border-red-500/30 text-red-400'
            }`}>
              {getStatusIcon()}
              <span className="ml-2">{status.message}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Finance; 