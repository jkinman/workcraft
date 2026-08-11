# Fork Layer

This fork adds a hosted web interface on top of upstream Career-Ops. The fork layer keeps that web work separate from upstream system files so `update-system.mjs` can still pull improvements from the original repo without silently breaking hosted seams.

## Fork-Owned Paths

- `README.md`, `AGENTS.md`, `CONTEXT.md`, `ARCHITECTURE.md`
- `dashboard-web/`
- `dashboard/AGENTS.md`
- `lib/AGENTS.md`
- `lib/path-roots.mjs`
- `lib/filesystem-lock.mjs`
- `lib/llm/`
- `lib/evaluation/`
- `lib/discovery/`
- `lib/profile/`
- `lib/tracker/`
- `lib/documents/`
- `lib/batch/`
- `lib/reports/`
- `lib/scrapers/`
- `docs/adr/`
- `docs/ARCHITECTURE.md`
- `docs/HOSTED_VERCEL_READINESS.md`
- `docs/FORK_LAYER.md`
- `docs/PRODUCTION_RUNBOOK.md`
- `docs/RLS_CLERK_SETUP.md`

## Update Rule

Upstream updates may refresh system files, but they must not automatically replace fork-owned paths. If upstream later adds a file with the same path as a fork-owned file, review the conflict manually.

`AGENTS.md` and `README.md` are protected because they now describe safety and runtime contracts that differ materially from upstream. During an upstream upgrade, manually review upstream changes to those two files and port applicable product behavior without removing the fork maintainer context.

## Update Checklist

After applying an upstream update on a clean branch:

1. Run `npm test` in `dashboard-web`.
2. Run `npm run build` in `dashboard-web`.
3. Verify scripts still honor `CAREER_OPS_DATA_ROOT`.
4. Review any changed root scripts that the web app invokes.
5. Keep `dashboard-web/LEGACY.md` as the boundary for old Express paths.
6. Compare upstream `AGENTS.md` and `README.md` manually; they are intentionally fork-owned.
7. Run `node validate-system-paths-coverage.mjs`.
