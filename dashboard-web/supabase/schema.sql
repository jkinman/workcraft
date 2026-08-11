-- Career-Ops tenant documents table
-- Run this in your Supabase SQL editor before enabling hosted mode.
-- See docs/RLS_CLERK_SETUP.md for Clerk JWT tenant claim configuration.

create table if not exists tenant_documents (
  tenant_id  text        not null,
  path       text        not null,
  content    text        not null default '',
  updated_at timestamptz not null default now(),
  primary key (tenant_id, path)
);

alter table tenant_documents enable row level security;

create index if not exists tenant_documents_tenant_path
  on tenant_documents (tenant_id, path);

-- ── Background job queue ─────────────────────────────────────────────────────

create table if not exists background_jobs (
  id               uuid        primary key default gen_random_uuid(),
  tenant_id        text        not null,
  job_type         text        not null,
  status           text        not null default 'queued',
  payload          jsonb       not null default '{}'::jsonb,
  result           jsonb,
  error            text,
  worker_id        text,
  claimed_at       timestamptz,
  heartbeat_at     timestamptz,
  completed_at     timestamptz,
  retry_count      int         not null default 0,
  max_retries      int         not null default 3,
  idempotency_key  text,
  next_retry_at    timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint background_jobs_job_type_check
    check (job_type in ('scan', 'pdf', 'evaluation')),
  constraint background_jobs_status_check
    check (status in ('queued', 'running', 'completed', 'failed', 'dead_letter'))
);

-- Idempotent migration for existing deployments
alter table background_jobs add column if not exists heartbeat_at timestamptz;
alter table background_jobs add column if not exists retry_count int not null default 0;
alter table background_jobs add column if not exists max_retries int not null default 3;
alter table background_jobs add column if not exists idempotency_key text;
alter table background_jobs add column if not exists next_retry_at timestamptz;

alter table background_jobs drop constraint if exists background_jobs_job_type_check;
alter table background_jobs add constraint background_jobs_job_type_check
  check (job_type in ('scan', 'pdf', 'evaluation'));

alter table background_jobs drop constraint if exists background_jobs_status_check;
alter table background_jobs add constraint background_jobs_status_check
  check (status in ('queued', 'running', 'completed', 'failed', 'dead_letter'));

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

create unique index if not exists background_jobs_tenant_idempotency
  on background_jobs (tenant_id, idempotency_key)
  where idempotency_key is not null;

alter table background_jobs enable row level security;

-- ── Worker health heartbeats (admin/ops visibility) ──────────────────────────

create table if not exists worker_heartbeats (
  worker_id    text        primary key,
  last_seen_at timestamptz not null default now(),
  metadata     jsonb       not null default '{}'::jsonb
);

alter table worker_heartbeats enable row level security;

-- ── Clerk JWT tenant claim helper ────────────────────────────────────────────
-- Clerk must expose tenant id at auth.jwt() ->> 'tenant_id' (see docs/RLS_CLERK_SETUP.md).

create or replace function auth_tenant_id()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'tenant_id',
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  );
$$;

-- ── RLS policies (tenant-scoped authenticated access) ──────────────────────────

drop policy if exists tenant_documents_tenant_select on tenant_documents;
create policy tenant_documents_tenant_select on tenant_documents
  for select using (tenant_id = auth_tenant_id());

drop policy if exists tenant_documents_tenant_insert on tenant_documents;
create policy tenant_documents_tenant_insert on tenant_documents
  for insert with check (tenant_id = auth_tenant_id());

drop policy if exists tenant_documents_tenant_update on tenant_documents;
create policy tenant_documents_tenant_update on tenant_documents
  for update using (tenant_id = auth_tenant_id()) with check (tenant_id = auth_tenant_id());

drop policy if exists tenant_documents_tenant_delete on tenant_documents;
create policy tenant_documents_tenant_delete on tenant_documents
  for delete using (tenant_id = auth_tenant_id());

drop policy if exists background_jobs_tenant_select on background_jobs;
create policy background_jobs_tenant_select on background_jobs
  for select using (tenant_id = auth_tenant_id());

drop policy if exists background_jobs_tenant_insert on background_jobs;
create policy background_jobs_tenant_insert on background_jobs
  for insert with check (tenant_id = auth_tenant_id());

-- Tenants enqueue and poll their jobs; worker (service role) owns status transitions.
-- No tenant UPDATE/DELETE on background_jobs.

-- Storage objects: path prefix `{tenant_id}/` must match JWT tenant claim.
drop policy if exists storage_objects_tenant_select on storage.objects;
create policy storage_objects_tenant_select on storage.objects
  for select using (
    bucket_id = current_setting('app.settings.storage_bucket', true)
    and (storage.foldername(name))[1] = auth_tenant_id()
  );

drop policy if exists storage_objects_tenant_insert on storage.objects;
create policy storage_objects_tenant_insert on storage.objects
  for insert with check (
    bucket_id = current_setting('app.settings.storage_bucket', true)
    and (storage.foldername(name))[1] = auth_tenant_id()
  );

