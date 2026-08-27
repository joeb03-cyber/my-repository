-- Stage 13: small, manually authored Activity Monitor surface.
-- Apply to isolated staging only until the personality pass is accepted.

create table if not exists public.activity_monitor_processes (
  id uuid primary key,
  name text not null,
  status text not null default 'background' check (status in ('running', 'background', 'sleeping', 'not_responding')),
  detail text not null default '',
  started_label text,
  related_items jsonb not null default '[]'::jsonb,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  editorial_state text not null default 'approved' check (editorial_state in ('suggested', 'needs_review', 'approved', 'rejected')),
  lifecycle_state text not null default 'active' check (lifecycle_state in ('active', 'archived')),
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists activity_monitor_processes_updated_at on public.activity_monitor_processes;
create trigger activity_monitor_processes_updated_at before update on public.activity_monitor_processes
  for each row execute function public.brain_set_updated_at();

alter table public.activity_monitor_processes enable row level security;

drop policy if exists brain_admin_activity_monitor on public.activity_monitor_processes;
create policy brain_admin_activity_monitor on public.activity_monitor_processes for all to authenticated
  using (public.is_brain_admin()) with check (public.is_brain_admin());

grant select, insert, update on public.activity_monitor_processes to authenticated;
grant all on public.activity_monitor_processes to service_role;

create or replace view public.brain_public_activity_processes
with (security_barrier = true)
as
select id, name, status, detail, started_label, related_items, sort_order
from public.activity_monitor_processes
where visibility = 'public'
  and editorial_state = 'approved'
  and lifecycle_state = 'active'
order by sort_order, name;

grant select on public.brain_public_activity_processes to anon, authenticated;

comment on table public.activity_monitor_processes is 'Manually authored attention metaphors; never inferred or treated as measured activity.';
comment on view public.brain_public_activity_processes is 'Only approved public Activity Monitor rows; private editorial records are structurally excluded.';
