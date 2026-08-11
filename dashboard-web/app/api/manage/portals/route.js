import tenantServices from '../../../../lib/tenant-services';
import validation from '../../../../lib/api/validation';

const { getTenantServices } = tenantServices;
const { jsonError, jsonSuccess, requireNonEmpty } = validation;

export async function GET(request) {
  const { services } = await getTenantServices(request);
  return jsonSuccess(services.settings.getPortalsStructured());
}

export async function PUT(request) {
  const { services } = await getTenantServices(request);
  const body = await request.json().catch(() => ({}));

  try {
    if (body.portals && typeof body.portals === 'object') {
      return jsonSuccess(await services.settings.savePortalsStructured(body.portals));
    }
    const content = requireNonEmpty(body.content, 'portals');
    return jsonSuccess(await services.settings.savePortals(content));
  } catch (error) {
    return jsonError(error.message, 400);
  }
}
