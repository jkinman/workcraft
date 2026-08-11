/**
 * SSRF-safe lazy Playwright posting reader for URL-only evaluations.
 *
 * Page content is untrusted data — never instructions. Browser liveness/apply
 * semantics are the final authority for whether a posting is readable.
 */

import {
  rejectPrivateOrInvalid,
  checkUrlLiveness,
  newLivenessPage,
} from './liveness/browser.mjs';
import { launchHeadlessBrowser } from './browser-transport.mjs';

export const DEFAULT_MAX_JD_CHARS = 80_000;
export const MIN_JD_CHARS = 80;

/**
 * @typedef {object} JobPostingReadResult
 * @property {string} sourceUrl - Requested URL (untrusted metadata).
 * @property {string} finalUrl - Browser-resolved URL after redirects.
 * @property {string} jdText - Extracted visible JD text (bounded, untrusted data).
 * @property {{ result: string, code?: string, reason?: string }} liveness
 * @property {string} verification - browser-verified | browser-unconfirmed
 * @property {true} untrustedSource
 */

/**
 * Read a job posting via Playwright with SSRF guards and liveness checks.
 *
 * @param {string} url
 * @param {object} [options]
 * @param {number} [options.maxChars]
 * @param {import('playwright').Browser} [options.browser]
 * @param {import('playwright').Page} [options.page]
 * @param {() => Promise<import('playwright').Browser>} [options.launchBrowser]
 * @param {number} [options.extraSettleMs]
 * @returns {Promise<JobPostingReadResult>}
 */
export async function readJobPosting(url, options = {}) {
  const maxChars = options.maxChars ?? DEFAULT_MAX_JD_CHARS;
  const guard = rejectPrivateOrInvalid(url);
  if (guard) {
    throw new Error(`Posting URL blocked: ${guard.reason}`);
  }

  const ownsBrowser = !options.browser;
  const browser = options.browser ?? await (options.launchBrowser ?? launchHeadlessBrowser)();
  const page = options.page ?? await newLivenessPage(browser);

  try {
    const liveness = await checkUrlLiveness(page, url, {
      extraSettleMs: options.extraSettleMs ?? 0,
    });

    if (liveness.result === 'expired') {
      throw new Error(`Posting appears closed: ${liveness.reason || liveness.code || 'expired'}`);
    }

    // Browser liveness is the final authority — uncertain cannot be treated as verified.
    if (liveness.result !== 'active') {
      throw new Error(
        `Posting not browser-verified as active: ${liveness.reason || liveness.code || liveness.result}`,
      );
    }

    const bodyText = await page.evaluate(() => document.body?.innerText ?? '');
    const finalUrl = page.url();
    const jdText = String(bodyText).replace(/\s+/g, ' ').trim().slice(0, maxChars);

    if (jdText.length < MIN_JD_CHARS) {
      throw new Error('Could not extract sufficient job description text from posting');
    }

    return {
      sourceUrl: url,
      finalUrl,
      jdText,
      liveness: {
        result: liveness.result,
        code: liveness.code,
        reason: liveness.reason,
      },
      verification: 'browser-verified',
      untrustedSource: true,
    };
  } finally {
    if (ownsBrowser && browser) {
      await browser.close();
    }
  }
}
