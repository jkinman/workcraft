// state-manager.js - Job application workflow state machine
// State ids and labels are loaded from templates/states.yml.
const fs = require('fs');
const path = require('path');
const CONFIG = require('./config');
const { STATES, STATE_ORDER, STATE_META, VALID_TRANSITIONS, normalizeWorkflowState } = require('./lib/workflow-states');

function parseFrontmatter(content) {
  const fm = { state: STATES.EVALUATED, state_history: [] };
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return fm;

  const yaml = match[1];
  const stateMatch = yaml.match(/^state:\s*(\S+)/m);
  if (stateMatch) fm.state = normalizeWorkflowState(stateMatch[1].trim());

  const historyMatch = yaml.match(/^state_history:\s*\n((?:  - .+\n?)+)/m);
  if (historyMatch) {
    fm.state_history = historyMatch[1].trim().split('\n').map(line => {
      const m = line.match(/state:\s*"?([^",\s]+)"?.*date:\s*"?([^"\s}]+)"?/);
      return m ? { state: m[1], date: m[2] } : null;
    }).filter(Boolean);
  }

  return fm;
}

function buildFrontmatter(state, history) {
  const historyYaml = history.map(h => {
    // Sanitize state value if it's already a string with quotes
    const cleanState = h.state.replace(/"/g, '');
    return `  - {state: ${cleanState}, date: "${h.date}"}`;
  }).join('\\n');
  return `---
state: ${state}
state_history:
${historyYaml}
---

`;
}

function getReportPath(slug) {
  const reportsDir = path.join(CONFIG.CAREER_OPS_PATH, 'reports');
  const files = fs.readdirSync(reportsDir).filter(f => f.endsWith('.md'));

  // Try exact match first (slug appears in filename)
  for (const f of files) {
    const base = f.replace(/\.md$/, '').toLowerCase();
    // Match patterns like: gumloop-3, cartage-xVIZlS8, etc.
    if (base.includes(slug.toLowerCase())) {
      return path.join(reportsDir, f);
    }
  }

  // Try matching by company name (before the hyphen)
  for (const f of files) {
    const base = f.replace(/\.md$/, '').toLowerCase();
    // Pattern: 007-workos-software-engineer-... → extract company part
    const parts = base.split('-');
    // Skip the leading number, find the company name
    if (parts.length > 1) {
      // Try to match: workos, gumloop, etc. (the part after the number)
      const possibleCompany = parts[1];
      if (possibleCompany && slug.toLowerCase().startsWith(possibleCompany)) {
        return path.join(reportsDir, f);
      }
    }
  }

  return null;
}

function getState(slug) {
  const reportPath = getReportPath(slug);
  if (!reportPath) return { state: STATES.EVALUATED, history: [] };

  const content = fs.readFileSync(reportPath, 'utf8');
  const fm = parseFrontmatter(content);
  return { state: fm.state, history: fm.state_history };
}

function transitionState(slug, newState) {
  if (!STATE_META[newState]) {
    return { success: false, error: `Invalid state: ${newState}` };
  }

  const reportPath = getReportPath(slug);
  if (!reportPath) {
    return { success: false, error: `Report not found for slug: ${slug}` };
  }

  const content = fs.readFileSync(reportPath, 'utf8');
  const fm = parseFrontmatter(content);

  // Check valid transition
  const currentState = fm.state;
  const validNext = VALID_TRANSITIONS[currentState] || [];
  if (!validNext.includes(newState) && currentState !== newState) {
    return {
      success: false,
      error: `Invalid transition: ${currentState} → ${newState}. Valid: ${validNext.join(', ')}`
    };
  }

  // Build new history
  const now = new Date().toISOString().split('T')[0];
  const newHistory = [...fm.state_history, { state: newState, date: now }];

  // Build new frontmatter
  const newFrontmatter = buildFrontmatter(newState, newHistory);

  // Replace or prepend frontmatter
  let newContent;
  if (content.startsWith('---\n')) {
    newContent = content.replace(/^---\n[\s\S]*?\n---\n\n?/, newFrontmatter);
  } else {
    newContent = newFrontmatter + content;
  }

  fs.writeFileSync(reportPath, newContent);

  return {
    success: true,
    state: newState,
    previous: currentState,
    history: newHistory
  };
}

function getNextStates(currentState) {
  return VALID_TRANSITIONS[currentState] || [];
}

function getStateMeta(state) {
  return STATE_META[state] || STATE_META[STATES.EVALUATED];
}

function getAllStatesWithCounts() {
  const reportsDir = path.join(CONFIG.CAREER_OPS_PATH, 'reports');
  if (!fs.existsSync(reportsDir)) return {};

  const counts = {};
  Object.values(STATES).forEach(s => counts[s] = 0);

  const files = fs.readdirSync(reportsDir).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(reportsDir, file), 'utf8');
    const fm = parseFrontmatter(content);
    counts[fm.state] = (counts[fm.state] || 0) + 1;
  }

  return counts;
}

module.exports = {
  STATES,
  STATE_ORDER,
  STATE_META,
  VALID_TRANSITIONS,
  getState,
  transitionState,
  getNextStates,
  getStateMeta,
  getAllStatesWithCounts,
  parseFrontmatter,
  getReportPath,
  buildFrontmatter
};
