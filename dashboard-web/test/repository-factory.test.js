import { describe, expect, it } from 'vitest';
import { createRepository } from '../lib/repositories/repository-factory';

describe('repository factory', () => {
  it('uses the local filesystem repository by default', async () => {
    const repo = await createRepository({ tenantId: 'tenant-a' });
    expect(repo.constructor.name).toBe('LocalCareerOpsRepository');
  });

  it('rejects in hosted mode without Supabase credentials', async () => {
    await expect(createRepository({ tenantId: 'tenant-a', mode: 'hosted' })).rejects.toThrow(
      'Supabase storage adapter requires'
    );
  });

  it('exposes storageAdapter on created repositories', async () => {
    const localRepo = await createRepository({ tenantId: 'tenant-a' });
    expect(localRepo.storageAdapter).toBe('local');
  });
});
