-- ==============================================================
-- Vetura — Supabase Schema
-- Multi-tenant career intelligence platform
-- Auth: Supabase Auth (auth.users built-in)
-- RLS: Row Level Security on every table
-- ==============================================================

-- ── Enums ──────────────────────────────────────────────────────

create type pipeline_status as enum (
  'wishlist', 'scored', 'evaluated', 'applied', 'interviewing',
  'offer', 'rejected', 'withdrawn', 'closed'
);

create type tier as enum (
  'free', 'scout', 'pro', 'expert', 'agency', 'enterprise'
);

create type eval_model as enum (
  'deepseek-v4-flash',
  'claude-haiku-4.5',
  'claude-sonnet-4.6'
);

-- ── Profiles (extends auth.users) ──────────────────────────────

create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  display_name    text,
  tier            tier not null default 'free',
  tier_updated_at timestamptz,
  evals_used      integer not null default 0,       -- billing period counter
  evals_billing_start timestamptz default now(),    -- resets monthly
  -- CV data
  raw_cv          text,                              -- pasted or extracted text
  parsed_cv       jsonb,                             -- structured: skills, experience, etc.
  -- Preferences
  target_roles    text[],                             -- e.g. {"Senior Engineer", "Staff Engineer"}
  target_companies text[],                            -- e.g. {"Linear", "OpenAI"}
  target_salary_min   integer,                        -- in CAD
  target_salary_max   integer,
  preferred_locations text[],
  -- Meta
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Constraints
  constraint valid_evals check (evals_used >= 0)
);

-- Auto-create profile on user signup
create function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Canonical Job Postings (shared across users) ───────────────

create table jobs (
  id              uuid primary key default gen_random_uuid(),
  canonical_url   text not null unique,             -- normalized, no trailing slashes etc.
  company         text not null,
  title           text not null,
  location        text,
  compensation    text,                              -- raw text from posting
  raw_jd          text,                              -- fetched description text
  parsed_jd       jsonb,                             -- structured: skills, stack, seniority
  source          text,                              -- 'ashby', 'greenhouse', 'lever', 'manual', etc.
  status          text not null default 'active',    -- 'active', 'closed', 'stale'
  last_fetched_at timestamptz default now(),
  last_live_check timestamptz,
  created_at      timestamptz not null default now()
);

create index idx_jobs_canonical_url on jobs(canonical_url);
create index idx_jobs_company on jobs(company);
create index idx_jobs_status on jobs(status);

-- ── Evaluations (one per job + profile + model combo) ──────────

create table evaluations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  job_id          uuid not null references jobs(id) on delete cascade,
  profile_hash    text,                              -- sha256 of raw_cv at eval time
  model           eval_model not null default 'deepseek-v4-flash',
  -- Scores (all 1-5 scale)
  cv_score        numeric(3,1),
  north_star_score numeric(3,1),
  comp_score      numeric(3,1),
  culture_score   numeric(3,1),
  rf_penalty      numeric(3,1),                      -- negative
  global_score    numeric(3,1),
  -- Output
  recommendation  text,                              -- 'apply immediately', 'worth applying', etc.
  full_report     text,                              -- the rendered A-G report
  raw_response    jsonb,                             -- full LLM response for debugging
  -- Meta
  token_count     integer,                            -- total tokens used
  cost_usd        numeric(10,6),                      -- exact cost of this eval
  elapsed_ms      integer,                            -- how long the LLM call took
  created_at      timestamptz not null default now(),
  -- One eval per job+user+model combo
  unique(user_id, job_id, model)
);

create index idx_evaluations_user on evaluations(user_id);
create index idx_evaluations_job on evaluations(job_id);
create index idx_evaluations_created on evaluations(created_at desc);

-- ── Pipeline (user's personal job tracking) ────────────────────

create table pipeline_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  job_id          uuid not null references jobs(id) on delete cascade,
  status          pipeline_status not null default 'wishlist',
  user_notes      text,
  applied_at      timestamptz,
  interview_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- One pipeline entry per user per job
  unique(user_id, job_id)
);

