/**
 * Behavioral tests for lib/evaluation/guards.mjs — provider endpoint security.
 */

import { pass, fail } from '../helpers.mjs';

console.log('\nlib/evaluation — guards');

function expectThrow(fn, pattern, label) {
  try {
    fn();
    fail(`${label}: expected throw matching ${pattern}`);
  } catch (err) {
    if (pattern.test(err.message)) pass(label);
    else fail(`${label}: wrong message "${err.message}"`);
  }
}

function expectOk(fn, label) {
  try {
    const result = fn();
    pass(label);
    return result;
  } catch (err) {
    fail(`${label}: unexpected throw "${err.message}"`);
    return null;
  }
}

try {
  const {
    parseEndpointHost,
    assertHostedOpenAiEndpoint,
    assertOllamaLoopback,
    parseTimeoutMs,
  } = await import('../../lib/evaluation/guards.mjs');

  const loopback = parseEndpointHost('http://localhost:11434/v1');
  if (loopback.isLoopback && loopback.host === 'localhost' && loopback.protocol === 'http:') {
    pass('parseEndpointHost marks localhost as loopback');
  } else {
    fail(`parseEndpointHost loopback mismatch: ${JSON.stringify(loopback)}`);
  }

  expectThrow(
    () => parseEndpointHost('not-a-url'),
    /Invalid base URL/,
    'parseEndpointHost rejects malformed base URLs',
  );

  expectOk(
    () => assertHostedOpenAiEndpoint({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'test-key',
    }),
    'assertHostedOpenAiEndpoint allows remote HTTPS with API key',
  );

  expectOk(
    () => assertHostedOpenAiEndpoint({
      baseUrl: 'http://localhost:11434/v1',
      apiKey: '',
    }),
    'assertHostedOpenAiEndpoint allows loopback HTTP without API key',
  );

  expectThrow(
    () => assertHostedOpenAiEndpoint({
      baseUrl: 'http://api.openai.com/v1',
      apiKey: 'test-key',
    }),
    /non-HTTPS remote/,
    'assertHostedOpenAiEndpoint rejects remote HTTP endpoints',
  );

  expectThrow(
    () => assertHostedOpenAiEndpoint({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
    }),
    /No API key/,
    'assertHostedOpenAiEndpoint rejects remote HTTPS without API key',
  );

  expectThrow(
    () => assertHostedOpenAiEndpoint({
      baseUrl: 'http://192.168.1.5/v1',
      apiKey: 'test-key',
      providerLabel: 'custom endpoint',
    }),
    /non-HTTPS remote custom endpoint/,
    'assertHostedOpenAiEndpoint uses providerLabel in remote HTTP error',
  );

  expectOk(
    () => assertOllamaLoopback({ baseUrl: 'http://localhost:11434' }),
    'assertOllamaLoopback allows localhost Ollama',
  );

  expectOk(
    () => assertOllamaLoopback({ baseUrl: 'http://127.0.0.1:11434' }),
    'assertOllamaLoopback allows 127.0.0.1 Ollama',
  );

  expectThrow(
    () => assertOllamaLoopback({ baseUrl: 'http://192.168.1.5:11434', env: {} }),
    /Remote Ollama endpoint/,
    'assertOllamaLoopback blocks remote Ollama without opt-in',
  );

  expectOk(
    () => assertOllamaLoopback({
      baseUrl: 'http://192.168.1.5:11434',
      env: { OLLAMA_ALLOW_REMOTE: '1' },
    }),
    'assertOllamaLoopback allows remote Ollama when OLLAMA_ALLOW_REMOTE=1',
  );

  if (parseTimeoutMs('120000') === 120_000) {
    pass('parseTimeoutMs parses positive integer env values');
  } else {
    fail('parseTimeoutMs failed to parse valid timeout');
  }

  if (parseTimeoutMs(undefined, 300_000) === 300_000) {
    pass('parseTimeoutMs falls back to default');
  } else {
    fail('parseTimeoutMs default fallback regressed');
  }

  expectThrow(
    () => parseTimeoutMs('abc'),
    /Invalid timeout/,
    'parseTimeoutMs rejects non-numeric values',
  );

  expectThrow(
    () => parseTimeoutMs('0'),
    /Invalid timeout/,
    'parseTimeoutMs rejects zero',
  );
} catch (err) {
  fail(`guards tests crashed: ${err.message}`);
}
