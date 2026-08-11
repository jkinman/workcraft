/**
 * Gemini adapter — native HTTP to preserve systemInstruction cache semantics without
 * requiring the SDK at import time. Falls back to @google/generative-ai when useSdk=true.
 */

import { HttpResponseError } from '../retry.mjs';
import { normalizeGeminiUsage } from '../usage-normalize.mjs';

/** @type {import('../types.mjs').LlmAdapter} */
export const geminiAdapter = {
  id: 'gemini',
  complete: completeGemini,
};

/**
 * @param {import('../types.mjs').AdapterContext & { useSdk?: boolean, importSdk?: () => Promise<typeof import('@google/generative-ai')> }} ctx
 */
export async function completeGemini(ctx) {
  if (ctx.useSdk) {
    return completeGeminiViaSdk(ctx);
  }
  return completeGeminiViaHttp(ctx);
}

/**
 * @param {import('../types.mjs').AdapterContext} ctx
 */
async function completeGeminiViaHttp(ctx) {
  const { route, generation, fetch: fetchImpl } = ctx;
  const apiKey = route.endpoint.apiKey;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required for Gemini adapter');
  }

  const systemPrompt = ctx.systemInstruction ?? ctx.messages.find((m) => m.role === 'system')?.content ?? '';
  const userContent = ctx.userContent ?? ctx.messages.find((m) => m.role === 'user')?.content ?? '';

  const url = `${route.endpoint.baseUrl}/models/${encodeURIComponent(route.model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const payload = {
    ...(systemPrompt
      ? { systemInstruction: { parts: [{ text: systemPrompt }] } }
      : {}),
    contents: [{ role: 'user', parts: [{ text: userContent }] }],
    generationConfig: {
      temperature: generation.temperature ?? 0.4,
      maxOutputTokens: generation.maxOutputTokens ?? 8192,
    },
  };

  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: ctx.signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new HttpResponseError(res.status, text);
  }

  const data = await res.json();
  const text = extractGeminiText(data);
  if (!text) {
    throw new Error('Gemini endpoint returned an empty response');
  }

  return {
    text,
    usage: normalizeGeminiUsage(data.usageMetadata),
  };
}

/**
 * SDK path preserves implicit prefix caching via systemInstruction on the model instance.
 * @param {import('../types.mjs').AdapterContext & { importSdk?: () => Promise<typeof import('@google/generative-ai')> }} ctx
 */
async function completeGeminiViaSdk(ctx) {
  const importSdk = ctx.importSdk ?? (() => import('@google/generative-ai'));
  const { GoogleGenerativeAI } = await importSdk();
  const { route, generation } = ctx;
  const apiKey = route.endpoint.apiKey;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required for Gemini adapter');
  }

  const systemPrompt = ctx.systemInstruction ?? ctx.messages.find((m) => m.role === 'system')?.content ?? '';
  const userContent = ctx.userContent ?? ctx.messages.find((m) => m.role === 'user')?.content ?? '';

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: route.model,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: generation.temperature ?? 0.4,
      maxOutputTokens: generation.maxOutputTokens ?? 8192,
    },
  });

  const result = await model.generateContent(userContent);
  const text = result.response.text();
  return {
    text,
    usage: normalizeGeminiUsage(result.response.usageMetadata),
  };
}

/**
 * @param {object} data
 */
export function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? '').join('').trim();
}

export default geminiAdapter;
