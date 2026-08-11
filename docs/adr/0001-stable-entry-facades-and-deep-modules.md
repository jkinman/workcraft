# ADR 0001: Stable root entry facades with deep Modules under `lib/`

## Status

Accepted (fork)

## Context

Upstream Career-Ops keeps ~70 scripts at the repo root for path stability ([#1386](https://github.com/santifer/career-ops/issues/918)). Fork users, plugins, CI, and `update-system.mjs` `SYSTEM_PATHS` all depend on those paths. A cosmetic reorganization would break hosted recovery work and community forks without functional gain.

The hosted dashboard adds parallel implementations (tenant services, workers, Supabase mirrors). Duplication grows unless domain logic moves behind import-safe Modules while callers keep stable names.

## Decision

1. **Root scripts and documented CLI paths remain facades.** They parse arguments, load config, and delegate to Modules under `lib/` (and eventually nested package dirs). Behavior may move; filenames and invocation (`node scan.mjs`) do not.
2. **New domain depth lives in `lib/**` and `dashboard-web/lib/**`.** Modules export functions/classes only; no shebang, no unguarded `main()` at import time.
3. **Deletion test.** A Module is finished when duplicate logic is removed from facades and tests pass—not when a wrapper exists beside the old code.
4. **Composition roots.** CLI facades compose at the script bottom; the web app composes per request via `tenant-services.js` (see ADR 0003).

## Consequences

- Refactors are vertical slices: extract Module → migrate one caller → compare outputs → delete duplicate.
- Architecture contract tests guard facade presence and Module import safety.
- `SYSTEM_PATHS` / `FORK_PATHS` split stays authoritative; fork Modules (`lib/path-roots.mjs`, `lib/scrapers/`) remain fork-owned.

## References

- [ARCHITECTURE.md](../../ARCHITECTURE.md) — flat root rationale
- [CONTEXT.md](../../CONTEXT.md) — domain glossary
