"""
Quick in-process test to verify the WebSocket broadcast pipeline.
Runs without a live server — FastAPI TestClient handles it all.

Usage:
    cd backend
    python test_sync.py
"""
import json
from fastapi.testclient import TestClient
from main import app


def drain(ws, target_type, limit=6):
    for _ in range(limit):
        raw = ws.receive_text()
        msg = json.loads(raw)
        if msg.get("type") == target_type:
            return msg
    raise AssertionError(f"'{target_type}' not seen in {limit} messages")


def test_content_sync():
    with TestClient(app) as client:
        with client.websocket_connect("/ws/notes/test-room-1") as ws_a:
            with client.websocket_connect("/ws/notes/test-room-1") as ws_b:
                drain(ws_a, "init")
                drain(ws_a, "content")

                drain(ws_b, "init")
                drain(ws_b, "content")

                # ws_a should see a "joined" when ws_b connected
                drain(ws_a, "joined")

                ws_a.send_text(json.dumps({"content": "hello from A"}))

                msg = drain(ws_b, "content")
                assert msg["content"] == "hello from A", f"unexpected: {msg}"
                print("PASS  content sync")


if __name__ == "__main__":
    test_content_sync()
    print("All tests passed.")
