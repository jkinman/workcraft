import tenantServices from '../../../lib/tenant-services';
import validation from '../../../lib/api/validation';

const { getTenantServices } = tenantServices;
const { jsonError, requireString, validateState } = validation;

export async function POST(request) {
  const { services } = await getTenantServices(request);
  const body = await request.json().catch(() => ({}));

  try {
    const slug = requireString(body.slug, 'slug');
    const newState = validateState(body.newState);
    const result = await services.state.transition(slug, newState);
    return Response.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return jsonError(error.message, 400);
  }
}
