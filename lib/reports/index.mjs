/**
 * Report parsing module — import-safe, no filesystem I/O.
 */

export { parseReport, populateBlockA, parseCvMatchTable } from './parse.mjs';
export { parseReportFrontmatter, stateBadgeClass, normalizeReportState } from './frontmatter.mjs';
export { slugify, extractJobId } from './slug.mjs';
