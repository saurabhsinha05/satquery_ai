-- SatQuery AI — initial schema
--
-- Run against your Supabase project:
--   supabase db execute --file backend/migrations/0001_init.sql
-- or paste into the SQL editor in the Supabase dashboard.
--
-- Row Level Security is on for every table. The backend uses the service-role
-- key and bypasses RLS; these policies protect the anon/authenticated keys the
-- browser holds, so a signed-in user can only ever read their own rows.

create extension if not exists "pgcrypto";

/* ────────────────────────────── profiles ─────────────────────────────────── */

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  organisation text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

/* ────────────────────────────── sessions ─────────────────────────────────── */

create table if not exists public.sessions (
  id             text primary key,
  user_id        uuid references auth.users (id) on delete cascade,
  created_at     timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);
create index if not exists sessions_user_idx on public.sessions (user_id, last_active_at desc);

/* ─────────────────────────────── queries ─────────────────────────────────── */

create table if not exists public.queries (
  id         uuid primary key,
  session_id text references public.sessions (id) on delete cascade,
  user_id    uuid references auth.users (id) on delete cascade,
  text       text not null,
  intent     text not null,
  created_at timestamptz not null default now()
);
create index if not exists queries_user_idx on public.queries (user_id, created_at desc);
create index if not exists queries_session_idx on public.queries (session_id, created_at desc);

/* ────────────────────────────── agent_runs ───────────────────────────────── */

