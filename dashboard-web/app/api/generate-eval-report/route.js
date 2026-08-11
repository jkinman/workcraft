import tenantServices from '../../../lib/tenant-services';
import pdfRoute from '../../../lib/api/pdf-route';

const { getTenantServices } = tenantServices;
const { handlePdfRequest, requireReportSlug } = pdfRoute;

export async function POST(request) {
  const { tenant, services } = await getTenantServices(request);

  return handlePdfRequest(request, services, tenant, {
    buildPayload(body, activeServices) {
      const slug = requireReportSlug(body);
      const job = activeServices.reports.getBySlug(slug);
      if (!job) {
        const error = new Error('Job evaluation not found');
        error.statusCode = 404;
        throw error;
      }
      return { kind: 'eval-report', slug };
    },
  });
}
