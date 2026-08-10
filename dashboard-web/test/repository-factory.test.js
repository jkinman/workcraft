import { describe, expect, it } from 'vitest';
import { createRepository } from '../lib/repositories/repository-factory';

describe('repository factory', () => {
  it('uses the local filesystem repository by default', async () => {
    const repo = await createRepository({ tenantId: 'tenant-a' });
    expect(repo.constructor.name).toBe('LocalCareerOpsRepository');
  });

  it('rejects in hosted mode without Supabase credentials', async () => {
    // In real hosted mode this would fail at construction time (missing env vars).
    // The factory routes to SupabaseRepository — credentials required at runtime.
    await expect(createRepository({ tenantId: 'tenant-a', mode: 'hosted' })).rejects.toThrow(
      'Supabase storage adapter requires'
    );
  });
});
