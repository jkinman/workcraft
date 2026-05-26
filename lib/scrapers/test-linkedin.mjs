#!/usr/bin/env node
/**
 * test-linkedin.mjs — Stand-alone test for the LinkedIn scraper.
 *
 * Usage:
 *   node lib/scrapers/test-linkedin.mjs [--headful] [--max-pages N]
 *
 * This script:
 *   1. Runs a health-check against LinkedIn
 *   2. Scrapes 1–2 pages of "Software Engineer" jobs in Canada
 *   3. Prints the first 5 results
 *   4. Verifies cleanup (browser closed)
 */

import { LinkedInScraper } from './LinkedInScraper.mjs';

const args = process.argv.slice(2);
const headful = args.includes('--headful');
const maxPagesFlag = args.indexOf('--max-pages');
const maxPages = maxPagesFlag !== -1 ? parseInt(args[maxPagesFlag + 1], 10) || 1 : 1;

async function main() {
  console.log('═'.repeat(50));
  console.log('LinkedIn Scraper Test');
  console.log('═'.repeat(50));

  const scraper = new LinkedInScraper({ headless: !headful });

  // ── Health check ──────────────────────────────────────────────────
  console.log('\n▶ Health check …');
  const health = await scraper.healthCheck();
  console.log('  Status:', health.ok ? 'OK' : 'FAIL', health.status || health.error || '');
  await scraper.cleanup();

  if (!health.ok) {
    console.error('\nHealth check failed — aborting scrape test.');
    process.exit(1);
  }

  // ── Scrape test ───────────────────────────────────────────────────
  console.log(`\n▶ Scraping (maxPages=${maxPages}, headful=${headful}) …\n`);

  const jobs = await scraper.scrape({
    keywords: 'Software Engineer',
    location: 'Canada',
    maxPages,
    maxJobs: 30,
    headless: !headful,
  });

  console.log('\n' + '─'.repeat(50));
  console.log(`Results: ${jobs.length} jobs scraped`);
  console.log('─'.repeat(50));

  for (const job of jobs.slice(0, 5)) {
    console.log(`\n  • ${job.title}`);
    console.log(`    Company : ${job.company}`);
    console.log(`    Location: ${job.location}`);
    console.log(`    Posted  : ${job.posted}`);
    console.log(`    URL     : ${job.url}`);
  }

  if (jobs.length > 5) {
    console.log(`\n  … and ${jobs.length - 5} more`);
  }

  // ── Cleanup verification ──────────────────────────────────────────
  console.log('\n▶ Cleanup check …');
  scraper.reset();
  console.log('  Browser closed:', scraper.browser === null);
  console.log('  Context closed:', scraper.context === null);
  console.log('  Page closed   :', scraper.page === null);

  console.log('\n' + '═'.repeat(50));
  console.log('Test complete ✓');
  console.log('═'.repeat(50));
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
