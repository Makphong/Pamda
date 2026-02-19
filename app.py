
import os
import json
import uuid
import sqlite3
import datetime as dt
import calendar as cal
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from flask import (
    Flask, render_template, request, redirect, url_for,
    session, flash
)

# Google Calendar (server-side OAuth)
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request as GoogleRequest
from googleapiclient.discovery import build


APP_DIR = os.path.abspath(os.path.dirname(__file__))
INSTANCE_DIR = os.path.join(APP_DIR, "instance")
DB_PATH = os.path.join(INSTANCE_DIR, "app.db")

# ---- Flask app ----
app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY", "dev-secret-change-me")
app.config["SESSION_PERMANENT"] = True
# 30 days persistence (PMs have long projects; so does entropy)
app.config["PERMANENT_SESSION_LIFETIME"] = dt.timedelta(days=30)

# ---- Google OAuth settings ----
GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/calendar.readonly"
]
CLIENT_SECRETS_FILE = os.path.join(APP_DIR, "secrets", "client_secret.json")


# ---------- DB helpers ----------
def db() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def init_db() -> None:
    os.makedirs(INSTANCE_DIR, exist_ok=True)
    with db() as con:
        con.executescript(
            """
            PRAGMA journal_mode=WAL;

            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                is_deleted INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                day TEXT NOT NULL,         -- YYYY-MM-DD
                content TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(project_id, day),
                FOREIGN KEY(project_id) REFERENCES projects(id)
            );

            CREATE TABLE IF NOT EXISTS oauth_tokens (
                user_key TEXT PRIMARY KEY,
                token_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS highlights (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                start_day TEXT NOT NULL,   -- YYYY-MM-DD
                end_day TEXT NOT NULL,     -- YYYY-MM-DD
                mode TEXT NOT NULL,        -- border | fill
                color TEXT NOT NULL,       -- e.g. #ea9999
                created_at TEXT NOT NULL,
                FOREIGN KEY(project_id) REFERENCES projects(id)
            );
            """
        )

        # Seed default projects if empty
        cur = con.execute("SELECT COUNT(*) AS c FROM projects WHERE is_deleted=0")
        if cur.fetchone()["c"] == 0:
            con.executemany(
                "INSERT INTO projects(name) VALUES(?)",
                [("Project 1",), ("Project 2",), ("Project 3",), ("Project 4",)]
            )


# ---------- calendar utils ----------
@dataclass(frozen=True)
class MonthRef:
    year: int
    month: int

    @property
    def key(self) -> str:
        return f"{self.year:04d}-{self.month:02d}"

    @property
    def label(self) -> str:
        return dt.date(self.year, self.month, 1).strftime("%b %Y")


def month_range(start: MonthRef, end: MonthRef) -> List[MonthRef]:
    out = []
    y, m = start.year, start.month
    while (y, m) <= (end.year, end.month):
        out.append(MonthRef(y, m))
        m += 1
        if m == 13:
            m = 1
            y += 1
    return out


def month_first_last(mref: MonthRef) -> Tuple[dt.date, dt.date]:
    first = dt.date(mref.year, mref.month, 1)
    last_day = cal.monthrange(mref.year, mref.month)[1]
    last = dt.date(mref.year, mref.month, last_day)
    return first, last



def build_month_grid(mref: MonthRef) -> List[List[Optional[dt.date]]]:
    c = cal.Calendar(firstweekday=0)  # Monday
    weeks = []
    for week in c.monthdatescalendar(mref.year, mref.month):
        row: List[Optional[dt.date]] = []
        for d in week:
            row.append(d if d.month == mref.month else None)
        weeks.append(row)
    return weeks


def parse_monthref(prefix: str) -> Optional[MonthRef]:
    try:
        y = int(request.values.get(f"{prefix}_year"))
        m = int(request.values.get(f"{prefix}_month"))
        if 1 <= m <= 12:
            return MonthRef(y, m)
    except Exception:
        return None
    return None


