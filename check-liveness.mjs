#!/usr/bin/env node

/**
 * check-liveness.mjs — Playwright job link liveness checker
 *
 * Tests whether job posting URLs are still active or have expired.
 * Uses the same detection logic as scan.md step 7.5.
 * Zero Claude API tokens. Playwright browser snapshot is the final authority;
 * ATS API responses are preflight hints only.
 *
 * Usage:
 *   node check-liveness.mjs <url1> [url2] ...
 *   node check-liveness.mjs --file urls.txt
 *
 * Exit code: 0 if all active, 1 if any expired or uncertain
 */

import { readFile } from 'fs/promises';
import { createLivenessSession } from './lib/discovery/liveness/index.mjs';
import { jitteredDelayMs, sleep } from './lib/discovery/liveness/browser.mjs';

async function main() {
  const args = process.argv.slice(2);

  const noFallback = args.includes('--no-fallback');
  const throttleArg = args.find((a) => a === '--throttle' || a.startsWith('--throttle='));
  const throttleBaseMs = throttleArg ? (Number(throttleArg.split('=')[1]) || 5000) : 0;
  const positional = args.filter((a) => a !== '--no-fallback' && a !== throttleArg);

  if (positional.length === 0) {
    console.error('Usage: node check-liveness.mjs [--no-fallback] [--throttle[=ms]] <url1> [url2] ...');
    console.error('       node check-liveness.mjs [--no-fallback] [--throttle[=ms]] --file urls.txt');
    process.exit(1);
  }

  let urls;
  if (positional[0] === '--file') {
    const text = await readFile(positional[1], 'utf-8');
    urls = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  } else {
    urls = positional;
  }

  const notes = [
    noFallback ? null : 'headed fallback on challenge',
    throttleBaseMs ? `throttle ~${throttleBaseMs / 1000}-${(throttleBaseMs * 2) / 1000}s` : null,
  ].filter(Boolean);
  console.log(`Checking ${urls.length} URL(s)...${notes.length ? ` (${notes.join(', ')})` : ''}\n`);

  const session = createLivenessSession({
    headedFallback: !noFallback,
    throttleBaseMs,
  });

  let active = 0, expired = 0, uncertain = 0, apiHints = 0;

  try {
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const { result, reason, apiHint } = await session.checkPosting(url);
      if (apiHint) apiHints++;

      const icon = { active: '✅', expired: '❌', uncertain: '⚠️' }[result];
      const hintTag = apiHint ? `(api hint: ${apiHint.result}) ` : '';
      console.log(`${icon} ${result.padEnd(10)} ${hintTag}${url}`);
      if (result !== 'active') console.log(`           ${reason}`);
      if (result === 'active') active++;
      else if (result === 'expired') expired++;
      else uncertain++;

      if (i < urls.length - 1 && throttleBaseMs) {
        await sleep(jitteredDelayMs(throttleBaseMs));
      }
    }
  } finally {
    await session.close();
  }

  console.log(`\nResults: ${active} active  ${expired} expired  ${uncertain} uncertain  (${apiHints} API preflight hint(s), browser verdict)`);
  if (expired > 0 || uncertain > 0) process.exit(1);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
