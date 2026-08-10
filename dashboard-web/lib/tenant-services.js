const { getTenantContext } = require('./tenant-context');
const { createCareerOpsServices, getDashboardModel } = require('./services/dashboard-service');
const { getHomeModel } = require('./services/home-service');
const { getAuthenticatedTenantRequest } = require('./auth/clerk-request');

async function getTenantServices(request) {
  const authenticatedRequest = await getAuthenticatedTenantRequest(request);
  const tenant = getTenantContext(authenticatedRequest);
  const services = await createCareerOpsServices(tenant);
  return { tenant, services };
}

async function getTenantDashboardModel(request) {
  const authenticatedRequest = await getAuthenticatedTenantRequest(request);
  const tenant = getTenantContext(authenticatedRequest);
  const model = await getDashboardModel(tenant);
  return { tenant, model };
}

async function getTenantHomeModel(request) {
  const authenticatedRequest = await getAuthenticatedTenantRequest(request);
  const tenant = getTenantContext(authenticatedRequest);
  const services = await createCareerOpsServices(tenant);
  return { tenant, home: getHomeModel(services) };
}

module.exports = {
  getTenantDashboardModel,
  getTenantHomeModel,
  getTenantServices
};
