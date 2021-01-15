import os

DATABASE_PATH = os.getenv(
    "LIVEDOC_DB_PATH",
    os.path.join(os.path.dirname(__file__), "data", "livedoc.db"),
)

_raw_origins = os.getenv("LIVEDOC_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
CORS_ORIGINS = [o.strip() for o in _raw_origins.split(",")] if _raw_origins != "*" else ["*"]

ENV = os.getenv("LIVEDOC_ENV", "development")
