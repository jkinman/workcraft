const { createRepository } = require('../repositories/repository-factory');
const { createDataClient } = require('../data/career-ops-data-client');
const { createPipelineService } = require('./pipeline-service');
const { createReportService } = require('./report-service');
const { createScanService } = require('./scan-service');
const { createSettingsService } = require('./settings-service');
const { createSetupService } = require('./setup-service');
const { createStateService } = require('./state-service');
const { createWorkloadRunner } = require('./workload-runner');
const { createOnboardingService } = require('./onboarding-service');

async function createCareerOpsServices(tenantContext) {
  const repository = await createRepository(tenantContext);
  const dataClient = createDataClient(repository);

  const services = {
    dataClient,
    repository,
    pipeline: createPipelineService(dataClient),
    reports: createReportService(dataClient),
    runner: createWorkloadRunner(dataClient, tenantContext),
    scan: createScanService(dataClient),
    settings: createSettingsService(dataClient),
    setup: createSetupService(dataClient),
    state: createStateService(dataClient)
  };

  services.onboarding = createOnboardingService(services);

  return services;
}

async function getDashboardModel(tenantContext) {
  const services = await createCareerOpsServices(tenantContext);
  const evaluations = services.reports.listEvaluations();
  const pipeline = services.pipeline.list();

  return {
    tenant: tenantContext,
    evaluations,
    pipeline,
    stats: {
      dream: evaluations.filter(evaluation => evaluation.score >= 4.5).length,
      strong: evaluations.filter(evaluation => evaluation.score >= 4.0 && evaluation.score < 4.5).length,
      good: evaluations.filter(evaluation => evaluation.score >= 3.5 && evaluation.score < 4.0).length,
      total: evaluations.length
    }
  };
}

module.exports = {
  createCareerOpsServices,
  getDashboardModel
};
