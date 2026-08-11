import { readFileSync, existsSync } from 'fs';
import yaml from 'js-yaml';
import { normalizeTextKey } from '../../tracker-parse.mjs';
import { discoveryPaths } from './paths.mjs';

const DEFAULT_PROFILE_PATH = discoveryPaths().profilePath;

// Compile a lowercased keyword into a matcher. Short all-letter acronyms
// (2-3 chars: cfo, coo, sdr, bdr, gsi…) match on WORD BOUNDARIES so "COO" no
// longer matches "Coordinator", "SDR" no longer matches anything mid-word, etc.
// Multi-word phrases and keywords containing non-letters (".NET", "SAP ",
// "L&D") keep fast, permissive substring matching.
export function compileKeyword(kw) {
  if (/^[a-z]{2,3}$/.test(kw)) {
    const re = new RegExp(`\\b${kw}\\b`);
    return (lower) => re.test(lower);
  }
  return (lower) => lower.includes(kw);
}

export function buildTitleFilter(titleFilter) {
  // Normalize defensively: a malformed title_filter (a null, numeric, or otherwise
  // non-string entry in the YAML) must not crash the scan via k.toLowerCase().
  const normalize = (arr) => (Array.isArray(arr) ? arr : [])
    .filter(k => typeof k === 'string')
    .map(k => k.trim().toLowerCase())
    .filter(k => k.length > 0)
    .map(compileKeyword);
  const positive = normalize(titleFilter?.positive);
  const negative = normalize(titleFilter?.negative);

  return (title) => {
    const lower = (title || '').toLowerCase();
    const hasPositive = positive.length === 0 || positive.some(m => m(lower));
    const hasNegative = negative.some(m => m(lower));
    return hasPositive && !hasNegative;
  };
}

// Compiled-matcher cache for matchedTitleKeywords(), keyed by the
// `title_filter.positive` array reference. The scan loop calls this once per
// job with the same titleFilter config object, so caching avoids recompiling
// every keyword (compileKeyword()) on every single job.
const compiledPositiveCache = new WeakMap();

function compiledPositiveMatchers(positiveList) {
  if (compiledPositiveCache.has(positiveList)) return compiledPositiveCache.get(positiveList);
  const compiled = positiveList
    .filter(k => typeof k === 'string' && k.trim().length > 0)
    .map(k => ({ raw: k, match: compileKeyword(k.trim().toLowerCase()) }));
  compiledPositiveCache.set(positiveList, compiled);
  return compiled;
}

// Returns the raw (as-written in portals.yml) `title_filter.positive` keywords
// that matched a given title — used to scope `content_filter.by_title_keyword`
// overrides to only the categories that opted into a stricter content check.
export function matchedTitleKeywords(title, titleFilter) {
  const raw = Array.isArray(titleFilter?.positive) ? titleFilter.positive : [];
  const lower = (title || '').toLowerCase();
  return compiledPositiveMatchers(raw)
    .filter(({ match }) => match(lower))
    .map(({ raw: kw }) => kw);
}

// ── Location filter ─────────────────────────────────────────────────
// Optional. If `location_filter` is absent from portals.yml, all locations pass.
// Semantics (case-insensitive substring, in this order):
//   - Empty / whitespace-only / non-string location → pass (don't penalize
//     missing or malformed provider data)
//   - `always_allow` matches → pass (takes precedence over `block` — lets a
//     multi-location string like "Remote, Belgium or France" through because
//     the home region is an option, even though "france" is blocked)
//   - `block` matches → reject
//   - `allow` empty → pass (already cleared block)
//   - `allow` non-empty → must match at least one keyword, OR the TITLE carries
//     an explicit remote marker (see titleSignalsRemote below)

// Normalize a keyword list from portals.yml: tolerates a bare string
// (wrapped to a 1-item array), null/undefined (→ []), and non-string
// entries (filtered out). Survivors are lowercased, trimmed, and any
// resulting empty strings are dropped — an empty keyword would otherwise
// match every location via String.includes(''), silently bypassing the
// other tiers.
function normalizeKeywordList(value) {
  if (value == null) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr
    .filter(k => typeof k === 'string')
    .map(k => k.toLowerCase().trim())
    .filter(Boolean);
}