create index idx_pipeline_user on pipeline_items(user_id);
create index idx_pipeline_status on pipeline_items(status);

-- ── Scan History (for dedup + rate limiting) ───────────────────

create table scan_history (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  scan_type       text not null,                     -- 'ats_direct', 'search_sweep', 'manual_add'
  source          text,                              -- which query or company
  jobs_found      integer,
  new_jobs        integer,                           -- after dedup
  jobs_filtered   integer,
  elapsed_ms      integer,
  created_at      timestamptz not null default now()
);

create index idx_scan_history_user on scan_history(user_id, created_at desc);

-- ── Usage Tracking (for tier enforcement) ─────────────────────

create table usage_log (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  action          text not null,                     -- 'eval', 'scan', 'report_generate'
  model           eval_model,
  token_count     integer,
  cost_usd        numeric(10,6),
  created_at      timestamptz not null default now()
);

create index idx_usage_log_user on usage_log(user_id, created_at desc);

-- ── Row Level Security ─────────────────────────────────────────

alter table profiles enable row level security;
alter table jobs enable row level security;
alter table evaluations enable row level security;
alter table pipeline_items enable row level security;
alter table scan_history enable row level security;
alter table usage_log enable row level security;

-- Profiles: users see only their own
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Jobs: any authenticated user can read, only service role can insert
create policy "Any authed user can view jobs"
  on jobs for select
  using (auth.role() = 'authenticated');

create policy "Service role can insert jobs"
  on jobs for insert
  with check (auth.role() = 'service_role');

-- Evaluations: users see their own
create policy "Users can view own evaluations"
  on evaluations for select
  using (auth.uid() = user_id);

create policy "Users can create own evaluations"
  on evaluations for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own evaluations"
  on evaluations for delete
  using (auth.uid() = user_id);

-- Pipeline: fully user-scoped
create policy "Users can view own pipeline"
  on pipeline_items for select
  using (auth.uid() = user_id);

create policy "Users can insert own pipeline"
  on pipeline_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update own pipeline"
  on pipeline_items for update
  using (auth.uid() = user_id);

create policy "Users can delete own pipeline"
  on pipeline_items for delete
  using (auth.uid() = user_id);

-- Scan history: user-scoped
create policy "Users can view own scans"
  on scan_history for select
  using (auth.uid() = user_id);

create policy "Users can create own scan"
  on scan_history for insert
  with check (auth.uid() = user_id);

-- Usage log: service role only
create policy "Service role only for usage_log"
  on usage_log for all
  using (auth.role() = 'service_role');

-- ── Helper functions ──────────────────────────────────────────

-- Check if user can run an evaluation (tier limits)
create function check_eval_quota(p_user_id uuid)
returns boolean as $$
declare
  p_tier tier;
  p_used integer;
  p_max integer;
  p_reset timestamptz;
begin
  select tier, evals_used, evals_billing_start
    into p_tier, p_used, p_reset
    from profiles
    where id = p_user_id;

  -- Monthly reset
  if p_reset < date_trunc('month', now()) then
    update profiles
    set evals_used = 0, evals_billing_start = now()
    where id = p_user_id;
    p_used := 0;
  end if;

  -- Tier limits
  p_max := case p_tier
    when 'free' then 1
    when 'scout' then 50
    when 'pro' then 200
    when 'expert' then 500
    when 'agency' then 5000
    when 'enterprise' then 999999
  end;

  return p_used < p_max;
end;
$$ language plpgsql security definer;

-- Get user's tier-appropriate model
create function get_tier_model(p_user_id uuid)
returns eval_model as $$
declare
  p_tier tier;
begin
  select tier into p_tier from profiles where id = p_user_id;

  return case p_tier
    when 'free' then 'deepseek-v4-flash'::eval_model
    when 'scout' then 'deepseek-v4-flash'::eval_model
    when 'pro' then 'claude-haiku-4.5'::eval_model
    when 'expert' then 'claude-sonnet-4.6'::eval_model
    when 'agency' then 'claude-haiku-4.5'::eval_model
    when 'enterprise' then 'claude-sonnet-4.6'::eval_model
  end;
end;
$$ language plpgsql security definer;