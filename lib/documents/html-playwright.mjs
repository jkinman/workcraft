/**
 * HTML → PDF Playwright adapter (canonical generated-document renderer).
 */

import { chromium } from 'playwright';
import { resolve, dirname, relative, sep, isAbsolute } from 'path';
import { readFile, writeFile, unlink } from 'fs/promises';
import { mkdirSync } from 'fs';
import { pathToFileURL } from 'url';
import { randomUUID } from 'node:crypto';
import { readStyleTokens, injectThemeStyle } from '../../theme-style.mjs';
import { SYSTEM_ROOT } from '../path-roots.mjs';
import { updatePdfIndex, repoRelativeManifestPath } from './pdf-index.mjs';
import { normalizeTextForATS } from './ats-normalize.mjs';
import { enforcePageBudget } from './cv-section-order.mjs';

export { repoRelativeManifestPath } from './pdf-index.mjs';
export { normalizeTextForATS } from './ats-normalize.mjs';
export { validateCvSectionOrder, enforcePageBudget, sectionKey } from './cv-section-order.mjs';

const PDF_PAGE_MARGIN = '0.6in';

function countRenderedPdfPages(pdfBuffer) {
  const pdf = pdfBuffer.toString('latin1');
  const objects = new Map();
  const objectPattern = /(?:^|[\r\n])(\d+)\s+(\d+)\s+obj\b([\s\S]*?)\bendobj\b/g;

  for (const match of pdf.matchAll(objectPattern)) {
    const streamIndex = match[3].search(/\bstream(?:\r?\n|\r)/);
    const dictionary = streamIndex === -1 ? match[3] : match[3].slice(0, streamIndex);
    objects.set(`${match[1]} ${match[2]}`, dictionary);
  }

  const catalog = [...objects.values()].find((body) => /\/Type\s*\/Catalog\b/.test(body));
  const pagesRef = catalog?.match(/\/Pages\s+(\d+)\s+(\d+)\s+R\b/);
  const pages = pagesRef ? objects.get(`${pagesRef[1]} ${pagesRef[2]}`) : null;
  const count = pages && /\/Type\s*\/Pages\b/.test(pages)
    ? pages.match(/\/Count\s+(\d+)\b/)
    : null;
  const pageCount = count ? Number(count[1]) : 0;

  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new Error('Could not determine the rendered PDF page count from its page tree.');
  }
  return pageCount;
}

