-- ============================================================================
-- VSM BOT — SCHEMA SUPABASE (idempotent, ré-exécutable sans risque)
-- ----------------------------------------------------------------------------
-- À coller dans : Supabase Dashboard → SQL Editor → New query → Run
-- Projet : ehmgjgrekjoaohnnlfmw
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- TABLES
-- ----------------------------------------------------------------------------
create table if not exists public.bot_config (
  id               text primary key default 'main',
  bot_active       boolean not null default true,
  system_prompt    text    not null default '',
  model            text    not null default 'llama-3.1-8b-instant',
  fallback_model   text    not null default 'llama-3.3-70b-versatile',
  whisper_model    text    not null default 'whisper-large-v3',
  max_tokens       int     not null default 512,
  temperature      real    not null default 0.4,
  delay_ms         int     not null default 800,
  memory_msgs      int     not null default 8,
  quick_replies    jsonb   not null default '{}'::jsonb,
  product_keywords text[]  not null default array[]::text[],
  behavior         jsonb   not null default '{}'::jsonb,
  updated_at       timestamptz not null default now()
);

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

create table if not exists public.messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  role            text not null check (role in ('user','assistant','system')),
  content         text not null,
  model           text,
  media_type      text,
  ts              timestamptz not null default now()
);
create index if not exists idx_messages_conv_ts on public.messages(conversation_id, ts);
create index if not exists idx_messages_ts on public.messages(ts desc);

create table if not exists public.logs (
  id      uuid primary key default uuid_generate_v4(),
  level   text not null check (level in ('INFO','SUCCESS','WARN','ERROR')),
  message text not null,
  ts      timestamptz not null default now()
);
create index if not exists idx_logs_ts on public.logs(ts desc);

