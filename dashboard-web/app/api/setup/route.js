import tenantServices from '../../../lib/tenant-services';
import validation from '../../../lib/api/validation';

const { getTenantServices } = tenantServices;
const { jsonError, jsonSuccess } = validation;

export async function GET(request) {
  const { services } = await getTenantServices(request);
  return jsonSuccess({ status: services.setup.getStatus() });
}

export async function POST(request) {
  const { services } = await getTenantServices(request);
  const body = await request.json().catch(() => ({}));
  const target = body.target || 'all';

  if (!['all', 'portals', 'profile', 'pipeline'].includes(target)) {
    return jsonError(`Invalid setup target: ${target}`, 400);
  }

  try {
    return jsonSuccess(await services.setup.initialize(target));
  } catch (error) {
    return jsonError(error.message, 500);
  }
}
