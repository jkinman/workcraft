# Legacy Dashboard Boundary

The canonical hosted dashboard is the Next app in `app/`. All product work uses `lib/tenant-services.js`, repository adapters, and the service/workload layer so tenant context is resolved once per request and user data stays scoped to the active tenant.

Express `server.js` and its companion modules (`views.js`, `components.js`, `evaluations.js`, `scan-data.js`, `pipeline.js`) were removed after parity verification — see [EXPRESS_PARITY.md](./EXPRESS_PARITY.md).

Remaining compatibility shims (filesystem-free logic lives under repo-root `lib/`):

- `report-parser.js` — CJS shim to `lib/reports/`
- `cv-parser.js` — CJS shim to `lib/documents/cv-parse.mjs`
- `state-manager.js` — workflow frontmatter helpers for legacy state tests

Active Next routes must pass a tenant-scoped data client; never read user-layer files from root scripts directly.
