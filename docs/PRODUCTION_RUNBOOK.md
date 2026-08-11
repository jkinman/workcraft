# Production Runbook — Hosted Career-Ops

Operational guide for hosted deployments (Clerk + Supabase + worker). No secrets in this document.

## Environment roles

| Role | Purpose | Key variables |
|------|---------|---------------|
| **Next.js app (Vercel)** | Tenant HTTP API, Clerk auth, enqueue jobs | `CLERK_*`, `NEXT_PUBLIC_SUPABASE_*`, `CAREER_OPS_TENANT_MODE=hosted` |
| **Background worker** | Claim/run scan, evaluation, PDF jobs | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WORKER_ID`, `WORKER_*` |
| **Supabase Postgres** | `tenant_documents`, `background_jobs`, RPCs, RLS | Run `dashboard-web/supabase/schema.sql` |
| **Supabase Storage** | PDF/output binaries under `{tenant_id}/` prefix | `SUPABASE_STORAGE_BUCKET` |

**Never** expose `SUPABASE_SERVICE_ROLE_KEY` to the browser or tenant API handlers. Use Clerk JWT + anon key for tenant-scoped reads/writes (see [RLS_CLERK_SETUP.md](./RLS_CLERK_SETUP.md)).

## Migrations

1. Apply `dashboard-web/supabase/schema.sql` in the Supabase SQL editor (idempotent).
2. Verify RLS enabled on `tenant_documents`, `background_jobs`, `storage.objects`.
3. Configure Clerk JWT template with `tenant_id` claim (migration steps in RLS doc).
4. Set storage bucket policy prefix `{tenant_id}/`.
5. Smoke-check RPCs: `claim_next_background_job`, `renew_job_lease`, `fail_background_job`, `complete_background_job`.

## Worker deploy and health

```bash
cd dashboard-web
npm run worker          # continuous poll
npm run worker:once     # single job (cron-friendly)
```

| Variable | Default | Meaning |
|----------|---------|---------|
| `WORKER_ID` | `worker-{pid}` | Lease owner identity |
| `WORKER_POLL_INTERVAL_MS` | `5000` | Idle poll interval |
| `WORKER_STALE_SECONDS` | `900` | Stale lease reclaim threshold |
| `WORKER_HEARTBEAT_MS` | `15000` | In-job lease renewal interval |

Health signals:
- `worker_heartbeats.last_seen_at` updated each poll cycle
- Running jobs expose `heartbeat_at`; stale rows revert to `queued`
- Logs: `[worker] claimed|completed|failed {jobId}`

Graceful shutdown: send `SIGINT`/`SIGTERM` — loop exits after current job, heartbeat marked `stopped`.

## Key rotation

1. **Clerk** — rotate `CLERK_SECRET_KEY` in Vercel; no DB migration.
2. **Supabase service role** — generate new key in Supabase dashboard; update worker + server env; restart worker before revoking old key.
3. **Supabase anon** — rotate for JWT clients; update `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. **LLM provider keys** — rotate in Vercel/worker env only; never store in `tenant_documents`.

## Rate card maintenance

- Canonical file: `lib/llm/data/rate-card-v1.json` (version field e.g. `2026-08-10`).
- After updating rates, bump `version` and deploy app + worker together.
- Observability API (`GET /api/llm-usage`) warns on `stale_rate_card` when usage records reference older versions.
- Optional profile overrides: `llm_budget_soft_usd`, `llm_budget_hard_usd` in `config/profile.yml`.

## Dead-letter operations

Jobs in `dead_letter` status exceeded `max_retries` (default 3).

1. Query: `select * from background_jobs where status = 'dead_letter' order by updated_at desc;`
2. Inspect `error`, `payload`, `retry_count`.
3. Fix root cause (missing tenant file, bad payload, worker crash loop).
4. Re-queue manually: `update background_jobs set status='queued', retry_count=0, error=null, worker_id=null where id = '...';`
5. Do **not** reuse idempotency keys for distinct work — clear or change `idempotency_key` when intentionally re-running.

## Rollback

1. Redeploy previous Vercel build.
2. Redeploy/restart previous worker image.
3. Schema is additive/idempotent — avoid dropping columns in production; roll forward fixes preferred.
4. If bad migration applied, restore Supabase point-in-time backup (Supabase dashboard).

## Non-production smoke checklist

Run locally before promote (no real network/LLM):

```bash
node test-all.mjs
cd dashboard-web && npm test
cd dashboard-web && npm run build
cd dashboard && go test ./...
node validate-system-paths-coverage.mjs
```

Hosted-specific suites:
- `dashboard-web/test/hosted-e2e.test.js` — two-tenant fakes
- `dashboard-web/test/worker-resilience.test.js` — lease/retry/dead-letter
- `dashboard-web/test/rls-policy.test.js` — SQL + cross-tenant denial
- `tests/seams/*.contract.test.mjs` — adapter failure/timeout/idempotency

Manual staging (when available):
- [ ] Clerk sign-in resolves correct `tenant_id`
- [ ] Onboarding writes only own tenant rows
- [ ] Scan/evaluation enqueue returns 202 + poll URL
- [ ] Cross-tenant job/document access returns 404
- [ ] Worker completes job; dead-letter after forced failures
- [ ] `/api/llm-usage` returns summaries without secrets

## External deployment actions (cannot complete locally)

- Provision Supabase project + storage bucket + apply SQL in cloud SQL editor
- Configure Clerk JWT template and custom session claims
- Set Vercel/production environment variables
- Deploy long-running worker process (Fly.io, Railway, ECS, etc.)
- Enable Supabase point-in-time recovery and backup retention
- Wire production LLM provider API keys in secret store
