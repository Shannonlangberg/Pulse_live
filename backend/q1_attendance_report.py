"""
Quarterly / YTD attendance aggregates for PDF/CSV reports (Q1–Q4 and YTD).
Sunday total and weekend total match regional dashboard per-record logic.
"""
from __future__ import annotations

import calendar
import csv
import io
from collections import defaultdict
from datetime import date, timedelta
from typing import Any, Dict, List, Tuple

# API / UI: ?period=q1|q2|q3|q4|ytd
VALID_REPORT_PERIODS = frozenset({"q1", "q2", "q3", "q4", "ytd"})
PERIOD_LABELS = {"q1": "Q1", "q2": "Q2", "q3": "Q3", "q4": "Q4", "ytd": "YTD"}


def normalized_report_period(raw: str | None) -> str:
    p = (raw or "q1").strip().lower()
    return p if p in VALID_REPORT_PERIODS else "q1"


def format_period_caption(start: date, end: date, period_code: str) -> str:
    """Short subtitle for PDF/CSV (e.g. Jan–Mar, or concrete dates for YTD)."""
    y = start.year
    if start.year == end.year:
        if period_code == "q1" and start == date(y, 1, 1) and end == date(y, 3, 31):
            return "Jan–Mar"
        if period_code == "q2" and start == date(y, 4, 1) and end == date(y, 6, 30):
            return "Apr–Jun"
        if period_code == "q3" and start == date(y, 7, 1) and end == date(y, 9, 30):
            return "Jul–Sep"
        if period_code == "q4" and start == date(y, 10, 1) and end == date(y, 12, 31):
            return "Oct–Dec"
    return f"{start.strftime('%d %b')} – {end.strftime('%d %b %Y')}"


def ytd_end_for_prior_year_yoy(end_current: date, prev_year: int) -> date:
    """Align YTD YoY: same month/day in prior year (handles month length)."""
    m, d = end_current.month, end_current.day
    last = calendar.monthrange(prev_year, m)[1]
    return date(prev_year, m, min(d, last))


def report_range_for_year_period(
    year: int,
    period: str,
    *,
    today: date | None = None,
) -> Tuple[date, date, str, str, str]:
    """
    Calendar range for the report year and period.
    Returns (start, end, period_code, period_label, period_caption).
    YTD: Jan 1 through min(today, Dec 31) when year is the current calendar year;
         full Jan 1 – Dec 31 for past years; for future years, through Dec 31 of that year.
    """
    p = normalized_report_period(period)
    t = today or date.today()
    label = PERIOD_LABELS[p]
    if p == "q1":
        s, e = date(year, 1, 1), date(year, 3, 31)
    elif p == "q2":
        s, e = date(year, 4, 1), date(year, 6, 30)
    elif p == "q3":
        s, e = date(year, 7, 1), date(year, 9, 30)
    elif p == "q4":
        s, e = date(year, 10, 1), date(year, 12, 31)
    else:
        s = date(year, 1, 1)
        if year < t.year:
            e = date(year, 12, 31)
        elif year > t.year:
            e = date(year, 12, 31)
        else:
            e = min(t, date(year, 12, 31))
    cap = format_period_caption(s, e, p)
    return s, e, p, label, cap

# Matplotlib non-interactive backend for servers
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

# Raster chart resolution for PDF embedding (higher = sharper when scaled to page width).
_PDF_CHART_DPI = 200
_PDF_CHART_DPI_SHARP = 280  # YoY bar + compact weekly (crisp axis labels in PDF)
_PDF_CHART_DPI_LEGACY = 160  # non-compact charts (taller figures)

# Must match single-campus branch of _chart_bar_weekend_compare_compact (figsize inches).
_YOY_WEEKEND_BAR_SINGLE_FIG_W = 4.9
_YOY_WEEKEND_BAR_SINGLE_FIG_H = 3.05


def _rl_image_yoy_weekend_bar_single(buf: io.BytesIO, target_w: float, *, max_h: float) -> Any:
    """
    ReportLab Image with explicit W×H from figure aspect ratio.
    Width-only Images can get a huge auto-height from PNG + title text, causing LayoutError
    when the flowable no longer fits the frame on per-campus PDF pages.
    """
    from reportlab.platypus import Image as RLImage

    buf.seek(0)
    aspect = _YOY_WEEKEND_BAR_SINGLE_FIG_H / _YOY_WEEKEND_BAR_SINGLE_FIG_W
    w = target_w
    h = w * aspect
    if h > max_h:
        h = max_h
        w = max_h / aspect
    return RLImage(buf, width=w, height=h, hAlign="CENTER")


def _week_key_chart(record_date: date) -> str:
    """Align with dashboard YTD week columns (Mon–Sun); Mon/Tue → prior Sunday's week."""
    rd = record_date
    if rd.weekday() in (0, 1):
        rd = rd - timedelta(days=(rd.weekday() + 1) % 7)
    monday = rd - timedelta(days=rd.weekday())
    year, week_num, _ = monday.isocalendar()
    return f"{year}-W{week_num:02d}"


def _week_key_to_month_label(week_key: str) -> str:
    """Map '2025-W01' to short month (ISO Monday's month), e.g. Jan."""
    try:
        parts = week_key.split("-W")
        if len(parts) != 2:
            return week_key
        y, wn = int(parts[0]), int(parts[1])
        monday = date.fromisocalendar(y, wn, 1)
        return monday.strftime("%b")
    except (ValueError, IndexError, OSError):
        return week_key


def _week_series_xtick_labels(series: List[Tuple]) -> List[str]:
    """Month labels; repeat months blanked so the axis stays readable."""
    labels: List[str] = []
    prev_m: str | None = None
    for s in series:
        m = _week_key_to_month_label(s[0])
        if m == prev_m:
            labels.append("")
        else:
            labels.append(m)
            prev_m = m
    return labels


def record_sunday_and_weekend_totals(record) -> Tuple[int, int]:
    """
    Sunday attendance (adults+saints+kids, no youth) and weekend (+ youth + youth leaders).
    Mirrors regional YTD weekly aggregation.
    """
    record_kids = (record.kids_attendance or 0) + (record.kids_leaders or 0)
    record_total = record.total_attendance or 0
    if record_total < record_kids:
        adults_and_saints = record_total
    else:
        adults_and_saints = max(0, record_total - record_kids)
    sunday = adults_and_saints + record_kids
    youth = (record.youth_attendance or 0) + (record.youth_leaders or 0)
    weekend = sunday + youth
    return sunday, weekend


def record_new_people_total(record, sheet_new_people: int | None = None) -> int:
    """
    FTV + visitors + youth new people (same components as regional dashboard).
    If Google Stats has a 'New People' aggregate and the DB breakdown is lower
    (common for legacy imports), use max(component_sum, sheet) so Q1 matches the sheet.
    """
    comp = (record.first_time_visitors or 0) + (record.visitors or 0) + (record.youth_new_people or 0)
    sp = int(sheet_new_people or 0)
    if sp > 0:
        return max(comp, sp)
    return comp


def record_salvations_total(record, sheet_salvations_fallback: int | None = None) -> int:
    """
    FTC + rededications + youth + kids salvations.
    When that sum is zero, use salvation_cards_returned and/or sheet-derived salvations
    (aggregates + detailed columns from Stats).
    """
    base = (
        (record.first_time_christians or 0)
        + (record.rededications or 0)
        + (record.youth_salvations or 0)
        + (record.new_kids_salvations or 0)
    )
    if base > 0:
        return base
    sc = int(record.salvation_cards_returned or 0)
    sh = int(sheet_salvations_fallback or 0)
    return max(sc, sh)


