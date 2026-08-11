/**
 * Narrow ESM bridge for dashboard-web (CJS) → lib/evaluation.
 *
 * Concrete imports keep CLI-only tailoring code out of Next server bundles.
 */

const modules = {};

async function loadModule(key, specifier) {
  if (!modules[key]) modules[key] = import(specifier);
  return modules[key];
}

async function validateEvaluationPayload(payload) {
  const mod = await loadModule('validation', '../../lib/evaluation/url-validation.mjs');
  return mod.validateEvaluationPayload(payload);
}

async function runEvaluation(options) {
  const mod = await loadModule('pipeline', '../../lib/evaluation/pipeline.mjs');
  return mod.runEvaluation(options);
}

async function createEvaluationGateway(options) {
  const mod = await loadModule('ledger', '../../lib/evaluation/ledger.mjs');
  return mod.createEvaluationGateway(options);
}

async function resolveEvaluatorProvider(options) {
  const mod = await loadModule('providers', '../../lib/evaluation/providers.mjs');
  return mod.resolveEvaluatorProvider(options);
}

async function slugifyCompany(value) {
  const mod = await loadModule('persist', '../../lib/evaluation/persist.mjs');
  return mod.slugifyCompany(value);
}

module.exports = {
  validateEvaluationPayload,
  runEvaluation,
  createEvaluationGateway,
  resolveEvaluatorProvider,
  slugifyCompany,
};
