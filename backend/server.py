"""
VSM Bot — Playground API (FastAPI)
==================================
Backend ULTRA-LÉGER ne servant QUE le playground du dashboard :
  - POST /api/playground/chat       → tester un prompt avec Groq (stateless)
  - POST /api/playground/transcribe → tester Whisper (stateless)

Toutes les données persistantes (config, conversations, messages, logs,
session WhatsApp) sont dans Supabase et accédées directement depuis le
frontend React.

Le bot WhatsApp tourne sur Node.js (/app/server-nodejs/) avec whatsapp-web.js.
"""

from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Form, Body
from fastapi.responses import PlainTextResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from pathlib import Path
import os, tempfile, asyncio, time, logging
from typing import List, Optional
from pydantic import BaseModel

from groq import Groq

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_TEXT_MODEL = os.environ.get("GROQ_TEXT_MODEL", "llama-3.1-8b-instant")
GROQ_FALLBACK_MODEL = os.environ.get("GROQ_FALLBACK_MODEL", "llama-3.3-70b-versatile")
GROQ_WHISPER_MODEL = os.environ.get("GROQ_WHISPER_MODEL", "whisper-large-v3")

groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("vsm-playground")


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = None
    config: Optional[dict] = None


app = FastAPI(title="VSM Playground API")
api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"app": "VSM Playground API", "ok": True, "groq": bool(groq_client)}


@api.get("/health")
async def health():
    return {"ok": True}


@api.get("/supabase-schema.sql", response_class=PlainTextResponse)
async def supabase_schema():
    sql_path = ROOT_DIR.parent / "server-nodejs" / "supabase-schema.sql"
    if not sql_path.exists():
        raise HTTPException(404, "Schema file not found")
    return sql_path.read_text(encoding="utf-8")


def _call_groq(messages, model, max_tokens, temperature):
    completion = groq_client.chat.completions.create(
        model=model, messages=messages, max_tokens=max_tokens, temperature=temperature,
    )
    return completion.choices[0].message.content or ""


@api.post("/playground/chat")
async def playground_chat(req: ChatRequest):
    if not groq_client:
        raise HTTPException(500, "GROQ_API_KEY non configurée")

    cfg = req.config or {}
    system_prompt = cfg.get("system_prompt") or (
        "Tu es l'assistant client officiel de VSM Collection. "
        "Streetwear premium Made in DRC. Réponds chaleureusement, brièvement."
    )
    primary = cfg.get("model") or GROQ_TEXT_MODEL
    fallback = cfg.get("fallback_model") or GROQ_FALLBACK_MODEL
    max_tokens = int(cfg.get("max_tokens") or 512)
    temperature = float(cfg.get("temperature") or 0.4)
    memory = int(cfg.get("memory_msgs") or 8)

    history = [m.model_dump() for m in (req.history or [])][-memory:]
    messages = [{"role": "system", "content": system_prompt}, *history, {"role": "user", "content": req.message}]

    start = time.time()
    used = primary
    try:
        reply = await asyncio.to_thread(_call_groq, messages, primary, max_tokens, temperature)
    except Exception as e:
        logger.warning(f"Modèle {primary} échec, fallback {fallback}: {e}")
        try:
            reply = await asyncio.to_thread(_call_groq, messages, fallback, max_tokens, temperature)
            used = fallback
        except Exception as e2:
            raise HTTPException(502, f"Groq error: {e2}")

    elapsed = round((time.time() - start) * 1000)
    return {"reply": reply, "model": used, "elapsed_ms": elapsed}


@api.post("/playground/transcribe")
async def playground_transcribe(
    audio: UploadFile = File(...),
    whisper_model: str = Form(GROQ_WHISPER_MODEL),
):
    if not groq_client:
        raise HTTPException(500, "GROQ_API_KEY non configurée")

    suffix = Path(audio.filename or "voice.ogg").suffix or ".ogg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await audio.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        def _t():
            with open(tmp_path, "rb") as f:
                tr = groq_client.audio.transcriptions.create(
                    file=(Path(tmp_path).name, f.read()),
                    model=whisper_model,
                )
            return tr.text if hasattr(tr, "text") else str(tr)
        text = await asyncio.to_thread(_t)
        return {"text": text, "model": whisper_model}
    except Exception as e:
        raise HTTPException(502, f"Whisper error: {e}")
    finally:
        try: os.remove(tmp_path)
        except: pass


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    logger.info(f"VSM Playground API démarré · Groq={bool(groq_client)} · model={GROQ_TEXT_MODEL}")
