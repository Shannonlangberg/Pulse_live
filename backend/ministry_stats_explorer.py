"""
Ministry Stats Explorer — summed metrics from ``attendance_records`` by campus.

Uses the same composite rules as quarterly reports / dashboard where applicable
(sunday & weekend totals, new people, salvations). Intended for pastors: pick
metrics, region/campuses, date range, and optional metrics_scope (standard vs special).
"""
from __future__ import annotations

import csv
import io
import json
from datetime import date, datetime
from typing import Any, Dict, Iterable, List, Optional, Tuple

# Max rows returned for week-to-week (per-entry) layout to keep JSON/CSV bounded.
MAX_ENTRY_TIMELINE_ROWS = 4000

# Metrics whose values are taken from per-service JSON when ``service_time`` is set.
# ``kids_leaders`` is handled separately: full weekly total, never split across slots.
_SLICE_METRICS = frozenset(
    {
        "sunday_attendance",
        "weekend_attendance",
        "kids_attendance",
        "total_attendance",
        "saints",
    }
)

# Duplicated from q1_attendance_report (keep in sync) — avoids importing matplotlib via q1 module.
def _record_sunday_and_weekend_totals(record: Any) -> Tuple[int, int]:
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


def _record_new_people_total(record: Any, *, include_youth_metrics: bool = True) -> int:
    ftv = record.first_time_visitors or 0
    vis = record.visitors or 0
    yn = record.youth_new_people or 0
    if include_youth_metrics:
        return ftv + vis + yn
    return ftv + vis


def _record_salvations_total(record: Any, *, include_youth_metrics: bool = True) -> int:
    ys = (record.youth_salvations or 0) if include_youth_metrics else 0
    base = (
        (record.first_time_christians or 0)
        + (record.rededications or 0)
        + ys
        + (record.new_kids_salvations or 0)
    )
    if base > 0:
        return base
    return int(record.salvation_cards_returned or 0)

# Single source of truth for the API + CSV + UI (via API response).
METRIC_CATALOG: List[Dict[str, Any]] = [
    {
        "id": "sunday_attendance",
        "label": "Sunday attendance",
        "group": "Attendance (combined)",
        "description": "Adults + saints + kids (incl. leaders), no youth — same logic as dashboard. Shown as average per service row in range (not a sum).",
        "avg_per_service_row": True,
    },
    {
        "id": "weekend_attendance",
        "label": "Weekend attendance",
        "group": "Attendance (combined)",
        "description": "Sunday + youth + youth leaders. Shown as average per service row in range (not a sum).",
        "avg_per_service_row": True,
    },
    {
        "id": "new_people_total",
        "label": "New people (total)",
        "group": "Growth",
        "description": "First-time visitors + visitors + youth new people (youth optional via exclude youth).",
        "respects_exclude_youth": True,
    },
    {
        "id": "salvations_total",
        "label": "Salvations (total)",
        "group": "Growth",
        "description": "Adult salvations + rededications + kids salvations + youth salvations; if all zero, uses salvation cards returned.",
        "respects_exclude_youth": True,
    },
    {
        "id": "baptisms",
        "label": "Baptisms",
        "group": "Milestones",
        "description": "Sum of baptisms recorded on each stats entry.",
    },
    {
        "id": "child_dedications",
        "label": "Child dedications",
        "group": "Milestones",
        "description": "Sum of child dedications per entry.",
    },
    {
        "id": "first_time_christians",
        "label": "First-time Christians (adults)",
        "group": "Salvations (detail)",
        "description": "Raw field from each entry.",
    },
    {
        "id": "rededications",
        "label": "Rededications",
        "group": "Salvations (detail)",
        "description": "Raw field from each entry.",
    },
    {
        "id": "youth_salvations",
        "label": "Youth salvations",
        "group": "Salvations (detail)",
        "description": "Raw field from each entry.",
    },
    {
        "id": "new_kids_salvations",
        "label": "Kids salvations",
        "group": "Salvations (detail)",
        "description": "Raw field from each entry.",
    },
    {
        "id": "salvation_cards_returned",
        "label": "Salvation cards returned",
        "group": "Salvations (detail)",
        "description": "Undifferentiated cards; totals also feed salvations when detail is zero.",
    },
    {
        "id": "first_time_visitors",
        "label": "First-time visitors",
        "group": "New people (detail)",
        "description": "Raw field from each entry.",
    },
    {
        "id": "visitors",
        "label": "Visitors",
        "group": "New people (detail)",
        "description": "Raw field from each entry.",
    },
    {
        "id": "youth_new_people",
        "label": "Youth new people",
        "group": "New people (detail)",
        "description": "Raw field from each entry.",
    },
    {
        "id": "total_attendance",
        "label": "Total attendance (raw)",
        "group": "Attendance (raw)",
        "description": "Value stored on the record (may already include kids).",
    },
    {
        "id": "kids_attendance",
        "label": "Kids in room",
        "group": "Attendance (raw)",
        "description": "Kids in room only (excludes kids leaders). With a service-time filter, uses that slot from kids breakdown. Shown as average per service row in campus summary.",
        "avg_per_service_row": True,
    },
    {
        "id": "kids_leaders",
        "label": "Kids leaders",
        "group": "Attendance (raw)",
        "description": "Kids leaders for that stats entry (whole weekend). Not split by service time — same value on each row when filtering by slot. Campus summary = average per weekly entry.",
        "avg_per_service_row": True,
    },
    {
        "id": "youth_attendance",
        "label": "Youth attendance",
        "group": "Attendance (raw)",
        "description": "Youth only (excl. leaders).",
    },
    {
        "id": "youth_leaders",
        "label": "Youth leaders",
        "group": "Attendance (raw)",
        "description": "Youth leaders per entry.",
    },
    {
        "id": "saints",
        "label": "Saints attendance",
        "group": "Attendance (raw)",
        "description": "Senior / saints ministry headcount.",
    },
    {
        "id": "connect_groups",
        "label": "Connect groups",
        "group": "Engagement",
        "description": "Sum of connect groups count per entry.",
    },
    {
        "id": "dream_team",
        "label": "Dream Team",
        "group": "Engagement",
        "description": "Sum per entry.",
    },
    {
        "id": "tithe",
        "label": "Giving (tithe total)",
        "group": "Finance",
        "description": "Sum of tithe field (numeric) for the range.",
        "is_currency": True,
    },
    {
        "id": "new_kids",
        "label": "New kids",
        "group": "Kids",
        "description": "Raw field per entry.",
    },
    {
        "id": "hands_up",
        "label": "Hands up",
        "group": "Other",
        "description": "Raw field per entry.",
    },
    {
        "id": "packs_out",
        "label": "Packs out",
        "group": "Kids",
        "description": "Raw field per entry.",
    },
]

