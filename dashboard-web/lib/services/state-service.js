const {
  STATES,
  STATE_META,
  VALID_TRANSITIONS,
  getNextStates,
  getStateMeta,
  parseFrontmatter,
  buildFrontmatter,
  transitionReportContent,
} = require('../../state-manager');
const { transitionApplicationState } = require('../tracker-bridge');

function findReportFile(dataClient, slug) {
  const normalizedSlug = slug.toLowerCase();
  const files = dataClient.listReports();

  for (const file of files) {
    const base = file.filename.replace(/\.md$/, '').toLowerCase();
    if (base.includes(normalizedSlug)) return file;
  }

  for (const file of files) {
    const base = file.filename.replace(/\.md$/, '').toLowerCase();
    const parts = base.split('-');
    const possibleCompany = parts[1];
    if (possibleCompany && normalizedSlug.startsWith(possibleCompany)) return file;
  }

  return null;
}

function createStateService(dataClient) {
  return {
    get(slug) {
      const file = findReportFile(dataClient, slug);
      if (!file) return { state: STATES.EVALUATED, history: [] };

      const fm = parseFrontmatter(dataClient.readReport(file.filename) || '');
      return { state: fm.state, history: fm.state_history };
    },

    async transition(slug, newState, options = {}) {
      return transitionApplicationState(dataClient, {
        slug,
        newState,
        note: options.note || null,
        source: options.source || 'dashboard-web',
      });
    },

    getNextStates,
    getStateMeta,
  };
}

module.exports = {
  createStateService,
  findReportFile,
  transitionReportContent,
};