def ensure_user_key() -> str:
    # Permanent cookie-backed session: survives refresh + closing browser.
    if "user_key" not in session:
        session["user_key"] = str(uuid.uuid4())
    return session["user_key"]


def get_theme() -> str:
    return session.get("theme", "light")


def toggle_theme() -> None:
    session["theme"] = "dark" if get_theme() == "light" else "light"


# ---------- projects ----------
def list_projects(include_deleted: bool = False) -> List[sqlite3.Row]:
    q = "SELECT id, name FROM projects"
    if not include_deleted:
        q += " WHERE is_deleted=0"
    q += " ORDER BY id ASC"
    with db() as con:
        return list(con.execute(q))


def get_visible_project_ids() -> List[int]:
    # Default: show first 4 non-deleted projects
    if "visible_projects" not in session:
        ps = list_projects()
        session["visible_projects"] = [int(p["id"]) for p in ps[:4]]
    return list(map(int, session.get("visible_projects", [])))


def set_visible_project_ids(ids: List[int]) -> None:
    # limit max 4
    ids = [int(x) for x in ids][:4]
    session["visible_projects"] = ids


def toggle_project_visible(pid: int) -> None:
    ids = get_visible_project_ids()
    if pid in ids:
        ids = [x for x in ids if x != pid]
    else:
        if len(ids) >= 4:
            # Replace oldest selection (leftmost) to keep it snappy
            ids = ids[1:] + [pid]
        else:
            ids.append(pid)
    set_visible_project_ids(ids)


# ---------- notes ----------
def get_notes_map(project_ids: List[int], start_day: dt.date, end_day: dt.date) -> Dict[Tuple[int, str], str]:
    if not project_ids:
        return {}
    with db() as con:
        q = """
            SELECT project_id, day, content
            FROM notes
            WHERE project_id IN ({})
              AND day >= ?
              AND day <= ?
        """.format(",".join(["?"] * len(project_ids)))
        args = list(project_ids) + [start_day.isoformat(), end_day.isoformat()]
        rows = con.execute(q, args).fetchall()
    out: Dict[Tuple[int, str], str] = {}
    for r in rows:
        out[(int(r["project_id"]), r["day"])] = r["content"]
    return out


def upsert_note(project_id: int, day: str, content: str) -> None:
    now = dt.datetime.utcnow().isoformat(timespec="seconds") + "Z"
    with db() as con:
        con.execute(
            """
            INSERT INTO notes(project_id, day, content, updated_at)
            VALUES(?,?,?,?)
            ON CONFLICT(project_id, day) DO UPDATE SET
                content=excluded.content,
                updated_at=excluded.updated_at
            """,
            (project_id, day, content, now)
        )


def delete_note(project_id: int, day: str) -> None:
    with db() as con:
        con.execute("DELETE FROM notes WHERE project_id=? AND day=?", (project_id, day))
    # also remove the bulk highlight border/fill for this day (like clearing a single note)
    try:
        remove_highlight_day(project_id, day)
    except Exception:
        pass

# ---------- bulk highlights (for "Add Note" tool) ----------
def _valid_hex_color(s: str) -> str:
    s = (s or "").strip()
    if len(s) == 7 and s.startswith("#"):
        try:
            int(s[1:], 16)
            return s.lower()
        except Exception:
            pass
    return "#ea9999"


def add_highlight(project_id: int, start_day: str, end_day: str, mode: str, color: str) -> None:
    now = dt.datetime.utcnow().isoformat(timespec="seconds") + "Z"
    mode = "fill" if (mode or "").lower() == "fill" else "border"
    color = _valid_hex_color(color)
    with db() as con:
        con.execute(
            """
            INSERT INTO highlights(project_id, start_day, end_day, mode, color, created_at)
            VALUES(?,?,?,?,?,?)
            """,
            (project_id, start_day, end_day, mode, color, now)
        )