create table if not exists public.whatsapp_sessions (
  id           text primary key default 'main',
  connected    boolean not null default false,
  status       text not null default 'disconnected',
  phone_number text,
  qr_code      text,
  connected_at timestamptz,
  updated_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
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
-- REALTIME (idempotent — ignore si déjà publié)
-- ----------------------------------------------------------------------------
do $body$
begin
  begin alter publication supabase_realtime add table public.bot_config;        exception when others then null; end;
  begin alter publication supabase_realtime add table public.conversations;     exception when others then null; end;
  begin alter publication supabase_realtime add table public.messages;          exception when others then null; end;
  begin alter publication supabase_realtime add table public.logs;              exception when others then null; end;
  begin alter publication supabase_realtime add table public.whatsapp_sessions; exception when others then null; end;
end
$body$;

-- ----------------------------------------------------------------------------
-- SEED initial (sans apostrophes pour éviter tout problème d'échappement)
-- ----------------------------------------------------------------------------
insert into public.bot_config (id, system_prompt, quick_replies, product_keywords, behavior)
values (
  'main',
  $vsm$Tu es l assistant client officiel de VSM Collection, marque streetwear premium fabriquee en RDC.
Tu reponds aux clients sur WhatsApp.

TON : chaleureux, urbain, premium. Tutoiement. Reponses breves (2-4 phrases).

REGLES :
- Note vocale -> traite comme un message texte.
- Detail produit inconnu -> lien boutique ou transfert humain.
- Reste sur la marque VSM Collection.
- Mentionne "Made in DRC, Worn Worldwide" si pertinent.$vsm$,
  $vsm${
    "welcome": "Bienvenue chez VSM Collection. Premium streetwear, Made in DRC. Comment puis-je vous aider ?",
    "out_of_stock": "Cette piece est en rupture. Je peux te proposer une alternative ou te prevenir au restock.",
    "transfer_human": "Je transfere ta demande a notre equipe humaine. Tu seras recontacte rapidement."
  }$vsm$::jsonb,
  array['hoodie','t-shirt','pantalon','veste','accessoire','renescentia','classic of life','drop','drc'],
  $vsm${
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
    "primary_language": "fr",
    "auto_detect_language": true,
    "tone": "premium",
    "length": "medium",
    "emoji": "minimal",
    "image_reply": true,
    "brand_name": "VSM Collection",
    "shop_url": "https://www.vsmcollection.com",
    "archived_collections": ["vie sur moi", "ecrit vie"],
    "languages": [
      {"code": "fr", "label": "Francais", "enabled": true, "reply_instruction": "Reponds en francais."},
      {"code": "en", "label": "English", "enabled": true, "reply_instruction": "Reply in English."},
      {"code": "ln", "label": "Lingala", "enabled": false, "reply_instruction": "Yano na Lingala."}
    ],
    "prompts": {
      "vision": "Analyse les photos clients VSM. Collections en vente: {COLLECTIONS}.",
      "discontinued": "Cette collection ({COLLECTION}) n est plus commercialisee. Propose: {COLLECTIONS}.",
      "not_in_catalog": "Ce visuel n est pas dans notre catalogue. Oriente vers: {COLLECTIONS}.",
      "night_mode": "Mode nuit: reponses courtes."
    }
  }$vsm$::jsonb
) on conflict (id) do nothing;

insert into public.whatsapp_sessions (id) values ('main') on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- MIGRATION v2 — mémoire client + widget web (idempotent)
-- ----------------------------------------------------------------------------
alter table public.conversations add column if not exists notes text;
alter table public.conversations add column if not exists summary text;
alter table public.conversations add column if not exists profile jsonb not null default '{}'::jsonb;
alter table public.conversations add column if not exists channel text not null default 'whatsapp';

-- ----------------------------------------------------------------------------
-- MIGRATION v3 — chatbot ambassadeur (idempotent)
-- ----------------------------------------------------------------------------
create table if not exists public.ambassador_assets (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  caption     text,
  image_url   text not null,
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.conversations add column if not exists starred boolean not null default false;
alter table public.conversations add column if not exists interest_score int not null default 0;

alter table public.ambassador_assets enable row level security;
drop policy if exists "anon all ambassador_assets" on public.ambassador_assets;
create policy "anon all ambassador_assets" on public.ambassador_assets for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- MIGRATION v4 — assets ambassadeur enrichis + storage policies
-- ----------------------------------------------------------------------------
alter table public.ambassador_assets add column if not exists description text;
alter table public.ambassador_assets add column if not exists keywords text[] not null default array[]::text[];

-- Bucket Storage ambassador-media
insert into storage.buckets (id, name, public)
values ('ambassador-media', 'ambassador-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read ambassador-media" on storage.objects;
create policy "Public read ambassador-media" on storage.objects
  for select using (bucket_id = 'ambassador-media');

drop policy if exists "Anon insert ambassador-media" on storage.objects;
create policy "Anon insert ambassador-media" on storage.objects
  for insert with check (bucket_id = 'ambassador-media');

drop policy if exists "Anon update ambassador-media" on storage.objects;
create policy "Anon update ambassador-media" on storage.objects
  for update using (bucket_id = 'ambassador-media');

drop policy if exists "Anon delete ambassador-media" on storage.objects;
create policy "Anon delete ambassador-media" on storage.objects
  for delete using (bucket_id = 'ambassador-media');

-- ----------------------------------------------------------------------------
-- MIGRATION v5 — médias WhatsApp + config admin
-- ----------------------------------------------------------------------------
create table if not exists public.whatsapp_media (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  caption     text,
  description text,
  keywords    text[] not null default array[]::text[],
  image_url   text not null,
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.whatsapp_media enable row level security;
drop policy if exists "anon all whatsapp_media" on public.whatsapp_media;
create policy "anon all whatsapp_media" on public.whatsapp_media for all using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('whatsapp-media', 'whatsapp-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read whatsapp-media" on storage.objects;
create policy "Public read whatsapp-media" on storage.objects
  for select using (bucket_id = 'whatsapp-media');

drop policy if exists "Anon insert whatsapp-media" on storage.objects;
create policy "Anon insert whatsapp-media" on storage.objects
  for insert with check (bucket_id = 'whatsapp-media');

drop policy if exists "Anon update whatsapp-media" on storage.objects;
create policy "Anon update whatsapp-media" on storage.objects
  for update using (bucket_id = 'whatsapp-media');

drop policy if exists "Anon delete whatsapp-media" on storage.objects;
create policy "Anon delete whatsapp-media" on storage.objects
  for delete using (bucket_id = 'whatsapp-media');

-- ============================================================================
-- DONE
-- ============================================================================
