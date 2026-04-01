import React, { useEffect, useMemo, useState } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import {
  ArrowPathIcon,
  PrinterIcon,
  UserGroupIcon,
  SunIcon,
  UserPlusIcon,
  HeartIcon,
} from '@heroicons/react/24/outline';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const COLORS = {
  blue: '#4A90E2',
  blueLight: '#93c5fd',
  purple: '#805AD5',
  slate: '#64748b',
  green: '#48BB78',
  red: '#E53E3E',
  text: '#2D3748',
  muted: '#718096',
  cardBg: '#ffffff',
  pageBg: '#edf2f7',
  /** Match PDF YoY weekend bar chart (`_chart_bar_weekend_compare_compact`). */
  yoyPrior: '#ea580c',
  yoyCurr: '#2563eb',
  sunBar: '#2563eb',
  wkndBar: '#64748b',
};

function weeklyLineChartData(series, labels) {
  if (!series?.length) return null;
  const lab = labels?.length === series.length ? labels : series.map((_, i) => String(i));
  return {
    labels: lab,
    datasets: [
      {
        label: 'Sunday',
        data: series.map((t) => t[1]),
        borderColor: COLORS.yoyCurr,
        backgroundColor: `${COLORS.yoyCurr}22`,
        tension: 0.25,
        pointRadius: 3,
        borderWidth: 2,
      },
      {
        label: 'Weekend',
        data: series.map((t) => t[2]),
        borderColor: COLORS.slate,
        backgroundColor: `${COLORS.slate}22`,
        tension: 0.25,
        pointRadius: 3,
        borderWidth: 2,
      },
    ],
  };
}

function formatInt(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return Math.round(n).toLocaleString();
}

/** Attendance averages (Sunday / weekend) — one decimal, matches PDF “avg per service”. */
function formatAvg(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const x = Number(n);
  return x.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

function pctChange(prev, curr) {
  const p = Number(prev);
  const c = Number(curr);
  if (!Number.isFinite(p) || !Number.isFinite(c)) return null;
  if (p === 0 && c === 0) return null;
  if (p === 0) return null;
  const out = ((c - p) / p) * 100;
  return Number.isFinite(out) ? out : null;
}

function DeltaLine({ prev, curr, compareYear, periodLabel }) {
  const pct = pctChange(prev, curr);
  if (pct == null || Number.isNaN(pct)) {
    return (
      <p className="text-sm mt-1" style={{ color: COLORS.muted }}>
        {compareYear
          ? `No comparable prior-year average (missing data or zero baseline)`
          : `Turn on “Include previous year” for YoY change`}
      </p>
    );
  }
  const up = pct >= 0;
  return (
    <p
      className="text-sm font-medium mt-1 flex items-center gap-1"
      style={{ color: up ? COLORS.green : COLORS.red }}
    >
      <span>{up ? '↑' : '↓'}</span>
      {up ? '+' : ''}
      {pct.toFixed(1)}% vs {periodLabel} {compareYear}
    </p>
  );
}

function KpiCard({ icon: Icon, label, value, prev, curr, compareYear, periodLabel }) {
  return (
    <div
      className="rounded-xl p-5 shadow-sm border border-slate-100/80"
      style={{ background: COLORS.cardBg }}
    >
      <div className="flex items-start gap-3">
        <div
          className="p-2 rounded-lg"
          style={{ background: `${COLORS.blue}18`, color: COLORS.blue }}
        >
          <Icon className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium" style={{ color: COLORS.muted }}>
            {label}
          </p>
          <p className="text-2xl font-bold mt-0.5 tabular-nums" style={{ color: COLORS.text }}>
            {value}
          </p>
          <DeltaLine prev={prev} curr={curr} compareYear={compareYear} periodLabel={periodLabel} />
        </div>
      </div>
    </div>
  );
}

function renderInsightText(text) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} style={{ color: COLORS.text }}>
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function buildInsights(data) {
  const bullets = [];
  if (!data?.campus_rows?.length) {
    return ['No campus rows in this scope — widen region or campus filters.'];
  }
  const isCampusSlice = Boolean(data.kpi_totals);
  const t = isCampusSlice ? data.kpi_totals : data.totals;
  const tp = isCampusSlice ? data.kpi_totals_previous : data.totals_previous;

  if (data.compare && tp && t) {
    const wt = t.avg_weekend ?? 0;
    const wp = tp.avg_weekend ?? 0;
    if (wp > 0) {
      const p = pctChange(wp, wt);
      if (p != null && !Number.isNaN(p)) {
        if (p > 3) {
          bullets.push(
            `**Weekend average** (per service) is up **${p.toFixed(1)}%** vs ${data.prev_year}.`
          );
        } else if (p < -3) {
          bullets.push(
            `**Weekend average** (per service) is down **${Math.abs(p).toFixed(1)}%** vs ${data.prev_year}.`
          );
        }
      }
    }
    const nt = t.new_people ?? 0;
    const np = tp.new_people ?? 0;
    if (np > 0) {
      const pn = pctChange(np, nt);
      if (pn != null && Math.abs(pn) > 5) {
        bullets.push(
          `**New people** moved **${pn >= 0 ? '+' : ''}${pn.toFixed(0)}%** year-over-year.`
        );
      }
    }
  } else if (!data.compare) {
    bullets.push('Enable **Include previous year** in the filters above for YoY observations.');
  }
  if (isCampusSlice) {
    const row = data.campus_rows[0];
    if (row) {
      bullets.push(
        `**${row.campus_name}** — weekend average **${formatAvg(row.avg_weekend)}** per service this period.`
      );
    }
  } else {
    const sorted = [...data.campus_rows].sort((a, b) => (b.avg_weekend || 0) - (a.avg_weekend || 0));
    const top = sorted[0];
    if (top) {
      bullets.push(
        `**${top.campus_name}** leads on weekend average per service (**${formatAvg(top.avg_weekend)}**).`
      );
    }
  }
  return bullets.slice(0, 5);
}

