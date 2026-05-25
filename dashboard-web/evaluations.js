// evaluations.js - Dynamic evaluation loader from markdown reports
const { parseAllReports, getLatestReportForCompany } = require('./report-parser');

// Cache for parsed evaluations (refresh on each call for now)
function getEvaluations() {
  return parseAllReports();
}

function getEvaluationByKey(key) {
  return getLatestReportForCompany(key);
}

module.exports = { getEvaluations, getEvaluationByKey };
