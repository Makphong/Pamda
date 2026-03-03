import os
import json
import uuid
import sqlite3
import datetime as dt
import calendar as cal
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse, parse_qs
from flask import Flask, render_template, request, redirect, url_for, session, flash

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
GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]
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

            -- legacy (keep for migration/backward compatibility)
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                day TEXT NOT NULL,         -- YYYY-MM-DD
                content TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(project_id, day),
                FOREIGN KEY(project_id) REFERENCES projects(id)
            );

            -- NEW: sub-note items (many per day)
            CREATE TABLE IF NOT EXISTS note_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                day TEXT NOT NULL,         -- YYYY-MM-DD
                text TEXT NOT NULL,
                start_time TEXT,           -- HH:MM (NULL/empty = all-day)
                end_time TEXT,             -- HH:MM
                sort_index INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(project_id) REFERENCES projects(id)
            );

            CREATE INDEX IF NOT EXISTS idx_note_items_pid_day
              ON note_items(project_id, day);

            -- Persist visible projects per user_key (so settings won't vanish)
            CREATE TABLE IF NOT EXISTS user_visible_projects (
                user_key TEXT NOT NULL,
                project_id INTEGER NOT NULL,
                sort_index INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(user_key, project_id),
                FOREIGN KEY(project_id) REFERENCES projects(id)
            );

            -- Existing DBs already have this, but new DB must create it too
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

            -- Existing DBs already have this too
            CREATE TABLE IF NOT EXISTS day_colors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                day TEXT NOT NULL,         -- YYYY-MM-DD
                color_key TEXT NOT NULL,
                UNIQUE(project_id, day),
                FOREIGN KEY(project_id) REFERENCES projects(id)
            );

            CREATE TABLE IF NOT EXISTS oauth_tokens (
                user_key TEXT PRIMARY KEY,
                token_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS gcal_day_events (
                user_key TEXT NOT NULL,
                day TEXT NOT NULL,         -- YYYY-MM-DD
                events_json TEXT NOT NULL, -- JSON list
                updated_at TEXT NOT NULL,
                PRIMARY KEY(user_key, day)
            );
            """
        )

        # --- lightweight migrations (keep existing instance DB working) ---
        try:
            con.execute("ALTER TABLE projects ADD COLUMN overview_note TEXT")
        except Exception:
            pass

        try:
            con.execute("ALTER TABLE projects ADD COLUMN link_name TEXT")
        except Exception:
            pass

        try:
            con.execute("ALTER TABLE note_items ADD COLUMN start_time TEXT")
        except Exception:
            pass

        try:
            con.execute("ALTER TABLE note_items ADD COLUMN end_time TEXT")
        except Exception:
            pass

        try:
            con.execute("ALTER TABLE projects ADD COLUMN link_url TEXT")
        except Exception:
            pass

        # --- migrate legacy notes
        try:
            now = dt.datetime.utcnow().isoformat(timespec="seconds") + "Z"

            legacy_rows = con.execute(
                "SELECT project_id, day, content FROM notes WHERE TRIM(content) <> ''"
            ).fetchall()

            for r in legacy_rows:
                pid = int(r["project_id"])
                day = r["day"]

                # if already migrated, skip
                exists = con.execute(
                    "SELECT 1 FROM note_items WHERE project_id=? AND day=? LIMIT 1",
                    (pid, day),
                ).fetchone()
                if exists:
                    continue

                lines = [
                    ln.strip() for ln in (r["content"] or "").splitlines() if ln.strip()
                ]
                if not lines:
                    continue

                for idx, text in enumerate(lines):
                    con.execute(
                        """
                        INSERT INTO note_items(project_id, day, text, sort_index, created_at, updated_at)
                        VALUES(?,?,?,?,?,?)
                        """,
                        (pid, day, text, idx, now, now),
                    )
        except Exception:
            pass

        # Seed default projects if empty
        cur = con.execute("SELECT COUNT(*) AS c FROM projects WHERE is_deleted=0")
        if cur.fetchone()["c"] == 0:
            con.executemany(
                "INSERT INTO projects(name) VALUES(?)",
                [("Project 1",), ("Project 2",), ("Project 3",), ("Project 4",)],
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


def list_projects(include_deleted: bool = False) -> List[sqlite3.Row]:
    q = """
        SELECT
            id,
            name,
            COALESCE(overview_note, '') AS overview_note,
            COALESCE(link_name, '') AS link_name,
            COALESCE(link_url, '') AS link_url
        FROM projects
    """.strip()
    if not include_deleted:
        q += " WHERE is_deleted=0"
    q += " ORDER BY id ASC"
    with db() as con:
        return list(con.execute(q))


def get_main_visible_project_ids() -> List[int]:
    """Projects chosen in Manage screen (max 4). Persisted via DB/user_key."""
    # 1) try DB (persisted by user_key)
    user_key = session.get("user_key")
    if user_key:
        with db() as con:
            rows = con.execute(
                """
                SELECT project_id
                FROM user_visible_projects
                WHERE user_key=?
                ORDER BY sort_index ASC
                """,
                (user_key,),
            ).fetchall()
        if rows:
            return [int(r["project_id"]) for r in rows]

    # 2) fallback session
    if "visible_projects" in session and session["visible_projects"]:
        return list(map(int, session.get("visible_projects", [])))

    # 3) default: first 4 projects
    ps = list_projects()
    ids = [int(p["id"]) for p in ps[:4]]
    set_visible_project_ids(ids)
    return ids


def get_visible_project_ids() -> List[int]:
    """Current view projects.
    - If user is in Focus mode => single project (stored in session)
    - Otherwise => main visible selection (Manage screen, max 4)
    """
    focus_pid = session.get("focus_pid")
    if focus_pid:
        try:
            return [int(focus_pid)]
        except Exception:
            session.pop("focus_pid", None)

    return get_main_visible_project_ids()


def set_visible_project_ids(ids: List[int]) -> None:
    """Set main visible selection (Manage screen). Clears Focus mode."""
    # limit max 4
    ids = [int(x) for x in ids][:4]
    session["visible_projects"] = ids
    session.pop("focus_pid", None)

    user_key = session.get("user_key")
    if not user_key:
        return

    with db() as con:
        con.execute("DELETE FROM user_visible_projects WHERE user_key=?", (user_key,))
        con.executemany(
            """
            INSERT INTO user_visible_projects(user_key, project_id, sort_index)
            VALUES(?,?,?)
            """,
            [(user_key, pid, i) for i, pid in enumerate(ids)],
        )


def toggle_project_visible(pid: int) -> None:
    """Topbar chip behavior = Focus mode (does NOT rewrite main visible selection)."""
    # ensure main visible list exists (so unfocus returns somewhere sensible)
    _ = get_main_visible_project_ids()

    cur_focus = session.get("focus_pid")
    if cur_focus and int(cur_focus) == int(pid):
        # click same project again => exit focus
        session.pop("focus_pid", None)
        return

    # focus the clicked project
    session["focus_pid"] = int(pid)


# ---------- note items (sub-notes) ----------
def _note_item_label(
    start_time: Optional[str], end_time: Optional[str], text: str
) -> str:
    st = (start_time or "").strip()
    et = (end_time or "").strip()
    if st:
        if et:
            return f"{st}-{et} {text}"
        return f"{st} {text}"
    return text


def _clean_time_field(s: Optional[str]) -> Optional[str]:
    s = (s or "").strip()
    if not s:
        return None
    # HTML <input type="time"> returns HH:MM
    try:
        dt.time.fromisoformat(s)
    except Exception:
        return None
    return s[:5]


def _time_to_minutes(t: Optional[str]) -> Optional[int]:
    t = (t or "").strip()
    if not t:
        return None
    try:
        # expect HH:MM
        tt = dt.time.fromisoformat(t)
        return tt.hour * 60 + tt.minute
    except Exception:
        return None


def _note_item_time_str(start_time: Optional[str], end_time: Optional[str]) -> str:
    st = (start_time or "").strip()
    et = (end_time or "").strip()
    if st and et:
        return f"{st}-{et}"
    if st:
        return st
    if et:
        return et
    return ""


def get_note_items_map(
    project_ids: List[int], start_day: dt.date, end_day: dt.date
) -> Dict[Tuple[int, str], List[dict]]:
    if not project_ids:
        return {}

    with db() as con:
        q = """
            SELECT id, project_id, day, text, start_time, end_time, sort_index
            FROM note_items
            WHERE project_id IN ({})
              AND day >= ?
              AND day <= ?
            ORDER BY
              project_id ASC,
              day ASC,
              CASE WHEN start_time IS NULL OR TRIM(start_time)='' THEN 1 ELSE 0 END ASC,
              start_time ASC,
              CASE WHEN end_time IS NULL OR TRIM(end_time)='' THEN 1 ELSE 0 END ASC,
              end_time ASC,
              sort_index ASC,
              id ASC
        """.format(",".join(["?"] * len(project_ids)))
        args = list(project_ids) + [start_day.isoformat(), end_day.isoformat()]
        rows = con.execute(q, args).fetchall()

    out: Dict[Tuple[int, str], List[dict]] = {}
    for r in rows:
        key = (int(r["project_id"]), r["day"])
        out.setdefault(key, []).append(
            {
                "id": int(r["id"]),
                "text": r["text"],
                "start_time": r["start_time"],
                "end_time": r["end_time"],
                "label": _note_item_label(r["start_time"], r["end_time"], r["text"]),
            }
        )
    return out


def add_note_item(
    project_id: int,
    day: str,
    text: str,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
) -> None:
    text = (text or "").strip()
    if not text:
        return

    st = _clean_time_field(start_time)
    et = _clean_time_field(end_time)

    # If start time is missing => treat as all-day (ignore end)
    if not st:
        st = None
        et = None

    now = dt.datetime.utcnow().isoformat(timespec="seconds") + "Z"

    with db() as con:
        nxt = con.execute(
            """
            SELECT COALESCE(MAX(sort_index), -1) + 1 AS n
            FROM note_items
            WHERE project_id=? AND day=?
            """,
            (project_id, day),
        ).fetchone()["n"]

        con.execute(
            """
            INSERT INTO note_items(project_id, day, text, start_time, end_time, sort_index, created_at, updated_at)
            VALUES(?,?,?,?,?,?,?,?)
            """,
            (project_id, day, text, st, et, int(nxt), now, now),
        )


def edit_note_item(
    project_id: int,
    item_id: int,
    text: str,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
) -> None:
    text = (text or "").strip()
    now = dt.datetime.utcnow().isoformat(timespec="seconds") + "Z"

    st = _clean_time_field(start_time)
    et = _clean_time_field(end_time)

    if not st:
        st = None
        et = None

    with db() as con:
        if text:
            con.execute(
                """
                UPDATE note_items
                SET text=?, start_time=?, end_time=?, updated_at=?
                WHERE id=? AND project_id=?
                """,
                (text, st, et, now, item_id, project_id),
            )
        else:
            # empty text => delete
            con.execute(
                "DELETE FROM note_items WHERE id=? AND project_id=?",
                (item_id, project_id),
            )


def delete_note_item(project_id: int, item_id: int) -> None:
    with db() as con:
        con.execute(
            "DELETE FROM note_items WHERE id=? AND project_id=?",
            (item_id, project_id),
        )


def delete_note_items_day(project_id: int, day: str) -> None:
    with db() as con:
        con.execute(
            "DELETE FROM note_items WHERE project_id=? AND day=?",
            (project_id, day),
        )
    # also remove highlight for this day
    try:
        remove_highlight_day(project_id, day)
    except Exception:
        pass


def add_note_items_append(project_id: int, day: str, content: str) -> None:
    """
    Used by Bulk Note tool. Each line becomes a sub-note item.
    """
    content = (content or "").rstrip()
    if not content.strip():
        return

    lines = [ln.strip() for ln in content.splitlines() if ln.strip()]
    if not lines:
        return

    for ln in lines:
        add_note_item(project_id, day, ln)


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


def add_highlight(
    project_id: int, start_day: str, end_day: str, mode: str, color: str
) -> None:
    now = dt.datetime.utcnow().isoformat(timespec="seconds") + "Z"
    mode = "fill" if (mode or "").lower() == "fill" else "border"
    color = _valid_hex_color(color)
    with db() as con:
        con.execute(
            """
            INSERT INTO highlights(project_id, start_day, end_day, mode, color, created_at)
            VALUES(?,?,?,?,?,?)
            """,
            (project_id, start_day, end_day, mode, color, now),
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
                con.execute(
                    "UPDATE highlights SET start_day=? WHERE id=?", (ns, r["id"])
                )
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
                con.execute(
                    "UPDATE highlights SET end_day=? WHERE id=?", (left_end, r["id"])
                )

                # insert right part as new row
                con.execute(
                    """
                    INSERT INTO highlights(project_id, start_day, end_day, mode, color, created_at)
                    VALUES(?,?,?,?,?,?)
                    """,
                    (
                        project_id,
                        right_start,
                        e.isoformat(),
                        r["mode"],
                        r["color"],
                        now,
                    ),
                )


def get_highlight_map(
    project_ids: List[int], render_start: dt.date, render_end: dt.date
) -> Dict[Tuple[int, str], dict]:
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
        row = con.execute(
            "SELECT token_json FROM oauth_tokens WHERE user_key=?", (user_key,)
        ).fetchone()
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
            (user_key, creds.to_json(), now),
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
        CLIENT_SECRETS_FILE, scopes=GOOGLE_SCOPES, redirect_uri=redirect_uri
    )


def gcal_events_by_day(
    creds: Credentials, start: dt.datetime, end: dt.datetime
) -> Dict[str, List[dict]]:
    """
    Return { 'YYYY-MM-DD': [event, ...] } for primary calendar.
    """
    service = build("calendar", "v3", credentials=creds, cache_discovery=False)

    events: List[dict] = []
    page_token = None
    while True:
        resp = (
            service.events()
            .list(
                calendarId="primary",
                timeMin=start.isoformat() + "Z",
                timeMax=end.isoformat() + "Z",
                singleEvents=True,
                orderBy="startTime",
                maxResults=2500,
                pageToken=page_token,
            )
            .execute()
        )
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


def _gcal_norm_event(ev: dict) -> dict:
    s = ev.get("start", {}) or {}
    e = ev.get("end", {}) or {}

    is_all_day = "date" in s
    start = s.get("dateTime") or s.get("date") or ""
    end = e.get("dateTime") or e.get("date") or ""

    return {
        "id": ev.get("id", ""),
        "summary": ev.get("summary") or "(no title)",
        "start": start,
        "end": end,
        "is_all_day": bool(is_all_day),
        "location": ev.get("location") or "",
        "description": ev.get("description") or "",
        "htmlLink": ev.get("htmlLink") or "",
    }


def gcal_store_range(
    user_key: str, by_day_norm: Dict[str, List[dict]], start_day: str, end_day: str
) -> None:
    """
    Upsert days that have events, and delete days in [start_day..end_day] that now have no events.
    """
    now = dt.datetime.utcnow().isoformat(timespec="seconds") + "Z"

    with db() as con:
        # upsert days with events
        for day, evs in by_day_norm.items():
            con.execute(
                """
                INSERT INTO gcal_day_events(user_key, day, events_json, updated_at)
                VALUES(?,?,?,?)
                ON CONFLICT(user_key, day) DO UPDATE SET
                    events_json=excluded.events_json,
                    updated_at=excluded.updated_at
                """,
                (user_key, day, json.dumps(evs, ensure_ascii=False), now),
            )

        # delete days in range that are NOT in fetched result (means now empty)
        days_with_events = sorted([d for d, evs in by_day_norm.items() if evs])
        if days_with_events:
            placeholders = ",".join(["?"] * len(days_with_events))
            con.execute(
                f"""
                DELETE FROM gcal_day_events
                WHERE user_key=?
                  AND day>=?
                  AND day<=?
                  AND day NOT IN ({placeholders})
                """,
                [user_key, start_day, end_day] + days_with_events,
            )
        else:
            con.execute(
                """
                DELETE FROM gcal_day_events
                WHERE user_key=?
                  AND day>=?
                  AND day<=?
                """,
                (user_key, start_day, end_day),
            )


def gcal_load_range(
    user_key: str, start_day: str, end_day: str
) -> Dict[str, List[dict]]:
    with db() as con:
        rows = con.execute(
            """
            SELECT day, events_json
            FROM gcal_day_events
            WHERE user_key=?
              AND day>=?
              AND day<=?
            """,
            (user_key, start_day, end_day),
        ).fetchall()

    out: Dict[str, List[dict]] = {}
    for r in rows:
        try:
            out[r["day"]] = json.loads(r["events_json"] or "[]")
        except Exception:
            out[r["day"]] = []
    return out


def gcal_load_day(user_key: str, day: str) -> List[dict]:
    with db() as con:
        row = con.execute(
            "SELECT events_json FROM gcal_day_events WHERE user_key=? AND day=?",
            (user_key, day),
        ).fetchone()
    if not row:
        return []
    try:
        return json.loads(row["events_json"] or "[]")
    except Exception:
        return []


def gcal_clear_user(user_key: str) -> None:
    with db() as con:
        con.execute("DELETE FROM gcal_day_events WHERE user_key=?", (user_key,))


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
    main_visible_ids = set(get_main_visible_project_ids())
    tool_projects = [p for p in all_projects if int(p["id"]) in main_visible_ids]

    visible_ids = set(get_visible_project_ids())
    gcal_ready = google_client_config_ok()
    gcal_linked = (
        token_get(session.get("user_key", "")) is not None if gcal_ready else False
    )
    return {
        "all_projects": all_projects,
        "tool_projects": tool_projects,
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
        month_grids = {
            cur_m.key: [
                w for w in grid if any((d is not None and d >= week_start) for d in w)
            ]
        }
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
    day_items = get_note_items_map(visible_pids, start_day, end_last)
    highlights = get_highlight_map(visible_pids, start_day, end_last)

    # Google events (optional)
    # Google events (optional) — store in DB, show only a red dot on calendar
    gcal_linked = False
    gcal_counts: Dict[str, int] = {}

    if google_client_config_ok():
        creds = token_get(session["user_key"])
        if creds:
            gcal_linked = True
            try:
                creds = google_creds_valid(creds)
                token_put(session["user_key"], creds)

                start_dt = dt.datetime.combine(start_day, dt.time.min)
                end_dt = dt.datetime.combine(
                    end_last + dt.timedelta(days=1), dt.time.min
                )

                raw_by_day = gcal_events_by_day(creds, start_dt, end_dt)
                norm_by_day = {
                    day: [_gcal_norm_event(ev) for ev in evs]
                    for day, evs in raw_by_day.items()
                }

                # persist into PM Calendar DB table
                gcal_store_range(
                    session["user_key"],
                    norm_by_day,
                    start_day.isoformat(),
                    end_last.isoformat(),
                )

                # only send counts to calendar UI (no details shown on grid)
                gcal_counts = {day: len(evs) for day, evs in norm_by_day.items() if evs}

            except Exception:
                # Fail soft: keep UI usable, use last stored data (if any)
                stored = gcal_load_range(
                    session["user_key"], start_day.isoformat(), end_last.isoformat()
                )
                gcal_counts = {day: len(evs) for day, evs in stored.items() if evs}

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
        day_items=day_items,
        highlights=highlights,
        gcal_counts=gcal_counts,
        gcal_ready=google_client_config_ok(),
        gcal_linked=gcal_linked,
        today_iso=today.isoformat(),
        theme=get_theme(),
    )


# ---------- All Projects (read-only combined view) ----------
def get_all_note_items_by_day_range(
    start_day: dt.date, end_day: dt.date
) -> Dict[str, List[dict]]:
    with db() as con:
        rows = con.execute(
            """
            SELECT ni.id, ni.project_id, p.name AS project_name, ni.day,
                   ni.text, ni.start_time, ni.end_time, ni.sort_index
            FROM note_items ni
            JOIN projects p ON p.id = ni.project_id
            WHERE p.is_deleted=0
              AND ni.day >= ?
              AND ni.day <= ?
            ORDER BY
              ni.day ASC,
              CASE WHEN ni.start_time IS NULL OR TRIM(ni.start_time)='' THEN 1 ELSE 0 END ASC,
              ni.start_time ASC,
              CASE WHEN ni.end_time IS NULL OR TRIM(ni.end_time)='' THEN 1 ELSE 0 END ASC,
              ni.end_time ASC,
              p.name ASC,
              ni.sort_index ASC,
              ni.id ASC
            """,
            (start_day.isoformat(), end_day.isoformat()),
        ).fetchall()

    out: Dict[str, List[dict]] = {}
    for r in rows:
        day = r["day"]
        out.setdefault(day, []).append(
            {
                "id": int(r["id"]),
                "project_id": int(r["project_id"]),
                "project_name": r["project_name"],
                "text": r["text"],
                "start_time": r["start_time"],
                "end_time": r["end_time"],
                "label": _note_item_label(r["start_time"], r["end_time"], r["text"]),
            }
        )
    return out


def get_all_note_items_day(day: str) -> List[dict]:
    with db() as con:
        rows = con.execute(
            """
            SELECT ni.id, ni.project_id, p.name AS project_name,
                   ni.text, ni.start_time, ni.end_time, ni.sort_index
            FROM note_items ni
            JOIN projects p ON p.id = ni.project_id
            WHERE p.is_deleted=0
              AND ni.day = ?
            ORDER BY
              CASE WHEN ni.start_time IS NULL OR TRIM(ni.start_time)='' THEN 1 ELSE 0 END ASC,
              ni.start_time ASC,
              CASE WHEN ni.end_time IS NULL OR TRIM(ni.end_time)='' THEN 1 ELSE 0 END ASC,
              ni.end_time ASC,
              p.name ASC,
              ni.sort_index ASC,
              ni.id ASC
            """,
            (day,),
        ).fetchall()

    out: List[dict] = []
    for r in rows:
        st_min = _time_to_minutes(r["start_time"])
        et_min = _time_to_minutes(r["end_time"])

        # Normalize for drawing bars
        # - if only start_time => assume 30 mins block
        # - if only end_time   => assume 30 mins block ending at end_time
        if st_min is not None and et_min is None:
            et_min = min(st_min + 30, 1440)
        elif st_min is None and et_min is not None:
            st_min = max(et_min - 30, 0)

        has_time = st_min is not None and et_min is not None

        bar_left = "0"
        bar_width = "0"
        if has_time:
            if et_min < st_min:
                et_min = st_min

            dur = et_min - st_min
            # Minimum visual length so very short tasks are still visible (~15 mins)
            dur = max(dur, 15)

            bar_left = f"{(st_min / 1440) * 100:.4f}"
            bar_width = f"{(dur / 1440) * 100:.4f}"

        out.append(
            {
                "id": int(r["id"]),
                "project_id": int(r["project_id"]),
                "project_name": r["project_name"],
                "text": r["text"],
                "start_time": r["start_time"],
                "end_time": r["end_time"],
                "label": _note_item_label(r["start_time"], r["end_time"], r["text"]),
                "time_str": _note_item_time_str(r["start_time"], r["end_time"]),
                "has_time": bool(has_time),
                "bar_left": bar_left,
                "bar_width": bar_width,
            }
        )

    return out


@app.get("/all")
def all_projects():
    # Date range controls (same behavior as /)
    today = dt.date.today()
    default_start = MonthRef(today.year, today.month)
    default_end_date = today + dt.timedelta(days=185)
    default_end = MonthRef(default_end_date.year, default_end_date.month)

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

    week_start = today - dt.timedelta(days=today.weekday())  # Monday start

    kept_months = []
    kept_grids = {}

    for m in months:
        kept_weeks = []
        for week in month_grids[m.key]:
            ds = [d for d in week if d is not None]
            if not ds:
                continue
            if max(ds) < week_start:
                continue
            kept_weeks.append(week)

        if kept_weeks:
            kept_months.append(m)
            kept_grids[m.key] = kept_weeks

    if not kept_months:
        cur_m = MonthRef(today.year, today.month)
        months = [cur_m]
        grid = build_month_grid(cur_m)
        month_grids = {
            cur_m.key: [
                w for w in grid if any((d is not None and d >= week_start) for d in w)
            ]
        }
    else:
        months = kept_months
        month_grids = kept_grids

    start_day = dt.date(months[0].year, months[0].month, 1)
    _, end_last = month_first_last(months[-1])

    # All note items across all projects, but show max 5 per day on calendar
    by_day = get_all_note_items_by_day_range(start_day, end_last)
    day_items = {day: items[:5] for day, items in by_day.items()}
    # Highlights (fill colors) across all projects — used in All Project calendar cells
    all_pids = [int(p["id"]) for p in list_projects()]
    hl_map = get_highlight_map(all_pids, start_day, end_last)

    def _merge_hl_fill(day_iso: str) -> Optional[str]:
        colors: List[str] = []
        for (pid, d_iso), hl in hl_map.items():
            if d_iso != day_iso:
                continue
            if (hl.get("mode") or "") != "fill":
                continue
            c = hl.get("color")
            if c and c not in colors:
                colors.append(c)

        if not colors:
            return None
        if len(colors) == 1:
            return colors[0]

        # multiple fills in same day => show a simple stripe gradient
        step = 100 / len(colors)
        stops = []
        for i, c in enumerate(colors):
            a = i * step
            b = (i + 1) * step
            stops.append(f"{c} {a:.0f}% {b:.0f}%")
        return "linear-gradient(135deg, " + ", ".join(stops) + ")"

    all_fill: Dict[str, str] = {}
    cur = start_day
    while cur <= end_last:
        iso = cur.isoformat()
        style = _merge_hl_fill(iso)
        if style:
            all_fill[iso] = style
        cur += dt.timedelta(days=1)

    # Google events counts (same as /)
    gcal_linked = False
    gcal_counts: Dict[str, int] = {}

    if google_client_config_ok():
        creds = token_get(session["user_key"])
        if creds:
            gcal_linked = True
            try:
                creds = google_creds_valid(creds)
                token_put(session["user_key"], creds)

                start_dt = dt.datetime.combine(start_day, dt.time.min)
                end_dt = dt.datetime.combine(
                    end_last + dt.timedelta(days=1), dt.time.min
                )

                raw_by_day = gcal_events_by_day(creds, start_dt, end_dt)
                norm_by_day = {
                    day: [_gcal_norm_event(ev) for ev in evs]
                    for day, evs in raw_by_day.items()
                }

                gcal_store_range(
                    session["user_key"],
                    norm_by_day,
                    start_day.isoformat(),
                    end_last.isoformat(),
                )

                gcal_counts = {day: len(evs) for day, evs in norm_by_day.items() if evs}

            except Exception:
                stored = gcal_load_range(
                    session["user_key"], start_day.isoformat(), end_last.isoformat()
                )
                gcal_counts = {day: len(evs) for day, evs in stored.items() if evs}

    years = list(range(today.year - 3, today.year + 4))

    return render_template(
        "all.html",
        months=months,
        month_grids=month_grids,
        years=years,
        start=start,
        end=end,
        day_items=day_items,
        all_fill=all_fill,
        gcal_counts=gcal_counts,
        gcal_ready=google_client_config_ok(),
        gcal_linked=gcal_linked,
        today_iso=today.isoformat(),
        theme=get_theme(),
    )


@app.get("/all/<day>")
def all_projects_day(day: str):
    try:
        dt.date.fromisoformat(day)
    except Exception:
        return redirect(url_for("all_projects"))

    items = get_all_note_items_day(day)
    gcal_events = gcal_load_day(session["user_key"], day)

    return render_template(
        "all_day.html",
        day=day,
        items=items,
        gcal_events=gcal_events,
        theme=get_theme(),
    )


@app.post("/tools/toggle_project/<int:pid>")
def tools_toggle_project(pid: int):
    toggle_project_visible(pid)

    ref = request.referrer or ""
    try:
        u = urlparse(ref)
        # ถ้ากดจากหน้า All Project ให้ไปหน้า index (โฟกัสโปรเจกต์ที่กด)
        if u.path.startswith("/all"):
            q = parse_qs(u.query or "")
            params = {k: (v[0] if v else "") for k, v in q.items()}
            params = {k: v for k, v in params.items() if v}
            return redirect(url_for("index", **params))
    except Exception:
        pass

    return redirect(ref or url_for("index"))


@app.post("/tools/toggle_all")
def tools_toggle_all():
    # คงช่วงเดือนเดิมถ้ามีส่งมา
    params = {}
    for k in ["start_year", "start_month", "end_year", "end_month"]:
        v = (request.form.get(k) or "").strip()
        if v:
            params[k] = v

    ref = request.referrer or ""
    try:
        u = urlparse(ref)
        # ถ้าอยู่หน้า All แล้วกด All อีกครั้ง -> กลับหน้า index (แสดง 4 โปรเจกต์เดิม)
        if u.path.startswith("/all"):
            return redirect(url_for("index", **params))
    except Exception:
        pass

    # ถ้าไม่ได้อยู่หน้า All -> ไปหน้า All
    return redirect(url_for("all_projects", **params))


@app.post("/tools/show_default")
def tools_show_default():
    # กลับไปค่าเริ่มต้น 4 โปรเจกต์แรก
    ps = list_projects()
    default_ids = [int(p["id"]) for p in ps[:4]]
    set_visible_project_ids(default_ids)

    # พยายามคงช่วงวันที่ (ถ้ามีส่งมาจากฟอร์ม)
    params = {}
    for k in ["start_year", "start_month", "end_year", "end_month"]:
        v = (request.form.get(k) or "").strip()
        if v:
            params[k] = v

    return redirect(url_for("index", **params))


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
    return redirect(
        url_for("index", start_year=sy, start_month=sm, end_year=ey, end_month=em)
    )


@app.get("/tools/bulk_note")
def tools_bulk_note():
    projects = list_projects()
    today = dt.date.today().isoformat()
    return render_template(
        "bulk_note.html", projects=projects, today=today, theme=get_theme()
    )


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
                add_note_items_append(pid, cur.isoformat(), content)
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
        # delete note items in range
        with db() as con:
            con.execute(
                "DELETE FROM note_items WHERE project_id=? AND day>=? AND day<=?",
                (pid, s.isoformat(), e.isoformat()),
            )
            # also clear legacy notes (optional but keeps DB tidy)
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
    return render_template(
        "manage.html",
        projects=projects,
        visible_ids=set(visible_ids),
        theme=get_theme(),
    )


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
        con.execute(
            "UPDATE projects SET name=? WHERE id=? AND is_deleted=0", (name, pid)
        )
    flash("Renamed project.", "ok")
    return redirect(url_for("manage"))


@app.post("/manage/delete/<int:pid>")
def manage_delete(pid: int):
    with db() as con:
        con.execute("UPDATE projects SET is_deleted=1 WHERE id=?", (pid,))
    # Also remove from main visible selection (Manage screen)
    ids = [x for x in get_main_visible_project_ids() if x != pid]
    set_visible_project_ids(ids)
    flash("Deleted project.", "ok")
    return redirect(url_for("manage"))


@app.post("/manage/visible")
def manage_visible():
    ids = request.form.getlist("visible_ids")
    set_visible_project_ids([int(x) for x in ids])
    flash("Updated visible projects.", "ok")
    return redirect(url_for("manage"))


# ---------- project header actions: overview + link ----------
@app.post("/project/<int:pid>/overview")
def project_overview(pid: int):
    text = (request.form.get("overview") or "").rstrip()
    with db() as con:
        con.execute(
            "UPDATE projects SET overview_note=? WHERE id=? AND is_deleted=0",
            (text, pid),
        )
    flash("Saved.", "ok")
    return redirect(request.referrer or url_for("index"))


@app.post("/project/<int:pid>/link")
def project_link(pid: int):
    name = (request.form.get("link_name") or "").strip()
    url = (request.form.get("link_url") or "").strip()

    # allow clearing link easily
    if not url:
        name = ""
        url = ""
    else:
        # soft-normalize URL
        if not (url.startswith("http://") or url.startswith("https://")):
            url = "https://" + url

    with db() as con:
        con.execute(
            "UPDATE projects SET link_name=?, link_url=? WHERE id=? AND is_deleted=0",
            (name, url, pid),
        )

    flash("Saved.", "ok")
    return redirect(request.referrer or url_for("index"))


@app.get("/note/<int:pid>/<day>")
def note(pid: int, day: str):
    # Validate day
    try:
        dt.date.fromisoformat(day)
    except Exception:
        return redirect(url_for("index"))
    with db() as con:
        proj = con.execute(
            "SELECT id, name FROM projects WHERE id=? AND is_deleted=0", (pid,)
        ).fetchone()
        if not proj:
            return redirect(url_for("index"))

        items = con.execute(
            """
            SELECT id, text, start_time, end_time
            FROM note_items
            WHERE project_id=? AND day=?
            ORDER BY
              CASE WHEN start_time IS NULL OR TRIM(start_time)='' THEN 1 ELSE 0 END ASC,
              start_time ASC,
              CASE WHEN end_time IS NULL OR TRIM(end_time)='' THEN 1 ELSE 0 END ASC,
              end_time ASC,
              sort_index ASC,
              id ASC
            """,
            (pid, day),
        ).fetchall()

    # Google Calendar events for this day (stored in DB)
    gcal_events = gcal_load_day(session["user_key"], day)

    return render_template(
        "note.html",
        project=proj,
        day=day,
        items=[
            {
                "id": int(r["id"]),
                "text": r["text"],
                "start_time": r["start_time"],
                "end_time": r["end_time"],
                "label": _note_item_label(r["start_time"], r["end_time"], r["text"]),
            }
            for r in items
        ],
        gcal_events=gcal_events,
        theme=get_theme(),
    )


@app.post("/note/<int:pid>/<day>")
def note_save(pid: int, day: str):
    action = (request.form.get("action") or "").lower()

    if action == "clear":
        delete_note_items_day(pid, day)
        # also clear legacy notes row (optional)
        with db() as con:
            con.execute("DELETE FROM notes WHERE project_id=? AND day=?", (pid, day))
        return redirect(url_for("note", pid=pid, day=day))

    return redirect(url_for("note", pid=pid, day=day))


@app.post("/note/<int:pid>/<day>/add")
def note_add_item(pid: int, day: str):
    try:
        dt.date.fromisoformat(day)
    except Exception:
        return redirect(url_for("index"))

    text = (request.form.get("text") or "").strip()
    start_time = request.form.get("start_time")
    end_time = request.form.get("end_time")

    if text:
        add_note_item(pid, day, text, start_time=start_time, end_time=end_time)
    return redirect(url_for("note", pid=pid, day=day))


@app.post("/note/<int:pid>/<day>/edit/<int:item_id>")
def note_edit_item(pid: int, day: str, item_id: int):
    try:
        dt.date.fromisoformat(day)
    except Exception:
        return redirect(url_for("index"))

    text = (request.form.get("text") or "").strip()
    start_time = request.form.get("start_time")
    end_time = request.form.get("end_time")

    edit_note_item(pid, item_id, text, start_time=start_time, end_time=end_time)
    return redirect(url_for("note", pid=pid, day=day))


@app.post("/note/<int:pid>/<day>/delete/<int:item_id>")
def note_delete_item(pid: int, day: str, item_id: int):
    try:
        dt.date.fromisoformat(day)
    except Exception:
        return redirect(url_for("index"))

    delete_note_item(pid, item_id)
    return redirect(url_for("note", pid=pid, day=day))


# ---------- Google Calendar connect/disconnect ----------
@app.post("/gcal/toggle")
def gcal_toggle():
    user_key = session["user_key"]
    if token_get(user_key):
        token_delete(user_key)
        gcal_clear_user(user_key)
        flash("Google Calendar disconnected.", "ok")
        return redirect(url_for("index"))

    if not google_client_config_ok():
        flash("Missing Google OAuth client_secret.json. See README.", "error")
        return redirect(url_for("index"))

    # Allow OAuth over HTTP only for local development (localhost/127.0.0.1)
    if request.host.startswith(("127.0.0.1", "localhost")):
        os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")

    redirect_uri = url_for("gcal_callback", _external=True)
    flow = build_flow(redirect_uri)

    auth_url, state = flow.authorization_url(
        access_type="offline", include_granted_scopes="true", prompt="consent"
    )
    session["gcal_state"] = state
    return redirect(auth_url)


@app.get("/gcal/oauth2callback")
def gcal_callback():
    if not google_client_config_ok():
        flash("Missing Google OAuth client_secret.json. See README.", "error")
        return redirect(url_for("index"))

    state = session.get("gcal_state")

    # Allow OAuth over HTTP only for local development (localhost/127.0.0.1)
    if request.host.startswith(("127.0.0.1", "localhost")):
        os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")

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
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)), debug=True)
