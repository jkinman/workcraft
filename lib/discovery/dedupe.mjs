import { readFileSync, existsSync } from 'fs';
import { resolveColumns, parseTrackerRow, normalizeTextKey } from '../../tracker-parse.mjs';
import { discoveryPaths } from './paths.mjs';

const DEFAULT_PATHS = () => discoveryPaths();

const PERMANENT_SCAN_HISTORY_STATUSES = new Set([
  'skipped_invalid_url',
  'skipped_blocked_host',
]);

function daysBetweenIsoDates(start, end) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return null;
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (startDate.toISOString().slice(0, 10) !== start || endDate.toISOString().slice(0, 10) !== end) return null;
  return Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
}

export function shouldDedupScanHistoryRow({ firstSeen, status = 'added' }, { recheckAfterDays = null, today = new Date().toISOString().slice(0, 10) } = {}) {
  if (PERMANENT_SCAN_HISTORY_STATUSES.has(status)) return true;
  if (status.startsWith('cooldown:')) {
    const parts = status.split(':');
    const cooldownUntil = parts[parts.length - 1];
    return today < cooldownUntil;
  }
  if (status !== 'added') return true;
  if (recheckAfterDays == null) return true;
  const ageDays = daysBetweenIsoDates(firstSeen, today);
  if (ageDays == null) return true;
  return ageDays < recheckAfterDays;
}



// Query params that carry no identity information for a job posting — safe to
// strip when computing the dedup key. Deliberately an allowlist rather than
// "strip everything": several ATSes key the posting off a query param (e.g.
// Greenhouse's `gh_jid`), so a blanket strip would collapse distinct roles.
const DEDUP_STRIP_PARAMS = new Set([
  'language', 'lang', 'locale',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'ref', 'src', 'source', 'gh_src', 'lever-origin', 'lever-source',
  'rltr', // StepStone: regenerated per request, so one posting returns as new every scan
]);

/**
 * Normalize a job posting URL into a stable dedup key.
 *
 * Strips cosmetic query params (locale/tracking), drops a trailing slash,
 * and lowercases scheme, host, and path. Only used to compute the
 * *comparison* key — callers keep writing/displaying the original URL so
 * links stay clickable and scan-history/pipeline.md stay faithful to what
 * the provider returned.
 *
 * The path is lowercased because scan.mjs and scan-ats-full.mjs run as
 * separate processes and can independently produce different casing for the
 * identical posting — a Workday tenant/site path segment reached via the
 * curated portals.yml entry vs. the reverse-ATS dataset, for instance. A
 * case-sensitive key silently treats those as two distinct URLs, so the same
 * role lands in pipeline.md twice. Path casing is not meaningfully distinct
 * for any provider these scanners target.
 *
 * Query *values* keep their original casing — those can be identity-bearing
 * (Greenhouse's `gh_jid`), which is also why DEDUP_STRIP_PARAMS is an
 * allowlist rather than a blanket strip.
 *
 * Falls back to the raw string when the URL is malformed, preserving the
 * old byte-for-byte behavior for unparsable history rows.
 *
 * @param {string} url
 * @returns {string}
 */
export function normalizeUrlForDedup(url) {
  if (typeof url !== 'string' || !url) return url;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  for (const param of Array.from(parsed.searchParams.keys())) {
    if (DEDUP_STRIP_PARAMS.has(param.toLowerCase())) {
      parsed.searchParams.delete(param);
    }
  }
  parsed.hash = '';
  parsed.pathname = parsed.pathname.replace(/\/+$/, '').toLowerCase() || '/';
  return parsed.toString();
}



/**
 * Normalize a company label when no alias map is configured.
 *
 * This deliberately does only the pre-existing behavior: trim and lowercase the
 * raw company name. `buildCompanyCanonicalizer` wraps this with the optional
 * alias map so installs without `company_aliases` keep byte-for-byte dedupe
 * semantics.
 *
 * @param {unknown} name - Raw company value from a tracker row or provider job.
 * @returns {string} Lowercased, trimmed company key.
 */
