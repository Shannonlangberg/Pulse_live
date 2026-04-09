import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ChartBarIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';

const REPORT_METRICS_SCOPES = ['default', 'sundays_rollup_only', 'special_events_only'];

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

function formatCell(mid, v, catalogById) {
  const meta = catalogById[mid];
  if (v == null || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  if (meta?.is_currency) {
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (meta?.avg_per_service_row) {
    return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  if (Number.isInteger(n) || Math.abs(n - Math.round(n)) < 1e-6) {
    return Math.round(n).toLocaleString();
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
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
    return params.toString();
  }, [
    startDate,
    endDate,
    selectedMetricIds,
    regionCode,
    selectedCampusSlugs,
    excludeYouth,
    metricsScope,
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

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-[100rem] mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to home
        </Link>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <ChartBarIcon className="w-10 h-10 text-emerald-400" />
            Ministry stats
          </h1>
          <p className="text-slate-400 max-w-3xl">
            Pick any combination of Pulse stats, campuses, and dates. Most columns are{' '}
            <strong className="text-slate-300">sums</strong> over every matching attendance row.{' '}
            <strong className="text-slate-300">Sunday</strong>, <strong className="text-slate-300">weekend</strong>, and{' '}
            <strong className="text-slate-300">kids attendance</strong> use the same definitions as the dashboard but are
            shown as <strong className="text-slate-300">averages per service row</strong> in your date range (not a
            running total). Use each metric&apos;s description for details.
          </p>
          <p className="text-slate-500 text-sm mt-2">
            Tip: leave all campuses unchecked to include <strong className="text-slate-400">every campus</strong> in
            your access (or all in the region you select).
          </p>
        </div>

        {(loadError || catalogLoading) && (
          <div className="mb-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 px-4 py-3 text-sm">
            {catalogLoading ? 'Loading metric list…' : loadError}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-4 space-y-6">
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-white mb-4">1. Date range</h2>
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
                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                    Start
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                    End
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
              <p className="text-slate-500 text-xs mt-3">End date cannot be in the future. Max range ~3 years.</p>
            </div>

            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-white mb-4">2. Scope</h2>
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                  Region
                </label>
                <select
                  value={regionCode}
                  onChange={(e) => onRegionChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
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
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                  Which rows count (same as dashboard)
                </label>
                <select
                  value={metricsScope}
                  onChange={(e) => setMetricsScope(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="default">All services (Sundays + special events)</option>
                  <option value="sundays_rollup_only">Sundays only (standard services)</option>
                  <option value="special_events_only">Special events only</option>
                </select>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={excludeYouth}
                  onChange={(e) => setExcludeYouth(e.target.checked)}
                  className="mt-1 rounded border-slate-500 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-300">
                  Exclude youth from <strong className="text-white">new people</strong> and{' '}
                  <strong className="text-white">salvations</strong> totals
                </span>
              </label>
            </div>

            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h2 className="text-lg font-semibold text-white">Campuses</h2>
                <div className="flex gap-2 text-xs">
                  <button type="button" onClick={selectAllVisible} className="text-emerald-400 hover:text-emerald-300">
                    All listed
                  </button>
                  <span className="text-slate-600">|</span>
                  <button type="button" onClick={clearCampusSelection} className="text-slate-400 hover:text-slate-300">
                    Clear
                  </button>
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-600 bg-slate-900/80 p-2 space-y-1">
                {filteredCampuses.length === 0 ? (
                  <p className="text-slate-500 text-sm">No campuses match.</p>
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
                        className="rounded border-slate-500 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="truncate">{c.display_name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="xl:col-span-8 space-y-6">
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold text-white">3. Metrics</h2>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => selectPresetMetrics(defaultMetricIds)}
                    className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600"
                  >
                    Recommended set
                  </button>
                  <button
                    type="button"
                    onClick={() => selectPresetMetrics(['baptisms'])}
                    className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600"
                  >
                    Baptisms only
                  </button>
                  <button
                    type="button"
                    onClick={() => selectPresetMetrics(catalog.map((x) => x.id))}
                    className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMetricIds(new Set())}
                    className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600"
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
                      <div className="text-xs font-semibold text-emerald-400/90 uppercase tracking-wide mb-2">
                        {group}
                      </div>
                      <div className="space-y-2">
                        {metricsByGroup[group].map((m) => (
                          <label
                            key={m.id}
                            className="flex items-start gap-3 rounded-lg border border-slate-700/80 bg-slate-900/50 p-3 cursor-pointer hover:border-slate-600"
                          >
                            <input
                              type="checkbox"
                              checked={selectedMetricIds.has(m.id)}
                              onChange={() => toggleMetric(m.id)}
                              className="mt-1 rounded border-slate-500 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span>
                              <span className="text-white font-medium block">{m.label}</span>
                              {m.description && (
                                <span className="text-slate-500 text-xs block mt-0.5">{m.description}</span>
                              )}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-4 items-center">
              <button
                type="button"
                disabled={loading || selectedMetricIds.size === 0 || !startDate || !endDate}
                onClick={runQuery}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium"
              >
                <PlayIcon className="w-5 h-5" />
                {loading ? 'Running…' : 'Run report'}
              </button>
              <button
                type="button"
                disabled={!result || loading}
                onClick={downloadCsv}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 border border-slate-600 disabled:opacity-50 text-white font-medium"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
                Download CSV
              </button>
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 text-sm">
                {error}
              </div>
            )}

            {result && (
              <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-xl overflow-hidden">
                <h2 className="text-lg font-semibold text-white mb-2">Results</h2>
                <p className="text-slate-400 text-sm mb-4 border-l-2 border-emerald-500/50 pl-3">
                  {result.filter_summary}
                </p>
                <div className="overflow-x-auto rounded-lg border border-slate-700">
                  <table className="min-w-full text-sm text-left">
                    <thead>
                      <tr className="bg-slate-900/90 text-slate-400 text-xs uppercase tracking-wide">
                        <th className="px-3 py-3 font-semibold sticky left-0 bg-slate-900 z-10">Region</th>
                        <th className="px-3 py-3 font-semibold sticky left-14 bg-slate-900 z-10 min-w-[10rem]">
                          Campus
                        </th>
                        <th className="px-3 py-3 font-semibold text-right">Services</th>
                        {metricIdsInResult.map((mid) => (
                          <th key={mid} className="px-3 py-3 font-semibold text-right whitespace-nowrap">
                            <span className="block">{tableCatalogById[mid]?.label || mid}</span>
                            {tableCatalogById[mid]?.avg_per_service_row ? (
                              <span className="block text-[10px] font-normal text-slate-500 normal-case tracking-normal mt-0.5">
                                avg / service
                              </span>
                            ) : null}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {(result.campuses || []).map((row) => (
                        <tr key={row.campus_id} className="hover:bg-slate-800/50 text-slate-200">
                          <td className="px-3 py-2 sticky left-0 bg-slate-900/95 z-10 text-slate-400">
                            {row.region_code || '—'}
                          </td>
                          <td className="px-3 py-2 sticky left-14 bg-slate-900/95 z-10 font-medium text-white">
                            {row.campus_name}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.service_rows}</td>
                          {metricIdsInResult.map((mid) => (
                            <td key={mid} className="px-3 py-2 text-right tabular-nums">
                              {formatCell(mid, row[mid], tableCatalogById)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-emerald-950/40 text-white font-semibold border-t-2 border-emerald-600/40">
                        <td className="px-3 py-3 sticky left-0 bg-emerald-950/80 z-10" colSpan={2}>
                          All campuses
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {result.meta?.total_service_rows ?? '—'}
                        </td>
                        {metricIdsInResult.map((mid) => (
                          <td key={mid} className="px-3 py-3 text-right tabular-nums">
                            {formatCell(mid, result.totals?.[mid], tableCatalogById)}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {(result.campuses || []).length === 0 && (
                  <p className="text-slate-500 text-sm mt-4">No attendance rows in this range for your filters.</p>
                )}
                {metricIdsInResult.some((mid) => tableCatalogById[mid]?.avg_per_service_row) && (
                  <p className="text-slate-500 text-xs mt-3">
                    Columns marked <span className="text-slate-400">avg / service</span> are means per attendance entry.
                    The <strong className="text-slate-400">All campuses</strong> row uses the same rule across every row
                    in your filter (weighted by how many services each campus has).
                  </p>
                )}
              </div>
            )}

            <p className="text-slate-500 text-sm">
              For PDF charts and year-over-year tables, use{' '}
              <Link to="/reports" className="text-emerald-400 hover:text-emerald-300 underline">
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
