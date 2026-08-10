import tenantServices from '../../../lib/tenant-services';
import validation from '../../../lib/api/validation';

const { getTenantServices } = tenantServices;
const { jsonError, jsonSuccess } = validation;

export async function GET(request) {
  const { services } = await getTenantServices(request);
  return jsonSuccess(services.onboarding.getState());
}

export async function POST(request) {
  const { services } = await getTenantServices(request);
  const body = await request.json().catch(() => ({}));

  try {
    return jsonSuccess(await services.onboarding.complete(body.answers || body));
  } catch (error) {
    return jsonError(error.message, 400);
  }
}
