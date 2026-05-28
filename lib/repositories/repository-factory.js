const { LocalCareerOpsRepository } = require('./local-career-ops-repository');
const { HostedCareerOpsRepository } = require('./hosted-career-ops-repository');

function createRepository(tenantContext = {}) {
  const mode = tenantContext.mode || 'local-dev';

  if (mode === 'hosted') {
    return new HostedCareerOpsRepository({ tenantId: tenantContext.tenantId });
  }

  return new LocalCareerOpsRepository({ tenantId: tenantContext.tenantId });
}

module.exports = {
  createRepository
};
