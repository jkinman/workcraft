import { describe, expect, it } from 'vitest';
import tenantContext from '../lib/tenant-context';

const { getTenantContext, normalizeTenantId } = tenantContext;

describe('tenant context', () => {
  it('defaults to local-dev', () => {
    expect(getTenantContext().tenantId).toBe('local-dev');
  });

  it('accepts lowercase hosted tenant ids', () => {
    expect(normalizeTenantId('acme-team')).toBe('acme-team');
  });

  it('rejects unsafe tenant ids', () => {
    expect(() => normalizeTenantId('../escape')).toThrow('Invalid tenant id');
  });
});
