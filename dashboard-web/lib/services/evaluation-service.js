const path = require('path');
const CONFIG = require('../../config');
const {
  validateEvaluationPayload,
  runEvaluation,
  createEvaluationGateway,
  slugifyCompany,
} = require('../evaluation-bridge');
const { resolveEvaluationModelRoute } = require('../llm-bridge');
const { slugify } = require('../reports-bridge');

const FAKE_EVAL_TEXT = `# Block A
## Block A

# Block B
## Block B

# Block C
## Block C

# Block D
## Block D

# Block E
## Block E

# Block F
## Block F

# Block G
## Block G

---SCORE_SUMMARY---
COMPANY: Acme Corp
ROLE: Senior Engineer
SCORE: 4.2
ARCHETYPE: backend-swe
LEGITIMACY: High Confidence
---END_SUMMARY---
`;

async function buildEvaluationResult(summary, persistResult, sourceUrl) {
  const filename = persistResult?.filename || null;
  const company = summary?.company || 'Unknown';
  const role = summary?.role || 'Unknown';
  const slug = filename
    ? await slugify(company, sourceUrl, filename)
    : slugifyCompany(company);

  return {
    success: true,
    company,
    role,
    score: summary?.score ? parseFloat(summary.score) : null,
    archetype: summary?.archetype || null,
    legitimacy: summary?.legitimacy || null,
    sourceUrl,
    reportFilename: filename,
    reportPath: persistResult?.reportPath || null,
    trackerPath: persistResult?.trackerPath || null,
    slug: typeof slug === 'string' ? slug : company.toLowerCase(),
    num: persistResult?.num || null,
  };
}

async function createGatewayForTenant(tenantRoot, env, options = {}) {
  if (options.gateway) return options.gateway;

  const gatewayOptions = {
    rootDir: tenantRoot,
    env,
    enableFileSink: options.enableFileSink !== false,
  };

  if (options.useFakeGateway || process.env.CAREER_OPS_EVAL_FAKE === '1') {
    const { createFakeAdapter } = await import('../../../lib/llm/adapters/fake.mjs');
    const gateway = await createEvaluationGateway(gatewayOptions);
    const fake = createFakeAdapter(async () => ({
      text: options.fakeEvaluationText || FAKE_EVAL_TEXT,
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30, cached_tokens: 0 },
    }));
    gateway.adapters['openai-compatible'] = fake;
    gateway.adapters.gemini = fake;
    return gateway;
  }

  return createEvaluationGateway(gatewayOptions);
}

async function resolveJobDescription(validated, options = {}) {
  if (validated.jdText && validated.jdText.length >= 80) {
    return {
      jdText: validated.jdText,
      sourceUrl: validated.url || null,
      postingMeta: validated.url
        ? { sourceUrl: validated.url, untrustedSource: true, verification: 'text-provided' }
        : { verification: 'text-provided' },
    };
  }

  if (!validated.url) {
    throw new Error('Provide a job posting URL or at least 80 characters of JD text');
  }

  const { readJobPosting } = await import('../../../lib/discovery/posting-reader.mjs');
  const posting = await readJobPosting(validated.url, options.postingReaderOptions);
  return {
    jdText: posting.jdText,
    sourceUrl: posting.finalUrl || posting.sourceUrl,
    postingMeta: posting,
  };
}

function createEvaluationService(dataClient, tenantContext = {}) {
  return {
    async run(payload, options = {}) {
      const validated = await validateEvaluationPayload(payload);
      const tenantRoot = dataClient.tenantRoot();
      const rootDir = CONFIG.CAREER_OPS_PATH;
      const env = {
        ...process.env,
        CAREER_OPS_DATA_ROOT: tenantRoot,
      };

      const { jdText, sourceUrl, postingMeta } = await resolveJobDescription(validated, options);
      const profileYml = dataClient.readProfile() || '';
      const route = await resolveEvaluationModelRoute({ profileYml, env });
      const gateway = await createGatewayForTenant(tenantRoot, env, options);

      const result = await runEvaluation({
        rootDir,
        jdText,
        adapterId: route.adapterId,
        model: route.model,
        baseUrl: route.endpoint.baseUrl,
        apiKey: route.endpoint.apiKey,
        explicitJobUrl: validated.url || sourceUrl,
        argvPostingUrl: validated.url || sourceUrl,
        saveReport: true,
        trackerMode: 'tsv-merge',
        trackerNote: validated.notes || 'dashboard evaluation',
        gateway,
        env,
        log: () => {},
      });

      if (!result.persistResult?.saved) {
        return {
          success: false,
          error: result.persistResult?.error || 'Failed to persist evaluation report',
        };
      }

      return await buildEvaluationResult(result.summary, result.persistResult, result.sourceUrl || sourceUrl);
    },
  };
}

module.exports = {
  FAKE_EVAL_TEXT,
  buildEvaluationResult,
  createEvaluationService,
  createGatewayForTenant,
  resolveJobDescription,
};
