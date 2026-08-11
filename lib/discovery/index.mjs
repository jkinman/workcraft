/**
 * Discovery kernel — import-safe scan pipeline, ATS identity, liveness, and sinks.
 */

export { discoveryPaths, SCAN_MATERIALIZE_REL_PATHS, SCAN_SYNC_REL_PATHS } from './paths.mjs';
export {
  parseAtsSlug,
  resolveAtsApi,
  isAtsPosting,
  entryOnHost,
  ATS_PROBE_SPECS,
  ATS_HOST_CHECKS,
  SLUG_CHARSET,
} from './ats-identity.mjs';
export { REVERSE_ATS_SOURCES, listReverseSourceIds, getReverseSource } from './reverse-sources.mjs';
export {
  createScanResult,
  serializeScanResult,
  parseScanResult,
  countsFromLegacyStdout,
  extractWorkerScanMetrics,
} from './scan-result.mjs';
export { extractCareersUrlDomain, pickRediscoveredUrl, searchForNewUrl } from './rediscovery.mjs';
export {
  getChromium,
  launchHeadlessBrowser,
  getDeepDiveScrapers,
} from './browser-transport.mjs';
export { readJobPosting, DEFAULT_MAX_JD_CHARS, MIN_JD_CHARS } from './posting-reader.mjs';

/** Lazy-load the heavy pipeline (dedupe/history/providers) on first use. */
export async function runPortalScan(opts) {
  const { runPortalScan: impl } = await import('./pipeline.mjs');
  return impl(opts);
}

export default { runPortalScan };
