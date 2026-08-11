/**
 * Profile Read Module — parse config/profile.yml once with defaults/validation.
 */

import { readFileSync, existsSync } from 'fs';
import yaml from 'js-yaml';
import { normalizeSpendTier } from '../llm/routing.mjs';
import { outputLanguageFromProfile, DEFAULT_OUTPUT_LANGUAGE } from './language.mjs';

const VALID_SPEND_TIERS = new Set(['economy', 'standard', 'premium']);
const DEFAULT_MODES_DIR = 'modes';

/**
 * @typedef {object} ParsedProfile
 * @property {string} source - 'file' | 'inline' | 'empty'
 * @property {string} [profilePath]
 * @property {object} raw
 * @property {string} outputLanguage
 * @property {string} modesDir
 * @property {'economy'|'standard'|'premium'} spendTier
 * @property {object} candidate
 * @property {object} location
 * @property {object} compensation
 * @property {object} followupCadence
 * @property {object} style
 * @property {object} modelPreferences
 */

function asString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeModesDir(value) {
  const modesDir = asString(value, DEFAULT_MODES_DIR);
  if (!modesDir || modesDir.includes('..')) return DEFAULT_MODES_DIR;
  return modesDir.replace(/\\/g, '/');
}

/**
 * Validate and normalize a parsed profile document.
 *
 * @param {object} doc
 * @returns {ParsedProfile}
 */
export function normalizeProfile(doc = {}) {
  const spendTierRaw = asString(doc.spend_tier, 'standard').toLowerCase();
  const spendTier = VALID_SPEND_TIERS.has(spendTierRaw) ? spendTierRaw : 'standard';

  const language = doc.language && typeof doc.language === 'object' ? doc.language : {};
  const modesDir = normalizeModesDir(language.modes_dir);

  const candidate = doc.candidate && typeof doc.candidate === 'object' ? doc.candidate : {};
  const location = doc.location && typeof doc.location === 'object' ? doc.location : {};
  const compensation = doc.compensation && typeof doc.compensation === 'object' ? doc.compensation : {};
  const followupCadence = doc.followup_cadence && typeof doc.followup_cadence === 'object'
    ? doc.followup_cadence
    : {};

  const modelPreferences = doc.model_preferences && typeof doc.model_preferences === 'object'
    ? doc.model_preferences
    : {};

  const style = doc.style && typeof doc.style === 'object' ? doc.style : {};

  return {
    source: 'inline',
    raw: doc,
    outputLanguage: outputLanguageFromProfile(doc) || DEFAULT_OUTPUT_LANGUAGE,
    modesDir,
    spendTier: normalizeSpendTier(spendTier),
    candidate: {
      fullName: asString(candidate.full_name),
      email: asString(candidate.email),
      phone: asString(candidate.phone),
      location: asString(candidate.location),
      linkedin: asString(candidate.linkedin),
      portfolioUrl: asString(candidate.portfolio_url),
      github: asString(candidate.github),
      photo: asString(candidate.photo),
      photoStyle: asString(candidate.photo_style, 'rounded'),
    },
    location: {
      country: asString(location.country),
      city: asString(location.city),
      timezone: asString(location.timezone),
      visaStatus: asString(location.visa_status),
      authorizedIn: Array.isArray(location.authorized_in) ? location.authorized_in.map(String) : [],
      needsSponsorship: Boolean(location.needs_sponsorship),
    },
    compensation: {
      targetRange: asString(compensation.target_range),
      currency: asString(compensation.currency, 'USD'),
      minimum: asString(compensation.minimum),
      locationFlexibility: asString(compensation.location_flexibility),
    },
    followupCadence,
    style,
    modelPreferences,
  };
}

/**
 * Read and parse profile.yml from disk or inline YAML.
 *
 * @param {object} [options]
 * @param {string} [options.profilePath]
 * @param {string} [options.profileYaml]
 * @returns {ParsedProfile}
 */
export function readProfile(options = {}) {
  const { profilePath, profileYaml } = options;

  if (typeof profileYaml === 'string') {
    try {
      const doc = yaml.load(profileYaml) || {};
      return { ...normalizeProfile(doc), source: 'inline' };
    } catch {
      return normalizeProfile({});
    }
  }

  if (profilePath && existsSync(profilePath)) {
    try {
      const doc = yaml.load(readFileSync(profilePath, 'utf8')) || {};
      return { ...normalizeProfile(doc), source: 'file', profilePath };
    } catch {
      return { ...normalizeProfile({}), source: 'file', profilePath };
    }
  }

  return { ...normalizeProfile({}), source: 'empty', profilePath };
}

export { DEFAULT_MODES_DIR, VALID_SPEND_TIERS };
