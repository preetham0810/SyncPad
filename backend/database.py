import os
import aiosqlite

from config import DATABASE_PATH as DB_PATH


def _ensure_data_dir():
    d = os.path.dirname(DB_PATH)
    if d:
        os.makedirs(d, exist_ok=True)


async def connect() -> aiosqlite.Connection:
    conn = await aiosqlite.connect(DB_PATH)
    conn.row_factory = aiosqlite.Row
    return conn


async def get_note_content(note_id: str) -> str | None:
    db = await connect()
    try:
        cur = await db.execute("SELECT content FROM notes WHERE id = ?", (note_id,))
        row = await cur.fetchone()
        return row["content"] if row else None
    finally:
        await db.close()


async def init_db():
    _ensure_data_dir()
    db = await connect()
    try:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS notes (
                id          TEXT PRIMARY KEY,
                title       TEXT NOT NULL DEFAULT '',
                content     TEXT NOT NULL DEFAULT '',
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            )
        """)
        await db.commit()
    finally:
        await db.close()
