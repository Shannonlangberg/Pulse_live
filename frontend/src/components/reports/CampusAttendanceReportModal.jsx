import React, { useEffect, useMemo, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import AttendanceReportPreview from './AttendanceReportPreview';

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

function buildYearOptions() {
  const out = [];
  for (let y = YEAR_MAX; y >= YEAR_MIN; y -= 1) out.push(y);
  return out;
}

/**
 * Full attendance report preview (same component as /reports) with year, period, and YoY.
 * Caller passes region/campus query params aligned with the dashboard context; the API enforces role scope.
 */
export default function CampusAttendanceReportModal({
  open,
  onClose,
  reportRegionCode = '',
  reportCampusesCsv = '',
  regionTitle = 'All regions',
  campusScopeLabel = '',
  metricsScope = 'default',
}) {
  const [year, setYear] = useState(currentCalendarYear);
  const [period, setPeriod] = useState('q1');
  const [includePreviousYear, setIncludePreviousYear] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('year', String(year));
    if (period && period !== 'q1') params.set('period', period);
    const rc = (reportRegionCode || '').trim();
    if (rc) params.set('region', rc);
    const cs = (reportCampusesCsv || '').trim();
    if (cs) params.set('campuses', cs);
    if (includePreviousYear) params.set('include_previous_year', 'true');
    if (metricsScope && metricsScope !== 'default') params.set('metrics_scope', metricsScope);
    return params.toString();
  }, [year, period, reportRegionCode, reportCampusesCsv, includePreviousYear, metricsScope]);

  const pdfQueryString = useMemo(() => {
    const params = new URLSearchParams(queryString);
    const n = (reportCampusesCsv || '').split(',').filter((x) => x.trim()).length;
    if (n > 1) params.set('per_campus', 'true');
    return params.toString();
  }, [queryString, reportCampusesCsv]);

  const periodLabel = useMemo(
    () => PERIOD_OPTIONS.find((o) => o.value === period)?.label || period,
    [period],
  );

  if (!open) return null;

  return (
    <div
      id="campus-attendance-report-modal"
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="campus-report-modal-title"
    >
      <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden campus-report-modal-shell">
        <div className="campus-report-modal-chrome flex flex-shrink-0 flex-col gap-4 border-b border-white/10 bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-4 sm:px-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 pr-10 sm:pr-0">
            <h2
              id="campus-report-modal-title"
              className="text-lg font-bold text-white sm:text-xl"
            >
              Attendance report
            </h2>
            <p className="mt-1 text-sm text-white/60">
              {campusScopeLabel ? (
                <>
                  Scope: <span className="text-white/90">{campusScopeLabel}</span>
                  {' · '}Same preview as Reports (Pulse DB)
                </>
              ) : (
                <>Same preview as Reports (Pulse DB)</>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white sm:static sm:self-start"
            aria-label="Close"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="campus-report-modal-chrome flex-shrink-0 border-b border-white/10 bg-slate-800/90 px-4 py-4 sm:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/50">
                Report year
              </label>
              <select
                value={year}
                onChange={(e) => {
                  const y = parseInt(e.target.value, 10);
                  setYear(y);
                  if (y <= 2000) setIncludePreviousYear(false);
                }}
                className="w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                {buildYearOptions().map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/50">
                Period
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                {PERIOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="mt-4 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={includePreviousYear}
              onChange={(e) => setIncludePreviousYear(e.target.checked)}
              disabled={year <= 2000}
              className="mt-1 rounded border-white/20 bg-slate-900 text-violet-500 focus:ring-violet-500 disabled:opacity-40"
            />
            <span className="text-sm text-white/90">
              <span className="font-medium">Include previous year (YoY)</span>
              <span className="mt-0.5 block text-xs text-white/50">
                Same period rules as the main Reports page and PDF/CSV downloads.
              </span>
            </span>
          </label>
        </div>

        <div className="campus-report-modal-body min-h-0 flex-1 overflow-y-auto bg-slate-950/40 p-3 sm:p-4">
          <AttendanceReportPreview
            queryString={pdfQueryString}
            regionTitle={regionTitle}
            periodLabel={periodLabel}
            year={year}
          />
        </div>
      </div>
    </div>
  );
}
