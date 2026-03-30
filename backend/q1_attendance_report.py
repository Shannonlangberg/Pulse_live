"""
Q1 (Jan–Mar) attendance aggregates for PDF/CSV reports.
Sunday total and weekend total match regional dashboard per-record logic.
"""
from __future__ import annotations

import csv
import io
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Tuple

# Matplotlib non-interactive backend for servers
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt


def _week_key_chart(record_date: date) -> str:
    """Align with dashboard YTD week columns (Mon–Sun); Mon/Tue → prior Sunday's week."""
    rd = record_date
    if rd.weekday() in (0, 1):
        rd = rd - timedelta(days=(rd.weekday() + 1) % 7)
    monday = rd - timedelta(days=rd.weekday())
    year, week_num, _ = monday.isocalendar()
    return f"{year}-W{week_num:02d}"


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


def build_q1_data(
    year: int,
    records: List[Any],
    campuses_by_id: Dict[int, Any],
    filter_summary: str = "",
) -> Dict[str, Any]:
    """Aggregate by campus and by global week."""
    start = date(year, 1, 1)
    end = date(year, 3, 31)

    by_campus: Dict[int, Dict[str, Any]] = defaultdict(
        lambda: {
            "service_rows": 0,
            "total_sunday": 0,
            "total_weekend": 0,
        }
    )
    weekly: Dict[str, Dict[str, int]] = defaultdict(lambda: {"sunday": 0, "weekend": 0})

    for r in records:
        d = r.date
        if d < start or d > end:
            continue
        sun, wknd = record_sunday_and_weekend_totals(r)
        cid = r.campus_id
        by_campus[cid]["service_rows"] += 1
        by_campus[cid]["total_sunday"] += sun
        by_campus[cid]["total_weekend"] += wknd
        wkey = _week_key_chart(d)
        weekly[wkey]["sunday"] += sun
        weekly[wkey]["weekend"] += wknd

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
            }
        )
    campus_rows.sort(key=lambda x: x["campus_name"].lower())

    # Sort weeks chronologically by ISO key
    sorted_week_keys = sorted(weekly.keys())
    weekly_series = [(k, weekly[k]["sunday"], weekly[k]["weekend"]) for k in sorted_week_keys]

    return {
        "year": year,
        "start": start,
        "end": end,
        "filter_summary": (filter_summary or "").strip(),
        "campus_rows": campus_rows,
        "weekly_series": weekly_series,
        "totals": {
            "service_rows": sum(r["service_rows"] for r in campus_rows),
            "sunday": sum(r["total_sunday"] for r in campus_rows),
            "weekend": sum(r["total_weekend"] for r in campus_rows),
        },
    }


def build_q1_csv_bytes(data: Dict[str, Any]) -> bytes:
    buf = io.StringIO()
    w = csv.writer(buf)
    if data.get("filter_summary"):
        w.writerow(["Report filters", data["filter_summary"]])
        w.writerow([])
    w.writerow(
        [
            "Campus",
            "Region",
            "Service rows",
            "Total Sunday (no youth)",
            "Total weekend (w/ youth)",
            "Avg Sunday",
            "Avg weekend",
        ]
    )
    for row in data["campus_rows"]:
        w.writerow(
            [
                row["campus_name"],
                row["region"],
                row["service_rows"],
                row["total_sunday"],
                row["total_weekend"],
                row["avg_sunday"],
                row["avg_weekend"],
            ]
        )
    w.writerow([])
    w.writerow(
        [
            "ALL CAMPUSES",
            "",
            data["totals"]["service_rows"],
            data["totals"]["sunday"],
            data["totals"]["weekend"],
            "",
            "",
        ]
    )
    return buf.getvalue().encode("utf-8-sig")