def _region_aggregate_rows(campus_rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """One subtotal row per region code present in campus rows."""
    by_reg: Dict[str, Dict[str, int]] = defaultdict(
        lambda: {
            "service_rows": 0,
            "total_sunday": 0,
            "total_weekend": 0,
            "total_new_people": 0,
            "total_salvations": 0,
        }
    )
    for r in campus_rows:
        reg = (r.get("region") or "").strip() or "—"
        b = by_reg[reg]
        b["service_rows"] += r["service_rows"]
        b["total_sunday"] += r["total_sunday"]
        b["total_weekend"] += r["total_weekend"]
        b["total_new_people"] += r["total_new_people"]
        b["total_salvations"] += r["total_salvations"]
    out: List[Dict[str, Any]] = []
    for reg in sorted(by_reg.keys(), key=lambda x: (x == "—", x)):
        agg = by_reg[reg]
        n = agg["service_rows"] or 1
        out.append(
            {
                "is_region_subtotal": True,
                "campus_name": f"Region total — {reg}",
                "region": reg,
                "service_rows": agg["service_rows"],
                "total_sunday": agg["total_sunday"],
                "total_weekend": agg["total_weekend"],
                "avg_sunday": round(agg["total_sunday"] / n, 1),
                "avg_weekend": round(agg["total_weekend"] / n, 1),
                "total_new_people": agg["total_new_people"],
                "total_salvations": agg["total_salvations"],
            }
        )
    return out


def _region_aggregate_rows_compare(merged_campus_rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    by_reg: Dict[str, Dict[str, int]] = defaultdict(
        lambda: {
            "prev_service_rows": 0,
            "service_rows": 0,
            "prev_total_sunday": 0,
            "prev_total_weekend": 0,
            "prev_total_new_people": 0,
            "prev_total_salvations": 0,
            "total_sunday": 0,
            "total_weekend": 0,
            "total_new_people": 0,
            "total_salvations": 0,
        }
    )
    for r in merged_campus_rows:
        reg = (r.get("region") or "").strip() or "—"
        b = by_reg[reg]
        b["prev_service_rows"] += r["prev_service_rows"]
        b["service_rows"] += r["service_rows"]
        b["prev_total_sunday"] += r["prev_total_sunday"]
        b["prev_total_weekend"] += r["prev_total_weekend"]
        b["prev_total_new_people"] += r["prev_total_new_people"]
        b["prev_total_salvations"] += r["prev_total_salvations"]
        b["total_sunday"] += r["total_sunday"]
        b["total_weekend"] += r["total_weekend"]
        b["total_new_people"] += r["total_new_people"]
        b["total_salvations"] += r["total_salvations"]
    out: List[Dict[str, Any]] = []
    for reg in sorted(by_reg.keys(), key=lambda x: (x == "—", x)):
        agg = by_reg[reg]
        n_p = agg["prev_service_rows"] or 1
        n_c = agg["service_rows"] or 1
        out.append(
            {
                "is_region_subtotal": True,
                "campus_name": f"Region total — {reg}",
                "region": reg,
                "prev_service_rows": agg["prev_service_rows"],
                "service_rows": agg["service_rows"],
                "prev_total_sunday": agg["prev_total_sunday"],
                "prev_total_weekend": agg["prev_total_weekend"],
                "prev_avg_sunday": round(agg["prev_total_sunday"] / n_p, 1) if agg["prev_service_rows"] else 0.0,
                "prev_avg_weekend": round(agg["prev_total_weekend"] / n_p, 1) if agg["prev_service_rows"] else 0.0,
                "prev_total_new_people": agg["prev_total_new_people"],
                "prev_total_salvations": agg["prev_total_salvations"],
                "total_sunday": agg["total_sunday"],
                "total_weekend": agg["total_weekend"],
                "avg_sunday": round(agg["total_sunday"] / n_c, 1) if agg["service_rows"] else 0.0,
                "avg_weekend": round(agg["total_weekend"] / n_c, 1) if agg["service_rows"] else 0.0,
                "total_new_people": agg["total_new_people"],
                "total_salvations": agg["total_salvations"],
            }
        )
    return out


def build_q1_data(
    year: int,
    records: List[Any],
    campuses_by_id: Dict[int, Any],
    filter_summary: str = "",
    sheet_enrichment: Dict[Tuple[str, date], Dict[str, int]] | None = None,
    *,
    start: date | None = None,
    end: date | None = None,
    period_code: str = "q1",
    period_label: str = "Q1",
    period_caption: str = "Jan–Mar",
) -> Dict[str, Any]:
    """Aggregate by campus and by global week within ``start``..``end`` (inclusive)."""
    if start is None:
        start = date(year, 1, 1)
    if end is None:
        end = date(year, 3, 31)

    by_campus: Dict[int, Dict[str, Any]] = defaultdict(
        lambda: {
            "service_rows": 0,
            "total_sunday": 0,
            "total_weekend": 0,
            "total_new_people": 0,
            "total_salvations": 0,
        }
    )
    weekly: Dict[str, Dict[str, int]] = defaultdict(lambda: {"sunday": 0, "weekend": 0})
    weekly_by_campus: Dict[int, Dict[str, Dict[str, int]]] = defaultdict(
        lambda: defaultdict(lambda: {"sunday": 0, "weekend": 0})
    )

    for r in records:
        d = r.date
        if d < start or d > end:
            continue
        sun, wknd = record_sunday_and_weekend_totals(r)
        cid = r.campus_id
        ex: Dict[str, int] | None = None
        if sheet_enrichment:
            campus = campuses_by_id.get(cid)
            if campus:
                k = ((campus.display_name or "").strip().lower(), d)
                ex = sheet_enrichment.get(k)
        by_campus[cid]["service_rows"] += 1
        by_campus[cid]["total_sunday"] += sun
        by_campus[cid]["total_weekend"] += wknd
        by_campus[cid]["total_new_people"] += record_new_people_total(
            r, sheet_new_people=ex.get("new_people") if ex else None
        )
        by_campus[cid]["total_salvations"] += record_salvations_total(
            r, sheet_salvations_fallback=ex.get("salvations") if ex else None
        )
        wkey = _week_key_chart(d)
        weekly[wkey]["sunday"] += sun
        weekly[wkey]["weekend"] += wknd
        weekly_by_campus[cid][wkey]["sunday"] += sun
        weekly_by_campus[cid][wkey]["weekend"] += wknd

    campus_rows: List[Dict[str, Any]] = []
    for cid, agg in by_campus.items():
        campus = campuses_by_id.get(cid)
        name = campus.display_name if campus else f"Campus ID {cid}"
        region_code = ""
        if campus and campus.region:
            region_code = campus.region.code or ""
        n = agg["service_rows"] or 1
        campus_rows.append(
            {
                "campus_id": cid,
                "campus_name": name,
                "region": region_code,
                "service_rows": agg["service_rows"],
                "total_sunday": agg["total_sunday"],
                "total_weekend": agg["total_weekend"],
                "avg_sunday": round(agg["total_sunday"] / n, 1),
                "avg_weekend": round(agg["total_weekend"] / n, 1),
                "total_new_people": agg["total_new_people"],
                "total_salvations": agg["total_salvations"],
            }
        )
    campus_rows.sort(key=lambda x: x["campus_name"].lower())

    sorted_week_keys = sorted(weekly.keys())
    weekly_series = [(k, weekly[k]["sunday"], weekly[k]["weekend"]) for k in sorted_week_keys]

    weekly_series_by_campus: Dict[int, List[Tuple[str, int, int]]] = {}
    for cid in weekly_by_campus:
        wk = weekly_by_campus[cid]
        keys_sorted = sorted(wk.keys())
        weekly_series_by_campus[cid] = [(k, wk[k]["sunday"], wk[k]["weekend"]) for k in keys_sorted]

    region_aggregate_rows = _region_aggregate_rows(campus_rows)

    return {
        "year": year,
        "start": start,
        "end": end,
        "period_code": period_code,
        "period_label": period_label,
        "period_caption": period_caption,
        "filter_summary": (filter_summary or "").strip(),
        "campus_rows": campus_rows,
        "region_aggregate_rows": region_aggregate_rows,
        "weekly_series": weekly_series,
        "weekly_series_by_campus": weekly_series_by_campus,
        "totals": {
            "service_rows": sum(r["service_rows"] for r in campus_rows),
            "sunday": sum(r["total_sunday"] for r in campus_rows),
            "weekend": sum(r["total_weekend"] for r in campus_rows),
            "avg_sunday": round(
                sum(r["total_sunday"] for r in campus_rows)
                / max(1, sum(r["service_rows"] for r in campus_rows)),
                1,
            ),
            "avg_weekend": round(
                sum(r["total_weekend"] for r in campus_rows)
                / max(1, sum(r["service_rows"] for r in campus_rows)),
                1,
            ),
            "new_people": sum(r["total_new_people"] for r in campus_rows),
            "salvations": sum(r["total_salvations"] for r in campus_rows),
        },
    }


def build_compare_payload(data_curr: Dict[str, Any], data_prev: Dict[str, Any]) -> Dict[str, Any]:
    """Merge two period payloads for year-over-year."""
    y_curr = data_curr["year"]
    y_prev = data_prev["year"]
    pl = data_curr.get("period_label") or "Q1"
    by_c = {r["campus_id"]: r for r in data_curr["campus_rows"]}
    by_p = {r["campus_id"]: r for r in data_prev["campus_rows"]}
    all_ids = set(by_c) | set(by_p)

    def _name_region(cid: int) -> Tuple[str, str]:
        r0 = by_c.get(cid) or by_p.get(cid)
        return (r0["campus_name"], r0.get("region") or "")

    merged: List[Dict[str, Any]] = []
    for cid in sorted(all_ids, key=lambda i: _name_region(i)[0].lower()):
        name, region_code = _name_region(cid)
        rc = by_c.get(cid)
        rp = by_p.get(cid)
        n_p = (rp["service_rows"] if rp else 0) or 1
        merged.append(
            {
                "campus_id": cid,
                "campus_name": name,
                "region": region_code,
                "service_rows": rc["service_rows"] if rc else 0,
                "total_sunday": rc["total_sunday"] if rc else 0,
                "total_weekend": rc["total_weekend"] if rc else 0,
                "avg_sunday": rc["avg_sunday"] if rc else 0.0,
                "avg_weekend": rc["avg_weekend"] if rc else 0.0,
                "total_new_people": rc["total_new_people"] if rc else 0,
                "total_salvations": rc["total_salvations"] if rc else 0,
                "prev_service_rows": rp["service_rows"] if rp else 0,
                "prev_total_sunday": rp["total_sunday"] if rp else 0,
                "prev_total_weekend": rp["total_weekend"] if rp else 0,
                "prev_avg_sunday": round((rp["total_sunday"] if rp else 0) / n_p, 1) if rp and rp["service_rows"] else 0.0,
                "prev_avg_weekend": round((rp["total_weekend"] if rp else 0) / n_p, 1) if rp and rp["service_rows"] else 0.0,
                "prev_total_new_people": rp["total_new_people"] if rp else 0,
                "prev_total_salvations": rp["total_salvations"] if rp else 0,
            }
        )

    fs = (data_curr.get("filter_summary") or "").strip()
    if fs:
        fs += " · "
    fs += f"Year-over-year: {pl} {y_prev} vs {pl} {y_curr}"

    region_aggregate_rows = _region_aggregate_rows_compare(merged)

    return {
        "compare": True,
        "year": y_curr,
        "prev_year": y_prev,
        "start": data_curr["start"],
        "end": data_curr["end"],
        "period_code": data_curr.get("period_code", "q1"),
        "period_label": pl,
        "period_caption_curr": data_curr.get("period_caption", "Jan–Mar"),
        "period_caption_prev": data_prev.get("period_caption", "Jan–Mar"),
        "filter_summary": fs,
        "campus_rows": merged,
        "region_aggregate_rows": region_aggregate_rows,
        "weekly_series_current": data_curr["weekly_series"],
        "weekly_series_previous": data_prev["weekly_series"],
        "weekly_series_current_by_campus": dict(data_curr.get("weekly_series_by_campus") or {}),
        "weekly_series_previous_by_campus": dict(data_prev.get("weekly_series_by_campus") or {}),
        "totals": dict(data_curr["totals"]),
        "totals_previous": dict(data_prev["totals"]),
    }


def build_q1_csv_bytes(data: Dict[str, Any]) -> bytes:
    if data.get("compare"):
        return _build_q1_csv_compare_bytes(data)
    return _build_q1_csv_single_bytes(data)


def _build_q1_csv_single_bytes(data: Dict[str, Any]) -> bytes:
    buf = io.StringIO()
    w = csv.writer(buf)
    pl = data.get("period_label") or "Q1"
    if data.get("filter_summary"):
        w.writerow(["Report filters", data["filter_summary"]])
        w.writerow([])
    w.writerow(
        [
            "Campus",
            "Region",
            "Service rows",
            "Avg Sunday (no youth)",
            "Avg weekend (w/ youth)",
            f"New people ({pl} total)",
            f"Salvations ({pl} total)",
        ]
    )
    for row in data["campus_rows"]:
        w.writerow(
            [
                row["campus_name"],
                row["region"],
                row["service_rows"],
                row["avg_sunday"],
                row["avg_weekend"],
                row["total_new_people"],
                row["total_salvations"],
            ]
        )
    for rrow in data.get("region_aggregate_rows") or []:
        w.writerow(
            [
                rrow["campus_name"],
                rrow["region"],
                rrow["service_rows"],
                rrow["avg_sunday"],
                rrow["avg_weekend"],
                rrow["total_new_people"],
                rrow["total_salvations"],
            ]
        )
    w.writerow([])
    w.writerow(
        [
            "ALL CAMPUSES",
            "",
            data["totals"]["service_rows"],
            data["totals"]["avg_sunday"],
            data["totals"]["avg_weekend"],
            data["totals"]["new_people"],
            data["totals"]["salvations"],
        ]
    )
    return buf.getvalue().encode("utf-8-sig")


def _build_q1_csv_compare_bytes(data: Dict[str, Any]) -> bytes:
    yc = data["year"]
    yp = data["prev_year"]
    buf = io.StringIO()
    w = csv.writer(buf)
    if data.get("filter_summary"):
        w.writerow(["Report filters", data["filter_summary"]])
        w.writerow([])
    w.writerow(
        [
            "Campus",
            "Region",
            f"Avg Sun {yp}",
            f"Avg Wknd {yp}",
            f"New people {yp}",
            f"Salvations {yp}",
            f"Avg Sun {yc}",
            f"Avg Wknd {yc}",
            f"New people {yc}",
            f"Salvations {yc}",
        ]
    )
    for row in data["campus_rows"]:
        w.writerow(
            [
                row["campus_name"],
                row["region"],
                row["prev_avg_sunday"],
                row["prev_avg_weekend"],
                row["prev_total_new_people"],
                row["prev_total_salvations"],
                row["avg_sunday"],
                row["avg_weekend"],
                row["total_new_people"],
                row["total_salvations"],
            ]
        )
    for rrow in data.get("region_aggregate_rows") or []:
        w.writerow(
            [
                rrow["campus_name"],
                rrow["region"],
                rrow["prev_avg_sunday"],
                rrow["prev_avg_weekend"],
                rrow["prev_total_new_people"],
                rrow["prev_total_salvations"],
                rrow["avg_sunday"],
                rrow["avg_weekend"],
                rrow["total_new_people"],
                rrow["total_salvations"],
            ]
        )
    w.writerow([])
    tp, tc = data["totals_previous"], data["totals"]
    w.writerow(
        [
            "ALL CAMPUSES",
            "",
            tp.get("avg_sunday", 0),
            tp.get("avg_weekend", 0),
            tp.get("new_people", 0),
            tp.get("salvations", 0),
            tc.get("avg_sunday", 0),
            tc.get("avg_weekend", 0),
            tc.get("new_people", 0),
            tc.get("salvations", 0),
        ]
    )
    return buf.getvalue().encode("utf-8-sig")


def _chart_bar_campus(data: Dict[str, Any]) -> io.BytesIO:
    rows = data["campus_rows"]
    pl = data.get("period_label") or "Q1"
    fig, ax = plt.subplots(figsize=(10, max(4.0, 0.35 * len(rows) + 1.5)))
    if not rows:
        ax.text(0.5, 0.5, "No data", ha="center", va="center")
        ax.set_axis_off()
    else:
        names = [r["campus_name"][:28] for r in rows]
        y = range(len(names))
        sun = [r["avg_sunday"] for r in rows]
        wknd = [r["avg_weekend"] for r in rows]
        h = 0.35
        ax.barh([i - h / 2 for i in y], sun, height=h, label="Sunday (no youth)", color="#3b82f6")
        ax.barh([i + h / 2 for i in y], wknd, height=h, label="Weekend (w/ youth)", color="#94a3b8")
        ax.set_yticks(list(y))
        ax.set_yticklabels(names, fontsize=8)
        ax.invert_yaxis()
        ax.legend(loc="lower right", fontsize=8)
        ax.set_xlabel(f"Attendance ({pl} avg per service)")
    sub = (data.get("filter_summary") or "")[:80]
    t = f"{pl} {data['year']} — by campus"
    if sub:
        t += f"\n({sub})"
    ax.set_title(t, fontsize=10, fontweight="bold")
    plt.tight_layout()
    out = io.BytesIO()
    fig.savefig(out, format="png", dpi=_PDF_CHART_DPI_LEGACY, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    out.seek(0)
    return out


def _chart_bar_campus_compare(data: Dict[str, Any]) -> io.BytesIO:
    rows = data["campus_rows"]
    pl = data.get("period_label") or "Q1"
    yp, yc = data["prev_year"], data["year"]
    fig_h = max(5.0, 0.45 * len(rows) + 2.0)
    fig, ax = plt.subplots(figsize=(11, fig_h))
    if not rows:
        ax.text(0.5, 0.5, "No data", ha="center", va="center")
        ax.set_axis_off()
    else:
        names = [r["campus_name"][:26] for r in rows]
        y = list(range(len(names)))
        w = 0.18
        sun_p = [r["prev_avg_sunday"] for r in rows]
        sun_c = [r["avg_sunday"] for r in rows]
        wk_p = [r["prev_avg_weekend"] for r in rows]
        wk_c = [r["avg_weekend"] for r in rows]
        ax.barh([i - 1.5 * w for i in y], sun_p, height=w, label=f"Sun {yp}", color="#93c5fd")
        ax.barh([i - 0.5 * w for i in y], sun_c, height=w, label=f"Sun {yc}", color="#2563eb")
        ax.barh([i + 0.5 * w for i in y], wk_p, height=w, label=f"Weekend {yp}", color="#cbd5e1")
        ax.barh([i + 1.5 * w for i in y], wk_c, height=w, label=f"Weekend {yc}", color="#475569")
        ax.set_yticks(y)
        ax.set_yticklabels(names, fontsize=8)
        ax.invert_yaxis()
        ax.legend(loc="lower right", fontsize=7, ncol=2)
        ax.set_xlabel(f"Attendance ({pl} avg per service)")
    sub = (data.get("filter_summary") or "")[:75]
    t = f"{pl} YoY — {yp} vs {yc}"
    if sub:
        t += f"\n({sub})"
    ax.set_title(t, fontsize=10, fontweight="bold")
    plt.tight_layout()
    out = io.BytesIO()
    fig.savefig(out, format="png", dpi=_PDF_CHART_DPI_LEGACY, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    out.seek(0)
    return out


def _chart_line_weekly(data: Dict[str, Any]) -> io.BytesIO:
    series = data["weekly_series"]
    pl = data.get("period_label") or "Q1"
    fig, ax = plt.subplots(figsize=(10, 4))
    if not series:
        ax.text(0.5, 0.5, "No weekly data", ha="center", va="center")
        ax.set_axis_off()
    else:
        labels = _week_series_xtick_labels(series)
        sun = [s[1] for s in series]
        wknd = [s[2] for s in series]
        x = range(len(labels))
        ax.plot(x, sun, marker="o", label="Sunday (scope)", color="#3b82f6", linewidth=2)
        ax.plot(x, wknd, marker="s", label="Weekend (scope)", color="#64748b", linewidth=2)
        ax.set_xticks(x)
        ax.set_xticklabels(labels, rotation=45, ha="right", fontsize=7)
        ax.set_xlabel("Month (Monday of ISO week)")
        ax.legend(loc="upper right", fontsize=8)
        ax.set_ylabel("Attendance")
        ax.grid(True, alpha=0.3)
    subw = (data.get("filter_summary") or "")[:70]
    tw = f"{pl} {data['year']} — weekly totals"
    if subw:
        tw += f"\n({subw})"
    ax.set_title(tw, fontsize=10, fontweight="bold")
    plt.tight_layout()
    out = io.BytesIO()
    fig.savefig(out, format="png", dpi=_PDF_CHART_DPI_LEGACY, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    out.seek(0)
    return out


def _chart_line_weekly_dual(data: Dict[str, Any]) -> io.BytesIO:
    yc, yp = data["year"], data["prev_year"]
    pl = data.get("period_label") or "Q1"
    s_curr = data["weekly_series_current"]
    s_prev = data["weekly_series_previous"]
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 6.5), sharex=False)

    def _plot(ax, series, title_y: str):
        if not series:
            ax.text(0.5, 0.5, "No weekly data", ha="center", va="center")
            ax.set_axis_off()
            return
        labels = _week_series_xtick_labels(series)
        sun = [s[1] for s in series]
        wknd = [s[2] for s in series]
        x = range(len(labels))
        ax.plot(x, sun, marker="o", label="Sunday", color="#3b82f6", linewidth=2)
        ax.plot(x, wknd, marker="s", label="Weekend", color="#64748b", linewidth=2)
        ax.set_xticks(x)
        ax.set_xticklabels(labels, rotation=45, ha="right", fontsize=6)
        ax.set_xlabel("Month (Monday of ISO week)")
        ax.legend(loc="upper right", fontsize=7)
        ax.set_ylabel("Attendance")
        ax.grid(True, alpha=0.3)
        ax.set_title(f"{pl} {title_y} — weekly (same filters)", fontsize=9, fontweight="bold")

    _plot(ax1, s_prev, str(yp))
    _plot(ax2, s_curr, str(yc))
    plt.tight_layout()
    out = io.BytesIO()
    fig.savefig(out, format="png", dpi=_PDF_CHART_DPI_LEGACY, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    out.seek(0)
    return out


def _pdf_compare_table_single_campus(
    row: Dict[str, Any],
    *,
    pl: str,
    yp: int,
    yc: int,
    cap_p: str,
    cap_c: str,
    hdr_white,
    _hdr_compare_sub,
    avail_w: float,
    colors,
    inch,
    fs_pdf: int,
    Paragraph,
    Table,
    TableStyle,
):
    """Two header rows + one campus row; year column shading (no grand-total row)."""
    tot_lbl = f"{pl} total"
    hdr_row0: List[Any] = [
        Paragraph("<para align='center'><b>Campus</b></para>", hdr_white),
        Paragraph("<para align='center'><b>Region</b></para>", hdr_white),
        Paragraph(
            f"<para align='center'><b>{pl} {yp}</b><br/><font size='5'>{cap_p}</font></para>",
            hdr_white,
        ),
        "",
        "",
        "",
        Paragraph(
            f"<para align='center'><b>{pl} {yc}</b><br/><font size='5'>{cap_c}</font></para>",
            hdr_white,
        ),
        "",
        "",
        "",
    ]
    hdr_row1: List[Any] = [
        "",
        "",
        _hdr_compare_sub("Sunday", "avg / service row"),
        _hdr_compare_sub("Weekend", "avg / service row"),
        _hdr_compare_sub("New people", tot_lbl),
        _hdr_compare_sub("Salvations", tot_lbl),
        _hdr_compare_sub("Sunday", "avg / service row"),
        _hdr_compare_sub("Weekend", "avg / service row"),
        _hdr_compare_sub("New people", tot_lbl),
        _hdr_compare_sub("Salvations", tot_lbl),
    ]
    body = [
        row["campus_name"][:26],
        row["region"] or "—",
        str(row["prev_avg_sunday"]),
        str(row["prev_avg_weekend"]),
        str(row["prev_total_new_people"]),
        str(row["prev_total_salvations"]),
        str(row["avg_sunday"]),
        str(row["avg_weekend"]),
        str(row["total_new_people"]),
        str(row["total_salvations"]),
    ]
    table_data = [hdr_row0, hdr_row1, body]
    col_widths = [avail_w * 0.14, avail_w * 0.06] + [avail_w * 0.10] * 8
    t = Table(table_data, colWidths=col_widths, repeatRows=2)
    band_prev = colors.HexColor("#bfdbfe")
    band_curr = colors.HexColor("#bbf7d0")
    tbl_cmds: List[Any] = [
        ("BACKGROUND", (0, 0), (-1, 1), colors.HexColor("#1e3a5f")),
        ("TEXTCOLOR", (0, 0), (-1, 1), colors.white),
        ("FONTNAME", (0, 0), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 1), 6.5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("SPAN", (0, 0), (0, 1)),
        ("SPAN", (1, 0), (1, 1)),
        ("SPAN", (2, 0), (5, 0)),
        ("SPAN", (6, 0), (9, 0)),
        ("LINEBELOW", (0, 0), (-1, 0), 0.75, colors.HexColor("#0f172a")),
        ("ALIGN", (2, 0), (-1, 1), "CENTER"),
        ("FONTSIZE", (0, 2), (-1, -1), fs_pdf),
        ("FONTNAME", (0, 2), (-1, -1), "Helvetica"),
        ("ALIGN", (2, 2), (-1, -1), "RIGHT"),
        ("GRID", (0, 0), (-1, -1), 0.2, colors.HexColor("#cbd5e1")),
        ("LINEABOVE", (0, 0), (-1, 0), 1.0, colors.HexColor("#0f172a")),
        ("BACKGROUND", (2, 2), (5, 2), band_prev),
        ("BACKGROUND", (6, 2), (9, 2), band_curr),
    ]
    t.setStyle(TableStyle(tbl_cmds))
    return t


def _pdf_single_year_table_single_campus(
    row: Dict[str, Any],
    *,
    avail_w: float,
    colors,
    hdr_single,
    fs_pdf: int,
    Paragraph,
    Table,
    TableStyle,
):
    """One header row + one campus row (no region subtotals or grand total)."""
    table_data = [
        [
            Paragraph("<para align='center'><b>Campus</b></para>", hdr_single),
            Paragraph("<para align='center'><b>Region</b></para>", hdr_single),
            Paragraph("<para align='center'><b>Service<br/>rows</b></para>", hdr_single),
            Paragraph("<para align='center'><b>Sunday<br/>total</b></para>", hdr_single),
            Paragraph("<para align='center'><b>Weekend<br/>total</b></para>", hdr_single),
            Paragraph("<para align='center'><b>Sunday<br/>avg</b></para>", hdr_single),
            Paragraph("<para align='center'><b>Weekend<br/>avg</b></para>", hdr_single),
            Paragraph("<para align='center'><b>New people<br/>total</b></para>", hdr_single),
            Paragraph("<para align='center'><b>Salvations<br/>total</b></para>", hdr_single),
        ],
        [
            row["campus_name"][:34],
            row["region"] or "—",
            str(row["service_rows"]),
            str(row["total_sunday"]),
            str(row["total_weekend"]),
            str(row["avg_sunday"]),
            str(row["avg_weekend"]),
            str(row["total_new_people"]),
            str(row["total_salvations"]),
        ],
    ]
    col_widths_s = [avail_w * 0.17, avail_w * 0.06] + [avail_w * 0.11] * 7
    t = Table(table_data, colWidths=col_widths_s, repeatRows=1)
    tbl_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("FONTSIZE", (0, 1), (-1, -1), fs_pdf),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
        ("GRID", (0, 0), (-1, -1), 0.2, colors.HexColor("#cbd5e1")),
        ("LINEABOVE", (0, 0), (-1, 0), 1.0, colors.HexColor("#0f172a")),
    ]
    t.setStyle(TableStyle(tbl_cmds))
    return t


def _chart_bar_weekend_compare_compact(data: Dict[str, Any]) -> io.BytesIO:
    """
    YoY weekend (w/ youth) averages: vertical grouped bars — orange = prior year, blue = current.
    Easier to read than stacked horizontal bars; high hue contrast (not two blues).
    """
    rows = data["campus_rows"]
    pl = data.get("period_label") or "Q1"
    yp, yc = data["prev_year"], data["year"]
    n = len(rows)
    single_campus = n == 1
    if single_campus:
        # Narrow canvas so two bars are not stretched across a full landscape width when embedded in PDF.
        fig_w, fig_h = 4.9, 3.05
    else:
        fig_w = 11.0
        fig_h = min(6.0, max(2.35 if n <= 1 else 4.0, 0.42 * max(n, 1) + (1.55 if n <= 1 else 2.85)))
    fig, ax = plt.subplots(figsize=(fig_w, fig_h))
    if not rows:
        ax.text(0.5, 0.5, "No data", ha="center", va="center")
        ax.set_axis_off()
    else:
        names = [r["campus_name"][:22] for r in rows]
        wk_p = [r["prev_avg_weekend"] for r in rows]
        wk_c = [r["avg_weekend"] for r in rows]
        x = list(range(n))
        w = 0.28 if single_campus else 0.38
        ax.bar(
            [i - w / 2 for i in x],
            wk_p,
            width=w,
            label=str(yp),
            color="#ea580c",
            edgecolor="white",
            linewidth=0.7,
        )
        ax.bar(
            [i + w / 2 for i in x],
            wk_c,
            width=w,
            label=str(yc),
            color="#2563eb",
            edgecolor="white",
            linewidth=0.7,
        )
        ax.set_xticks(x)
        if single_campus:
            ax.set_xlim(-0.55, 0.55)
            ax.set_xticklabels(names, rotation=0, ha="center", fontsize=11)
        else:
            ax.set_xticklabels(names, rotation=38, ha="right", fontsize=11)
        ax.set_ylabel(f"Weekend — {pl} avg per service", fontsize=12)
        ax.tick_params(axis="both", labelsize=11)
        ax.legend(
            title="Year",
            loc="upper right",
            fontsize=10,
            title_fontsize=10,
            ncol=2,
            framealpha=0.95,
        )
        ax.yaxis.grid(True, alpha=0.38)
        ax.set_axisbelow(True)
    sub = (data.get("filter_summary") or "")[:68]
    t = f"Weekend (incl. youth) — {yp} vs {yc}"
    if sub:
        t += f"\n({sub})"
    ax.set_title(t, fontsize=13, fontweight="bold", pad=10)
    plt.tight_layout(pad=0.65)
    out = io.BytesIO()
    fig.savefig(
        out,
        format="png",
        dpi=_PDF_CHART_DPI_SHARP,
        bbox_inches="tight",
        facecolor="white",
        pad_inches=0.12,
    )
    plt.close(fig)
    out.seek(0)
    return out


def _chart_bar_campus_compare_compact(data: Dict[str, Any]) -> io.BytesIO:
    """Backward-compatible alias: YoY weekend vertical bars (same as PDF bar chart)."""
    return _chart_bar_weekend_compare_compact(data)


def _chart_line_weekly_dual_compact(data: Dict[str, Any]) -> io.BytesIO:
    """Two weekly charts side-by-side to save vertical space on PDF."""
    yc, yp = data["year"], data["prev_year"]
    pl = data.get("period_label") or "Q1"
    s_curr = data["weekly_series_current"]
    s_prev = data["weekly_series_previous"]
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10.0, 2.05), sharey=False)

    def _plot(ax, series, title_y: str):
        if not series:
            ax.text(0.5, 0.5, "No data", ha="center", va="center", fontsize=7)
            ax.set_axis_off()
            return
        labels = _week_series_xtick_labels(series)
        sun = [s[1] for s in series]
        wknd = [s[2] for s in series]
        x = range(len(labels))
        ax.plot(x, sun, marker="o", markersize=4, label="Sunday", color="#2563eb", linewidth=1.6)
        ax.plot(x, wknd, marker="s", markersize=4, label="Weekend", color="#64748b", linewidth=1.6)
        ax.set_xticks(x)
        ax.set_xticklabels(labels, rotation=35, ha="right", fontsize=8)
        ax.set_xlabel("Month (ISO week Mon)", fontsize=8)
        ax.legend(loc="upper right", fontsize=7.5)
        ax.set_ylabel("Attendance", fontsize=8)
        ax.grid(True, alpha=0.28)
        ax.set_title(f"{pl} {title_y}", fontsize=9, fontweight="bold")

    _plot(ax1, s_prev, str(yp))
    _plot(ax2, s_curr, str(yc))
    plt.tight_layout(pad=0.45)
    out = io.BytesIO()
    fig.savefig(
        out,
        format="png",
        dpi=_PDF_CHART_DPI_SHARP,
        bbox_inches="tight",
        facecolor="white",
        pad_inches=0.1,
    )
    plt.close(fig)
    out.seek(0)
    return out


def build_q1_pdf_bytes(data: Dict[str, Any], *, per_campus_pages: bool = False) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        Image,
        KeepTogether,
        PageBreak,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    buffer = io.BytesIO()
    page = landscape(A4)
    compare = bool(data.get("compare"))
    doc = SimpleDocTemplate(
        buffer,
        pagesize=page,
        rightMargin=28,
        leftMargin=28,
        topMargin=30,
        bottomMargin=28,
    )
    styles = getSampleStyleSheet()
    title_ps = ParagraphStyle(
        "Q1Title",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=15 if compare else 17,
        leading=18 if compare else 20,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=4,
    )
    meta_ps = ParagraphStyle(
        "Q1Meta",
        parent=styles["Normal"],
        fontSize=10 if compare else 9,
        leading=12 if compare else 11,
        textColor=colors.HexColor("#334155"),
        spaceAfter=2,
    )
    hdr_white = ParagraphStyle(
        "Q1Hdr",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7,
        leading=8,
        alignment=TA_CENTER,
        textColor=colors.white,
    )

    def _hdr_metric(label: str, year: int) -> Paragraph:
        return Paragraph(
            f'<para align="center">{label}<br/><font size="6">{year} &middot; Q1 total</font></para>',
            hdr_white,
        )

    def _hdr_compare_sub(label: str, subtitle: str) -> Paragraph:
        st = subtitle.replace("&", "&amp;")
        return Paragraph(
            f'<para align="center"><b>{label}</b><br/><font size="5">{st}</font></para>',
            hdr_white,
        )

    campus_title_ps = ParagraphStyle(
        "Q1CampusPage",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=17,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=8,
    )

    avail_w = page[0] - 56
    story: List[Any] = []

    pl = data.get("period_label") or "Q1"

    def _esc_xml(s: str) -> str:
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    if compare:
        cap_p = _esc_xml(data.get("period_caption_prev") or "Jan–Mar")
        cap_c = _esc_xml(data.get("period_caption_curr") or "Jan–Mar")
        title = (
            f"Pulse &mdash; {pl} attendance year-over-year "
            f"({data['prev_year']} {cap_p} vs {data['year']} {cap_c})"
        )
    else:
        title = f"Pulse — {pl} attendance report ({data['start']} to {data['end']})"

    if per_campus_pages:
        navy = colors.HexColor("#1e3a5f")
        slate_500 = colors.HexColor("#64748b")
        slate_700 = colors.HexColor("#334155")
        blue_accent = colors.HexColor("#2563eb")
        ice = colors.HexColor("#f1f5f9")
        border = colors.HexColor("#cbd5e1")

        cov_eyebrow = ParagraphStyle(
            "Q1CovEyebrow",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=11,
            alignment=TA_CENTER,
            textColor=colors.white,
            spaceAfter=0,
        )
        cov_hero = ParagraphStyle(
            "Q1CovHero",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=38,
            leading=44,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#0f172a"),
            spaceAfter=0,
        )
        cov_kicker = ParagraphStyle(
            "Q1CovKicker",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=21,
            alignment=TA_CENTER,
            textColor=blue_accent,
            spaceAfter=0,
        )
        cov_dates = ParagraphStyle(
            "Q1CovDates",
            parent=styles["Normal"],
            fontSize=11,
            leading=15,
            alignment=TA_CENTER,
            textColor=slate_500,
            spaceAfter=0,
        )
        cov_scope_title = ParagraphStyle(
            "Q1CovScopeTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=13,
            textColor=slate_700,
            spaceAfter=4,
        )
        cov_scope_body = ParagraphStyle(
            "Q1CovScopeBody",
            parent=styles["Normal"],
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#475569"),
            spaceAfter=0,
        )
        cov_note = ParagraphStyle(
            "Q1CovNote",
            parent=styles["Normal"],
            fontSize=9,
            leading=13,
            alignment=TA_CENTER,
            textColor=slate_500,
            spaceAfter=0,
        )
        cov_foot = ParagraphStyle(
            "Q1CovFoot",
            parent=styles["Normal"],
            fontSize=8,
            leading=10,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#94a3b8"),
            spaceAfter=0,
        )

        story.append(Spacer(1, 0.55 * inch))
        eyeb_row = Table(
            [[Paragraph("ATTENDANCE REPORT", cov_eyebrow)]],
            colWidths=[avail_w],
        )
        eyeb_row.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), navy),
                    ("TOPPADDING", (0, 0), (-1, -1), 12),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
                ]
            )
        )
        story.append(eyeb_row)
        story.append(Spacer(1, 0.38 * inch))
        story.append(Paragraph("Pulse", cov_hero))
        story.append(Spacer(1, 14))
        if compare:
            story.append(Paragraph(_esc_xml(f"{pl} · Year-over-year"), cov_kicker))
            story.append(Spacer(1, 8))
            dates_line = (
                f"{data['prev_year']} {cap_p} &nbsp;&nbsp;<font color='#94a3b8'>|</font>&nbsp;&nbsp; "
                f"{data['year']} {cap_c}"
            )
            story.append(Paragraph(dates_line, cov_dates))
        else:
            story.append(Paragraph(_esc_xml(f"{pl} · Attendance"), cov_kicker))
            story.append(Spacer(1, 8))
            de = _esc_xml(str(data.get("start", "")))
            dn = _esc_xml(str(data.get("end", "")))
            story.append(Paragraph(f"{de} &nbsp;to&nbsp; {dn}", cov_dates))

        story.append(Spacer(1, 0.42 * inch))
        accent_w = min(2.6 * inch, avail_w * 0.36)
        side = (avail_w - accent_w) / 2
        accent_tbl = Table([[Paragraph("", meta_ps)]], colWidths=[accent_w])
        accent_tbl.setStyle(
            TableStyle(
                [
                    ("LINEABOVE", (0, 0), (-1, -1), 3, blue_accent),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ]
            )
        )
        story.append(Table([[Spacer(1, 1), accent_tbl, Spacer(1, 1)]], colWidths=[side, accent_w, side]))

        fs = data.get("filter_summary") or ""
        scope_inner: List[Any] = []
        scope_inner.append(Paragraph("Scope &amp; filters", cov_scope_title))
        if fs:
            safe_fs = fs.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            scope_inner.append(Paragraph(safe_fs, cov_scope_body))
        else:
            scope_inner.append(Paragraph("All campuses in scope (no additional filters).", cov_scope_body))
        if not compare:
            scope_inner.append(Spacer(1, 8))
            scope_inner.append(
                Paragraph(
                    "<b>Metrics</b> (each page): Sunday, Weekend (incl. youth), New people, Salvations "
                    "&mdash; aligned with the regional attendance dashboard.",
                    cov_scope_body,
                )
            )
        else:
            scope_inner.append(Spacer(1, 8))
            scope_inner.append(
                Paragraph(
                    "<b>Each campus page</b> includes weekend year-over-year bars, weekly lines for both years, "
                    "and a figures table.",
                    cov_scope_body,
                )
            )

        box_w = avail_w * 0.78
        box_side = (avail_w - box_w) / 2
        scope_tbl = Table([[KeepTogether(scope_inner)]], colWidths=[box_w])
        scope_tbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), ice),
                    ("BOX", (0, 0), (-1, -1), 0.75, border),
                    ("TOPPADDING", (0, 0), (-1, -1), 16),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 16),
                    ("LEFTPADDING", (0, 0), (-1, -1), 18),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 18),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        story.append(Spacer(1, 0.36 * inch))
        story.append(
            Table(
                [[Spacer(1, 1), scope_tbl, Spacer(1, 1)]],
                colWidths=[box_side, box_w, box_side],
            )
        )

        story.append(Spacer(1, 0.34 * inch))
        story.append(
            Paragraph(
                "<i>Following pages</i> &mdash; one campus per page (charts and table for that location only).",
                cov_note,
            )
        )
        story.append(Spacer(1, 0.45 * inch))
        story.append(
            Paragraph("Source: <b>attendance_records</b> &nbsp;·&nbsp; Futures Link", cov_foot),
        )
        story.append(PageBreak())
    else:
        story.append(Paragraph(title, title_ps))
        fs = data.get("filter_summary") or ""
        if fs:
            safe = fs.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            story.append(Paragraph(f"<b>Filters:</b> {safe}", meta_ps))
        if not compare:
            metrics_common = (
                "<b>Metrics:</b> "
                "<b>Sunday</b> = adults + saints + kids. "
                "<b>Weekend</b> = Sunday + youth + youth leaders. "
                "<b>New people</b> = first-time visitors + visitors + youth new people; "
                "if the DB breakdown is lower, the Google Stats <i>New People</i> column is used (legacy rows). "
                "<b>Salvations</b> = first-time Christians + rededications + youth + kids salvations; "
                "when that sum is zero, <i>Salvation cards returned</i> and/or Stats <i>New Christians</i> apply. "
            )
            metrics_single = (
                "<b>Region total</b> = sum of campuses in that region code. "
                "<b>Weekly chart</b> = per-week totals summed across this filter. "
            )
            story.append(Paragraph(metrics_common + metrics_single, meta_ps))
            story.append(Spacer(1, 4))
        else:
            story.append(Spacer(1, 2))

    if compare:
        yp, yc = data["prev_year"], data["year"]
        tp, tc = data["totals_previous"], data["totals"]
        if per_campus_pages:
            w_cur = data.get("weekly_series_current_by_campus") or {}
            w_prv = data.get("weekly_series_previous_by_campus") or {}
            for i, row in enumerate(data["campus_rows"]):
                if i > 0:
                    story.append(PageBreak())
                cid = row["campus_id"]
                sub_chart = {
                    "compare": True,
                    "year": yc,
                    "prev_year": yp,
                    "campus_rows": [row],
                    "period_label": pl,
                    "filter_summary": data.get("filter_summary", ""),
                    "weekly_series_current": w_cur.get(cid, []),
                    "weekly_series_previous": w_prv.get(cid, []),
                }
                nm = _esc_xml(str(row["campus_name"])[:100])
                story.append(Paragraph(f"<b>{nm}</b>", campus_title_ps))
                bar_b = _chart_bar_weekend_compare_compact(sub_chart)
                bar_pdf_w = min(5.15 * inch, avail_w * 0.55)
                story.append(
                    _rl_image_yoy_weekend_bar_single(bar_b, bar_pdf_w, max_h=2.42 * inch)
                )
                story.append(Spacer(1, 6))
                line_b = _chart_line_weekly_dual_compact(sub_chart)
                story.append(Image(line_b, width=avail_w, height=1.55 * inch))
                story.append(Spacer(1, 10))
                t_c = _pdf_compare_table_single_campus(
                    row,
                    pl=pl,
                    yp=yp,
                    yc=yc,
                    cap_p=cap_p,
                    cap_c=cap_c,
                    hdr_white=hdr_white,
                    _hdr_compare_sub=_hdr_compare_sub,
                    avail_w=avail_w,
                    colors=colors,
                    inch=inch,
                    fs_pdf=7,
                    Paragraph=Paragraph,
                    Table=Table,
                    TableStyle=TableStyle,
                )
                story.append(t_c)
        else:
            n_camp = len(data["campus_rows"])
            bar_wk_buf = _chart_bar_weekend_compare_compact(data)
            line_buf = _chart_line_weekly_dual_compact(data)
            line_disp_h = 1.72 * inch

            hdr_row0: List[Any] = [
                Paragraph("<para align='center'><b>Campus</b></para>", hdr_white),
                Paragraph("<para align='center'><b>Region</b></para>", hdr_white),
                Paragraph(
                    f"<para align='center'><b>{pl} {yp}</b><br/><font size='5'>{cap_p}</font></para>",
                    hdr_white,
                ),
                "",
                "",
                "",
                Paragraph(
                    f"<para align='center'><b>{pl} {yc}</b><br/><font size='5'>{cap_c}</font></para>",
                    hdr_white,
                ),
                "",
                "",
                "",
            ]
            tot_lbl = f"{pl} total"
            hdr_row1: List[Any] = [
                "",
                "",
                _hdr_compare_sub("Sunday", "avg / service row"),
                _hdr_compare_sub("Weekend", "avg / service row"),
                _hdr_compare_sub("New people", tot_lbl),
                _hdr_compare_sub("Salvations", tot_lbl),
                _hdr_compare_sub("Sunday", "avg / service row"),
                _hdr_compare_sub("Weekend", "avg / service row"),
                _hdr_compare_sub("New people", tot_lbl),
                _hdr_compare_sub("Salvations", tot_lbl),
            ]
            table_data: List[List[Any]] = [hdr_row0, hdr_row1]
            region_row_idx_compare: List[int] = []
            for row in data["campus_rows"]:
                table_data.append(
                    [
                        row["campus_name"][:26],
                        row["region"] or "—",
                        str(row["prev_avg_sunday"]),
                        str(row["prev_avg_weekend"]),
                        str(row["prev_total_new_people"]),
                        str(row["prev_total_salvations"]),
                        str(row["avg_sunday"]),
                        str(row["avg_weekend"]),
                        str(row["total_new_people"]),
                        str(row["total_salvations"]),
                    ]
                )
            base_c = len(table_data)
            for j, rrow in enumerate(data.get("region_aggregate_rows") or []):
                region_row_idx_compare.append(base_c + j)
                table_data.append(
                    [
                        rrow["campus_name"][:26],
                        rrow["region"] or "—",
                        str(rrow["prev_avg_sunday"]),
                        str(rrow["prev_avg_weekend"]),
                        str(rrow["prev_total_new_people"]),
                        str(rrow["prev_total_salvations"]),
                        str(rrow["avg_sunday"]),
                        str(rrow["avg_weekend"]),
                        str(rrow["total_new_people"]),
                        str(rrow["total_salvations"]),
                    ]
                )
            table_data.append(
                [
                    "ALL CAMPUSES — TOTAL",
                    "",
                    str(tp.get("avg_sunday", 0)),
                    str(tp.get("avg_weekend", 0)),
                    str(tp.get("new_people", 0)),
                    str(tp.get("salvations", 0)),
                    str(tc.get("avg_sunday", 0)),
                    str(tc.get("avg_weekend", 0)),
                    str(tc.get("new_people", 0)),
                    str(tc.get("salvations", 0)),
                ]
            )

            col_widths = [avail_w * 0.14, avail_w * 0.06] + [avail_w * 0.10] * 8

            t = Table(table_data, colWidths=col_widths, repeatRows=2)
            n_rows = len(table_data) - 2
            fs_pdf = 6 if n_rows > 20 else 7
            # Distinct year bands (body rows only): prior = blue tint, current = green tint.
            band_prev = colors.HexColor("#bfdbfe")
            band_curr = colors.HexColor("#bbf7d0")
            footer_ri = len(table_data) - 1
            region_set = set(region_row_idx_compare)
            tbl_cmds = [
                ("BACKGROUND", (0, 0), (-1, 1), colors.HexColor("#1e3a5f")),
                ("TEXTCOLOR", (0, 0), (-1, 1), colors.white),
                ("FONTNAME", (0, 0), (-1, 1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 1), 6.5),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("SPAN", (0, 0), (0, 1)),
                ("SPAN", (1, 0), (1, 1)),
                ("SPAN", (2, 0), (5, 0)),
                ("SPAN", (6, 0), (9, 0)),
                ("LINEBELOW", (0, 0), (-1, 0), 0.75, colors.HexColor("#0f172a")),
                ("ALIGN", (2, 0), (-1, 1), "CENTER"),
                ("FONTSIZE", (0, 2), (-1, -1), fs_pdf),
                ("FONTNAME", (0, 2), (-1, -2), "Helvetica"),
                ("ALIGN", (2, 2), (-1, -1), "RIGHT"),
                ("GRID", (0, 0), (-1, -1), 0.2, colors.HexColor("#cbd5e1")),
                ("LINEABOVE", (0, 0), (-1, 0), 1.0, colors.HexColor("#0f172a")),
            ]
            # Per-row year bands (avoids missing tints when the table flows across pages).
            for r in range(2, footer_ri):
                if r in region_set:
                    continue
                tbl_cmds.append(("BACKGROUND", (2, r), (5, r), band_prev))
                tbl_cmds.append(("BACKGROUND", (6, r), (9, r), band_curr))
            tbl_cmds.extend(
                [
                    ("BACKGROUND", (0, footer_ri), (-1, footer_ri), colors.HexColor("#0f172a")),
                    ("TEXTCOLOR", (0, footer_ri), (-1, footer_ri), colors.white),
                    ("FONTNAME", (0, footer_ri), (-1, footer_ri), "Helvetica-Bold"),
                    ("FONTSIZE", (0, footer_ri), (-1, footer_ri), fs_pdf),
                ]
            )
            for ri in region_row_idx_compare:
                tbl_cmds.append(("BACKGROUND", (0, ri), (-1, ri), colors.HexColor("#fef3c7")))
                tbl_cmds.append(("TEXTCOLOR", (0, ri), (-1, ri), colors.HexColor("#422006")))
                tbl_cmds.append(("FONTNAME", (0, ri), (-1, ri), "Helvetica-Bold"))
            t.setStyle(TableStyle(tbl_cmds))

            # Page 1: charts only. Page 2: full data table (fixes split-table band bugs and reduces clutter).
            if n_camp <= 1:
                bar_pdf_w = min(5.15 * inch, avail_w * 0.55)
                story.append(
                    _rl_image_yoy_weekend_bar_single(bar_wk_buf, bar_pdf_w, max_h=2.42 * inch)
                )
            else:
                bar_wk_h = min(4.15 * inch, max(2.95 * inch, 0.16 * n_camp * inch + 2.35 * inch))
                story.append(Image(bar_wk_buf, width=avail_w, height=bar_wk_h))
            story.append(Spacer(1, 8))
            story.append(Image(line_buf, width=avail_w, height=line_disp_h))
            story.append(Spacer(1, 10))
            story.append(PageBreak())
            story.append(
                Paragraph(
                    f"<b>Data table</b> &mdash; {pl} {yp} vs {pl} {yc} "
                    f"<font color='#64748b'>(same filters as charts on previous page)</font>",
                    meta_ps,
                )
            )
            story.append(Spacer(1, 10))
            story.append(t)
    else:
        hdr_single = ParagraphStyle(
            "Q1HdrSingle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=9,
            alignment=TA_CENTER,
            textColor=colors.white,
        )
        if per_campus_pages:
            w_by_c = data.get("weekly_series_by_campus") or {}
            for i, row in enumerate(data["campus_rows"]):
                if i > 0:
                    story.append(PageBreak())
                cid = row["campus_id"]
                sub_chart = {
                    "year": data["year"],
                    "campus_rows": [row],
                    "period_label": pl,
                    "filter_summary": data.get("filter_summary", ""),
                    "weekly_series": w_by_c.get(cid, []),
                }
                nm = _esc_xml(str(row["campus_name"])[:100])
                story.append(Paragraph(f"<b>{nm}</b>", campus_title_ps))
                bar_b = _chart_bar_campus(sub_chart)
                bar_h_one = min(3.6 * inch, max(1.9 * inch, 0.26 * inch + 1.0 * inch))
                story.append(Image(bar_b, width=avail_w, height=max(2.0 * inch, min(bar_h_one, 2.85 * inch))))
                story.append(Spacer(1, 8))
                line_b = _chart_line_weekly(sub_chart)
                story.append(Image(line_b, width=avail_w, height=2.45 * inch))
                story.append(Spacer(1, 10))
                t_one = _pdf_single_year_table_single_campus(
                    row,
                    avail_w=avail_w,
                    colors=colors,
                    hdr_single=hdr_single,
                    fs_pdf=8,
                    Paragraph=Paragraph,
                    Table=Table,
                    TableStyle=TableStyle,
                )
                story.append(t_one)
        else:
            bar_buf = _chart_bar_campus(data)
            bar_h = min(3.6 * inch, max(1.9 * inch, 0.26 * len(data["campus_rows"]) * inch + 1.0 * inch))
            story.append(Image(bar_buf, width=avail_w, height=bar_h))
            story.append(Spacer(1, 8))
            line_buf = _chart_line_weekly(data)
            story.append(Image(line_buf, width=avail_w, height=2.45 * inch))
            story.append(Spacer(1, 10))

            table_data = [
                [
                    Paragraph("<para align='center'><b>Campus</b></para>", hdr_single),
                    Paragraph("<para align='center'><b>Region</b></para>", hdr_single),
                    Paragraph("<para align='center'><b>Service<br/>rows</b></para>", hdr_single),
                    Paragraph("<para align='center'><b>Sunday<br/>total</b></para>", hdr_single),
                    Paragraph("<para align='center'><b>Weekend<br/>total</b></para>", hdr_single),
                    Paragraph("<para align='center'><b>Sunday<br/>avg</b></para>", hdr_single),
                    Paragraph("<para align='center'><b>Weekend<br/>avg</b></para>", hdr_single),
                    Paragraph("<para align='center'><b>New people<br/>total</b></para>", hdr_single),
                    Paragraph("<para align='center'><b>Salvations<br/>total</b></para>", hdr_single),
                ]
            ]
            region_row_idx_single: List[int] = []
            for row in data["campus_rows"]:
                table_data.append(
                    [
                        row["campus_name"][:34],
                        row["region"] or "—",
                        str(row["service_rows"]),
                        str(row["total_sunday"]),
                        str(row["total_weekend"]),
                        str(row["avg_sunday"]),
                        str(row["avg_weekend"]),
                        str(row["total_new_people"]),
                        str(row["total_salvations"]),
                    ]
                )
            base_s = len(table_data)
            for j, rrow in enumerate(data.get("region_aggregate_rows") or []):
                region_row_idx_single.append(base_s + j)
                table_data.append(
                    [
                        rrow["campus_name"][:34],
                        rrow["region"] or "—",
                        str(rrow["service_rows"]),
                        str(rrow["total_sunday"]),
                        str(rrow["total_weekend"]),
                        str(rrow["avg_sunday"]),
                        str(rrow["avg_weekend"]),
                        str(rrow["total_new_people"]),
                        str(rrow["total_salvations"]),
                    ]
                )
            table_data.append(
                [
                    "ALL CAMPUSES — TOTAL",
                    "",
                    str(data["totals"]["service_rows"]),
                    str(data["totals"]["sunday"]),
                    str(data["totals"]["weekend"]),
                    "",
                    "",
                    str(data["totals"]["new_people"]),
                    str(data["totals"]["salvations"]),
                ]
            )

            col_widths_s = [avail_w * 0.17, avail_w * 0.06] + [avail_w * 0.11] * 7
            t = Table(table_data, colWidths=col_widths_s, repeatRows=1)
            fs_pdf = 8
            tbl_cmds = [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("FONTSIZE", (0, 1), (-1, -1), fs_pdf),
                ("FONTNAME", (0, 1), (-1, -2), "Helvetica"),
                ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
                ("GRID", (0, 0), (-1, -1), 0.2, colors.HexColor("#cbd5e1")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#f8fafc")]),
                ("LINEABOVE", (0, 0), (-1, 0), 1.0, colors.HexColor("#0f172a")),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#0f172a")),
                ("TEXTCOLOR", (0, -1), (-1, -1), colors.white),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ]
            for ri in region_row_idx_single:
                tbl_cmds.append(("BACKGROUND", (0, ri), (-1, ri), colors.HexColor("#fef3c7")))
                tbl_cmds.append(("TEXTCOLOR", (0, ri), (-1, ri), colors.HexColor("#422006")))
                tbl_cmds.append(("FONTNAME", (0, ri), (-1, ri), "Helvetica-Bold"))
            t.setStyle(TableStyle(tbl_cmds))
            story.append(t)

    doc.build(story)
    pdf = buffer.getvalue()
    buffer.close()
    return pdf
