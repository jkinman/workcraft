import tenantServices from '../../../lib/tenant-services';
import pdfRoute from '../../../lib/api/pdf-route';
import pdfBundle from '../../../pdf-bundle-generator';

const { getTenantServices } = tenantServices;
const { handleHostedOrInlinePdf, requireCompanyRole } = pdfRoute;
const { generateResumePDF } = pdfBundle;

export async function POST(request) {
  const { tenant, services } = await getTenantServices(request);

  return handleHostedOrInlinePdf(request, services, tenant, {
    buildPayload(body) {
      const { company, role, jobDescription } = requireCompanyRole(body);
      return { kind: 'resume', company, role, jobDescription };
    },
    runInline(payload, activeServices) {
      return generateResumePDF(payload.company, payload.role, payload.jobDescription, {
        dataClient: activeServices.dataClient
      });
    }
  });
}
