# ADR 0003: Files canonical locally; Supabase as hosted Adapter

## Status

Accepted (fork)

## Context

Upstream doctrine ([#918](https://github.com/santifer/career-ops/issues/918)): git-diffable files (`data/applications.md`, `reports/`, `data/pipeline.md`) are the permanent local source of truth. SQLite is a derived index only. The hosted dashboard must serve multi-tenant workspaces without turning the database into a second canonical store that diverges from CLI and plugin readers.

## Decision

1. **Local mode:** files on disk under `CAREER_OPS_DATA_ROOT` remain authoritative. Repositories read/write those paths; derived indexes may rebuild from files.
2. **Hosted mode:** Supabase stores mirrored documents and job metadata for low-latency web access, but **repository Modules** define the contract. The Supabase adapter implements the same seams as `local-career-ops-repository.js`; it does not invent alternate field semantics.
3. **Tenant I/O boundary:** Next.js routes and pages reach tenant data only through `tenant-services.js` and `dashboard-web/lib/repositories/*`—never direct filesystem or Supabase client calls in `app/`.
4. **Materialization:** workers may hydrate local temp trees for CLI invocation; outcomes sync back through repositories, not ad hoc writes.
5. **No network microservices** for tracker/report truth—adapter swap, not service extraction.

## Consequences

- Contract tests can run the same assertions against local and Supabase repository implementations.
- Tracker mutations must eventually share one Module with CLI `set-status.mjs` / merge paths to prevent drift (follow-on work).
- `lib/path-roots.mjs` is the shared workspace path catalog for CLI and dashboard.

## References

- [DATA_CONTRACT.md](../../DATA_CONTRACT.md)
- [CONTEXT.md](../../CONTEXT.md) — Workspace, Tracker Entry, Background Job
- [docs/FORK_LAYER.md](../FORK_LAYER.md)