// Compile a location keyword into a word-boundary matcher.
//
// Plain String.includes() is wrong for location keywords because country and
// city names are prefixes of unrelated US place names. The motivating bug:
// blocking "india" also rejected "Indian Head, MD", "Indiana", and
// "Indianapolis" — real US locations, silently dropped from every scan.
// Likewise "china" would swallow "Chinatown" and "uk -" would swallow "Truck -".
//
// Lookarounds rather than \b so keywords that begin or end with punctuation
// (", IND", "UK -") still anchor correctly — \b is defined relative to word
// characters and behaves surprisingly at a punctuation edge.
// Note: distinct from compileKeyword() above, which serves the *title* filter and
// only boundary-anchors 2-3 letter acronyms. Location keywords need boundaries on
// every keyword, so they get their own compiler rather than changing title-matching
// behaviour. Returns a predicate, mirroring compileKeyword()'s shape.
function compileLocationKeyword(keyword) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const startsWord = /[a-z0-9]/.test(keyword[0]);
  const endsWord = /[a-z0-9]/.test(keyword[keyword.length - 1]);
  const prefix = startsWord ? '(?<![a-z0-9])' : '';
  const suffix = endsWord ? '(?![a-z0-9])' : '';
  const re = new RegExp(`${prefix}${escaped}${suffix}`);
  return (lower) => re.test(lower);
}

function compileLocationKeywordList(value) {
  return normalizeKeywordList(value).map(compileLocationKeyword);
}

