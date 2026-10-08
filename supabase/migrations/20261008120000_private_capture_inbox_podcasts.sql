-- Private, owner-operated capture tools. Nothing in these tables is public.

create table if not exists public.capture_inbox (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  capture_kind text not null default 'moment' check (capture_kind in ('moment','travel','idea','observation','question','link','to_try','other')),
  title text,
  body text not null,
  occurred_on date not null default current_date,
  visit_id uuid references public.travel_visits(id) on delete set null,
  source_url text,
  tags text[] not null default '{}',
  status text not null default 'inbox' check (status in ('inbox','kept','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.podcast_episode_captures (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  episode_title text not null,
  show_name text,
  guest_names text[] not null default '{}',
  episode_url text,
  listened_on date,
  listening_state text not null default 'finished' check (listening_state in ('queued','listening','finished')),
  takeaways text not null default '',
  memorable_moments text[] not null default '{}',
  why_saved text not null default '',
  tags text[] not null default '{}',
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists capture_inbox_updated_at on public.capture_inbox;
create trigger capture_inbox_updated_at before update on public.capture_inbox
  for each row execute function public.brain_set_updated_at();
drop trigger if exists podcast_episode_captures_updated_at on public.podcast_episode_captures;
create trigger podcast_episode_captures_updated_at before update on public.podcast_episode_captures
  for each row execute function public.brain_set_updated_at();

alter table public.capture_inbox enable row level security;
alter table public.podcast_episode_captures enable row level security;

drop policy if exists brain_admin_capture_inbox on public.capture_inbox;
create policy brain_admin_capture_inbox on public.capture_inbox for all to authenticated
  using (public.is_brain_admin() and created_by = auth.uid())
  with check (public.is_brain_admin() and created_by = auth.uid());

drop policy if exists brain_admin_podcast_captures on public.podcast_episode_captures;
create policy brain_admin_podcast_captures on public.podcast_episode_captures for all to authenticated
  using (public.is_brain_admin() and created_by = auth.uid())
  with check (public.is_brain_admin() and created_by = auth.uid());

grant select, insert, update on public.capture_inbox, public.podcast_episode_captures to authenticated;
grant all on public.capture_inbox, public.podcast_episode_captures to service_role;

create index if not exists capture_inbox_owner_date_idx on public.capture_inbox (created_by, occurred_on desc, created_at desc);
create index if not exists podcast_captures_owner_date_idx on public.podcast_episode_captures (created_by, listened_on desc, created_at desc);

comment on table public.capture_inbox is 'Private quick captures and daily/travel diary fragments. No anonymous grant or public view.';
comment on table public.podcast_episode_captures is 'Private podcast listening notes captured by the Control Center owner. No anonymous grant or public view.';
