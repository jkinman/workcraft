# Express → Next.js Parity Checklist

Verified on branch `dashboard-composition` — Express `server.js` retired; Next.js is the sole runtime.

| Capability | Express (legacy) | Next (canonical) | Status |
|------------|------------------|------------------|--------|
| Dashboard home | `GET /` | `app/page.jsx` | ✅ |
| Job detail | `GET /job/:slug` | `app/job/[slug]/page.jsx` | ✅ |
| Queue UI | `GET /queue` | `app/queue/page.jsx` | ✅ |
| Scan UI | `GET /scan` | `app/scan/page.jsx` | ✅ |
| Manage / onboarding | — | `app/manage/*`, `app/api/onboarding`, `app/api/setup` | ✅ |
| Queue pipeline URL | `POST /api/queue` | `app/api/queue/route.js` | ✅ |
| Run evaluation | — (CLI only) | `POST /api/evaluate/route.js` + workload | ✅ |
| Scan | `POST /api/scan` (inline) | `app/api/scan/route.js` → workload | ✅ |
| PDF generation | `POST /api/generate-*` (inline) | `app/api/generate-*/route.js` → workload | ✅ |
| PDF download | `GET /download-pdf` | `app/download-pdf/route.js` | ✅ |
| State transition | `POST /api/transition-state` | `app/api/transition-state/route.js` | ✅ |
| Job polling | — | `GET /api/jobs/[jobId]/route.js` | ✅ |
| Health | `GET /health` | `app/api/health/route.js` | ✅ |
| Location search helper | `POST /api/search-location` | `app/manage/search/page.jsx` (static sources) | ✅ (UI equivalent) |
| Tenant isolation | filesystem only | `lib/tenant-services.js` + repositories | ✅ |
| Background worker | — | `scripts/run-worker.mjs` (scan, pdf, evaluation) | ✅ |

Long-running work (scan, PDF, evaluation) is **never** executed directly in HTTP handlers — all routes authenticate/validate, enqueue or invoke `services.runner`, and return structured results for polling.
