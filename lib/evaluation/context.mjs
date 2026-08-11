/**
 * Load evaluation context files from the workspace.
 */

import { readFileSync, existsSync } from 'fs';
import { outputLanguageInstruction, parseOutputLanguage } from '../../profile-language.mjs';
import { evaluationPaths } from './paths.mjs';

/**
 * @param {string} path
 * @param {string} label
 * @param {{ warn?: (msg: string) => void, required?: boolean }} [options]
 */
export function readContextFile(path, label, options = {}) {
  const warn = options.warn ?? ((msg) => console.warn(msg));
  if (!existsSync(path)) {
    if (options.required) {
      throw new Error(`Required context file not found: ${label} at ${path}`);
    }
    warn(`⚠️   ${label} not found at: ${path}`);
    return `[${label} not found — skipping]`;
  }
  return readFileSync(path, 'utf-8').trim();
}

/**
 * @param {object} params
 * @param {string} params.rootDir
 * @param {boolean} [params.includeProfileMd]
 * @param {(msg: string) => void} [params.warn]
 */
export function loadEvaluationContext({ rootDir, includeProfileMd = false, warn, env = process.env }) {
  const paths = evaluationPaths(rootDir, env);
  const profileYml = readContextFile(paths.profileYml, 'config/profile.yml', { warn });
  const profileContent = includeProfileMd
    ? readContextFile(paths.profile, 'modes/_profile.md', { warn })
    : '';

  return {
    paths,
    sharedContent: readContextFile(paths.shared, 'modes/_shared.md', { warn }),
    ofertaContent: readContextFile(paths.oferta, 'modes/oferta.md', { warn }),
    cvContent: readContextFile(paths.cv, 'cv.md', { warn }),
    profileYml,
    profileContent,
    languageInstruction: outputLanguageInstruction(parseOutputLanguage(profileYml)),
  };
}
