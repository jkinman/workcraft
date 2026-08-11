import tenantServices from '../../../../lib/tenant-services';
import validation from '../../../../lib/api/validation';

const { getTenantServices } = tenantServices;
const { jsonError, jsonSuccess, requireNonEmpty } = validation;

export async function GET(request) {
  const { services } = await getTenantServices(request);
  return jsonSuccess(services.settings.getProfileStructured());
}

export async function PUT(request) {
  const { services } = await getTenantServices(request);
  const body = await request.json().catch(() => ({}));

  try {
    if (body.profile && typeof body.profile === 'object') {
      return jsonSuccess(await services.settings.saveProfileStructured(body.profile));
    }
    const content = requireNonEmpty(body.content, 'profile');
    return jsonSuccess(await services.settings.saveProfile(content));
  } catch (error) {
    return jsonError(error.message, 400);
  }
}
