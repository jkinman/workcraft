const validation = require('./validation');

const { jsonError, jsonSuccess } = require('./responses');
const { requireString } = validation;

function isHostedJobResult(result) {
  return result?.mode === 'hosted-job';
}

async function handleHostedOrInlinePdf(request, services, tenant, {
  buildPayload,
  runInline
}) {
  const body = await request.json().catch(() => ({}));

  try {
    const payload = buildPayload(body, services);

    if (tenant.mode === 'hosted') {
      const queued = await services.runner.enqueuePdf(payload);
      return jsonSuccess(queued, 202);
    }

    const result = await runInline(payload, services);
    return Response.json(result, { status: result.success ? 200 : 500 });
  } catch (error) {
    return jsonError(error.message, error.statusCode || 400);
  }
}

function requireCompanyRole(body) {
  return {
    company: requireString(body.company, 'company'),
    role: requireString(body.role, 'role'),
    jobDescription: body.jobDescription || ''
  };
}

function requireReportSlug(body) {
  return requireString(body.slug || body.company, 'slug');
}

module.exports = {
  handleHostedOrInlinePdf,
  isHostedJobResult,
  requireCompanyRole,
  requireReportSlug
};
