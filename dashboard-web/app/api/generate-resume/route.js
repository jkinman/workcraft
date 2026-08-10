import tenantServices from '../../../lib/tenant-services';
import validation from '../../../lib/api/validation';
import pdfBundle from '../../../pdf-bundle-generator';

const { getTenantServices } = tenantServices;
const { jsonError, requireString } = validation;
const { generateResumePDF } = pdfBundle;

export async function POST(request) {
  const { services } = await getTenantServices(request);
  const body = await request.json().catch(() => ({}));

  try {
    const company = requireString(body.company, 'company');
    const role = requireString(body.role, 'role');
    const result = await generateResumePDF(company, role, body.jobDescription || '', { dataClient: services.dataClient });
    return Response.json(result, { status: result.success ? 200 : 500 });
  } catch (error) {
    return jsonError(error.message, 400);
  }
}
