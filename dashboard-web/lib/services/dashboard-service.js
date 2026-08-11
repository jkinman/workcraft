const { createRepository } = require('../repositories/repository-factory');
const { createBackgroundJobsRepository } = require('../repositories/background-jobs-repository');
const { assertServiceRoleAllowed } = require('../repositories/supabase-client');
const { createDataClient } = require('../data/career-ops-data-client');
const { createPipelineService } = require('./pipeline-service');
const { createReportService } = require('./report-service');
const { createScanService } = require('./scan-service');
const { createSettingsService } = require('./settings-service');
const { createSetupService } = require('./setup-service');
const { createStateService } = require('./state-service');
const { createWorkloadRunner } = require('./workload-runner');
const { createOnboardingService } = require('./onboarding-service');
const { createEvaluationService } = require('./evaluation-service');
const { createLlmObservabilityService } = require('./llm-observability-service');

async function createCareerOpsServices(tenantContext) {
  const reportsModule = await import('../../../lib/reports/index.mjs');
  const cvParseModule = await import('../../../lib/documents/cv-parse.mjs');
  global.__careerOpsReports = reportsModule;
  global.__careerOpsCvParse = cvParseModule;

  const repository = await createRepository(tenantContext);
  const dataClient = createDataClient(repository);

  let jobs = null;
  if (tenantContext.mode === 'hosted') {
    if (!tenantContext.supabaseClient) {
      throw new Error('Hosted services require a tenant-scoped Supabase client');
    }
    assertServiceRoleAllowed(tenantContext.supabaseClient, { context: 'createCareerOpsServices' });
    jobs = createBackgroundJobsRepository({ client: tenantContext.supabaseClient });
  }

  const services = {
    dataClient,
    repository,
    jobs,
    pipeline: createPipelineService(dataClient),
    reports: createReportService(dataClient, reportsModule),
    scan: createScanService(dataClient),
    settings: createSettingsService(dataClient),
    setup: createSetupService(dataClient),
    state: createStateService(dataClient),
    evaluation: createEvaluationService(dataClient, tenantContext),
    observability: createLlmObservabilityService(dataClient, tenantContext),
  };

  services.runner = createWorkloadRunner(dataClient, tenantContext, jobs, services.evaluation, services.reports);
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
