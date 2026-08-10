import tenantServices from '../../../../../lib/tenant-services';
import validation from '../../../../../lib/api/validation';
import { importResumeFromFile } from '../../../../../lib/services/resume-import';
import { cvToObject } from '../../../../../lib/services/resume-schema';

export const runtime = 'nodejs';

const { getTenantServices } = tenantServices;
const { jsonError, jsonSuccess } = validation;

export async function POST(request) {
  // Resolve tenant first so uploads stay scoped to the signed-in user.
  await getTenantServices(request);

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');

  if (!file || typeof file === 'string') {
    return jsonError('No file uploaded.', 400);
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importResumeFromFile({
      buffer,
      filename: file.name,
      mimeType: file.type
    });
    return jsonSuccess({ ...result, resume: cvToObject(result.content) });
  } catch (error) {
    return jsonError(error.message, 400);
  }
}
