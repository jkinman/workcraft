import { pass, fail } from '../helpers.mjs';
import { buildSystemMessage } from '../../lib/llm/adapters/openai-compatible.mjs';
import { extractGeminiText } from '../../lib/llm/adapters/gemini.mjs';
import { normalizeGeminiUsage } from '../../lib/llm/usage-normalize.mjs';

console.log('\nllm adapter contract tests');

try {
  const openaiMsg = buildSystemMessage('static prefix', 'api.openai.com');
  const routerMsg = buildSystemMessage('static prefix', 'openrouter.ai');
  if (typeof openaiMsg.content === 'string' && Array.isArray(routerMsg.content)) {
    pass('buildSystemMessage uses plain string on api.openai.com and cache_control elsewhere');
  } else {
    fail('buildSystemMessage host gating failed');
  }

  const geminiText = extractGeminiText({
    candidates: [{ content: { parts: [{ text: 'Hello' }, { text: ' world' }] } }],
  });
  if (geminiText === 'Hello world') {
    pass('extractGeminiText concatenates candidate parts');
  } else {
    fail(`extractGeminiText failed: ${geminiText}`);
  }

  const usage = normalizeGeminiUsage({
    promptTokenCount: 100,
    candidatesTokenCount: 20,
    totalTokenCount: 120,
    cachedContentTokenCount: 40,
  });
  if (usage.cached_tokens === 40 && usage.prompt_tokens === 100) {
    pass('normalizeGeminiUsage maps cachedContentTokenCount');
  } else {
    fail('normalizeGeminiUsage failed');
  }

  let capturedBody;
  const fetchImpl = async (_url, init) => {
    capturedBody = JSON.parse(init.body);
    return {
      ok: true,
      async json() {
        return {
          choices: [{ message: { content: 'adapter-ok' } }],
          usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
        };
      },
    };
  };

  const { completeOpenAICompatible } = await import('../../lib/llm/adapters/openai-compatible.mjs');
  const result = await completeOpenAICompatible({
    route: {
      adapterId: 'openai-compatible',
      provider: 'openrouter',
      model: 'deepseek/deepseek-chat',
      spendTier: 'standard',
      capabilities: ['chat'],
      budgetCeilingUsd: null,
      fallbacks: [],
      endpoint: {
        baseUrl: 'https://openrouter.ai/api/v1',
        host: 'openrouter.ai',
        apiKey: 'test-key',
      },
    },
    messages: [
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ],
    generation: { temperature: 0.2, maxOutputTokens: 100 },
    timeoutMs: 1000,
    fetch: fetchImpl,
    attempt: 1,
    signal: undefined,
  });

  if (result.text === 'adapter-ok' && capturedBody.model === 'deepseek/deepseek-chat') {
    pass('openai-compatible adapter posts chat/completions via injectable fetch');
  } else {
    fail('openai-compatible adapter contract failed');
  }

  let geminiPayload;
  const geminiFetch = async (_url, init) => {
    geminiPayload = JSON.parse(init.body);
    return {
      ok: true,
      async json() {
        return {
          candidates: [{ content: { parts: [{ text: 'gemini-ok' }] } }],
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2, totalTokenCount: 7, cachedContentTokenCount: 1 },
        };
      },
    };
  };

  const { completeGemini } = await import('../../lib/llm/adapters/gemini.mjs');
  const geminiResult = await completeGemini({
    route: {
      adapterId: 'gemini',
      provider: 'gemini',
      model: 'gemini-3.6-flash',
      spendTier: 'standard',
      capabilities: ['chat'],
      budgetCeilingUsd: null,
      fallbacks: [],
      endpoint: {
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        host: 'generativelanguage.googleapis.com',
        apiKey: 'g-test',
      },
    },
    systemInstruction: 'cached prefix',
    userContent: 'jd body',
    messages: [],
    generation: {},
    timeoutMs: 1000,
    fetch: geminiFetch,
    attempt: 1,
    signal: undefined,
    useSdk: false,
  });

  if (
    geminiResult.text === 'gemini-ok'
    && geminiPayload.systemInstruction?.parts?.[0]?.text === 'cached prefix'
    && geminiResult.usage.cached_tokens === 1
  ) {
    pass('gemini HTTP adapter preserves systemInstruction cache semantics');
  } else {
    fail('gemini adapter contract failed');
  }
} catch (e) {
  fail(`adapter tests crashed: ${e.message}`);
}
