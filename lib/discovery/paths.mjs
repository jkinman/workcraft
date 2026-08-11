/**
 * Discovery path catalog — tenant-aware overrides on top of lib/path-roots.mjs.
 *
 * Non-tenant mode (no CAREER_OPS_DATA_ROOT) uses cwd-relative paths, matching
 * legacy scan.mjs behavior. Tenant/dashboard mode uses absolute paths under
 * CAREER_OPS_DATA_ROOT.
 */

import {
  SYSTEM_ROOT,
  resolveCareerOpsPaths,
  resolveLocalWorkspacePaths,
} from '../path-roots.mjs';

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function discoveryPaths(env = process.env) {
  if (env.CAREER_OPS_DATA_ROOT) {
    return resolveCareerOpsPaths(env);
  }
  return resolveLocalWorkspacePaths(process.cwd(), env);
}

export const SCAN_MATERIALIZE_REL_PATHS = [
  'portals.yml',
  'data/pipeline.md',
  'data/scan-history.tsv',
  'data/applications.md',
];

export const SCAN_SYNC_REL_PATHS = [
  'data/pipeline.md',
  'data/scan-history.tsv',
];

export { SYSTEM_ROOT };
