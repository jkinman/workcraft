/**
 * Evaluation workspace paths — delegates to lib/path-roots.mjs.
 */

import { join } from 'path';
import { resolveCareerOpsPaths } from '../path-roots.mjs';

/**
 * @param {string} rootDir - Career-ops system root (facades pass dirname(import.meta.url)).
 * @param {NodeJS.ProcessEnv} [env]
 */
export const EVAL_MATERIALIZE_REL_PATHS = [
  'cv.md',
  'config/profile.yml',
  'modes/_profile.md',
  'article-digest.md',
  'data/applications.md',
  'portals.yml',
];

export const EVAL_SYNC_REL_PATHS = [
  'data/applications.md',
  'data/llm-usage.jsonl',
];

export function evaluationPaths(rootDir, env = process.env) {
  const dataRoot = env.CAREER_OPS_DATA_ROOT || rootDir;
  const workspace = resolveCareerOpsPaths({ ...env, CAREER_OPS_DATA_ROOT: dataRoot });

  return {
    shared: join(rootDir, 'modes', '_shared.md'),
    oferta: join(rootDir, 'modes', 'oferta.md'),
    profile: join(rootDir, 'modes', '_profile.md'),
    cv: join(dataRoot, 'cv.md'),
    profileYml: workspace.profilePath,
    reports: workspace.reportsDir,
    tracker: workspace.applicationsPath,
    trackerAdditions: workspace.trackerAdditionsDir,
    mergeTracker: join(rootDir, 'merge-tracker.mjs'),
    outputDir: workspace.outputDir,
    jdsDir: workspace.jdsDir,
  };
}
