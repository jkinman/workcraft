const { LocalCareerOpsRepository } = require('./local-career-ops-repository');
const { SupabaseRepository } = require('./supabase-repository');

async function createRepository(tenantContext = {}) {
  const mode = tenantContext.mode || 'local-dev';

  if (mode === 'hosted') {
    const repo = new SupabaseRepository({ tenantId: tenantContext.tenantId });
    await repo.initialize();
    return repo;
  }

  return new LocalCareerOpsRepository({ tenantId: tenantContext.tenantId });
}

module.exports = {
  createRepository
};
