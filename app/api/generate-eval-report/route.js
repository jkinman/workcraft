import tenantServices from '../../../lib/tenant-services';
import validation from '../../../lib/api/validation';
import pdfBundle from '../../../pdf-bundle-generator';

const { getTenantServices } = tenantServices;
const { jsonError, requireString } = validation;
const { generateEvalReportPDF } = pdfBundle;

export async function POST(request) {
  const { services } = getTenantServices(request);
  const body = await request.json().catch(() => ({}));

  try {
    const slug = requireString(body.slug || body.company, 'slug');
    const job = services.reports.getBySlug(slug);
    if (!job) return jsonError('Job evaluation not found', 404);

    const result = await generateEvalReportPDF(job, services.reports.getRawContent(slug), { dataClient: services.dataClient });
    return Response.json(result, { status: result.success ? 200 : 500 });
  } catch (error) {
    return jsonError(error.message, 400);
  }
}
