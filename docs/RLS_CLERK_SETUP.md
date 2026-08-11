# Clerk JWT + Supabase RLS Setup

Tenant isolation for hosted mode: ordinary authenticated requests use the Supabase **anon key** with a Clerk-issued JWT. The **service role** is reserved for the background worker and admin scripts only.

## Clerk JWT tenant claim

Career-Ops expects the Supabase RLS helper `auth_tenant_id()` to read:

```json
{
  "sub": "user_abc123",
  "tenant_id": "user_abc123"
}
```

Use the same stable identifier for both fields unless you operate org-based tenancy (then set `tenant_id` to the org id).

### Clerk Dashboard steps (no secrets)

1. Open **Clerk Dashboard → Configure → Sessions → Customize session token** (or JWT templates, depending on Clerk version).
2. Add a custom claim to the session token / JWT template:

   ```json
   {
     "tenant_id": "{{user.id}}"
   }
   ```

   For organization tenancy, use `"tenant_id": "{{org.id}}"` and require active organization in your app.

3. Configure a Clerk **JWT template** for Supabase (Clerk Dashboard → JWT templates) and set in hosted production:

   - `CLERK_SUPABASE_JWT_TEMPLATE` (preferred), or
   - `SUPABASE_JWT_TEMPLATE`

   The Next.js request path resolves the token via `auth().getToken({ template })` and passes it to `createSupabaseUserClient()` (see `dashboard-web/lib/auth/supabase-session.js`).

4. Ensure the Next.js app passes this JWT to Supabase via `Authorization: Bearer <clerk_session_jwt>` when using `createSupabaseUserClient()` (see `dashboard-web/lib/repositories/supabase-client.js`).

5. Map Clerk `userId` to dashboard tenant context — already handled by `clerkAuthToTenantRequest()` (`auth.tenantId = userId`).

### Verification

- Decode a session JWT (jwt.io or Clerk debug tools) and confirm `tenant_id` is present.
- With RLS policies applied, a user JWT must only `select` rows where `tenant_id = auth_tenant_id()`.

## Supabase migration steps

1. Run `dashboard-web/supabase/schema.sql` in the SQL editor.
2. Confirm policies exist:

   - `tenant_documents_tenant_*`
   - `background_jobs_tenant_*`
   - `storage_objects_tenant_*`

3. Set session storage bucket for storage policies (per request or via Supabase config):

   ```sql
   -- Example: set before tenant storage operations in server handler
   select set_config('app.settings.storage_bucket', 'career-ops-files', true);
   ```

4. Configure Supabase to accept Clerk as a third-party JWT provider **or** pass Clerk JWT directly in `Authorization` header with anon key (current app pattern).

## Service role guard

Application code must not use `createSupabaseServerClient()` (service role) in tenant HTTP handlers.

Runtime guard:

```javascript
const { assertServiceRoleAllowed } = require('./supabase-client');
assertServiceRoleAllowed(client, { context: 'GET /api/...' });
```

Allowed contexts:
- `dashboard-web/scripts/run-worker.mjs`
- Admin/maintenance scripts (explicit `allowServiceRole: true`)

## Cross-tenant denial expectations

| Operation | Tenant A JWT | Tenant B JWT |
|-----------|--------------|--------------|
| Read `tenant_documents` | Own rows only | Denied (empty) |
| Insert document | `tenant_id` must match JWT | Denied |
| Poll `background_jobs` | Own jobs via app filter + RLS | Denied |
| Storage download | `{tenant_id}/...` prefix | Denied |

Integration-fake tests: `dashboard-web/test/rls-policy.test.js`.

## Rollout checklist

- [ ] Clerk JWT template includes `tenant_id`
- [ ] Schema SQL applied with RLS policies
- [ ] App uses user-scoped client for tenant routes (future hardening path)
- [ ] Worker uses service role only in worker process
- [ ] Storage bucket paths use `tenantStorageKey(tenantId, relPath)`
- [ ] Run `npm test` in `dashboard-web` including RLS and hosted E2E suites

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| Empty documents after login | JWT missing `tenant_id`; RLS filters all rows |
| 403 on storage upload | Object key missing `{tenant_id}/` prefix |
| Worker cannot claim jobs | Service role key missing or wrong Supabase URL |
| Tenant sees another tenant's job | Application bug — verify `getForTenant` filter; never trust client-supplied tenant id over JWT |
