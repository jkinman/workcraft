const { createRepository } = require('../repositories/repository-factory');
const { createDataClient } = require('../data/career-ops-data-client');
const { createPipelineService } = require('./pipeline-service');
const { createReportService } = require('./report-service');
const { createScanService } = require('./scan-service');
const { createSetupService } = require('./setup-service');
const { createStateService } = require('./state-service');
const { createWorkloadRunner } = require('./workload-runner');

function createCareerOpsServices(tenantContext) {
  const repository = createRepository(tenantContext);
  const dataClient = createDataClient(repository);

  return {
    dataClient,
    repository,
    pipeline: createPipelineService(dataClient),
    reports: createReportService(dataClient),
    runner: createWorkloadRunner(dataClient, tenantContext),
    scan: createScanService(dataClient),
    setup: createSetupService(dataClient),
    state: createStateService(dataClient)
  };
}

function getDashboardModel(tenantContext) {
  const services = createCareerOpsServices(tenantContext);
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
