-- Ejecuta este archivo en Supabase > SQL Editor.
-- Visitantes pueden insertar respuestas; solo usuarios autenticados leen la lista completa.
create extension if not exists pgcrypto;
create table if not exists public.yahirfest_rsvps (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(trim(name)) between 2 and 80),
 attending boolean not null,
 created_at timestamptz not null default now(),
 normalized_name text generated always as (lower(regexp_replace(trim(name), '\s+', ' ', 'g'))) stored
);
alter table public.yahirfest_rsvps drop column if exists reminder;
create unique index if not exists yahirfest_rsvps_unique_normalized_name on public.yahirfest_rsvps(normalized_name);
alter table public.yahirfest_rsvps enable row level security;
drop policy if exists "Public can submit a Yahir-fest RSVP" on public.yahirfest_rsvps;
create policy "Public can submit a Yahir-fest RSVP" on public.yahirfest_rsvps for insert to anon, authenticated with check (char_length(trim(name)) between 2 and 80 and attending in (true,false));
drop policy if exists "Authenticated admin can read Yahir-fest RSVPs" on public.yahirfest_rsvps;
create policy "Authenticated admin can read Yahir-fest RSVPs" on public.yahirfest_rsvps for select to authenticated using (true);
drop policy if exists "Authenticated admin can update Yahir-fest RSVPs" on public.yahirfest_rsvps;
create policy "Authenticated admin can update Yahir-fest RSVPs" on public.yahirfest_rsvps for update to authenticated using (true) with check (true);
drop policy if exists "Authenticated admin can delete Yahir-fest RSVPs" on public.yahirfest_rsvps;
create policy "Authenticated admin can delete Yahir-fest RSVPs" on public.yahirfest_rsvps for delete to authenticated using (true);
grant usage on schema public to anon, authenticated;
grant insert on public.yahirfest_rsvps to anon, authenticated;
grant select, update, delete on public.yahirfest_rsvps to authenticated;
do $$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime')
 and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='yahirfest_rsvps') then
 execute 'alter publication supabase_realtime add table public.yahirfest_rsvps';
 end if;
end $$;