import { describe, expect, it } from 'vitest';
import { createRepository } from '../lib/repositories/repository-factory';

describe('repository factory', () => {
  it('uses the local filesystem repository by default', () => {
    expect(createRepository({ tenantId: 'tenant-a' }).constructor.name).toBe('LocalCareerOpsRepository');
  });

  it('uses the hosted repository placeholder in hosted mode', () => {
    const repository = createRepository({ tenantId: 'tenant-a', mode: 'hosted' });

    expect(repository.constructor.name).toBe('HostedCareerOpsRepository');
    expect(() => repository.readText()).toThrow('HostedCareerOpsRepository is not implemented yet');
  });
});
