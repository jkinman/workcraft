import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { normalizeCompany } from '../../tracker-utils.mjs';
import { normalizeCompanyName } from '../../invite-match.mjs';
import { fingerprintText } from '../../fingerprint-core.mjs';
import { withPipelineLock } from '../../pipeline-lock.mjs';
import { withPortalHealthLock } from '../../portal-health-lock.mjs';
import { discoveryPaths } from './paths.mjs';

const DEFAULT_PATHS = () => discoveryPaths();

/** Canonical scan-history header prefix (7 cols); trailing cols are append-only. */
export const SCAN_HISTORY_HEADER = 'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tlocation\tfingerprint\tposted_at\ttrust_score\ttrust_flags\tnormalized_company\n';

function normalizeScanScalar(value) {
  return String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

function normalizeScanUrl(value) {
  return String(value ?? '').trim().split(/\s+/)[0] || '';
}

const MARKDOWN_ESCAPE_CHARS = {
  '\\': '\\\\',
  '[': '\\[',
  ']': '\\]',
};

export function sanitizeMarkdownField(value) {
  return normalizeScanScalar(value)
    .replace(/[\\[\]]/g, char => MARKDOWN_ESCAPE_CHARS[char])
    .replace(/\|/g, '/');
}

function sanitizePipelineUrl(value) {
  return normalizeScanUrl(value)
    .replace(/[\\[\]]/g, char => MARKDOWN_ESCAPE_CHARS[char])
    .replace(/\|/g, '%7C');
}

export function sanitizeTsvField(value) {
  const normalized = normalizeScanScalar(value);
  return /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
}

// Format an offer's parsed compensation (the annualized {min,max,currency} that
// providers like Ashby attach as `offer.salary`) into a compact, sanitized cell
// such as `120000-160000 USD`. Returns '' when there is no usable salary data.
// Non-positive bounds are dropped (a 0 min/max is meaningless comp data, not "$0").
export function formatCompensation(salary) {
  if (!salary || typeof salary !== 'object') return '';
  const num = (n) => (Number.isFinite(n) && n > 0 ? String(Math.round(n)) : null);
  const lo = num(salary.min);
  const hi = num(salary.max);
  const range = lo && hi && lo !== hi ? `${lo}-${hi}` : (lo || hi || '');
  if (!range) return '';
  const currency = typeof salary.currency === 'string' ? salary.currency.trim() : '';
  return sanitizeMarkdownField(currency ? `${range} ${currency}` : range);
}

// Trust/legitimacy signal (#1743): the scanner sets offer.trustScore (0-100) +
// offer.trustFlags on every job (see buildTrustValidator). Surface it only when
// it's meaningful — a score below 100 means the validator penalized the posting
// (e.g. missing_apply_url, invalid_url, suspicious_domain). A clean posting
// (score 100) or a scan without trust_filter configured stays byte-identical
// (empty), exactly like the posted:/note: segments.
export function trustIsFlagged(offer) {
  return typeof offer.trustScore === 'number' && Number.isFinite(offer.trustScore) && offer.trustScore < 100;
}

function trustFlagList(offer) {
  return Array.isArray(offer.trustFlags)
    ? offer.trustFlags.filter((f) => typeof f === 'string' && f.trim())
    : [];
}

// Labeled pipeline segment, e.g. `trust: 60 missing_apply_url,suspicious_domain`.
// '' when the posting isn't flagged, so an unflagged offer produces no segment.
export function formatTrustSegment(offer) {
  if (!trustIsFlagged(offer)) return '';
  const flags = trustFlagList(offer);
  const body = flags.length ? `${offer.trustScore} ${flags.join(',')}` : String(offer.trustScore);
  return sanitizeMarkdownField(`trust: ${body}`);
}

export function formatPipelineOffer(offer) {
  const url = sanitizePipelineUrl(offer.url);
  const company = sanitizeMarkdownField(offer.company);
  const title = sanitizeMarkdownField(offer.title);
  // Optional trailing columns, each sanitized like every other field:
  //   4th = location, 5th = compensation.
  // Gate location on an actual string so malformed provider data (a number or
  // object) degrades to the 3-column form instead of stringifying into a
  // spurious column. The columns are positional, so a present compensation
  // forces the (possibly empty) location cell to keep comp in column 5.
  // loadSeenUrls dedups on the URL and ignores trailing columns (backward-compatible).
  const location = typeof offer.location === 'string' ? sanitizeMarkdownField(offer.location) : '';
  const compensation = formatCompensation(offer.salary);
  const base = `- [ ] ${url} | ${company} | ${title}`;
  let line = base;
  if (compensation) line = `${base} | ${location} | ${compensation}`;
  else if (location) line = `${base} | ${location}`;
  // Optional labeled posting-date segment (like note:) — keeps the positional
  // 1/3/4/5-column contract in modes/pipeline.md intact.
  const posted = postedAtIsoDate(offer.postedAt);
  if (posted) line = `${line} | posted: ${posted}`;
  // Labeled trust/legitimacy segment (#1743) — rides like posted:/note:, emitted
  // only when the scanner flagged the posting (score < 100). Ordered after
  // posted:, before note:, for a stable serialization.
  const trust = formatTrustSegment(offer);
  if (trust) line = `${line} | ${trust}`;
  // Optional free-text ranking signal (e.g. a curated-list flag an importer
  // attaches). Labeled — not positional like location/compensation — so it can
  // ride on any row shape (bare URL, 3-, 4-, or 5-column) without a reader
  // confusing it for a positional cell, and it stays generic: nothing here is
  // source-specific, and an offer without `note` produces byte-identical output.
  const note = typeof offer.note === 'string' ? sanitizeMarkdownField(offer.note) : '';
  return note ? `${line} | note: ${note}` : line;
}

// postedAt arrives as epoch ms (or absent). Convert to 'YYYY-MM-DD', or '' when missing.
function postedAtIsoDate(postedAt) {
  if (typeof postedAt !== 'number' || !Number.isFinite(postedAt) || postedAt <= 0) return '';
  return new Date(postedAt).toISOString().slice(0, 10);
}
export function formatScanHistoryRow(offer, date, status = 'added') {
  const fingerprint = offer.fingerprint
    ?? (offer.description ? fingerprintText(offer.description) : '');
  return [
    normalizeScanUrl(offer.url),
    date,
    offer.source,
    offer.title,
    offer.company,
    status,
    offer.location || '',
    fingerprint,
    // New trailing column: posting date. Existing readers index by position up to
    // col 7, so appending col 8 is backward-compatible.
    postedAtIsoDate(offer.postedAt),
    // Trust/legitimacy signal (#1743): score (only when the scanner flagged the
    // posting, i.e. < 100) + comma-joined flags. Trailing cols 9-10, so existing
    // index-based readers (fingerprint@7, postedAt@8) are unaffected; a clean
    // posting or a scan without trust_filter leaves both empty.
    trustIsFlagged(offer) ? String(offer.trustScore) : '',
    trustIsFlagged(offer) ? trustFlagList(offer).join(',') : '',
    // Normalized company key (#2093): the canonical company form shared across
    // the tracker (normalizeCompanyName — lowercased, punctuation/whitespace
    // folded, trailing legal-entity suffixes stripped) so "Acme Inc.",
    // "Acme, Inc." and "ACME  Inc" all key to `acme`. Stored at write time so
    // repost/name-matching never has to route through executing a script, and
    // the raw display company in col 5 stays faithful to what the provider
    // returned. Trailing col 12 — purely additive: index-based readers
    // (fingerprint@7, postedAt@8, trust@9-10, and the web parser's first 7
    // cols) are unaffected, and older rows that lack it are tolerated by
    // consumers normalizing the raw name on the fly.
    normalizeCompanyName(offer.company || ''),
  ].map(sanitizeTsvField).join('\t');
}

/**
 * Read scan-history.tsv rows that carry a fingerprint, for the cross-listing
 * check. Older rows without the 8th column simply never match.
 *
 * @param {string} [historyPath] - Override for tests.
 * @returns {Array<{url: string, dateStr: string, company: string, title: string, fingerprint: string}>}
 */
export function loadFingerprintHistory(historyPath = DEFAULT_PATHS().scanHistoryPath) {
  if (!existsSync(historyPath)) return [];
  const rows = [];
  for (const line of readFileSync(historyPath, 'utf-8').split('\n')) {
    const cols = line.split('\t');
    // Skip the header row. Older 7-col headers fall out of the `cols.length < 8`
    // guard below on their own, but the 12-col header names col 7 `fingerprint`
    // (non-empty), so it would otherwise pass that guard and be read as data.
    // Real rows always carry a URL in col 0, never the literal `url`.
    if (cols[0] === 'url') continue;
    if (cols.length < 8 || !cols[7].trim()) continue;
    rows.push({
      url: (cols[0] || '').trim(),
      dateStr: (cols[1] || '').trim(),
      title: (cols[3] || '').trim(),
      company: (cols[4] || '').trim(),
      fingerprint: cols[7].trim(),
    });
  }
  return rows;
}

// Standard skeleton created on fresh install — matches the format documented
// in modes/pipeline.md and expected by /career-ops pipeline.
const PIPELINE_SKELETON = `# Pipeline — Pending URLs

Paste job URLs below as \`- [ ] {url}\` then run \`/career-ops pipeline\`.

## Pending

## Processed
`;

// Current section names (English). Legacy Spanish names are checked as fallback
// so existing pipeline.md files created before this change keep working.
const PENDING_MARKERS = ['## Pending', '## Pendientes'];
const PROCESSED_MARKERS = ['## Processed', '## Procesadas'];

// Locked (pipeline-lock.mjs) so scan.mjs, scan-ats-full.mjs, and plugins.mjs
// (pipeline mode) — the three current callers — can never interleave their
// read-modify-write and silently drop each other's offers.
export async function appendToPipeline(offers, paths = DEFAULT_PATHS()) {
  if (offers.length === 0) return;

  await withPipelineLock(paths.pipelinePath, async () => {
    // Auto-create with standard skeleton if missing (fresh-install guard).
    if (!existsSync(paths.pipelinePath)) {
      writeFileSync(paths.pipelinePath, PIPELINE_SKELETON, 'utf-8');
    }

    let text = readFileSync(paths.pipelinePath, 'utf-8');

    const marker = PENDING_MARKERS.find(m => text.includes(m)) ?? null;
    const idx = marker !== null ? text.indexOf(marker) : -1;

    if (idx === -1) {
      // No Pending section found — insert one before Processed (or at end)
      const procIdx = PROCESSED_MARKERS.reduce((found, m) => {
        const i = text.indexOf(m);
        return (found === -1 || (i !== -1 && i < found)) ? i : found;
      }, -1);
      const insertAt = procIdx === -1 ? text.length : procIdx;
      const block = `\n## Pending\n\n` + offers.map(formatPipelineOffer).join('\n') + '\n\n';
      text = text.slice(0, insertAt) + block + text.slice(insertAt);
    } else {
      // Find the end of existing Pending content (next ## or end)
      const afterMarker = idx + marker.length;
      const nextSection = text.indexOf('\n## ', afterMarker);
      const insertAt = nextSection === -1 ? text.length : nextSection;

      const block = '\n' + offers.map(formatPipelineOffer).join('\n') + '\n';
      text = text.slice(0, insertAt) + block + text.slice(insertAt);
    }

    writeFileSync(paths.pipelinePath, text, 'utf-8');
  });
}

export function appendToScanHistory(offers, date, status = 'added', paths = DEFAULT_PATHS()) {
  // Ensure file + header exist. The header names every column the row writer
  // (formatScanHistoryRow) emits, in the same order: the original 7 positional
  // cols (url…location) plus the append-only trailing cols added since —
  // fingerprint (7), posted_at (8), trust_score (9), trust_flags (10),
  // normalized_company (11). Written ONLY on fresh-file creation; existing files
  // (including headerless legacy files and older 7-col-header files) are never
  // rewritten. All readers either skip line 0 unconditionally, detect the header
  // by its `url\t` prefix, or skip non-URL col-0 rows, so widening it stays
  // backward-compatible. `status` is parameterized so callers can record verify
  // outcomes (`skipped_expired`, etc.) without the legacy `(expired)` suffix.
  if (!existsSync(paths.scanHistoryPath)) {
    mkdirSync(path.dirname(paths.scanHistoryPath), { recursive: true });
    writeFileSync(paths.scanHistoryPath, SCAN_HISTORY_HEADER, 'utf-8');
  }

  const lines = offers.map(o => formatScanHistoryRow(o, date, status)).join('\n') + '\n';

  appendFileSync(paths.scanHistoryPath, lines, 'utf-8');
}

// ── Company blacklist (#1742) ───────────────────────────────────────

/**
 * Parse the user's do-not-apply list (data/blacklist.md, user layer, opt-in).
 *
 * The file is a small markdown table the user owns:
 * `| Company | Since | Scope | Reason |`. Nothing here ever creates or writes
 * it — an absent file means no filtering. Companies are keyed with the same
 * normalization every tracker writer shares (normalizeCompany, #1460), so a
 * blacklist row "Acme Corp." still catches an ATS feed that says "acme corp".
 *
 * @param {string} text - Raw data/blacklist.md content.
 * @returns {Map<string, {company: string, since: string, scope: string, reason: string}>}
 *          Normalized company key → entry. First row wins on duplicate keys.
 */
export function parseBlacklist(text) {
  const entries = new Map();
  for (const line of String(text ?? '').replace(/\r/g, '').split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').map(s => s.trim());
    const company = cells[1] || '';
    if (!company || /^[-: ]+$/.test(company)) continue; // separator row
    if (company.toLowerCase() === 'company') continue;  // header row
    const key = normalizeCompany(company);
    if (!key || entries.has(key)) continue;
    entries.set(key, {
      company,
      since: cells[2] || '',
      scope: cells[3] || '',
      reason: cells[4] || '',
    });
  }
  return entries;
}

/**
 * Load data/blacklist.md if the user opted in. Absent file = empty Map = no
 * filtering anywhere — the scan stays byte-identical to a pre-#1742 run.
 *
 * @param {string} [filePath] - Override for tests.
 * @returns {Map<string, {company: string, since: string, scope: string, reason: string}>}
 */
export function loadBlacklist(filePath = DEFAULT_PATHS().blacklistPath) {
  if (!existsSync(filePath)) return new Map();
  return parseBlacklist(readFileSync(filePath, 'utf-8'));
}

// ── Scan-run persistence (#1604) ────────────────────────────────────

// One row of run counters per non-dry scan — today these numbers are printed
// once in the summary and lost when the terminal scrolls. Full ISO timestamp
// (two scans in one day must not collapse). `status` is reserved: always
// 'completed' in v1; a follow-up wires failure-path writes so trend stats can
// exclude survivorship bias. Consumers MUST parse by header name, never by
// position — columns may be appended in later versions.
export const SCAN_RUNS_HEADER = 'timestamp\tstatus\tcompanies\tboards\tfound\tfiltered_title\tfiltered_tier\tfiltered_location\tfiltered_posting_age\tfiltered_salary\tfiltered_content\tfiltered_cooldown\tdupes\tnew_added\terrors\tfiltered_blacklist\tfiltered_visa\tfiltered_posted_date\tfiltered_country_eligibility\n';

export function appendScanRunSummary(c, filePath = DEFAULT_PATHS().scanRunsPath) {
  if (!existsSync(filePath)) writeFileSync(filePath, SCAN_RUNS_HEADER, 'utf-8');
  const row = [
    c.timestamp, c.status ?? 'completed', c.companies, c.boards, c.found,
    c.filteredTitle, c.filteredTier, c.filteredLocation, c.filteredPostingAge,
    c.filteredSalary, c.filteredContent, c.filteredCooldown, c.dupes, c.newAdded, c.errors,
    // filtered_blacklist (#1742) appended at the END, per the header-name
    // contract above: files created with an older header keep parsing (the
    // extra trailing cell is simply not named there).
    c.filteredBlacklist ?? 0,
    // filtered_visa appended at the END for the same reason.
    c.filteredVisa ?? 0,
    // filtered_posted_date appended at the END for the same reason.
    c.filteredPostedDate ?? 0,
    // filtered_country_eligibility (#2093) appended at the END for the same reason.
    c.filteredCountryEligibility ?? 0,
  ].join('\t') + '\n';
  appendFileSync(filePath, row, 'utf-8');
}

// ── Portal health persistence (#1744) ───────────────────────────────

export const PORTAL_HEALTH_HEADER = 'timestamp\tcompany\tstatus\n';

// Locked (portal-health-lock.mjs) so a concurrent read-modify-write of this
// same file — e.g. tests/portal-health-guard.mjs's regression-cleanup path —
// can never interleave with this append and silently discard one side.
export async function appendPortalHealth(healthRecords, filePath = DEFAULT_PATHS().portalHealthPath) {
  await withPortalHealthLock(filePath, async () => {
    mkdirSync(path.dirname(filePath), { recursive: true });
    if (!existsSync(filePath)) writeFileSync(filePath, PORTAL_HEALTH_HEADER, 'utf-8');
    let lines = '';
    for (const r of healthRecords) {
      lines += [r.timestamp, r.company, r.status].join('\t') + '\n';
    }
    if (lines) appendFileSync(filePath, lines, 'utf-8');
  });
}

export function loadPortalHealth(filePath = DEFAULT_PATHS().portalHealthPath) {
  if (!existsSync(filePath)) return [];
  const lines = readFileSync(filePath, 'utf-8').split('\n');
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split('\t');
    if (parts.length >= 3) {
      records.push({ timestamp: parts[0], company: parts[1], status: parts[2] });
    }
  }
  return records;
}

export function computeConsecutiveFailures(healthRecords) {
  const streaks = new Map();
  for (const r of healthRecords) {
    // Healthy statuses reset the streak; every other status counts toward it.
    // Inverted (vs. listing failure statuses) so the newer error kinds
    // (auth/server/unknown) can't silently fall outside the streak again.
    // 'empty' is deliberately healthy: a live board with 0 jobs is reachable.
    if (r.status === 'reachable' || r.status === 'empty') {
      streaks.set(r.company, 0);
    } else {
      streaks.set(r.company, (streaks.get(r.company) || 0) + 1);
    }
  }
  return streaks;
}