export function injectPrintPageCss(html, format = 'a4') {
  const normalizedFormat = String(format || 'a4').toLowerCase();
  const pageSize = normalizedFormat === 'letter' ? 'Letter' : 'A4';
  const pageStyle = `<style id="career-ops-page-setup">\n@page { size: ${pageSize}; margin: var(--page-margin, ${PDF_PAGE_MARGIN}); }\n</style>`;

  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${pageStyle}\n</head>`);
  }
  if (/<html\b[^>]*>/i.test(html)) {
    return html.replace(/<html\b[^>]*>/i, match => `${match}\n<head>\n${pageStyle}\n</head>`);
  }
  return `${pageStyle}\n${html}`;
}

export async function inlineLocalFonts(html, { fontsDir = resolve(SYSTEM_ROOT, 'fonts') } = {}) {
  const FONT_REF = /url\(\s*(['"]?)\.\/fonts\/([^'")\s]+)\1\s*\)/g;
  const MIME = { woff2: 'font/woff2', woff: 'font/woff', otf: 'font/otf', ttf: 'font/ttf' };
  const names = [...new Set([...html.matchAll(FONT_REF)].map((m) => m[2]))];
  const dataUrls = new Map();
  for (const name of names) {
    const fontPath = resolve(fontsDir, name);
    const rel = relative(fontsDir, fontPath);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      console.warn(`⚠️  Font reference escapes fonts/, keeping original reference: ${name}`);
      continue;
    }
    try {
      const buf = await readFile(fontPath);
      const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
      dataUrls.set(name, `url('data:${MIME[ext] || 'application/octet-stream'};base64,${buf.toString('base64')}')`);
    } catch (err) {
      if (err?.code !== 'ENOENT') throw err;
      console.warn(`⚠️  Font file not found, keeping original reference: fonts/${name}`);
    }
  }
  return html.replace(FONT_REF, (match, _quote, name) => dataUrls.get(name) || match);
}

/**
 * @param {string} html
 * @param {string} outputPath
 * @param {object} [opts]
 */
export async function renderHtmlToPdf(html, outputPath, opts = {}) {
  const format = opts.format || 'a4';
  const baseDir = opts.baseDir || process.cwd();
  const reportNum = opts.reportNum || '';
  const inputPath = opts.inputPath || '';
  const dataRoot = opts.dataRoot;
  const updateIndex = opts.updateIndex !== false;
  const quiet = opts.quiet === true;
  const log = opts.log || {
    info: (...args) => { if (!quiet) console.log(...args); },
    warn: (...args) => { if (!quiet) console.warn(...args); },
    error: (...args) => { if (!quiet) console.error(...args); },
  };

  mkdirSync(dirname(outputPath), { recursive: true });

  const styleTokens = opts.styleTokens ?? readStyleTokens();
  html = injectThemeStyle(html, styleTokens);
  html = injectPrintPageCss(html, format);
  html = await inlineLocalFonts(html, opts);

  const tmpHtmlPath = resolve(baseDir, `.career-ops-render-${randomUUID()}.html`);
  await writeFile(tmpHtmlPath, html, 'utf-8');

  const launchBrowser = opts.launchBrowser || ((options) => chromium.launch(options));
  let browser = null;
  try {
    browser = await launchBrowser({ headless: true });
    const context = browser.newContext
      ? await browser.newContext({ javaScriptEnabled: false })
      : null;
    const page = context ? await context.newPage() : await browser.newPage();
    if (page.route) {
      await page.route('**/*', (route) => {
        const url = route.request().url();
        return url.startsWith('file:') || url.startsWith('data:')
          ? route.continue()
          : route.abort();
      });
    }

    await page.goto(pathToFileURL(tmpHtmlPath).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);

    const pdfBuffer = await page.pdf({
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      preferCSSPageSize: true,
    });

    await writeFile(outputPath, pdfBuffer);
    const pageCount = countRenderedPdfPages(pdfBuffer);

    enforcePageBudget(pageCount, {
      maxPages: opts.maxPages ?? 2,
      strictPages: opts.strictPages ?? false,
    });

    log.info(`✅ PDF generated: ${outputPath}`);
    log.info(`📊 Pages: ${pageCount}`);
    log.info(`📦 Size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);

    if (updateIndex) {
      try {
        updatePdfIndex({
          reportNum,
          pdfPath: outputPath,
          htmlPath: inputPath,
          format,
          dataRoot,
        });
        log.info(`🔗 Manifest: data/pdf-index.tsv updated${reportNum ? ` (report ${reportNum})` : ' (no --report given)'}`);
      } catch (err) {
        log.error(`⚠️  Manifest update failed: ${err.message}`);
      }
    }

    return { outputPath, pageCount, size: pdfBuffer.length, pdfBuffer };
  } finally {
    if (browser) {
      await browser.close().catch((err) => {
        log.warn(`⚠️  Browser cleanup failed: ${err.message}`);
      });
    }
    await unlink(tmpHtmlPath).catch((err) => {
      if (err?.code !== 'ENOENT') {
        log.warn(`⚠️  Temporary HTML cleanup failed: ${err.message}`);
      }
    });
  }
}

/** Convenience wrapper for dashboard/worker callers. */
export async function renderHtmlStringToPdfBuffer(html, opts = {}) {
  const { mkdtemp, rm } = await import('fs/promises');
  const { tmpdir } = await import('os');
  const { join } = await import('path');
  const dir = await mkdtemp(join(tmpdir(), 'career-ops-pdf-'));
  const out = join(dir, 'output.pdf');
  try {
    const result = await renderHtmlToPdf(html, out, {
      ...opts,
      baseDir: dir,
      updateIndex: opts.updateIndex ?? false,
      quiet: opts.quiet ?? true,
      launchBrowser: opts.launchBrowser,
    });
    const bytes = await readFile(out);
    return { ...result, pdfBuffer: bytes };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