drop policy if exists storage_objects_tenant_update on storage.objects;
create policy storage_objects_tenant_update on storage.objects
  for update using (
    bucket_id = current_setting('app.settings.storage_bucket', true)
    and (storage.foldername(name))[1] = auth_tenant_id()
  );

drop policy if exists storage_objects_tenant_delete on storage.objects;
create policy storage_objects_tenant_delete on storage.objects
  for delete using (
    bucket_id = current_setting('app.settings.storage_bucket', true)
    and (storage.foldername(name))[1] = auth_tenant_id()
  );

-- Worker heartbeats: service role only (no tenant policy).

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
      heartbeat_at = null,
      updated_at = now()
  where status = 'running'
    and coalesce(heartbeat_at, claimed_at) is not null
    and coalesce(heartbeat_at, claimed_at) < now() - make_interval(secs => p_stale_seconds);

  return query
  update background_jobs
  set status = 'running',
      worker_id = p_worker_id,
      claimed_at = now(),
      heartbeat_at = now(),
      updated_at = now()
  where id = (
    select id
    from background_jobs
    where status = 'queued'
      and (next_retry_at is null or next_retry_at <= now())
    order by created_at asc
    for update skip locked
    limit 1
  )
  returning *;
end;
$$;

create or replace function renew_job_lease(
  p_job_id uuid,
  p_worker_id text
)
returns boolean
language plpgsql
as $$
declare
  updated integer;
begin
  update background_jobs
  set heartbeat_at = now(),
      updated_at = now()
  where id = p_job_id
    and worker_id = p_worker_id
    and status = 'running';

  get diagnostics updated = row_count;
  return updated = 1;
end;
$$;

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
      heartbeat_at = null,
      updated_at = now()
  where status = 'running'
    and coalesce(heartbeat_at, claimed_at) is not null
    and coalesce(heartbeat_at, claimed_at) < now() - make_interval(secs => p_stale_seconds);

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function complete_background_job(
  p_job_id uuid,
  p_worker_id text,
  p_result jsonb default '{}'::jsonb
)
returns setof background_jobs
language plpgsql
as $$
begin
  return query
  update background_jobs
  set status = 'completed',
      result = p_result,
      error = null,
      completed_at = now(),
      updated_at = now()
  where id = p_job_id
    and worker_id = p_worker_id
    and status = 'running'
  returning *;
end;
$$;

create or replace function fail_background_job(
  p_job_id uuid,
  p_worker_id text,
  p_error text,
  p_backoff_seconds int default 30
)
returns setof background_jobs
language plpgsql
as $$
declare
  job background_jobs;
begin
  select * into job from background_jobs
  where id = p_job_id and worker_id = p_worker_id and status = 'running'
  for update;

  if not found then
    return;
  end if;

  if job.retry_count + 1 >= job.max_retries then
    return query
    update background_jobs
    set status = 'dead_letter',
        error = p_error,
        retry_count = job.retry_count + 1,
        completed_at = now(),
        worker_id = null,
        updated_at = now()
    where id = p_job_id
    returning *;
  else
    return query
    update background_jobs
    set status = 'queued',
        error = p_error,
        retry_count = job.retry_count + 1,
        worker_id = null,
        claimed_at = null,
        heartbeat_at = null,
        next_retry_at = now() + make_interval(secs => p_backoff_seconds * (job.retry_count + 1)),
        updated_at = now()
    where id = p_job_id
    returning *;
  end if;
end;
$$;

create or replace function upsert_worker_heartbeat(
  p_worker_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns worker_heartbeats
language plpgsql
as $$
declare
  row worker_heartbeats;
begin
  insert into worker_heartbeats (worker_id, last_seen_at, metadata)
  values (p_worker_id, now(), p_metadata)
  on conflict (worker_id) do update
  set last_seen_at = now(),
      metadata = excluded.metadata
  returning * into row;
  return row;
end;
$$;

-- Worker RPCs: service role only (never callable by anon/authenticated tenant JWT).
revoke execute on function claim_next_background_job(text, int) from public, anon, authenticated;
revoke execute on function renew_job_lease(uuid, text) from public, anon, authenticated;
revoke execute on function reclaim_stale_background_jobs(int) from public, anon, authenticated;
revoke execute on function complete_background_job(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function fail_background_job(uuid, text, text, int) from public, anon, authenticated;
revoke execute on function upsert_worker_heartbeat(text, jsonb) from public, anon, authenticated;

grant execute on function claim_next_background_job(text, int) to service_role;
grant execute on function renew_job_lease(uuid, text) to service_role;
grant execute on function reclaim_stale_background_jobs(int) to service_role;
grant execute on function complete_background_job(uuid, text, jsonb) to service_role;
grant execute on function fail_background_job(uuid, text, text, int) to service_role;
grant execute on function upsert_worker_heartbeat(text, jsonb) to service_role;
