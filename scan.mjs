#!/usr/bin/env node

/**
 * scan.mjs — Zero-token portal scanner (stable root facade).
 *
 * Provider argv/orchestration lives here; normalization, filtering, dedupe,
 * history/sink behavior, and liveness verification live in lib/discovery/.
 */

import { pathToFileURL } from 'url';
import { mkdirSync } from 'fs';
import path from 'path';

import { discoveryPaths } from './lib/discovery/paths.mjs';
import { runPortalScan } from './lib/discovery/pipeline.mjs';

// Backward-compatible re-exports for tests and downstream scripts.
export {
  compileKeyword,
  buildTitleFilter,
  matchedTitleKeywords,
  locationHintFromUrl,
  REMOTE_TITLE_RE,
  REMOTE_NEGATED_RE,
  titleSignalsRemote,
  buildLocationFilter,
  buildPostingAgeFilter,
  parseSinceDays,
  resolveEffectiveAfter,
  resolveEarlyStopMs,
  buildPostedDateFilter,
  buildContentFilter,
  buildCountryEligibilityFilter,
  validatePostedDateBound,
  DEFAULT_VISA_POSITIVE,
  DEFAULT_VISA_NEGATIVE,
  buildVisaFilter,
  buildSalaryFilter,
  companyMatch,
  addDays,
  loadCandidateCountry,
  loadReApplyWindows,
  buildCooldownFilter,
} from './lib/discovery/filters.mjs';

export {
  shouldDedupScanHistoryRow,
  normalizeUrlForDedup,
  loadSeenUrls,
  buildCompanyCanonicalizer,
  normalizeRoleForDedup,
  companyRoleDedupKey,
  collectSeenCompanyRoles,
  loadSeenCompanyRoles,
  scanHistoryPolicy,
} from './lib/discovery/dedupe.mjs';

export {
  sanitizeMarkdownField,
  sanitizeTsvField,
  formatCompensation,
  trustIsFlagged,
  formatTrustSegment,
  formatPipelineOffer,
  formatScanHistoryRow,
  loadFingerprintHistory,
  appendToPipeline,
  appendToScanHistory,
  parseBlacklist,
  loadBlacklist,
  SCAN_RUNS_HEADER,
  SCAN_HISTORY_HEADER,
  appendScanRunSummary,
  PORTAL_HEALTH_HEADER,
  appendPortalHealth,
  loadPortalHealth,
  computeConsecutiveFailures,
} from './lib/discovery/history.mjs';

export { extractCareersUrlDomain, pickRediscoveredUrl } from './lib/discovery/rediscovery.mjs';

try {
  const { config } = await import('dotenv');
  config({ quiet: true });
} catch {
  // dotenv optional
}

const PATHS = discoveryPaths();
mkdirSync(PATHS.dataRoot ? path.join(PATHS.dataRoot, 'data') : 'data', { recursive: true });

async function main() {
  try {
    await runPortalScan({ paths: PATHS, argv: process.argv.slice(2) });
  } catch (err) {
    console.error('Fatal:', err.message);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main();
}
