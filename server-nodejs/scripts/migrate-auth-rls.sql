-- Auth dashboard admin — migration v7 (extrait idempotent)

create or replace function public.is_dashboard_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists "dashboard admin read own profile" on public.profiles;
create policy "dashboard admin read own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "anon all bot_config" on public.bot_config;
drop policy if exists "admin all bot_config" on public.bot_config;
create policy "admin all bot_config" on public.bot_config
  for all using (public.is_dashboard_admin()) with check (public.is_dashboard_admin());

drop policy if exists "anon all conversations" on public.conversations;
drop policy if exists "admin all conversations" on public.conversations;
create policy "admin all conversations" on public.conversations
  for all using (public.is_dashboard_admin()) with check (public.is_dashboard_admin());

drop policy if exists "anon all messages" on public.messages;
drop policy if exists "admin all messages" on public.messages;
create policy "admin all messages" on public.messages
  for all using (public.is_dashboard_admin()) with check (public.is_dashboard_admin());

drop policy if exists "anon all logs" on public.logs;
drop policy if exists "admin all logs" on public.logs;
create policy "admin all logs" on public.logs
  for all using (public.is_dashboard_admin()) with check (public.is_dashboard_admin());

drop policy if exists "anon all whatsapp_sessions" on public.whatsapp_sessions;
drop policy if exists "admin all whatsapp_sessions" on public.whatsapp_sessions;
create policy "admin all whatsapp_sessions" on public.whatsapp_sessions
  for all using (public.is_dashboard_admin()) with check (public.is_dashboard_admin());

drop policy if exists "anon all ambassador_assets" on public.ambassador_assets;
drop policy if exists "admin all ambassador_assets" on public.ambassador_assets;
create policy "admin all ambassador_assets" on public.ambassador_assets
  for all using (public.is_dashboard_admin()) with check (public.is_dashboard_admin());

drop policy if exists "anon all whatsapp_media" on public.whatsapp_media;
drop policy if exists "admin all whatsapp_media" on public.whatsapp_media;
create policy "admin all whatsapp_media" on public.whatsapp_media
  for all using (public.is_dashboard_admin()) with check (public.is_dashboard_admin());

drop policy if exists "Anon insert ambassador-media" on storage.objects;
drop policy if exists "Anon update ambassador-media" on storage.objects;
drop policy if exists "Anon delete ambassador-media" on storage.objects;
drop policy if exists "Admin insert ambassador-media" on storage.objects;
drop policy if exists "Admin update ambassador-media" on storage.objects;
drop policy if exists "Admin delete ambassador-media" on storage.objects;

create policy "Admin insert ambassador-media" on storage.objects
  for insert with check (bucket_id = 'ambassador-media' and public.is_dashboard_admin());
create policy "Admin update ambassador-media" on storage.objects
  for update using (bucket_id = 'ambassador-media' and public.is_dashboard_admin());
create policy "Admin delete ambassador-media" on storage.objects
  for delete using (bucket_id = 'ambassador-media' and public.is_dashboard_admin());

drop policy if exists "Anon insert whatsapp-media" on storage.objects;
drop policy if exists "Anon update whatsapp-media" on storage.objects;
drop policy if exists "Anon delete whatsapp-media" on storage.objects;
drop policy if exists "Admin insert whatsapp-media" on storage.objects;
drop policy if exists "Admin update whatsapp-media" on storage.objects;
drop policy if exists "Admin delete whatsapp-media" on storage.objects;

create policy "Admin insert whatsapp-media" on storage.objects
  for insert with check (bucket_id = 'whatsapp-media' and public.is_dashboard_admin());
create policy "Admin update whatsapp-media" on storage.objects
  for update using (bucket_id = 'whatsapp-media' and public.is_dashboard_admin());
create policy "Admin delete whatsapp-media" on storage.objects
  for delete using (bucket_id = 'whatsapp-media' and public.is_dashboard_admin());
