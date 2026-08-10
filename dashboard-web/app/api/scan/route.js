import tenantServices from '../../../lib/tenant-services';
import pdfRoute from '../../../lib/api/pdf-route';

const { getTenantServices } = tenantServices;
const { isHostedJobResult } = pdfRoute;

export async function POST(request) {
  const url = new URL(request.url);
  const { services } = await getTenantServices(request);
  const dryRun = url.searchParams.get('dryRun') === 'true';
  const deepDive = url.searchParams.get('deepDive') === 'true';

  try {
    const setup = services.setup.requireScanReady();
    if (!setup.success) {
      return Response.json(setup, { status: 400 });
    }

    const result = await services.runner.runScan({ dryRun, deepDive });
    const status = isHostedJobResult(result) ? 202 : 200;
    return Response.json({ success: true, ...result }, { status });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message,
      stderr: error.stderr?.slice(-500),
      stdout: error.stdout?.slice(-500)
    }, { status: 500 });
  }
}
