/**
 * Reusable Playwright liveness session — one browser, sequential URL checks.
 *
 * User-facing verification treats the browser snapshot as the final authority.
 * ATS API responses may be fetched as preflight hints but never establish
 * active/expired without a browser check.
 */

import { checkLivenessViaApi } from './api.mjs';
import {
  checkUrlLiveness,
  checkUrlLivenessWithFallback,
  createHeadedPageProvider,
  newLivenessPage,
  jitteredDelayMs,
  sleep,
} from './browser.mjs';
import { launchHeadlessBrowser, getChromium } from '../browser-transport.mjs';

export class LivenessSession {
  /**
   * @param {{ headedFallback?: boolean, throttleBaseMs?: number }} [opts]
   */
  constructor({ headedFallback = false, throttleBaseMs = 0 } = {}) {
    this.headedFallback = headedFallback;
    this.throttleBaseMs = throttleBaseMs;
    /** @type {import('playwright').Browser|null} */
    this.browser = null;
    /** @type {import('playwright').Page|null} */
    this.page = null;
    this.headed = null;
  }

  async ensureBrowser() {
    if (this.page) return;
    this.browser = await launchHeadlessBrowser();
    this.page = await newLivenessPage(this.browser);
    if (this.headedFallback) {
      this.headed = createHeadedPageProvider(await getChromium());
    }
  }

  /**
   * Browser snapshot is the verdict. API result is returned as `apiHint` only.
   *
   * @param {string} url
   * @returns {Promise<{ result: string, code?: string, reason: string, apiHint: object|null }>}
   */
  async checkPosting(url) {
    const apiHint = await checkLivenessViaApi(url);
    await this.ensureBrowser();
    const getHeadedPage = this.headed ? () => this.headed.get() : undefined;
    const browserResult = this.headedFallback
      ? await checkUrlLivenessWithFallback(this.page, url, { getHeadedPage })
      : await checkUrlLiveness(this.page, url);
    return { ...browserResult, apiHint };
  }

  /**
   * Sequential offer verification for scan --verify (Playwright required).
   *
   * @param {object[]} offers
   * @param {{ rediscover?: boolean, searchForNewUrl?: Function, log?: Function }} [opts]
   */
  async verifyOffers(offers, { rediscover = false, searchForNewUrl, log = (...a) => console.log(...a) } = {}) {
    const GUARD_CODES = new Set(['invalid_url', 'unsupported_protocol', 'blocked_host']);
    const verified = [];
    const expired = [];
    const dropped = [];
    const invalid = [];
    const migrated = [];

    await this.ensureBrowser();
    const getHeadedPage = this.headed ? () => this.headed.get() : undefined;

    for (let i = 0; i < offers.length; i++) {
      const offer = offers[i];
      const browserResult = this.headedFallback
        ? await checkUrlLivenessWithFallback(this.page, offer.url, { getHeadedPage })
        : await checkUrlLiveness(this.page, offer.url);
      const { result, code, reason } = browserResult;

      if (result === 'expired') {
        if (rediscover && code === 'http_gone' && offer.tracked && offer.careersUrlDomain && searchForNewUrl) {
          const newUrl = await searchForNewUrl(this.page, offer);
          if (newUrl) {
            const recheck = this.headedFallback
              ? await checkUrlLivenessWithFallback(this.page, newUrl, { getHeadedPage })
              : await checkUrlLiveness(this.page, newUrl);
            if (recheck.result === 'active') {
              migrated.push({ ...offer, url: newUrl, previousUrl: offer.url });
              log(`  🔄 migrated  ${offer.company} | ${offer.title} → ${newUrl}`);
              continue;
            }
          }
        }
        expired.push({ ...offer, reason });
        log(`  ❌ expired   ${offer.company} | ${offer.title} (${reason})`);
      } else if (result === 'uncertain' && GUARD_CODES.has(code)) {
        invalid.push({ ...offer, code, reason });
        log(`  ⛔ invalid   ${offer.company} | ${offer.title} (${reason})`);
      } else if (result === 'uncertain' && code === 'no_apply_control') {
        dropped.push({ ...offer, reason });
        log(`  ⚠️ no-apply  ${offer.company} | ${offer.title} (${reason})`);
      } else {
        verified.push(offer);
        const icon = result === 'active' ? '✅' : '⚠️';
        log(`  ${icon} ${result.padEnd(9)} ${offer.company} | ${offer.title}`);
      }

      const wait = i < offers.length - 1 ? jitteredDelayMs(this.throttleBaseMs) : 0;
      if (wait) await sleep(wait);
    }

    return { verified, expired, dropped, invalid, migrated };
  }

  async close() {
    if (this.headed) await this.headed.close();
    if (this.browser) await this.browser.close();
    this.browser = null;
    this.page = null;
    this.headed = null;
  }
}

/**
 * @param {{ headedFallback?: boolean, throttleBaseMs?: number }} [opts]
 */
export function createLivenessSession(opts = {}) {
  return new LivenessSession(opts);
}
