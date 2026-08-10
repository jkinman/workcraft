import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { LocalCareerOpsRepository } from '../lib/repositories/local-career-ops-repository';
import { CareerOpsDataClient } from '../lib/data/career-ops-data-client';
import { createReportService } from '../lib/services/report-service';
import { createPipelineService } from '../lib/services/pipeline-service';
import { createScanService } from '../lib/services/scan-service';
import { createSetupService } from '../lib/services/setup-service';
import { createOnboardingService } from '../lib/services/onboarding-service';
import { buildChecklist, derivePrimaryAction, getHomeModel, timeGreeting } from '../lib/services/home-service';

function makeServices() {
  const rootPath = mkdtempSync(join(tmpdir(), 'career-ops-home-'));
  const repository = new LocalCareerOpsRepository({ tenantId: 'tenant-a', rootPath });
  const dataClient = new CareerOpsDataClient(repository);
  const setup = createSetupService(dataClient);
  const services = {
    dataClient,
    reports: createReportService(dataClient),
    pipeline: createPipelineService(dataClient),
    scan: createScanService(dataClient),
    setup
  };
  services.onboarding = createOnboardingService(services);
  return services;
}

const COMPLETE_ANSWERS = {
  workModes: ['remote'],
  roleFocus: ['software'],
  location: { country: 'Canada', city: 'Vancouver' }
};

describe('home service — pure derivations', () => {
  it('greets based on time of day', () => {
    expect(timeGreeting(new Date('2026-01-01T09:00:00'))).toBe('Good morning');
    expect(timeGreeting(new Date('2026-01-01T20:00:00'))).toBe('Good evening');
  });

  it('prioritizes onboarding, then resume, then leads', () => {
    expect(
      derivePrimaryAction({ needsOnboarding: true, files: {}, hasLeads: false }).id
    ).toBe('onboarding');
    expect(
      derivePrimaryAction({ needsOnboarding: false, files: { cv: false }, hasLeads: false }).id
    ).toBe('resume');
    expect(
      derivePrimaryAction({ needsOnboarding: false, files: { cv: true }, hasLeads: false }).id
    ).toBe('scan');
  });

  it('surfaces queue and apply actions when there are leads', () => {
    expect(
      derivePrimaryAction({ needsOnboarding: false, files: { cv: true }, hasLeads: true, pendingJobs: 3 }).id
    ).toBe('evaluate');
    expect(
      derivePrimaryAction({
        needsOnboarding: false,
        files: { cv: true },
        hasLeads: true,
        pendingJobs: 0,
        unappliedPriority: 2
      }).id
    ).toBe('apply');
  });

  it('marks checklist items done based on files and leads', () => {
    const checklist = buildChecklist({ files: { cv: true, profile: true, portals: true }, hasLeads: false });
    const byId = Object.fromEntries(checklist.map(item => [item.id, item.done]));
    expect(byId.search).toBe(true);
    expect(byId.resume).toBe(true);
    expect(byId.leads).toBe(false);
  });
});

describe('home service — model', () => {
  it('flags a brand new tenant as needing onboarding', () => {
    const services = makeServices();
    const model = getHomeModel(services);

    expect(model.needsOnboarding).toBe(true);
    expect(model.primaryAction.id).toBe('onboarding');
    expect(model.stats.total).toBe(0);
  });

  it('moves to resume action after onboarding completes', async () => {
    const services = makeServices();
    await services.onboarding.complete(COMPLETE_ANSWERS);

    const model = getHomeModel(services);

    expect(model.needsOnboarding).toBe(false);
    expect(model.primaryAction.id).toBe('resume');
    expect(model.checklist.find(item => item.id === 'search').done).toBe(true);
  });
});
