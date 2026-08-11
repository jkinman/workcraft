/**
 * Provider-neutral LLM gateway — routing, retries, pricing, telemetry, adapters.
 */

import { openaiCompatibleAdapter, geminiAdapter } from './adapters/index.mjs';
import { BudgetBlockedError, isFallbackEligibleError } from './failure-policy.mjs';
import { assembleEvaluationPrompt } from './prompt-assembly.mjs';
import {
  estimateUsageCostSync,
  getRateCardVersion,
  loadRateCard,
} from './rate-card.mjs';
import {
  buildExecutionRoutePlan,
  enforceBudgetBeforeCall,
} from './route-plan.mjs';
import {
  createTimeoutSignal,
  DEFAULT_TIMEOUT_MS,
  mergeRetryPolicy,
  retryDelayMs,
  withRetries,
} from './retry.mjs';
import { resolveModelRoute } from './routing.mjs';
import { emitTelemetry, TELEMETRY, TelemetrySink } from './telemetry.mjs';
import { appendUsageRecord, createUsageRecord, UsageLedger } from './usage-record.mjs';
import { emptyUsage } from './usage-normalize.mjs';
import {
  buildRouteAuditMetadata,
  sanitizeMetadataForLedger,
  sanitizeProviderError,
} from './sanitize.mjs';

const DEFAULT_ADAPTERS = {
  'openai-compatible': openaiCompatibleAdapter,
  gemini: geminiAdapter,
};

const HEURISTIC_USAGE = {
  prompt_tokens: 1000,
  completion_tokens: 500,
  total_tokens: 1500,
  cached_tokens: 0,
};

/**
 * @typedef {Object} GatewayOptions
 * @property {Record<string, import('./types.mjs').LlmAdapter>} [adapters]
 * @property {typeof fetch} [fetch]
 * @property {UsageLedger} [ledger]
 * @property {TelemetrySink} [telemetry]
 * @property {Record<string, unknown>} [env]
 * @property {object} [rateCard]
 * @property {(input: { model: string, provider?: string, usage: import('./types.mjs').NormalizedUsage }) => Promise<number|null|undefined>} [livePricingLookup]
 * @property {boolean} [geminiUseSdk]
 * @property {() => Promise<{ default: { GenerativeClient: new (key: string) => unknown } }>} [importGeminiSdk]
 */

/**
 * @param {GatewayOptions} [options]
 */
export function createGateway(options = {}) {
  const adapters = { ...DEFAULT_ADAPTERS, ...options.adapters };
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const ledger = options.ledger ?? new UsageLedger();
  const telemetry = options.telemetry ?? new TelemetrySink();
  const env = options.env ?? (typeof process !== 'undefined' ? process.env : {});
  const rateCard = options.rateCard ?? loadRateCard();
  const rateCardVersion = getRateCardVersion(rateCard);

  return {
    adapters,
    ledger,
    telemetry,
    complete: (request) =>
      completeWithGateway({
        request,
        adapters,
        fetchImpl,
        ledger,
        telemetry,
        env,
        rateCard,
        rateCardVersion,
        livePricingLookup: options.livePricingLookup,
        geminiUseSdk: options.geminiUseSdk ?? false,
        importGeminiSdk: options.importGeminiSdk,
      }),
  };
}

/**
 * @param {import('./types.mjs').ResolvedModelRoute} route
 * @param {object} ctx
 */
function estimateRouteCostHeuristic(route, ctx) {
  return estimateUsageCostSync({
    model: route.model,
    usage: HEURISTIC_USAGE,
    provider: route.provider,
    env: ctx.env,
    card: ctx.rateCard,
  });
}

/**
 * @param {object} params
 * @param {import('./types.mjs').CompletionRequest} params.request
 */
