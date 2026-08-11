import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { LocalCareerOpsRepository } from '../lib/repositories/local-career-ops-repository';
import { CareerOpsDataClient } from '../lib/data/career-ops-data-client';
import { createSetupService } from '../lib/services/setup-service';
import {
  buildPortalsYaml,
  buildProfileYaml,
  buildSearchQueries,
  createOnboardingService,
  isOnboarded,
  normalizeAnswers,
  resolveKeywords,
  validateAnswers
} from '../lib/services/onboarding-service';

function makeService() {
  const rootPath = mkdtempSync(join(tmpdir(), 'career-ops-onboarding-'));
  const repository = new LocalCareerOpsRepository({ tenantId: 'tenant-a', rootPath });
  const dataClient = new CareerOpsDataClient(repository);
  const setup = createSetupService(dataClient);
  return { service: createOnboardingService({ dataClient, setup }), dataClient };
}

const VANCOUVER_ANSWERS = {
  fullName: 'Jordan Lee',
  email: 'jordan@example.com',
  location: { city: 'Vancouver', region: 'BC', country: 'Canada' },
  workModes: ['remote', 'hybrid'],
  roleFocus: ['ai-ml'],
  customKeywords: 'Founding Engineer',
  seniority: ['Senior', 'Staff'],
  compensation: { currency: 'CAD', minimum: '$140K', target: '$180K' }
};

describe('onboarding service — config generation', () => {
  it('builds profile YAML capturing location, work modes, and keywords', () => {
    const yamlText = buildProfileYaml(normalizeAnswers(VANCOUVER_ANSWERS));
    const parsed = yaml.load(yamlText);

    expect(parsed.candidate.full_name).toBe('Jordan Lee');
    expect(parsed.location.city).toBe('Vancouver');
    expect(parsed.location.work_modes).toEqual(['remote', 'hybrid']);
    expect(parsed.target_roles.primary).toContain('LLM');
    expect(parsed.target_roles.primary).toContain('Founding Engineer');
    expect(parsed.onboarding.completed).toBe(true);
  });

  it('builds portals YAML with role keywords, location-aware queries, and tracked companies', () => {
    const yamlText = buildPortalsYaml(normalizeAnswers(VANCOUVER_ANSWERS));
    const parsed = yaml.load(yamlText);

    expect(parsed.title_filter.positive).toContain('AI');
    expect(parsed.title_filter.negative).toContain('Junior');
    expect(parsed.title_filter.seniority_boost).toEqual(['Senior', 'Staff']);
    expect(parsed.location_preferences.city).toBe('Vancouver');
    expect(Array.isArray(parsed.tracked_companies)).toBe(true);
  });

  it('creates remote and city-targeted search queries', () => {
    const queries = buildSearchQueries(normalizeAnswers(VANCOUVER_ANSWERS));
    const joined = queries.map(query => query.query).join('\n');

    expect(joined).toContain('remote');
    expect(joined).toContain('Vancouver');
  });

  it('resolves keywords from presets plus custom entries', () => {
    const keywords = resolveKeywords(
      normalizeAnswers({ roleFocus: ['product'], customKeywords: 'GTM, GTM, Growth' })
    );
    expect(keywords).toContain('Product Manager');
    expect(keywords).toContain('GTM');
    expect(keywords.filter(keyword => keyword === 'GTM')).toHaveLength(1);
  });

  it('supports non-tech industry presets', () => {
    expect(resolveKeywords(normalizeAnswers({ roleFocus: ['healthcare'] }))).toContain('Registered Nurse');
    expect(resolveKeywords(normalizeAnswers({ roleFocus: ['education'] }))).toContain('Teacher');
    expect(resolveKeywords(normalizeAnswers({ roleFocus: ['trades'] }))).toContain('Electrician');
    expect(resolveKeywords(normalizeAnswers({ roleFocus: ['dental'] }))).toContain('Dental Hygienist');
  });

  it('does not seed the tech company list for non-tech users', () => {
    const parsed = yaml.load(
      buildPortalsYaml(
        normalizeAnswers({ workModes: ['onsite'], roleFocus: ['dental'], location: { city: 'Osaka', country: 'Japan' } })
      )
    );
    expect(parsed.tracked_companies).toEqual([]);
  });

  it('still seeds tracked companies for tech users', () => {
    const parsed = yaml.load(buildPortalsYaml(normalizeAnswers(VANCOUVER_ANSWERS)));
    expect(Array.isArray(parsed.tracked_companies)).toBe(true);
  });

  it('adds a portal-agnostic web query for non-tech reach', () => {
    const queries = buildSearchQueries(
      normalizeAnswers({ workModes: ['remote'], roleFocus: ['healthcare'], location: { country: 'Canada' } })
    );
    expect(queries.some(query => query.name.startsWith('Web —'))).toBe(true);
    expect(queries.some(query => /Registered Nurse/.test(query.query))).toBe(true);
  });
});

describe('onboarding service — validation', () => {
  it('requires a work mode, a role, and a location', () => {
    expect(() => validateAnswers(normalizeAnswers({}))).toThrow();
  });

  it('requires a city for hybrid or on-site roles', () => {
    expect(() =>
      validateAnswers(
        normalizeAnswers({ workModes: ['onsite'], roleFocus: ['software'], location: { country: 'Canada' } })
      )
    ).toThrow(/city/i);
  });

  it('accepts a complete remote answer set', () => {
    expect(() =>
      validateAnswers(
        normalizeAnswers({ workModes: ['remote'], roleFocus: ['software'], location: { country: 'Canada' } })
      )
    ).not.toThrow();
  });
});

describe('onboarding service — state and completion', () => {
  it('reports needsOnboarding until completed', async () => {
    const { service, dataClient } = makeService();

    expect(service.getState().needsOnboarding).toBe(true);

    await service.complete(VANCOUVER_ANSWERS);

    expect(isOnboarded(dataClient.readProfile())).toBe(true);
    expect(service.getState().needsOnboarding).toBe(false);
  });

  it('writes profile, portals, and an empty pipeline', async () => {
    const { service, dataClient } = makeService();

    const result = await service.complete(VANCOUVER_ANSWERS);

    expect(result.completed).toBe(true);
    expect(dataClient.readProfile()).toContain('Vancouver');
    expect(dataClient.readPortals()).toContain('title_filter');
    expect(dataClient.readPipeline()).toContain('## Pending');
  });

  it('prefills answers when re-running onboarding', async () => {
    const { service } = makeService();
    await service.complete(VANCOUVER_ANSWERS);

    const { answers } = service.getState();
    expect(answers.location.city).toBe('Vancouver');
    expect(answers.workModes).toContain('remote');
    expect(answers.roleFocus).toContain('ai-ml');
  });
});
