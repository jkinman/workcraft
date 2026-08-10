import tenantServices from '../../../lib/tenant-services';
import pdfRoute from '../../../lib/api/pdf-route';
import pdfBundle from '../../../pdf-bundle-generator';

const { getTenantServices } = tenantServices;
const { handleHostedOrInlinePdf, requireReportSlug } = pdfRoute;
const { generateFullEvalReportPDF } = pdfBundle;

export async function POST(request) {
  const { tenant, services } = await getTenantServices(request);

  return handleHostedOrInlinePdf(request, services, tenant, {
    buildPayload(body, activeServices) {
      const slug = requireReportSlug(body);
      const job = activeServices.reports.getBySlug(slug);
      if (!job) {
        const error = new Error('Job evaluation not found');
        error.statusCode = 404;
        throw error;
      }
      return { kind: 'full-eval', slug };
    },
    runInline(payload, activeServices) {
      const job = activeServices.reports.getBySlug(payload.slug);
      if (!job) return Promise.resolve({ success: false, error: 'Job evaluation not found' });
      return generateFullEvalReportPDF(job, activeServices.reports.getRawContent(payload.slug), {
        dataClient: activeServices.dataClient
      });
    }
  });
}