VALID_METRIC_IDS = frozenset(m["id"] for m in METRIC_CATALOG)

# Mean per attendance row in range (not a sum across weeks). Totals row = same over all matching rows.
AVG_PER_SERVICE_ROW_METRICS = frozenset(
    {"sunday_attendance", "weekend_attendance", "kids_attendance", "kids_leaders"}
)

DEFAULT_METRIC_IDS = [
    "baptisms",
    "sunday_attendance",
    "weekend_attendance",
    "kids_attendance",
    "kids_leaders",
    "new_people_total",
    "salvations_total",
    "dream_team",
]


def metric_catalog_public() -> List[Dict[str, Any]]:
    """Strip nothing — client renders labels and groups."""
    return list(METRIC_CATALOG)


def parse_service_time_param(raw: Optional[str]) -> Optional[str]:
    """Optional clock-time slot (e.g. ``5:30 PM``) matching keys in attendance JSON breakdowns."""
    s = (raw or "").strip()
    if not s:
        return None
    if len(s) > 120:
        raise ValueError("service_time is too long (max 120 characters)")
    if "\n" in s or "\r" in s or "\x00" in s:
        raise ValueError("Invalid service_time")
    return s


def append_service_time_to_summary(summary: str, service_time: Optional[str]) -> str:
    if not service_time:
        return summary
    note = (
        f"Service time: {service_time} — slot columns use stored breakdowns; "
        "Kids attendance = kids in room for that slot only; Kids leaders = full weekly total (not split by slot). "
        "Growth/milestones/finance still use the whole weekly entry."
    )
    return f"{summary} · {note}" if summary else note


def parse_granularity_param(raw: Optional[str]) -> str:
    """
    ``campus`` (default): one result row per campus (aggregated).
    ``entry``: one row per logged attendance date per campus (week-to-week).
    """
    s = (raw or "").strip().lower()
    if s in ("", "campus", "summary", "aggregate"):
        return "campus"
    if s in ("entry", "weekly", "week", "by_date", "timeline"):
        return "entry"
    raise ValueError(
        "Invalid granularity — use campus (default) or entry for week-to-week rows."
    )


def append_timeline_mode_to_summary(summary: str, granularity: str) -> str:
    if granularity != "entry":
        return summary
    bit = "Layout: week-to-week (one row per logged service date and campus)"
    return f"{summary} · {bit}" if summary else bit


