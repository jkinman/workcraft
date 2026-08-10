import tenantServices from '../../../../lib/tenant-services';
import validation from '../../../../lib/api/validation';

const { getTenantServices } = tenantServices;
const { jsonError, jsonSuccess, requireNonEmpty } = validation;

export async function GET(request) {
  const { services } = await getTenantServices(request);
  return jsonSuccess(services.settings.getResumeStructured());
}

export async function PUT(request) {
  const { services } = await getTenantServices(request);
  const body = await request.json().catch(() => ({}));

  try {
    // Structured payload is the new default; raw markdown is still accepted.
    if (body.resume && typeof body.resume === 'object') {
      return jsonSuccess(await services.settings.saveResumeStructured(body.resume));
    }
    const content = requireNonEmpty(body.content, 'resume');
    return jsonSuccess(await services.settings.saveResume(content));
  } catch (error) {
    return jsonError(error.message, 400);
  }
}
