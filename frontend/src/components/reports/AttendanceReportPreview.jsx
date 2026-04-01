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
};

function formatInt(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return Math.round(n).toLocaleString();
}

function pctChange(prev, curr) {
  const p = Number(prev);
  const c = Number(curr);
  if (p === 0 && c === 0) return null;
  if (p === 0) return null;
  return ((c - p) / p) * 100;
}

function DeltaLine({ prev, curr, compareYear, periodLabel }) {
  const pct = pctChange(prev, curr);
  if (pct == null) {
    return (
      <p className="text-sm mt-1" style={{ color: COLORS.muted }}>
        {compareYear
          ? `No change baseline vs ${compareYear}`
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
  if (data.compare && data.totals_previous && data.totals) {
    const wt = data.totals.weekend ?? 0;
    const wp = data.totals_previous.weekend ?? 0;
    if (wp > 0) {
      const p = pctChange(wp, wt);
      if (p != null) {
        if (p > 3) {
          bullets.push(
            `**Weekend** attendance (${data.period_label} totals) is up **${p.toFixed(1)}%** vs ${data.prev_year}.`
          );
        } else if (p < -3) {
          bullets.push(
            `**Weekend** attendance is down **${Math.abs(p).toFixed(1)}%** vs ${data.prev_year}.`
          );
        }
      }
    }
    const nt = data.totals.new_people ?? 0;
    const np = data.totals_previous.new_people ?? 0;
    if (np > 0) {
      const pn = pctChange(np, nt);
      if (pn != null && Math.abs(pn) > 5) {
        bullets.push(
          `**New people** moved **${pn >= 0 ? '+' : ''}${pn.toFixed(0)}%** year-over-year.`
        );
      }
    }
  } else {
    bullets.push('Enable **Include previous year** in the filters above for YoY observations.');
  }
  const sorted = [...data.campus_rows].sort((a, b) => (b.avg_weekend || 0) - (a.avg_weekend || 0));
  const top = sorted[0];
  if (top) {
    bullets.push(
      `**${top.campus_name}** leads on weekend average per service (**${formatInt(top.avg_weekend)}**).`
    );
  }
  return bullets.slice(0, 5);
}

export default function AttendanceReportPreview({
  queryString,
  regionTitle,
  periodLabel,
  year,
}) {
  const [data, setData] = useState(null);
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
        if (!cancelled) setData(j);
      } catch (e) {
        if (!cancelled) {
          setErr(e.message || 'Failed to load preview');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  const campusOnly = useMemo(() => {
    if (!data?.campus_rows) return [];
    return data.campus_rows.filter((r) => !r.is_region_subtotal);
  }, [data]);

  const sortedByWeekend = useMemo(() => {
    return [...campusOnly].sort((a, b) => (b.avg_weekend || 0) - (a.avg_weekend || 0)).slice(0, 12);
  }, [campusOnly]);

  const weekendBarData = useMemo(() => {
    const labels = sortedByWeekend.map((r) =>
      (r.campus_name || '').length > 22 ? `${(r.campus_name || '').slice(0, 20)}…` : r.campus_name
    );
    return {
      labels,
      datasets: [
        {
          label: `${data?.period_label || 'Period'} avg per service`,
          data: sortedByWeekend.map((r) => r.avg_weekend ?? 0),
          backgroundColor: COLORS.blue,
          borderRadius: 6,
          barThickness: 18,
        },
      ],
    };
  }, [sortedByWeekend, data?.period_label]);

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

  const weeklyLineData = useMemo(() => {
    if (!data) return null;
    let series;
    let labels;
    if (data.compare) {
      series = data.weekly_series_current || [];
      labels = data.weekly_labels_current || [];
    } else {
      series = data.weekly_series || [];
      labels = data.weekly_labels || [];
    }
    if (!series.length) return null;
    return {
      labels: labels.length === series.length ? labels : series.map((_, i) => String(i)),
      datasets: [
        {
          label: 'Sunday',
          data: series.map((t) => t[1]),
          borderColor: COLORS.blue,
          backgroundColor: `${COLORS.blue}33`,
          tension: 0.25,
          pointRadius: 3,
          borderWidth: 2,
        },
        {
          label: 'Weekend',
          data: series.map((t) => t[2]),
          borderColor: COLORS.slate,
          backgroundColor: `${COLORS.slate}33`,
          tension: 0.25,
          pointRadius: 3,
          borderWidth: 2,
        },
      ],
    };
  }, [data]);

  const barOptions = useMemo(
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

  const stackedOptions = useMemo(
    () => ({
      ...barOptions,
      plugins: {
        ...barOptions.plugins,
        legend: {
          display: true,
          position: 'top',
          labels: { color: COLORS.muted, boxWidth: 12, font: { size: 11 } },
        },
      },
      scales: {
        ...barOptions.scales,
        x: {
          ...barOptions.scales.x,
          stacked: true,
        },
        y: {
          ...barOptions.scales.y,
          stacked: true,
        },
      },
    }),
    [barOptions]
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

  const insights = useMemo(() => buildInsights(data), [data]);
  const reportTitle = `${data?.period_label || periodLabel} ${year} ${regionTitle}`.trim();
  const compareYear = data?.compare ? data.prev_year : null;
  const plShort = data?.period_label || periodLabel;

  const totalsPrev = data?.totals_previous;

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
        {loading && !data && (
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

        {data && (
          <>
            <header className="mb-8">
              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: COLORS.text }}>
                {reportTitle} attendance report
              </h3>
              <p className="text-sm mt-2" style={{ color: COLORS.muted }}>
                {data.start} → {data.end}
                {data.filter_summary ? ` · ${data.filter_summary}` : ''}
              </p>
              {data.compare && (
                <p className="text-sm mt-1" style={{ color: COLORS.muted }}>
                  YoY: {plShort} {data.prev_year} vs {plShort} {data.year}
                </p>
              )}
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
              <KpiCard
                icon={SunIcon}
                label="Sunday total"
                value={formatInt(data.totals?.sunday)}
                prev={totalsPrev?.sunday}
                curr={data.totals?.sunday}
                compareYear={compareYear}
                periodLabel={plShort}
              />
              <KpiCard
                icon={UserGroupIcon}
                label="Weekend total"
                value={formatInt(data.totals?.weekend)}
                prev={totalsPrev?.weekend}
                curr={data.totals?.weekend}
                compareYear={compareYear}
                periodLabel={plShort}
              />
              <KpiCard
                icon={UserPlusIcon}
                label={data.include_youth_metrics ? 'New people (total)' : 'New people (excl. youth)'}
                value={formatInt(data.totals?.new_people)}
                prev={totalsPrev?.new_people}
                curr={data.totals?.new_people}
                compareYear={compareYear}
                periodLabel={plShort}
              />
              <KpiCard
                icon={HeartIcon}
                label={data.include_youth_metrics ? 'Salvations (total)' : 'Salvations (excl. youth)'}
                value={formatInt(data.totals?.salvations)}
                prev={totalsPrev?.salvations}
                curr={data.totals?.salvations}
                compareYear={compareYear}
                periodLabel={plShort}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div
                className="rounded-xl p-5 shadow-sm border border-slate-100/80"
                style={{ background: COLORS.cardBg }}
              >
                <h4 className="text-base font-semibold mb-4" style={{ color: COLORS.text }}>
                  Top campuses by avg weekend attendance
                </h4>
                <div className="h-72">
                  {sortedByWeekend.length > 0 ? (
                    <Bar data={weekendBarData} options={barOptions} />
                  ) : (
                    <p className="text-sm" style={{ color: COLORS.muted }}>
                      No data
                    </p>
                  )}
                </div>
              </div>
              <div
                className="rounded-xl p-5 shadow-sm border border-slate-100/80"
                style={{ background: COLORS.cardBg }}
              >
                <h4 className="text-base font-semibold mb-4" style={{ color: COLORS.text }}>
                  New people &amp; salvations by campus
                </h4>
                <div className="h-72">
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

            <div
              className="rounded-xl p-5 shadow-sm border border-slate-100/80 mb-8"
              style={{ background: COLORS.cardBg }}
            >
              <h4 className="text-base font-semibold mb-1" style={{ color: COLORS.text }}>
                Weekly attendance trends
              </h4>
              <p className="text-xs mb-4" style={{ color: COLORS.muted }}>
                Sunday vs weekend totals by ISO week (Monday); same scope as PDF charts.
                {data.compare ? ` Showing ${data.year} (${data.period_caption_curr || plShort}).` : ''}
              </p>
              <div className="h-72">
                {weeklyLineData ? (
                  <Line data={weeklyLineData} options={lineOptions} />
                ) : (
                  <p className="text-sm" style={{ color: COLORS.muted }}>
                    No weekly series in this range
                  </p>
                )}
              </div>
            </div>

            <div
              className="rounded-xl p-5 shadow-sm border border-slate-100/80 mb-6"
              style={{ background: COLORS.cardBg }}
            >
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
          </>
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
