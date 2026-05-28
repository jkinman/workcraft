import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import tenantContext from '../lib/tenant-context';
import clerkAdapter from '../lib/auth/clerk-adapter';

const { getTenantContext, normalizeTenantId } = tenantContext;
const { clerkAuthToTenantRequest } = clerkAdapter;

describe('tenant context', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = {
      CAREER_OPS_ALLOW_DEV_TENANT_HEADER: process.env.CAREER_OPS_ALLOW_DEV_TENANT_HEADER,
      CAREER_OPS_TENANT_ID: process.env.CAREER_OPS_TENANT_ID,
      CAREER_OPS_TENANT_MODE: process.env.CAREER_OPS_TENANT_MODE,
      NODE_ENV: process.env.NODE_ENV
    };
    delete process.env.CAREER_OPS_ALLOW_DEV_TENANT_HEADER;
    delete process.env.CAREER_OPS_TENANT_ID;
    delete process.env.CAREER_OPS_TENANT_MODE;
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
    expect(normalizeTenantId('user_123')).toBe('user_123');
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

  it('maps Clerk auth user ids into trusted tenant requests', () => {
    const context = getTenantContext(clerkAuthToTenantRequest({ userId: 'user_123' }));

    expect(context.tenantId).toBe('user_123');
    expect(context.tenantSource).toBe('auth');
  });

  it('fails closed in hosted production without auth', () => {
    process.env.NODE_ENV = 'production';
    process.env.CAREER_OPS_TENANT_MODE = 'hosted';

    expect(() => getTenantContext()).toThrow('Authentication required for hosted tenant resolution');
  });
});
