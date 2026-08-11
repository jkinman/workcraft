// report-parser.js — CJS shim; canonical parser: lib/reports/index.mjs

const fs = require('fs');
const path = require('path');
const CONFIG = require('./config');
const { renderMarkdownToHtml } = require('./lib/reports-bridge');

function parseReport(content, filename) {
  const mod = global.__careerOpsReports;
  if (!mod) throw new Error('Report parser not initialized. Load services through tenant-services first.');
  return mod.parseReport(content, filename);
}

function slugify(company, url, filename) {
  const mod = global.__careerOpsReports;
  if (!mod) throw new Error('Report parser not initialized. Load services through tenant-services first.');
  return mod.slugify(company, url, filename);
}

function parseAllReports() {
  const reportsDir = path.join(CONFIG.CAREER_OPS_PATH, 'reports');
  if (!fs.existsSync(reportsDir)) return [];

  const files = fs.readdirSync(reportsDir)
    .filter(f => f.endsWith('.md') && f !== '.gitkeep')
    .sort((a, b) => (parseInt(b.split('-')[0], 10) || 0) - (parseInt(a.split('-')[0], 10) || 0));

  const evaluations = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(reportsDir, file), 'utf8');
    const evalObj = parseReport(content, file);
    if (evalObj?.company) evaluations.push(evalObj);
  }

  evaluations.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.date || 0) - new Date(a.date || 0);
  });
  evaluations.forEach((e, i) => { e.rank = i + 1; });
  return evaluations;
}

function getReportBySlug(slug) {
  return parseAllReports().find(e => slugify(e.company, e.url, e.filename) === slug) || null;
}

function getRawReportContent(slug) {
  const report = getReportBySlug(slug);
  if (!report) return null;
  const filePath = path.join(CONFIG.CAREER_OPS_PATH, 'reports', report.filename);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
}

function getLatestReportForCompany(companyName) {
  return parseAllReports().find(e => e.company.toLowerCase() === companyName.toLowerCase());
}

module.exports = {
  parseAllReports,
  getLatestReportForCompany,
  getReportBySlug,
  getRawReportContent,
  renderMarkdownToHtml,
  parseReport,
  slugify,
};
