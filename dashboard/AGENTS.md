# Go Dashboard Maintainer Context

The Go TUI is a local adapter over the same canonical workspace files as the Node CLI and hosted dashboard.

- `data/applications.md`, reports, and `status-log.tsv` remain canonical.
- Load states and aliases from `templates/tracker-contract.json`; never maintain a second list in Go.
- Status changes delegate to the canonical Node transition bridge so tracker rows, report frontmatter, and the status ledger cannot diverge.
- Preserve tracker header-awareness, report-link normalization, Unicode company names, and optional columns.
- Keep the TUI usable without the hosted dashboard or Supabase.
- Do not introduce a network service to share local tracker behavior; share contract artifacts and stable CLI facades.

Run:

```bash
go test ./...
```

When tracker contracts change, also run the root and dashboard tests listed in `../CONTEXT.md`.