// Some providers report a rolled-up display string ("5 Locations", "2 Locations")
// while the canonical URL still names the real primary location. Workday is the
// common case: .../job/Hyderabad-Telangana-India/Network-Engineer_R-65193-1 shows
// up as "5 Locations", so no `block` keyword can ever match the location field.
// Recover that signal by reading the path segment right after `/job/`.
//
// Deliberately narrow: only the post-`/job/` segment is inspected, never the whole
// URL. Scanning the full URL would match company slugs and ATS subdomains by
// accident (a "china" or "india" substring inside an unrelated path). Providers
// without the `/job/{location}/` convention (Greenhouse, Lever, Ashby) yield no
// hint and keep their previous behaviour exactly.
export function locationHintFromUrl(url) {
  if (typeof url !== 'string' || url.trim() === '') return '';
  let pathname;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return '';
  }
  const segments = pathname.split('/').filter(Boolean);
  const jobIdx = segments.lastIndexOf('job');
  if (jobIdx === -1 || jobIdx === segments.length - 1) return '';
  let segment = segments[jobIdx + 1];
  try {
    segment = decodeURIComponent(segment);
  } catch {
    // Malformed percent-encoding — fall back to the raw segment.
  }
  // "Hyderabad-Telangana-India" → "hyderabad telangana india" so multi-word
  // block keywords like "united arab emirates" can still match.
  return segment.replace(/[-_+]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

// Some ATSs report the hiring office as the location even when the role is
// remote, and state the remoteness in the TITLE instead: Radancy/TalentBrew
// tenants return bare "City, State" strings, so
//   "Program Manager - Remote"  ->  location "Las Vegas, Nevada"
// An `allow` list written in country/region terms ("united states", "remote")
// then rejects a genuinely remote US role. Live measurement on
// careers.unitedhealthgroup.com: 14 PM-family postings, 0 passed `allow`,
// 5 of them said "Remote" outright in the title.
//
// Only an unambiguous work-arrangement marker counts. A bare /remote/ test
// would admit domain compounds — "Remote Sensing Program Manager" is an
// on-site GIS role, and Esri (a tracked company) posts exactly those. So
// "remote" must be followed by end-of-string, a non-letter (")", ",", "-"),
// or " in …" as in "Remote in MO" — never by another word, which is what makes
// "remote sensing" / "remote monitoring" compounds.
export const REMOTE_TITLE_RE = /(?<![a-z])remote(?=$|\s*[^a-z\s]|\s+in\b)/;

// …and a negation before the word has to lose, which the marker regex alone
// cannot see: in "Non-Remote" / "Not Remote" the delimiter clears the lookbehind
// and the trailing position clears the lookahead, so an explicitly on-site role
// would bypass a non-empty `allow` list — the exact opposite of the intent.
// The separator class must be at least as broad as the marker's own delimiter
// lookahead, or the guard is trivially sidestepped. An ASCII-only `[\s-]*` let
// every non-ASCII dash through — "Non–Remote" (en dash), "Non‑Remote"
// (non-breaking hyphen), em dash, figure dash and minus all still read as
// remote. `[^a-z]*` matches the marker's breadth: it spans any run of
// non-letters, so no punctuation variant can slip between the negation and the
// word.
// It cannot over-reach, because it never crosses a letter: in "Nonprofit
// Program Manager - Remote" the run after "non" starts with "profit", so the
// negation cannot reach "remote". Same for "Not-for-Profit … - Remote",
// "Nordic … - Remote", "Notary … - Remote".
// A negation anywhere in the title disqualifies it. Over-rejecting here is the
// safe direction: this tier only ever *rescues* a posting, so a false negative
// restores the previous behavior while a false positive admits an on-site role.
export const REMOTE_NEGATED_RE = /\b(?:non|not|no)[^a-z]*remote/;

/** @param {unknown} title @returns {boolean} whether the title marks the role remote. */
export function titleSignalsRemote(title) {
  if (typeof title !== 'string' || title.trim() === '') return false;
  const lower = title.toLowerCase();
  if (REMOTE_NEGATED_RE.test(lower)) return false;
  return REMOTE_TITLE_RE.test(lower);
}

// `url` and `title` are optional. Callers that omit them get the original
// location-only semantics, which is what the existing unit tests exercise.
export function buildLocationFilter(locationFilter) {
  if (!locationFilter) return () => true;
  const alwaysAllow = compileLocationKeywordList(locationFilter.always_allow);
  const allow = compileLocationKeywordList(locationFilter.allow);
  const block = compileLocationKeywordList(locationFilter.block);

  return (location, url, title) => {
    const lower = typeof location === 'string' ? location.trim().toLowerCase() : '';
    const hint = locationHintFromUrl(url);
    // Nothing to judge on either field → pass (don't penalize missing data).
    if (lower === '' && hint === '') return true;
    const matches = (m) => (lower !== '' && m(lower)) || (hint !== '' && m(hint));
    // always_allow still wins over block, and may be satisfied by either field:
    // a genuinely US role whose display string says "United States" is never
    // rejected because of what its URL happens to contain.
    if (alwaysAllow.length > 0 && alwaysAllow.some(matches)) return true;
    if (block.length > 0 && block.some(matches)) return false;
    if (allow.length === 0) return true;
    if (allow.some(matches)) return true;
    // Last resort only. Deliberately placed AFTER `block` so a remote title can
    // never rescue a blocked location — "Program Manager - Remote" in Bengaluru
    // stays rejected. This widens `allow`, never `block`.
    return titleSignalsRemote(title);
  };
}

// ── Posting-age filter ──────────────────────────────────────────────
// Optional opt-in. If `max_posting_age_days` is absent (or not a positive
// integer) in portals.yml, every offer passes. An offer is skipped only when
// the provider supplied a postedAt (epoch ms) AND it is older than N days.
// Offers with no date always pass — same "don't penalize missing data"
// convention as the location filter. `now` is injectable for deterministic tests.
export function buildPostingAgeFilter(maxAgeDays, now = Date.now()) {
  const max = Number(maxAgeDays);
  if (!Number.isInteger(max) || max <= 0) return () => true;
  const cutoff = now - max * 24 * 60 * 60 * 1000; // N days in ms, subtracted from now
  return (postedAt) => {
    if (typeof postedAt !== 'number' || !Number.isFinite(postedAt)) return true;
    return postedAt >= cutoff;
  };
}

// ── Posted-date lower bound (shared by the filter and the early-stop) ──
// --posted-after states a lower bound absolutely; --since <days> states the
// same thing relatively. They AND together with each other and with
// max_posting_age_days, so the NEWEST bound is what actually decides
// eligibility. Both consumers must agree on it: the downstream filter and the
// provider early-stop hint. Kept as one function so they cannot drift.

/**
 * Parse and validate `--since <days>` from an argv slice.
 *
 * Shared by scan.mjs and scan-ats-full.mjs so ONE flag name cannot mean two
 * different things. scan-ats-full.mjs used `Number(valueOf('--since')) || 3`,
 * which silently swallowed every malformed operand: `--since abc` and
 * `--since 0` both became 3 (the user believes they scanned the window they
 * typed), `--since -5` produced a cutoff in the FUTURE so nothing was ever
 * eligible (indistinguishable from "no new postings"), and `--since 1e400`
 * became Infinity → an -Infinity cutoff, i.e. no window at all (#2498).
 *
 * Returns the day count, or null when the flag is absent — the DEFAULT is the
 * caller's to choose (scan.mjs: no bound; scan-ats-full.mjs: 3 days), only the
 * validation is shared. `error` is a ready-to-print message; callers print and
 * exit rather than this throwing, so both CLIs fail the same way.
 *
 * @param {string[]} args - argv slice.
 * @returns {{days: number|null, error: string|null}}
 */
export function parseSinceDays(args) {
  // Every occurrence is collected, not just the first match of either form:
  // picking one and ignoring the rest means `--since=7 --since` succeeds while
  // an occurrence with no value goes unread.
  const occurrences = args.filter((a) => a === '--since' || a.startsWith('--since='));
  if (occurrences.length > 1) {
    return { days: null, error: `--since given ${occurrences.length} times; pass it once` };
  }
  if (occurrences.length === 0) return { days: null, error: null };
  const occ = occurrences[0];
  const next = args[args.indexOf('--since') + 1];
  const raw = occ.startsWith('--since=')
    ? occ.slice('--since='.length)
    : (next != null && !next.startsWith('--') ? next : null);
  const n = raw == null || raw === '' ? NaN : Number(raw);
  // Number.isFinite also rejects Infinity and 1e309, which pass a bare `> 0`
  // test and would yield an -Infinity cutoff (i.e. silently no window).
  if (!Number.isFinite(n) || n <= 0) {
    return { days: null, error: `--since expects a positive number of days, got ${raw == null || raw === '' ? '(no value)' : `"${raw}"`}` };
  }
  // Finite and positive is not enough: 1e300 days lands outside the ±8.64e15ms
  // range a Date can represent, so the derived cutoff is an Invalid Date and
  // toISOString() throws. Reject it here rather than let it surface as an
  // unhandled "Invalid time value" mid-scan.
  if (Number.isNaN(new Date(Date.now() - n * 86_400_000).getTime())) {
    return { days: null, error: `--since ${raw} is too large to express as a date` };
  }
  return { days: n, error: null };
}

/**
 * Validate a CLI posted-date bound before scan work begins.
 *
 * @param {string} flag
 * @param {string} value
 * @returns {string}
 */
export function validatePostedDateBound(flag, value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${flag} expects YYYY-MM-DD, received "${value}"`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${flag} expects YYYY-MM-DD, received "${value}"`);
  }
  return value;
}

