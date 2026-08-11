/**
 * Report module contract tests — parse, frontmatter, slug, dashboard bridge parity.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';
import { pass, fail, ROOT } from '../helpers.mjs';
import {
  parseReport,
  parseReportFrontmatter,
  stateBadgeClass,
  normalizeReportState,
  slugify,
  extractJobId,
} from '../../lib/reports/index.mjs';

console.log('\nreports module contract tests');

const FIXTURES = join(ROOT, 'tests/fixtures/reports');

function readFixture(name) {
  return readFileSync(join(FIXTURES, name), 'utf8');
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

try {
  // --- frontmatter ---
  const legacyFm = parseReportFrontmatter(readFixture('frontmatter-legacy-states.md'));
  if (legacyFm.state === 'interview') pass('frontmatter normalizes legacy interviewing → interview');
  else fail(`legacy state normalization: ${legacyFm.state}`);

  if (legacyFm.state_history.length === 3
    && legacyFm.state_history[0].state === 'discovered'
    && legacyFm.state_history[0].date === '2026-01-01') {
    pass('frontmatter parses state_history entries');
  } else {
    fail(`state_history parse: ${JSON.stringify(legacyFm.state_history)}`);
  }

  if (normalizeReportState('closed') === 'discarded') pass('normalizeReportState maps closed → discarded');
  else fail(`closed alias: ${normalizeReportState('closed')}`);

  if (stateBadgeClass('Offer') === 'status-offer') pass('stateBadgeClass maps canonical states');
  else fail(`badge class: ${stateBadgeClass('Offer')}`);

  if (stateBadgeClass('mystery') === 'status-pending') pass('stateBadgeClass falls back for unknown states');
  else fail(`unknown badge: ${stateBadgeClass('mystery')}`);

  const noFm = parseReportFrontmatter('# No frontmatter\n');
  if (noFm.state === 'evaluated' && noFm.state_history.length === 0) {
    pass('missing frontmatter defaults to evaluated with empty history');
  } else {
    fail('missing frontmatter defaults wrong');
  }

  // --- slug / extractJobId ---
  if (slugify('Acme Inc.', '#', '042-acme-inc-role.md') === 'acme-inc-042') {
    pass('slugify prefers report number from filename');
  } else {
    fail(`report-number slug: ${slugify('Acme Inc.', '#', '042-acme-inc-role.md')}`);
  }

  if (slugify('Globex', 'https://boards.greenhouse.io/globex/jobs/123456', null) === 'globex-123456') {
    pass('slugify falls back to greenhouse job id');
  } else {
    fail(`greenhouse slug: ${slugify('Globex', 'https://boards.greenhouse.io/globex/jobs/123456', null)}`);
  }

  const ashbyUrl = 'https://jobs.ashbyhq.com/acme/abc12345-6789-abcd';
  if (extractJobId(ashbyUrl) === 'abc12345') pass('extractJobId parses ashby posting id prefix');
  else fail(`ashby job id: ${extractJobId(ashbyUrl)}`);

  if (extractJobId('#') === null && extractJobId('') === null) {
    pass('extractJobId returns null for missing URLs');
  } else {
    fail('extractJobId should return null for placeholder URLs');
  }

  // --- parse (golden fixtures) ---
  const full = parseReport(readFixture('full-ag-eval.md'), '001-acme-staff-2026-05-25.md');
  if (full.company === 'Acme' && full.role === 'Staff Engineer' && full.score === 4.6) {
    pass('parseReport extracts title, score from full A-G fixture');
  } else {
    fail(`full parse title/score: ${full.company}/${full.role}/${full.score}`);
  }

  if (full.state === 'applied'
    && full.statusClass === 'status-applied'
    && full.verdict === 'APPLY NOW'
    && full.comp === 'CAD 180k'
    && full.location === 'Remote Canada') {
    pass('parseReport merges frontmatter, verdict, comp, and location');
  } else {
    fail(`full parse metadata: state=${full.state} verdict=${full.verdict} comp=${full.comp}`);
  }

  if (full.blockB.matches.some((m) => /Python/.test(m)) && full.blockB.gaps.some((g) => /Rust/.test(g))) {
    pass('parseReport parses Block B CV match table');
  } else {
    fail(`Block B: matches=${full.blockB.matches.length} gaps=${full.blockB.gaps.length}`);
  }

  if (full.evalDepth === 'full' && full.evalDepthLabel === 'FULL A-G') {
    pass('parseReport marks full A-G depth when blocks present');
  } else {
    fail(`eval depth: ${full.evalDepth}/${full.evalDepthLabel}`);
  }

  const minimal = parseReport(readFixture('minimal-screen.md'), '010-globex-2026-03-10.md');
  if (minimal.company === 'Globex'
    && minimal.role === 'Junior Analyst'
    && minimal.date === '2026-03-10'
    && minimal.score === 2.8
    && minimal.verdict === 'SKIP') {
    pass('parseReport handles Spanish metadata and Job Evaluation title variant');
  } else {
    fail(`minimal parse: ${minimal.company}/${minimal.role}/${minimal.date}/${minimal.score}/${minimal.verdict}`);
  }

  if (minimal.evalDepth === 'screen' && minimal.location === 'Hybrid Berlin') {
    pass('parseReport marks screen depth for sparse reports and reads Block A table fields');
  } else {
    fail(`minimal depth/location: ${minimal.evalDepth}/${minimal.location}`);
  }

  // --- dashboard bridge parity ---
  global.__careerOpsReports = await import('../../lib/reports/index.mjs');
  const requireFromDashboard = createRequire(join(ROOT, 'dashboard-web/report-parser.js'));
  const bridge = requireFromDashboard('./report-parser.js');

  const inlineSample = `# Evaluation: Acme - Staff Engineer

**Date:** 2026-05-25
**URL:** https://jobs.ashbyhq.com/acme/abc-123
**Score:** 4.6/5

## A) Role Summary
| **Compensation** | CAD 180k |
| **Location** | Remote Canada |

## Final Recommendation
**APPLY NOW**
`;
  const filename = '001-acme-2026-05-25.md';
  const direct = parseReport(inlineSample, filename);
  const viaBridge = bridge.parseReport(inlineSample, filename);

  if (deepEqual(
    {
      company: direct.company,
      role: direct.role,
      score: direct.score,
      verdict: direct.verdict,
      comp: direct.comp,
      location: direct.location,
      state: direct.state,
      statusClass: direct.statusClass,
    },
    {
      company: viaBridge.company,
      role: viaBridge.role,
      score: viaBridge.score,
      verdict: viaBridge.verdict,
      comp: viaBridge.comp,
      location: viaBridge.location,
      state: viaBridge.state,
      statusClass: viaBridge.statusClass,
    },
  )) {
    pass('parseReport parity with dashboard-web/report-parser.js shim');
  } else {
    fail('dashboard bridge parseReport diverged from lib/reports');
  }

  const slugDirect = slugify('Acme Inc.', '#', '042-acme-inc-role.md');
  const slugBridge = bridge.slugify('Acme Inc.', '#', '042-acme-inc-role.md');
  if (slugDirect === slugBridge) pass('slugify parity with dashboard-web/report-parser.js shim');
  else fail(`slug parity: direct=${slugDirect} bridge=${slugBridge}`);
} catch (e) {
  fail(`reports contract tests crashed: ${e.message}`);
}