def remove_highlight_day(project_id: int, day: str) -> None:
    """
    Remove highlight only for the given day.
    If a highlight is a range, split/shrink the range so other days remain highlighted.
    """
    try:
        target = dt.date.fromisoformat(day)
    except Exception:
        return

    with db() as con:
        rows = con.execute(
            """
            SELECT id, start_day, end_day, mode, color
            FROM highlights
            WHERE project_id=?
              AND start_day <= ?
              AND end_day >= ?
            """,
            (project_id, day, day),
        ).fetchall()

        if not rows:
            return

        now = dt.datetime.utcnow().isoformat(timespec="seconds") + "Z"

        for r in rows:
            try:
                s = dt.date.fromisoformat(r["start_day"])
                e = dt.date.fromisoformat(r["end_day"])
            except Exception:
                continue

            # exact single-day highlight
            if s == target and e == target:
                con.execute("DELETE FROM highlights WHERE id=?", (r["id"],))
                continue

            # shrink from left
            if s == target and target < e:
                ns = (target + dt.timedelta(days=1)).isoformat()
                con.execute("UPDATE highlights SET start_day=? WHERE id=?", (ns, r["id"]))
                continue

            # shrink from right
            if e == target and s < target:
                ne = (target - dt.timedelta(days=1)).isoformat()
                con.execute("UPDATE highlights SET end_day=? WHERE id=?", (ne, r["id"]))
                continue

            # split into two ranges: [s..target-1] and [target+1..e]
            if s < target < e:
                left_end = (target - dt.timedelta(days=1)).isoformat()
                right_start = (target + dt.timedelta(days=1)).isoformat()

                # update current row to be the left part
                con.execute("UPDATE highlights SET end_day=? WHERE id=?", (left_end, r["id"]))

                # insert right part as new row
                con.execute(
                    """
                    INSERT INTO highlights(project_id, start_day, end_day, mode, color, created_at)
                    VALUES(?,?,?,?,?,?)
                    """,
                    (project_id, right_start, e.isoformat(), r["mode"], r["color"], now),
                )


def upsert_note_append(project_id: int, day: str, content: str) -> None:
    content = (content or "").rstrip()
    if not content.strip():
        return

    with db() as con:
        row = con.execute(
            "SELECT content FROM notes WHERE project_id=? AND day=?",
            (project_id, day)
        ).fetchone()

    if row and (row["content"] or "").strip():
        merged = (row["content"].rstrip() + "\n" + content).rstrip()
    else:
        merged = content

    upsert_note(project_id, day, merged)


def get_highlight_map(project_ids: List[int], render_start: dt.date, render_end: dt.date) -> Dict[Tuple[int, str], dict]:
    if not project_ids:
        return {}

    with db() as con:
        q = """
            SELECT id, project_id, start_day, end_day, mode, color
            FROM highlights
            WHERE project_id IN ({})
              AND start_day <= ?
              AND end_day >= ?
            ORDER BY id DESC
        """.format(",".join(["?"] * len(project_ids)))
        args = list(project_ids) + [render_end.isoformat(), render_start.isoformat()]
        rows = con.execute(q, args).fetchall()

    out: Dict[Tuple[int, str], dict] = {}

    for r in rows:
        pid = int(r["project_id"])
        try:
            s = dt.date.fromisoformat(r["start_day"])
            e = dt.date.fromisoformat(r["end_day"])
        except Exception:
            continue

        mode = (r["mode"] or "border").lower()
        mode = "fill" if mode == "fill" else "border"
        color = _valid_hex_color(r["color"])

        cur = max(s, render_start)
        last = min(e, render_end)

        while cur <= last:
            day_iso = cur.isoformat()
            key = (pid, day_iso)

            # keep newest highlight (rows ordered by id DESC)
            if key not in out:
                prev = cur - dt.timedelta(days=1)
                nxt = cur + dt.timedelta(days=1)
                up = cur - dt.timedelta(days=7)
                down = cur + dt.timedelta(days=7)

                in_prev = (s <= prev <= e) and (render_start <= prev <= render_end)
                in_nxt = (s <= nxt <= e) and (render_start <= nxt <= render_end)
                in_up = (s <= up <= e) and (render_start <= up <= render_end)
                in_down = (s <= down <= e) and (render_start <= down <= render_end)

                out[key] = {
                    "mode": mode,
                    "color": color,
                    "l": not in_prev,
                    "r": not in_nxt,
                    "t": not in_up,
                    "b": not in_down,
                }

            cur += dt.timedelta(days=1)

    return out


