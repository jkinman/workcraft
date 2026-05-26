# Deep-Dive Browser Scrapers

Browser-based job scrapers for job boards that don't offer public APIs.
Built on Playwright, integrated with the existing `scan.mjs` pipeline.

## Architecture

```
lib/scrapers/
├── BaseScraper.mjs      # Abstract base class (browser lifecycle, anti-bot)
├── LinkedInScraper.mjs  # LinkedIn job search scraper
├── IndeedScraper.mjs    # Indeed job search scraper (currently blocked)
├── registry.mjs         # Factory + orchestration (runDeepDive)
├── index.mjs            # Public API exports
└── test-linkedin.mjs    # Standalone test script
```

## Usage

### Command Line

```bash
# Standard API scan (unchanged)
node scan.mjs
node scan.mjs --dry-run
node scan.mjs --company Anthropic

# Deep-dive browser scan (NEW)
node scan.mjs --deep-dive
node scan.mjs --deep-dive --dry-run
```

### Programmatic

```javascript
import { createScraper, runDeepDive } from './lib/scrapers/index.mjs';

// Single scraper
const li = createScraper('linkedin', { headless: true });
const jobs = await li.scrape({
  keywords: 'Software Engineer',
  location: 'Vancouver',
  maxPages: 2,
  maxJobs: 50
});

// Orchestrate multiple scrapers
const results = await runDeepDive([
  { name: 'linkedin', config: { keywords: 'SWE', location: 'Canada' } }
], { headless: true, concurrency: 1 });
```

## Configuration

Add to `portals.yml`:

```yaml
deep_dive:
  enabled: true
  headless: true
  concurrency: 1
  tasks:
    - name: linkedin
      enabled: true
      config:
        keywords: "Senior Software Engineer"
        location: "Vancouver, British Columbia, Canada"
        maxPages: 2
        maxJobs: 50
```

## Anti-Bot Measures

- Random user-agent rotation
- Human-like delays (800-2500ms between actions)
- Natural scroll behaviour
- Cookie/sign-in modal dismissal
- `--disable-blink-features=AutomationControlled` flag
- `navigator.webdriver` property masked

## Known Limitations

| Board | Status | Notes |
|-------|--------|-------|
| **LinkedIn** | ✅ Working | 10-30 jobs per scan, occasional sign-in wall |
| **Indeed** | ❌ Blocked | Returns "Blocked" page. Needs proxy rotation or residential IP |
| **Glassdoor** | 🔲 Not built | Would face same blocking as Indeed |
| **Google Jobs** | 🔲 Not built | Requires SERP scraping |

## Maintenance

### If LinkedIn stops working:

1. Run `node lib/scrapers/test-linkedin.mjs --headful` to see the page visually
2. Check if selectors changed (update `SELECTORS` in `LinkedInScraper.mjs`)
3. Check if title contains "Sign In" or "Blocked"
4. Try increasing `humanDelay()` values

### Adding a new scraper:

1. Extend `BaseScraper` in `NewBoardScraper.mjs`
2. Implement `scrape(config)` returning `{ title, url, company, location, source, posted }[]`
3. Add to `SCRAPER_MAP` in `registry.mjs`
4. Add config to `portals.yml` `deep_dive.tasks`
5. Add portal badge CSS to `views.js`

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Found 0 cards" | Layout changed | Update SELECTORS |
| "Blocked" | Bot detection | Increase delays, try headful mode |
| Hangs indefinitely | Stuck in scroll/click loop | Check `isVisible()` timeouts |
| Browser won't launch | Missing Chromium | Set `CHROMIUM_PATH` env var |

## Integration with scan.mjs

The deep-dive module is **lazy-loaded** — `scan.mjs` imports it only when `--deep-dive` is passed. If the module is missing or broken, standard API scans continue to work.

The same deduplication, title filtering, and pipeline writing logic is reused:
- `loadSeenUrls()` / `loadSeenCompanyRoles()`
- `buildTitleFilter()`
- `appendToPipeline()` / `appendToScanHistory()`
