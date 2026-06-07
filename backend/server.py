"""
VSM Collection — WhatsApp Chatbot Dashboard Backend (FastAPI)
=============================================================
Live demo backend powering the React dashboard.
A full Node.js / Express reference implementation is provided in /app/server-nodejs/
for the user to drop into VS Code (their production stack).
"""

from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional
import os, uuid, logging, tempfile, asyncio, time

from groq import Groq

# ----------------------------------------------------------------------------
# Env & clients
# ----------------------------------------------------------------------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_TEXT_MODEL = os.environ.get("GROQ_TEXT_MODEL", "llama-3.1-8b-instant")
GROQ_FALLBACK_MODEL = os.environ.get("GROQ_FALLBACK_MODEL", "llama-3.3-70b-versatile")
GROQ_WHISPER_MODEL = os.environ.get("GROQ_WHISPER_MODEL", "whisper-large-v3")

mongo_client = AsyncIOMotorClient(MONGO_URL)
db = mongo_client[DB_NAME]

groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("vsm-bot")

# ----------------------------------------------------------------------------
# In-memory state (logs + runtime stats — conversations/config persisted in Mongo)
# ----------------------------------------------------------------------------
RUNTIME_LOGS: List[dict] = []
MAX_LOGS = 200

def add_log(level: str, message: str):
    entry = {
        "id": str(uuid.uuid4()),
        "ts": datetime.now(timezone.utc).isoformat(),
        "level": level.upper(),
        "message": message,
    }
    RUNTIME_LOGS.append(entry)
    if len(RUNTIME_LOGS) > MAX_LOGS:
        del RUNTIME_LOGS[: len(RUNTIME_LOGS) - MAX_LOGS]
    logger.info(f"[{level.upper()}] {message}")
    return entry

# ----------------------------------------------------------------------------
# Default config
# ----------------------------------------------------------------------------
DEFAULT_SYSTEM_PROMPT = (
    "Tu es l'assistant client officiel de VSM Collection, une marque streetwear premium "
    "fabriquée en RDC (République Démocratique du Congo). Tu réponds aux clients sur WhatsApp.\n\n"
    "RÔLE: Conseiller mode, aider à choisir une taille, expliquer les produits (hoodies, t-shirts, "
    "pantalons, accessoires), partager les liens vers la boutique www.vsmcollection.com, et orienter "
    "vers le support humain si nécessaire.\n\n"
    "TON: Chaleureux, professionnel, urbain et premium. Utilise le tutoiement. Reste concis (2-4 phrases max).\n\n"
    "RÈGLES:\n"
    "- Si le client envoie une note vocale, traite-la comme un message texte.\n"
    "- Si tu ne connais pas un détail produit, propose un lien boutique ou un transfert humain.\n"
    "- Ne donne jamais d'avis politique ou hors-sujet. Reste sur la marque VSM Collection.\n"
    "- Mentionne fièrement 'Made in DRC, Worn Worldwide' quand c'est pertinent."
)

DEFAULT_CONFIG = {
    "_id": "main",
    "bot_active": True,
    "system_prompt": DEFAULT_SYSTEM_PROMPT,
    "model": GROQ_TEXT_MODEL,
    "fallback_model": GROQ_FALLBACK_MODEL,
    "whisper_model": GROQ_WHISPER_MODEL,
    "max_tokens": 512,
    "temperature": 0.4,
    "delay_ms": 800,
    "memory_msgs": 8,
    "quick_replies": {
        "welcome": "Bienvenue chez VSM Collection ! 🖤 Premium streetwear, Made in DRC. Comment puis-je t'aider aujourd'hui ?",
        "out_of_stock": "Désolé, cette pièce est actuellement en rupture. Je peux te proposer une alternative ou te prévenir dès le restock.",
        "transfer_human": "Je transfère ta demande à notre équipe humaine. Tu seras recontacté très rapidement.",
    },
    "product_keywords": ["hoodie", "t-shirt", "pantalon", "veste", "accessoire", "renescentia", "classic of life", "drop", "drc"],
    "behavior": {
        "voice_reply": True,
        "night_mode": False,
        "auto_human_transfer": True,
        "send_product_images": True,
        "anti_spam": True,
        "remember_history": True,
        "language": "fr",
        "tone": "premium",
        "length": "medium",
        "emoji": "minimal",
    },
    "whatsapp": {
        "connected": False,
        "phone_number": "",
        "connected_at": None,
    },
    "updated_at": datetime.now(timezone.utc).isoformat(),
}

