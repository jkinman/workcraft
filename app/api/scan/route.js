import tenantServices from '../../../lib/tenant-services';

export async function POST(request) {
  const url = new URL(request.url);
  const { services } = tenantServices.getTenantServices(request);
  const dryRun = url.searchParams.get('dryRun') === 'true';
  const deepDive = url.searchParams.get('deepDive') === 'true';

  try {
    const args = [];
    if (dryRun) args.push('--dry-run');
    if (deepDive) args.push('--deep-dive');

    const { stdout } = await services.runner.runNodeScript('scan.mjs', args, {
      timeout: deepDive ? 300_000 : 120_000,
      maxBuffer: 1024 * 1024
    });

    return Response.json({
      success: true,
      dryRun,
      deepDive,
      companies: parseMetric(stdout, /Companies scanned:\s+(\d+)/),
      tasks: parseMetric(stdout, /Tasks run:\s+(\d+)/),
      totalFound: parseMetric(stdout, /Total jobs found:\s+(\d+)/),
      newOffers: parseMetric(stdout, /New offers added:\s+(\d+)/),
      output: stdout.slice(-2000)
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message,
      stderr: error.stderr?.slice(-500),
      stdout: error.stdout?.slice(-500)
    }, { status: 500 });
  }
}

function parseMetric(text, pattern) {
  return parseInt(text.match(pattern)?.[1] || '0', 10);
}
