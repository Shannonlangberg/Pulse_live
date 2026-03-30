import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownTrayIcon,
  DocumentChartBarIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

const currentCalendarYear = new Date().getFullYear();

const Reports = () => {
  const [year, setYear] = useState(currentCalendarYear);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingCsv, setLoadingCsv] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Reports — Pulse';
  }, []);

  const downloadFile = async (url, defaultName, setLoading) => {
    setError('');
    setLoading(true);
    try {
      const response = await fetch(url, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Request failed (${response.status})`);
      }
      const blob = await response.blob();
      const dlUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      const cd = response.headers.get('Content-Disposition');
      let filename = defaultName;
      if (cd) {
        const m = cd.match(/filename="?([^";]+)"?/i);
        if (m) filename = m[1];
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(dlUrl);
    } catch (e) {
      setError(e.message || 'Download failed');
    } finally {
      setLoading(false);
    }
  };

  const pdfUrl = `/api/reports/q1-attendance.pdf?year=${year}`;
  const csvUrl = `/api/reports/q1-attendance.csv?year=${year}`;

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-3xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to home
        </Link>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <DocumentChartBarIcon className="w-10 h-10 text-violet-400" />
            Reports
          </h1>
          <p className="text-slate-400">
            Download attendance summaries from the Pulse database (not Google Sheets).
          </p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-8 shadow-xl">
          <h2 className="text-xl font-semibold text-white mb-2">Q1 attendance — all campuses</h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            January 1 through March 31 for the selected year.{' '}
            <span className="text-slate-300">
              Sunday total = adults + saints + kids (regional dashboard logic). Weekend = Sunday + youth + youth leaders.
            </span>
          </p>

          <div className="flex flex-wrap items-end gap-4 mb-8">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Year
              </label>
              <input
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10) || currentCalendarYear)}
                className="bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white w-32 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              disabled={loadingPdf || loadingCsv}
              onClick={() => downloadFile(pdfUrl, `pulse-q1-attendance-${year}.pdf`, setLoadingPdf)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              {loadingPdf ? 'Building PDF…' : 'Download PDF (charts + table)'}
            </button>
            <button
              type="button"
              disabled={loadingPdf || loadingCsv}
              onClick={() => downloadFile(csvUrl, `pulse-q1-attendance-${year}.csv`, setLoadingCsv)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 border border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              {loadingCsv ? 'Building CSV…' : 'Download CSV'}
            </button>
          </div>
        </div>

        <p className="mt-8 text-slate-500 text-sm">
          Raw sheet exports are still on{' '}
          <Link to="/export" className="text-violet-400 hover:text-violet-300 underline">
            Data Export
          </Link>
          . Q1 reports use{' '}
          <strong className="text-slate-400">attendance_records</strong> only.
        </p>
      </div>
    </div>
  );
};

export default Reports;
