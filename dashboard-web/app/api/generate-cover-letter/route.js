import tenantServices from '../../../lib/tenant-services';
import pdfRoute from '../../../lib/api/pdf-route';

const { getTenantServices } = tenantServices;
const { handlePdfRequest, requireCompanyRole } = pdfRoute;

export async function POST(request) {
  const { tenant, services } = await getTenantServices(request);

  return handlePdfRequest(request, services, tenant, {
    buildPayload(body) {
      const { company, role, jobDescription } = requireCompanyRole(body);
      return { kind: 'cover-letter', company, role, jobDescription };
    },
  });
}
