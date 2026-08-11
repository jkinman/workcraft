/**
 * Public facade for the internal provider-neutral LLM gateway.
 *
 * Import from `lib/llm/index.mjs` — not from adapters directly unless extending providers.
 */

export { createGateway } from './gateway.mjs';
export {
  assembleEvaluationPrompt,
  buildBudgetedPrompt,
  promptFingerprint,
} from './prompt-assembly.mjs';
export {
  resolveModelRoute,
  parseSpendTierFromProfile,
  normalizeSpendTier,
  DEFAULT_ROUTE_TABLE,
} from './routing.mjs';
export {
  estimateUsageCost,
  estimateUsageCostSync,
  getLegacyRatesMap,
  getRateCardVersion,
  loadRateCard,
  RATE_CARD_VERSION,
} from './rate-card.mjs';
export {
  normalizeOpenAICompatibleUsage,
  normalizeGeminiUsage,
  normalizeOpenAIUsage,
  emptyUsage,
} from './usage-normalize.mjs';
export {
  UsageLedger,
  appendUsageRecord,
  createUsageRecord,
  createFileSink,
} from './usage-record.mjs';
export {
  TelemetrySink,
  emitTelemetry,
  TELEMETRY,
} from './telemetry.mjs';
export {
  mergeRetryPolicy,
  withRetries,
  isRetryableError,
  createTimeoutSignal,
  DEFAULT_RETRY_POLICY,
  DEFAULT_TIMEOUT_MS,
  HttpResponseError,
} from './retry.mjs';
export {
  BudgetBlockedError,
  isFallbackEligibleError,
  getErrorStatus,
} from './failure-policy.mjs';
export {
  buildExecutionRoutePlan,
  flattenRouteChain,
  enforceBudgetBeforeCall,
  filterRoutesForBudget,
} from './route-plan.mjs';
export { openaiCompatibleAdapter, geminiAdapter, createFakeAdapter } from './adapters/index.mjs';
export { buildSystemMessage } from './adapters/openai-compatible.mjs';
export { extractGeminiText } from './adapters/gemini.mjs';
export {
  assertUsageRecordSafe,
  sanitizeMetadataForLedger,
  sanitizeProviderError,
  sanitizeValueForLedger,
  buildRouteAuditMetadata,
} from './sanitize.mjs';
export {
  summarizeUsageRecords,
  computeUsageMetrics,
  evaluateBudgetAlerts,
  buildRouteAuditTrail,
  buildRouteAuditFromRecords,
  checkRateCardWarnings,
  buildObservabilityReport,
} from './observability.mjs';

export * from './types.mjs';
