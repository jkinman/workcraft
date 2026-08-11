function requireSupabaseConfig(env = process.env) {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase storage adapter requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  return { url, serviceRoleKey };
}

function requireSupabaseAnonConfig(env = process.env) {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Tenant-scoped Supabase client requires SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  return { url, anonKey };
}

function markClientRole(client, role) {
  Object.defineProperty(client, '__careerOpsClientRole', {
    value: role,
    enumerable: false,
    configurable: true,
  });
  return client;
}

function createSupabaseServerClient(env = process.env) {
  const { createClient } = require('@supabase/supabase-js');
  const { url, serviceRoleKey } = requireSupabaseConfig(env);

  return markClientRole(createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'x-career-ops-client': 'service-role',
      },
    },
  }), 'service-role');
}

/**
 * Tenant-scoped client using a Clerk-issued JWT. RLS policies enforce isolation.
 *
 * @param {string} clerkJwt
 * @param {Record<string, string>} [env]
 */
function createSupabaseUserClient(clerkJwt, env = process.env) {
  if (!clerkJwt) {
    throw new Error('createSupabaseUserClient requires a Clerk JWT');
  }
  const { createClient } = require('@supabase/supabase-js');
  const { url, anonKey } = requireSupabaseAnonConfig(env);

  return markClientRole(createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${clerkJwt}`,
        'x-career-ops-client': 'tenant-user',
      },
    },
  }), 'tenant-user');
}

/**
 * Runtime guard — service role must never be used from browser-facing request handlers.
 *
 * @param {object} client
 * @param {{ allowServiceRole?: boolean, context?: string }} [options]
 */
function assertServiceRoleAllowed(client, options = {}) {
  if (options.allowServiceRole) return;
  const role = client?.__careerOpsClientRole
    || client?.rest?.headers?.['x-career-ops-client'];
  if (role === 'service-role') {
    throw new Error(
      `Service-role Supabase client blocked in ${options.context || 'tenant request'} — use createSupabaseUserClient`,
    );
  }
}

module.exports = {
  assertServiceRoleAllowed,
  createSupabaseServerClient,
  createSupabaseUserClient,
  requireSupabaseAnonConfig,
  requireSupabaseConfig,
};
