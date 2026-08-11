/**
 * ESM bridge for dashboard-web (CJS) → lib/reports.
 */

const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');

let reportsModule;

async function loadReports() {
  if (!reportsModule) {
    reportsModule = await import('../../lib/reports/index.mjs');
  }
  return reportsModule;
}

async function parseReport(content, filename) {
  const reports = await loadReports();
  return reports.parseReport(content, filename);
}

async function slugify(company, url, filename) {
  const reports = await loadReports();
  return reports.slugify(company, url, filename);
}

function renderMarkdownToHtml(markdown) {
  if (!markdown) return '';
  const cleanMarkdown = markdown.replace(/^---\n[\s\S]*?\n---\n\n?/, '');
  const rendered = marked.parse(cleanMarkdown, {
    headerIds: false,
    mangle: false
  });
  return sanitizeHtml(rendered, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'img']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'title']
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' })
    }
  });
}

module.exports = {
  loadReports,
  parseReport,
  slugify,
  renderMarkdownToHtml,
};