function defaultCompanyNormalizer(name) {
  return String(name ?? '').trim().toLowerCase();
}

/**
 * Build a company-name canonicalizer from `config.company_aliases`.
 *
 * The map is `{ CanonicalName: [alias, ...] }`; every alias and the canonical
 * name itself resolve to the lowercased canonical name. This closes the gap
 * where an ATS org name, for example Greenhouse "Intercom", differs from the
 * tracker/brand label, for example "Fin". Without it, the company+role dedupe
 * key never matches the tracker and the same role is re-scanned every run.
 *
 * Unknown names pass through as plain lowercased text, so behavior is unchanged
 * for companies with no alias entry.
 *
 * Canonical names always keep their own identity when an alias collides with
 * one. An alias claimed by multiple canonical companies also passes through
 * unchanged so malformed config cannot silently merge unrelated companies.
 *
 * @param {Record<string, unknown>|undefined|null} aliases - Optional canonical
 *   company name to alias list map.
 * @returns {(name: unknown) => string} Canonicalizer for tracker and scan-side
 *   company labels.
 */
export function buildCompanyCanonicalizer(aliases) {
  const map = new Map();
  if (aliases && typeof aliases === 'object' && !Array.isArray(aliases)) {
    const entries = Object.entries(aliases);
    const canonicalKeys = new Set();

    // Canonical names always own their identity, independent of YAML key order.
    for (const [canonical] of entries) {
      const canon = defaultCompanyNormalizer(canonical);
      if (!canon) continue;
      map.set(canon, canon);
      canonicalKeys.add(canon);
    }

    const aliasTargets = new Map();
    for (const [canonical, list] of entries) {
      const canon = defaultCompanyNormalizer(canonical);
      if (!canon) continue;
      const arr = Array.isArray(list) ? list : [list];
      for (const a of arr) {
        const alias = defaultCompanyNormalizer(a);
        if (!alias || canonicalKeys.has(alias)) continue;
        if (!aliasTargets.has(alias)) aliasTargets.set(alias, new Set());
        aliasTargets.get(alias).add(canon);
      }
    }

    // Ambiguous aliases fail open as their raw normalized label. This may allow
    // a duplicate through, but it cannot silently suppress another company.
    for (const [alias, targets] of aliasTargets) {
      if (targets.size === 1) map.set(alias, targets.values().next().value);
    }
  }

  /**
   * Canonicalize one raw company label through the alias map.
   *
   * @param {unknown} name - Raw company value from a tracker row or provider job.
   * @returns {string} Canonical lowercased company key.
   */
  return function canonicalizeCompany(name) {
    const key = defaultCompanyNormalizer(name);
    return map.get(key) ?? key;
  };
}

const ROLE_LOCATION_SUFFIXES = new Set([
  'amer',
  'americas',
  'amsterdam',
  'apac',
  'austin',
  'barcelona',
  'bay area',
  'belgium',
  'berlin',
  'boston',
  'brussels',
  'budapest',
  'canada',
  'chicago',
  'copenhagen',
  'dublin',
  'emea',
  'eu',
  'europe',
  'finland',
  'france',
  'frankfurt',
  'germany',
  'hamburg',
  'helsinki',
  'india',
  'ireland',
  'italy',
  'la',
  'latin america',
  'lisbon',
  'london',
  'los angeles',
  'madrid',
  'melbourne',
  'milan',
  'montreal',
  'munich',
  'netherlands',
  'new york',
  'north america',
  'nyc',
  'on site',
  'onsite',
  'oslo',
  'paris',
  'poland',
  'porto',
  'prague',
  'remote',
  'rome',
  'san francisco',
  'seattle',
  'sf',
  'singapore',
  'spain',
  'stockholm',
  'sydney',
  'tokyo',
  'toronto',
  'uk',
  'united kingdom',
  'united states',
  'us',
  'usa',
  'vancouver',
  'vienna',
  'warsaw',
  'zurich',
]);