# ---------- Google Calendar persistence ----------
def token_get(user_key: str) -> Optional[Credentials]:
    with db() as con:
        row = con.execute("SELECT token_json FROM oauth_tokens WHERE user_key=?", (user_key,)).fetchone()
    if not row:
        return None
    try:
        data = json.loads(row["token_json"])
        creds = Credentials.from_authorized_user_info(data, scopes=GOOGLE_SCOPES)
        return creds
    except Exception:
        return None


def token_put(user_key: str, creds: Credentials) -> None:
    now = dt.datetime.utcnow().isoformat(timespec="seconds") + "Z"
    with db() as con:
        con.execute(
            """
            INSERT INTO oauth_tokens(user_key, token_json, updated_at)
            VALUES(?,?,?)
            ON CONFLICT(user_key) DO UPDATE SET
                token_json=excluded.token_json,
                updated_at=excluded.updated_at
            """,
            (user_key, creds.to_json(), now)
        )


def token_delete(user_key: str) -> None:
    with db() as con:
        con.execute("DELETE FROM oauth_tokens WHERE user_key=?", (user_key,))


def google_creds_valid(creds: Credentials) -> Credentials:
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(GoogleRequest())
    return creds


def google_client_config_ok() -> bool:
    return os.path.exists(CLIENT_SECRETS_FILE)


def build_flow(redirect_uri: str) -> Flow:
    return Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=GOOGLE_SCOPES,
        redirect_uri=redirect_uri
    )


