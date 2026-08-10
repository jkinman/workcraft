-- Career-Ops tenant documents table
-- Run this in your Supabase SQL editor before enabling hosted mode.

create table if not exists tenant_documents (
  tenant_id  text        not null,
  path       text        not null,
  content    text        not null default '',
  updated_at timestamptz not null default now(),
  primary key (tenant_id, path)
);

-- Row-level security (service-role key bypasses this; add user policies later
-- when you want row-level auth tied to Clerk JWTs).
alter table tenant_documents enable row level security;

-- Index for fast per-tenant prefix scans (reports/, data/, etc.)
create index if not exists tenant_documents_tenant_path
  on tenant_documents (tenant_id, path);

-- ── Background job queue ─────────────────────────────────────────────────────

create table if not exists background_jobs (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null,
  job_type     text        not null,
  status       text        not null default 'queued',
  payload      jsonb       not null default '{}'::jsonb,
  result       jsonb,
  error        text,
  worker_id    text,
  claimed_at   timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint background_jobs_job_type_check
    check (job_type in ('scan', 'pdf')),
  constraint background_jobs_status_check
    check (status in ('queued', 'running', 'completed', 'failed'))
);

create index if not exists background_jobs_tenant_id
  on background_jobs (tenant_id);

create index if not exists background_jobs_status
  on background_jobs (status);

create index if not exists background_jobs_tenant_status
  on background_jobs (tenant_id, status);

create index if not exists background_jobs_tenant_created
  on background_jobs (tenant_id, created_at desc);

create index if not exists background_jobs_queue_claim
  on background_jobs (created_at)
  where status = 'queued';

create index if not exists background_jobs_running_claimed
  on background_jobs (claimed_at)
  where status = 'running';

alter table background_jobs enable row level security;

-- Race-safe claim: reclaims stale running rows, then claims oldest queued row.
create or replace function claim_next_background_job(
  p_worker_id text,
  p_stale_seconds int default 900
)
returns setof background_jobs
language plpgsql
as $$
begin
  update background_jobs
  set status = 'queued',
      worker_id = null,
      claimed_at = null,
      updated_at = now()
  where status = 'running'
    and claimed_at is not null
    and claimed_at < now() - make_interval(secs => p_stale_seconds);

  return query
  update background_jobs
  set status = 'running',
      worker_id = p_worker_id,
      claimed_at = now(),
      updated_at = now()
  where id = (
    select id
    from background_jobs
    where status = 'queued'
    order by created_at asc
    for update skip locked
    limit 1
  )
  returning *;
end;
$$;

-- Reclaim stale running jobs without claiming a new one.
create or replace function reclaim_stale_background_jobs(
  p_stale_seconds int default 900
)
returns integer
language plpgsql
as $$
declare
  affected integer;
begin
  update background_jobs
  set status = 'queued',
      worker_id = null,
      claimed_at = null,
      updated_at = now()
  where status = 'running'
    and claimed_at is not null
    and claimed_at < now() - make_interval(secs => p_stale_seconds);

  get diagnostics affected = row_count;
  return affected;
end;
$$;
