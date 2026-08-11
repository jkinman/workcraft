/**
 * Liveness facade — browser snapshot is the final authority for user-facing checks.
 * ATS API responses are preflight hints only.
 */

export { classifyLiveness } from './core.mjs';
export {
  checkLivenessViaApi,
  classifyAshbyBoard,
  resolveAtsApi,
  isAtsPosting,
} from './api.mjs';
export {
  checkUrlLiveness,
  checkUrlLivenessWithFallback,
  createHeadedPageProvider,
  newLivenessPage,
  jitteredDelayMs,
  sleep,
  rejectPrivateOrInvalid,
  isChallengeResult,
  setHostResolver,
  LIVENESS_CONTEXT_OPTIONS,
} from './browser.mjs';
export { LivenessSession, createLivenessSession } from './session.mjs';

import { createLivenessSession } from './session.mjs';

/**
 * Check posting liveness with Playwright as the verdict. API hint is optional metadata.
 *
 * @param {string} url
 * @param {{ headedFallback?: boolean, throttleBaseMs?: number }} [opts]
 */
export async function checkPostingLiveness(url, opts = {}) {
  const session = createLivenessSession(opts);
  try {
    return await session.checkPosting(url);
  } finally {
    await session.close();
  }
}

export { isChallengeResult as isBotChallengeResult } from './browser.mjs';
