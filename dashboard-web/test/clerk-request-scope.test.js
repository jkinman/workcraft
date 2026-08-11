import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const dashboardRoot = join(import.meta.dirname, '..');

describe('clerk request scope cache contract', () => {
  it('caches tenant services on the original Request, not the authenticated clone', () => {
    const source = readFileSync(join(dashboardRoot, 'lib/tenant-services.js'), 'utf8');
    expect(source).toContain('requestServicePromises.set(request');
    expect(source).toContain('resolveTenantServices(request, tenant)');
    expect(source).not.toContain('resolveTenantServices(authenticatedRequest');
    expect(source).toContain('clerkRequest.getAuthenticatedTenantRequest');
  });
});
