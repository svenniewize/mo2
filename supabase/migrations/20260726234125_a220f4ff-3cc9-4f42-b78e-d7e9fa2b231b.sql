create table if not exists public.mimic_ngrams (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  prev text not null,
  next text not null,
  weight int not null default 1,
  updated_at timestamptz not null default now()
);
create index if not exists mimic_ngrams_session_prev_idx on public.mimic_ngrams (session_id, prev);
grant select, insert, update, delete on public.mimic_ngrams to authenticated;
grant all on public.mimic_ngrams to service_role;
alter table public.mimic_ngrams enable row level security;
create policy "mimic service only" on public.mimic_ngrams for all to service_role using (true) with check (true);