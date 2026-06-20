create table if not exists public.viewer_events (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  session_id text not null,
  event_type text not null,
  event_name text not null,
  severity text not null default 'info',
  page_url text,
  route_params jsonb not null default '{}'::jsonb,
  device jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint viewer_events_event_type_check check (
    event_type in ('operation', 'error', 'resource_error', 'model_error', 'performance')
  ),
  constraint viewer_events_severity_check check (
    severity in ('info', 'warn', 'error')
  )
);

create index if not exists viewer_events_created_at_idx
  on public.viewer_events (created_at desc);

create index if not exists viewer_events_project_created_at_idx
  on public.viewer_events (project_id, created_at desc);

create index if not exists viewer_events_type_created_at_idx
  on public.viewer_events (event_type, created_at desc);

create index if not exists viewer_events_severity_created_at_idx
  on public.viewer_events (severity, created_at desc);

alter table public.viewer_events enable row level security;

drop policy if exists "viewer events anon insert" on public.viewer_events;
create policy "viewer events anon insert"
  on public.viewer_events
  for insert
  to anon
  with check (true);

drop policy if exists "viewer events authenticated insert" on public.viewer_events;
create policy "viewer events authenticated insert"
  on public.viewer_events
  for insert
  to authenticated
  with check (true);

revoke all on public.viewer_events from anon;
revoke all on public.viewer_events from authenticated;
grant insert on public.viewer_events to anon;
grant insert on public.viewer_events to authenticated;
