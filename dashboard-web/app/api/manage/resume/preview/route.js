import tenantServices from '../../../../../lib/tenant-services';
import validation from '../../../../../lib/api/validation';

const { getTenantServices } = tenantServices;
const { jsonError, jsonSuccess } = validation;

export async function POST(request) {
  const { services } = await getTenantServices(request);
  const body = await request.json().catch(() => ({}));

  try {
    return jsonSuccess(services.settings.inspectResume(body.content || ''));
  } catch (error) {
    return jsonError(error.message, 400);
  }
}
