const { getTenantContext } = require('./tenant-context');
const { createCareerOpsServices, getDashboardModel } = require('./services/dashboard-service');
const { getHomeModel } = require('./services/home-service');
const clerkRequest = require('./auth/clerk-request');
const { resolveTenantSupabaseClient } = require('./auth/supabase-session');

const requestServices = new WeakMap();
const requestServicePromises = new WeakMap();
const requestSupabaseClients = new WeakMap();

async function buildTenantContextFromRequest(authenticatedRequest, env = process.env) {
  const base = getTenantContext(authenticatedRequest);
  const supabaseClient = resolveTenantSupabaseClient(authenticatedRequest, base, env);
  if (supabaseClient) {
    requestSupabaseClients.set(authenticatedRequest, supabaseClient);
    return {
      ...base,
      supabaseJwt: authenticatedRequest.supabaseJwt ?? null,
      supabaseClient,
      env,
    };
  }
  return { ...base, env };
}

async function resolveTenantServices(request, tenant) {
  if (requestServices.has(request)) {
    return requestServices.get(request);
  }

  const services = await createCareerOpsServices(tenant);
  requestServices.set(request, services);
  return services;
}

async function getTenantServices(request) {
  const existing = requestServicePromises.get(request);
  if (existing) {
    return existing;
  }

  /** @type {(value: { tenant: object, services: object }) => void} */
  let resolveEntry;
  /** @type {(reason?: unknown) => void} */
  let rejectEntry;
  const entry = new Promise((resolve, reject) => {
    resolveEntry = resolve;
    rejectEntry = reject;
  });

  requestServicePromises.set(request, entry);

  try {
    const authenticatedRequest = await clerkRequest.getAuthenticatedTenantRequest(request);
    const tenant = await buildTenantContextFromRequest(authenticatedRequest);
    const services = await resolveTenantServices(request, tenant);
    resolveEntry({ tenant, services });
  } catch (err) {
    requestServicePromises.delete(request);
    rejectEntry(err);
  }

  return entry;
}

async function getTenantDashboardModel(request) {
  const { tenant, services } = await getTenantServices(request);
  const evaluations = services.reports.listEvaluations();
  const pipeline = services.pipeline.list();

  return {
    tenant,
    model: {
      tenant,
      evaluations,
      pipeline,
      stats: {
        dream: evaluations.filter(evaluation => evaluation.score >= 4.5).length,
        strong: evaluations.filter(evaluation => evaluation.score >= 4.0 && evaluation.score < 4.5).length,
        good: evaluations.filter(evaluation => evaluation.score >= 3.5 && evaluation.score < 4.0).length,
        total: evaluations.length
      }
    }
  };
}

async function getTenantHomeModel(request) {
  const { tenant, services } = await getTenantServices(request);
  return { tenant, home: getHomeModel(services) };
}

module.exports = {
  buildTenantContextFromRequest,
  resolveTenantServices,
  getTenantDashboardModel,
  getTenantHomeModel,
  getTenantServices,
  requestSupabaseClients,
};