/**
 * Collapse --posted-after and --since into a single absolute lower bound.
 *
 * @param {string|null} postedAfter - YYYY-MM-DD from --posted-after, or null.
 * @param {number|null} sinceDays - Positive day count from --since, or null.
 * @param {number} [now] - Injectable clock for tests.
 * @returns {string|null} YYYY-MM-DD, the newer of the two, or null if neither.
 */
export function resolveEffectiveAfter(postedAfter, sinceDays, now = Date.now()) {
  // marginally more permissive, which is the safe direction for a bound that
  // also stops pagination.
  // Guarded rather than assumed valid: this is exported and unit-tested, so it
  // must not throw for any input. A day count large enough to push the cutoff
  // outside the representable Date range yields an Invalid Date, and
  // toISOString() would throw RangeError on it.
  const cutoff = Number.isFinite(sinceDays) && sinceDays > 0 ? new Date(now - sinceDays * 86_400_000) : null;
  const sinceIso = cutoff && !Number.isNaN(cutoff.getTime())
    ? cutoff.toISOString().slice(0, 10)
    : null;
  return [postedAfter, sinceIso].filter(Boolean).reduce((a, b) => (a > b ? a : b), null);
}

/**
 * The oldest posting the filters would still accept — the early-stop floor.
 *
 * Stopping pagination any NEWER than this would leave eligible postings
 * unfetched, which is the one thing the optimisation must never do. Returns
 * null when no CLI window is active: max_posting_age_days constrains the floor
 * but must not by itself switch early stopping on for configs that never asked.
 *
 * @param {string|null} effectiveAfter - Output of resolveEffectiveAfter.
 * @param {*} maxAgeDays - config.max_posting_age_days (may be absent/invalid).
 * @param {number} [now] - Injectable clock for tests.
 * @returns {number|null} Epoch ms floor, or null to disable early stopping.
 */
export function resolveEarlyStopMs(effectiveAfter, maxAgeDays, now = Date.now()) {
  if (!effectiveAfter) return null;
  const max = Number(maxAgeDays);
  const ageFloor = Number.isInteger(max) && max > 0 ? now - max * 86_400_000 : -Infinity;
  return Math.max(Date.parse(`${effectiveAfter}T00:00:00Z`), ageFloor);
}

// ── Absolute posted-date filter ─────────────────────────────────────
// CLI-only (--posted-after / --posted-before), unlike the config-driven
// relative max_posting_age_days above. Both bounds optional and inclusive
// (before is treated as end-of-day). A job with no postedAt always passes —
// same "don't penalize missing data" convention as buildPostingAgeFilter.
export function buildPostedDateFilter(afterIso, beforeIso) {
  const afterMs = afterIso ? Date.parse(afterIso) : NaN;
  const beforeMs = beforeIso ? Date.parse(`${beforeIso}T23:59:59.999Z`) : NaN;
  const hasAfter = Number.isFinite(afterMs);
  const hasBefore = Number.isFinite(beforeMs);
  if (!hasAfter && !hasBefore) return () => true;
  return (postedAt) => {
    if (typeof postedAt !== 'number' || !Number.isFinite(postedAt)) return true;
    if (hasAfter && postedAt < afterMs) return false;
    if (hasBefore && postedAt > beforeMs) return false;
    return true;
  };
}

