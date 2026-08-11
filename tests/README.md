# tests/

Auto-discovered test files for the career-ops suite.

## Purpose

`test-all.mjs` (repo root) is the suite runner: it executes its inline core
checks (syntax, scripts, dashboard, data contract, personal data, paths) and
then auto-discovers every `*.test.mjs` file under this directory. There is no
test framework by design — the suite must run on a fresh clone with only
Node.js (`tests/helpers.mjs`).

## Layout

- `helpers.mjs` — shared assertion helpers and counters. Exports `pass`,
  `fail`, `warn`, plus `ROOT` (repo root), `QUICK` (`--quick` flag), and
  `NODE` (current Node binary).
- `providers/{name}.test.mjs` — one file per scanner provider (see
  [providers/README.md](../providers/README.md) for the test pattern), plus
  shared cross-provider tests such as `ats-ssrf-hardening.test.mjs`.
  Underscore-prefixed files (e.g. `_html-entities.test.mjs`) test shared
  helper modules.
- Other `*.test.mjs` files at this level (e.g. `stats.test.mjs`) cover root
  scripts. Note: standalone `*.test.mjs` files in the repo root are run by
  `test-all.mjs`'s inline script list, not by this directory's discovery.
- `llm/` — routing, retry/fallback, pricing, sanitization, usage, and adapter
  behavior.
- `evaluation/` — evaluation pipeline, URL/endpoint guards, source URL, and
  facade compatibility.
- `discovery/` — scan pipeline, ATS identity, liveness, posting reader, and
  human-output golden tests.
- `reports/` — report parsing, frontmatter, state normalization, and dashboard
  bridge parity.
- `seams/` — cross-adapter contracts for LLM, discovery, liveness, batch CLI,
  and generated documents.

The hosted adapter has a separate Vitest suite under `dashboard-web/test/`.
It owns route behavior, request-scoped tenancy, repository parity, worker
leases/retries, RLS contracts, materialization, and two-tenant E2E fakes.
The Go tracker/TUI tests live under `dashboard/`.

## Running

```bash
node test-all.mjs                            # full suite — run before pushing
node test-all.mjs --quick                    # full suite, skip dashboard build
node test-all.mjs --only providers/themuse   # only matching tests/ files
```

Discovery walks `tests/` recursively, sorted lexicographically for a
deterministic cross-OS order. `--only` filters on the tests-relative path and
exits 1 when nothing matches (so a typo cannot turn CI green).

**`--only` is a dev convenience, not a PR gate:** it skips every inline core
section of `test-all.mjs`. A green `--only` run is not a green suite — always
run the full `node test-all.mjs` before pushing.

Run the complete modular-monolith gate sequentially:

```bash
node test-all.mjs
cd dashboard-web && npm test
cd dashboard-web && npm run build
cd dashboard && go test ./...
node validate-system-paths-coverage.mjs
git diff --check
```

Do not run `test-all.mjs` concurrently with the Next build.

## CI ownership

- `.github/workflows/test.yml` runs the root suite and Go tests on the
  cross-platform matrix.
- `.github/workflows/web-ci.yml` runs `dashboard-web` Vitest and the production
  Next build on changes to the hosted adapter or shared modules it composes.
- CV visual rendering has its own browser-enabled job.

Hosted repository, worker, Clerk, Supabase, LLM, ATS, browser, and compiler
tests use deterministic fakes or injected adapters. These tests prove
application contracts, but they do not prove a deployed Clerk claim template,
Supabase migration, storage policy, or cloud secret configuration. Complete
the staging checks in `docs/PRODUCTION_RUNBOOK.md` before production rollout.

## Critical invariant coverage

- Stable facades, import safety, provider-call boundaries, and thin Next routes:
  `dashboard-web/test/architecture-contract.test.js` and boundary tests.
- Local files plus hosted repository parity:
  `dashboard-web/test/repository-contract.test.js`,
  `workflow-libraries.contract.test.js`, and `hosted-e2e.test.js`.
- Prompt/scoring ownership and evaluation behavior:
  `tests/evaluation/`, `tests/output-language.test.mjs`, and the core
  A–G contract checks in `test-all.mjs`.
- Provider-neutral LLM routing, fallback, budgets, pricing, sanitization, and
  usage: `tests/llm/`, `tests/seams/llm-adapters.contract.test.mjs`, and
  `dashboard-web/test/llm-observability.test.js`.
- Tenant JWT/service-role/RLS isolation:
  `tenant-supabase-client.test.js`, `rls-policy.test.js`, and
  `hosted-e2e.test.js`.
- Long-running workload and lease semantics:
  route tests, `background-jobs-repository-contract.test.js`,
  `worker-runner-repository-contract.test.js`, and
  `worker-resilience.test.js`.
- Untrusted posting input, SSRF, and browser-final liveness:
  `tests/evaluation/url-validation.test.mjs`, `tests/discovery/`, and
  `tests/seams/liveness.contract.test.mjs`.
- Tracker/report/status-ledger consistency across Node and Go:
  `set-status-tests.mjs`, `workflow-libraries.contract.test.js`, and
  `dashboard/internal/data/tracker_contract_test.go`.
- Multi-adapter seam behavior:
  `tests/seams/` plus repository contracts in `dashboard-web/test/`.

## Adding a test

Add one `{name}.test.mjs` file here — it is auto-discovered, no registration
needed. Do not add a section to `test-all.mjs`. Import the helpers with a
path relative to the test file's location:

```js
import { pass, fail, ROOT } from './helpers.mjs';    // tests/*.test.mjs
import { pass, fail, ROOT } from '../helpers.mjs';   // tests/providers/*.test.mjs
```

See `CONTRIBUTING.md` for the full contribution flow.
