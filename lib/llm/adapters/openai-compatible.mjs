/**
 * OpenAI-compatible chat/completions adapter (OpenAI, OpenRouter, Ollama, custom base URL).
 * Uses native fetch — no vendor SDK.
 */

import { HttpResponseError } from '../retry.mjs';
import { normalizeOpenAICompatibleUsage } from '../usage-normalize.mjs';

/** @type {import('../types.mjs').LlmAdapter} */
export const openaiCompatibleAdapter = {
  id: 'openai-compatible',
  complete: completeOpenAICompatible,
};

/**
 * Host-gated prompt caching (#1709): ephemeral cache_control on non-OpenAI hosts.
 * @param {string} prompt
 * @param {string} host
 */
export function buildSystemMessage(prompt, host) {
  if (host === 'api.openai.com') return { role: 'system', content: prompt };
  return {
    role: 'system',
    content: [{ type: 'text', text: prompt, cache_control: { type: 'ephemeral' } }],
  };
}

/**
 * @param {import('../types.mjs').AdapterContext} ctx
 */
export async function completeOpenAICompatible(ctx) {
  const { route, generation, timeoutMs, fetch: fetchImpl } = ctx;
  const systemMessage = ctx.messages.find((m) => m.role === 'system');
  const userMessage = ctx.messages.find((m) => m.role === 'user');
  const systemPrompt = ctx.systemInstruction ?? systemMessage?.content ?? '';
  const userContent = ctx.userContent ?? userMessage?.content ?? '';

  const endpoint = `${route.endpoint.baseUrl}/chat/completions`;
  const headers = { 'Content-Type': 'application/json' };
  if (route.endpoint.apiKey) {
    headers.Authorization = `Bearer ${route.endpoint.apiKey}`;
  }

  const isOllama = route.provider === 'ollama';
  const body = {
    model: route.model,
    messages: [
      buildSystemMessage(systemPrompt, route.endpoint.host ?? ''),
      { role: 'user', content: userContent },
    ],
    stream: generation.stream ?? false,
    ...(isOllama
      ? {
          options: {
            temperature: generation.temperature ?? 0.4,
            num_ctx: generation.numCtx ?? 32768,
          },
        }
      : {
          temperature: generation.temperature ?? 0.4,
        }),
    ...(generation.maxOutputTokens ? { max_tokens: generation.maxOutputTokens } : {}),
  };

  if (route.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/santifer/career-ops';
    headers['X-Title'] = 'career-ops';
  }

  const res = await fetchImpl(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: ctx.signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new HttpResponseError(res.status, text);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim() ?? '';
  if (!text) {
    throw new Error('OpenAI-compatible endpoint returned an empty response');
  }

  return {
    text,
    usage: normalizeOpenAICompatibleUsage(data.usage),
  };
}

export default openaiCompatibleAdapter;
