/**
 * Provider-neutral evaluator selection for batch and programmatic callers.
 */

/** @typedef {'openai' | 'gemini' | 'ollama' | 'openrouter'} EvaluatorProviderId */

/** @type {Record<EvaluatorProviderId, string>} */
export const EVALUATOR_FACADE_SCRIPTS = {
  openai: 'openai-eval.mjs',
  gemini: 'gemini-eval.mjs',
  ollama: 'ollama-eval.mjs',
  openrouter: 'openrouter-runner.mjs',
};

/**
 * Resolve which headless evaluator facade to invoke.
 *
 * Priority:
 *  1. Explicit hint
 *  2. CAREER_OPS_EVAL_PROVIDER env
 *  3. GEMINI-only key → gemini
 *  4. OLLAMA_BASE_URL without hosted keys → ollama
 *  5. OPENROUTER_API_KEY without OPENAI key → openrouter
 *  6. default openai
 *
 * @param {object} [params]
 * @param {EvaluatorProviderId} [params.hint]
 * @param {Record<string, string>} [params.env]
 * @returns {EvaluatorProviderId}
 */
export function resolveEvaluatorProvider({ hint, env = process.env } = {}) {
  if (hint && EVALUATOR_FACADE_SCRIPTS[hint]) return hint;

  const explicit = env.CAREER_OPS_EVAL_PROVIDER;
  if (explicit && EVALUATOR_FACADE_SCRIPTS[explicit]) {
    return /** @type {EvaluatorProviderId} */ (explicit);
  }

  if (env.GEMINI_API_KEY && !env.OPENAI_API_KEY && !env.OPENROUTER_API_KEY) {
    return 'gemini';
  }

  if (env.OLLAMA_BASE_URL && !env.OPENAI_API_KEY && !env.GEMINI_API_KEY && !env.OPENROUTER_API_KEY) {
    return 'ollama';
  }

  if (env.OPENROUTER_API_KEY && !env.OPENAI_API_KEY) {
    return 'openrouter';
  }

  return 'openai';
}

/**
 * @param {EvaluatorProviderId} provider
 * @returns {string}
 */
export function evaluatorFacadeScript(provider) {
  return EVALUATOR_FACADE_SCRIPTS[provider] ?? EVALUATOR_FACADE_SCRIPTS.openai;
}

/**
 * Build argv for a headless evaluator facade (shell-out path retained for batch/golden).
 *
 * @param {object} params
 * @param {EvaluatorProviderId} params.provider
 * @param {string} params.jdFile
 * @param {string} [params.model]
 * @param {boolean} [params.noSave]
 */
export function buildEvaluatorArgv({ provider, jdFile, model, noSave = true }) {
  const script = evaluatorFacadeScript(provider);
  const argv = [script, '--file', jdFile];
  if (model) argv.push('--model', model);
  if (noSave) argv.push('--no-save');
  if (provider === 'openrouter') {
    return ['openrouter-runner.mjs', 'evaluate', `--file:${jdFile}`];
  }
  return argv;
}

/**
 * Batch/programmatic callers: resolve stable facade + argv template (gateway-backed).
 *
 * @param {object} [params]
 * @param {Record<string, string>} [params.env]
 * @param {string} [params.rootDir]
 * @param {string} [params.jdFile]
 */
export function describeBatchEvaluatorSelection({
  env = process.env,
  rootDir = process.cwd(),
  jdFile = 'batch/jd-placeholder.txt',
} = {}) {
  const provider = resolveEvaluatorProvider({ env });
  const facadeScript = evaluatorFacadeScript(provider);
  return {
    provider,
    facadeScript,
    facadePath: `${rootDir}/${facadeScript}`.replace(/\/+/g, '/'),
    argvTemplate: buildEvaluatorArgv({ provider, jdFile, noSave: true }),
    gatewayBacked: true,
    vendorCompletionInFacade: false,
    envHint: 'CAREER_OPS_EVAL_PROVIDER',
    supportedProviders: Object.keys(EVALUATOR_FACADE_SCRIPTS),
  };
}
