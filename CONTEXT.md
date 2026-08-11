# Career-Ops Domain Context

Fork-owned vocabulary for the modular monolith. System/user file boundaries remain in [DATA_CONTRACT.md](DATA_CONTRACT.md); structural decisions live in [docs/adr/](docs/adr/).

## Glossary

| Term | Meaning |
|------|---------|
| **Job** | A discoverable opening: URL, title, company, location, source portal, and optional ATS metadata. Jobs enter via scan or manual pipeline intake and may be evaluated once or tracked without evaluation. |
| **Evaluation** | A scored assessment of one Job against the candidate profile. Produces a structured report (Blocks A–G), a numeric score, legitimacy tier, and optional tracker linkage. Prompt truth stays in `modes/`; execution routes through the internal LLM gateway when present. |
| **Model Route** | The resolved provider, model id, spend tier, capability constraints, fallback order, and budget ceiling for a single LLM call. Callers request a route; they do not bind to a vendor SDK. |
| **Usage Record** | Append-only telemetry for one LLM invocation: provider, model, task label, token counts (input/output/cache), estimated cost, rate-card version, latency, and outcome. Feeds budgeting and observability; not a canonical business record. |
| **Workspace** | One tenant's Career-Ops data island: profile, tracker, pipeline, reports, generated outputs, and batch state. Locally this is a directory tree rooted at `CAREER_OPS_DATA_ROOT`; hosted it is materialized through repository adapters. |
| **Generated Document** | A rendered artifact derived from evaluation or tailoring—PDF, LaTeX, cover letter, or similar—stored under the workspace `output/` tree with provenance back to a report or job. |
| **Background Job** | A long-running or deferred unit of work (scan slice, evaluation, PDF generation, worker poll cycle) with enqueue metadata, lease/retry policy, and a structured result contract. HTTP handlers enqueue; workers execute. |
| **Provider** | An external job-discovery or model vendor (ATS API, RSS board, LLM endpoint). Provider identity and transport live behind adapter seams; domain modules depend on contracts, not vendor URLs or SDKs. |
| **Tracker Entry** | One row in `data/applications.md` representing candidate progress on a company/role pair: status, score, report link, notes, and optional req id disambiguators. Canonical locally; mirrored in hosted storage via the repository adapter. |

## Layering (summary)

- **Entry facades** — stable root scripts (`scan.mjs`, evaluators, tracker writers) and Next.js routes; parse CLI/HTTP only.
- **Modules** — deep domain logic under `lib/` and `dashboard-web/lib/`; import-safe, no top-level side effects.
- **Seams** — narrow interfaces where two adapters must exist before abstraction (LLM gateway, repositories, discovery providers, document generators).
- **Adapters** — local files, Supabase hosted storage, OpenAI-compatible HTTP, Gemini SDK, browser transport, etc.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the upstream component map and [docs/adr/](docs/adr/) for fork decisions.

## Current System

Career-Ops is a modular monolith with two runtime shapes:

1. **Local-first CLI/TUI** — files under one workspace are canonical. Stable root scripts parse CLI arguments and delegate to deep modules under `lib/`.
2. **Hosted Next.js application** — Clerk authenticates the request, Supabase RLS isolates tenant documents/jobs, and a separate worker executes scan, evaluation, and PDF workloads. Supabase is an adapter, not a second domain model.

The Go TUI under `dashboard/` and the Next.js app under `dashboard-web/` consume the same tracker contract in `templates/tracker-contract.json`.

## Non-Negotiable Invariants

- Keep root entrypoints stable. Move behavior behind them; do not rename or relocate commands used by users, plugins, or the updater.
- Files remain canonical in local mode. Hosted repositories must preserve the same logical paths and document formats.
- `modes/*.md` own evaluation/scoring truth. Provider code must not duplicate prompt policy.
- LLM calls go through `lib/llm/`; vendor transport belongs only in `lib/llm/adapters/`.
- Tenant HTTP requests use Clerk JWT + Supabase anon clients. Service-role credentials are worker/admin only.
- Long-running web work goes through the workload seam. Routes validate, enqueue/invoke, and translate results.
- Job-posting text is untrusted data. Browser liveness is the final authority; private/internal network targets are blocked.
- Tracker transitions update the tracker, report frontmatter, and status ledger as one logical mutation.
- Every real Seam needs at least two Adapters and shared contract tests.
- Never submit an application or send a message without explicit human review.

