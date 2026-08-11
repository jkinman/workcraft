/**
 * Report YAML frontmatter parsing and dashboard badge classes.
 */

const BADGE_CLASSES = {
  evaluated: 'status-evaluated',
  applied: 'status-applied',
  responded: 'status-reviewing',
  interview: 'status-interview',
  offer: 'status-offer',
  rejected: 'status-rejected',
  discarded: 'status-rejected',
  skip: 'status-pending',
};

const LEGACY_STATE_ALIASES = {
  discovered: 'evaluated',
  researching: 'evaluated',
  interviewing: 'interview',
  closed: 'discarded',
};

export function normalizeReportState(state) {
  const key = String(state || 'evaluated').trim().toLowerCase();
  return LEGACY_STATE_ALIASES[key] || key;
}

export function parseReportFrontmatter(content) {
  const fm = { state: 'evaluated', state_history: [] };
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return fm;

  const yaml = match[1];
  const stateMatch = yaml.match(/^state:\s*(\S+)/m);
  if (stateMatch) fm.state = normalizeReportState(stateMatch[1]);

  const historyMatch = yaml.match(/^state_history:\s*\n((?:  - .+\n?)+)/m);
  if (historyMatch) {
    fm.state_history = historyMatch[1].trim().split('\n').map((line) => {
      const m = line.match(/state:\s*"?([^",\s]+)"?.*date:\s*"?([^"\s}]+)"?/);
      return m ? { state: m[1], date: m[2] } : null;
    }).filter(Boolean);
  }

  return fm;
}

export function stateBadgeClass(state) {
  return BADGE_CLASSES[normalizeReportState(state)] || 'status-pending';
}
