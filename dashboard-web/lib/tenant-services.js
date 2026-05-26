const { getTenantContext } = require('./tenant-context');
const { createCareerOpsServices, getDashboardModel } = require('./services/dashboard-service');

function getTenantServices(request) {
  const tenant = getTenantContext(request);
  const services = createCareerOpsServices(tenant);
  return { tenant, services };
}

function getTenantDashboardModel(request) {
  const tenant = getTenantContext(request);
  return { tenant, model: getDashboardModel(tenant) };
}

module.exports = {
  getTenantDashboardModel,
  getTenantServices
};
