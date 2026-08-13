import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownTrayIcon, DocumentArrowDownIcon, CurrencyDollarIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';

const DataExport = () => {
  const [loading, setLoading] = useState(false);
  const [exportType, setExportType] = useState('attendance');
  const [dateRange, setDateRange] = useState('last_12_months');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedCampus, setSelectedCampus] = useState('all_campuses');

  const campuses = [
    { id: 'all_campuses', name: 'All Campuses' },
    { id: 'Paradise', name: 'Paradise' },
    { id: 'South', name: 'South' },
    { id: 'Salisbury', name: 'Salisbury' },
    { id: 'Adelaide City', name: 'Adelaide City' },
    { id: 'Mount Barker', name: 'Mount Barker' },
    { id: 'Copper Coast', name: 'Copper Coast' },
    { id: 'Clare Valley', name: 'Clare Valley' },
    { id: 'Victor Harbor', name: 'Victor Harbor' }
  ];

  const exportTypes = [
    { id: 'attendance', name: 'Attendance Data', icon: ClipboardDocumentListIcon, description: 'Export all attendance records' },
    { id: 'finance', name: 'Financial Data', icon: CurrencyDollarIcon, description: 'Export tithe and giving records' },
  ];

  const dateRanges = [
    { value: 'last_month', label: 'Last Month' },
    { value: 'last_3_months', label: 'Last 3 Months' },
    { value: 'last_6_months', label: 'Last 6 Months' },
    { value: 'last_12_months', label: 'Last 12 Months' },
    { value: 'ytd', label: 'Year to Date' },
    { value: 'custom', label: 'Custom Range' }
  ];

  const handleExport = async () => {
    setLoading(true);

    try {
      let url = `/api/export/${exportType}?`;

      // Add parameters
      const params = new URLSearchParams();
      if (exportType !== 'users') {
        params.append('campus', selectedCampus);
        params.append('date_filter', dateRange);
        if (dateRange === 'custom' && customStartDate && customEndDate) {
          params.append('start_date', customStartDate);
          params.append('end_date', customEndDate);
        }
      }

      url += params.toString();

      const response = await fetch(url, {
        credentials: 'include'
      });

      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;

        // Get filename from response header or generate one
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `export_${exportType}_${new Date().toISOString().split('T')[0]}.csv`;
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
          if (filenameMatch) filename = filenameMatch[1];
        }

        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);

        alert('Export completed successfully!');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to export data');
      }
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-fc-cream p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="fc-label mb-2">Reporting</div>
          <h1 className="fc-display fc-display-md mb-2 flex items-center gap-3">
            <ArrowDownTrayIcon className="w-9 h-9 text-fc-olive" />
            Data Export
          </h1>
          <p className="text-fc-brown">Export data for reporting and analysis</p>
          <p className="mt-3 text-sm text-fc-brown/70">
            For quarterly / YTD attendance summaries (PDF/CSV from the database), use{' '}
            <Link to="/reports" className="text-fc-olive hover:underline">
              Reports
            </Link>
            .
          </p>
        </div>

        {/* Export Type Selection */}
        <div className="mb-8">
          <div className="fc-label mb-4">Select data type</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exportTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setExportType(type.id)}
                className={`p-6 rounded-xl border transition-colors text-left ${
                  exportType === type.id
                    ? 'bg-fc-wash-mint border-fc-olive'
                    : 'bg-white border-fc-cream2 hover:border-fc-olive/50'
                }`}
              >
                <type.icon className={`w-8 h-8 mb-3 ${exportType === type.id ? 'text-fc-olive' : 'text-fc-brown'}`} />
                <h3 className="text-lg font-semibold text-fc-midnight mb-1">{type.name}</h3>
                <p className="text-sm text-fc-brown">{type.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        {exportType !== 'users' && (
          <div className="fc-card p-6 mb-8">
            <div className="fc-label mb-4">Filters</div>

            {/* Campus Selection */}
            <div className="mb-4">
              <label className="fc-label text-[11px] block mb-2">
                Campus
              </label>
              <select
                value={selectedCampus}
                onChange={(e) => setSelectedCampus(e.target.value)}
                className="fc-input"
              >
                {campuses.map(campus => (
                  <option key={campus.id} value={campus.id}>{campus.name}</option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div className="mb-4">
              <label className="fc-label text-[11px] block mb-2">
                Date range
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="fc-input"
              >
                {dateRanges.map(range => (
                  <option key={range.value} value={range.value}>{range.label}</option>
                ))}
              </select>
            </div>

            {/* Custom Date Range */}
            {dateRange === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="fc-label text-[11px] block mb-2">
                    Start date
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="fc-input"
                  />
                </div>
                <div>
                  <label className="fc-label text-[11px] block mb-2">
                    End date
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="fc-input"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Export Button */}
        <div className="fc-card p-6">
          <div className="fc-label mb-4">Export options</div>
          <p className="text-fc-brown mb-6">
            Data will be exported in CSV format, compatible with Excel and Google Sheets.
          </p>
          <button
            onClick={handleExport}
            disabled={loading || (dateRange === 'custom' && (!customStartDate || !customEndDate))}
            className="fc-btn-primary w-full justify-center py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-1 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <DocumentArrowDownIcon className="w-6 h-6" />
                Export to CSV
              </>
            )}
          </button>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-fc-wash-sky border border-fc-wash-sky-border rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-fc-teal" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-fc-midnight">Export tips</h3>
              <div className="mt-2 text-sm text-fc-brown">
                <ul className="list-disc list-inside space-y-1">
                  <li>Exported files can be opened in Excel, Google Sheets, or any spreadsheet software</li>
                  <li>All dates and times are in your local timezone</li>
                  <li>User passwords are never included in exports</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataExport;
