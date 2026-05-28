# Fork Layer

This fork adds a hosted web interface on top of upstream Career-Ops. The fork layer keeps that web work separate from upstream system files so `update-system.mjs` can still pull improvements from the original repo without silently breaking hosted seams.

## Fork-Owned Paths

- `dashboard-web/`
- `lib/path-roots.mjs`
- `docs/HOSTED_VERCEL_READINESS.md`
- `docs/FORK_LAYER.md`

## Update Rule

Upstream updates may refresh system files, but they must not automatically replace fork-owned paths. If upstream later adds a file with the same path as a fork-owned file, review the conflict manually.

## Update Checklist

After applying an upstream update on a clean branch:

1. Run `npm test` in `dashboard-web`.
2. Run `npm run build` in `dashboard-web`.
3. Verify scripts still honor `CAREER_OPS_DATA_ROOT`.
4. Review any changed root scripts that the web app invokes.
5. Keep `dashboard-web/LEGACY.md` as the boundary for old Express paths.
