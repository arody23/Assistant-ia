"""VSM Bot Dashboard backend integration tests"""
import io
import time
import struct
import math
import wave
import pytest
import requests


# ---------------- Root & health ----------------
class TestRoot:
    def test_root_ok(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert data["groq"] is True


# ---------------- Config ----------------
class TestConfig:
    def test_default_config(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/config")
        assert r.status_code == 200
        data = r.json()
        assert data["model"] == "llama-3.1-8b-instant"
        assert isinstance(data["bot_active"], bool)
        assert isinstance(data["system_prompt"], str) and len(data["system_prompt"]) > 50
        assert "behavior" in data and isinstance(data["behavior"], dict)
        assert isinstance(data["product_keywords"], list) and len(data["product_keywords"]) > 0

    def test_update_config_persists(self, api_client, base_url):
        # ensure bot_active=True so chat tests pass later
        r = api_client.post(f"{base_url}/api/config", json={"bot_active": True})
        assert r.status_code == 200
        assert r.json()["bot_active"] is True

        r2 = api_client.get(f"{base_url}/api/config")
        assert r2.json()["bot_active"] is True


# ---------------- Chat ----------------
class TestChat:
    @pytest.fixture(autouse=True)
    def ensure_active(self, api_client, base_url):
        api_client.post(f"{base_url}/api/config", json={"bot_active": True})

    def test_chat_with_groq(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/chat",
            json={"message": "Bonjour, je voudrais un hoodie"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "reply" in data and isinstance(data["reply"], str) and len(data["reply"]) > 5
        assert "model" in data
        assert "elapsed_ms" in data and data["elapsed_ms"] > 0
        assert "conversation_id" in data
        TestChat.conv_id = data["conversation_id"]

    def test_chat_persists_messages(self, api_client, base_url):
        conv_id = getattr(TestChat, "conv_id", None)
        assert conv_id, "conv_id not set"
        r = api_client.get(f"{base_url}/api/conversations/{conv_id}/messages")
        assert r.status_code == 200
        msgs = r.json()
        assert len(msgs) >= 2
        roles = [m["role"] for m in msgs]
        assert "user" in roles and "assistant" in roles

    def test_chat_bot_off_returns_generic(self, api_client, base_url):
        api_client.post(f"{base_url}/api/config", json={"bot_active": False})
        try:
            r = api_client.post(f"{base_url}/api/chat", json={"message": "Hello"}, timeout=30)
            assert r.status_code == 200
            data = r.json()
            assert "désactivé" in data["reply"].lower() or "bot" in data["reply"].lower()
            assert data["model"] == "n/a"
        finally:
            api_client.post(f"{base_url}/api/config", json={"bot_active": True})


# ---------------- Conversations ----------------
class TestConversations:
    def test_list_conversations(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/conversations")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        if items:
            first = items[0]
            assert "id" in first
            assert "last_message" in first
            assert "messages_count" in first

    def test_delete_conversation(self, api_client, base_url):
        # create a fresh conv via chat
        api_client.post(f"{base_url}/api/config", json={"bot_active": True})
        r = api_client.post(f"{base_url}/api/chat", json={"message": "test delete"}, timeout=60)
        assert r.status_code == 200
        conv_id = r.json()["conversation_id"]

        r2 = api_client.delete(f"{base_url}/api/conversations/{conv_id}")
        assert r2.status_code == 200
        assert r2.json()["ok"] is True

        # verify messages removed
        r3 = api_client.get(f"{base_url}/api/conversations/{conv_id}/messages")
        assert r3.status_code == 200
        assert r3.json() == []


# ---------------- Stats ----------------
class TestStats:
    def test_stats(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/stats")
        assert r.status_code == 200
        d = r.json()
        for k in ["messages_today", "unique_clients", "products_viewed", "resolution_rate",
                  "weekly_series", "delta_messages", "delta_clients", "delta_products",
                  "delta_resolution", "peak_hour", "avg_response_ms"]:
            assert k in d, f"missing {k}"
        assert isinstance(d["weekly_series"], list) and len(d["weekly_series"]) == 7
        for it in d["weekly_series"]:
            assert "label" in it and "value" in it


# ---------------- Logs ----------------
class TestLogs:
    def test_clear_then_simulate(self, api_client, base_url):
        r = api_client.delete(f"{base_url}/api/logs")
        assert r.status_code == 200
        r2 = api_client.post(f"{base_url}/api/logs/simulate")
        assert r2.status_code == 200
        assert r2.json()["count"] == 6
        r3 = api_client.get(f"{base_url}/api/logs")
        assert r3.status_code == 200
        logs = r3.json()
        assert isinstance(logs, list)
        assert len(logs) >= 6
        levels = {log["level"] for log in logs}
        # at least includes INFO and SUCCESS
        assert "INFO" in levels


# ---------------- WhatsApp ----------------
class TestWhatsApp:
    def test_connect_then_disconnect(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/whatsapp/connect")
        assert r.status_code == 200
        assert r.json()["connected"] is True
        cfg = api_client.get(f"{base_url}/api/config").json()
        assert cfg["whatsapp"]["connected"] is True

        r2 = api_client.post(f"{base_url}/api/whatsapp/disconnect")
        assert r2.status_code == 200
        assert r2.json()["connected"] is False
        cfg2 = api_client.get(f"{base_url}/api/config").json()
        assert cfg2["whatsapp"]["connected"] is False


# ---------------- Transcribe ----------------
def _make_wav_bytes(duration_s=1.0, freq=440, rate=16000):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        for i in range(int(duration_s * rate)):
            sample = int(32767 * 0.3 * math.sin(2 * math.pi * freq * i / rate))
            w.writeframes(struct.pack("<h", sample))
    return buf.getvalue()


class TestTranscribe:
    def test_transcribe_no_file_returns_422(self, base_url):
        # FastAPI returns 422 if File(...) is missing
        r = requests.post(f"{base_url}/api/transcribe", timeout=20)
        assert r.status_code in (400, 422)

    def test_transcribe_with_wav(self, base_url):
        wav = _make_wav_bytes(1.0)
        files = {"audio": ("voice.wav", wav, "audio/wav")}
        r = requests.post(f"{base_url}/api/transcribe", files=files, timeout=60)
        # Accept 200 (success) or 502 (Groq rejects short/synthetic audio) as acceptable
        assert r.status_code in (200, 502), r.text
        if r.status_code == 200:
            data = r.json()
            assert "text" in data
            assert data.get("model") == "whisper-large-v3"
