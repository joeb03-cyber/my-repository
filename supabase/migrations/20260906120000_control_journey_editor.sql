-- Let the single Brain administrator add canonical places and visits from
-- Control Center. Anonymous visitors continue to see only the public views.

drop policy if exists brain_admin_travel_source_snapshots on public.travel_source_snapshots;
create policy brain_admin_travel_source_snapshots on public.travel_source_snapshots
  for all to authenticated
  using (public.is_brain_admin())
  with check (public.is_brain_admin());

drop policy if exists brain_admin_travel_places on public.travel_places;
create policy brain_admin_travel_places on public.travel_places
  for all to authenticated
  using (public.is_brain_admin())
  with check (public.is_brain_admin());

drop policy if exists brain_admin_travel_visits on public.travel_visits;
create policy brain_admin_travel_visits on public.travel_visits
  for all to authenticated
  using (public.is_brain_admin())
  with check (public.is_brain_admin());

grant select, insert, update on public.travel_source_snapshots to authenticated;
grant select, insert, update on public.travel_places to authenticated;
grant select, insert, update on public.travel_visits to authenticated;