/** One dashboard (combined report or a single per-campus slice from the API). */
function AttendanceReportDashboard({ data, regionTitle, periodLabel, year: yearProp }) {
  const isCampusSlice = Boolean(data?.kpi_totals);
  const kpi = data.kpi_totals || data.totals;
  const kpiPrev = data.kpi_totals_previous || data.totals_previous;
  const year = data.year ?? yearProp;
  const plShort = data.period_label || periodLabel;
  const compareYear = data.compare ? data.prev_year : null;
  const campusRow = data.campus_rows?.[0];

  const campusOnly = useMemo(() => {
    if (!data?.campus_rows) return [];
    return data.campus_rows.filter((r) => !r.is_region_subtotal);
  }, [data]);

  const sortedByWeekend = useMemo(() => {
    return [...campusOnly].sort((a, b) => (b.avg_weekend || 0) - (a.avg_weekend || 0)).slice(0, 12);
  }, [campusOnly]);

  const truncLabel = (name, max) => {
    const s = name || '';
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
  };

  /** PDF YoY top chart: weekend avg prior vs current, vertical grouped bars. */
  const yoyWeekendBarData = useMemo(() => {
    if (!data?.compare) return null;
    const rows = sortedByWeekend;
    return {
      labels: rows.map((r) => truncLabel(r.campus_name, 14)),
      datasets: [
        {
          label: String(data.prev_year),
          data: rows.map((r) => Number(r.prev_avg_weekend) || 0),
          backgroundColor: COLORS.yoyPrior,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: String(data.year),
          data: rows.map((r) => Number(r.avg_weekend) || 0),
          backgroundColor: COLORS.yoyCurr,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    };
  }, [data?.compare, data?.prev_year, data?.year, sortedByWeekend]);

  /** PDF single-year top chart: Sunday vs weekend avg per campus (vertical grouped). */
  const singleYearSunWeekendBarData = useMemo(() => {
    if (data?.compare) return null;
    const rows = sortedByWeekend;
    return {
      labels: rows.map((r) => truncLabel(r.campus_name, 14)),
      datasets: [
        {
          label: 'Sunday (no youth)',
          data: rows.map((r) => Number(r.avg_sunday) || 0),
          backgroundColor: COLORS.sunBar,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Weekend (w/ youth)',
          data: rows.map((r) => Number(r.avg_weekend) || 0),
          backgroundColor: COLORS.wkndBar,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    };
  }, [data?.compare, sortedByWeekend]);

  const stackedBarData = useMemo(() => {
    const labels = sortedByWeekend.map((r) =>
      (r.campus_name || '').length > 18 ? `${(r.campus_name || '').slice(0, 16)}…` : r.campus_name
    );
    return {
      labels,
      datasets: [
        {
          label: 'New people',
          data: sortedByWeekend.map((r) => r.total_new_people ?? 0),
          backgroundColor: COLORS.blueLight,
          stack: 'm',
          borderRadius: { topLeft: 4, bottomLeft: 4, topRight: 0, bottomRight: 0 },
        },
        {
          label: 'Salvations',
          data: sortedByWeekend.map((r) => r.total_salvations ?? 0),
          backgroundColor: COLORS.purple,
          stack: 'm',
          borderRadius: { topLeft: 0, bottomLeft: 0, topRight: 4, bottomRight: 4 },
        },
      ],
    };
  }, [sortedByWeekend]);

  /** Single-period: one chart (matches PDF weekly line). */
  const weeklyLineDataSingle = useMemo(() => {
    if (!data || data.compare) return null;
    return weeklyLineChartData(data.weekly_series || [], data.weekly_labels || []);
  }, [data]);

  /** YoY: two panels like PDF dual weekly charts. */
  const weeklyLineDataComparePrev = useMemo(() => {
    if (!data?.compare) return null;
    return weeklyLineChartData(data.weekly_series_previous || [], data.weekly_labels_previous || []);
  }, [data]);

  const weeklyLineDataCompareCurr = useMemo(() => {
    if (!data?.compare) return null;
    return weeklyLineChartData(data.weekly_series_current || [], data.weekly_labels_current || []);
  }, [data]);

  const barOptionsHorizontal = useMemo(
    () => ({
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#f8fafc',
          bodyColor: '#e2e8f0',
        },
      },
      scales: {
        x: {
          grid: { color: '#e2e8f0' },
          ticks: { color: COLORS.muted, font: { size: 11 } },
        },
        y: {
          grid: { display: false },
          ticks: { color: COLORS.text, font: { size: 11 } },
        },
      },
    }),
    []
  );

  /** Vertical grouped bars (YoY weekend or single-year Sun vs weekend). */
  const barOptionsVerticalGrouped = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: COLORS.muted, boxWidth: 12, font: { size: 11 } },
        },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#f8fafc',
          bodyColor: '#e2e8f0',
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: COLORS.text, maxRotation: 50, minRotation: 25, font: { size: 9 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: '#e2e8f0' },
          ticks: { color: COLORS.muted, font: { size: 10 } },
        },
      },
    }),
    []
  );

  const stackedOptions = useMemo(
    () => ({
      ...barOptionsHorizontal,
      plugins: {
        ...barOptionsHorizontal.plugins,
        legend: {
          display: true,
          position: 'top',
          labels: { color: COLORS.muted, boxWidth: 12, font: { size: 11 } },
        },
      },
      scales: {
        ...barOptionsHorizontal.scales,
        x: {
          ...barOptionsHorizontal.scales.x,
          stacked: true,
        },
        y: {
          ...barOptionsHorizontal.scales.y,
          stacked: true,
        },
      },
    }),
    [barOptionsHorizontal]
  );

  const lineOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { color: COLORS.muted, font: { size: 11 } },
        },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#f8fafc',
          bodyColor: '#e2e8f0',
        },
      },
      scales: {
        x: {
          grid: { color: '#e2e8f0' },
          ticks: { color: COLORS.muted, maxRotation: 45, font: { size: 10 } },
        },
        y: {
          grid: { color: '#e2e8f0' },
          ticks: {
            color: COLORS.muted,
            callback: (v) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K` : v),
          },
        },
      },
    }),
    []
  );

  const lineOptionsCompact = useMemo(
    () => ({
      ...lineOptions,
      plugins: {
        ...lineOptions.plugins,
        legend: {
          ...lineOptions.plugins.legend,
          labels: { color: COLORS.muted, font: { size: 10 }, boxWidth: 10 },
        },
      },
      scales: {
        ...lineOptions.scales,
        x: {
          ...lineOptions.scales.x,
          ticks: { ...lineOptions.scales.x.ticks, font: { size: 9 } },
        },
      },
    }),
    [lineOptions]
  );

  const insights = useMemo(() => buildInsights(data), [data]);
  const reportTitleCombined = `${plShort} ${year} ${regionTitle}`.trim();
  const incYouth = data.include_youth_metrics !== false;

  const primaryBarTitle = (() => {
    if (data.compare) {
      return isCampusSlice
        ? `Weekend (incl. youth) — YoY ${data.prev_year} vs ${data.year}`
        : `Weekend (incl. youth) — YoY by campus (${data.prev_year} vs ${data.year})`;
    }
    return isCampusSlice
      ? 'Sunday vs weekend (avg per service — this campus)'
      : 'Sunday vs weekend (avg per service by campus)';
  })();

  const primaryBarSubtitle = data.compare
    ? 'Matches PDF: prior year = orange, current year = blue (weekend average per service).'
    : 'Matches PDF: Sun vs weekend vertical bar — same averages as the downloadable report.';

  const stackedChartTitle = isCampusSlice
    ? `New people & salvations (${plShort} totals — this campus)`
    : `New people & salvations (${plShort} totals by campus)`;
  const stackedSubtitle = data.compare
    ? `Current year ${data.year} ${plShort} totals per campus (same period columns as PDF table).${incYouth ? '' : ' Youth excluded from NP & salvations (same as PDF).'}`
    : `${plShort} totals.${incYouth ? '' : ' Youth excluded from NP & salvations (same as PDF).'}`;

  const kpiScopeNote = isCampusSlice ? (
    <p className="mb-2">
      <strong style={{ color: COLORS.text }}>Sunday</strong> and{' '}
      <strong style={{ color: COLORS.text }}>Weekend</strong> KPIs are{' '}
      <strong style={{ color: COLORS.text }}>this campus’s averages per service row</strong>. New people and
      salvations are <strong style={{ color: COLORS.text }}>this campus’s {plShort} totals</strong>. The PDF table
      still shows <strong style={{ color: COLORS.text }}>% share</strong> against all campuses in your filter.
    </p>
  ) : (
    <p className="mb-2">
      <strong style={{ color: COLORS.text }}>Sunday</strong> and{' '}
      <strong style={{ color: COLORS.text }}>Weekend</strong> KPIs above are{' '}
      <strong style={{ color: COLORS.text }}>averages per service row</strong> across all campuses in scope (same
      basis as the PDF “Sunday avg” / “Weekend avg” columns).
    </p>
  );

  return (
    <div className="pb-10 last:pb-4 border-b border-slate-300/80 last:border-0">
      <header className="mb-8">
        {isCampusSlice && campusRow ? (
          <>
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: COLORS.text }}>
              {campusRow.campus_name}
            </h3>
            <p className="text-sm mt-2" style={{ color: COLORS.muted }}>
              {plShort} {year} · {regionTitle} · {data.start} → {data.end}
              {data.filter_summary ? ` · ${data.filter_summary}` : ''}
            </p>
          </>
        ) : (
          <>
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: COLORS.text }}>
              {reportTitleCombined} attendance report
            </h3>
            <p className="text-sm mt-2" style={{ color: COLORS.muted }}>
              {data.start} → {data.end}
              {data.filter_summary ? ` · ${data.filter_summary}` : ''}
            </p>
          </>
        )}
        {data.compare && (
          <p className="text-sm mt-1" style={{ color: COLORS.muted }}>
            YoY: {plShort} {data.prev_year} vs {plShort} {data.year}
            {data.period_caption_prev && data.period_caption_curr
              ? ` · ${data.period_caption_prev} vs ${data.period_caption_curr}`
              : ''}
          </p>
        )}
        <p className="text-xs mt-3 rounded-lg border border-slate-200 bg-white/90 px-3 py-2" style={{ color: COLORS.muted }}>
          <strong style={{ color: COLORS.text }}>Same data as download:</strong> PDF and CSV use the same filters,
          period rules, and <strong style={{ color: COLORS.text }}>attendance_records</strong> fields as this preview.
        </p>
        {!incYouth && (
          <div
            className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm"
            style={{ color: '#744210' }}
          >
            <strong>Exclude youth</strong> is on: new people and salvations match the PDF/CSV (FTV + visitors only; no
            youth salvations). Sunday and weekend attendance still include kids on Sunday and youth in weekend totals.
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <KpiCard
          icon={SunIcon}
          label="Sunday average"
          value={formatAvg(kpi?.avg_sunday)}
          prev={kpiPrev?.avg_sunday}
          curr={kpi?.avg_sunday}
          compareYear={compareYear}
          periodLabel={plShort}
        />
        <KpiCard
          icon={UserGroupIcon}
          label="Weekend average"
          value={formatAvg(kpi?.avg_weekend)}
          prev={kpiPrev?.avg_weekend}
          curr={kpi?.avg_weekend}
          compareYear={compareYear}
          periodLabel={plShort}
        />
        <KpiCard
          icon={UserPlusIcon}
          label={data.include_youth_metrics ? 'New people (total)' : 'New people (excl. youth)'}
          value={formatInt(kpi?.new_people)}
          prev={kpiPrev?.new_people}
          curr={kpi?.new_people}
          compareYear={compareYear}
          periodLabel={plShort}
        />
        <KpiCard
          icon={HeartIcon}
          label={data.include_youth_metrics ? 'Salvations (total)' : 'Salvations (excl. youth)'}
          value={formatInt(kpi?.salvations)}
          prev={kpiPrev?.salvations}
          curr={kpi?.salvations}
          compareYear={compareYear}
          periodLabel={plShort}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="rounded-xl p-5 shadow-sm border border-slate-100/80" style={{ background: COLORS.cardBg }}>
          <h4 className="text-base font-semibold mb-1" style={{ color: COLORS.text }}>
            {primaryBarTitle}
          </h4>
          <p className="text-xs mb-4" style={{ color: COLORS.muted }}>
            {primaryBarSubtitle}
          </p>
          <div className="h-80">
            {sortedByWeekend.length > 0 ? (
              <Bar
                data={data.compare ? yoyWeekendBarData : singleYearSunWeekendBarData}
                options={barOptionsVerticalGrouped}
              />
            ) : (
              <p className="text-sm" style={{ color: COLORS.muted }}>
                No data
              </p>
            )}
          </div>
        </div>
        <div className="rounded-xl p-5 shadow-sm border border-slate-100/80" style={{ background: COLORS.cardBg }}>
          <h4 className="text-base font-semibold mb-1" style={{ color: COLORS.text }}>
            {stackedChartTitle}
          </h4>
          <p className="text-xs mb-4" style={{ color: COLORS.muted }}>
            {stackedSubtitle}
          </p>
          <div className="h-80">
            {sortedByWeekend.length > 0 ? (
              <Bar data={stackedBarData} options={stackedOptions} />
            ) : (
              <p className="text-sm" style={{ color: COLORS.muted }}>
                No data
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl p-5 shadow-sm border border-slate-100/80 mb-8" style={{ background: COLORS.cardBg }}>
        <h4 className="text-base font-semibold mb-1" style={{ color: COLORS.text }}>
          Weekly attendance trends
        </h4>
        <p className="text-xs mb-4" style={{ color: COLORS.muted }}>
          Sunday vs weekend totals by ISO week (Monday); same aggregation as PDF weekly charts.
          {isCampusSlice ? ' This campus only.' : ''}
        </p>
        {data.compare ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <h5 className="text-sm font-semibold mb-2" style={{ color: COLORS.text }}>
                {data.prev_year}
                {data.period_caption_prev ? ` · ${data.period_caption_prev}` : ''}
              </h5>
              <div className="h-64">
                {weeklyLineDataComparePrev ? (
                  <Line data={weeklyLineDataComparePrev} options={lineOptionsCompact} />
                ) : (
                  <p className="text-sm" style={{ color: COLORS.muted }}>
                    No weekly data
                  </p>
                )}
              </div>
            </div>
            <div>
              <h5 className="text-sm font-semibold mb-2" style={{ color: COLORS.text }}>
                {data.year}
                {data.period_caption_curr ? ` · ${data.period_caption_curr}` : ''}
              </h5>
              <div className="h-64">
                {weeklyLineDataCompareCurr ? (
                  <Line data={weeklyLineDataCompareCurr} options={lineOptionsCompact} />
                ) : (
                  <p className="text-sm" style={{ color: COLORS.muted }}>
                    No weekly data
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-72">
            {weeklyLineDataSingle ? (
              <Line data={weeklyLineDataSingle} options={lineOptions} />
            ) : (
              <p className="text-sm" style={{ color: COLORS.muted }}>
                No weekly series in this range
              </p>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl p-5 shadow-sm border border-slate-100/80 mb-2" style={{ background: COLORS.cardBg }}>
        <h4 className="text-base font-semibold mb-3" style={{ color: COLORS.text }}>
          Key observations
        </h4>
        <ul className="list-disc pl-5 space-y-2 text-sm" style={{ color: COLORS.muted }}>
          {insights.map((line, i) => (
            <li key={i}>{renderInsightText(line)}</li>
          ))}
        </ul>
        <div className="mt-6 pt-4 border-t border-slate-200 text-xs leading-relaxed" style={{ color: COLORS.muted }}>
          <p className="font-semibold mb-1" style={{ color: COLORS.text }}>
            Definitions
          </p>
          {kpiScopeNote}
          <p>
            <strong style={{ color: COLORS.text }}>Sunday</strong> = adults + saints + kids (no youth).{' '}
            <strong style={{ color: COLORS.text }}>Weekend</strong> = Sunday + youth + youth leaders.{' '}
            <strong style={{ color: COLORS.text }}>New people</strong> and{' '}
            <strong style={{ color: COLORS.text }}>salvations</strong> come from Pulse attendance records
            {data.include_youth_metrics
              ? ' (including youth new people and youth salvations where recorded).'
              : ' (youth excluded from both when that filter is on).'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AttendanceReportPreview({ queryString, regionTitle, periodLabel, year }) {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const r = await fetch(`/api/reports/quarterly-attendance.json?${queryString}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
        if (!cancelled) setPayload(j);
      } catch (e) {
        if (!cancelled) {
          setErr(e.message || 'Failed to load preview');
          setPayload(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  return (
    <div
      id="attendance-report-print-root"
      className="mt-10 rounded-2xl overflow-hidden border border-slate-600 print:border-0 print:shadow-none"
      style={{ background: COLORS.pageBg }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-200/80 bg-white/90 no-print">
        <h2 className="text-lg font-semibold" style={{ color: COLORS.text }}>
          Report preview
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-800 text-white hover:bg-slate-700"
          >
            <PrinterIcon className="w-4 h-4" />
            Print / Save PDF
          </button>
        </div>
      </div>

      <div className="p-6 sm:p-8 print:p-4">
        {loading && !payload && (
          <div className="flex items-center gap-2 text-slate-500 py-12 justify-center">
            <ArrowPathIcon className="w-5 h-5 animate-spin" />
            Loading report…
          </div>
        )}

        {err && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm mb-6">
            {err}
          </div>
        )}

        {payload && payload.per_campus && Array.isArray(payload.campuses) && (
          <>
            <header className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.muted }}>
                One dashboard per campus (same layout as PDF per-campus download)
              </p>
              <h3 className="text-xl font-bold mt-1" style={{ color: COLORS.text }}>
                {payload.period_label} {payload.year} · {regionTitle}
              </h3>
              <p className="text-sm mt-2" style={{ color: COLORS.muted }}>
                {payload.start} → {payload.end}
                {payload.filter_summary ? ` · ${payload.filter_summary}` : ''}
                {payload.compare ? ` · YoY vs ${payload.prev_year}` : ''}
              </p>
              <p className="text-xs mt-3 rounded-lg border border-slate-200 bg-white/90 px-3 py-2" style={{ color: COLORS.muted }}>
                <strong style={{ color: COLORS.text }}>Same data as download</strong> for these filters — each block
                matches one PDF page when &quot;one page per campus&quot; is enabled.
              </p>
              {payload.include_youth_metrics === false && (
                <div
                  className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm"
                  style={{ color: '#744210' }}
                >
                  <strong>Exclude youth</strong> applies to new people &amp; salvations on every campus below (same as
                  PDF/CSV).
                </div>
              )}
            </header>
            {payload.campuses.length === 0 ? (
              <p className="text-sm" style={{ color: COLORS.muted }}>
                No campuses in this filter.
              </p>
            ) : (
              payload.campuses.map((slice, idx) => (
                <AttendanceReportDashboard
                  key={slice.campus_rows?.[0]?.campus_id ?? idx}
                  data={slice}
                  regionTitle={regionTitle}
                  periodLabel={periodLabel}
                  year={year}
                />
              ))
            )}
          </>
        )}

        {payload && !payload.per_campus && (
          <AttendanceReportDashboard
            data={payload}
            regionTitle={regionTitle}
            periodLabel={periodLabel}
            year={year}
          />
        )}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