def parse_metric_ids_param(raw: Optional[str]) -> List[str]:
    if not raw or not str(raw).strip():
        return list(DEFAULT_METRIC_IDS)
    out: List[str] = []
    for part in str(raw).split(","):
        p = part.strip().lower()
        if p and p in VALID_METRIC_IDS and p not in out:
            out.append(p)
    return out if out else list(DEFAULT_METRIC_IDS)


def _parse_breakdown_json(raw: Optional[str]) -> Dict[str, int]:
    if not raw:
        return {}
    try:
        d = json.loads(raw)
        if not isinstance(d, dict):
            return {}
        out: Dict[str, int] = {}
        for k, v in d.items():
            try:
                out[str(k)] = int(float(str(v).replace(",", "").strip()))
            except (TypeError, ValueError):
                continue
        return out
    except (json.JSONDecodeError, TypeError):
        return {}


def _dict_get_ci(d: Dict[str, int], key: str) -> int:
    if key in d:
        return int(d[key])
    lk = key.strip().lower()
    for k, v in d.items():
        if str(k).strip().lower() == lk:
            return int(v)
    return 0


def _slot_slice_for_service_time(record: Any, service_time: str) -> Tuple[float, float, float]:
    """
    One clock-time slice: adults in slot + kids in room for that slot only.
    Does not allocate kids leaders across slots (leaders are reported separately).
    """
    adult_d = _parse_breakdown_json(getattr(record, "adult_service_breakdown", None))
    kids_d = _parse_breakdown_json(getattr(record, "kids_service_breakdown", None))
    st = service_time.strip()
    adult_slot = float(_dict_get_ci(adult_d, st))
    kids_room = float(_dict_get_ci(kids_d, f"Kids {st}"))
    sunday_slice = adult_slot + kids_room
    weekend_slice = sunday_slice
    return sunday_slice, weekend_slice, kids_room


def _get_metric_value(
    record: Any,
    metric_id: str,
    *,
    include_youth_metrics: bool,
    service_time: Optional[str] = None,
) -> float:
    if service_time:
        if metric_id == "kids_leaders":
            return float(int(getattr(record, "kids_leaders", None) or 0))
        if metric_id in _SLICE_METRICS:
            sunday_slice, weekend_slice, kids_room = _slot_slice_for_service_time(record, service_time)
            if metric_id == "sunday_attendance":
                return float(sunday_slice)
            if metric_id == "weekend_attendance":
                return float(weekend_slice)
            if metric_id == "kids_attendance":
                return float(kids_room)
            if metric_id == "total_attendance":
                return float(sunday_slice)
            if metric_id == "saints":
                return 0.0

    if metric_id == "sunday_attendance":
        s, _ = _record_sunday_and_weekend_totals(record)
        return float(s)
    if metric_id == "weekend_attendance":
        _, w = _record_sunday_and_weekend_totals(record)
        return float(w)
    if metric_id == "kids_attendance":
        return float(int(getattr(record, "kids_attendance", None) or 0))
    if metric_id == "new_people_total":
        return float(_record_new_people_total(record, include_youth_metrics=include_youth_metrics))
    if metric_id == "salvations_total":
        return float(_record_salvations_total(record, include_youth_metrics=include_youth_metrics))
    if metric_id == "tithe":
        v = getattr(record, "tithe", None)
        try:
            return float(v or 0)
        except (TypeError, ValueError):
            return 0.0
    col = metric_id
    v = getattr(record, col, None)
    try:
        return float(int(v or 0))
    except (TypeError, ValueError):
        return 0.0


def parse_inclusive_date_range(
    start_raw: Optional[str],
    end_raw: Optional[str],
    *,
    max_days: int = 1095,
) -> Tuple[date, date]:
    if not (start_raw or "").strip() or not (end_raw or "").strip():
        raise ValueError("start_date and end_date are required (YYYY-MM-DD)")
    try:
        start_d = datetime.strptime(str(start_raw).strip(), "%Y-%m-%d").date()
        end_d = datetime.strptime(str(end_raw).strip(), "%Y-%m-%d").date()
    except ValueError:
        raise ValueError("Invalid date — use YYYY-MM-DD for start_date and end_date") from None
    if start_d > end_d:
        raise ValueError("start_date must be on or before end_date")
    today = date.today()
    if end_d > today:
        raise ValueError("end_date cannot be in the future")
    if start_d < date(2000, 1, 1):
        raise ValueError("start_date must be on or after 2000-01-01")
    if (end_d - start_d).days > max_days:
        raise ValueError(f"Range too long (max {max_days} days, about 3 years)")
    return start_d, end_d


