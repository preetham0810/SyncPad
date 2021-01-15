# SyncPad

Real-time collaborative notes. Open the same note in two tabs, type in one, see it in the other live. Each user gets a unique color and a visible cursor overlay.

**Stack:** Python · FastAPI · SQLite · React · Vite  
No Docker. No separate database server. Runs entirely on localhost.

---

## Quick start

**Terminal 1 — backend**
```bash
cd livedoc/backend
pip install -r requirements.txt
uvicorn main:app --reload
```

**Terminal 2 — frontend**
```bash
cd livedoc/frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## How to demo two clients

1. Click **New note** — you land on `/notes/<id>`.
2. Copy that URL and open it in a second tab or browser window.
3. Type in either tab. The other syncs instantly.
4. Each tab shows a colored badge with its user ID and a blinking cursor overlay for the other user.

---

## Git timeline demo (for project presentation)

Use this guide during your demo:

- Medium article: [Git Time Travel — A Guide to Manipulating Git History](https://medium.com/@souviksen093/git-time-travel-a-guide-to-manipulating-git-history-937d314d39f8)

### Quick demo flow

Run these commands from project root:

```bash
git log --oneline --graph --decorate --all
git checkout <commit_hash>
git switch -
git revert <commit_hash>
git reset --soft HEAD~1
git reset --mixed HEAD~1
git reset --hard HEAD~1
```

### What to explain while demoing

1. `git log --oneline --graph --decorate --all` shows the timeline clearly.
2. `git checkout <commit_hash>` lets you inspect old project states (detached HEAD).
3. `git switch -` returns you to your previous branch.
4. `git revert <commit_hash>` creates a new commit that safely undoes changes.
5. `git reset --soft HEAD~1` removes last commit but keeps changes staged.
6. `git reset --mixed HEAD~1` removes last commit and unstages changes (default reset mode).
7. `git reset --hard HEAD~1` removes last commit and discards local changes.

> Safety note: Prefer `revert` for shared/public branches. Use `reset --hard` only for local/demo history.

---

## Project structure

```
SyncPad/
├── backend/
│   ├── main.py          ← FastAPI app, REST + WebSocket handlers
│   ├── database.py      ← aiosqlite helpers, schema init
│   ├── models.py        ← Pydantic request/response models
│   ├── config.py        ← env-based configuration
│   ├── test_sync.py     ← in-process WS broadcast test
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Home.jsx      ← landing page
    │   │   └── NotePage.jsx  ← editor with live cursors
    │   ├── components/
    │   │   ├── UserBadge.jsx    ← colored user pill
    │   │   └── RemoteCursor.jsx ← blinking cursor overlay
    │   ├── useWebSocket.js  ← WS hook (connect, reconnect, dispatch)
    │   ├── api.js           ← REST client
    │   ├── App.jsx
    │   └── index.css
    ├── vite.config.js
    └── package.json
```

---

## Environment variables (all optional)

| Variable | Default | Description |
|---|---|---|
| `LIVEDOC_DB_PATH` | `backend/data/livedoc.db` | SQLite file path |
| `LIVEDOC_CORS_ORIGINS` | `http://localhost:5173,...` | Allowed CORS origins |
| `LIVEDOC_ENV` | `development` | Controls log verbosity |

---

## API

| Method | Path | Description |
|---|---|---|
| `POST` | `/notes` | Create a note |
| `GET` | `/notes/{id}` | Fetch a note |
| `PUT` | `/notes/{id}` | Update title / content |
| `WS` | `/ws/notes/{id}` | Real-time sync channel |
| `GET` | `/health` | Liveness check |

WebSocket message types: `init`, `content`, `cursor`, `peers`, `joined`, `left`.
