import tenantServices from '../../../../lib/tenant-services';
import validation from '../../../../lib/api/validation';

const { getTenantServices } = tenantServices;
const { jsonError, jsonSuccess, requireNonEmpty } = validation;

export async function GET(request) {
  const { services } = await getTenantServices(request);
  return jsonSuccess(services.settings.getStrategy());
}

export async function PUT(request) {
  const { services } = await getTenantServices(request);
  const body = await request.json().catch(() => ({}));

  try {
    const content = requireNonEmpty(body.content, 'strategy');
    return jsonSuccess(await services.settings.saveStrategy(content));
  } catch (error) {
    return jsonError(error.message, 400);
  }
}
