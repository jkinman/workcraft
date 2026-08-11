/**
 * Parse the machine-readable ---SCORE_SUMMARY--- block from evaluation output.
 */

/**
 * @typedef {Object} ScoreSummary
 * @property {string} company
 * @property {string} role
 * @property {string} score
 * @property {string} archetype
 * @property {string} legitimacy
 */

/**
 * @param {string} text
 * @param {{ multilineSafe?: boolean }} [options]
 * @returns {ScoreSummary}
 */
export function parseScoreSummary(text, options = {}) {
  const summaryMatch = text.match(/---SCORE_SUMMARY---\s*([\s\S]*?)---END_SUMMARY---/);

  let company = 'unknown';
  let role = 'unknown';
  let score = '?';
  let archetype = 'unknown';
  let legitimacy = 'unknown';

  if (summaryMatch) {
    const block = summaryMatch[1];
    const extract = (key) => {
      if (options.multilineSafe) {
        const prefix = `${key}:`;
        for (const line of block.split('\n')) {
          const trimmed = line.trimStart();
          if (trimmed.startsWith(prefix)) {
            return trimmed.slice(prefix.length).trim();
          }
        }
        return 'unknown';
      }
      const m = block.match(new RegExp(`${key}:\\s*(.+)`));
      return m ? m[1].trim() : 'unknown';
    };
    company = extract('COMPANY');
    role = extract('ROLE');
    score = extract('SCORE');
    archetype = extract('ARCHETYPE');
    legitimacy = extract('LEGITIMACY');
  }

  return { company, role, score, archetype, legitimacy };
}

/**
 * Strip the SCORE_SUMMARY block from report body text.
 * @param {string} text
 */
export function stripScoreSummary(text) {
  return text.replace(/---SCORE_SUMMARY---[\s\S]*?---END_SUMMARY---/, '').trim();
}

/** Alias for eval-golden and external callers. */
export const parseSummary = parseScoreSummary;
