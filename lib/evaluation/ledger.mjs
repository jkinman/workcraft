/**
 * Usage ledger wiring for real evaluation calls.
 */

import { join } from 'path';
import { createGateway, UsageLedger, createFileSink } from '../llm/index.mjs';

/**
 * Default workspace-relative usage log path.
 * Override with CAREER_OPS_USAGE_LEDGER or LLM_USAGE_LEDGER.
 *
 * @param {string} rootDir
 * @param {Record<string, string>} [env]
 */
export function resolveUsageLedgerPath(rootDir, env = process.env) {
  const configured = env.CAREER_OPS_USAGE_LEDGER ?? env.LLM_USAGE_LEDGER;
  if (configured) {
    return configured.startsWith('/') ? configured : join(rootDir, configured);
  }
  return join(rootDir, 'data', 'llm-usage.jsonl');
}

/**
 * @param {object} [options]
 * @param {string} [options.rootDir]
 * @param {Record<string, string>} [options.env]
 * @param {boolean} [options.enableFileSink]
 */
export function createEvaluationLedger(options = {}) {
  const env = options.env ?? process.env;
  const rootDir = options.rootDir ?? process.cwd();
  const enableFileSink = options.enableFileSink ?? env.CAREER_OPS_USAGE_LEDGER_DISABLE !== '1';

  const ledgerOptions = {};
  if (enableFileSink) {
    ledgerOptions.sink = createFileSink(resolveUsageLedgerPath(rootDir, env));
  }
  return new UsageLedger(ledgerOptions);
}

/**
 * @param {object} [options]
 * @param {string} [options.rootDir]
 * @param {Record<string, string>} [options.env]
 * @param {boolean} [options.geminiUseSdk]
 * @param {() => Promise<typeof import('@google/generative-ai')>} [options.importGeminiSdk]
 * @param {typeof fetch} [options.fetch]
 * @param {UsageLedger} [options.ledger]
 */
export function createEvaluationGateway(options = {}) {
  const ledger = options.ledger ?? createEvaluationLedger(options);
  const geminiUseSdk = options.geminiUseSdk ?? false;
  return createGateway({
    ledger,
    env: options.env ?? process.env,
    fetch: options.fetch,
    geminiUseSdk,
    importGeminiSdk: options.importGeminiSdk ?? (geminiUseSdk ? () => import('@google/generative-ai') : undefined),
  });
}
