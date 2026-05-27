# Legacy Dashboard Boundary

The canonical hosted dashboard is the Next app in `app/`. New product work should use `lib/tenant-services.js`, `lib/data/career-ops-data-client.js`, and the service layer so tenant context is resolved once and user data stays scoped to the active tenant.

The Express dashboard in `server.js` remains available through `npm run legacy:start` for compatibility only. It still depends on legacy modules that read or write user-layer files directly:

- `pipeline.js`
- `report-parser.js`
- `scan-data.js`
- `state-manager.js`
- `pdf-generator.js`
- `cover-letter-generator.js`
- `cv-parser.js`
- `migrate-states.js`

Compatibility fallbacks in PDF helpers may also read local files when no data client is provided. Active Next routes should pass a tenant-scoped data client instead of relying on those fallbacks.
