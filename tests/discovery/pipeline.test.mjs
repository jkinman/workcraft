import { pass, fail } from '../helpers.mjs';
import { createScanResult, serializeScanResult, parseScanResult } from '../../lib/discovery/scan-result.mjs';
import { normalizeUrlForDedup, companyRoleDedupKey } from '../../lib/discovery/dedupe.mjs';
import { buildTitleFilter } from '../../lib/discovery/filters.mjs';

console.log('\nlib/discovery — scan pipeline contracts');

try {
  const result = createScanResult({
    counts: { companies: 3, found: 10, newAdded: 2 },
    offers: [{ company: 'Acme', title: 'Engineer', url: 'https://example.com/j/1' }],
    elapsedMs: 42,
  });
  const roundTrip = parseScanResult(serializeScanResult(result));
  if (roundTrip?.counts?.newAdded === 2 && roundTrip.offers.length === 1) {
    pass('ScanResult serializes and parses via --json contract');
  } else fail('ScanResult round-trip');

  const tf = buildTitleFilter({ positive: ['engineer'], negative: ['intern'] });
  if (tf('Senior Engineer') && !tf('Engineer Intern')) {
    pass('buildTitleFilter still filters via discovery module');
  } else fail('buildTitleFilter');

  const u1 = normalizeUrlForDedup('https://boards.greenhouse.io/acme/jobs/1?utm_source=x');
  const u2 = normalizeUrlForDedup('https://boards.greenhouse.io/acme/jobs/1?utm_medium=y');
  if (u1 === u2) pass('normalizeUrlForDedup strips tracking params');
  else fail('normalizeUrlForDedup');

  const key = companyRoleDedupKey('Acme', 'Engineer (Remote)');
  if (key.includes('acme') && key.includes('engineer')) {
    pass('companyRoleDedupKey normalizes company+role');
  } else fail('companyRoleDedupKey');
} catch (e) {
  fail(`discovery pipeline tests crashed: ${e.message}`);
}