const ROLE_REMOTE_SUFFIXES = new Set([
  'distributed',
  'hybrid',
  'on site',
  'onsite',
  'remote',
  'wfh',
  'work from home',
]);

/**
 * Normalize bracket text before checking whether it is a location suffix.
 *
 * @param {unknown} tag - Text from a trailing parenthetical or bracket suffix.
 * @returns {string} Lowercased, punctuation-normalized suffix text.
 */
function normalizeRoleSuffixTag(tag) {
  return String(tag ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Decide whether a trailing role-title suffix is a location/remote tag.
 *
 * Only known remote/location suffixes are stripped. Seniority, discipline, team,
 * and product qualifiers are intentionally preserved so distinct role variants
 * do not collapse to the same scanner dedupe key.
 *
 * @param {unknown} tag - Text from a trailing parenthetical or bracket suffix.
 * @returns {boolean} True when the suffix is safe to remove for dedupe.
 */
function isRoleLocationSuffix(tag) {
  const normalized = normalizeRoleSuffixTag(tag);
  if (!normalized) return false;
  if (ROLE_LOCATION_SUFFIXES.has(normalized)) return true;

  const raw = String(tag ?? '').toLowerCase();
  const parts = raw
    .split(/[,/|;]+|\s+(?:and|or)\s+/g)
    .map(normalizeRoleSuffixTag)
    .filter(Boolean);
  if (parts.length > 1 && parts.every(part => ROLE_LOCATION_SUFFIXES.has(part))) return true;

  for (const remote of ROLE_REMOTE_SUFFIXES) {
    const prefix = `${remote} `;
    if (normalized.startsWith(prefix) && ROLE_LOCATION_SUFFIXES.has(normalized.slice(prefix.length))) {
      return true;
    }
  }
  return false;
}

/**
 * Normalize a role title for stable scan-time duplicate identity.
 *
 * Equivalent tracker/provider titles should collapse to one key when a company
 * splits a role per location with a trailing tag like "(Berlin)". Requisition
 * IDs live in URLs rather than titles, so this identity remains URL-agnostic.
 *
 * The normalizer lowercases the title, strips trailing location/remote
 * parenthetical/bracketed tags such as "(Berlin)" and "[Remote]", then
 * collapses punctuation and whitespace so em dash vs hyphen or double spaces do
 * not split a key.
 *
 * This helper does not infer posting churn or detect repost clusters. Those
 * post-tracking facts remain the responsibility of detect-reposts.mjs and the
 * company-history `postingChurn` axis.
 *
 * @param {unknown} role - Raw role title from a tracker row or provider job.
 * @returns {string} Normalized role key.
 */
export function normalizeRoleForDedup(role) {
  // NFKC up front so full-width brackets fold to their ASCII forms while the
  // suffix loop can still see them: "Engineer （Remote）" now strips the same
  // way "Engineer (Remote)" always did.
  //
  // This does NOT make the loop understand non-Latin suffixes — the tag itself
  // is still matched against the English-only ROLE_LOCATION_SUFFIXES set via
  // normalizeRoleSuffixTag(), which carries its own [a-z0-9] strip. So
  // "エンジニア（東京）" and "エンジニア（大阪）" remain two keys. Teaching the
  // suffix vocabulary other scripts is a separate change (new vocabulary, not
  // a key fix) and is deliberately out of scope here.
  let title = String(role ?? '').normalize('NFKC').toLowerCase();
  while (true) {
    const match = title.match(/\s*[\[(]([^[\]()]+)[\])]\s*$/);
    if (!match || !isRoleLocationSuffix(match[1])) break;
    title = title.slice(0, match.index).trimEnd();
  }
  // Unicode-aware (#2393 family): the [a-z0-9] strip this used to carry keyed
  // every non-Latin title to '', so バックエンドエンジニア and フロントエンド
  // エンジニア at one company shared a dedupe key and the scan dropped the
  // second as already-seen. Space separator keeps the word-collapsing shape.
  return normalizeTextKey(title, ' ');
}

/**
 * Build the canonical company+role dedupe key.
 *
 * This shared helper is used by both the tracker-side load and the scan-side
 * check so those two code paths cannot drift. `canonicalize` defaults to plain
 * lowercase/trim behavior when no alias map is configured.
 *
 * @param {unknown} company - Raw company label.
 * @param {unknown} role - Raw role title.
 * @param {(name: unknown) => string} [canonicalize] - Company canonicalizer.
 * @returns {string} Stable dedupe key in `company::role` form.
 */
export function companyRoleDedupKey(company, role, canonicalize = defaultCompanyNormalizer) {
  return `${canonicalize(company)}::${normalizeRoleForDedup(role)}`;
}

/**
 * Build the seen-role set from the same three sources as `loadSeenUrls`.
 *
 * Existing rows are canonicalized with the same company aliasing and role-title
 * normalization used for freshly scanned jobs. That lets URL-new duplicates match
 * older entries instead of being evaluated again.
 *
 * Seeding from applications.md alone made the key effectively intra-run: a role
 * added by a prior scan lives in scan-history and pipeline, and does not reach
 * applications.md until the user evaluates and applies. Companies that open one req
 * per city therefore leaked one city variant per scan — run 1 added the SF req
 * (marking the key in memory only), run 2 re-seeded from applications.md, found the
 * key absent, and the NY req cleared both the URL check and the role check.
 *
 * Two deliberate semantics on the scan-history source:
 *
 * - Only `added` rows seed a key. `skipped_expired` / `skipped_invalid_url` /
 *   `skipped_blocked_host` are URL-level failures, not evidence the role was
 *   surfaced; seeding from them would let a dead SF URL bury a live NY req. Because
 *   an expired posting is recorded as `skipped_expired` rather than `added`, this
 *   self-heals: when the canonical posting dies, its city variants become eligible
 *   again on the next scan.
 * - Seeding honours `scan_history.recheck_after_days` via the existing
 *   `shouldDedupScanHistoryRow` predicate, so the role key cannot outlive the URL
 *   key it mirrors.
 *
 * @param {{applicationsText?: string, scanHistoryText?: string, pipelineText?: string}} sources
 *   Raw text of each dedupe source; absent sources default to empty.
 * @param {{recheckAfterDays?: number|null, today?: string}} [policy] - Scan-history
 *   recheck policy, shared with `loadSeenUrls`.
 * @param {(name: unknown) => string} [canonicalize=defaultCompanyNormalizer] -
 *   Company canonicalizer shared with scan-side dedupe.
 * @returns {Set<string>} Existing company+role dedupe keys.
 */
export function collectSeenCompanyRoles(sources = {}, policy = {}, canonicalize = defaultCompanyNormalizer) {
  const { applicationsText = '', scanHistoryText = '', pipelineText = '' } = sources;
  const seen = new Set();
  const add = (company, role) => {
    const c = String(company ?? '').trim();
    const r = String(role ?? '').trim();
    if (!c || !r) return;
    // Header and markdown-separator cells are not roles.
    if (c.toLowerCase() === 'company') return;
    if (/^[-:]+$/.test(c) || /^[-:]+$/.test(r)) return;
    seen.add(companyRoleDedupKey(c, r, canonicalize));
  };

  // applications.md — header-aware parse (tracker-parse.mjs, #954). The old
  // positional regex captured the wrong cells on customized layouts (e.g. with a
  // Location column), so the seen-set keyed on garbage and dedup misfired.
  if (applicationsText) {
    const lines = applicationsText.split('\n');
    const colmap = resolveColumns(lines);
    for (const line of lines) {
      const row = parseTrackerRow(line, colmap);
      if (!row) continue;
      add(row.company, row.role);
    }
  }

  // scan-history.tsv — url, first_seen, portal, title, company, status, location
  for (const line of scanHistoryText.split('\n').slice(1)) { // skip header
    const [url, firstSeen, , title, company, status = 'added'] = line.split('\t');
    if (!url) continue;
    if (status !== 'added') continue;
    if (!shouldDedupScanHistoryRow({ firstSeen, status }, policy)) continue;
    add(company, title);
  }

  // pipeline.md — "- [ ] {url} | {company} | {title}" plus optional trailing
  // columns (location, compensation, posted:/trust:/note: segments).
  for (const match of pipelineText.matchAll(/^- \[[ x]\]\s+\S+\s*\|\s*([^|\n]+?)\s*\|\s*([^|\n]+?)\s*(?:\|[^\n]*)?$/gm)) {
    add(match[1], match[2]);
  }

  return seen;
}

function readIfExists(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, 'utf-8') : '';
}

/**
 * Load company+role keys already surfaced by a prior scan or tracked by the user.
 *
 * Thin filesystem wrapper over {@link collectSeenCompanyRoles}, mirroring the
 * source list `loadSeenUrls` already reads.
 *
 * The two leading positional parameters are unchanged, so existing callers keep
 * working. The extra sources are injectable via the trailing options object: the
 * module-level paths are relative to `process.cwd()`, so a test that passes only a
 * sandbox tracker would otherwise pick up the developer's real scan-history and
 * pipeline (CI only avoids this because those files are gitignored).
 *
 * @param {string} [appsPath=paths.applicationsPath] - Applications tracker path.
 * @param {(name: unknown) => string} [canonicalize=defaultCompanyNormalizer] -
 *   Company canonicalizer shared with scan-side dedupe.
 * @param {object} [options] - Additional sources and policy.
 * @param {{recheckAfterDays?: number|null, today?: string}} [options.policy] -
 *   Scan-history recheck policy, shared with `loadSeenUrls`.
 * @param {string} [options.scanHistoryPath=paths.scanHistoryPath] - Scan-history path.
 * @param {string} [options.pipelinePath=paths.pipelinePath] - Pipeline inbox path.
 * @returns {Set<string>} Existing company+role dedupe keys.
 */

export function scanHistoryPolicy(config = {}) {
  const raw = config.scan_history?.recheck_after_days;
  const parsed = Number.parseInt(raw, 10);
  return {
    recheckAfterDays: Number.isFinite(parsed) && parsed >= 0 ? parsed : null,
  };
}

export function loadSeenUrls(policy = {}, paths = DEFAULT_PATHS()) {
  const seen = new Set();
  let recheckEligible = 0;
  if (existsSync(paths.scanHistoryPath)) {
    const histLines = readFileSync(paths.scanHistoryPath, 'utf-8').split('\n');
    for (const line of histLines.slice(1)) {
      const [url, firstSeen, , , , status = 'added'] = line.split('\t');
      if (!url) continue;
      if (shouldDedupScanHistoryRow({ firstSeen, status }, policy)) seen.add(normalizeUrlForDedup(url));
      else recheckEligible++;
    }
  }
  if (existsSync(paths.pipelinePath)) {
    const text = readFileSync(paths.pipelinePath, 'utf-8');
    for (const match of text.matchAll(/- \[[ x]\] (https?:\/\/\S+)/g)) {
      seen.add(normalizeUrlForDedup(match[1]));
    }
  }
  if (existsSync(paths.applicationsPath)) {
    const text = readFileSync(paths.applicationsPath, 'utf-8');
    for (const match of text.matchAll(/https?:\/\/[^\s|)]+/g)) {
      seen.add(normalizeUrlForDedup(match[0]));
    }
  }
  return { seen, recheckEligible };
}

export function loadSeenCompanyRoles(
  appsPath = DEFAULT_PATHS().applicationsPath,
  canonicalize = defaultCompanyNormalizer,
  { policy = {}, scanHistoryPath = DEFAULT_PATHS().scanHistoryPath, pipelinePath = DEFAULT_PATHS().pipelinePath } = {},
) {
  return collectSeenCompanyRoles({
    applicationsText: readIfExists(appsPath),
    scanHistoryText: readIfExists(scanHistoryPath),
    pipelineText: readIfExists(pipelinePath),
  }, policy, canonicalize);
}

