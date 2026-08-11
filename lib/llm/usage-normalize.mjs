/**
 * Normalize provider-specific usage payloads into a single shape.
 */

/**
 * @param {object|null|undefined} usage
 * @returns {import('./types.mjs').NormalizedUsage}
 */
export function normalizeOpenAICompatibleUsage(usage) {
  return {
    prompt_tokens: usage?.prompt_tokens ?? 0,
    completion_tokens: usage?.completion_tokens ?? 0,
    total_tokens: usage?.total_tokens ?? 0,
    cached_tokens:
      usage?.prompt_tokens_details?.cached_tokens ??
      usage?.cached_tokens ??
      0,
  };
}

/**
 * @param {object|null|undefined} usageMetadata
 * @returns {import('./types.mjs').NormalizedUsage}
 */
export function normalizeGeminiUsage(usageMetadata) {
  const prompt = usageMetadata?.promptTokenCount ?? 0;
  const completion = usageMetadata?.candidatesTokenCount ?? 0;
  const total = usageMetadata?.totalTokenCount ?? prompt + completion;
  const cached = usageMetadata?.cachedContentTokenCount ?? 0;
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: total,
    cached_tokens: cached,
  };
}

/** @deprecated Use normalizeOpenAICompatibleUsage */
export function normalizeOpenAIUsage(usage) {
  return normalizeOpenAICompatibleUsage(usage);
}

/**
 * @param {import('./types.mjs').NormalizedUsage} usage
 * @returns {import('./types.mjs').NormalizedUsage}
 */
export function emptyUsage() {
  return {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    cached_tokens: 0,
  };
}
