/**
 * BaseScraper.mjs — Abstract base class for browser-based job scrapers.
 *
 * Provides common lifecycle, anti-bot helpers, and a standardised output shape.
 * Subclasses must implement:
 *   - async scrape(config) → Array<{ title, url, company, location, source, posted }>
 *
 * Usage:
 *   import { BaseScraper } from './BaseScraper.mjs';
 *   class MyScraper extends BaseScraper { … }
 */

import { getChromium } from '../discovery/browser-transport.mjs';

// ── Constants ─────────────────────────────────────────────────────────

const DEFAULT_USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];

const DEFAULT_VIEWPORT = { width: 1366, height: 768 };

/**
 * Sleep for ms milliseconds.
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Return a random integer between min and max (inclusive).
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Pick a random element from an array.
 */
export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── BaseScraper ───────────────────────────────────────────────────────

export class BaseScraper {
  /**
   * @param {object} options
   * @param {string} [options.name]          — human-readable scraper name
   * @param {boolean} [options.headless=true] — run browser headlessly
   * @param {string} [options.chromiumPath]  — path to Chromium binary
   * @param {string[]} [options.userAgents]  — custom UA rotation list
   * @param {object} [options.viewport]      — custom viewport
   * @param {number} [options.defaultTimeout=30000] — default page timeout
   */
  constructor(options = {}) {
    if (new.target === BaseScraper) {
      throw new TypeError('Cannot instantiate BaseScraper directly; extend it.');
    }

    this.name = options.name || this.constructor.name;
    this.headless = options.headless !== false;
    this.chromiumPath = options.chromiumPath || process.env.CHROMIUM_PATH || '/usr/bin/chromium';
    this.userAgents = options.userAgents || DEFAULT_USER_AGENTS;
    this.viewport = options.viewport || DEFAULT_VIEWPORT;
    this.defaultTimeout = options.defaultTimeout || 30000;

    /** @type {import('playwright').Browser|null} */
    this.browser = null;
    /** @type {import('playwright').BrowserContext|null} */
    this.context = null;
    /** @type {import('playwright').Page|null} */
    this.page = null;

    this._closed = false;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────

  /**
   * Launch the browser, create a context + page with anti-fingerprinting.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  async init() {
    if (this.browser) return;

    const args = [
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ];

    const chromium = await getChromium();
    this.browser = await chromium.launch({
      headless: this.headless,
      executablePath: this.chromiumPath,
      args,
    });

    this.context = await this.browser.newContext({
      viewport: this.viewport,
      userAgent: pickRandom(this.userAgents),
      locale: 'en-US',
      timezoneId: 'America/Toronto',
      permissions: ['geolocation'],
    });

    // Mask webdriver property
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(this.defaultTimeout);

    this.log('Browser launched');
  }

  /**
   * Close browser and null out handles. Safe to call multiple times.
   */
  async cleanup() {
    if (this._closed) return;
    this._closed = true;

    try {
      if (this.page) await this.page.close();
    } catch (_e) { /* ignore */ }

    try {
      if (this.context) await this.context.close();
    } catch (_e) { /* ignore */ }

    try {
      if (this.browser) await this.browser.close();
    } catch (_e) { /* ignore */ }

    this.page = null;
    this.context = null;
    this.browser = null;

    this.log('Browser closed');
  }

  /**
   * Reset the closed flag so the scraper can be re-used.
   */
  reset() {
    this._closed = false;
  }

  /**
   * Ensure cleanup runs even if the caller forgets it.
   */
  async [Symbol.asyncDispose]() {
    await this.cleanup();
  }

  // ── Abstract interface ──────────────────────────────────────────────

  /**
   * Scrape jobs. Must be implemented by subclass.
   *
   * @param {object} config
   * @returns {Promise<Array<{title:string, url:string, company:string, location:string, source:string, posted?:string}>>}
   */
  async scrape(_config) {
    throw new Error('Subclasses must implement scrape()');
  }

  /**
   * Quick health check — can we reach the target site?
   * Default implementation navigates to the given URL and checks status.
   *
   * @param {string} url
   * @returns {Promise<{ok:boolean, status?:number, error?:string}>}
   */
  async healthCheck(url) {
    try {
      await this.init();
      const res = await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      return { ok: res.ok(), status: res.status() };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  // ── Anti-bot helpers ────────────────────────────────────────────────

  /**
   * Human-like delay with optional jitter.
   *
   * @param {number} minMs
   * @param {number} maxMs
   */
  async humanDelay(minMs = 800, maxMs = 2500) {
    const ms = randomInt(minMs, maxMs);
    this.log(`Delay ${ms} ms`);
    await sleep(ms);
  }

  /**
   * Scroll to the bottom of the page in small increments.
   *
   * @param {number} steps
   * @param {number} pauseMs
   */
  async humanScroll(steps = 5, pauseMs = 400) {
    for (let i = 0; i < steps; i++) {
      await this.page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.7));
      await sleep(pauseMs + randomInt(-100, 100));
    }
  }

  /**
   * Try to dismiss common cookie / sign-in modals by clicking common selectors.
   */
  async dismissDialogs(selectors = []) {
    const defaults = [
      'button[action-type="deny"]',
      '[data-testid="close-button"]',
      'button:has-text("Accept")',
      'button:has-text("Reject")',
      'button:has-text("No thanks")',
      'button:has-text("Not now")',
      'button:has-text("Dismiss")',
      '[aria-label="Dismiss"]',
      '#artdeco-global-alert-container button',
    ];
    const all = [...defaults, ...selectors];

    for (const sel of all) {
      try {
        const btn = this.page.locator(sel).first();
        if (await btn.isVisible({ timeout: 2000 })) {
          await btn.click({ timeout: 3000 });
          this.log(`Dismissed dialog via ${sel}`);
          await sleep(300);
        }
      } catch (_e) {
        // ignore — dialog not present or not clickable
      }
    }
  }

  // ── Logging ─────────────────────────────────────────────────────────

  log(...args) {
    const ts = new Date().toISOString().slice(11, 19);
    console.log(`[${ts}] [${this.name}]`, ...args);
  }

  warn(...args) {
    const ts = new Date().toISOString().slice(11, 19);
    console.warn(`[${ts}] [${this.name}] ⚠`, ...args);
  }

  error(...args) {
    const ts = new Date().toISOString().slice(11, 19);
    console.error(`[${ts}] [${this.name}] ✗`, ...args);
  }
}
