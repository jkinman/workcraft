const {
  STATES,
  STATE_META,
  VALID_TRANSITIONS,
  buildFrontmatter,
  getNextStates,
  getStateMeta,
  parseFrontmatter
} = require('../../state-manager');

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

function transitionReportContent(content, newState, today = new Date().toISOString().split('T')[0]) {
  if (!STATE_META[newState]) {
    return { success: false, error: `Invalid state: ${newState}` };
  }

  const fm = parseFrontmatter(content);
  const currentState = fm.state;
  const validNext = VALID_TRANSITIONS[currentState] || [];

  if (!validNext.includes(newState) && currentState !== newState) {
    return {
      success: false,
      error: `Invalid transition: ${currentState} -> ${newState}. Valid: ${validNext.join(', ')}`
    };
  }

  const history = [...fm.state_history, { state: newState, date: today }];
  const frontmatter = buildFrontmatter(newState, history);
  const nextContent = content.startsWith('---\n')
    ? content.replace(/^---\n[\s\S]*?\n---\n\n?/, frontmatter)
    : frontmatter + content;

  return {
    success: true,
    state: newState,
    previous: currentState,
    history,
    content: nextContent
  };
}

function createStateService(dataClient) {
  return {
    get(slug) {
      const file = findReportFile(dataClient, slug);
      if (!file) return { state: STATES.EVALUATED, history: [] };

      const fm = parseFrontmatter(dataClient.readReport(file.filename) || '');
      return { state: fm.state, history: fm.state_history };
    },

    async transition(slug, newState) {
      const file = findReportFile(dataClient, slug);
      if (!file) {
        return { success: false, error: `Report not found for slug: ${slug}` };
      }

      const result = transitionReportContent(dataClient.readReport(file.filename) || '', newState);
      if (!result.success) return result;

      await dataClient.writeReport(file.filename, result.content);
      delete result.content;
      return result;
    },

    getNextStates,
    getStateMeta
  };
}

module.exports = {
  createStateService,
  findReportFile,
  transitionReportContent
};
