/**
 * IndeedScraper.mjs — Browser-based scraper for Indeed job search.
 *
 * Uses Playwright to navigate Indeed's public search pages,
 * extract listings, and return standardised job objects.
 *
 * Anti-bot measures:
 *   - Random user-agent rotation
 *   - Human-like delays between actions
 *   - Natural scroll behaviour
 *   - Cookie / sign-in modal dismissal
 *
 * Output shape:
 *   { title, url, company, location, source: 'indeed', posted }
 *
 * Config:
 *   {
 *     keywords: 'Software Engineer',
 *     location: 'Canada',
 *     maxPages: 2,
 *     maxJobs: 50,
 *     headless: true,
 *   }
 */

import { BaseScraper, sleep, randomInt } from './BaseScraper.mjs';

// ── Constants ─────────────────────────────────────────────────────────

const INDEED_BASE = 'https://www.indeed.com/jobs';

// Selectors (Indeed changes these occasionally — keep updated)
const SELECTORS = {
  jobCard: '[data-testid="slider_item"]',
  title: '[data-testid="slider_title"]',
  company: '[data-testid="company-name"]',
  location: '[data-testid="text-location"]',
  timeLabel: '[data-testid="job-date"] span',
  link: 'a.jcs-JobTitle',
  nextBtn: 'a[data-testid="pagination-page-next"]',
};

// ── Helpers ───────────────────────────────────────────────────────────

function buildSearchUrl(keywords, location, start = 0) {
  const params = new URLSearchParams();
  if (keywords) params.set('q', keywords);
  if (location) params.set('l', location);
  if (start > 0) params.set('start', String(start));
  params.set('fromage', '1'); // past 24 hours
  return `${INDEED_BASE}?${params.toString()}`;
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

// ── IndeedScraper ─────────────────────────────────────────────────────

export class IndeedScraper extends BaseScraper {
  constructor(options = {}) {
    super({ name: 'Indeed', ...options });
  }

  /**
   * Scrape Indeed job search results.
   *
   * @param {object} config
   * @param {string} config.keywords   — search keywords (e.g. "Software Engineer")
   * @param {string} [config.location] — location filter (e.g. "Canada")
   * @param {number} [config.maxPages=2] — pages to iterate (15 jobs/page)
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
        const start = pageNum * 15;
        const url = buildSearchUrl(keywords, location, start);
        this.log(`Navigating → ${url}`);

        const res = await this.page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
        if (!res || !res.ok()) {
          this.warn(`HTTP ${res?.status?.() || 'unknown'} — aborting pagination`);
          break;
        }

        // Check for blocked page
        const title = await this.page.title().catch(() => '');
        if (title.toLowerCase().includes('blocked') || title.toLowerCase().includes('access denied')) {
          this.error(`Blocked by Indeed (title: "${title}"). Try again later or use a different IP.`);
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

          try {
            const titleEl = card.locator(SELECTORS.title).first();
            const companyEl = card.locator(SELECTORS.company).first();
            const locationEl = card.locator(SELECTORS.location).first();
            const timeEl = card.locator(SELECTORS.timeLabel).first();
            const linkEl = card.locator(SELECTORS.link).first();

            const [title, company, loc, timeText, href] = await Promise.all([
              titleEl.textContent().catch(() => null),
              companyEl.textContent().catch(() => null),
              locationEl.textContent().catch(() => null),
              timeEl.textContent().catch(() => ''),
              linkEl.getAttribute('href').catch(() => null),
            ]);

            if (!title || !href) continue;

            const absoluteUrl = href.startsWith('http') ? href : `https://www.indeed.com${href}`;

            const job = {
              title: title.trim(),
              url: absoluteUrl.split('?')[0],
              company: (company || 'Unknown').trim(),
              location: (loc || '').trim(),
              source: 'indeed',
              posted: parseRelativeTime(timeText),
            };

            jobs.push(job);
          } catch (cardErr) {
            this.warn(`Card parse error: ${cardErr.message}`);
            continue;
          }
        }

        // Check for next page
        try {
          const nextBtn = this.page.locator(SELECTORS.nextBtn).first();
          const hasNext = await nextBtn.isVisible({ timeout: 1500 }).catch(() => false);
          if (!hasNext) {
            this.log('No next page — done');
            break;
          }
        } catch (_e) {
          this.log('No next page (error) — done');
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
   * Health-check Indeed's jobs search landing page.
   */
  async healthCheck() {
    return super.healthCheck('https://www.indeed.com');
  }
}
