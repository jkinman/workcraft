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
