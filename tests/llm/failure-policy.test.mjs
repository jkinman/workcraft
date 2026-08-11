import { pass, fail } from '../helpers.mjs';
import {
  isFallbackEligibleError,
  getErrorStatus,
  NON_FALLBACK_STATUSES,
} from '../../lib/llm/failure-policy.mjs';
import { HttpResponseError } from '../../lib/llm/retry.mjs';

console.log('\nllm failure-policy tests');

try {
  if (!isFallbackEligibleError(new HttpResponseError(503, 'down'))) {
    fail('503 should be fallback eligible');
  } else {
    pass('503 provider errors are fallback eligible');
  }

  if (isFallbackEligibleError(new HttpResponseError(401, 'auth'))) {
    fail('401 should not be fallback eligible');
  } else {
    pass('401 auth errors are not fallback eligible');
  }

  for (const status of NON_FALLBACK_STATUSES) {
    if (isFallbackEligibleError(new HttpResponseError(status, 'x'))) {
      fail(`${status} should not be fallback eligible`);
    }
  }
  pass('all NON_FALLBACK_STATUSES reject fallback');

  const timeoutErr = new DOMException('Timeout', 'TimeoutError');
  if (isFallbackEligibleError(timeoutErr)) {
    pass('TimeoutError is fallback eligible');
  } else {
    fail('TimeoutError should trigger fallback');
  }

  if (getErrorStatus(new HttpResponseError(429, '')) === 429) {
    pass('getErrorStatus extracts HttpResponseError status');
  } else {
    fail('getErrorStatus failed');
  }
} catch (e) {
  fail(`failure-policy tests crashed: ${e.message}`);
}
