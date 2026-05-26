import tenantServices from '../../../lib/tenant-services';
import validation from '../../../lib/api/validation';

const { getTenantServices } = tenantServices;
const { jsonError, jsonSuccess, validateUrl } = validation;

export async function POST(request) {
  const { services } = getTenantServices(request);
  const body = await request.json().catch(() => ({}));

  try {
    const url = validateUrl(body.url);
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    const entry = services.pipeline.add(url, notes);
    return jsonSuccess({ message: 'Job queued for evaluation', entry });
  } catch (error) {
    return jsonError(error.message, 400);
  }
}
