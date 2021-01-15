import json
import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from config import CORS_ORIGINS, ENV
from database import connect, get_note_content, init_db
from models import NoteCreate, NoteResponse, NoteUpdate

logging.basicConfig(level=logging.INFO if ENV == "production" else logging.DEBUG)
log = logging.getLogger("livedoc")

# active connections per note
_rooms: dict[str, set[WebSocket]] = {}

# per-connection identity  { ws -> { userId, color } }
_meta: dict[WebSocket, dict] = {}

# last known content per note — new joiners get this instead of waiting for DB
_live: dict[str, str] = {}

COLORS = ["#7dd3fc", "#a78bfa", "#34d399", "#fbbf24", "#f87171"]


def _now() -> str:
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


def _pick_color() -> str:
    used = {m["color"] for m in _meta.values()}
    return next((c for c in COLORS if c not in used), COLORS[len(_meta) % len(COLORS)])


async def _broadcast(note_id: str, msg: dict, skip: WebSocket | None = None):
    dead = []
    for ws in _rooms.get(note_id, set()):
        if ws is skip:
            continue
        try:
            await ws.send_text(json.dumps(msg))
        except Exception:
            dead.append(ws)
    for ws in dead:
        _rooms.get(note_id, set()).discard(ws)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    log.info("database ready")
    yield


app = FastAPI(title="SyncPad", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    try:
        db = await connect()
        await db.execute("SELECT 1")
        await db.close()
        return {"status": "ok"}
    except Exception:
        log.exception("health check failed")
        raise HTTPException(503, "database unavailable")


# ── notes REST ────────────────────────────────────────────────────────────────

@app.post("/notes", response_model=NoteResponse)
async def create_note(body: NoteCreate):
    note_id = str(uuid.uuid4())
    now = _now()
    title = body.title or "Untitled"
    db = await connect()
    try:
        await db.execute(
            "INSERT INTO notes (id, title, content, created_at, updated_at) VALUES (?,?,?,?,?)",
            (note_id, title, "", now, now),
        )
        await db.commit()
    finally:
        await db.close()
    return NoteResponse(id=note_id, title=title, content="", created_at=now, updated_at=now)


@app.get("/notes/{note_id}", response_model=NoteResponse)
async def get_note(note_id: str):
    db = await connect()
    try:
        cur = await db.execute(
            "SELECT id, title, content, created_at, updated_at FROM notes WHERE id = ?",
            (note_id,),
        )
        row = await cur.fetchone()
    finally:
        await db.close()
    if not row:
        raise HTTPException(404, "note not found")
    return NoteResponse(**dict(row))


@app.put("/notes/{note_id}", response_model=NoteResponse)
async def update_note(note_id: str, body: NoteUpdate):
    db = await connect()
    try:
        cur = await db.execute(
            "SELECT id, title, content, created_at, updated_at FROM notes WHERE id = ?",
            (note_id,),
        )
        row = await cur.fetchone()
        if not row:
            raise HTTPException(404, "note not found")
        title = body.title if body.title is not None else row["title"]
        content = body.content if body.content is not None else row["content"]
        now = _now()
        await db.execute(
            "UPDATE notes SET title=?, content=?, updated_at=? WHERE id=?",
            (title, content, now, note_id),
        )
        await db.commit()
        return NoteResponse(id=note_id, title=title, content=content,
                            created_at=row["created_at"], updated_at=now)
    finally:
        await db.close()


# ── websocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws/notes/{note_id}")
async def ws_note(websocket: WebSocket, note_id: str):
    await websocket.accept()

    user_id = str(uuid.uuid4())[:8]
    color = _pick_color()
    _meta[websocket] = {"userId": user_id, "color": color}

    # tell this client their identity
    await websocket.send_text(json.dumps({"type": "init", "userId": user_id, "color": color}))

    # send latest content (live cache → DB fallback)
    content = _live.get(note_id) or await get_note_content(note_id) or ""
    await websocket.send_text(json.dumps({"type": "content", "content": content}))

    # tell this client who is already in the room
    if note_id in _rooms:
        peers = [
            {"userId": _meta[ws]["userId"], "color": _meta[ws]["color"]}
            for ws in _rooms[note_id]
            if ws in _meta
        ]
        if peers:
            await websocket.send_text(json.dumps({"type": "peers", "peers": peers}))

    # add to room, then notify others
    _rooms.setdefault(note_id, set()).add(websocket)
    await _broadcast(note_id, {"type": "joined", "userId": user_id, "color": color}, skip=websocket)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                continue

            me = _meta.get(websocket, {})

            if "content" in msg:
                _live[note_id] = msg["content"]
                await _broadcast(note_id, {"type": "content", "content": msg["content"]}, skip=websocket)

            if "cursor" in msg:
                await _broadcast(note_id, {
                    "type": "cursor",
                    "userId": me.get("userId"),
                    "color": me.get("color"),
                    "offset": msg["cursor"],
                }, skip=websocket)

    except WebSocketDisconnect:
        pass
    finally:
        _rooms.get(note_id, set()).discard(websocket)
        if not _rooms.get(note_id):
            _rooms.pop(note_id, None)
            _live.pop(note_id, None)
        _meta.pop(websocket, None)
        await _broadcast(note_id, {"type": "left", "userId": user_id})


# ── static (prod build) ───────────────────────────────────────────────────────

_static = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(_static):
    app.mount("/assets", StaticFiles(directory=os.path.join(_static, "assets")), name="assets")

    @app.get("/{path:path}")
    async def spa(path: str):
        full = os.path.join(_static, path)
        return FileResponse(full if os.path.isfile(full) else os.path.join(_static, "index.html"))
