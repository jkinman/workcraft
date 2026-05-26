const PDF_FILENAME_PATTERN = /^(cv|cover-letter|eval-report|full-eval)-[a-z0-9-]+-\d{4}-\d{2}-\d{2}\.pdf$/;

function validatePdfFilename(filename) {
  if (typeof filename !== 'string' || !PDF_FILENAME_PATTERN.test(filename)) {
    throw new Error('Invalid filename');
  }
  return filename;
}

function pdfDownloadHeaders(filename) {
  return {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`
  };
}

module.exports = {
  PDF_FILENAME_PATTERN,
  pdfDownloadHeaders,
  validatePdfFilename
};
