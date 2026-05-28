import tenantServices from '../../../lib/tenant-services';

export async function POST(request) {
  const url = new URL(request.url);
  const { services } = tenantServices.getTenantServices(request);
  const dryRun = url.searchParams.get('dryRun') === 'true';
  const deepDive = url.searchParams.get('deepDive') === 'true';

  try {
    const setup = services.setup.requireScanReady();
    if (!setup.success) {
      return Response.json(setup, { status: 400 });
    }

    const result = await services.runner.runScan({ dryRun, deepDive });
    return Response.json({ success: true, ...result });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message,
      stderr: error.stderr?.slice(-500),
      stdout: error.stdout?.slice(-500)
    }, { status: 500 });
  }
}
