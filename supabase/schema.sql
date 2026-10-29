-- ============================================================
-- Team Quantum Gaming (TQG) — Supabase schema
-- Simplified model: built-in Auth + RLS + public views.
-- Public visitors: anon role -> SELECT only on *_public views.
-- Admins: authenticated role -> full CRUD on base tables.
-- ============================================================

-- ---------- 1. SETTINGS (single row) ----------
create table if not exists public.settings (
  id int primary key check (id = 1),
  team_name text not null default 'Team Quantum Gaming',
  roadmap_start_date date not null default current_date,
  scoring_config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict do nothing;

-- ---------- 2. PLAYERS ----------
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  ign text not null unique,
  display_name text,
  role_primary text not null check (role_primary in ('IGL','Rusher','Supporter','Sniper','Fragger')),
  role_secondary text check (role_secondary in ('IGL','Rusher','Supporter','Sniper','Fragger')),
  roster_status text not null default 'active' check (roster_status in ('active','substitute','trial','inactive')),
  join_date date,
  avatar_url text,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- 3. RECRUITMENT CANDIDATES (private join) ----------
create table if not exists public.recruitment_candidates (
  id uuid primary key default gen_random_uuid(),
  ign text not null,
  target_role text not null check (target_role in ('Rusher','Supporter')),
  trial_status text not null default 'pending' check (trial_status in ('pending','in_trial','passed','failed')),
  trial_date date,
  eval_notes text,            -- PRIVATE
  practice_attendance text,   -- PRIVATE
  teamwork_assessment text,   -- PRIVATE
  decision text check (decision in ('accepted','rejected','pending')),
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- 4. ROADMAP PHASES ----------
create table if not exists public.roadmap_phases (
  id uuid primary key default gen_random_uuid(),
  phase_no int not null check (phase_no between 1 and 4),
  title text not null,
  description text,
  status text not null default 'planned' check (status in ('planned','in_progress','completed','delayed')),
  start_date date,
  end_date date,
  completion_date date,
  notes text
);

-- ---------- 5. ROADMAP TASKS ----------
create table if not exists public.roadmap_tasks (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.roadmap_phases(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  completed_at timestamptz,
  notes text
);
create index if not exists idx_tasks_phase on public.roadmap_tasks(phase_id);

-- ---------- 6. PRACTICE SESSIONS ----------
create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  session_date timestamptz not null,
  practice_type text not null default 'squad' check (practice_type in ('solo','squad','scrim')),
  objectives text,
  participants jsonb not null default '[]'::jsonb,
  attendance jsonb not null default '[]'::jsonb,
  results text,
  mistakes_identified text,
  followup_tasks text,
  created_at timestamptz not null default now()
);

-- ---------- 7. MATCHES ----------
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  match_date date not null,
  match_type text not null check (match_type in ('solo','squad','practice','scrim')),
  opponent text,
  roster jsonb not null default '[]'::jsonb,
  placement int,
  kills int,
  points numeric,
  notes text,
  replay_url text,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- 8. ANNOUNCEMENTS ----------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  published_at timestamptz not null default now(),
  archived boolean not null default false
);

-- ============================================================
-- RLS: lock every base table. Access via views / authenticated role.
-- ============================================================
alter table public.settings enable row level security;
alter table public.players enable row level security;
alter table public.recruitment_candidates enable row level security;
alter table public.roadmap_phases enable row level security;
alter table public.roadmap_tasks enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.matches enable row level security;
alter table public.announcements enable row level security;

-- anon (public) gets NOTHING on base tables.
revoke all on public.settings, public.players, public.recruitment_candidates,
  public.roadmap_phases, public.roadmap_tasks, public.practice_sessions,
  public.matches, public.announcements from anon;

-- authenticated (admin) full access on all base tables.
grant all on public.settings, public.players, public.recruitment_candidates,
  public.roadmap_phases, public.roadmap_tasks, public.practice_sessions,
  public.matches, public.announcements to authenticated;

-- RLS policies for authenticated: full CRUD.
create policy "admin all players" on public.players for all to authenticated using (true) with check (true);
create policy "admin all candidates" on public.recruitment_candidates for all to authenticated using (true) with check (true);
create policy "admin all phases" on public.roadmap_phases for all to authenticated using (true) with check (true);
create policy "admin all tasks" on public.roadmap_tasks for all to authenticated using (true) with check (true);
create policy "admin all practice" on public.practice_sessions for all to authenticated using (true) with check (true);
create policy "admin all matches" on public.matches for all to authenticated using (true) with check (true);
create policy "admin all announcements" on public.announcements for all to authenticated using (true) with check (true);
create policy "admin all settings" on public.settings for all to authenticated using (true) with check (true);

-- ============================================================
-- PUBLIC VIEWS — the only thing anon can read.
-- Expose approved columns/rows only. Private fields never appear.
-- ============================================================
drop view if exists public.players_public;
create view public.players_public with (security_invoker = true) as
  select id, ign, display_name, role_primary, role_secondary, roster_status,
         join_date, avatar_url
  from public.players
  where is_public = true;

drop view if exists public.matches_public;
create view public.matches_public with (security_invoker = true) as
  select id, match_date, match_type, opponent, roster, placement, kills, points, notes, replay_url
  from public.matches
  where is_public = true;

drop view if exists public.roadmap_phases_public;
create view public.roadmap_phases_public with (security_invoker = true) as
  select id, phase_no, title, description, status, start_date, end_date, completion_date
  from public.roadmap_phases;

drop view if exists public.roadmap_tasks_public;
create view public.roadmap_tasks_public with (security_invoker = true) as
  select id, phase_id, title, done, completed_at
  from public.roadmap_tasks;

drop view if exists public.practice_sessions_public;
create view public.practice_sessions_public with (security_invoker = true) as
  select id, session_date, practice_type, objectives, participants, attendance, results
  from public.practice_sessions;

drop view if exists public.announcements_public;
create view public.announcements_public with (security_invoker = true) as
  select id, title, body, published_at
  from public.announcements
  where archived = false;

drop view if exists public.recruitment_public;
create view public.recruitment_public with (security_invoker = true) as
  select id, ign, target_role, trial_status, trial_date, decision
  from public.recruitment_candidates
  where is_public = true;

drop view if exists public.settings_public;
create view public.settings_public with (security_invoker = true) as
  select team_name, roadmap_start_date, scoring_config
  from public.settings
  where id = 1;

-- Grant anon SELECT on public views only.
grant select on public.players_public, public.matches_public,
  public.roadmap_phases_public, public.roadmap_tasks_public,
  public.practice_sessions_public, public.announcements_public,
  public.recruitment_public, public.settings_public to anon;

-- ============================================================
-- NOTE: Enable Supabase Auth (email/password) in dashboard.
-- Create the admin user there. The authenticated role then maps
-- to policies above. No service-role key is ever used client-side.
-- ============================================================
