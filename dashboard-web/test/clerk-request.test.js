import { describe, expect, it } from 'vitest';
import clerkRequest from '../lib/auth/clerk-request';

const { getAuthenticatedTenantRequest, isClerkConfigured } = clerkRequest;

describe('Clerk request adapter', () => {
  it('is disabled unless both Clerk server and public keys are present', () => {
    expect(isClerkConfigured({})).toBe(false);
    expect(isClerkConfigured({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_x' })).toBe(false);
    expect(isClerkConfigured({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_x',
      CLERK_SECRET_KEY: 'sk_test_x'
    })).toBe(true);
  });

  it('preserves the existing request when Clerk is not configured', async () => {
    const request = { headers: new Headers({ 'x-tenant-id': 'tenant-a' }) };

    await expect(getAuthenticatedTenantRequest(request, {})).resolves.toBe(request);
  });
});
