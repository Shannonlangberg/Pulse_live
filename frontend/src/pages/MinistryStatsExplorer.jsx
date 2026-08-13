import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ChartBarIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';

const REPORT_METRICS_SCOPES = ['default', 'sundays_rollup_only', 'special_events_only'];

/** Sort labels like "5:30 PM" for datalist ordering. */
function parseServiceTimeMinutes(timeStr) {
  const match = String(timeStr).match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function presetRange(key) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (key === 'month') {
    return { start: ymd(startOfMonth(today)), end: ymd(today) };
  }
  if (key === '30') {
    const s = new Date(today);
    s.setDate(s.getDate() - 29);
    return { start: ymd(s), end: ymd(today) };
  }
  if (key === 'q') {
    const m = today.getMonth();
    const qStartMonth = Math.floor(m / 3) * 3;
    const s = new Date(today.getFullYear(), qStartMonth, 1);
    return { start: ymd(s), end: ymd(today) };
  }
  if (key === 'ytd') {
    const s = new Date(today.getFullYear(), 0, 1);
    return { start: ymd(s), end: ymd(today) };
  }
  return { start: ymd(today), end: ymd(today) };
}

/**
 * @param {'campus' | 'entry_row' | 'entry_footer'} displayMode
 *   campus — period averages for avg/ service metrics (one decimal).
 *   entry_row — one week per row; headcounts are whole people (integers).
 *   entry_footer — mean across weeks; show whole people for attendance metrics.
 */
