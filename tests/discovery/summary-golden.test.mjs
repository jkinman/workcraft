import { pass, fail } from '../helpers.mjs';
import { printDeepDiveSummary, printPortalScanSummary } from '../../lib/discovery/summary.mjs';
import { extractWorkerScanMetrics, serializeScanResult, createScanResult } from '../../lib/discovery/scan-result.mjs';

console.log('\ndiscovery — summary golden output');

function capture(fn) {
  const lines = [];
  fn((...args) => lines.push(args.join(' ')));
  return lines.join('\n');
}

try {
  const deepDive = capture((log) => printDeepDiveSummary(log, {
    date: '2026-08-10',
    tasksCount: 2,
    totalFound: 42,
    totalFiltered: 5,
    totalDupes: 3,
    newOffers: [{ company: 'Acme', title: 'Engineer' }],
    dryRun: false,
  }));

  if (!deepDive.includes('Deep-Dive Scan — 2026-08-10')) fail('deep-dive header');
  else pass('deep-dive header');

  if (!deepDive.includes('Tasks run:             2')) fail('deep-dive tasks');
  else pass('deep-dive tasks');

  if (!deepDive.includes('Filtered by title:     5 removed')) fail('deep-dive filtered');
  else pass('deep-dive filtered');

  if (!deepDive.includes('Duplicates:            3 skipped')) fail('deep-dive dupes');
  else pass('deep-dive dupes');

  if (!deepDive.includes('New offers added:      1')) fail('deep-dive new offers');
  else pass('deep-dive new offers');

  const portal = capture((log) => {
    const { healthRecords } = printPortalScanSummary(log, {
      date: '2026-08-10',
      config: { title_filter: {}, trust_filter: { enabled: true }, portal_health_threshold: 3 },
      paths: { pipelinePath: 'data/pipeline.md', scanHistoryPath: 'data/scan-history.tsv', portalHealthPath: 'data/portal-health.tsv' },
      targets: [{ name: 'Acme' }],
      summaryCompanies: 1,
      summaryBoards: 0,
      counters: {
        totalFound: 10, totalFilteredTitle: 1, totalFilteredTier: 0, totalFilteredLocation: 0,
        totalFilteredPostingAge: 0, totalFilteredPostedDate: 0, totalFilteredSalary: 0,
        totalFilteredContent: 0, totalFilteredCountryEligibility: 0, totalFilteredBlacklist: 0,
        annotatedBlacklisted: 0, totalFilteredVisa: 0, totalFilteredCooldown: 0, totalDupes: 2,
      },
      effectiveAfter: null,
      postedBefore: null,
      skipTiers: [],
      visaEnabled: false,
      windows: {},
      blacklist: new Map(),
      includeBlacklisted: false,
      historyPolicy: { recheckAfterDays: 30 },
      seenUrlState: { recheckEligible: 4 },
      verify: true,
      expiredOffers: [{ company: 'X', title: 'Y' }],
      migratedOffers: [],
      droppedOffers: [],
      invalidOffers: [],
      verifiedOffers: [{
        company: 'Acme', title: 'Engineer', location: 'Remote', url: 'https://example.com/j/1',
        trustScore: 80, trustFlags: ['missing_apply_url'], trustLevel: 'medium',
      }],
      crossListings: [],
      agentHandoff: [{ company: 'WebCo', method: 'websearch', query: 'site:webco.com careers' }],
      errors: [],
      emptyTargets: [],
      dryRun: false,
    });
    if (!Array.isArray(healthRecords) || healthRecords.length !== 1) {
      throw new Error('healthRecords missing');
    }
  });

  const required = [
    'Portal Scan — 2026-08-10',
    'Recheck eligible:      4 old scan-history URL(s)',
    'Expired (verified):    1 dropped',
    'Trust validation:      0 high, 1 medium, 0 low',
    'Trust flags:           missing_apply_url: 1',
    'Agent/WebSearch handoff: 1 company not handled by zero-token providers',
    '  • WebCo (websearch) — site:webco.com careers',
    'New offers:',
    '  + Acme | Engineer | Remote [Trust: 80/100 — missing_apply_url]',
    'Results saved to data/pipeline.md and data/scan-history.tsv',
    '→ Run /career-ops pipeline to evaluate new offers.',
    '→ Share results and get help: https://discord.gg/8pRpHETxa4',
  ];

  for (const line of required) {
    if (!portal.includes(line)) fail(`portal summary missing: ${line}`);
    else pass(`portal summary has: ${line.slice(0, 40)}…`);
  }

  const structured = createScanResult({ counts: { companies: 3, found: 9, newAdded: 2 }, elapsedMs: 1200 });
  const metrics = extractWorkerScanMetrics(serializeScanResult(structured));
  if (metrics.source !== 'structured' || metrics.totalFound !== 9 || metrics.newOffers !== 2) {
    fail('extractWorkerScanMetrics structured');
  } else pass('extractWorkerScanMetrics structured');

  const legacyStdout = 'Portal Scan — 2026-08-10\nCompanies scanned:     5\nTotal jobs found:      12\nNew offers added:      3\n';
  const legacyMetrics = extractWorkerScanMetrics(legacyStdout);
  if (legacyMetrics.source !== 'legacyStdout' || legacyMetrics.companies !== 5 || legacyMetrics.totalFound !== 12 || legacyMetrics.newOffers !== 3) {
    fail('extractWorkerScanMetrics legacy');
  } else pass('extractWorkerScanMetrics legacy');
} catch (e) {
  fail(`summary golden tests crashed: ${e.message}`);
}
