import tenantServices from '../../../lib/tenant-services';
import validation from '../../../lib/api/validation';
import pdfRoute from '../../../lib/api/pdf-route';

const { getTenantServices } = tenantServices;
const { jsonError, jsonSuccess } = validation;
const { isHostedJobResult } = pdfRoute;

export async function POST(request) {
  const { tenant, services } = await getTenantServices(request);
  const body = await request.json().catch(() => ({}));

  try {
    const setup = services.setup.requireEvaluationReady?.() || services.setup.requireScanReady();
    if (setup && setup.success === false) {
      return Response.json(setup, { status: 400 });
    }

    const result = await services.runner.runEvaluation({
      url: body.url,
      jdText: body.jdText,
      notes: body.notes,
    });

    const status = isHostedJobResult(result) ? 202 : (result.success === false ? 400 : 200);
    return Response.json({ success: result.success !== false, ...result }, { status });
  } catch (error) {
    return jsonError(error.message, 400);
  }
}
