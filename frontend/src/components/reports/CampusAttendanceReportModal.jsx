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
  { value: 'custom', label: 'Custom date range' },
];

function defaultCustomRangeYmd() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);
  const ymd = (d) => d.toISOString().slice(0, 10);
  return { start: ymd(start), end: ymd(end) };
}

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
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
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
    if (period === 'custom') {
      if (customStartDate) params.set('start_date', customStartDate);
      if (customEndDate) params.set('end_date', customEndDate);
    } else {
      params.set('year', String(year));
      if (period && period !== 'q1') params.set('period', period);
    }
    const rc = (reportRegionCode || '').trim();
    if (rc) params.set('region', rc);
    const cs = (reportCampusesCsv || '').trim();
    if (cs) params.set('campuses', cs);
    if (includePreviousYear) params.set('include_previous_year', 'true');
    if (metricsScope && metricsScope !== 'default') params.set('metrics_scope', metricsScope);
    return params.toString();
  }, [
    year,
    period,
    customStartDate,
    customEndDate,
    reportRegionCode,
    reportCampusesCsv,
    includePreviousYear,
    metricsScope,
  ]);

  const pdfQueryString = useMemo(() => {
    const params = new URLSearchParams(queryString);
    const n = (reportCampusesCsv || '').split(',').filter((x) => x.trim()).length;
    if (n > 1) params.set('per_campus', 'true');
    return params.toString();
  }, [queryString, reportCampusesCsv]);

  const periodLabel = useMemo(() => {
    if (period === 'custom' && customStartDate && customEndDate) {
      return `Custom: ${customStartDate} → ${customEndDate}`;
    }
    return PERIOD_OPTIONS.find((o) => o.value === period)?.label || period;
  }, [period, customStartDate, customEndDate]);

  const customRangeReady =
    period !== 'custom' || (Boolean(customStartDate) && Boolean(customEndDate));
  const previewYear =
    period === 'custom' && customEndDate
      ? parseInt(customEndDate.slice(0, 4), 10) || year
      : year;

  if (!open) return null;

  return (
    <div
      id="campus-attendance-report-modal"
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="campus-report-modal-title"
    >
      <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl border border-fc-cream2 bg-fc-cream shadow-2xl overflow-hidden campus-report-modal-shell">
        <div className="campus-report-modal-chrome flex flex-shrink-0 flex-col gap-4 border-b border-fc-cream2 bg-fc-cream px-4 py-4 sm:px-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 pr-10 sm:pr-0">
            <h2
              id="campus-report-modal-title"
              className="fc-display-md text-fc-midnight"
            >
              Attendance report
            </h2>
            <p className="mt-1 text-sm text-fc-brown">
              {campusScopeLabel ? (
                <>
                  Scope: <span className="text-fc-midnight font-medium">{campusScopeLabel}</span>
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
            className="absolute right-3 top-3 rounded-lg p-2 text-fc-brown hover:bg-fc-cream2 hover:text-fc-midnight sm:static sm:self-start"
            aria-label="Close"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="campus-report-modal-chrome flex-shrink-0 border-b border-fc-cream2 bg-fc-cream2/40 px-4 py-4 sm:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="fc-label mb-1.5 block">
                Report year
              </label>
              <select
                value={year}
                disabled={period === 'custom'}
                onChange={(e) => {
                  const y = parseInt(e.target.value, 10);
                  setYear(y);
                  if (y <= 2000) setIncludePreviousYear(false);
                }}
                className="fc-input w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {buildYearOptions().map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="fc-label mb-1.5 block">
                Period
              </label>
              <select
                value={period}
                onChange={(e) => {
                  const v = e.target.value;
                  setPeriod(v);
                  if (v === 'custom') {
                    const { start, end } = defaultCustomRangeYmd();
                    setCustomStartDate((prev) => prev || start);
                    setCustomEndDate((prev) => prev || end);
                  }
                }}
                className="fc-input w-full"
              >
                {PERIOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {period === 'custom' && (
              <>
                <div>
                  <label className="fc-label mb-1.5 block">
                    Start date
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="fc-input w-full"
                  />
                </div>
                <div>
                  <label className="fc-label mb-1.5 block">
                    End date
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="fc-input w-full"
                  />
                </div>
              </>
            )}
          </div>
          <label className="mt-4 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={includePreviousYear}
              onChange={(e) => setIncludePreviousYear(e.target.checked)}
              disabled={year <= 2000}
              className="mt-1 rounded border-fc-cream2 bg-fc-cream text-fc-olive focus:ring-fc-olive disabled:opacity-40"
            />
            <span className="text-sm text-fc-midnight">
              <span className="font-medium">Include previous year (YoY)</span>
              <span className="mt-0.5 block text-xs text-fc-brown">
                Same period rules as the main Reports page and PDF/CSV downloads.
              </span>
            </span>
          </label>
        </div>

        <div className="campus-report-modal-body min-h-0 flex-1 overflow-y-auto bg-fc-cream2/30 p-3 sm:p-4">
          <AttendanceReportPreview
            queryString={pdfQueryString}
            regionTitle={regionTitle}
            periodLabel={periodLabel}
            year={previewYear}
            fetchEnabled={customRangeReady}
          />
        </div>
      </div>
    </div>
  );
}