function formatCell(mid, v, catalogById, displayMode = 'campus') {
  const meta = catalogById[mid];
  if (v == null || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  if (meta?.is_currency) {
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (meta?.avg_per_service_row) {
    if (displayMode === 'entry_row' || displayMode === 'entry_footer') {
      return Math.round(n).toLocaleString();
    }
    return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  if (Number.isInteger(n) || Math.abs(n - Math.round(n)) < 1e-6) {
    return Math.round(n).toLocaleString();
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

/** Pill chip for campus/period toggles — olive-tinted when selected, white/cream when not. */
function ToggleChip({ selected, onClick, children, type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={
        'text-sm px-4 py-1.5 rounded-full border transition-colors ' +
        (selected
          ? 'bg-fc-wash-mint border-fc-olive text-fc-midnight font-medium'
          : 'bg-white border-fc-cream2 text-fc-brown hover:border-fc-olive/50')
      }
    >
      {children}
    </button>
  );
}

const MinistryStatsExplorer = () => {
  const [regions, setRegions] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [regionCode, setRegionCode] = useState('');
  const [selectedCampusSlugs, setSelectedCampusSlugs] = useState(() => new Set());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [metricsScope, setMetricsScope] = useState('default');
  const [reportGranularity, setReportGranularity] = useState('campus');
  const [serviceTime, setServiceTime] = useState('');
  const [excludeYouth, setExcludeYouth] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [defaultMetricIds, setDefaultMetricIds] = useState([]);
  const [selectedMetricIds, setSelectedMetricIds] = useState(() => new Set());
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Ministry stats — Pulse';
  }, []);

  useEffect(() => {
    if (!REPORT_METRICS_SCOPES.includes(metricsScope)) {
      setMetricsScope('default');
    }
  }, [metricsScope]);

  useEffect(() => {
    const { start, end } = presetRange('30');
    setStartDate(start);
    setEndDate(end);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rRes, cRes, catRes] = await Promise.all([
          fetch('/api/v2/regions', { credentials: 'include' }),
          fetch('/api/v2/campuses', { credentials: 'include' }),
          fetch('/api/reports/ministry-stats/catalog', { credentials: 'include', cache: 'no-store' }),
        ]);
        if (!rRes.ok || !cRes.ok) {
          throw new Error('Could not load regions or campuses (check you are signed in).');
        }
        if (!catRes.ok) {
          const j = await catRes.json().catch(() => ({}));
          throw new Error(j.error || 'Could not load metric list.');
        }
        const rJson = await rRes.json();
        const cJson = await cRes.json();
        const catJson = await catRes.json();
        if (cancelled) return;
        setRegions((rJson.regions || []).filter((x) => x.active));
        setCampuses(cJson.campuses || []);
        const metrics = catJson.metrics || [];
        setCatalog(metrics);
        const defs = catJson.default_metric_ids || [];
        setDefaultMetricIds(defs);
        setSelectedMetricIds(new Set(defs));
        setLoadError('');
      } catch (e) {
        if (!cancelled) setLoadError(e.message || 'Failed to load');
      } finally {
        if (!cancelled) setCatalogLoading(false);
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

  const serviceTimeSuggestions = useMemo(() => {
    const pool =
      selectedCampusSlugs.size > 0
        ? filteredCampuses.filter((c) => selectedCampusSlugs.has(c.campus_id))
        : filteredCampuses;
    const out = new Set();
    pool.forEach((c) => {
      const st = Array.isArray(c.service_times) ? c.service_times : [];
      st.forEach((t) => {
        const s = String(t).trim();
        if (s) out.add(s);
      });
    });
    return Array.from(out).sort((a, b) => parseServiceTimeMinutes(a) - parseServiceTimeMinutes(b));
  }, [filteredCampuses, selectedCampusSlugs]);

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

  const catalogById = useMemo(() => {
    const m = {};
    catalog.forEach((x) => {
      m[x.id] = x;
    });
    return m;
  }, [catalog]);

  /** Result payload may include newer catalog flags (e.g. avg_per_service_row) than a stale tab cache. */
  const tableCatalogById = useMemo(() => {
    const m = { ...catalogById };
    (result?.metric_catalog || []).forEach((x) => {
      m[x.id] = { ...(m[x.id] || {}), ...x };
    });
    return m;
  }, [catalogById, result?.metric_catalog]);

  const metricsByGroup = useMemo(() => {
    const g = {};
    catalog.forEach((m) => {
      const key = m.group || 'Other';
      if (!g[key]) g[key] = [];
      g[key].push(m);
    });
    return g;
  }, [catalog]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    const ids = Array.from(selectedMetricIds);
    if (ids.length) params.set('metrics', ids.join(','));
    if (regionCode) params.set('region', regionCode);
    if (selectedCampusSlugs.size > 0) {
      params.set('campuses', Array.from(selectedCampusSlugs).join(','));
    }
    if (excludeYouth) params.set('exclude_youth_metrics', 'true');
    if (metricsScope && metricsScope !== 'default') params.set('metrics_scope', metricsScope);
    const st = serviceTime.trim();
    if (st) params.set('service_time', st);
    if (reportGranularity === 'entry') params.set('granularity', 'entry');
    return params.toString();
  }, [
    startDate,
    endDate,
    selectedMetricIds,
    regionCode,
    selectedCampusSlugs,
    excludeYouth,
    metricsScope,
    serviceTime,
    reportGranularity,
  ]);

  const runQuery = async () => {
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch(`/api/reports/ministry-stats?${queryString}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
      setResult(j);
    } catch (e) {
      setError(e.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = () => {
    window.open(`/api/reports/ministry-stats.csv?${queryString}`, '_blank', 'noopener,noreferrer');
  };

  const toggleMetric = (id) => {
    setSelectedMetricIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectPresetMetrics = (ids) => {
    setSelectedMetricIds(new Set(ids));
  };

  const metricIdsInResult = result?.metric_ids || [];
  const isEntryLayout = result?.granularity === 'entry';
  const resultBodyRows = isEntryLayout ? result?.entries || [] : result?.campuses || [];
  const resultServiceTime = (result?.service_time || '').trim();

  return (
    <div className="min-h-screen bg-fc-cream p-6">
      <div className="max-w-[100rem] mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-fc-brown hover:text-fc-midnight text-sm mb-6"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to home
        </Link>

        <div className="mb-8">
          <div className="fc-label mb-2">Reporting</div>
          <h1 className="fc-display fc-display-md mb-2 flex items-center gap-3">
            <ChartBarIcon className="w-9 h-9 text-fc-olive" />
            Ministry stats
          </h1>
          <p className="text-fc-brown max-w-3xl text-sm leading-relaxed">
            Pick any combination of Pulse stats, campuses, and dates. Most columns are{' '}
            <strong className="text-fc-midnight">sums</strong> over every matching attendance row.{' '}
            <strong className="text-fc-midnight">Sunday</strong> and <strong className="text-fc-midnight">weekend</strong> match
            the dashboard; <strong className="text-fc-midnight">Kids in room</strong> and{' '}
            <strong className="text-fc-midnight">Kids leaders</strong> are separate columns (room headcount vs total leaders
            for the week). Sunday / weekend / kids-in-room are
            shown as <strong className="text-fc-midnight">averages per service row</strong> in your date range (not a
            running total). Columns marked <strong className="text-fc-midnight">avg / service</strong> in results use that
            rule. Optionally restrict slot-based columns to a <strong className="text-fc-midnight">service time</strong>{' '}
            (e.g. 5:30 PM) using stored per-slot breakdowns. Use <strong className="text-fc-midnight">week-to-week</strong>{' '}
            layout for one table row per logged service date (per campus).
          </p>
          <p className="text-fc-brown/70 text-sm mt-2">
            Tip: leave all campuses unchecked to include <strong className="text-fc-brown">every campus</strong> in
            your access (or all in the region you select).
          </p>
        </div>

        {(loadError || catalogLoading) && (
          <div className="mb-4 rounded-lg bg-fc-wash-butter border border-fc-wash-butter-border text-fc-brown px-4 py-3 text-sm">
            {catalogLoading ? 'Loading metric list…' : loadError}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-4 space-y-6">
            <div className="fc-card p-6">
              <div className="fc-label mb-4">One · Date range</div>
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { k: '30', label: 'Last 30 days' },
                  { k: 'month', label: 'Month to date' },
                  { k: 'q', label: 'This quarter' },
                  { k: 'ytd', label: 'YTD' },
                ].map((p) => (
                  <button
                    key={p.k}
                    type="button"
                    onClick={() => {
                      const r = presetRange(p.k);
                      setStartDate(r.start);
                      setEndDate(r.end);
                    }}
                    className="text-sm px-4 py-1.5 rounded-full border bg-white border-fc-cream2 text-fc-brown hover:border-fc-olive/50 transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="fc-label text-[11px] block mb-2">Start</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="fc-input"
                  />
                </div>
                <div>
                  <label className="fc-label text-[11px] block mb-2">End</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="fc-input"
                  />
                </div>
              </div>
              <p className="text-fc-brown/70 text-xs mt-3">End date cannot be in the future. Max range ~3 years.</p>
            </div>

            <div className="fc-card p-6">
              <div className="fc-label mb-4">Two · Scope</div>
              <div className="mb-4">
                <label className="fc-label text-[11px] block mb-2">Region</label>
                <select
                  value={regionCode}
                  onChange={(e) => onRegionChange(e.target.value)}
                  className="fc-input"
                >
                  <option value="">All regions (within your access)</option>
                  {regions.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.display_name} ({r.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="fc-label text-[11px] block mb-2">Which rows count (same as dashboard)</label>
                <select
                  value={metricsScope}
                  onChange={(e) => setMetricsScope(e.target.value)}
                  className="fc-input"
                >
                  <option value="default">All entries (standard Sundays + special events)</option>
                  <option value="sundays_rollup_only">Sundays only (standard services)</option>
                  <option value="special_events_only">Special events only</option>
                </select>
                <p className="text-fc-brown/70 text-xs mt-2">
                  This chooses which <strong className="text-fc-brown">weekly stats rows</strong> are included (e.g.
                  omit special events). It does <strong className="text-fc-brown">not</strong> add up 9:00 + 11:00 +
                  5:30 — use <strong className="text-fc-brown">Service time</strong> below only if you want one clock
                  time; leave it blank for combined campus totals.
                </p>
              </div>
              <div className="mb-4">
                <label className="fc-label text-[11px] block mb-2">Report layout</label>
                <select
                  value={reportGranularity}
                  onChange={(e) => setReportGranularity(e.target.value)}
                  className="fc-input"
                >
                  <option value="campus">Summary — one row per campus</option>
                  <option value="entry">Week to week — one row per service date (per campus)</option>
                </select>
                <p className="text-fc-brown/70 text-xs mt-2">
                  Week-to-week shows each stats entry in date order (same metrics as above). Large ranges may hit a row
                  limit; use CSV or narrow dates if needed.
                </p>
              </div>
              <div className="mb-4">
                <label className="fc-label text-[11px] block mb-2">Service time (optional)</label>
                <input
                  type="text"
                  list="ministry-stats-service-time-suggestions"
                  value={serviceTime}
                  onChange={(e) => setServiceTime(e.target.value)}
                  placeholder="All slots — e.g. 5:30 PM"
                  className="fc-input"
                  autoComplete="off"
                />
                <datalist id="ministry-stats-service-time-suggestions">
                  {serviceTimeSuggestions.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
                <p className="text-fc-brown/70 text-xs mt-2">
                  When set, Sunday / weekend / kids-in-room / total use <strong className="text-fc-brown">only that slot</strong>{' '}
                  from stored breakdowns (labels must match, e.g. <span className="text-fc-brown">5:30 PM</span> and{' '}
                  <span className="text-fc-brown">Kids 5:30 PM</span>).{' '}
                  <strong className="text-fc-brown">Kids leaders</strong> stays the{' '}
                  <strong className="text-fc-brown">full weekend total</strong> for that entry — not split or estimated
                  per slot. <strong className="text-fc-brown">Clear this field</strong> for combined campus totals.
                  Baptisms, salvations, giving, etc. still use the whole weekly entry.
                </p>
                {serviceTime.trim() ? (
                  <div className="mt-3 rounded-lg border border-fc-wash-butter-border bg-fc-wash-butter px-3 py-2 text-xs text-fc-brown">
                    Service time is set — slot-based columns use <strong>only {serviceTime.trim()}</strong> from the
                    breakdown. <strong>Kids leaders</strong> is still the full weekend total for that week (not split).
                  </div>
                ) : null}
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={excludeYouth}
                  onChange={(e) => setExcludeYouth(e.target.checked)}
                  className="mt-1 rounded border-fc-cream2 text-fc-olive focus:ring-fc-olive"
                />
                <span className="text-sm text-fc-brown">
                  Exclude youth from <strong className="text-fc-midnight">new people</strong> and{' '}
                  <strong className="text-fc-midnight">salvations</strong> totals
                </span>
              </label>
            </div>

            <div className="fc-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="fc-label">Three · Campuses</div>
                <div className="flex gap-3 text-xs">
                  <button type="button" onClick={selectAllVisible} className="text-fc-copper hover:brightness-90">
                    All listed
                  </button>
                  <span className="text-fc-cream2">|</span>
                  <button type="button" onClick={clearCampusSelection} className="text-fc-copper hover:brightness-90">
                    Clear
                  </button>
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-fc-cream2 bg-fc-cream p-2">
                {filteredCampuses.length === 0 ? (
                  <p className="text-fc-brown/70 text-sm">No campuses match.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 p-1">
                    {filteredCampuses.map((c) => (
                      <ToggleChip
                        key={c.campus_id}
                        selected={selectedCampusSlugs.has(c.campus_id)}
                        onClick={() => toggleCampus(c.campus_id)}
                      >
                        {c.display_name}
                      </ToggleChip>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="xl:col-span-8 space-y-6">
            <div className="fc-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="fc-label">Four · Metrics</div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <button
                    type="button"
                    onClick={() => selectPresetMetrics(defaultMetricIds)}
                    className="text-fc-copper hover:brightness-90"
                  >
                    Recommended set
                  </button>
                  <button
                    type="button"
                    onClick={() => selectPresetMetrics(['baptisms'])}
                    className="text-fc-copper hover:brightness-90"
                  >
                    Baptisms only
                  </button>
                  <button
                    type="button"
                    onClick={() => selectPresetMetrics(catalog.map((x) => x.id))}
                    className="text-fc-copper hover:brightness-90"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMetricIds(new Set())}
                    className="text-fc-copper hover:brightness-90"
                  >
                    Clear all
                  </button>
                </div>
              </div>
              <div className="max-h-[min(52vh,520px)] overflow-y-auto space-y-4 pr-1">
                {Object.keys(metricsByGroup)
                  .sort()
                  .map((group) => (
                    <div key={group}>
                      <div className="fc-label text-[11px] mb-2">{group}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {metricsByGroup[group].map((m) => {
                          const checked = selectedMetricIds.has(m.id);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => toggleMetric(m.id)}
                              className={
                                'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm text-left transition-colors ' +
                                (checked
                                  ? 'bg-fc-wash-mint border-fc-wash-mint-border text-fc-midnight font-medium'
                                  : 'bg-fc-cream border-fc-cream2 text-fc-brown hover:border-fc-olive/40')
                              }
                            >
                              <span
                                className={
                                  'inline-block w-2 h-2 rounded-full flex-shrink-0 ' +
                                  (checked ? 'bg-fc-olive' : 'bg-fc-thistle')
                                }
                              />
                              <span className="truncate">{m.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <button
                type="button"
                disabled={loading || selectedMetricIds.size === 0 || !startDate || !endDate}
                onClick={runQuery}
                className="fc-btn-primary"
              >
                <PlayIcon className="w-4 h-4" />
                {loading ? 'Running…' : 'Run report'}
              </button>
              <button
                type="button"
                disabled={!result || loading}
                onClick={downloadCsv}
                className="fc-btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                Download CSV
              </button>
            </div>

            {error && (
              <div className="rounded-lg bg-fc-wash-peach border border-fc-wash-peach-border text-fc-copper px-4 py-3 text-sm">
                {error}
              </div>
            )}

            {result && (
              <div className="fc-card overflow-hidden">
                <div className="p-6 pb-4">
                  <h2 className="fc-display fc-display-sm mb-2">Results</h2>
                  <p className="text-fc-brown text-sm border-l-2 border-fc-olive pl-3">
                    {result.filter_summary}
                  </p>
                </div>
                <div className="overflow-x-auto border-t border-fc-cream2">
                  <table className="min-w-full text-sm text-left">
                    <thead>
                      <tr className="bg-fc-cream">
                        {isEntryLayout ? (
                          <>
                            <th className="px-4 py-3 fc-label text-[10px] sticky left-0 bg-fc-cream z-10 min-w-[7.5rem]">
                              Service date
                            </th>
                            <th className="px-4 py-3 fc-label text-[10px] sticky left-[7.5rem] bg-fc-cream z-10">Region</th>
                            <th className="px-4 py-3 fc-label text-[10px] sticky left-[11.5rem] bg-fc-cream z-10 min-w-[10rem]">
                              Campus
                            </th>
                          </>
                        ) : (
                          <>
                            <th className="px-4 py-3 fc-label text-[10px] sticky left-0 bg-fc-cream z-10">Region</th>
                            <th className="px-4 py-3 fc-label text-[10px] sticky left-14 bg-fc-cream z-10 min-w-[10rem]">
                              Campus
                            </th>
                            <th className="px-4 py-3 fc-label text-[10px] text-right whitespace-nowrap">
                              <span className="block">Stats rows</span>
                              <span className="block text-[9px] font-normal normal-case tracking-normal text-fc-brown/60 mt-0.5">
                                weekly entries
                              </span>
                            </th>
                          </>
                        )}
                        {metricIdsInResult.map((mid) => (
                          <th key={mid} className="px-4 py-3 fc-label text-[10px] text-right whitespace-nowrap">
                            <span className="block">{tableCatalogById[mid]?.label || mid}</span>
                            {tableCatalogById[mid]?.avg_per_service_row && !isEntryLayout ? (
                              <span className="block text-[9px] font-normal normal-case tracking-normal text-fc-brown/60 mt-0.5">
                                avg / service
                              </span>
                            ) : null}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-fc-cream2">
                      {isEntryLayout
                        ? resultBodyRows.map((row) => (
                            <tr
                              key={`${row.campus_id}-${row.service_date}`}
                              className="hover:bg-fc-cream/60 text-fc-midnight"
                            >
                              <td className="px-4 py-2.5 sticky left-0 bg-white z-10 font-mono text-fc-brown">
                                {row.service_date || '—'}
                              </td>
                              <td className="px-4 py-2.5 sticky left-[7.5rem] bg-white z-10 text-fc-brown">
                                {row.region_code || '—'}
                              </td>
                              <td className="px-4 py-2.5 sticky left-[11.5rem] bg-white z-10 font-medium text-fc-midnight">
                                {row.campus_name}
                              </td>
                              {metricIdsInResult.map((mid) => (
                                <td key={mid} className="px-4 py-2.5 text-right font-mono">
                                  {formatCell(mid, row[mid], tableCatalogById, 'entry_row')}
                                </td>
                              ))}
                            </tr>
                          ))
                        : resultBodyRows.map((row) => (
                            <tr key={row.campus_id} className="hover:bg-fc-cream/60 text-fc-midnight">
                              <td className="px-4 py-2.5 sticky left-0 bg-white z-10 text-fc-brown">
                                {row.region_code || '—'}
                              </td>
                              <td className="px-4 py-2.5 sticky left-14 bg-white z-10 font-medium text-fc-midnight">
                                {row.campus_name}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono">{row.service_rows}</td>
                              {metricIdsInResult.map((mid) => (
                                <td key={mid} className="px-4 py-2.5 text-right font-mono">
                                  {formatCell(mid, row[mid], tableCatalogById, 'campus')}
                                </td>
                              ))}
                            </tr>
                          ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-fc-wash-mint text-fc-midnight font-semibold border-t-2 border-fc-olive/40">
                        {isEntryLayout ? (
                          <td className="px-4 py-3 sticky left-0 bg-fc-wash-mint z-10" colSpan={3}>
                            All rows ({result.meta?.total_service_rows ?? '—'})
                          </td>
                        ) : (
                          <>
                            <td className="px-4 py-3 sticky left-0 bg-fc-wash-mint z-10" colSpan={2}>
                              All campuses
                            </td>
                            <td className="px-4 py-3 text-right font-mono">
                              {result.meta?.total_service_rows ?? '—'}
                            </td>
                          </>
                        )}
                        {metricIdsInResult.map((mid) => (
                          <td key={mid} className="px-4 py-3 text-right font-mono">
                            {formatCell(
                              mid,
                              result.totals?.[mid],
                              tableCatalogById,
                              isEntryLayout ? 'entry_footer' : 'campus'
                            )}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {resultBodyRows.length === 0 && (
                  <p className="text-fc-brown/70 text-sm p-6 pt-4">No attendance rows in this range for your filters.</p>
                )}
                {metricIdsInResult.some((mid) => tableCatalogById[mid]?.avg_per_service_row) && !isEntryLayout && (
                  <p className="text-fc-brown/70 text-xs px-6 pb-5 pt-3">
                    Columns marked <span className="text-fc-brown">avg / service</span> are means per weekly stats row
                    in your date range (not “number of Sunday services run”). The{' '}
                    <strong className="text-fc-brown">All campuses</strong> row uses the same rule across every row in
                    your filter.
                    {resultServiceTime ? (
                      <>
                        {' '}
                        With a service time filter, those columns are the average for <strong className="text-fc-brown">that slot only</strong>.
                      </>
                    ) : null}
                  </p>
                )}
                {isEntryLayout && metricIdsInResult.some((mid) => tableCatalogById[mid]?.avg_per_service_row) && (
                  <p className="text-fc-brown/70 text-xs px-6 pb-5 pt-3">
                    Each row is that week&apos;s values (whole numbers for attendance metrics). Sunday / weekend /
                    kids-in-room footers are averages across listed weeks; <strong className="text-fc-brown">Kids leaders</strong>{' '}
                    is the full weekly total each row (not split by service time).
                  </p>
                )}
              </div>
            )}

            <p className="text-fc-brown/70 text-sm">
              For PDF charts and year-over-year tables, use{' '}
              <Link to="/reports" className="text-fc-copper hover:brightness-90 underline">
                Reports
              </Link>
              . Ministry stats is for flexible sums, averages, and CSV export.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MinistryStatsExplorer;