async function completeWithGateway({
  request,
  adapters,
  fetchImpl,
  ledger,
  telemetry,
  env,
  rateCard,
  rateCardVersion,
  livePricingLookup,
  geminiUseSdk,
  importGeminiSdk,
}) {
  const started = Date.now();
  const routeHints = request.route ?? {};
  const primaryRoute = resolveModelRoute({
    hints: routeHints,
    profileYml: request.evaluationPrompt?.profileYml ?? '',
    env,
  });

  emitTelemetry(telemetry, TELEMETRY.ROUTE_RESOLVED, {
    task: request.task,
    adapterId: primaryRoute.adapterId,
    model: primaryRoute.model,
    spendTier: primaryRoute.spendTier,
    fallbackCount: primaryRoute.fallbacks?.length ?? 0,
  });

  const plan = buildExecutionRoutePlan(primaryRoute, routeHints);

  let messages = request.messages ?? [];
  let systemInstruction = request.systemInstruction;
  let userContent = request.userContent;

  if (request.evaluationPrompt) {
    const assembled = assembleEvaluationPrompt({
      ...request.evaluationPrompt,
      adapterId: primaryRoute.adapterId,
    });
    messages = assembled.messages;
    systemInstruction = assembled.systemInstruction;
    userContent = assembled.userContent;
    emitTelemetry(telemetry, TELEMETRY.PROMPT_ASSEMBLED, {
      task: request.task,
      compressed: assembled.budgetReport.compressed,
      totalTokens: assembled.budgetReport.totalTokens,
      budget: assembled.budgetReport.budget,
    });
  }

  const budgetCtx = { env, rateCard };
  const estimateForRoute = (route) => estimateRouteCostHeuristic(route, budgetCtx);
  const unknownPricingPolicy = routeHints.unknownPricingPolicy ?? 'allow';

  let executionRoutes;
  try {
    executionRoutes = enforceBudgetBeforeCall(plan.routes, {
      ceiling: routeHints.budgetCeilingUsd,
      estimateForRoute,
      unknownPricingPolicy,
    });
  } catch (err) {
    if (err instanceof BudgetBlockedError) {
      const latencyMs = Date.now() - started;
      const blockedRecord = createUsageRecord({
        task: request.task,
        route: plan.routes[0],
        usage: emptyUsage(),
        estimatedCostUsd: null,
        rateCardVersion,
        latencyMs,
        outcome: 'error',
        attempt: 0,
        metadata: sanitizeMetadataForLedger({
          ...(buildRouteAuditMetadata({
            route: plan.routes[0],
            routeIndex: 0,
            fallbackCount: 0,
            routesAvailable: plan.routes.length,
            budgetBlocked: true,
            budgetReason: err.details?.reason,
            budgetCeiling: err.details?.ceiling,
          }) ?? {}),
          ...(request.metadata ?? {}),
          unknownPricingPolicy,
        }),
      });
      appendUsageRecord(ledger, blockedRecord);
      emitTelemetry(telemetry, TELEMETRY.BUDGET_BLOCKED, {
        task: request.task,
        ceiling: err.details?.ceiling,
        reason: err.details?.reason,
        unknownPricingPolicy,
        preCall: true,
      });
      throw err;
    }
    throw err;
  }

  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryPolicy = mergeRetryPolicy(request.retry);
  const generation = request.generation ?? {};

  /** @type {import('./types.mjs').ResolvedModelRoute|null} */
  let executedRoute = null;
  /** @type {number} */
  let routeAttempts = 0;
  /** @type {unknown} */
  let lastError = null;
  let fallbackCount = 0;

  for (let routeIndex = 0; routeIndex < executionRoutes.length; routeIndex++) {
    const route = executionRoutes[routeIndex];
    const adapter = adapters[route.adapterId];
    if (!adapter) {
      lastError = new Error(`No adapter registered for route ${route.adapterId}`);
      break;
    }

    emitTelemetry(telemetry, TELEMETRY.ROUTE_ATTEMPT, {
      task: request.task,
      routeIndex,
      adapterId: route.adapterId,
      model: route.model,
      provider: route.provider,
      timeoutMs,
    });

    emitTelemetry(telemetry, TELEMETRY.ADAPTER_REQUEST, {
      task: request.task,
      adapterId: route.adapterId,
      model: route.model,
      timeoutMs,
      routeIndex,
    });

    executedRoute = route;

    try {
      const retryOutcome = await withRetries({
        policy: retryPolicy,
        onRetry: ({ attempt, status, delayMs }) => {
          emitTelemetry(telemetry, TELEMETRY.RETRY_SCHEDULED, {
            task: request.task,
            attempt,
            status,
            delayMs,
            routeIndex,
            adapterId: route.adapterId,
          });
        },
        run: async () => {
          routeAttempts += 1;
          const signal = createTimeoutSignal(timeoutMs);
          return adapter.complete({
            route,
            messages,
            systemInstruction,
            userContent,
            generation,
            timeoutMs,
            fetch: fetchImpl,
            attempt: routeAttempts,
            signal,
            useSdk: route.adapterId === 'gemini' ? geminiUseSdk : false,
            importSdk: importGeminiSdk,
          });
        },
      });

      const latencyMs = Date.now() - started;
      const usage = retryOutcome.result.usage;
      let estimatedCostUsd = estimateUsageCostSync({
        model: route.model,
        usage,
        provider: route.provider,
        env,
        card: rateCard,
      });

      if (livePricingLookup) {
        const live = await livePricingLookup({ model: route.model, provider: route.provider, usage });
        if (live != null) estimatedCostUsd = live;
      }

      const usageRecord = createUsageRecord({
        task: request.task,
        route,
        usage,
        estimatedCostUsd,
        rateCardVersion,
        latencyMs,
        outcome: 'success',
        attempt: retryOutcome.attempts,
        metadata: sanitizeMetadataForLedger({
          ...(buildRouteAuditMetadata({
            route,
            routeIndex,
            fallbackCount,
            routesAvailable: executionRoutes.length,
            budgetBlocked: false,
          }) ?? {}),
          ...(request.metadata ?? {}),
        }),
      });
      appendUsageRecord(ledger, usageRecord);

      emitTelemetry(telemetry, TELEMETRY.ADAPTER_RESPONSE, {
        task: request.task,
        latencyMs,
        usage,
        routeIndex,
        adapterId: route.adapterId,
      });
      emitTelemetry(telemetry, TELEMETRY.USAGE_RECORDED, {
        task: request.task,
        recordId: usageRecord.id,
        routeIndex,
      });
      emitTelemetry(telemetry, TELEMETRY.COMPLETE, {
        task: request.task,
        latencyMs,
        estimatedCostUsd,
        routeIndex,
        fallbackCount,
      });

      return {
        text: retryOutcome.result.text,
        usage,
        route,
        estimatedCostUsd,
        rateCardVersion,
        latencyMs,
        attempts: retryOutcome.attempts,
        usageRecord,
        fallbackCount,
      };
    } catch (error) {
      lastError = error;
      const canFallback =
        routeIndex < executionRoutes.length - 1 &&
        isFallbackEligibleError(error);

      if (canFallback) {
        fallbackCount += 1;
        emitTelemetry(telemetry, TELEMETRY.ROUTE_FALLBACK, {
          task: request.task,
          fromAdapterId: route.adapterId,
          fromModel: route.model,
          toAdapterId: executionRoutes[routeIndex + 1].adapterId,
          toModel: executionRoutes[routeIndex + 1].model,
          reason: String(error?.message ?? error),
          routeIndex,
        });
        continue;
      }

      break;
    }
  }

  const latencyMs = Date.now() - started;
  const outcome = lastError?.name === 'TimeoutError' ? 'timeout' : 'error';
  const finalRoute = executedRoute ?? executionRoutes[0];

  if (executionRoutes.length > 1) {
    emitTelemetry(telemetry, TELEMETRY.ROUTES_EXHAUSTED, {
      task: request.task,
      routesAttempted: fallbackCount + 1,
      lastAdapterId: finalRoute?.adapterId,
    });
  }

  const failureRecord = createUsageRecord({
    task: request.task,
    route: finalRoute,
    usage: emptyUsage(),
    estimatedCostUsd: null,
    rateCardVersion,
    latencyMs,
    outcome,
    attempt: routeAttempts || 1,
    metadata: sanitizeMetadataForLedger({
      ...(buildRouteAuditMetadata({
        route: finalRoute,
        routeIndex: executionRoutes.length - 1,
        fallbackCount,
        routesAvailable: executionRoutes.length,
        budgetBlocked: false,
      }) ?? {}),
      ...(request.metadata ?? {}),
      error: sanitizeProviderError(lastError),
      routesAttempted: fallbackCount + 1,
    }),
  });
  appendUsageRecord(ledger, failureRecord);

  emitTelemetry(telemetry, TELEMETRY.ERROR, {
    task: request.task,
    outcome,
    message: String(lastError?.message ?? lastError),
    adapterId: finalRoute?.adapterId,
    fallbackCount,
  });

  throw lastError;
}

export {
  assembleEvaluationPrompt,
  resolveModelRoute,
  UsageLedger,
  appendUsageRecord,
  createUsageRecord,
  TelemetrySink,
  TELEMETRY,
  mergeRetryPolicy,
  retryDelayMs,
  buildExecutionRoutePlan,
  enforceBudgetBeforeCall,
  BudgetBlockedError,
  isFallbackEligibleError,
};

export default createGateway;