def aggregate_by_campus(
    records: Iterable[Any],
    metric_ids: List[str],
    *,
    campuses_by_id: Dict[int, Any],
    include_youth_metrics: bool,
    service_time: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any], Dict[str, float]]:
    """
    Returns (rows sorted by campus name, totals dict per metric_id, meta).

    Most metrics are summed per campus; ``AVG_PER_SERVICE_ROW_METRICS`` are mean per
    service row for that campus. The footer row uses sum for summed metrics and the
    overall mean per row (all campuses) for average metrics.
    """
    from collections import defaultdict

    def _empty_campus_agg() -> Dict[str, Any]:
        d: Dict[str, Any] = {mid: 0.0 for mid in metric_ids}
        d["_service_rows"] = 0
        return d

    sums: Dict[int, Dict[str, Any]] = defaultdict(_empty_campus_agg)
    grand: Dict[str, float] = {mid: 0.0 for mid in metric_ids}
    total_service_rows = 0

    for r in records:
        cid = r.campus_id
        total_service_rows += 1
        sums[cid]["_service_rows"] += 1
        for mid in metric_ids:
            v = _get_metric_value(
                r,
                mid,
                include_youth_metrics=include_youth_metrics,
                service_time=service_time,
            )
            sums[cid][mid] += v
            grand[mid] += v

    rows: List[Dict[str, Any]] = []
    for cid, agg in sums.items():
        campus = campuses_by_id.get(cid)
        name = campus.display_name if campus else f"Campus ID {cid}"
        reg = ""
        if campus and campus.region:
            reg = (campus.region.code or "").strip()
        sr = int(agg["_service_rows"])
        row: Dict[str, Any] = {
            "campus_id": cid,
            "campus_name": name,
            "region_code": reg,
            "service_rows": sr,
        }
        for mid in metric_ids:
            raw = float(agg[mid])
            if mid in AVG_PER_SERVICE_ROW_METRICS:
                row[mid] = (raw / sr) if sr else 0.0
            else:
                row[mid] = raw
        rows.append(row)

    rows.sort(key=lambda x: (x["region_code"] or "ZZ", x["campus_name"].lower()))

    totals: Dict[str, float] = {}
    for mid in metric_ids:
        if mid in AVG_PER_SERVICE_ROW_METRICS:
            totals[mid] = (grand[mid] / total_service_rows) if total_service_rows else 0.0
        else:
            totals[mid] = grand[mid]

    meta = {
        "total_service_rows": total_service_rows,
        "campus_count": len(rows),
        "service_time": service_time or None,
        "granularity": "campus",
    }
    return rows, totals, meta


def aggregate_by_entry_timeline(
    records: Iterable[Any],
    metric_ids: List[str],
    *,
    campuses_by_id: Dict[int, Any],
    include_youth_metrics: bool,
    service_time: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], Dict[str, float], Dict[str, Any]]:
    """
    One output row per ``AttendanceRecord`` (campus + date), sorted by date then campus.
    Metric cells are that week's values (not period averages). Footer uses the same
    totals rules as the campus summary (sums; means for ``AVG_PER_SERVICE_ROW_METRICS``).
    """
    rec_list = list(records)
    n_all = len(rec_list)
    if n_all > MAX_ENTRY_TIMELINE_ROWS:
        raise ValueError(
            f"Too many rows for week-to-week layout ({n_all} > {MAX_ENTRY_TIMELINE_ROWS}). "
            "Narrow the date range or filter campuses, or use the campus summary."
        )
    rec_list.sort(key=lambda r: (r.date, r.campus_id))
    grand: Dict[str, float] = {mid: 0.0 for mid in metric_ids}
    out_rows: List[Dict[str, Any]] = []

    for r in rec_list:
        campus = campuses_by_id.get(r.campus_id)
        name = campus.display_name if campus else f"Campus ID {r.campus_id}"
        reg = ""
        if campus and campus.region:
            reg = (campus.region.code or "").strip()
        row: Dict[str, Any] = {
            "campus_id": r.campus_id,
            "campus_name": name,
            "region_code": reg,
            "service_date": r.date.isoformat() if getattr(r, "date", None) else "",
        }
        for mid in metric_ids:
            v = float(
                _get_metric_value(
                    r,
                    mid,
                    include_youth_metrics=include_youth_metrics,
                    service_time=service_time,
                )
            )
            row[mid] = v
            grand[mid] += v
        out_rows.append(row)

    n = len(rec_list)
    totals: Dict[str, float] = {}
    for mid in metric_ids:
        if mid in AVG_PER_SERVICE_ROW_METRICS:
            totals[mid] = (grand[mid] / n) if n else 0.0
        else:
            totals[mid] = grand[mid]

    meta = {
        "total_service_rows": n,
        "campus_count": len({r.campus_id for r in rec_list}),
        "service_time": service_time or None,
        "granularity": "entry",
    }
    return out_rows, totals, meta


