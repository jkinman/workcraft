/**
 * LinkedInScraper.mjs — Browser-based scraper for LinkedIn job search.
 *
 * Uses Playwright to navigate LinkedIn's public job-search pages,
 * extract listings, and return standardised job objects.
 *
 * Anti-bot measures:
 *   - Random user-agent rotation
 *   - Human-like delays between actions
 *   - Natural scroll behaviour
 *   - Cookie / sign-in modal dismissal
 *
 * Output shape:
 *   { title, url, company, location, source: 'linkedin', posted }
 *
 * Config:
 *   {
 *     keywords: 'Software Engineer',
 *     location: 'Canada',
 *     maxPages: 2,          // how many result pages to paginate through
 *     jobsPerPage: 25,      // LinkedIn default; used for limiting
 *     headless: true,
 *   }
 */

import { BaseScraper, sleep, randomInt } from './BaseScraper.mjs';

// ── Constants ─────────────────────────────────────────────────────────

const LINKEDIN_BASE = 'https://www.linkedin.com/jobs/search';

// Selectors (LinkedIn changes these occasionally — keep updated)
const SELECTORS = {
  jobCard: '.job-search-card',
  title: '.base-search-card__title',
  company: '.base-search-card__subtitle',
  location: '.job-search-card__location',
  timeLabel: 'time',
  link: 'a.base-card__full-link',
  nextBtn: 'button[aria-label="Next"]',
};

// ── Helpers ───────────────────────────────────────────────────────────

function buildSearchUrl(keywords, location, start = 0) {
  const params = new URLSearchParams();
  if (keywords) params.set('keywords', keywords);
  if (location) params.set('location', location);
  if (start > 0) params.set('start', String(start));
  params.set('f_TPR', 'r86400'); // past 24 hours
  return `${LINKEDIN_BASE}?${params.toString()}`;
}

function parseRelativeTime(text) {
  if (!text) return '';
  const lower = text.toLowerCase();
  if (lower.includes('hour') || lower.includes('minute')) return 'today';
  if (lower.includes('day')) {
    const m = lower.match(/(\d+)/);
    return m ? `${m[1]}d ago` : 'recent';
  }
  if (lower.includes('week')) {
    const m = lower.match(/(\d+)/);
    return m ? `${m[1]}w ago` : 'recent';
  }
  return text.trim();
}

// ── LinkedInScraper ───────────────────────────────────────────────────

export class LinkedInScraper extends BaseScraper {
  constructor(options = {}) {
    super({ name: 'LinkedIn', ...options });
  }

  /**
   * Scrape LinkedIn job search results.
   *
   * @param {object} config
   * @param {string} config.keywords   — search keywords (e.g. "Software Engineer")
   * @param {string} [config.location] — location filter (e.g. "Canada")
   * @param {number} [config.maxPages=2] — pages to iterate (25 jobs/page)
   * @param {number} [config.maxJobs=50] — hard cap on total jobs returned
   * @param {boolean} [config.headless=true]
   * @returns {Promise<Array<Job>>}
   */
  async scrape(config = {}) {
    const {
      keywords = 'Software Engineer',
      location = '',
      maxPages = 2,
      maxJobs = 50,
      headless = true,
    } = config;

    this.headless = headless;
    await this.init();

    const jobs = [];
    let pageNum = 0;

    try {
      while (pageNum < maxPages && jobs.length < maxJobs) {
        const start = pageNum * 25;
        const url = buildSearchUrl(keywords, location, start);
        this.log(`Navigating → ${url}`);

        const res = await this.page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
        if (!res || !res.ok()) {
          this.warn(`HTTP ${res?.status?.() || 'unknown'} — aborting pagination`);
          break;
        }

        // Dismiss any cookie / sign-in prompts
        await this.dismissDialogs();
        await this.humanDelay(1200, 2500);

        // Scroll to load lazy cards
        await this.humanScroll(4, 500);
        await sleep(800);

        // Extract cards
        const cards = await this.page.locator(SELECTORS.jobCard).all();
        this.log(`Found ${cards.length} cards on page ${pageNum + 1}`);

        if (cards.length === 0) {
          this.warn('No cards found — possible layout change or block');
          break;
        }

        for (const card of cards) {
          if (jobs.length >= maxJobs) break;

          const titleEl = card.locator(SELECTORS.title).first();
          const companyEl = card.locator(SELECTORS.company).first();
          const locationEl = card.locator(SELECTORS.location).first();
          const timeEl = card.locator(SELECTORS.timeLabel).first();
          const linkEl = card.locator(SELECTORS.link).first();

          const [title, company, loc, timeText, href] = await Promise.all([
            titleEl.textContent().catch(() => null),
            companyEl.textContent().catch(() => null),
            locationEl.textContent().catch(() => null),
            timeEl.getAttribute('datetime').catch(() => timeEl.textContent().catch(() => '')),
            linkEl.getAttribute('href').catch(() => null),
          ]);

          if (!title || !href) continue;

          const job = {
            title: title.trim(),
            url: href.split('?')[0], // strip tracking params
            company: (company || 'Unknown').trim(),
            location: (loc || '').trim(),
            source: 'linkedin',
            posted: parseRelativeTime(timeText),
          };

          jobs.push(job);
        }

        // Check for next page
        const nextBtn = this.page.locator(SELECTORS.nextBtn).first();
        const hasNext = await nextBtn.isVisible({ timeout: 3000 }).catch(() => false);
        if (!hasNext) {
          this.log('No next page — done');
          break;
        }

        pageNum++;
        await this.humanDelay(2000, 4000);
      }
    } catch (err) {
      this.error(`Scrape failed: ${err.message}`);
      throw err;
    } finally {
      await this.cleanup();
    }

    this.log(`Scraped ${jobs.length} jobs`);
    return jobs;
  }

  /**
   * Health-check LinkedIn's jobs search landing page.
   */
  async healthCheck() {
    return super.healthCheck('https://www.linkedin.com/jobs');
  }
}
