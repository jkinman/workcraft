import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import tenantContext from '../lib/tenant-context';

const { getTenantContext, normalizeTenantId } = tenantContext;

describe('tenant context', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = {
      CAREER_OPS_ALLOW_DEV_TENANT_HEADER: process.env.CAREER_OPS_ALLOW_DEV_TENANT_HEADER,
      CAREER_OPS_TENANT_ID: process.env.CAREER_OPS_TENANT_ID,
      NODE_ENV: process.env.NODE_ENV
    };
    delete process.env.CAREER_OPS_ALLOW_DEV_TENANT_HEADER;
    delete process.env.CAREER_OPS_TENANT_ID;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('defaults to local-dev', () => {
    expect(getTenantContext().tenantId).toBe('local-dev');
    expect(getTenantContext().tenantSource).toBe('default');
  });

  it('accepts lowercase hosted tenant ids', () => {
    expect(normalizeTenantId('acme-team')).toBe('acme-team');
  });

  it('rejects unsafe tenant ids', () => {
    expect(() => normalizeTenantId('../escape')).toThrow('Invalid tenant id');
  });

  it('prefers trusted auth tenant claims over dev headers', () => {
    const context = getTenantContext({
      auth: { tenantId: 'auth-tenant' },
      headers: new Headers({ 'x-tenant-id': 'header-tenant' })
    });

    expect(context.tenantId).toBe('auth-tenant');
    expect(context.tenantSource).toBe('auth');
  });

  it('accepts x-tenant-id outside production for local development', () => {
    const context = getTenantContext({
      headers: new Headers({ 'x-tenant-id': 'dev-tenant' })
    });

    expect(context.tenantId).toBe('dev-tenant');
    expect(context.tenantSource).toBe('dev-header');
  });

  it('rejects raw tenant headers in production by default', () => {
    process.env.NODE_ENV = 'production';

    expect(() => getTenantContext({
      headers: new Headers({ 'x-tenant-id': 'spoofed-tenant' })
    })).toThrow('x-tenant-id is not trusted in production');
  });

  it('uses env tenant when no auth or dev header exists', () => {
    process.env.CAREER_OPS_TENANT_ID = 'env-tenant';

    const context = getTenantContext();

    expect(context.tenantId).toBe('env-tenant');
    expect(context.tenantSource).toBe('env');
  });
});
