-- ============================================================================
-- VSM BOT — SCHÉMA SUPABASE
-- ----------------------------------------------------------------------------
-- À coller dans Supabase Dashboard > SQL Editor > New query > Run
-- Projet : ehmgjgrekjoaohnnlfmw
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- bot_config (singleton, id = 'main')
-- ----------------------------------------------------------------------------
create table if not exists public.bot_config (
  id              text primary key default 'main',
  bot_active      boolean not null default true,
  system_prompt   text not null default '',
  model           text not null default 'llama-3.1-8b-instant',
  fallback_model  text not null default 'llama-3.3-70b-versatile',
  whisper_model   text not null default 'whisper-large-v3',
  max_tokens      int not null default 512,
  temperature     real not null default 0.4,
  delay_ms        int not null default 800,
  memory_msgs     int not null default 8,
  quick_replies   jsonb not null default '{}'::jsonb,
  product_keywords text[] not null default array[]::text[],
  behavior        jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- conversations (1 par numéro WhatsApp)
-- ----------------------------------------------------------------------------
create table if not exists public.conversations (
  id              uuid primary key default uuid_generate_v4(),
  phone           text not null unique,
  name            text,
  last_message    text,
  last_ts         timestamptz default now(),
  messages_count  int not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists idx_conv_lastts on public.conversations(last_ts desc);

-- ----------------------------------------------------------------------------
-- messages
-- ----------------------------------------------------------------------------
create table if not exists public.messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  role            text not null check (role in ('user','assistant','system')),
  content         text not null,
  model           text,
  media_type      text, -- 'text' | 'audio' | 'image'
  ts              timestamptz not null default now()
);

create index if not exists idx_messages_conv_ts on public.messages(conversation_id, ts);
create index if not exists idx_messages_ts on public.messages(ts desc);

-- ----------------------------------------------------------------------------
-- logs (activité système / runtime)
-- ----------------------------------------------------------------------------
create table if not exists public.logs (
  id        uuid primary key default uuid_generate_v4(),
  level     text not null check (level in ('INFO','SUCCESS','WARN','ERROR')),
  message   text not null,
  ts        timestamptz not null default now()
);
create index if not exists idx_logs_ts on public.logs(ts desc);

-- ----------------------------------------------------------------------------
-- whatsapp_sessions (singleton, écrit par le backend Node.js whatsapp-web.js)
-- ----------------------------------------------------------------------------
create table if not exists public.whatsapp_sessions (
  id            text primary key default 'main',
  connected     boolean not null default false,
  status        text not null default 'disconnected', -- disconnected | qr_pending | authenticated | ready
  phone_number  text,
  qr_code       text,                                  -- data URL (image/png;base64,...)
  connected_at  timestamptz,
  updated_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- RLS — politique simple : tout autorisé via clé anon
-- (Adapté pour un dashboard admin single-user. Pour multi-tenant, durcir.)
-- ----------------------------------------------------------------------------
alter table public.bot_config         enable row level security;
alter table public.conversations      enable row level security;
alter table public.messages           enable row level security;
alter table public.logs               enable row level security;
alter table public.whatsapp_sessions  enable row level security;

drop policy if exists "anon all bot_config"        on public.bot_config;
drop policy if exists "anon all conversations"     on public.conversations;
drop policy if exists "anon all messages"          on public.messages;
drop policy if exists "anon all logs"              on public.logs;
drop policy if exists "anon all whatsapp_sessions" on public.whatsapp_sessions;

create policy "anon all bot_config"        on public.bot_config        for all using (true) with check (true);
create policy "anon all conversations"     on public.conversations     for all using (true) with check (true);
create policy "anon all messages"          on public.messages          for all using (true) with check (true);
create policy "anon all logs"              on public.logs              for all using (true) with check (true);
create policy "anon all whatsapp_sessions" on public.whatsapp_sessions for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- Realtime publication
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.bot_config;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.logs;
alter publication supabase_realtime add table public.whatsapp_sessions;

-- ----------------------------------------------------------------------------
-- Seed initial
-- ----------------------------------------------------------------------------
insert into public.bot_config (id, system_prompt, quick_replies, product_keywords, behavior)
values (
  'main',
$$Tu es l'assistant client officiel de VSM Collection, marque streetwear premium fabriquée en RDC.
Tu réponds aux clients sur WhatsApp.

RÔLE : conseiller mode, expliquer les produits (hoodies, t-shirts, pantalons, accessoires),
partager les liens vers www.vsmcollection.com, transférer à un humain si besoin.

TON : chaleureux, urbain, premium. Tutoiement. Réponses brèves (2-4 phrases).

RÈGLES :
- Si le client envoie une note vocale, traite-la comme un message texte.
- Pour un détail produit inconnu, propose le lien boutique ou un transfert humain.
- Reste sur la marque VSM Collection, jamais hors-sujet.
- Mentionne "Made in DRC, Worn Worldwide" quand c'est pertinent.$$,
  '{
    "welcome": "Bienvenue chez VSM Collection. Premium streetwear, Made in DRC. Comment puis-je t''''aider ?",
    "out_of_stock": "Cette pièce est en rupture. Je peux te proposer une alternative ou te prévenir au restock.",
    "transfer_human": "Je transfère ta demande à notre équipe humaine. Tu seras recontacté rapidement."
  }'::jsonb,
  array['hoodie','t-shirt','pantalon','veste','accessoire','renescentia','classic of life','drop','drc'],
  '{
    "voice_reply": true,
    "night_mode": false,
    "auto_human_transfer": true,
    "send_product_images": true,
    "anti_spam": true,
    "remember_history": true,
    "ignore_groups": true,
    "auto_reconnect": true,
    "notify_disconnects": true,
    "language": "fr",
    "tone": "premium",
    "length": "medium",
    "emoji": "minimal"
  }'::jsonb
) on conflict (id) do nothing;

insert into public.whatsapp_sessions (id) values ('main') on conflict (id) do nothing;
