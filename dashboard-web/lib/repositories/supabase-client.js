function requireSupabaseConfig(env = process.env) {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase storage adapter requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  return { url, serviceRoleKey };
}

function createSupabaseServerClient(env = process.env) {
  const { createClient } = require('@supabase/supabase-js');
  const { url, serviceRoleKey } = requireSupabaseConfig(env);

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

module.exports = {
  createSupabaseServerClient,
  requireSupabaseConfig
};
