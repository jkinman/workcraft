/**
 * Lazy browser transport — Playwright is loaded only when a browser session is requested.
 */

let playwrightModule = null;

async function loadPlaywright() {
  if (playwrightModule) return playwrightModule;
  playwrightModule = await import('playwright');
  return playwrightModule;
}

export async function getChromium() {
  const { chromium } = await loadPlaywright();
  return chromium;
}

export async function launchHeadlessBrowser(options = {}) {
  const chromium = await getChromium();
  return chromium.launch({ headless: true, ...options });
}

export async function getDeepDiveScrapers() {
  try {
    return await import('../scrapers/index.mjs');
  } catch (error) {
    console.warn('[discovery] Deep-dive scrapers not available:', error.message);
    return null;
  }
}
