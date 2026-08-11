const {
  assertServiceRoleAllowed,
  createSupabaseUserClient,
} = require('../repositories/supabase-client');

/**
 * Resolve Clerk → Supabase JWT using configured JWT template.
 *
 * @param {object|null|undefined} authResult - Clerk auth() result (must expose getToken).
 * @param {Record<string, string>} [env]
 * @returns {Promise<string|null>}
 */
async function resolveClerkSupabaseJwt(authResult, env = process.env) {
  if (!authResult?.getToken) return null;

  const template = env.CLERK_SUPABASE_JWT_TEMPLATE || env.SUPABASE_JWT_TEMPLATE || null;
  if (template) {
    return authResult.getToken({ template });
  }
  return authResult.getToken();
}

/**
 * Build a tenant-scoped Supabase client for hosted HTTP requests.
 * Fails closed in hosted production when JWT is missing.
 *
 * @param {object} request - Authenticated request carrying supabaseJwt when available.
 * @param {object} tenantContext - Output of getTenantContext().
 * @param {Record<string, string>} [env]
 */
function resolveTenantSupabaseClient(request, tenantContext, env = process.env) {
  if (tenantContext.mode !== 'hosted') {
    return null;
  }

  const jwt = request?.supabaseJwt || null;
  const isProductionHosted = env.NODE_ENV === 'production' || tenantContext.tenantSource === 'auth';

  if (!jwt) {
    if (isProductionHosted) {
      throw new Error('Supabase tenant JWT required for hosted requests');
    }
    return null;
  }

  const client = createSupabaseUserClient(jwt, env);
  assertServiceRoleAllowed(client, { context: 'hosted tenant composition root' });
  return client;
}

module.exports = {
  resolveClerkSupabaseJwt,
  resolveTenantSupabaseClient,
};
