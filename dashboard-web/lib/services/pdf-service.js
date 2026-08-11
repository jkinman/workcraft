/**
 * PDF workload execution — shared by local inline runner and hosted worker.
 */

const path = require('path');
const pdfBundle = require('../../pdf-bundle-generator');

/**
 * Execute a PDF generation job for any supported kind.
 *
 * @param {object} payload - { kind, company?, role?, jobDescription?, slug? }
 * @param {{ dataClient: object, reports: object }} deps
 */
async function runPdf(payload = {}, { dataClient, reports }) {
  const kind = payload.kind;

  switch (kind) {
    case 'resume':
      return pdfBundle.generateResumePDF(
        payload.company,
        payload.role,
        payload.jobDescription || '',
        { dataClient },
      );
    case 'cover-letter':
      return pdfBundle.generateCoverLetterPDF(
        payload.company,
        payload.role,
        payload.jobDescription || '',
        { dataClient },
      );
    case 'eval-report': {
      const slug = payload.slug;
      const jobMeta = reports.getBySlug(slug);
      if (!jobMeta) {
        return { success: false, error: `Job evaluation not found: ${slug}` };
      }
      return pdfBundle.generateEvalReportPDF(jobMeta, reports.getRawContent(slug), { dataClient });
    }
    case 'full-eval': {
      const slug = payload.slug;
      const jobMeta = reports.getBySlug(slug);
      if (!jobMeta) {
        return { success: false, error: `Job evaluation not found: ${slug}` };
      }
      return pdfBundle.generateFullEvalReportPDF(jobMeta, reports.getRawContent(slug), { dataClient });
    }
    default:
      return { success: false, error: `Unsupported PDF job kind: ${kind || 'unknown'}` };
  }
}

function reportKeyForSlug(reports, slug) {
  const jobMeta = reports.getBySlug(slug);
  if (!jobMeta?.filename) {
    throw new Error(`Job evaluation not found: ${slug}`);
  }
  return path.join('reports', path.basename(jobMeta.filename));
}

module.exports = {
  runPdf,
  reportKeyForSlug,
};