create table if not exists public.agent_runs (
  id          uuid primary key,
  session_id  text references public.sessions (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete cascade,
  status      text not null check (status in ('running','completed','failed','needs_clarification')),
  trace_url   text,
  duration_ms integer,
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists agent_runs_user_idx on public.agent_runs (user_id, started_at desc);

/* ────────────────────────────── agent_steps ──────────────────────────────── */

create table if not exists public.agent_steps (
  run_id      uuid not null references public.agent_runs (id) on delete cascade,
  ordinal     integer not null,
  node        text not null,
  label       text not null,
  status      text not null,
  detail      text,
  error       text,
  duration_ms integer,
  created_at  timestamptz not null default now(),
  primary key (run_id, ordinal)
);

/* ─────────────────────────────── analyses ────────────────────────────────── */

create table if not exists public.analyses (
  id              uuid primary key,
  run_id          uuid references public.agent_runs (id) on delete cascade,
  session_id      text references public.sessions (id) on delete cascade,
  user_id         uuid references auth.users (id) on delete cascade,
  query_text      text not null,
  intent          text not null,
  analysis_method text not null,
  analysis_status text not null,
  place_name      text,
  bbox            double precision[],
  date_from       date,
  date_to         date,
  -- The full AgentResponse, so a saved run can be restored exactly.
  payload         jsonb not null,
  created_at      timestamptz not null default now()
);
create index if not exists analyses_user_idx on public.analyses (user_id, created_at desc);
create index if not exists analyses_session_idx on public.analyses (session_id, created_at desc);
create index if not exists analyses_method_idx on public.analyses (analysis_method);

/* ─────────────────────────────── datasets ────────────────────────────────── */

create table if not exists public.datasets (
  id          text primary key,
  run_id      uuid references public.agent_runs (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete cascade,
  collection  text not null,
  name        text not null,
  provider    text not null,
  purpose     text,
  match_count integer not null default 0,
  status      text not null,
  payload     jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists datasets_run_idx on public.datasets (run_id);

/* ─────────────────────────── analysis_datasets ───────────────────────────── */

create table if not exists public.analysis_datasets (
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  dataset_id  text not null references public.datasets (id) on delete cascade,
  role        text not null default 'primary',
  primary key (analysis_id, dataset_id)
);

/* ────────────────────────────── map_layers ───────────────────────────────── */

create table if not exists public.map_layers (
  id          text primary key,
  analysis_id uuid references public.analyses (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete cascade,
  kind        text not null,
  label       text not null,
  payload     jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists map_layers_analysis_idx on public.map_layers (analysis_id);

/* ─────────────────────────────── evidence ────────────────────────────────── */

create table if not exists public.evidence (
  id          uuid primary key default gen_random_uuid(),
  analysis_id uuid references public.analyses (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete cascade,
  kind        text not null,
  title       text not null,
  body        text not null,
  origin      text not null,
  url         text,
  created_at  timestamptz not null default now()
);
create index if not exists evidence_analysis_idx on public.evidence (analysis_id);

/* ──────────────────────────── saved_analyses ─────────────────────────────── */

create table if not exists public.saved_analyses (
  id         uuid primary key,
  run_id     uuid references public.agent_runs (id) on delete set null,
  session_id text references public.sessions (id) on delete set null,
  user_id    uuid references auth.users (id) on delete cascade,
  title      text not null,
  query_text text not null,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists saved_user_idx on public.saved_analyses (user_id, created_at desc);
create index if not exists saved_session_idx on public.saved_analyses (session_id, created_at desc);

/* ─────────────────────────────── activity ────────────────────────────────── */

create table if not exists public.activity (
  id         uuid primary key,
  session_id text references public.sessions (id) on delete cascade,
  user_id    uuid references auth.users (id) on delete cascade,
  run_id     uuid references public.agent_runs (id) on delete cascade,
  type       text not null check (type in (
    'QUERY_STARTED','QUERY_COMPLETED','DATASET_FOUND','IMAGERY_SELECTED',
    'MAP_GENERATED','ANALYSIS_COMPLETED','ANALYSIS_FAILED','ANALYSIS_SAVED'
  )),
  message    text not null,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_user_idx on public.activity (user_id, created_at desc);
create index if not exists activity_session_idx on public.activity (session_id, created_at desc);

/* ──────────────────────────── Row Level Security ─────────────────────────── */

alter table public.profiles         enable row level security;
alter table public.sessions         enable row level security;
alter table public.queries          enable row level security;
alter table public.agent_runs       enable row level security;
alter table public.agent_steps      enable row level security;
alter table public.analyses         enable row level security;
alter table public.datasets         enable row level security;
alter table public.analysis_datasets enable row level security;
alter table public.map_layers       enable row level security;
alter table public.evidence         enable row level security;
alter table public.saved_analyses   enable row level security;
alter table public.activity         enable row level security;

-- Owner-only access for every table that carries a user_id.
do $$
declare
  t text;
begin
  foreach t in array array[
    'sessions','queries','agent_runs','analyses','datasets',
    'map_layers','evidence','saved_analyses','activity'
  ]
  loop
    execute format('drop policy if exists %I on public.%I;', t || '_owner_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = auth.uid());',
      t || '_owner_select', t
    );

    execute format('drop policy if exists %I on public.%I;', t || '_owner_write', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (user_id = auth.uid());',
      t || '_owner_write', t
    );

    execute format('drop policy if exists %I on public.%I;', t || '_owner_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());',
      t || '_owner_update', t
    );

    execute format('drop policy if exists %I on public.%I;', t || '_owner_delete', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (user_id = auth.uid());',
      t || '_owner_delete', t
    );
  end loop;
end
$$;

-- profiles: a user sees and edits only their own row.
drop policy if exists profiles_owner_select on public.profiles;
create policy profiles_owner_select on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists profiles_owner_upsert on public.profiles;
create policy profiles_owner_upsert on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Child tables inherit access through their parent run.
drop policy if exists agent_steps_owner_select on public.agent_steps;
create policy agent_steps_owner_select on public.agent_steps
  for select to authenticated
  using (exists (
    select 1 from public.agent_runs r where r.id = agent_steps.run_id and r.user_id = auth.uid()
  ));

drop policy if exists analysis_datasets_owner_select on public.analysis_datasets;
create policy analysis_datasets_owner_select on public.analysis_datasets
  for select to authenticated
  using (exists (
    select 1 from public.analyses a
    where a.id = analysis_datasets.analysis_id and a.user_id = auth.uid()
  ));

/* ─────────────────────── profile creation on sign-up ─────────────────────── */

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
