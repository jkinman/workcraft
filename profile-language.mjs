/**
 * profile-language.mjs — compatibility facade for language.output helpers.
 */

export {
  parseOutputLanguage,
  outputLanguageInstruction,
  DEFAULT_OUTPUT_LANGUAGE,
  normalizeOutputLanguage,
} from './lib/profile/language.mjs';

export { readProfile, normalizeProfile } from './lib/profile/index.mjs';