// ── Content filter ──────────────────────────────────────────────────
// Optional. If `content_filter` is absent from portals.yml, all jobs pass.
// Filters on the job DESCRIPTION text to separate same-titled roles with
// different stacks (a "Software Engineer" listing that mentions "PHP" vs one
// that mentions "Rust"). Semantics (case-insensitive substring, in order):
//   - Empty / whitespace-only / non-string description → PASS. The scanner is
//     zero-token and only sees descriptions a provider already returns in its
//     list payload; providers without one must never be silently dropped.
//   - any `negative` keyword present → reject
//   - `positive` empty → pass (already cleared negatives)
//   - `positive` non-empty → at least one keyword must be present
//
// `content_filter.by_title_keyword` (optional): scopes a stricter positive/
// negative pair to only the jobs whose title matched a specific
// `title_filter.positive` keyword, so e.g. an "AI Engineer" title-match can
// require the description to actually mention a concrete AI tool, without
// that requirement leaking onto unrelated categories like "Instructional
// Designer". When one or more of a job's matched title keywords has an
// override, the overrides govern (any override passing is enough); the
// global `positive`/`negative` pair is the fallback for jobs whose matched
// keyword(s) have no override entry.
//
// Provider support: only providers whose list API ships the description for
// free (no extra per-job request, which would break the zero-token design)
// populate `job.description`. Lever (`descriptionPlain`) does today; others
// leave it empty and therefore always pass this filter.

export function buildContentFilter(contentFilter) {
  if (!contentFilter) return () => true;
  const positive = normalizeKeywordList(contentFilter.positive);
  const negative = normalizeKeywordList(contentFilter.negative);

  const byTitleKeyword = new Map();
  if (contentFilter.by_title_keyword && typeof contentFilter.by_title_keyword === 'object' && !Array.isArray(contentFilter.by_title_keyword)) {
    for (const [kw, rule] of Object.entries(contentFilter.by_title_keyword)) {
      if (typeof kw !== 'string' || !kw.trim()) continue;
      byTitleKeyword.set(kw.trim().toLowerCase(), {
        positive: normalizeKeywordList(rule?.positive),
        negative: normalizeKeywordList(rule?.negative),
      });
    }
  }

  return (description, matchedKeywords = []) => {
    if (typeof description !== 'string' || description.trim() === '') return true;
    const lower = description.toLowerCase();

    const overrides = matchedKeywords
      .filter(k => typeof k === 'string')
      .map(k => byTitleKeyword.get(k.trim().toLowerCase()))
      .filter(Boolean);

    if (overrides.length > 0) {
      return overrides.some(rule => {
        if (rule.negative.length > 0 && rule.negative.some(k => lower.includes(k))) return false;
        if (rule.positive.length === 0) return true;
        return rule.positive.some(k => lower.includes(k));
      });
    }

    if (negative.length > 0 && negative.some(k => lower.includes(k))) return false;
    if (positive.length === 0) return true;
    return positive.some(k => lower.includes(k));
  };
}

// ── Country-eligibility filter (#2093) ──────────────────────────────
// Optional, opt-in. If `country_eligibility_filter` is absent from
// portals.yml, all jobs pass — byte-identical to pre-#2093 behavior.
//
// Problem it solves: `location_filter` only reads the ATS provider's
// STRUCTURED location field (e.g. "Remote"), which many US companies use
// identically regardless of actual country eligibility. The real
// restriction — "US-based candidates only" vs. "US or Canada eligible" —
// often lives only in the JD DESCRIPTION body text, which this filter reads
// (same field `content_filter` already reads — `job.description`).
//
// Semantics (case-insensitive substring), mirroring location_filter's
// "don't penalize missing data" discipline exactly:
//   - Candidate's own `location.country` (config/profile.yml) is "United
//     States" → always pass, unconditionally. An exclusionary "US only"
//     phrase can never legitimately block a US-based candidate, so the
//     filter no-ops entirely rather than special-casing every keyword check.
//   - Empty / whitespace-only / non-string description → pass (no signal).
//   - No `exclusionary` phrase matched → pass (ambiguous stays ambiguous,
//     never guessed — this also means an `inclusive`-only match with no
//     exclusionary wording present is a no-op pass, same as having no
//     signal at all).
//   - `exclusionary` phrase matched AND an `inclusive` phrase is also
//     present → pass (the posting explicitly widens eligibility).
//   - `exclusionary` phrase matched AND the candidate's own country is
//     literally named in the JD text (e.g. a Canadian candidate scanning a
//     posting that separately mentions "Canada" elsewhere) → pass.
//   - `exclusionary` phrase matched, no `inclusive` phrase, and the
//     candidate's own country isn't named → reject.
//
// Config shape (portals.yml):
//   country_eligibility_filter:
//     exclusionary: ["must be located in the united states", ...]
//     inclusive: ["united states or canada", "north america", ...]
//
// Kept as a sibling block to `content_filter` rather than folded into its
// positive/negative shape: this filter cross-references
// `config/profile.yml`'s `location.country` and has its own three-way
// exclusionary/inclusive/candidate-country-named semantics, which doesn't
// fit content_filter's simpler two-list reject/require shape.