def build_json_payload(
    *,
    start_d: date,
    end_d: date,
    metric_ids: List[str],
    rows: List[Dict[str, Any]],
    totals: Dict[str, float],
    meta: Dict[str, Any],
    filter_summary: str,
    metrics_scope: str,
    include_youth_metrics: bool,
    service_time: Optional[str] = None,
    granularity: str = "campus",
    timeline_rows: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    catalog = [m for m in METRIC_CATALOG if m["id"] in metric_ids]
    # Preserve requested order
    order = {mid: i for i, mid in enumerate(metric_ids)}
    catalog.sort(key=lambda m: order.get(m["id"], 99))

    g = granularity if granularity in ("campus", "entry") else "campus"
    if g == "entry":
        campus_out: List[Dict[str, Any]] = []
        entry_out = list(timeline_rows or [])
    else:
        campus_out = list(rows)
        entry_out = []

    return {
        "start": start_d.isoformat(),
        "end": end_d.isoformat(),
        "metrics_scope": metrics_scope,
        "include_youth_metrics": include_youth_metrics,
        "service_time": service_time or None,
        "granularity": g,
        "filter_summary": filter_summary,
        "metric_ids": metric_ids,
        "metric_catalog": catalog,
        "campuses": campus_out,
        "entries": entry_out,
        "totals": totals,
        "meta": meta,
    }


def _csv_format_metric_cell(
    catalog: Dict[str, Dict[str, Any]],
    mid: str,
    v: Any,
    *,
    granularity: str = "campus",
) -> str:
    if catalog.get(mid, {}).get("is_currency"):
        return f"{float(v):.2f}"
    if catalog.get(mid, {}).get("avg_per_service_row"):
        # Week-to-week rows are weekly headcounts; footer is mean across weeks — whole people.
        if granularity == "entry":
            return str(int(round(float(v))))
        return f"{float(v):.1f}"
    if isinstance(v, float) and v == int(v):
        return str(int(v))
    return str(v)


def build_csv_bytes(payload: Dict[str, Any]) -> bytes:
    metric_ids: List[str] = list(payload.get("metric_ids") or [])
    totals: Dict[str, float] = dict(payload.get("totals") or {})
    catalog = {m["id"]: m for m in (payload.get("metric_catalog") or [])}
    granularity = payload.get("granularity") or "campus"

    buf = io.StringIO()
    w = csv.writer(buf)

    if granularity == "entry":
        rows: List[Dict[str, Any]] = list(payload.get("entries") or [])
        headers = ["Region", "Campus", "Service date"] + [
            catalog.get(mid, {}).get("label", mid) for mid in metric_ids
        ]
        w.writerow(headers)
        for row in rows:
            line = [
                row.get("region_code") or "",
                row.get("campus_name") or "",
                row.get("service_date") or "",
            ]
            for mid in metric_ids:
                line.append(
                    _csv_format_metric_cell(catalog, mid, row.get(mid, 0), granularity="entry")
                )
            w.writerow(line)
        n = payload.get("meta", {}).get("total_service_rows", len(rows))
        sum_row = ["", "ALL ROWS", str(n)]
        for mid in metric_ids:
            sum_row.append(
                _csv_format_metric_cell(catalog, mid, totals.get(mid, 0), granularity="entry")
            )
        w.writerow(sum_row)
    else:
        rows = list(payload.get("campuses") or [])
        headers = ["Region", "Campus", "Stats rows"] + [
            catalog.get(mid, {}).get("label", mid) for mid in metric_ids
        ]
        w.writerow(headers)
        for row in rows:
            line = [row.get("region_code") or "", row.get("campus_name") or "", row.get("service_rows") or 0]
            for mid in metric_ids:
                line.append(_csv_format_metric_cell(catalog, mid, row.get(mid, 0)))
            w.writerow(line)
        sum_row = ["", "ALL CAMPUSES", payload.get("meta", {}).get("total_service_rows", 0)]
        for mid in metric_ids:
            sum_row.append(_csv_format_metric_cell(catalog, mid, totals.get(mid, 0)))
        w.writerow(sum_row)
    return buf.getvalue().encode("utf-8-sig")
