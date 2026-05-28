const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const CONFIG = require('../config');

const FALLBACK_STATES = [
  { id: 'evaluated', label: 'Evaluated', dashboard_group: 'evaluated' },
  { id: 'applied', label: 'Applied', dashboard_group: 'applied' },
  { id: 'responded', label: 'Responded', dashboard_group: 'responded' },
  { id: 'interview', label: 'Interview', dashboard_group: 'interview' },
  { id: 'offer', label: 'Offer', dashboard_group: 'offer' },
  { id: 'rejected', label: 'Rejected', dashboard_group: 'rejected' },
  { id: 'discarded', label: 'Discarded', dashboard_group: 'discarded' },
  { id: 'skip', label: 'SKIP', dashboard_group: 'skip' }
];

const BADGE_CLASSES = {
  evaluated: 'status-evaluated',
  applied: 'status-applied',
  responded: 'status-reviewing',
  interview: 'status-interview',
  offer: 'status-offer',
  rejected: 'status-rejected',
  discarded: 'status-rejected',
  skip: 'status-pending'
};

const COLORS = {
  evaluated: 'var(--text-muted)',
  applied: 'var(--success)',
  responded: 'var(--warning)',
  interview: 'var(--primary)',
  offer: 'var(--success-strong)',
  rejected: 'var(--error)',
  discarded: 'var(--error)',
  skip: 'var(--text-dim)'
};

const VALID_TRANSITIONS = {
  evaluated: ['applied', 'discarded', 'skip'],
  applied: ['responded', 'interview', 'rejected', 'discarded'],
  responded: ['interview', 'rejected', 'discarded'],
  interview: ['offer', 'rejected', 'discarded'],
  offer: ['discarded'],
  rejected: ['evaluated'],
  discarded: ['evaluated'],
  skip: ['evaluated']
};

const LEGACY_STATE_ALIASES = {
  discovered: 'evaluated',
  researching: 'evaluated',
  interviewing: 'interview',
  closed: 'discarded'
};

function loadCanonicalStates() {
  const statesPath = path.join(CONFIG.CAREER_OPS_PATH, 'templates', 'states.yml');
  if (!fs.existsSync(statesPath)) return FALLBACK_STATES;

  const parsed = yaml.load(fs.readFileSync(statesPath, 'utf8'));
  return parsed?.states || FALLBACK_STATES;
}

function buildWorkflowStateModel() {
  const canonicalStates = loadCanonicalStates();
  const states = Object.fromEntries(canonicalStates.map(state => [state.id.toUpperCase(), state.id]));
  const stateOrder = canonicalStates.map(state => state.id);
  const stateMeta = Object.fromEntries(canonicalStates.map(state => [
    state.id,
    {
      label: state.label.toUpperCase(),
      badgeClass: BADGE_CLASSES[state.id] || 'status-pending',
      color: COLORS[state.id] || 'var(--text-muted)',
      dashboardGroup: state.dashboard_group
    }
  ]));

  return {
    canonicalStates,
    STATES: states,
    STATE_ORDER: stateOrder,
    STATE_META: stateMeta,
    VALID_TRANSITIONS,
    normalizeWorkflowState(state) {
      return LEGACY_STATE_ALIASES[state] || state;
    }
  };
}

module.exports = buildWorkflowStateModel();
