import tenantServices from '../../../../lib/tenant-services';
import responses from '../../../../lib/api/responses';

const { getTenantServices } = tenantServices;
const { jsonNotFound, jsonSuccess } = responses;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request, context) {
  const params = await context.params;
  const jobId = params?.jobId;
  const { tenant, services } = await getTenantServices(request);
  if (!UUID_PATTERN.test(jobId || '')) {
    return jsonNotFound('Job not found');
  }

  if (!services.jobs) {
    return jsonNotFound('Job status is unavailable in local mode');
  }

  const job = await services.jobs.getForTenant(tenant.tenantId, jobId);
  if (!job) {
    return jsonNotFound('Job not found');
  }

  return jsonSuccess(job);
}