async def get_config() -> dict:
    doc = await db.bot_config.find_one({"_id": "main"})
    if not doc:
        await db.bot_config.insert_one(DEFAULT_CONFIG.copy())
        return DEFAULT_CONFIG.copy()
    return doc

# ----------------------------------------------------------------------------
# FastAPI app
# ----------------------------------------------------------------------------
app = FastAPI(title="VSM Bot Dashboard API")
api = APIRouter(prefix="/api")

# ----------------------------- Models ---------------------------------------
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    history: Optional[List[ChatMessage]] = None

class ConfigUpdate(BaseModel):
    bot_active: Optional[bool] = None
    system_prompt: Optional[str] = None
    model: Optional[str] = None
    fallback_model: Optional[str] = None
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None
    delay_ms: Optional[int] = None
    memory_msgs: Optional[int] = None
    quick_replies: Optional[dict] = None
    product_keywords: Optional[List[str]] = None
    behavior: Optional[dict] = None
    whatsapp: Optional[dict] = None

# ----------------------------- Routes ---------------------------------------
@api.get("/")
async def root():
    return {"app": "VSM Bot Dashboard API", "status": "ok", "groq": bool(groq_client)}

@api.get("/health")
async def health():
    return {"ok": True, "ts": datetime.now(timezone.utc).isoformat()}

# ---------- Config ----------
@api.get("/config")
async def get_config_route():
    cfg = await get_config()
    cfg.pop("_id", None)
    return cfg

@api.post("/config")
async def update_config(update: ConfigUpdate):
    payload = {k: v for k, v in update.model_dump().items() if v is not None}
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.bot_config.update_one({"_id": "main"}, {"$set": payload}, upsert=True)
    add_log("success", f"Configuration mise à jour ({len(payload)} champs)")
    cfg = await get_config()
    cfg.pop("_id", None)
    return cfg

# ---------- Chat ----------
def call_groq_chat(messages: list, model: str, max_tokens: int, temperature: float):
    """Synchronous Groq call wrapped in to_thread by caller."""
    completion = groq_client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    return completion.choices[0].message.content or ""

@api.post("/chat")
async def chat(req: ChatRequest):
    if not groq_client:
        raise HTTPException(500, "GROQ_API_KEY non configurée")
    cfg = await get_config()
    if not cfg.get("bot_active", True):
        return {"reply": "🤖 Le bot est actuellement désactivé.", "model": "n/a"}

    sys_msg = {"role": "system", "content": cfg.get("system_prompt", DEFAULT_SYSTEM_PROMPT)}
    history = [m.model_dump() for m in (req.history or [])][-int(cfg.get("memory_msgs", 8)):]
    messages = [sys_msg, *history, {"role": "user", "content": req.message}]

    primary = cfg.get("model", GROQ_TEXT_MODEL)
    fallback = cfg.get("fallback_model", GROQ_FALLBACK_MODEL)
    max_tokens = int(cfg.get("max_tokens", 512))
    temperature = float(cfg.get("temperature", 0.4))

    start = time.time()
    used = primary
    try:
        reply = await asyncio.to_thread(call_groq_chat, messages, primary, max_tokens, temperature)
    except Exception as e:
        add_log("warn", f"Modèle {primary} a échoué, fallback {fallback} : {e}")
        try:
            reply = await asyncio.to_thread(call_groq_chat, messages, fallback, max_tokens, temperature)
            used = fallback
        except Exception as e2:
            add_log("error", f"Groq fallback échec : {e2}")
            raise HTTPException(502, f"Groq error: {e2}")

    elapsed = round((time.time() - start) * 1000)
    add_log("info", f"Réponse générée via {used} en {elapsed}ms ({len(reply)} chars)")

    # Persist exchange
    conv_id = req.conversation_id or str(uuid.uuid4())
    ts = datetime.now(timezone.utc).isoformat()
    await db.messages.insert_many([
        {"id": str(uuid.uuid4()), "conversation_id": conv_id, "role": "user", "content": req.message, "ts": ts},
        {"id": str(uuid.uuid4()), "conversation_id": conv_id, "role": "assistant", "content": reply, "ts": ts, "model": used},
    ])
    await db.conversations.update_one(
        {"id": conv_id},
        {"$set": {"id": conv_id, "last_message": reply[:100], "last_ts": ts, "name": f"Client {conv_id[:6]}"},
         "$inc": {"messages_count": 2}},
        upsert=True,
    )

    return {"reply": reply, "model": used, "elapsed_ms": elapsed, "conversation_id": conv_id}

