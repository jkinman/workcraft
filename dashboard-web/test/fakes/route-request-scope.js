import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { vi } from 'vitest';

const require = createRequire(import.meta.url);
const dashboardRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const mockGetTenantServices = vi.fn();

vi.mock('../../lib/tenant-services', () => ({
  default: {
    getTenantServices: (...args) => mockGetTenantServices(...args),
  },
}));

export function resetDashboardRequireCache() {
  for (const key of Object.keys(require.cache)) {
    if (key.includes('/dashboard-web/')) {
      delete require.cache[key];
    }
  }
}

export async function loadRoute(routeRelPath) {
  vi.resetModules();
  resetDashboardRequireCache();
  const normalized = routeRelPath.replace(/^\.\.\//, '');
  return import(join(dashboardRoot, normalized));
}

/**
 * Stub request-scoped tenant services (WeakMap-style reuse on the same Request).
 */
export function stubTenantScope({ tenant = { tenantId: 'tenant-a', mode: 'local-dev' }, services = {} } = {}) {
  mockGetTenantServices.mockImplementation(async (request) => {
    if (request._tenantScope) {
      return request._tenantScope;
    }
    const scope = { tenant, services };
    request._tenantScope = scope;
    return scope;
  });
}

export function stubTenantScopeFailure(message = 'Authentication required for hosted tenant resolution') {
  mockGetTenantServices.mockRejectedValue(new Error(message));
}

export const stubAuthFailure = stubTenantScopeFailure;

export function jsonRequest(url, { method = 'GET', body, tenantId = 'tenant-a' } = {}) {
  const headers = {};
  if (tenantId) {
    headers['x-tenant-id'] = tenantId;
  }
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  return new Request(url, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

export const VALID_JOB_ID = '00000000-0000-4000-8000-000000000001';
