/**
 * CLI entry for HTML → PDF generation (invoked by root generate-pdf.mjs facade).
 */

import { resolve, dirname, relative, isAbsolute } from 'path';
import { readFile } from 'fs/promises';
import { mkdirSync } from 'fs';
import { SYSTEM_ROOT } from '../path-roots.mjs';
import { normalizeTextForATS } from './ats-normalize.mjs';
import { validateCvSectionOrder } from './cv-section-order.mjs';
import { renderHtmlToPdf } from './html-playwright.mjs';

export async function runGeneratePdfCli(argv = process.argv.slice(2)) {
  let inputPath;
  let outputPath;
  let format = 'a4';
  let reportNum = '';
  let allowReorder = false;
  let maxPages = 2;
  let maxPagesInput = '2';
  let strictPages = false;

  for (const arg of argv) {
    if (arg.startsWith('--format=')) format = arg.split('=')[1].toLowerCase();
    else if (arg.startsWith('--report=')) reportNum = arg.split('=')[1].trim();
    else if (arg.startsWith('--max-pages=')) {
      maxPagesInput = arg.slice('--max-pages='.length);
      maxPages = Number(maxPagesInput);
    } else if (arg === '--allow-reorder') allowReorder = true;
    else if (arg === '--strict-pages') strictPages = true;
    else if (!inputPath) inputPath = arg;
    else if (!outputPath) outputPath = arg;
  }

  if (!inputPath || !outputPath) {
    console.error('Usage: node generate-pdf.mjs <input.html> <output.pdf> [--format=letter|a4] [--report=NNN] [--allow-reorder] [--max-pages=N] [--strict-pages]');
    process.exit(1);
  }

  if (reportNum && !/^\d+$/.test(reportNum)) {
    console.error(`Invalid --report "${reportNum}". Use the numeric tracker/report number, e.g. --report=018`);
    process.exit(1);
  }

  if (!Number.isInteger(maxPages) || maxPages < 1) {
    console.error(`Invalid --max-pages "${maxPagesInput}". Use a positive integer.`);
    process.exit(1);
  }

  inputPath = resolve(inputPath);
  outputPath = resolve(outputPath);

  const relOut = relative(SYSTEM_ROOT, outputPath);
  if (relOut === '' || relOut.startsWith('..') || isAbsolute(relOut)) {
    console.error(`Refusing to write the PDF outside the project directory: ${outputPath}`);
    process.exit(1);
  }

  const validFormats = ['a4', 'letter'];
  if (!validFormats.includes(format)) {
    console.error(`Invalid format "${format}". Use: ${validFormats.join(', ')}`);
    process.exit(1);
  }

  mkdirSync(resolve(SYSTEM_ROOT, 'output'), { recursive: true });

  console.log(`📄 Input:  ${inputPath}`);
  console.log(`📁 Output: ${outputPath}`);
  console.log(`📏 Format: ${format.toUpperCase()}`);
  console.log(`📐 Page budget: ${maxPages}${strictPages ? ' (strict)' : ' (warning only)'}`);

  let html = await readFile(inputPath, 'utf-8');
  let cvMarkdown = '';
  try {
    cvMarkdown = await readFile(resolve(SYSTEM_ROOT, 'cv.md'), 'utf-8');
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }

  validateCvSectionOrder(html, cvMarkdown, { allowReorder });

  const normalized = normalizeTextForATS(html);
  html = normalized.html;
  const totalReplacements = Object.values(normalized.replacements).reduce((a, b) => a + b, 0);
  if (totalReplacements > 0) {
    const breakdown = Object.entries(normalized.replacements).map(([k, v]) => `${k}=${v}`).join(', ');
    console.log(`🧹 ATS normalization: ${totalReplacements} replacements (${breakdown})`);
  }

  return renderHtmlToPdf(html, outputPath, {
    format,
    baseDir: dirname(inputPath),
    reportNum,
    inputPath,
    maxPages,
    strictPages,
  });
}
