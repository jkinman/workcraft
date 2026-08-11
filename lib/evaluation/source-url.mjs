/**
 * Resolve the job posting URL for evaluation report headers.
 * Never fabricates URLs — uses an explicit sentinel when none is known.
 */

/** @type {string} */
export const NO_POSTING_URL_SENTINEL = 'local:scripted-evaluation';

/**
 * @param {string} url
 * @returns {boolean}
 */
export function isSafePublicHttpUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host === '::1' || host.endsWith('.local')) return false;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return false;
  if (/^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  return true;
}

/**
 * @param {string} [url]
 * @returns {string|null}
 */
export function sanitizeInferredPostingUrl(url) {
  const trimmed = String(url ?? '').trim();
  if (!trimmed || !isSafePublicHttpUrl(trimmed)) return null;
  return trimmed;
}

/**
 * Infer a posting URL embedded in JD text (conservative — no scraping).
 * @param {string} jdText
 * @returns {string|null}
 */
export function inferPostingUrlFromJdText(jdText) {
  const text = String(jdText ?? '');

  const urlLine = text.match(/^URL:\s*(https?:\/\/\S+)/im);
  if (urlLine) {
    const clean = urlLine[1].replace(/[)\],.]+$/, '');
    return sanitizeInferredPostingUrl(clean);
  }

  const trimmed = text.trim();
  if (/^https?:\/\/\S+$/.test(trimmed)) {
    return sanitizeInferredPostingUrl(trimmed.replace(/[)\],.]+$/, ''));
  }

  for (const line of text.split('\n').slice(0, 8)) {
    const candidate = line.trim();
    if (/^https?:\/\/\S+$/.test(candidate)) {
      const inferred = sanitizeInferredPostingUrl(candidate.replace(/[)\],.]+$/, ''));
      if (inferred) return inferred;
    }
  }

  return null;
}

/**
 * @param {object} params
 * @param {string} [params.explicitUrl] CLI --job-url or programmatic override
 * @param {string} [params.argvPostingUrl] First positional arg when it is an http(s) URL
 * @param {string} [params.jdText]
 * @returns {string}
 */
export function resolveSourceUrl({ explicitUrl, argvPostingUrl, jdText } = {}) {
  const explicit = sanitizeInferredPostingUrl(explicitUrl);
  if (explicit) return explicit;

  const fromArgv = sanitizeInferredPostingUrl(argvPostingUrl);
  if (fromArgv) return fromArgv;

  const fromJd = inferPostingUrlFromJdText(jdText);
  if (fromJd) return fromJd;

  return NO_POSTING_URL_SENTINEL;
}

/**
 * Build the canonical evaluation report header block (URL between Score and PDF).
 *
 * @param {object} params
 * @param {string} params.date
 * @param {string} params.company
 * @param {string} params.role
 * @param {string} params.archetype
 * @param {string} params.score
 * @param {string} params.sourceUrl
 * @param {string} params.legitimacy
 * @param {string} [params.pdfStatus]
 * @param {string} params.toolLine
 */
export function buildEvaluationReportHeader({
  date,
  company,
  role,
  archetype,
  score,
  sourceUrl,
  legitimacy,
  pdfStatus = 'pending',
  toolLine,
}) {
  const scoreDisplay = /\/5$/i.test(String(score)) ? score : `${score}/5`;
  return `# Evaluation: ${company} — ${role}

**Date:** ${date}
**Archetype:** ${archetype}
**Score:** ${scoreDisplay}
**URL:** ${sourceUrl}
**Legitimacy:** ${legitimacy}
**PDF:** ${pdfStatus}
**Tool:** ${toolLine}
`;
}

/**
 * @param {string} headerBlock
 * @returns {boolean}
 */
export function reportHeaderHasMandatoryUrlField(headerBlock) {
  const lines = headerBlock.split('\n');
  const scoreIdx = lines.findIndex((l) => /^\*\*Score:\*\*/.test(l));
  const urlIdx = lines.findIndex((l) => /^\*\*URL:\*\*/.test(l));
  const pdfIdx = lines.findIndex((l) => /^\*\*PDF:\*\*/.test(l));
  return scoreIdx >= 0 && urlIdx > scoreIdx && pdfIdx > urlIdx;
}
