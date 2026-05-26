/**
 * registry.mjs — Scraper registry / factory.
 *
 * Provides a central way to instantiate scrapers by name and
 * run deep-dive scans across multiple sources.
 *
 * Usage:
 *   import { createScraper, runDeepDive } from './registry.mjs';
 *
 *   const li = createScraper('linkedin', { headless: true });
 *   const jobs = await li.scrape({ keywords: 'AI Engineer', location: 'Remote' });
 *
 *   // Or orchestrate multiple scrapers at once:
 *   const results = await runDeepDive([
 *     { name: 'linkedin', config: { keywords: 'SWE', maxPages: 2 } },
 *     { name: 'indeed',   config: { keywords: 'SWE', maxPages: 2 } },
 *   ], { headless: true });
 */

import { LinkedInScraper } from './LinkedInScraper.mjs';
import { IndeedScraper } from './IndeedScraper.mjs';

// ── Registry map ──────────────────────────────────────────────────────

const SCRAPER_MAP = {
  linkedin: LinkedInScraper,
  indeed: IndeedScraper,
};

/**
 * Return a list of registered scraper names.
 * @returns {string[]}
 */
export function listScrapers() {
  return Object.keys(SCRAPER_MAP);
}

/**
 * Instantiate a scraper by name.
 *
 * @param {string} name — 'linkedin' | 'indeed'
 * @param {object} [options] — forwarded to scraper constructor
 * @returns {import('./BaseScraper.mjs').BaseScraper}
 * @throws {Error} if name is unknown
 */
export function createScraper(name, options = {}) {
  const ScraperClass = SCRAPER_MAP[name.toLowerCase()];
  if (!ScraperClass) {
    throw new Error(`Unknown scraper "${name}". Available: ${listScrapers().join(', ')}`);
  }
  return new ScraperClass(options);
}

/**
 * Run a health-check on every registered scraper.
 *
 * @param {object} [options]
 * @returns {Promise<Array<{name:string, ok:boolean, details:object}>>}
 */
export async function healthCheckAll(options = {}) {
  const results = [];
  for (const name of listScrapers()) {
    const scraper = createScraper(name, options);
    try {
      const details = await scraper.healthCheck();
      results.push({ name, ok: details.ok, details });
    } catch (err) {
      results.push({ name, ok: false, details: { error: err.message } });
    } finally {
      await scraper.cleanup();
    }
  }
  return results;
}

/**
 * Deep-dive runner: orchestrate multiple scrapers in parallel.
 *
 * Each task is an object:
 *   { name: 'linkedin', config: { keywords: '…', location: '…', maxPages: 2 } }
 *
 * Options:
 *   { headless?: boolean, concurrency?: number, onProgress?: (name, count) => void }
 *
 * Returns a map of scraper name → { jobs: Job[], errors?: string }.
 */
export async function runDeepDive(tasks, options = {}) {
  const {
    headless = true,
    concurrency = 2,
    onProgress = null,
  } = options;

  const results = {};
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const task = tasks[index++];
      const scraper = createScraper(task.name, { headless, ...task.options });
      const label = `${task.name} (${task.config?.keywords || 'all'})`;

      try {
        console.log(`\n[deep-dive] Starting ${label}`);
        const jobs = await scraper.scrape(task.config || {});
        results[task.name] = { jobs };
        if (onProgress) onProgress(task.name, jobs.length);
        console.log(`[deep-dive] Finished ${label} — ${jobs.length} jobs`);
      } catch (err) {
        results[task.name] = { jobs: [], errors: err.message };
        console.error(`[deep-dive] Failed ${label}: ${err.message}`);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);

  return results;
}