export function buildCountryEligibilityFilter(countryEligibilityFilter, candidateCountry) {
  if (!countryEligibilityFilter) return () => true;

  const candidateCountryLower = typeof candidateCountry === 'string'
    ? candidateCountry.toLowerCase().trim()
    : '';

  // A "US-based candidates only" restriction can never legitimately exclude
  // a candidate who is themselves US-based — no-op the whole filter rather
  // than relying on the literal-country-name check below (which would miss
  // phrasing like "US-based candidates only" that never spells out "united
  // states").
  if (candidateCountryLower === 'united states') return () => true;

  const exclusionary = normalizeKeywordList(countryEligibilityFilter.exclusionary);
  const inclusive = normalizeKeywordList(countryEligibilityFilter.inclusive);

  return (description) => {
    if (typeof description !== 'string' || description.trim() === '') return true;
    const lower = description.toLowerCase();

    if (exclusionary.length === 0) return true;
    if (!exclusionary.some(k => lower.includes(k))) return true;
    if (inclusive.length > 0 && inclusive.some(k => lower.includes(k))) return true;
    if (candidateCountryLower && lower.includes(candidateCountryLower)) return true;

    return false;
  };
}

// ── Visa / work-authorization filter ────────────────────────────────
// Optional. If `visa_filter` is absent (or `enabled: false`), all jobs pass.
// Surfaces roles that sponsor a work visa (H-1B / H-1B1 / O-1 for the US, plus
// the generic "visa sponsorship" wording) and drops roles that explicitly
// refuse sponsorship. Like content_filter it reads the job DESCRIPTION text, so
// it only has signal for providers whose list API ships a description (Lever
// today); jobs without one fall back to the require_mention rule below.
//
// Semantics (case-insensitive substring):
//   - any `negative` keyword present → reject (an explicit "no sponsorship")
//   - require_mention: false (default) → after clearing negatives, PASS —
//     including jobs with no description. Use this to only weed out the
//     explicit rejections while keeping everything unstated.
//   - require_mention: true → keep only jobs whose description contains at least
//     one `positive` keyword; a missing/empty description is rejected. Use this
//     to surface *only* postings that actively advertise sponsorship.
//
// `positive` / `negative` default to a curated US-sponsorship vocabulary when
// omitted, so `visa_filter: { enabled: true }` works out of the box; supplying
// either list overrides that default.

export const DEFAULT_VISA_POSITIVE = [
  'visa sponsorship',
  'sponsor a visa',
  'sponsor visas',
  'will sponsor',
  'sponsorship available',
  'sponsorship is available',
  'eligible for sponsorship',
  'provide sponsorship',
  'offer sponsorship',
  'immigration support',
  'h-1b',
  'h1b',
  'h-1b1',
  'h1b1',
  'o-1 visa',
];

export const DEFAULT_VISA_NEGATIVE = [
  'no visa sponsorship',
  'no sponsorship',
  'without sponsorship',
  'unable to sponsor',
  'not able to sponsor',
  'cannot sponsor',
  'do not sponsor',
  'does not sponsor',
  'not offer sponsorship',
  'not provide sponsorship',
  'sponsorship is not available',
  'sponsorship not available',
  'not offer visa sponsorship',
];

export function buildVisaFilter(visaFilter) {
  if (!visaFilter || visaFilter.enabled === false) return () => true;
  const positive = visaFilter.positive != null
    ? normalizeKeywordList(visaFilter.positive)
    : DEFAULT_VISA_POSITIVE.slice();
  const negative = visaFilter.negative != null
    ? normalizeKeywordList(visaFilter.negative)
    : DEFAULT_VISA_NEGATIVE.slice();
  const requireMention = visaFilter.require_mention === true;

  return (description) => {
    const hasText = typeof description === 'string' && description.trim() !== '';
    if (!hasText) return !requireMention;
    const lower = description.toLowerCase();
    if (negative.length > 0 && negative.some(k => lower.includes(k))) return false;
    if (!requireMention) return true;
    if (positive.length === 0) return true;
    return positive.some(k => lower.includes(k));
  };
}

