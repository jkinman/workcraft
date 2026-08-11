import { pass, fail } from '../helpers.mjs';

console.log('\nseam contracts — discovery providers and reverse metadata');

try {
  const { REVERSE_ATS_SOURCES, listReverseSourceIds, getReverseSource } = await import('../../lib/discovery/reverse-sources.mjs');
  const { resolveAtsApi, isAtsPosting } = await import('../../lib/discovery/liveness/api.mjs');

  const ids = listReverseSourceIds();
  if (ids.includes('greenhouse') && ids.includes('lever') && ids.length >= 2) {
    pass('Reverse ATS metadata exposes multiple provider adapters');
  } else {
    fail(`Expected reverse sources, got: ${ids.join(',')}`);
  }

  for (const id of ['greenhouse', 'lever']) {
    const source = getReverseSource(id);
    if (!source?.provider || !source?.dataset || typeof source.toEntry !== 'function') {
      fail(`Reverse source ${id} missing contract fields`);
    }
  }
  pass('Reverse source entries expose provider, dataset, and toEntry adapter');

  const ghEntry = REVERSE_ATS_SOURCES.greenhouse.toEntry('acme');
  const ghUrl = ghEntry?.url || ghEntry?.careers_url;
  if (ghUrl?.includes('greenhouse.io/acme')) {
    pass('Greenhouse reverse adapter builds canonical board URL');
  } else {
    fail('Greenhouse toEntry contract failed');
  }

  // Invalid slug rejected (idempotency of bad input)
  const bad = REVERSE_ATS_SOURCES.greenhouse.toEntry('bad slug!!!');
  if (bad === null) pass('Reverse adapter rejects invalid slugs consistently');
  else fail('Invalid slug should return null');

  const atsUrl = 'https://boards.greenhouse.io/acme/jobs/123456';
  if (isAtsPosting(atsUrl)) {
    const resolved = resolveAtsApi(atsUrl);
    if (resolved?.ats === 'greenhouse' && resolved.apiUrl.includes('123456')) {
      pass('ATS identity resolves provider API URL from posting URL');
    } else {
      fail('ATS API resolution contract failed');
    }
  } else {
    fail('Greenhouse URL not recognized as ATS posting');
  }

  // Provider failure contract: unknown host returns null API hint (no throw)
  const unknown = await import('../../lib/discovery/liveness/api.mjs').then((m) =>
    m.checkLivenessViaApi('https://example.com/careers/job/1'),
  );
  if (unknown === null) pass('Discovery API adapter fails soft on unknown hosts');
  else fail('Unknown host should yield null API hint');
} catch (e) {
  fail(`Discovery seam contract crashed: ${e.message}`);
}
