import { pass, fail } from '../helpers.mjs';

console.log('\nlib/discovery — import-safe lazy browser');

try {
  await import('../../lib/discovery/index.mjs');
  pass('lib/discovery/index.mjs imports without top-level Playwright');

  const { resolveAtsApi, checkLivenessViaApi, createLivenessSession } = await import('../../lib/discovery/liveness/index.mjs');
  if (typeof resolveAtsApi === 'function' && typeof checkLivenessViaApi === 'function') {
    pass('liveness facade exports API-first helpers');
  } else fail('liveness facade exports');

  if (typeof createLivenessSession === 'function') {
    pass('liveness facade exports reusable session');
  } else fail('liveness session export');

  const { getChromium } = await import('../../lib/discovery/browser-transport.mjs');
  if (typeof getChromium === 'function') {
    pass('browser transport exposes lazy getChromium without launching');
  } else fail('browser transport');
} catch (e) {
  fail(`lazy browser tests crashed: ${e.message}`);
}