// ── Salary filter ───────────────────────────────────────────────────
// Optional. If `salary_filter` is absent from portals.yml, all salaries pass.
// Semantics:
//   - min/max are annual compensation filters (use annualized values)
//   - max: 0 means "no upper limit"
//   - If no salary data exists on a job, it passes (conservative behavior)
//   - If both currencies are known and mismatch (e.g., USD filter, EUR job), it fails
//   - Partial ranges (min only or max only) work correctly via overlap logic
// Uses null-safe checks (!= null, ??) to preserve 0 values correctly.

export function buildSalaryFilter(salaryFilter) {
  if (!salaryFilter) return () => true;

  // Coerce and validate bounds — malformed YAML must not silently mis-filter
  const min = Number(salaryFilter.min ?? 0);
  const max = Number(salaryFilter.max ?? 0);
  const filterCurrency = (salaryFilter.currency || '').trim().toUpperCase();

  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < 0) {
    console.error('Warning: salary_filter.min/max must be non-negative numbers — salary filter disabled');
    return () => true;
  }
  if (max > 0 && min > max) {
    console.error('Warning: salary_filter.min cannot exceed salary_filter.max — salary filter disabled');
    return () => true;
  }

  // If both min and max are 0, no filtering applied
  if (min === 0 && max === 0) return () => true;

  return (salary) => {
    // If no salary data exists, pass (conservative - many providers don't expose salary)
    if (!salary) return true;

    const jobMin = salary.min ?? salary.max ?? null;
    const jobMax = salary.max ?? salary.min ?? null;

    // If we have no usable salary values, pass conservatively
    if (jobMin == null && jobMax == null) return true;

    // Currency handling - reject only if BOTH currencies exist and mismatch
    const jobCurrency = (salary.currency || '').trim().toUpperCase();
    if (filterCurrency && jobCurrency && filterCurrency !== jobCurrency) {
      return false;
    }

    // Range overlap logic - reject ONLY if job is completely outside filter range
    // Job entirely below user minimum
    if (min > 0 && jobMax != null && jobMax < min) {
      return false;
    }
    // Job entirely above user maximum
    if (max > 0 && jobMin != null && jobMin > max) {
      return false;
    }

    // Otherwise pass (overlap exists or no valid range to compare)
    return true;
  };
}

export function companyMatch(jobCompany, windowCompany) {
  // Unicode-aware (#2393 family): the [a-z0-9] strip this used to carry erased
  // non-Latin scripts outright, so 株式会社アカネ and 合同会社ゾロ both cleaned
  // to '' and the equality check below reported two unrelated companies as the
  // same one. The empty guard is part of the fix, not decoration — "no usable
  // signal on either side" must never read as "identical".
  const c1NoSpaces = normalizeTextKey(jobCompany);
  const c2NoSpaces = normalizeTextKey(windowCompany);
  if (c1NoSpaces && c1NoSpaces === c2NoSpaces) return true;

  const c1WithSpaces = normalizeTextKey(jobCompany, ' ');
  const c2WithSpaces = normalizeTextKey(windowCompany, ' ');
  if (!c1WithSpaces || !c2WithSpaces) return false;

  // Containment: a short window name should still match a longer official one
  // ("Acme" vs "Acme Corp"), bounded so "Acme" does not match "Acmetric".
  //
  // The anchors are lookarounds, not \b: JS defines \b against ASCII \w even
  // under the u flag. Keeping the accent (rather than stripping it to a space,
  // as the [a-z0-9] filter did before) means '\bnestlé\b' can never hold —
  // neither side of the trailing anchor is a word character — so Nestlé
  // Deutschland vs Nestlé would silently stop matching. Same for Ørsted, Zoë
  // and every other name whose first or last letter is non-ASCII.
  //
  // The anchor class is the one normalizeTextKey keeps, deliberately. An anchor
  // class without \p{M} would treat a Devanagari matra as a boundary and split
  // कंपनी mid-word — the key and its boundaries have to agree on what a letter
  // is, or they drift the way #2397 and #2445 fixed elsewhere.
  //
  // Non-Latin containment does not fire here (株式会社メルカリ vs メルカリ): the
  // lookbehind sees 社, a letter, so there is no boundary to assert, and
  // Japanese is not space-delimited so no anchor rule recovers it. Note this
  // pair DID match before this change, but only via the '' === '' collision
  // that erased both names — not through this path. Making it match on purpose
  // needs corporate-form normalisation, tracked separately in #2570.
  //
  // compileLocationKeyword() above reached for lookarounds too, for a related
  // reason ("\b behaves surprisingly at a punctuation edge"); its escape set is
  // reused here because '\-' is an invalid identity escape under u. Both
  // operands are already normalizeTextKey output — letters, marks, digits and
  // spaces only — so the escape is defensive, not load-bearing.
  const bounded = (name) => new RegExp(
    `(?<![\\p{L}\\p{M}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{M}\\p{N}])`,
    'u',
  );
  return bounded(c2WithSpaces).test(c1WithSpaces) || bounded(c1WithSpaces).test(c2WithSpaces);
}

