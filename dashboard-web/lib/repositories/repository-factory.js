const { LocalCareerOpsRepository } = require('./local-career-ops-repository');
const { SupabaseRepository } = require('./supabase-repository');
const { assertServiceRoleAllowed } = require('./supabase-client');

let supabaseInitializeCount = 0;

function getSupabaseInitializeCount() {
  return supabaseInitializeCount;
}

function resetSupabaseInitializeCount() {
  supabaseInitializeCount = 0;
}

async function createRepository(tenantContext = {}) {
  const mode = tenantContext.mode || 'local-dev';

  if (mode === 'hosted') {
    if (!tenantContext.supabaseClient) {
      throw new Error('Hosted repository requires tenantContext.supabaseClient — inject Clerk JWT client at composition root');
    }
    assertServiceRoleAllowed(tenantContext.supabaseClient, { context: 'createRepository' });
    const repo = new SupabaseRepository({
      tenantId: tenantContext.tenantId,
      client: tenantContext.supabaseClient,
      env: tenantContext.env,
    });
    supabaseInitializeCount += 1;
    await repo.initialize();
    return repo;
  }

  return new LocalCareerOpsRepository({
    tenantId: tenantContext.tenantId,
    rootPath: tenantContext.rootPath,
  });
}

module.exports = {
  createRepository,
  getSupabaseInitializeCount,
  resetSupabaseInitializeCount,
};
