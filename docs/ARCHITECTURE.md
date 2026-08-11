# Architecture

This file describes the runtime flows. Design principles and the
system/user data-contract layers live in [../ARCHITECTURE.md](../ARCHITECTURE.md).
Fork domain vocabulary and ADRs: [../CONTEXT.md](../CONTEXT.md), [adr/](adr/).

## System Overview

Career-Ops is one modular monolith presented through three adapters:

- stable Node CLI scripts at the repository root;
- a local Go TUI under `dashboard/`;
- a multi-tenant Next.js application and worker under `dashboard-web/`.

```text
                        modes/*.md
                  scoring and prompt truth
                             │
      ┌──────────────────────┼───────────────────────┐
      ▼                      ▼                       ▼
root CLI facades       Next.js route facades      Go TUI
      │                      │                       │
      │              tenant-services                │
      │                      │                       │
      └──────────────────────┼───────────────────────┘
                             ▼
                 import-safe domain modules
   ┌──────────┬───────────┬──────────┬──────────┬─────────┐
   ▼          ▼           ▼          ▼          ▼         ▼
discovery  evaluation   LLM gateway documents tracker  batch/profile
   │          │           │          │          │
 providers  validation  adapters   adapters   contract
   └──────────┴───────────┴──────────┴──────────┘
                             ▼
            local workspace or hosted repositories
```

Entry facades own protocol parsing only. Domain modules do not launch CLIs, browsers, network calls, or writes at import time.

## Storage Shapes

### Local

Human-readable workspace files are canonical:

- `config/profile.yml`, `cv.md`, `article-digest.md` — evaluation input
- `portals.yml`, `data/pipeline.md`, `data/scan-history.tsv` — discovery state
- `reports/*.md`, `data/applications.md`, `data/status-log.tsv` — evaluated and tracked state
- `output/*` — generated documents
- `data/llm-usage.jsonl` — append-only model telemetry

`CAREER_OPS_DATA_ROOT` selects a workspace. `lib/path-roots.mjs` is the only path catalog.

### Hosted

Supabase stores tenant documents and background-job state while preserving local logical paths. Clerk supplies a tenant claim. Ordinary HTTP requests use a tenant-scoped anon client carrying that Clerk JWT; only workers/admin operations may use the Supabase service role.

The hosted repository is an adapter over the file-shaped domain model, not a competing business model.

## Evaluation Flow

```text
JD text or public URL
  → SSRF-safe posting reader (URL only)
  → evaluation context + modes
  → LLM route plan
  → provider adapter with timeout/retry/fallback
  → output validation + score summary
  → report persistence + tracker integration
  → sanitized Usage Record
```

The evaluation module owns context, guards, validation, score parsing, display, and persistence. Provider transport and fallback live in the LLM gateway.

Every report carries Score, URL, PDF and Legitimacy headers. New tracker rows are staged as TSV and merged; existing statuses change through `set-status.mjs` and the canonical tracker transition.

## LLM Gateway

`lib/llm/` resolves provider/model routes from spend tier, explicit overrides, capabilities and budget ceilings. It supports:

- OpenAI-compatible and Gemini adapters;
- bounded retries and per-attempt timeout;
- same-provider and opt-in cross-provider fallback;
- versioned rates in `lib/llm/data/rate-card-v1.json`;
- normalized tokens and estimated cost;
- one append-only Usage Record per logical call;
- route telemetry and persisted route-audit metadata;
- recursive secret/content sanitization.

Callers depend on the gateway contract, never vendor SDK response shapes.

## Discovery Flow

```text
portal configuration
  → provider registry / reverse source enumeration
  → normalization + ATS identity
  → location/title filters
  → dedupe/history
  → optional sequential browser liveness verification
  → structured ScanResult
  → pipeline/history sinks
```

Browser transport is lazy. Browser verification is the final liveness authority. URL fetches reject private, loopback and otherwise unsafe targets.

## Document Flow

`lib/documents/` exposes document adapters:

- HTML template + Playwright;
- LaTeX validation + compiler;
- ATS text normalization and PDF index maintenance.

Root scripts and the hosted PDF service consume the same adapters. Temporary in-memory web PDFs do not mutate the local PDF index.

## Tracker Consistency

`templates/tracker-contract.json` is the machine-readable contract shared by Node and Go. A status transition is one logical mutation across:

1. `data/applications.md`;
2. report frontmatter;
3. `data/status-log.tsv`.

The local data client provides multi-document mutation/rollback. Hosted repositories preserve the same semantics.

## Batch Processing

```text
batch input
  → report-number reservation
  → lib/batch state/selection/locking
  → CLI adapter (Claude, Codex, OpenCode, etc.)
  → N headless workers
  → report + PDF + tracker TSV
  → merge-tracker.mjs
```

Shell remains an orchestration facade; state and argument decisions live in import-safe Node helpers.

## Hosted Request and Worker Flow

```text
Clerk-authenticated request
  → request-scoped getTenantServices(Request)
  → tenant repository + workload runner
  → enqueue background_jobs
  → service-role worker claim
  → heartbeat/lease renewal
  → tenant materialization
  → shared workload execution
  → artifact sync + complete/fail
  → tenant-scoped polling
```

Scan, evaluation and PDF routes use the workload seam. Hosted jobs are idempotent, retry-bounded and lease-owner scoped. Exhausted jobs enter `dead_letter`; stale jobs are reclaimed from their latest heartbeat.

## Security Boundaries

- Clerk tenant claims plus Supabase RLS enforce document/job isolation.
- Tenant routes cannot construct or receive a service-role repository.
- Background-job worker RPCs are granted only to `service_role`.
- Storage keys are tenant-prefixed and protected by RLS.
- Posting/JD content is untrusted data and cannot issue agent instructions.
- Usage records exclude prompts, JD text, page content, headers and credentials.
- Application submission remains human-only.

## Entry Facades and Bridges

- Root scripts preserve legacy argv/stdout/exit behavior.
- Next routes depend on `tenant-services` and service contracts.
- CJS-to-ESM bridges import narrow modules to avoid tracing CLI/compiler code into server bundles.
- Legacy Express paths have been retired; see `dashboard-web/EXPRESS_PARITY.md`.

## Validation

**CI ownership:** `.github/workflows/web-ci.yml` runs `npm ci`, `npm test`, and `npm run build` in `dashboard-web/` on path-filtered PRs and `main` pushes (dashboard tree, `lib/**`, shared templates, and root facades the hosted adapter imports). The root `.github/workflows/test.yml` matrix keeps cross-platform coverage for CLI scripts; it does not run the Next.js build.

Run sequentially:

```bash
node test-all.mjs
cd dashboard-web && npm test
cd dashboard-web && npm run build
cd dashboard && go test ./...
node validate-system-paths-coverage.mjs
git diff --check
```

Key contracts:

- `dashboard-web/test/architecture-contract.test.js`
- `tests/seams/*.contract.test.mjs`
- `dashboard-web/test/hosted-e2e.test.js`
- `dashboard-web/test/worker-resilience.test.js`
- `dashboard-web/test/rls-policy.test.js`

Operational details are in [PRODUCTION_RUNBOOK.md](PRODUCTION_RUNBOOK.md) and [RLS_CLERK_SETUP.md](RLS_CLERK_SETUP.md).
