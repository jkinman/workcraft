import { pass, fail } from '../helpers.mjs';
import {
  mergeRetryPolicy,
  retryDelayMs,
  isRetryableError,
  withRetries,
  HttpResponseError,
} from '../../lib/llm/retry.mjs';

console.log('\nllm retry/timeout tests');

try {
  const policy = mergeRetryPolicy({ maxAttempts: 4, initialDelayMs: 100 });
  if (policy.maxAttempts === 4 && policy.retryableStatuses.includes(429)) {
    pass('mergeRetryPolicy merges overrides with defaults');
  } else {
    fail('mergeRetryPolicy failed');
  }

  if (retryDelayMs(2, policy) === 200 && retryDelayMs(10, policy) <= policy.maxDelayMs) {
    pass('retryDelayMs exponential backoff respects maxDelayMs');
  } else {
    fail('retryDelayMs failed');
  }

  if (isRetryableError(new HttpResponseError(503, 'down'), 503, policy)) {
    pass('isRetryableError marks retryable HTTP statuses');
  } else {
    fail('503 should be retryable');
  }

  let attempts = 0;
  const outcome = await withRetries({
    policy: { maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 5 },
    run: async () => {
      attempts += 1;
      if (attempts < 3) throw new HttpResponseError(429, 'rate limited');
      return 'ok';
    },
  });
  if (outcome.result === 'ok' && outcome.attempts === 3) {
    pass('withRetries succeeds after retryable failures');
  } else {
    fail(`withRetries unexpected: ${JSON.stringify(outcome)} attempts=${attempts}`);
  }

  let nonRetryAttempts = 0;
  try {
    await withRetries({
      policy: { maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 5 },
      run: async () => {
        nonRetryAttempts += 1;
        throw new HttpResponseError(400, 'bad request');
      },
    });
    fail('expected withRetries to throw on non-retryable 400');
  } catch (err) {
    if (nonRetryAttempts === 1 && err.status === 400) {
      pass('withRetries does not retry non-retryable HTTP errors');
    } else {
      fail(`non-retry behavior failed: attempts=${nonRetryAttempts} err=${err.message}`);
    }
  }
} catch (e) {
  fail(`retry tests crashed: ${e.message}`);
}
