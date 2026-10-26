from fastapi import FastAPI, APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Literal
from pathlib import Path
from datetime import datetime, timezone, timedelta, date, time
from zoneinfo import ZoneInfo
import os
import re
import json
import uuid
import asyncio
import logging
import secrets

import bcrypt
import jwt
import httpx
import icalendar
import recurring_ical_events

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]
JWT_SECRET = os.environ['JWT_SECRET']
LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()


@app.get("/health", include_in_schema=False)
@app.head("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}


api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)
HM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
DAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]


# ---------- helpers ----------
def now_utc():
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat(timespec="seconds")


def parse_iso(s: str) -> datetime:
    return datetime.fromisoformat(s)


def hm(s: str) -> int:
    h, m = s.split(":")
    return int(h) * 60 + int(m)


def fmt_hm(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def at(d: date, minutes: int, tz) -> datetime:
    return datetime.combine(d, time(0), tzinfo=tz) + timedelta(minutes=minutes)


def get_tz(settings) -> ZoneInfo:
    try:
        return ZoneInfo(settings.get("tz") or "Europe/Madrid")
    except Exception:
        return ZoneInfo("Europe/Madrid")


def week_monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


def check_hm(v: str) -> str:
    if not HM.match(v):
        raise ValueError("Formato de hora HH:MM")
    return v


def clean(doc):
    doc.pop("_id", None)
    doc.pop("user_id", None)
    return doc


# ---------- models ----------
class Credentials(BaseModel):
    email: str
    password: str = Field(min_length=6, max_length=72)
    name: Optional[str] = None

    @field_validator("email")
    @classmethod
    def v_email(cls, v):
        v = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError("Email no válido")
        return v


class Window(BaseModel):
    start: str
    end: str

    @field_validator("start", "end")
    @classmethod
    def v_hm(cls, v):
        return check_hm(v)


class RoutineIn(BaseModel):
    title: str = Field(min_length=1, max_length=60)
    days: List[int]
    start: str
    end: str

    @field_validator("start", "end")
    @classmethod
    def v_hm(cls, v):
        return check_hm(v)


class HabitIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    sessions_per_week: int = Field(ge=1, le=7)
    duration_min: int = Field(ge=5, le=600)
    travel_before_min: int = Field(default=0, ge=0, le=240)
    travel_after_min: int = Field(default=0, ge=0, le=240)
    forbidden_windows: List[Window] = []
    forbidden_days: List[int] = []
    preferred: Literal["any", "morning", "afternoon", "evening"] = "any"
    priority: Optional[int] = None


class SettingsIn(BaseModel):
    wake: Optional[str] = None
    sleep: Optional[str] = None
    buffer_min: Optional[int] = Field(default=None, ge=0, le=120)
    tz: Optional[str] = None

    @field_validator("wake", "sleep")
    @classmethod
    def v_hm(cls, v):
        return v if v is None else check_hm(v)


class FeedIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    url: str = Field(min_length=8, max_length=2000)


class ReorderIn(BaseModel):
    ids: List[str]


# ---------- auth ----------
def hash_pw(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt(rounds=12)).decode()


def check_pw(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except (ValueError, TypeError):
        return False


DUMMY_HASH = hash_pw("dummy-password-x")


def make_token(uid: str) -> str:
    now = now_utc()
    return jwt.encode({"sub": uid, "iat": now, "exp": now + timedelta(days=30)}, JWT_SECRET, algorithm="HS256")


async def current_user(cred: HTTPAuthorizationCredentials = Depends(bearer)):
    if not cred:
        raise HTTPException(401, "No autenticado")
    try:
        claims = jwt.decode(cred.credentials, JWT_SECRET, algorithms=["HS256"], options={"require": ["exp", "sub"]})
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Sesión caducada")
    user = await db.users.find_one({"id": claims["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "Usuario no encontrado")
    return user


async def seed_examples(uid: str):
    await db.routines.insert_many([
        {"id": str(uuid.uuid4()), "user_id": uid, "title": "Trabajo", "days": [0, 1, 2, 3, 4], "start": "09:00", "end": "15:00"},
        {"id": str(uuid.uuid4()), "user_id": uid, "title": "Clase de inglés", "days": [1, 3], "start": "20:00", "end": "21:30"},
    ])
    await db.habits.insert_one({
        "id": str(uuid.uuid4()), "user_id": uid, "name": "Gimnasio", "sessions_per_week": 3, "duration_min": 90,
        "travel_before_min": 15, "travel_after_min": 15, "forbidden_windows": [{"start": "16:30", "end": "19:30"}],
        "forbidden_days": [5, 6], "preferred": "any", "priority": 1, "created_at": iso(now_utc()),
    })


async def create_user(email, password, name):
    uid = str(uuid.uuid4())
    await db.users.insert_one({"id": uid, "email": email, "name": name or email.split("@")[0],
                               "password_hash": hash_pw(password), "created_at": iso(now_utc())})
    await db.settings.insert_one({"user_id": uid, "wake": "07:00", "sleep": "23:00", "buffer_min": 10,
                                  "tz": "Europe/Madrid", "ical_feeds": [], "feed_token": secrets.token_urlsafe(24)})
    await seed_examples(uid)
    return uid


@api.post("/auth/register")
async def register(body: Credentials):
    if await db.users.find_one({"email": body.email}):
        raise HTTPException(409, "Ese email ya está registrado")
    uid = await create_user(body.email, body.password, body.name)
    return {"token": make_token(uid), "user": {"id": uid, "email": body.email, "name": body.name or body.email.split("@")[0]}}


@api.post("/auth/login")
async def login(body: Credentials):
    user = await db.users.find_one({"email": body.email})
    ok = check_pw(body.password, user["password_hash"] if user else DUMMY_HASH)
    if not user or not ok:
        raise HTTPException(401, "Email o contraseña incorrectos")
    return {"token": make_token(user["id"]), "user": {"id": user["id"], "email": user["email"], "name": user.get("name")}}


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return user


# ---------- settings ----------
async def get_settings(uid: str):
    s = await db.settings.find_one({"user_id": uid}, {"_id": 0})
    if not s:
        s = {"user_id": uid, "wake": "07:00", "sleep": "23:00", "buffer_min": 10, "tz": "Europe/Madrid",
             "ical_feeds": [], "feed_token": secrets.token_urlsafe(24)}
        await db.settings.insert_one(dict(s))
    return s


@api.get("/settings")
async def read_settings(user=Depends(current_user)):
    return clean(await get_settings(user["id"]))


@api.put("/settings")
async def update_settings(body: SettingsIn, user=Depends(current_user)):
    s = await get_settings(user["id"])
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if "tz" in upd:
        try:
            ZoneInfo(upd["tz"])
        except Exception:
            upd.pop("tz")
    wake, sleep = upd.get("wake", s["wake"]), upd.get("sleep", s["sleep"])
    if hm(sleep) <= hm(wake):
        raise HTTPException(400, "La hora de dormir debe ser posterior a la de despertar")
    await db.settings.update_one({"user_id": user["id"]}, {"$set": upd})
    return clean(await get_settings(user["id"]))


@api.post("/settings/feed-token")
async def regenerate_feed(user=Depends(current_user)):
    await db.settings.update_one({"user_id": user["id"]}, {"$set": {"feed_token": secrets.token_urlsafe(24)}})
    return clean(await get_settings(user["id"]))


# ---------- routines ----------
def validate_routine(body: RoutineIn):
    if hm(body.end) <= hm(body.start):
        raise HTTPException(400, "La hora de fin debe ser posterior al inicio")
    if not body.days or any(d < 0 or d > 6 for d in body.days):
        raise HTTPException(400, "Elige al menos un día")


@api.get("/routines")
async def list_routines(user=Depends(current_user)):
    return await db.routines.find({"user_id": user["id"]}, {"_id": 0, "user_id": 0}).sort("start", 1).to_list(200)


@api.post("/routines")
async def create_routine(body: RoutineIn, user=Depends(current_user)):
    validate_routine(body)
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **body.model_dump(), "days": sorted(set(body.days))}
    await db.routines.insert_one(dict(doc))
    return clean(doc)


@api.put("/routines/{rid}")
async def update_routine(rid: str, body: RoutineIn, user=Depends(current_user)):
    validate_routine(body)
    res = await db.routines.update_one({"id": rid, "user_id": user["id"]},
                                       {"$set": {**body.model_dump(), "days": sorted(set(body.days))}})
    if not res.matched_count:
        raise HTTPException(404, "Rutina no encontrada")
    return await db.routines.find_one({"id": rid}, {"_id": 0, "user_id": 0})


@api.delete("/routines/{rid}")
async def delete_routine(rid: str, user=Depends(current_user)):
    await db.routines.delete_one({"id": rid, "user_id": user["id"]})
    return {"ok": True}


# ---------- habits ----------
def validate_habit(body: HabitIn):
    for w in body.forbidden_windows:
        if hm(w.end) <= hm(w.start):
            raise HTTPException(400, "Franja prohibida no válida")
    if len(set(body.forbidden_days)) + body.sessions_per_week > 7:
        raise HTTPException(400, "Hay más sesiones que días disponibles")


@api.get("/habits")
async def list_habits(user=Depends(current_user)):
    return await db.habits.find({"user_id": user["id"]}, {"_id": 0, "user_id": 0}).sort("priority", 1).to_list(200)


@api.get("/habits/{hid}")
async def get_habit(hid: str, user=Depends(current_user)):
    h = await db.habits.find_one({"id": hid, "user_id": user["id"]}, {"_id": 0, "user_id": 0})
    if not h:
        raise HTTPException(404, "Hábito no encontrado")
    return h


@api.post("/habits")
async def create_habit(body: HabitIn, user=Depends(current_user)):
    validate_habit(body)
    count = await db.habits.count_documents({"user_id": user["id"]})
    data = body.model_dump()
    data["priority"] = count + 1
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **data, "created_at": iso(now_utc())}
    await db.habits.insert_one(dict(doc))
    return clean(doc)


@api.put("/habits/{hid}")
async def update_habit(hid: str, body: HabitIn, user=Depends(current_user)):
    validate_habit(body)
    data = body.model_dump()
    data.pop("priority")
    res = await db.habits.update_one({"id": hid, "user_id": user["id"]}, {"$set": data})
    if not res.matched_count:
        raise HTTPException(404, "Hábito no encontrado")
    await db.sessions.update_many({"habit_id": hid, "user_id": user["id"]}, {"$set": {"habit_name": body.name}})
    return await db.habits.find_one({"id": hid}, {"_id": 0, "user_id": 0})


@api.post("/habits/reorder")
async def reorder_habits(body: ReorderIn, user=Depends(current_user)):
    for i, hid in enumerate(body.ids):
        await db.habits.update_one({"id": hid, "user_id": user["id"]}, {"$set": {"priority": i + 1}})
    return await list_habits(user)


@api.delete("/habits/{hid}")
async def delete_habit(hid: str, user=Depends(current_user)):
    await db.habits.delete_one({"id": hid, "user_id": user["id"]})
    await db.sessions.delete_many({"habit_id": hid, "user_id": user["id"], "status": "planned"})
    return {"ok": True}


# ---------- external calendars (iCal) ----------
async def sync_feed(uid: str, feed: dict, tz) -> dict:
    url = feed["url"].strip()
    if url.startswith("webcal://"):
        url = "https://" + url[len("webcal://"):]
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as c:
            r = await c.get(url)
            r.raise_for_status()
        cal = icalendar.Calendar.from_ical(r.content)
        start = now_utc() - timedelta(days=14)
        end = now_utc() + timedelta(days=35)
        events = []
        for ev in recurring_ical_events.of(cal).between(start, end):
            ds, de = ev.get("DTSTART"), ev.get("DTEND")
            if not ds or not isinstance(ds.dt, datetime):
                continue
            s = ds.dt if ds.dt.tzinfo else ds.dt.replace(tzinfo=tz)
            if de and isinstance(de.dt, datetime):
                e = de.dt if de.dt.tzinfo else de.dt.replace(tzinfo=tz)
            else:
                e = s + timedelta(hours=1)
            events.append({"id": str(uuid.uuid4()), "user_id": uid, "feed_id": feed["id"],
                           "title": str(ev.get("SUMMARY") or "Evento"), "start": iso(s), "end": iso(e)})
        await db.external_events.delete_many({"user_id": uid, "feed_id": feed["id"]})
        if events:
            await db.external_events.insert_many(events)
        feed.update({"last_sync": iso(now_utc()), "count": len(events), "error": None})
    except Exception as ex:
        logger.warning("iCal sync failed: %s", ex)
        feed.update({"last_sync": iso(now_utc()), "error": "No se pudo leer el calendario. Revisa el enlace."})
    return feed


async def sync_all(uid: str, settings: dict):
    tz = get_tz(settings)
    feeds = [await sync_feed(uid, f, tz) for f in settings.get("ical_feeds", [])]
    await db.settings.update_one({"user_id": uid}, {"$set": {"ical_feeds": feeds}})
    return feeds


@api.post("/calendar/feeds")
async def add_feed(body: FeedIn, user=Depends(current_user)):
    s = await get_settings(user["id"])
    url = body.url.strip()
    if not re.match(r"^(https?|webcal)://", url, re.I):
        raise HTTPException(400, "El enlace debe empezar por https:// o webcal://")
    feed = await sync_feed(user["id"], {"id": str(uuid.uuid4()), "name": body.name, "url": url}, get_tz(s))
    await db.settings.update_one({"user_id": user["id"]}, {"$push": {"ical_feeds": feed}})
    return feed


@api.delete("/calendar/feeds/{fid}")
async def delete_feed(fid: str, user=Depends(current_user)):
    await db.settings.update_one({"user_id": user["id"]}, {"$pull": {"ical_feeds": {"id": fid}}})
    await db.external_events.delete_many({"user_id": user["id"], "feed_id": fid})
    return {"ok": True}


@api.post("/calendar/sync")
async def sync_calendars(user=Depends(current_user)):
    return await sync_all(user["id"], await get_settings(user["id"]))


# ---------- scheduling engine ----------
async def build_busy(uid, tz, start: datetime, end: datetime, routines, skip_planned_after: Optional[datetime] = None):
    busy = []
    d = start.astimezone(tz).date()
    while at(d, 0, tz) < end:
        for r in routines:
            if d.weekday() in r["days"]:
                busy.append((at(d, hm(r["start"]), tz), at(d, hm(r["end"]), tz)))
        d += timedelta(days=1)
    async for e in db.external_events.find({"user_id": uid, "start": {"$lt": iso(end)}, "end": {"$gt": iso(start)}}):
        busy.append((parse_iso(e["start"]), parse_iso(e["end"])))
    async for s in db.sessions.find({"user_id": uid, "status": {"$in": ["planned", "done"]},
                                     "start": {"$lt": iso(end + timedelta(hours=6))}, "end": {"$gt": iso(start - timedelta(hours=6))}}):
        if skip_planned_after and s["status"] == "planned" and s["start"] >= iso(skip_planned_after):
            continue
        busy.append((parse_iso(s["start"]) - timedelta(minutes=s.get("travel_before", 0)),
                     parse_iso(s["end"]) + timedelta(minutes=s.get("travel_after", 0))))
    return busy


def period_of(m: int) -> str:
    return "morning" if m < 12 * 60 else ("afternoon" if m < 18 * 60 else "evening")


def is_free(bs, be, busy, buf):
    pad = timedelta(minutes=buf)
    return not any(bs < b1 + pad and be > b0 - pad for b0, b1 in busy)


def day_candidates(h, d, tz, settings, busy, earliest: datetime):
    if d.weekday() in h.get("forbidden_days", []):
        return []
    wake, sleep, buf = hm(settings["wake"]), hm(settings["sleep"]), settings.get("buffer_min", 10)
    tb, ta, dur = h.get("travel_before_min", 0), h.get("travel_after_min", 0), h["duration_min"]
    windows = [(hm(w["start"]), hm(w["end"])) for w in h.get("forbidden_windows", [])]
    out = []
    first = wake + tb
    first += (-first) % 15
    for s in range(first, sleep - dur - ta + 1, 15):
        bs, be = s - tb, s + dur + ta
        if any(bs < w1 and be > w0 for w0, w1 in windows):
            continue
        start_dt, end_dt = at(d, bs, tz), at(d, be, tz)
        if start_dt < earliest or not is_free(start_dt, end_dt, busy, buf):
            continue
        score = 0.3 if s % 60 == 0 else 0.0
        pref = h.get("preferred", "any")
        if pref != "any":
            score += 2.0 if period_of(s) == pref else -1.0
        out.append({"day": d, "minute": s, "start": at(d, s, tz), "end": at(d, s + dur, tz),
                    "bs": start_dt, "be": end_dt, "score": score})
    return out


def top_options(cands):
    best = {}
    for c in cands:
        p = period_of(c["minute"])
        if p not in best or c["score"] > best[p]["score"]:
            best[p] = c
    return sorted(best.values(), key=lambda c: c["minute"])


def spread_bonus(d: date, used: List[date]) -> float:
    if not used:
        return 3.0 - 0.05 * d.weekday()
    return min(3, min(abs((d - u).days) for u in used))


def explain(h, c, settings):
    parts = [f"{DAY_NAMES[c['day'].weekday()].capitalize()} a las {fmt_hm(c['minute'])}: hueco libre"]
    tb, ta = h.get("travel_before_min", 0), h.get("travel_after_min", 0)
    if tb or ta:
        parts.append(f"con {tb} min de ida y {ta} min de vuelta incluidos")
    if h.get("forbidden_windows"):
        parts.append("fuera de " + ", ".join(f"{w['start']}–{w['end']}" for w in h["forbidden_windows"]))
    if h.get("forbidden_days"):
        parts.append("sin tocar tus días de descanso")
    return ", ".join(parts) + "."


def greedy_fill(h, need, days, tz, settings, busy, used_days, earliest):
    chosen = []
    for _ in range(need):
        best, best_score = None, -1e9
        for d in days:
            if d in used_days:
                continue
            for c in day_candidates(h, d, tz, settings, busy, earliest):
                sc = c["score"] + spread_bonus(d, used_days) - c["minute"] / 10000
                if sc > best_score:
                    best, best_score = c, sc
        if not best:
            break
        chosen.append(best)
        used_days.append(best["day"])
        busy.append((best["bs"], best["be"]))
    return chosen


async def ask_ai(habit_payload, routines, settings):
    if not LLM_KEY:
        return None
    from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
    system = ("Eres un planificador experto en hábitos. Eliges los mejores huecos para que la persona cumpla "
              "las tareas que suele aplazar. Reparte las sesiones a lo largo de la semana (evita días seguidos si se puede), "
              "respeta las preferencias, no solapes opciones de distintos hábitos el mismo día a la misma hora y da prioridad "
              "a los hábitos de prioridad 1. Responde SOLO con JSON válido.")
    prompt = json.dumps({
        "ajustes": {"despertar": settings["wake"], "dormir": settings["sleep"]},
        "rutinas_fijas": [{"titulo": r["title"], "dias": [DAY_NAMES[d] for d in r["days"]], "de": r["start"], "a": r["end"]} for r in routines],
        "habitos": habit_payload,
        "formato_respuesta": {"elecciones": [{"habit_id": "...", "option_id": "...", "motivo": "frase corta en español, tono motivador, explicando por qué ese hueco"}],
                               "resumen": "1-2 frases motivadoras en español sobre el plan de la semana"},
    }, ensure_ascii=False)
    chat = LlmChat(api_key=LLM_KEY, session_id=f"plan-{uuid.uuid4()}", system_message=system).with_model("anthropic", "claude-sonnet-5-5")
    text = ""

    async def run():
        nonlocal text
        async for ev in chat.stream_message(UserMessage(text=prompt)):
            if isinstance(ev, TextDelta):
                text += ev.content
            elif isinstance(ev, StreamDone):
                break
    try:
        await asyncio.wait_for(run(), timeout=60)
        m = re.search(r"\{.*\}", text, re.S)
        return json.loads(m.group(0)) if m else None
    except Exception as ex:
        logger.warning("AI planning failed, using algorithm: %s", ex)
        return None


def session_doc(uid, h, c, reason, monday):
    return {"id": str(uuid.uuid4()), "user_id": uid, "habit_id": h["id"], "habit_name": h["name"],
            "start": iso(c["start"]), "end": iso(c["end"]), "travel_before": h.get("travel_before_min", 0),
            "travel_after": h.get("travel_after_min", 0), "status": "planned", "reason": reason,
            "week_start": monday.isoformat(), "created_at": iso(now_utc())}


@api.post("/plan")
async def plan_week(user=Depends(current_user)):
    uid = user["id"]
    settings = await get_settings(uid)
    if settings.get("ical_feeds"):
        await sync_all(uid, settings)
    tz = get_tz(settings)
    now = now_utc()
    earliest = now + timedelta(minutes=15)
    today = now.astimezone(tz).date()
    monday = week_monday(today)
    days = [monday + timedelta(days=i) for i in range(7) if monday + timedelta(days=i) >= today]
    week_end = at(monday + timedelta(days=7), 0, tz)
    await db.sessions.delete_many({"user_id": uid, "status": "planned", "start": {"$gte": iso(earliest)}, "week_start": monday.isoformat()})

    habits = await db.habits.find({"user_id": uid}, {"_id": 0}).sort("priority", 1).to_list(100)
    routines = await db.routines.find({"user_id": uid}, {"_id": 0}).to_list(200)
    if not habits:
        raise HTTPException(400, "Añade al menos un hábito para planificar")
    busy = await build_busy(uid, tz, at(monday, 0, tz), week_end, routines)

    state, payload = {}, []
    for h in habits:
        kept = await db.sessions.find({"user_id": uid, "habit_id": h["id"], "week_start": monday.isoformat(),
                                       "status": {"$in": ["done", "planned"]}}, {"_id": 0}).to_list(20)
        used = [parse_iso(s["start"]).astimezone(tz).date() for s in kept]
        need = max(0, h["sessions_per_week"] - len(kept))
        options = {}
        for d in days:
            if d in used:
                continue
            for i, c in enumerate(top_options(day_candidates(h, d, tz, settings, busy, earliest))):
                options[f"{h['id'][:6]}-{d.isoformat()}-{i}"] = c
        state[h["id"]] = {"habit": h, "need": need, "used": used, "options": options}
        if need:
            payload.append({"habit_id": h["id"], "nombre": h["name"], "prioridad": h["priority"], "sesiones_a_planificar": need,
                            "duracion_min": h["duration_min"], "ida_min": h.get("travel_before_min", 0), "vuelta_min": h.get("travel_after_min", 0),
                            "preferencia": h.get("preferred", "any"),
                            "opciones": [{"option_id": k, "dia": DAY_NAMES[c["day"].weekday()], "fecha": c["day"].isoformat(),
                                          "inicio": fmt_hm(c["minute"]), "fin": fmt_hm(c["minute"] + h["duration_min"])} for k, c in options.items()]})

    ai = await ask_ai(payload, routines, settings) if payload else None
    picks = {}
    for e in (ai or {}).get("elecciones", []) if isinstance(ai, dict) else []:
        if isinstance(e, dict) and e.get("habit_id") in state:
            picks.setdefault(e["habit_id"], []).append(e)

    new_sessions, unplaced = [], []
    buf = settings.get("buffer_min", 10)
    for h in habits:
        st = state[h["id"]]
        placed = 0
        for e in picks.get(h["id"], []):
            c = st["options"].get(e.get("option_id"))
            if placed >= st["need"] or not c or c["day"] in st["used"] or not is_free(c["bs"], c["be"], busy, buf):
                continue
            new_sessions.append(session_doc(uid, h, c, str(e.get("motivo") or explain(h, c, settings))[:300], monday))
            busy.append((c["bs"], c["be"]))
            st["used"].append(c["day"])
            placed += 1
        for c in greedy_fill(h, st["need"] - placed, days, tz, settings, busy, st["used"], earliest):
            new_sessions.append(session_doc(uid, h, c, explain(h, c, settings), monday))
            placed += 1
        if placed < st["need"]:
            unplaced.append({"habit": h["name"], "missing": st["need"] - placed})

    if new_sessions:
        await db.sessions.insert_many([dict(s) for s in new_sessions])
    summary = ai.get("resumen") if isinstance(ai, dict) and ai.get("resumen") else (
        f"He colocado {len(new_sessions)} sesiones en tus huecos libres de esta semana." if new_sessions else "No he encontrado huecos nuevos esta semana.")
    return {"sessions": [clean(s) for s in sorted(new_sessions, key=lambda s: s["start"])],
            "summary": summary, "used_ai": bool(picks), "unplaced": unplaced}


# ---------- sessions ----------
@api.post("/sessions/{sid}/done")
async def mark_done(sid: str, user=Depends(current_user)):
    res = await db.sessions.update_one({"id": sid, "user_id": user["id"]}, {"$set": {"status": "done", "done_at": iso(now_utc())}})
    if not res.matched_count:
        raise HTTPException(404, "Sesión no encontrada")
    return await db.sessions.find_one({"id": sid}, {"_id": 0, "user_id": 0})


@api.post("/sessions/{sid}/undo")
async def undo_session(sid: str, user=Depends(current_user)):
    res = await db.sessions.update_one({"id": sid, "user_id": user["id"], "status": "done"}, {"$set": {"status": "planned", "done_at": None}})
    if not res.matched_count:
        raise HTTPException(404, "Sesión no encontrada")
    return await db.sessions.find_one({"id": sid}, {"_id": 0, "user_id": 0})


@api.post("/sessions/{sid}/postpone")
async def postpone(sid: str, user=Depends(current_user)):
    uid = user["id"]
    s = await db.sessions.find_one({"id": sid, "user_id": uid}, {"_id": 0})
    if not s or s["status"] != "planned":
        raise HTTPException(404, "Sesión no encontrada")
    h = await db.habits.find_one({"id": s["habit_id"], "user_id": uid}, {"_id": 0})
    await db.sessions.update_one({"id": sid}, {"$set": {"status": "postponed", "postponed_at": iso(now_utc())}})
    if not h:
        return {"postponed": clean(s), "new_session": None, "message": "Sesión aplazada."}
    settings = await get_settings(uid)
    tz = get_tz(settings)
    now = now_utc()
    today = now.astimezone(tz).date()
    monday = date.fromisoformat(s["week_start"])
    days = [monday + timedelta(days=i) for i in range(7) if monday + timedelta(days=i) >= today]
    routines = await db.routines.find({"user_id": uid}, {"_id": 0}).to_list(200)
    busy = await build_busy(uid, tz, at(monday, 0, tz), at(monday + timedelta(days=7), 0, tz), routines)
    others = await db.sessions.find({"user_id": uid, "habit_id": h["id"], "week_start": s["week_start"],
                                     "status": {"$in": ["done", "planned"]}}, {"_id": 0}).to_list(20)
    used = [parse_iso(o["start"]).astimezone(tz).date() for o in others]
    old_day = parse_iso(s["start"]).astimezone(tz).date()
    earliest = max(now + timedelta(minutes=15), parse_iso(s["end"]))
    chosen = greedy_fill(h, 1, days, tz, settings, busy, list(used), earliest)
    if not chosen:
        chosen = greedy_fill(h, 1, days, tz, settings, busy, [], earliest)
    if not chosen:
        return {"postponed": clean(s), "new_session": None,
                "message": "No queda ningún hueco válido esta semana. Lo intentaremos la próxima."}
    c = chosen[0]
    reason = explain(h, c, settings).replace("hueco libre", "nuevo hueco tras aplazar" if c["day"] != old_day else "más tarde hoy")
    doc = session_doc(uid, h, c, reason, monday)
    doc["replanned_from"] = sid
    await db.sessions.insert_one(dict(doc))
    return {"postponed": clean(s), "new_session": clean(doc),
            "message": f"Replanificado al {DAY_NAMES[c['day'].weekday()]} a las {fmt_hm(c['minute'])}."}


# ---------- agenda ----------
@api.get("/agenda")
async def agenda(start: Optional[str] = None, days: int = Query(1, ge=1, le=14), user=Depends(current_user)):
    uid = user["id"]
    settings = await get_settings(uid)
    tz = get_tz(settings)
    d0 = date.fromisoformat(start) if start else now_utc().astimezone(tz).date()
    t0, t1 = at(d0, 0, tz), at(d0 + timedelta(days=days), 0, tz)
    routines = await db.routines.find({"user_id": uid}, {"_id": 0}).to_list(200)
    items = []
    for i in range(days):
        d = d0 + timedelta(days=i)
        for r in routines:
            if d.weekday() in r["days"]:
                items.append({"type": "routine", "id": f"{r['id']}-{d}", "routine_id": r["id"], "title": r["title"],
                              "start": iso(at(d, hm(r["start"]), tz)), "end": iso(at(d, hm(r["end"]), tz))})
    async for e in db.external_events.find({"user_id": uid, "start": {"$lt": iso(t1)}, "end": {"$gt": iso(t0)}}, {"_id": 0, "user_id": 0}):
        items.append({"type": "event", **e})
    async for s in db.sessions.find({"user_id": uid, "status": {"$in": ["planned", "done"]}, "start": {"$lt": iso(t1), "$gte": iso(t0)}}, {"_id": 0, "user_id": 0}):
        items.append({"type": "session", "title": s["habit_name"], **s})
    items.sort(key=lambda x: x["start"])
    return {"tz": settings["tz"], "items": items}


# ---------- progress ----------
@api.get("/progress")
async def progress(user=Depends(current_user)):
    uid = user["id"]
    settings = await get_settings(uid)
    tz = get_tz(settings)
    now = now_utc()
    today = now.astimezone(tz).date()
    monday = week_monday(today)
    habits = await db.habits.find({"user_id": uid}, {"_id": 0}).sort("priority", 1).to_list(100)
    sessions = await db.sessions.find({"user_id": uid}, {"_id": 0}).to_list(5000)
    done = [s for s in sessions if s["status"] == "done"]
    done_by_hw = {}
    for s in done:
        done_by_hw[(s["habit_id"], s["week_start"])] = done_by_hw.get((s["habit_id"], s["week_start"]), 0) + 1

    per_habit = []
    for h in habits:
        created = week_monday(parse_iso(h["created_at"]).astimezone(tz).date()) if h.get("created_at") else monday
        target = h["sessions_per_week"]
        this_week = done_by_hw.get((h["id"], monday.isoformat()), 0)
        streak, w = 0, monday - timedelta(days=7)
        while w >= created and done_by_hw.get((h["id"], w.isoformat()), 0) >= target:
            streak += 1
            w -= timedelta(days=7)
        if this_week >= target:
            streak += 1
        planned_week = len([s for s in sessions if s["habit_id"] == h["id"] and s["week_start"] == monday.isoformat() and s["status"] == "planned"])
        per_habit.append({"id": h["id"], "name": h["name"], "target": target, "done": this_week,
                          "planned": planned_week, "streak_weeks": streak})

    total_target = sum(h["sessions_per_week"] for h in habits)
    week_done = sum(p["done"] for p in per_habit)
    days_done = {parse_iso(s["start"]).astimezone(tz).date() for s in done}
    day_streak, d = 0, today if today in days_done else today - timedelta(days=1)
    while d in days_done:
        day_streak += 1
        d -= timedelta(days=1)

    history = []
    for i in range(3, -1, -1):
        w = monday - timedelta(days=7 * i)
        wd = sum(done_by_hw.get((h["id"], w.isoformat()), 0) for h in habits)
        history.append({"week_start": w.isoformat(), "done": wd, "target": total_target,
                        "pct": round(100 * min(wd, total_target) / total_target) if total_target else 0})

    postponed = len([s for s in sessions if s["status"] == "postponed"])
    missed = len([s for s in sessions if s["status"] == "planned" and s["end"] < iso(now)])
    beat = len([s for s in done if s.get("replanned_from")])
    best_streak = max([p["streak_weeks"] for p in per_habit], default=0)
    badges = [
        {"id": "first", "title": "Primer paso", "desc": "Completa tu primera sesión", "unlocked": len(done) >= 1},
        {"id": "beat", "title": "Vencedor del aplazamiento", "desc": "Cumple una sesión que habías aplazado", "unlocked": beat >= 1},
        {"id": "round", "title": "Semana redonda", "desc": "Cumple el 100% de una semana", "unlocked": any(hh["pct"] >= 100 for hh in history)},
        {"id": "streak3", "title": "Hábito en marcha", "desc": "3 semanas seguidas cumpliendo un hábito", "unlocked": best_streak >= 3},
        {"id": "ten", "title": "Diez de diez", "desc": "Completa 10 sesiones", "unlocked": len(done) >= 10},
    ]
    return {"week_start": monday.isoformat(), "week_done": week_done, "week_target": total_target,
            "week_pct": round(100 * min(week_done, total_target) / total_target) if total_target else 0,
            "day_streak": day_streak, "habits": per_habit, "history": history,
            "totals": {"done": len(done), "postponed": postponed, "missed": missed}, "badges": badges}


# ---------- public iCal feed (subscribe from phone calendar) ----------
@api.get("/feed/{token}.ics")
async def ics_feed(token: str):
    s = await db.settings.find_one({"feed_token": token}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Calendario no encontrado")
    cal = icalendar.Calendar()
    cal.add("prodid", "-//Hueco//Planificador de habitos//ES")
    cal.add("version", "2.0")
    cal.add("X-WR-CALNAME", "Hueco · Hábitos")
    cal.add("REFRESH-INTERVAL;VALUE=DURATION", "PT1H")
    since = iso(now_utc() - timedelta(days=30))
    async for x in db.sessions.find({"user_id": s["user_id"], "status": {"$in": ["planned", "done"]}, "start": {"$gte": since}}):
        ev = icalendar.Event()
        ev.add("uid", f"{x['id']}@hueco")
        ev.add("summary", ("✓ " if x["status"] == "done" else "") + x["habit_name"])
        ev.add("dtstart", parse_iso(x["start"]) - timedelta(minutes=x.get("travel_before", 0)))
        ev.add("dtend", parse_iso(x["end"]) + timedelta(minutes=x.get("travel_after", 0)))
        ev.add("dtstamp", now_utc())
        desc = x.get("reason") or ""
        if x.get("travel_before") or x.get("travel_after"):
            desc += f"\nIncluye {x.get('travel_before', 0)} min de ida y {x.get('travel_after', 0)} min de vuelta."
        ev.add("description", desc.strip())
        cal.add_component(ev)
    return Response(content=cal.to_ical(), media_type="text/calendar; charset=utf-8",
                    headers={"Content-Disposition": "inline; filename=hueco.ics"})


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.sessions.create_index([("user_id", 1), ("start", 1)])
    await db.settings.create_index("feed_token")
    email, pw = os.environ.get("ADMIN_EMAIL"), os.environ.get("ADMIN_PASSWORD")
    if email and pw:
        u = await db.users.find_one({"email": email.lower()})
        if not u:
            await create_user(email.lower(), pw, "Javi")
        elif not check_pw(pw, u["password_hash"]):
            await db.users.update_one({"email": email.lower()}, {"$set": {"password_hash": hash_pw(pw)}})


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
