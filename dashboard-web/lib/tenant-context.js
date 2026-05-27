const DEFAULT_TENANT_ID = 'local-dev';
const TENANT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

function normalizeTenantId(value) {
  const tenantId = (value || DEFAULT_TENANT_ID).toLowerCase();
  if (!TENANT_ID_PATTERN.test(tenantId)) {
    throw new Error(`Invalid tenant id: ${tenantId}`);
  }
  return tenantId;
}

function getTenantContext(request) {
  const authTenant = getAuthTenantId(request);
  if (authTenant) {
    return buildTenantContext(authTenant, 'auth');
  }

  const headerTenant = getHeader(request, 'x-tenant-id');
  const allowDevHeader = process.env.CAREER_OPS_ALLOW_DEV_TENANT_HEADER === 'true';
  if (headerTenant) {
    if (process.env.NODE_ENV === 'production' && !allowDevHeader) {
      throw new Error('x-tenant-id is not trusted in production');
    }
    return buildTenantContext(headerTenant, 'dev-header');
  }

  if (process.env.CAREER_OPS_TENANT_ID) {
    return buildTenantContext(process.env.CAREER_OPS_TENANT_ID, 'env');
  }

  return buildTenantContext(DEFAULT_TENANT_ID, 'default');
}

function buildTenantContext(tenantId, tenantSource) {
  return {
    tenantId: normalizeTenantId(tenantId),
    tenantSource,
    mode: process.env.CAREER_OPS_TENANT_MODE || 'local-dev'
  };
}

function getHeader(request, name) {
  return request?.headers?.get?.(name) || request?.headers?.[name] || null;
}

function getAuthTenantId(request) {
  return request?.auth?.tenantId ||
    request?.session?.tenantId ||
    request?.user?.tenantId ||
    request?.tenantId ||
    null;
}

module.exports = {
  buildTenantContext,
  DEFAULT_TENANT_ID,
  getAuthTenantId,
  getTenantContext,
  getHeader,
  normalizeTenantId
};
