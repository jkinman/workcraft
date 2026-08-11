/**
 * PDF manifest index — maps report numbers to generated PDF/HTML paths.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, relative, resolve, sep, isAbsolute } from 'path';
import { SYSTEM_ROOT, resolveCareerOpsPaths } from '../path-roots.mjs';

/**
 * @param {string} pathValue
 * @param {string} [repoRoot]
 */
export function repoRelativeManifestPath(pathValue, repoRoot = SYSTEM_ROOT) {
  if (!pathValue) return '';
  const rel = relative(repoRoot, resolve(pathValue));
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return '';
  return rel.split(sep).join('/');
}

/**
 * @param {object} params
 * @param {string} [params.reportNum]
 * @param {string} params.pdfPath
 * @param {string} [params.htmlPath]
 * @param {string} [params.format]
 * @param {string} [params.dataRoot]
 */
export function updatePdfIndex({
  reportNum = '',
  pdfPath,
  htmlPath = '',
  format = 'a4',
  dataRoot = resolveCareerOpsPaths().dataRoot,
}) {
  const manifestPath = resolve(dataRoot, 'data', 'pdf-index.tsv');
  const repoRoot = resolveCareerOpsPaths().systemRoot;
  const toRel = (p) => relative(repoRoot, resolve(p)).split(sep).join('/');
  const relPDF = toRel(pdfPath);
  const relHTML = repoRelativeManifestPath(htmlPath, repoRoot);
  const date = new Date().toISOString().slice(0, 10);
  const normKey = (s) => (s || '').trim().replace(/^0+(?=\d)/, '');

  let lines = [];
  if (existsSync(manifestPath)) {
    lines = readFileSync(manifestPath, 'utf-8').split('\n').filter((line) => {
      if (!line.trim() || line.startsWith('#')) return false;
      const fields = line.split('\t');
      if (fields[1] === relPDF) return false;
      if (reportNum && normKey(fields[0]) === normKey(reportNum)) return false;
      return true;
    });
  }

  lines.push([reportNum || '', relPDF, relHTML, format, date].join('\t'));
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(
    manifestPath,
    '# report\tpdf\thtml\tformat\tdate — written by lib/documents, do not edit\n' +
      `${lines.join('\n')}\n`,
  );
  return relPDF;
}

export const PDF_INDEX_HEADER = '# report\tpdf\thtml\tformat\tdate';
