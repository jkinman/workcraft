const { renderMarkdownToHtml } = require('../reports-bridge');

function sortReportFiles(files) {
  return [...files].sort((a, b) => {
    const numA = parseInt(a.filename.split('-')[0], 10) || 0;
    const numB = parseInt(b.filename.split('-')[0], 10) || 0;
    return numB - numA;
  });
}

function rankEvaluations(evaluations) {
  const ranked = [...evaluations].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.date || 0) - new Date(a.date || 0);
  });

  ranked.forEach((evaluation, index) => {
    evaluation.rank = index + 1;
  });

  return ranked;
}

function createReportService(dataClient, reportsModule = global.__careerOpsReports) {
  if (!reportsModule) {
    throw new Error('Report parser not initialized. Load services through tenant-services first.');
  }
  const { parseReport, slugify } = reportsModule;

  function listEvaluations() {
    const evaluations = [];

    for (const file of sortReportFiles(dataClient.listReports())) {
      const content = dataClient.readReport(file.filename);
      const evaluation = content ? parseReport(content, file.filename) : null;
      if (evaluation?.company) {
        evaluations.push(evaluation);
      }
    }

    return rankEvaluations(evaluations);
  }

  function getBySlug(slug) {
    return listEvaluations().find(evaluation => slugify(evaluation.company, evaluation.url, evaluation.filename) === slug) || null;
  }

  function getRawContent(slug) {
    const report = getBySlug(slug);
    if (!report) return null;

    return dataClient.readReport(report.filename);
  }

  return {
    getBySlug,
    getRawContent,
    listEvaluations,
    renderMarkdownToHtml
  };
}

module.exports = {
  createReportService,
  rankEvaluations,
  sortReportFiles
};