def gcal_events_by_day(creds: Credentials, start: dt.datetime, end: dt.datetime) -> Dict[str, List[dict]]:
    """
    Return { 'YYYY-MM-DD': [event, ...] } for primary calendar.
    """
    service = build("calendar", "v3", credentials=creds, cache_discovery=False)

    events: List[dict] = []
    page_token = None
    while True:
        resp = service.events().list(
            calendarId="primary",
            timeMin=start.isoformat() + "Z",
            timeMax=end.isoformat() + "Z",
            singleEvents=True,
            orderBy="startTime",
            maxResults=2500,
            pageToken=page_token
        ).execute()
        events.extend(resp.get("items", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break

    by_day: Dict[str, List[dict]] = {}
    for ev in events:
        # all-day: date, timed: dateTime
        s = ev.get("start", {})
        if "date" in s:
            day = s["date"]
        else:
            day = s.get("dateTime", "")[:10]
        if not day:
            continue
        by_day.setdefault(day, []).append(ev)
    return by_day


# ---------- routes ----------
@app.before_request
def _bootstrap():
    init_db()
    ensure_user_key()
    session.permanent = True


@app.context_processor
def inject_globals():
    # Values needed by base layout across pages
    all_projects = list_projects()
    visible_ids = set(get_visible_project_ids())
    gcal_ready = google_client_config_ok()
    gcal_linked = token_get(session.get("user_key", "")) is not None if gcal_ready else False
    return {
        "all_projects": all_projects,
        "visible_ids": visible_ids,
        "gcal_ready": gcal_ready,
        "gcal_linked": gcal_linked,
        "theme": get_theme(),
    }


@app.get("/")
def index():
    # Date range controls
    today = dt.date.today()
    default_start = MonthRef(today.year, today.month)
    # default: 6 months forward
    default_end_date = today + dt.timedelta(days=185)
    default_end = MonthRef(default_end_date.year, default_end_date.month)

    # Take from query params (GET) for shareable URL
    try:
        sy = int(request.args.get("start_year", default_start.year))
        sm = int(request.args.get("start_month", default_start.month))
        ey = int(request.args.get("end_year", default_end.year))
        em = int(request.args.get("end_month", default_end.month))
        start = MonthRef(sy, sm)
        end = MonthRef(ey, em)
        if (end.year, end.month) < (start.year, start.month):
            start, end = end, start
    except Exception:
        start, end = default_start, default_end

    months = month_range(start, end)
    month_grids = {m.key: build_month_grid(m) for m in months}

    # Hide weeks that are fully in the past (before current week)
    week_start = today - dt.timedelta(days=today.weekday())  # Monday start

    kept_months = []
    kept_grids = {}

    for m in months:
        kept_weeks = []
        for week in month_grids[m.key]:
            ds = [d for d in week if d is not None]
            if not ds:
                continue

            # if the last day of this week (within this month) is before current week => skip
            if max(ds) < week_start:
                continue

            kept_weeks.append(week)

        if kept_weeks:
            kept_months.append(m)
            kept_grids[m.key] = kept_weeks

    # Safety: never allow empty view (at least show current month from current week)
    if not kept_months:
        cur_m = MonthRef(today.year, today.month)
        months = [cur_m]
        grid = build_month_grid(cur_m)
        month_grids = {cur_m.key: [w for w in grid if any((d is not None and d >= week_start) for d in w)]}
    else:
        months = kept_months
        month_grids = kept_grids

    # Visible projects
    all_projects = list_projects()
    visible_ids = get_visible_project_ids()

    # Grid sizing logic: if nothing selected, show first 4
    if not visible_ids:
        visible_ids = [int(p["id"]) for p in all_projects[:4]]
        set_visible_project_ids(visible_ids)

    visible_projects = [p for p in all_projects if int(p["id"]) in visible_ids]

    # Compute notes + (optional) Google events
    start_day = dt.date(months[0].year, months[0].month, 1)
    _, end_last = month_first_last(months[-1])
    visible_pids = [int(p["id"]) for p in visible_projects]
    notes = get_notes_map(visible_pids, start_day, end_last)
    highlights = get_highlight_map(visible_pids, start_day, end_last)

    # Google events (optional)
    gcal_linked = False
    gcal = {}
    if google_client_config_ok():
        creds = token_get(session["user_key"])
        if creds:
            try:
                creds = google_creds_valid(creds)
                token_put(session["user_key"], creds)
                gcal_linked = True
                start_dt = dt.datetime.combine(start_day, dt.time.min)
                end_dt = dt.datetime.combine(end_last + dt.timedelta(days=1), dt.time.min)
                gcal = gcal_events_by_day(creds, start_dt, end_dt)
            except Exception:
                # Fail soft: don't break the calendar for an auth hiccup
                gcal_linked = False

    # Month/year picker range (minimal but practical)
    years = list(range(today.year - 3, today.year + 4))

    return render_template(
        "index.html",
        all_projects=all_projects,
        visible_projects=visible_projects,
        visible_ids=set(visible_ids),
        months=months,
        month_grids=month_grids,
        years=years,
        start=start,
        end=end,
        notes=notes,
        highlights=highlights,
        gcal_events=gcal,
        gcal_ready=google_client_config_ok(),
        gcal_linked=gcal_linked,
        today_iso=today.isoformat(),
        theme=get_theme()
    )




@app.post("/tools/toggle_project/<int:pid>")
def tools_toggle_project(pid: int):
    toggle_project_visible(pid)
    return redirect(request.referrer or url_for("index"))


@app.post("/tools/theme")
def tools_theme():
    toggle_theme()
    return redirect(request.referrer or url_for("index"))


@app.post("/tools/range")
def tools_range():
    # POST from range form, redirect to GET with query params
    sy = request.form.get("start_year")
    sm = request.form.get("start_month")
    ey = request.form.get("end_year")
    em = request.form.get("end_month")
    return redirect(url_for("index", start_year=sy, start_month=sm, end_year=ey, end_month=em))


@app.get("/tools/bulk_note")
def tools_bulk_note():
    projects = list_projects()
    today = dt.date.today().isoformat()
    return render_template("bulk_note.html", projects=projects, today=today, theme=get_theme())


@app.post("/tools/bulk_note")
def tools_bulk_note_submit():
    content = (request.form.get("content") or "").rstrip()
    mode = (request.form.get("mode") or "border").lower()

    # allow empty content ONLY for fill mode (highlight-only)
    if mode != "fill" and not content.strip():
        flash("Note can't be empty.", "error")
        return redirect(url_for("tools_bulk_note"))

    start_str = (request.form.get("start_day") or "").strip()

    end_str = (request.form.get("end_day") or "").strip() or start_str

    try:
        s = dt.date.fromisoformat(start_str)
        e = dt.date.fromisoformat(end_str)
    except Exception:
        flash("Invalid date.", "error")
        return redirect(url_for("tools_bulk_note"))

    if e < s:
        s, e = e, s

    color = request.form.get("color") or "#ea9999"

    target = (request.form.get("target_project") or "all").strip().lower()
    ps = list_projects()

    if target == "all":
        pids = [int(p["id"]) for p in ps]
    else:
        try:
            pid = int(target)
            pids = [pid]
        except Exception:
            pids = []

    if not pids:
        flash("Select a project.", "error")
        return redirect(url_for("tools_bulk_note"))

    for pid in pids:
        add_highlight(pid, s.isoformat(), e.isoformat(), mode, color)

        # only write notes if content is provided (fill can be highlight-only)
        if content.strip():
            cur = s
            while cur <= e:
                upsert_note_append(pid, cur.isoformat(), content)
                cur += dt.timedelta(days=1)


    flash("Added note.", "ok")
    return redirect(url_for("index"))


@app.post("/tools/bulk_clear")
def tools_bulk_clear_submit():
    start_str = (request.form.get("start_day") or "").strip()
    end_str = (request.form.get("end_day") or "").strip() or start_str

    try:
        s = dt.date.fromisoformat(start_str)
        e = dt.date.fromisoformat(end_str)
    except Exception:
        flash("Invalid date.", "error")
        return redirect(url_for("tools_bulk_note"))

    if e < s:
        s, e = e, s

    target = (request.form.get("target_project") or "all").strip().lower()
    ps = list_projects()

    if target == "all":
        pids = [int(p["id"]) for p in ps]
    else:
        try:
            pid = int(target)
            pids = [pid]
        except Exception:
            pids = []

    if not pids:
        flash("Select a project.", "error")
        return redirect(url_for("tools_bulk_note"))

    for pid in pids:
        # delete notes in range
        with db() as con:
            con.execute(
                "DELETE FROM notes WHERE project_id=? AND day>=? AND day<=?",
                (pid, s.isoformat(), e.isoformat()),
            )

        # remove highlight on each day (same behavior as single-day clear)
        cur = s
        while cur <= e:
            try:
                remove_highlight_day(pid, cur.isoformat())
            except Exception:
                pass
            cur += dt.timedelta(days=1)

    flash("Cleared notes.", "ok")
    return redirect(url_for("index"))


@app.get("/manage")
def manage():
    projects = list_projects()
    visible_ids = get_visible_project_ids()
    return render_template("manage.html", projects=projects, visible_ids=set(visible_ids), theme=get_theme())


@app.post("/manage/add")
def manage_add():
    name = (request.form.get("name") or "").strip()
    if not name:
        flash("Project name can't be empty.", "error")
        return redirect(url_for("manage"))
    with db() as con:
        con.execute("INSERT INTO projects(name) VALUES(?)", (name,))
    flash("Added project.", "ok")
    return redirect(url_for("manage"))


@app.post("/manage/rename/<int:pid>")
def manage_rename(pid: int):
    name = (request.form.get("name") or "").strip()
    if not name:
        flash("Project name can't be empty.", "error")
        return redirect(url_for("manage"))
    with db() as con:
        con.execute("UPDATE projects SET name=? WHERE id=? AND is_deleted=0", (name, pid))
    flash("Renamed project.", "ok")
    return redirect(url_for("manage"))


@app.post("/manage/delete/<int:pid>")
def manage_delete(pid: int):
    with db() as con:
        con.execute("UPDATE projects SET is_deleted=1 WHERE id=?", (pid,))
    # Also remove from visible selection
    ids = [x for x in get_visible_project_ids() if x != pid]
    set_visible_project_ids(ids)
    flash("Deleted project.", "ok")
    return redirect(url_for("manage"))


@app.post("/manage/visible")
def manage_visible():
    ids = request.form.getlist("visible_ids")
    set_visible_project_ids([int(x) for x in ids])
    flash("Updated visible projects.", "ok")
    return redirect(url_for("manage"))


@app.get("/note/<int:pid>/<day>")
def note(pid: int, day: str):
    # Validate day
    try:
        dt.date.fromisoformat(day)
    except Exception:
        return redirect(url_for("index"))
    with db() as con:
        proj = con.execute("SELECT id, name FROM projects WHERE id=? AND is_deleted=0", (pid,)).fetchone()
        if not proj:
            return redirect(url_for("index"))
        row = con.execute("SELECT content FROM notes WHERE project_id=? AND day=?", (pid, day)).fetchone()
    content = row["content"] if row else ""
    return render_template("note.html", project=proj, day=day, content=content, theme=get_theme())


@app.post("/note/<int:pid>/<day>")
def note_save(pid: int, day: str):
    action = (request.form.get("action") or "save").lower()
    content = (request.form.get("content") or "").rstrip()

    if action == "clear":
        delete_note(pid, day)
        flash("Cleared.", "ok")
        return redirect(url_for("index"))

    # save
    if content.strip():
        upsert_note(pid, day, content)
        flash("Saved.", "ok")
    else:
        delete_note(pid, day)
        flash("Cleared.", "ok")

    return redirect(url_for("index"))


# ---------- Google Calendar connect/disconnect ----------
@app.post("/gcal/toggle")
def gcal_toggle():
    user_key = session["user_key"]
    if token_get(user_key):
        token_delete(user_key)
        flash("Google Calendar disconnected.", "ok")
        return redirect(url_for("index"))

    if not google_client_config_ok():
        flash("Missing Google OAuth client_secret.json. See README.", "error")
        return redirect(url_for("index"))

    redirect_uri = url_for("gcal_callback", _external=True)
    flow = build_flow(redirect_uri)
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent"
    )
    session["gcal_state"] = state
    return redirect(auth_url)


@app.get("/gcal/oauth2callback")
def gcal_callback():
    if not google_client_config_ok():
        flash("Missing Google OAuth client_secret.json. See README.", "error")
        return redirect(url_for("index"))

    state = session.get("gcal_state")
    redirect_uri = url_for("gcal_callback", _external=True)
    flow = build_flow(redirect_uri)
    flow.fetch_token(authorization_response=request.url)

    creds = flow.credentials
    token_put(session["user_key"], creds)
    flash("Google Calendar linked.", "ok")
    return redirect(url_for("index"))


@app.get("/health")
def health():
    return {"ok": True}


if __name__ == "__main__":
    app.run(debug=True)
