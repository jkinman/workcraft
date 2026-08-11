/**
 * Structured scan result contract for CLI --json and dashboard workers.
 */

/**
 * @typedef {object} ScanResultCounts
 * @property {number} companies
 * @property {number} boards
 * @property {number} tasks
 * @property {number} found
 * @property {number} filteredTitle
 * @property {number} filteredTier
 * @property {number} filteredLocation
 * @property {number} filteredPostingAge
 * @property {number} filteredPostedDate
 * @property {number} filteredSalary
 * @property {number} filteredContent
 * @property {number} filteredCountryEligibility
 * @property {number} filteredVisa
 * @property {number} filteredCooldown
 * @property {number} filteredBlacklist
 * @property {number} dupes
 * @property {number} newAdded
 * @property {number} expired
 * @property {number} migrated
 * @property {number} dropped
 * @property {number} invalid
 * @property {number} errors
 */

/**
 * @typedef {object} ScanResult
 * @property {'completed'|'failed'} status
 * @property {string} date
 * @property {boolean} dryRun
 * @property {boolean} deepDive
 * @property {boolean} verify
 * @property {ScanResultCounts} counts
 * @property {Array<{company:string,title:string,url:string,location?:string|null,source?:string}>} offers
 * @property {Array<{company:string,error:string,kind?:string}>} warnings
 * @property {Array<{company:string,provider:string,status:string}>} [providerSummaries]
 * @property {number} elapsedMs
 * @property {{pipeline?:string,scanHistory?:string,scanRuns?:string}} [artifactPaths]
 */

/**
 * @param {Partial<ScanResult>} partial
 * @returns {ScanResult}
 */
export function createScanResult(partial = {}) {
  const counts = {
    companies: 0,
    boards: 0,
    tasks: 0,
    found: 0,
    filteredTitle: 0,
    filteredTier: 0,
    filteredLocation: 0,
    filteredPostingAge: 0,
    filteredPostedDate: 0,
    filteredSalary: 0,
    filteredContent: 0,
    filteredCountryEligibility: 0,
    filteredVisa: 0,
    filteredCooldown: 0,
    filteredBlacklist: 0,
    dupes: 0,
    newAdded: 0,
    expired: 0,
    migrated: 0,
    dropped: 0,
    invalid: 0,
    errors: 0,
    ...(partial.counts || {}),
  };

  return {
    status: partial.status ?? 'completed',
    date: partial.date ?? new Date().toISOString().slice(0, 10),
    dryRun: Boolean(partial.dryRun),
    deepDive: Boolean(partial.deepDive),
    verify: Boolean(partial.verify),
    counts,
    offers: Array.isArray(partial.offers) ? partial.offers : [],
    warnings: Array.isArray(partial.warnings) ? partial.warnings : [],
    providerSummaries: partial.providerSummaries,
    elapsedMs: partial.elapsedMs ?? 0,
    artifactPaths: partial.artifactPaths,
  };
}

/**
 * @param {ScanResult} result
 * @returns {string}
 */
export function serializeScanResult(result) {
  return `${JSON.stringify(result)}\n`;
}

/**
 * @param {string} text
 * @returns {ScanResult|null}
 */
export function parseScanResult(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;
  const line = trimmed.split('\n').find((l) => l.startsWith('{'));
  if (!line) return null;
  try {
    return createScanResult(JSON.parse(line));
  } catch {
    return null;
  }
}

/**
 * @param {string} stdout
 * @returns {Partial<ScanResultCounts>}
 */
export function countsFromLegacyStdout(stdout) {
  const parseMetric = (pattern) => parseInt(String(stdout).match(pattern)?.[1] || '0', 10);
  return {
    companies: parseMetric(/Companies scanned:\s+(\d+)/),
    tasks: parseMetric(/Tasks run:\s+(\d+)/),
    found: parseMetric(/Total jobs found:\s+(\d+)/),
    newAdded: parseMetric(/New offers added:\s+(\d+)/),
  };
}

/**
 * Prefer structured `--json` scan output; fall back to legacy human summary parsing.
 *
 * @param {string} stdout
 * @returns {{
 *   source: 'structured'|'legacyStdout',
 *   companies: number,
 *   tasks: number,
 *   totalFound: number,
 *   newOffers: number,
 *   elapsedMs: number|null,
 *   scanResult: ScanResult|null,
 * }}
 */
export function extractWorkerScanMetrics(stdout) {
  const parsed = parseScanResult(stdout);
  if (parsed?.counts) {
    return {
      source: 'structured',
      companies: parsed.counts.companies ?? 0,
      tasks: parsed.counts.tasks ?? 0,
      totalFound: parsed.counts.found ?? 0,
      newOffers: parsed.counts.newAdded ?? 0,
      elapsedMs: parsed.elapsedMs ?? null,
      scanResult: parsed,
    };
  }
  const legacy = countsFromLegacyStdout(stdout);
  return {
    source: 'legacyStdout',
    companies: legacy.companies ?? 0,
    tasks: legacy.tasks ?? 0,
    totalFound: legacy.found ?? 0,
    newOffers: legacy.newAdded ?? 0,
    elapsedMs: null,
    scanResult: null,
  };
}