export function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Reads config/profile.yml's `location.country` (already a documented
// profile field — see config/profile.example.yml) for the country-
// eligibility filter (#2093). Missing file, missing field, or a malformed
// profile all resolve to '' — buildCountryEligibilityFilter treats an empty
// candidate country the same as "not the candidate's own country's US
// no-op" and simply skips the literal-country-name pass-through, which is
// the same conservative "don't penalize missing data" default used
// throughout this file.
export function loadCandidateCountry(profilePath = DEFAULT_PROFILE_PATH) {
  if (!existsSync(profilePath)) return '';
  try {
    const raw = yaml.load(readFileSync(profilePath, 'utf-8')) || {};
    const country = raw?.location?.country;
    return typeof country === 'string' ? country.trim() : '';
  } catch {
    return '';
  }
}

export function loadReApplyWindows(profilePath = DEFAULT_PROFILE_PATH) {
  if (!existsSync(profilePath)) return {};
  try {
    const raw = yaml.load(readFileSync(profilePath, 'utf-8')) || {};
    const windows = raw.re_apply_windows || {};
    const validWindows = {};
    for (const [company, win] of Object.entries(windows)) {
      if (!win || typeof win !== 'object') continue;
      const lastApplyDate = win.last_apply_date;
      if (typeof lastApplyDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(lastApplyDate)) continue;
      if (isNaN(Date.parse(lastApplyDate))) continue;

      const sameRoleDays = win.same_role_days;
      if (sameRoleDays !== undefined && (!Number.isInteger(sameRoleDays) || sameRoleDays < 0)) continue;

      if (win.applied_to !== undefined && !Array.isArray(win.applied_to)) continue;
      if (win.applied_to !== undefined && win.applied_to.some(x => typeof x !== 'string')) continue;

      if (win.cross_role_bucket !== undefined && typeof win.cross_role_bucket !== 'string') continue;

      validWindows[company] = win;
    }
    return validWindows;
  } catch {
    return {};
  }
}

export function buildCooldownFilter(windows, today) {
  if (!windows || Object.keys(windows).length === 0) {
    return () => ({ skip: false });
  }

  const genericKeywords = new Set(['all', 'roles', 'role', 'family', 'bucket', 'group', 'team']);

  return (job) => {
    const jobCompany = job.company || '';
    const jobTitleLower = (job.title || '').toLowerCase();

    for (const [windowCompany, window] of Object.entries(windows)) {
      if (companyMatch(jobCompany, windowCompany)) {
        const lastApplyDate = window.last_apply_date;
        const sameRoleDays = Number(window.same_role_days || 0);
        if (!lastApplyDate) continue;

        const cooldownUntil = addDays(lastApplyDate, sameRoleDays);
        if (today >= cooldownUntil) {
          continue;
        }

        if (Array.isArray(window.applied_to)) {
          const matchesApplied = window.applied_to.some(role => {
            const roleLower = role.toLowerCase();
            return jobTitleLower.includes(roleLower);
          });
          if (matchesApplied) {
            return { skip: true, reason: `cooldown:${windowCompany}:${cooldownUntil}`, cooldownUntil };
          }
        }

        if (window.cross_role_bucket) {
          const bucketKeywords = window.cross_role_bucket
            .toLowerCase()
            .split('_')
            .filter(kw => kw && !genericKeywords.has(kw));

          const matchesBucket = bucketKeywords.some(kw => {
            if (kw === 'em') {
              return /\bem\b/i.test(jobTitleLower) || jobTitleLower.includes('engineering manager');
            }
            return jobTitleLower.includes(kw);
          });

          if (matchesBucket) {
            return { skip: true, reason: `cooldown:${windowCompany}:${cooldownUntil}`, cooldownUntil };
          }
        }
      }
    }

    return { skip: false };
  };
}
