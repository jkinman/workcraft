const validation = require('./validation');

const { jsonError, jsonSuccess } = require('./responses');
const { requireString } = validation;

function isHostedJobResult(result) {
  return result?.mode === 'hosted-job';
}

function translatePdfRunnerResult(result) {
  if (isHostedJobResult(result)) {
    return { body: result, status: 202 };
  }

  const pdfResult = result.result ?? result;
  return {
    body: pdfResult,
    status: pdfResult?.success ? 200 : 500,
  };
}

async function handlePdfRequest(request, services, tenant, { buildPayload }) {
  const body = await request.json().catch(() => ({}));

  try {
    const payload = buildPayload(body, services);
    const result = await services.runner.enqueuePdf(payload);
    const { body: responseBody, status } = translatePdfRunnerResult(result);

    if (status === 202) {
      return jsonSuccess(responseBody, status);
    }

    return Response.json(responseBody, { status });
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
  handlePdfRequest,
  handleHostedOrInlinePdf: handlePdfRequest,
  isHostedJobResult,
  translatePdfRunnerResult,
  requireCompanyRole,
  requireReportSlug
};
