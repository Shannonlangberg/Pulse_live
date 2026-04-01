import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownTrayIcon,
  DocumentChartBarIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

const currentCalendarYear = new Date().getFullYear();
const YEAR_MIN = 2015;
const YEAR_MAX = currentCalendarYear + 1;

const PERIOD_OPTIONS = [
  { value: 'q1', label: 'Q1 — Jan–Mar' },
  { value: 'q2', label: 'Q2 — Apr–Jun' },
  { value: 'q3', label: 'Q3 — Jul–Sep' },
  { value: 'q4', label: 'Q4 — Oct–Dec' },
  {
    value: 'ytd',
    label: 'YTD — Jan 1 through today (selected year)',
  },
];

const buildYearOptions = () => {
  const out = [];
  for (let y = YEAR_MAX; y >= YEAR_MIN; y -= 1) out.push(y);
  return out;
};

const Reports = () => {
  const [year, setYear] = useState(currentCalendarYear);
  const [regions, setRegions] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [regionCode, setRegionCode] = useState('');
  const [selectedCampusSlugs, setSelectedCampusSlugs] = useState(() => new Set());
  const [loadError, setLoadError] = useState('');
  const [period, setPeriod] = useState('q1');
  const [includePreviousYear, setIncludePreviousYear] = useState(false);
  const [excludeYouthMetrics, setExcludeYouthMetrics] = useState(false);
  const [pdfOnePagePerCampus, setPdfOnePagePerCampus] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingCsv, setLoadingCsv] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Reports — Pulse';
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rRes, cRes] = await Promise.all([
          fetch('/api/v2/regions', { credentials: 'include' }),
          fetch('/api/v2/campuses', { credentials: 'include' }),
        ]);
        if (!rRes.ok || !cRes.ok) {
          throw new Error('Could not load regions or campuses (check you are signed in).');
        }
        const rJson = await rRes.json();
        const cJson = await cRes.json();
        if (cancelled) return;
        setRegions((rJson.regions || []).filter((x) => x.active));
        setCampuses(cJson.campuses || []);
        setLoadError('');
      } catch (e) {
        if (!cancelled) setLoadError(e.message || 'Failed to load filters');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCampuses = useMemo(() => {
    return campuses
      .filter((c) => c.active)
      .filter((c) => !regionCode || (c.region && c.region.code === regionCode))
      .sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''));
  }, [campuses, regionCode]);

  const onRegionChange = (code) => {
    setRegionCode(code);
    setSelectedCampusSlugs((prev) => {
      const next = new Set();
      const pool = campuses
        .filter((c) => c.active)
        .filter((c) => !code || (c.region && c.region.code === code));
      const poolIds = new Set(pool.map((c) => c.campus_id));
      prev.forEach((slug) => {
        if (poolIds.has(slug)) next.add(slug);
      });
      return next;
    });
  };

  const toggleCampus = useCallback((slug) => {
    setSelectedCampusSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedCampusSlugs(new Set(filteredCampuses.map((c) => c.campus_id)));
  }, [filteredCampuses]);

  const clearCampusSelection = useCallback(() => {
    setSelectedCampusSlugs(new Set());
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('year', String(year));
    if (period && period !== 'q1') params.set('period', period);
    if (regionCode) params.set('region', regionCode);
    if (selectedCampusSlugs.size > 0) {
      params.set('campuses', Array.from(selectedCampusSlugs).join(','));
    }
    if (includePreviousYear) {
      params.set('include_previous_year', 'true');
    }
    if (excludeYouthMetrics) {
      params.set('exclude_youth_metrics', 'true');
    }
    return params.toString();
  }, [year, period, regionCode, selectedCampusSlugs, includePreviousYear, excludeYouthMetrics]);

  const pdfQueryString = useMemo(() => {
    const params = new URLSearchParams(queryString);
    if (pdfOnePagePerCampus) params.set('per_campus', 'true');
    else params.delete('per_campus');
    return params.toString();
  }, [queryString, pdfOnePagePerCampus]);

  const pdfUrl = `/api/reports/q1-attendance.pdf?${pdfQueryString}`;
  const csvUrl = `/api/reports/q1-attendance.csv?${queryString}`;

  const periodLabel = useMemo(
    () => PERIOD_OPTIONS.find((o) => o.value === period)?.label || period,
    [period],
  );

  const filterHint = useMemo(() => {
    const parts = [];
    parts.push(`Year: ${year}`);
    parts.push(periodLabel);
    if (regionCode) {
      const r = regions.find((x) => x.code === regionCode);
      parts.push(`Region: ${r ? r.display_name : regionCode}`);
    } else parts.push('Region: all');
    if (selectedCampusSlugs.size > 0) {
      parts.push(`${selectedCampusSlugs.size} campus(es) selected`);
    } else if (regionCode) parts.push('Campuses: all in region');
    else parts.push('Campuses: all');
    if (includePreviousYear) {
      const pl = period === 'ytd' ? 'YTD' : period.toUpperCase();
      parts.push(`YoY: ${pl} ${year - 1} vs ${pl} ${year}`);
    }
    if (excludeYouthMetrics) {
      parts.push('NP & salvations: excl. youth (FTV + visitors; no youth salvations)');
    }
    return parts.join(' · ');
  }, [
    year,
    period,
    periodLabel,
    regionCode,
    selectedCampusSlugs,
    regions,
    includePreviousYear,
    excludeYouthMetrics,
  ]);

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

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
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
          <h2 className="text-xl font-semibold text-white mb-2">Quarterly &amp; YTD attendance</h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Choose <strong className="text-slate-300">Q1–Q4</strong> or{' '}
            <strong className="text-slate-300">YTD</strong> (year-to-date: Jan 1 through today when the
            report year is the current calendar year; full Jan–Dec for past years). Filter by region and/or
            campuses. Sunday = adults + saints + kids; weekend = Sunday + youth + youth leaders. PDF/CSV
            include period totals for new people and salvations (same field mix as the dashboard, from the database),
            plus region
            subtotals before the all-campuses total.             Optionally exclude <strong className="text-slate-300">youth</strong> from new people and
            salvations (new people = first-time visitors + visitors; salvations exclude youth salvations).
          </p>

          {loadError && (
            <div className="mb-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 px-4 py-3 text-sm">
              {loadError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Report year
              </label>
              <select
                value={year}
                onChange={(e) => {
                  const y = parseInt(e.target.value, 10);
                  setYear(y);
                  if (y <= 2000) setIncludePreviousYear(false);
                }}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              >
                {buildYearOptions().map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Period
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              >
                {PERIOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Region
              </label>
              <select
                value={regionCode}
                onChange={(e) => onRegionChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              >
                <option value="">All regions</option>
                {regions.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.display_name} ({r.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-start gap-3 mb-6 cursor-pointer group">
            <input
              type="checkbox"
              checked={includePreviousYear}
              onChange={(e) => setIncludePreviousYear(e.target.checked)}
              disabled={year <= 2000}
              className="mt-1 rounded border-slate-500 text-violet-600 focus:ring-violet-500 disabled:opacity-40"
            />
            <span>
              <span className="text-white font-medium group-hover:text-violet-200 transition-colors">
                Include previous year (year-over-year)
              </span>
              <span className="block text-slate-500 text-sm mt-0.5">
                Same period in the prior year (for YTD, the same calendar end date in {year > 2000 ? year - 1 : '—'}).
                PDF/CSV show both years side by side.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 mb-6 cursor-pointer group">
            <input
              type="checkbox"
              checked={pdfOnePagePerCampus}
              onChange={(e) => setPdfOnePagePerCampus(e.target.checked)}
              className="mt-1 rounded border-slate-500 text-violet-600 focus:ring-violet-500"
            />
            <span>
              <span className="text-white font-medium group-hover:text-violet-200 transition-colors">
                PDF: one page per campus
              </span>
              <span className="block text-slate-500 text-sm mt-0.5">
                Each campus gets its own charts and table instead of one combined report. CSV is unchanged.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 mb-6 cursor-pointer group">
            <input
              type="checkbox"
              checked={excludeYouthMetrics}
              onChange={(e) => setExcludeYouthMetrics(e.target.checked)}
              className="mt-1 rounded border-slate-500 text-violet-600 focus:ring-violet-500"
            />
            <span>
              <span className="text-white font-medium group-hover:text-violet-200 transition-colors">
                Exclude youth (new people &amp; salvations)
              </span>
              <span className="block text-slate-500 text-sm mt-0.5">
                Default: new people include youth new people; salvations include youth salvations (all from the Pulse
                database). When checked: new people = first-time visitors + visitors only; salvations exclude youth
                salvations. Same PDF/CSV layout and year-over-year % columns either way.
              </span>
            </span>
          </label>

          <div className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Campuses (optional — leave none checked for all in scope)
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllVisible}
                  className="text-xs text-violet-400 hover:text-violet-300"
                >
                  Select all listed
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={clearCampusSelection}
                  className="text-xs text-slate-400 hover:text-slate-300"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-600 bg-slate-900/80 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredCampuses.length === 0 ? (
                <p className="text-slate-500 text-sm col-span-full">No campuses match this region.</p>
              ) : (
                filteredCampuses.map((c) => (
                  <label
                    key={c.campus_id}
                    className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer hover:text-white"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCampusSlugs.has(c.campus_id)}
                      onChange={() => toggleCampus(c.campus_id)}
                      className="rounded border-slate-500 text-violet-600 focus:ring-violet-500"
                    />
                    <span className="truncate" title={c.display_name}>
                      {c.display_name}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <p className="text-slate-500 text-xs mb-6 border-l-2 border-violet-500/50 pl-3">{filterHint}</p>

          {error && (
            <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              disabled={loadingPdf || loadingCsv}
              onClick={() => downloadFile(pdfUrl, 'pulse-q1-attendance.pdf', setLoadingPdf)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              {loadingPdf ? 'Building PDF…' : 'Download PDF (charts + table)'}
            </button>
            <button
              type="button"
              disabled={loadingPdf || loadingCsv}
              onClick={() => downloadFile(csvUrl, 'pulse-q1-attendance.csv', setLoadingCsv)}
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
          . These reports use <strong className="text-slate-400">attendance_records</strong> only.
        </p>
      </div>
    </div>
  );
};

export default Reports;
