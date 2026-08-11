/**
 * Shared constants and JSDoc types for the internal LLM gateway.
 */

/** @typedef {'economy' | 'standard' | 'premium'} SpendTier */

/** @typedef {'openai-compatible' | 'gemini'} AdapterId */

/**
 * @typedef {Object} NormalizedUsage
 * @property {number} prompt_tokens
 * @property {number} completion_tokens
 * @property {number} total_tokens
 * @property {number} cached_tokens
 */

/**
 * @typedef {Object} CompletionMessage
 * @property {'system' | 'user' | 'assistant'} role
 * @property {string} content
 */

/**
 * @typedef {Object} GenerationOptions
 * @property {number} [temperature]
 * @property {number} [maxOutputTokens]
 * @property {boolean} [stream]
 */

/**
 * @typedef {Object} RouteHints
 * @property {SpendTier} [spendTier]
 * @property {AdapterId} [provider]
 * @property {string} [model]
 * @property {string[]} [capabilities]
 * @property {number} [budgetCeilingUsd]
 * @property {string} [baseUrl]
 * @property {string} [apiKey]
 * @property {boolean} [allowCrossProviderFallback] - opt-in cross-provider fallback when provider/model explicitly set
 * @property {'allow' | 'block' | 'assume-max'} [unknownPricingPolicy] - how null cost estimates interact with budgetCeilingUsd
 */

/**
 * @typedef {Object} ResolvedModelRoute
 * @property {AdapterId} adapterId
 * @property {string} provider
 * @property {string} model
 * @property {SpendTier} spendTier
 * @property {string[]} capabilities
 * @property {number|null} budgetCeilingUsd
 * @property {ResolvedModelRoute[]} fallbacks
 * @property {Object} endpoint
 * @property {string} [endpoint.baseUrl]
 * @property {string} [endpoint.host]
 * @property {string} [endpoint.apiKey]
 * @property {string} [endpoint.apiKeyEnv]
 */

/**
 * @typedef {Object} CompletionRequest
 * @property {string} task
 * @property {CompletionMessage[]} [messages]
 * @property {string} [systemInstruction]
 * @property {string} [userContent]
 * @property {GenerationOptions} [generation]
 * @property {RouteHints} [route]
 * @property {number} [timeoutMs]
 * @property {import('./retry.mjs').RetryPolicy} [retry]
 * @property {Record<string, unknown>} [metadata]
 * @property {import('./prompt-assembly.mjs').EvaluationPromptInput} [evaluationPrompt]
 */

/**
 * @typedef {Object} CompletionResult
 * @property {string} text
 * @property {NormalizedUsage} usage
 * @property {ResolvedModelRoute} route
 * @property {number|null} estimatedCostUsd
 * @property {string} rateCardVersion
 * @property {number} latencyMs
 * @property {number} attempts
 * @property {import('./usage-record.mjs').UsageRecord} usageRecord
 */

/**
 * @typedef {Object} LlmAdapter
 * @property {AdapterId} id
 * @property {(ctx: AdapterContext) => Promise<AdapterCompletionResult>} complete
 */

/**
 * @typedef {Object} AdapterContext
 * @property {ResolvedModelRoute} route
 * @property {CompletionMessage[]} messages
 * @property {string} [systemInstruction]
 * @property {string} [userContent]
 * @property {GenerationOptions} generation
 * @property {number} timeoutMs
 * @property {typeof fetch} fetch
 * @property {number} attempt
 */

/**
 * @typedef {Object} AdapterCompletionResult
 * @property {string} text
 * @property {NormalizedUsage} usage
 */

/**
 * @typedef {Object} UsageRecord
 * @property {string} id
 * @property {string} timestamp
 * @property {string} task
 * @property {string} provider
 * @property {string} model
 * @property {SpendTier} spendTier
 * @property {number} promptTokens
 * @property {number} completionTokens
 * @property {number} cachedTokens
 * @property {number} totalTokens
 * @property {number|null} estimatedCostUsd
 * @property {string} rateCardVersion
 * @property {number} latencyMs
 * @property {'success' | 'error' | 'timeout'} outcome
 * @property {number} attempt
 * @property {Record<string, unknown>} [metadata]
 */

export const SPEND_TIERS = ['economy', 'standard', 'premium'];
export const DEFAULT_SPEND_TIER = 'standard';

export const ADAPTER_IDS = ['openai-compatible', 'gemini'];
