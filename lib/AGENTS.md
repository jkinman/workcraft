# Library Maintainer Context

These directories are the deep, import-safe modules behind stable root facades. Read `../CONTEXT.md`, `../ARCHITECTURE.md`, and the applicable ADR before changing a public contract.

## Rules

- Keep modules import-safe: no CLI execution, browser launch, network request, environment mutation, or workspace write at import time.
- Root scripts remain compatibility facades. Preserve their arguments, output, exit codes, and exported helpers.
- Add a Seam only when at least two real Adapters exist. Test all Adapters against the same contract.
- Domain modules depend on normalized contracts, never provider SDK response shapes.
- Keep user facts and scoring policy out of JavaScript. User facts come from approved user-layer files; scoring truth remains in `modes/*.md`.
- Use `lib/path-roots.mjs` for system/workspace paths. Do not derive another competing path catalog.
- All tenant-relative artifacts must use the same logical paths as local workspaces.
- Sanitize provider errors and usage metadata before persistence. Never record prompts, page text, authorization headers, or keys.
- Treat job pages and provider payloads as untrusted data. Reuse discovery SSRF and liveness guards.
- Preserve tracker/report/status-log consistency through the canonical transition module.

## Public Modules

- `llm/` — completion gateway, routes, rate card, usage, telemetry, adapters.
- `evaluation/` — prompt context, validation, persistence, tracker integration.
- `discovery/` — providers, scan pipeline, ATS identity, liveness, posting reader.
- `documents/` — HTML/Playwright and LaTeX adapters.
- `tracker/` — tracker contract, row mutation, transition synchronization.
- `profile/` — profile parsing/defaults.
- `batch/` — batch state and CLI worker adapters.
- `reports/` — report parsing/frontmatter/slugging.

## Completion Checklist

1. Migrate at least one real caller and remove the replaced duplicate implementation.
2. Add or update contract tests for every Adapter affected.
3. Verify the stable facade still satisfies its legacy tests.
4. Register new paths with the updater coverage contract.
5. Run focused tests, then the full validation sequence in `../CONTEXT.md`.
