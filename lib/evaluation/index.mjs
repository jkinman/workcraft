/**
 * Public facade for the evaluation pipeline module.
 *
 * Import from `lib/evaluation/index.mjs` — root *-eval.mjs scripts are thin CLI facades.
 */

export {
  runEvaluation,
  buildOllamaSystemPrompt,
  buildOpenRouterSystemPrompt,
  validateEvaluationShape,
  parseScoreSummary,
  persistEvaluationReport,
} from './pipeline.mjs';

export { parseSummary, stripScoreSummary } from './score-summary.mjs';
export { loadEvaluationContext, readContextFile } from './context.mjs';
export { evaluationPaths } from './paths.mjs';
export {
  slugifyCompany,
  tsvSafe,
  normalizedTrackerScore,
} from './persist.mjs';
export {
  assertHostedOpenAiEndpoint,
  assertOllamaLoopback,
  parseTimeoutMs,
  parseEndpointHost,
} from './guards.mjs';
export {
  createEvaluationGateway,
  createEvaluationLedger,
  resolveUsageLedgerPath,
} from './ledger.mjs';
export {
  logBudgetReport,
  printEvaluationHeader,
  printEvaluationFooter,
  logPersistResult,
} from './display.mjs';
export {
  resolveSourceUrl,
  inferPostingUrlFromJdText,
  NO_POSTING_URL_SENTINEL,
  buildEvaluationReportHeader,
  reportHeaderHasMandatoryUrlField,
} from './source-url.mjs';
export {
  resolveEvaluatorProvider,
  evaluatorFacadeScript,
  buildEvaluatorArgv,
  describeBatchEvaluatorSelection,
  EVALUATOR_FACADE_SCRIPTS,
} from './providers.mjs';
export {
  runOpenAiEvalCli,
  runGeminiEvalCli,
  runOllamaEvalCli,
} from './cli.mjs';
export { runTailoring } from './tailor.mjs';
export { parseCommonEvalArgs } from './cli-args.mjs';
export {
  validatePublicJobUrl,
  validateEvaluationPayload,
} from './url-validation.mjs';
export {
  EVAL_MATERIALIZE_REL_PATHS,
  EVAL_SYNC_REL_PATHS,
} from './paths.mjs';

export { buildSystemMessage } from '../llm/adapters/openai-compatible.mjs';
export { assembleEvaluationPrompt, promptFingerprint } from '../llm/prompt-assembly.mjs';

import { runEvaluation as runEvaluationPipeline } from './pipeline.mjs';
import { resolveEvaluatorProvider as resolveProvider } from './providers.mjs';

export default {
  runEvaluation: runEvaluationPipeline,
  resolveEvaluatorProvider: resolveProvider,
};
