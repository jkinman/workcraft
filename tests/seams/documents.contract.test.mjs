/**
 * Generated-document seam contract — adapter registry, dispatch, errors, pdf-index isolation.
 */

import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { pass, fail } from '../helpers.mjs';

console.log('\nseam contracts — generated document adapters');

try {
  const {
    GENERATED_DOCUMENT_ADAPTERS,
    getGeneratedDocumentAdapter,
    renderGeneratedDocument,
  } = await import('../../lib/documents/interface.mjs');

  const htmlAdapter = GENERATED_DOCUMENT_ADAPTERS['html-playwright'];
  const latexAdapter = GENERATED_DOCUMENT_ADAPTERS.latex;

  if (htmlAdapter?.id === 'html-playwright'
    && typeof htmlAdapter.renderHtmlToPdf === 'function'
    && typeof htmlAdapter.renderHtmlStringToPdfBuffer === 'function') {
    pass('html-playwright adapter exposes id and render methods');
  } else {
    fail('html-playwright adapter contract shape');
  }

  if (latexAdapter?.id === 'latex'
    && typeof latexAdapter.validateLatexContent === 'function'
    && typeof latexAdapter.compileLatexToPdf === 'function'
    && typeof latexAdapter.detectLatexEngine === 'function') {
    pass('latex adapter exposes id, validate, compile, and detect methods');
  } else {
    fail('latex adapter contract shape');
  }

  try {
    getGeneratedDocumentAdapter('not-a-real-adapter');
    fail('unknown adapter should throw');
  } catch (err) {
    if (/Unknown generated document adapter: not-a-real-adapter/.test(err.message)) {
      pass('getGeneratedDocumentAdapter rejects unknown adapter ids');
    } else {
      fail(`unexpected unknown-adapter error: ${err.message}`);
    }
  }

  const minimalPdf = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
    + '2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n'
    + '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n'
    + 'xref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0\n%%EOF\n',
    'latin1',
  );

  let browserClosed = false;
  const launchBrowser = async () => ({
    newContext: async () => ({
      newPage: async () => ({
        route: async () => {},
        goto: async () => {},
        evaluate: async () => {},
        pdf: async () => minimalPdf,
      }),
      close: async () => {},
    }),
    close: async () => { browserClosed = true; },
  });

  const dataRoot = mkdtempSync(join(tmpdir(), 'co-doc-contract-'));
  mkdirSync(join(dataRoot, 'output'), { recursive: true });
  const outputPath = join(dataRoot, 'output', 'cv-test.pdf');

  await renderGeneratedDocument({
    adapterId: 'html-playwright',
    html: '<html><body>CV</body></html>',
    outputPath,
    launchBrowser,
    updateIndex: false,
    quiet: true,
    maxPages: 2,
    dataRoot,
  });

  if (existsSync(outputPath) && readFileSync(outputPath).length > 0) {
    pass('renderGeneratedDocument dispatches HTML adapter with injected browser');
  } else {
    fail('HTML dispatch did not write PDF output');
  }

  if (!existsSync(join(dataRoot, 'data', 'pdf-index.tsv'))) {
    pass('HTML dispatch with updateIndex:false leaves pdf-index untouched');
  } else {
    fail('pdf-index.tsv was created unexpectedly during HTML render');
  }

  if (browserClosed) pass('HTML dispatch closes injected browser');
  else fail('injected browser was not closed');

  const texPath = join(dataRoot, 'cv.tex');
  writeFileSync(texPath, '\\begin{document}\\end{document}\n');

  const originalCompile = latexAdapter.compileLatexToPdf;
  let latexParams = null;
  latexAdapter.compileLatexToPdf = async (params) => {
    latexParams = params;
    return { outputPath: join(dataRoot, 'output', 'from-latex.pdf'), engine: 'tectonic' };
  };

  const latexResult = await renderGeneratedDocument({
    adapterId: 'latex',
    inputPath: texPath,
    outputPath: join(dataRoot, 'output', 'from-latex.pdf'),
    compileOnly: true,
  });

  latexAdapter.compileLatexToPdf = originalCompile;

  if (latexParams?.inputPath === texPath && latexResult.engine === 'tectonic') {
    pass('renderGeneratedDocument dispatches LaTeX adapter with compile params');
  } else {
    fail(`LaTeX dispatch contract failed: ${JSON.stringify(latexParams)} / ${latexResult?.engine}`);
  }

  latexAdapter.compileLatexToPdf = async () => {
    throw new Error('latex compile boom');
  };
  let latexErrorPropagated = false;
  try {
    await renderGeneratedDocument({
      adapterId: 'latex',
      inputPath: texPath,
      outputPath: join(dataRoot, 'output', 'fail.pdf'),
    });
  } catch (err) {
    latexErrorPropagated = err.message === 'latex compile boom';
  }
  latexAdapter.compileLatexToPdf = originalCompile;

  if (latexErrorPropagated) pass('LaTeX adapter errors propagate through renderGeneratedDocument');
  else fail('LaTeX adapter error was not propagated');

  const originalHtmlRender = htmlAdapter.renderHtmlToPdf;
  htmlAdapter.renderHtmlToPdf = async () => {
    throw new Error('html render boom');
  };
  let htmlErrorPropagated = false;
  try {
    await renderGeneratedDocument({
      adapterId: 'html-playwright',
      html: '<html><body>fail</body></html>',
      outputPath: join(dataRoot, 'output', 'fail-html.pdf'),
      launchBrowser,
      updateIndex: false,
      quiet: true,
    });
  } catch (err) {
    htmlErrorPropagated = err.message === 'html render boom';
  }
  htmlAdapter.renderHtmlToPdf = originalHtmlRender;

  if (htmlErrorPropagated) pass('HTML adapter errors propagate through renderGeneratedDocument');
  else fail('HTML adapter error was not propagated');

  // Explicit guard: default registry adapters must not write pdf-index when callers opt out.
  mkdirSync(join(dataRoot, 'output'), { recursive: true });
  const indexedPath = join(dataRoot, 'output', 'indexed.pdf');
  await renderGeneratedDocument({
    adapterId: 'html-playwright',
    html: '<html><body>no index</body></html>',
    outputPath: indexedPath,
    launchBrowser,
    updateIndex: false,
    quiet: true,
    maxPages: 2,
    reportNum: '99',
    dataRoot,
  });
  if (!existsSync(join(dataRoot, 'data', 'pdf-index.tsv'))) {
    pass('renderGeneratedDocument does not mutate pdf-index when updateIndex is false');
  } else {
    fail('pdf-index mutated despite updateIndex:false on second HTML render');
  }
} catch (e) {
  fail(`documents seam contract crashed: ${e.message}`);
}