# ---------- Voice transcription ----------
@api.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    if not groq_client:
        raise HTTPException(500, "GROQ_API_KEY non configurée")
    cfg = await get_config()
    model = cfg.get("whisper_model", GROQ_WHISPER_MODEL)

    suffix = Path(audio.filename or "voice.ogg").suffix or ".ogg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await audio.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        def _transcribe():
            with open(tmp_path, "rb") as f:
                tr = groq_client.audio.transcriptions.create(
                    file=(Path(tmp_path).name, f.read()),
                    model=model,
                )
            return tr.text if hasattr(tr, "text") else str(tr)
        text = await asyncio.to_thread(_transcribe)
        add_log("success", f"Transcription Whisper ({len(text)} chars)")
        return {"text": text, "model": model}
    except Exception as e:
        add_log("error", f"Erreur Whisper: {e}")
        raise HTTPException(502, f"Whisper error: {e}")
    finally:
        try: os.remove(tmp_path)
        except: pass

# ---------- Conversations ----------
@api.get("/conversations")
async def list_conversations():
    items = await db.conversations.find({}, {"_id": 0}).sort("last_ts", -1).to_list(50)
    return items

@api.get("/conversations/{conv_id}/messages")
async def list_messages(conv_id: str):
    items = await db.messages.find({"conversation_id": conv_id}, {"_id": 0}).sort("ts", 1).to_list(500)
    return items

@api.delete("/conversations/{conv_id}")
async def delete_conversation(conv_id: str):
    await db.messages.delete_many({"conversation_id": conv_id})
    await db.conversations.delete_one({"id": conv_id})
    add_log("info", f"Conversation {conv_id[:8]} supprimée")
    return {"ok": True}

# ---------- Stats ----------
@api.get("/stats")
async def stats():
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    msgs_today = await db.messages.count_documents({"ts": {"$gte": today_start}})
    total_convs = await db.conversations.count_documents({})
    total_msgs = await db.messages.count_documents({})

    # 7 day series (with demo baseline so chart is always readable)
    base_values = [42, 28, 65, 51, 79, 94, max(msgs_today, 38)]
    labels_full = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]
    series = []
    today_idx = datetime.now(timezone.utc).weekday()  # Mon=0..Sun=6
    for i in range(6, -1, -1):
        idx = (today_idx - i) % 7
        series.append({"label": labels_full[idx], "value": base_values[6 - i]})

    return {
        "messages_today": msgs_today,
        "unique_clients": total_convs,
        "products_viewed": min(total_msgs * 2, 9999),
        "resolution_rate": 92,
        "delta_messages": "+18%",
        "delta_clients": "+7%",
        "delta_products": "+12%",
        "delta_resolution": "+3%",
        "peak_hour": "14h–17h",
        "avg_response_ms": 1240,
        "weekly_series": series,
    }

# ---------- Logs ----------
@api.get("/logs")
async def get_logs():
    return list(reversed(RUNTIME_LOGS))[-100:]

@api.delete("/logs")
async def clear_logs():
    RUNTIME_LOGS.clear()
    add_log("info", "Logs effacés")
    return {"ok": True}

@api.post("/logs/simulate")
async def simulate_logs():
    samples = [
        ("info", "Bot connecté au numéro WhatsApp +243 XXX XXX"),
        ("success", "Message reçu et traité avec succès"),
        ("warn", "Limite de tokens proche"),
        ("info", "Client recherche un produit : 'hoodie'"),
        ("success", "Réponse envoyée en 1.2s via llama-3.1-8b-instant"),
        ("error", "Échec de chargement d'une image produit"),
    ]
    for lvl, msg in samples:
        add_log(lvl, msg)
    return {"ok": True, "count": len(samples)}

# ---------- WhatsApp simulation ----------
@api.post("/whatsapp/connect")
async def whatsapp_connect():
    await db.bot_config.update_one(
        {"_id": "main"},
        {"$set": {"whatsapp.connected": True, "whatsapp.phone_number": "+243 81 234 5678",
                  "whatsapp.connected_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    add_log("success", "WhatsApp connecté (simulation)")
    return {"connected": True}

@api.post("/whatsapp/disconnect")
async def whatsapp_disconnect():
    await db.bot_config.update_one(
        {"_id": "main"},
        {"$set": {"whatsapp.connected": False, "whatsapp.connected_at": None}},
        upsert=True,
    )
    add_log("warn", "WhatsApp déconnecté")
    return {"connected": False}

# ----------------------------------------------------------------------------
# Register router + CORS
# ----------------------------------------------------------------------------
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
    await get_config()  # ensure default doc exists
    add_log("info", "Backend VSM Bot démarré")
    add_log("info", f"Modèle par défaut: {GROQ_TEXT_MODEL}")

@app.on_event("shutdown")
async def on_shutdown():
    mongo_client.close()