def _chart_bar_campus(data: Dict[str, Any]) -> io.BytesIO:
    rows = data["campus_rows"]
    fig, ax = plt.subplots(figsize=(10, max(4.0, 0.35 * len(rows) + 1.5)))
    if not rows:
        ax.text(0.5, 0.5, "No data", ha="center", va="center")
        ax.set_axis_off()
    else:
        names = [r["campus_name"][:28] for r in rows]
        y = range(len(names))
        sun = [r["total_sunday"] for r in rows]
        wknd = [r["total_weekend"] for r in rows]
        h = 0.35
        ax.barh([i - h / 2 for i in y], sun, height=h, label="Sunday (no youth)", color="#3b82f6")
        ax.barh([i + h / 2 for i in y], wknd, height=h, label="Weekend (w/ youth)", color="#94a3b8")
        ax.set_yticks(list(y))
        ax.set_yticklabels(names, fontsize=8)
        ax.invert_yaxis()
        ax.legend(loc="lower right", fontsize=8)
        ax.set_xlabel("Attendance (Q1 total)")
    sub = (data.get("filter_summary") or "")[:80]
    t = f"Q1 {data['year']} — by campus"
    if sub:
        t += f"\n({sub})"
    ax.set_title(t, fontsize=10, fontweight="bold")
    plt.tight_layout()
    out = io.BytesIO()
    fig.savefig(out, format="png", dpi=120, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    out.seek(0)
    return out


def _chart_line_weekly(data: Dict[str, Any]) -> io.BytesIO:
    series = data["weekly_series"]
    fig, ax = plt.subplots(figsize=(10, 4))
    if not series:
        ax.text(0.5, 0.5, "No weekly data", ha="center", va="center")
        ax.set_axis_off()
    else:
        labels = [s[0] for s in series]
        sun = [s[1] for s in series]
        wknd = [s[2] for s in series]
        x = range(len(labels))
        ax.plot(x, sun, marker="o", label="Sunday (scope)", color="#3b82f6", linewidth=2)
        ax.plot(x, wknd, marker="s", label="Weekend (scope)", color="#64748b", linewidth=2)
        ax.set_xticks(x)
        ax.set_xticklabels(labels, rotation=45, ha="right", fontsize=7)
        ax.legend(loc="upper right", fontsize=8)
        ax.set_ylabel("Attendance")
        ax.grid(True, alpha=0.3)
    subw = (data.get("filter_summary") or "")[:70]
    tw = f"Q1 {data['year']} — weekly totals"
    if subw:
        tw += f"\n({subw})"
    ax.set_title(tw, fontsize=10, fontweight="bold")
    plt.tight_layout()
    out = io.BytesIO()
    fig.savefig(out, format="png", dpi=120, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    out.seek(0)
    return out


def build_q1_pdf_bytes(data: Dict[str, Any]) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        rightMargin=36,
        leftMargin=36,
        topMargin=42,
        bottomMargin=36,
    )
    styles = getSampleStyleSheet()
    story = []

    title = f"Pulse — Q1 attendance report ({data['start']} to {data['end']})"
    story.append(Paragraph(title, styles["Title"]))
    fs = data.get("filter_summary") or ""
    if fs:
        safe = fs.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        story.append(Paragraph(f"<b>Filters:</b> {safe}", styles["Normal"]))
    story.append(
        Paragraph(
            "Sunday = adults + saints + kids (same logic as regional dashboard). "
            "Weekend = Sunday + youth + youth leaders.",
            styles["Normal"],
        )
    )
    story.append(Spacer(1, 12))

    bar_buf = _chart_bar_campus(data)
    bar_h = min(4.8 * inch, max(2.2 * inch, 0.32 * len(data["campus_rows"]) * inch + 1.1 * inch))
    story.append(Image(bar_buf, width=9.5 * inch, height=bar_h))
    story.append(Spacer(1, 12))

    line_buf = _chart_line_weekly(data)
    story.append(Image(line_buf, width=9.5 * inch, height=3.1 * inch))
    story.append(Spacer(1, 20))

    table_data = [
        [
            "Campus",
            "Region",
            "Rows",
            "Total Sun",
            "Total Wknd",
            "Avg Sun",
            "Avg Wknd",
        ]
    ]
    for row in data["campus_rows"]:
        table_data.append(
            [
                row["campus_name"][:40],
                row["region"] or "—",
                str(row["service_rows"]),
                str(row["total_sunday"]),
                str(row["total_weekend"]),
                str(row["avg_sunday"]),
                str(row["avg_weekend"]),
            ]
        )
    table_data.append(
        [
            "TOTAL",
            "",
            str(data["totals"]["service_rows"]),
            str(data["totals"]["sunday"]),
            str(data["totals"]["weekend"]),
            "",
            "",
        ]
    )

    t = Table(table_data, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#f1f5f9")]),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#e2e8f0")),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ]
        )
    )
    story.append(t)

    doc.build(story)
    pdf = buffer.getvalue()
    buffer.close()
    return pdf
