const DEFAULT_TENANT_ID = 'local-dev';
const TENANT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

function normalizeTenantId(value) {
  const tenantId = (value || process.env.CAREER_OPS_TENANT_ID || DEFAULT_TENANT_ID).toLowerCase();
  if (!TENANT_ID_PATTERN.test(tenantId)) {
    throw new Error(`Invalid tenant id: ${tenantId}`);
  }
  return tenantId;
}

function getTenantContext(request) {
  const headerTenant = request?.headers?.get?.('x-tenant-id');
  return {
    tenantId: normalizeTenantId(headerTenant),
    mode: process.env.CAREER_OPS_TENANT_MODE || 'local-dev'
  };
}

module.exports = {
  DEFAULT_TENANT_ID,
  getTenantContext,
  normalizeTenantId
};