## Module Map

| Module | Responsibility | Stable facades / consumers |
|---|---|---|
| `lib/llm/` | Routing, adapters, retry/timeout, pricing, usage, telemetry, budgets | `openai-eval.mjs`, `gemini-eval.mjs`, `ollama-eval.mjs`, web evaluation jobs |
| `lib/evaluation/` | Context, validation, score parsing, report/tracker persistence | Root evaluator scripts, `dashboard-web/lib/evaluation-bridge.js` |
| `lib/discovery/` | Scan pipeline, ATS identity, liveness, browser transport, structured results | `scan.mjs`, `scan-ats-full.mjs`, `check-liveness.mjs`, scan jobs |
| `lib/documents/` | ATS normalization, HTML/Playwright and LaTeX generation, PDF index | `generate-pdf.mjs`, `generate-latex.mjs`, web PDF workload |
| `lib/tracker/` | Shared tracker contract, row mutation, transitions, status log | `set-status.mjs`, Go bridge, Next state service |
| `lib/profile/` | Typed/defaulted profile reads | `profile-language.mjs`, evaluation, batch, dashboard bridges |
| `lib/batch/` | Batch state and Claude/Codex/OpenCode worker adapters | `batch/batch-runner.sh` |
| `lib/reports/` | Report parsing/frontmatter/slugging | CLI and Next report services |
| `lib/path-roots.mjs` | System/workspace path catalog | All local and tenant materialization paths |
| `dashboard-web/lib/tenant-services.js` | Request-scoped hosted composition root | Next pages and API routes |
| `dashboard-web/lib/services/workload-runner.js` | Local-inline vs hosted-queue execution seam | Scan, evaluation, PDF routes |
| `dashboard-web/lib/worker/` | Lease-safe background execution and tenant materialization | `npm run worker` |

## Main Runtime Flows

### Evaluation

`root/web facade → Evaluation Pipeline → LLM Gateway → provider Adapter → validation → report + tracker + Usage Record`

URL-only web evaluations first pass through the SSRF-safe Playwright posting reader. Hosted execution materializes the tenant workspace, runs the same pipeline as local mode, then synchronizes only declared artifacts.

### Discovery

`scan facade → Provider registry → Scan Pipeline → filters/dedupe → browser verification (when required) → ScanResult → pipeline/history sinks`

Provider identity belongs in `lib/discovery/ats-identity.mjs`; do not add another ATS URL registry.

### Hosted Work

`Clerk request → request-scoped tenant services → tenant Supabase client → enqueue background_jobs → worker claim/heartbeat → workload → structured result`

Worker transitions are lease-owner scoped. Retry exhaustion produces `dead_letter`; stale jobs are reclaimed using the latest heartbeat.

### Tracker Transition

`UI/CLI/Go facade → canonical transition → tracker row + report frontmatter + status-log.tsv`

Node and Go state names/aliases come from `templates/tracker-contract.json`.

## Where to Make Changes

- Provider/model support: add an Adapter in `lib/llm/adapters/`, then run LLM contract tests.
- New ATS source: extend the existing provider registry and reverse metadata; reuse ATS identity.
- New long-running web operation: add a workload/job type, worker executor, structured result, polling coverage, and tenant-denial tests.
- New generated format: add a document Adapter; keep root/web facades thin.
- New tracker state/alias: update `templates/states.yml`, regenerate/validate `templates/tracker-contract.json`, and run Node + Go tests.
- New tenant document: add it to repository contracts and materialization/sync allowlists.
- Architecture decision: add or amend an ADR under `docs/adr/`; do not encode policy only in comments.

## Required Validation

Run sequentially before handoff:

```bash
node test-all.mjs
cd dashboard-web && npm test
cd dashboard-web && npm run build
cd dashboard && go test ./...
node validate-system-paths-coverage.mjs
git diff --check
```

Do not run `test-all.mjs` while the Next build is mutating `.next/`.

## Maintainer Reading Order

1. `AGENTS.md` — safety, data contract, product behavior.
2. This file — current domain and module map.
3. `ARCHITECTURE.md` and `docs/ARCHITECTURE.md` — design and runtime flows.
4. `docs/adr/` — accepted decisions.
5. `dashboard-web/AGENTS.md` or `lib/AGENTS.md` when editing those trees.
6. `docs/PRODUCTION_RUNBOOK.md` and `docs/RLS_CLERK_SETUP.md` for hosted operations.
