create table if not exists public.life_tasks (
  id           uuid primary key default gen_random_uuid(),
  session_id   text not null,
  title        text not null,
  notes        text,
  category     text not null default 'inbox',
  status       text not null default 'open',
  priority     int  not null default 2,
  due_at       timestamptz,
  source       text not null default 'user',
  manifold     text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists life_tasks_session_idx on public.life_tasks(session_id, created_at desc);
create index if not exists life_tasks_status_idx  on public.life_tasks(session_id, status);
grant all on public.life_tasks to service_role;
revoke all on public.life_tasks from anon, authenticated, public;
alter table public.life_tasks enable row level security;
create policy "service_role full access life_tasks"
  on public.life_tasks as permissive for all to service_role using (true) with check (true);