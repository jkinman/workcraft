import { readFileSync } from 'fs';
import { pass, fail } from '../helpers.mjs';

console.log('\nscan-interamt — lazy Playwright import');

try {
  const source = readFileSync(new URL('../../scan-interamt.mjs', import.meta.url), 'utf8');
  if (/^\s*import\s+.*from\s+['"]playwright['"]/m.test(source)) {
    fail('scan-interamt.mjs still has top-level playwright import');
  } else {
    pass('scan-interamt.mjs has no top-level playwright import');
  }

  if (!source.includes('getChromium')) {
    fail('scan-interamt.mjs missing getChromium from browser-transport');
  } else {
    pass('scan-interamt.mjs uses browser-transport getChromium');
  }

  if (!source.includes('await getChromium()')) {
    fail('scan-interamt.mjs should request chromium at runtime');
  } else {
    pass('scan-interamt.mjs requests chromium at runtime');
  }
} catch (e) {
  fail(`interamt lazy import test crashed: ${e.message}`);
}
