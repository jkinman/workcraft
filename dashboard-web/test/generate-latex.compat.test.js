#!/usr/bin/env node
/**
 * generate-latex.mjs compatibility tests — JSON report shape and validation behavior.
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { compileLatexFile } from '../../lib/documents/latex.mjs';

const NODE = process.execPath;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function latexValidate(tex) {
  const dir = mkdtempSync(join(tmpdir(), 'latex-compat-'));
  const texPath = join(dir, 'cv.tex');
  writeFileSync(texPath, tex, 'utf-8');
  let out;
  try {
    out = execFileSync(NODE, ['generate-latex.mjs', texPath], { cwd: ROOT, encoding: 'utf-8' });
  } catch (e) {
    out = (e.stdout || '').toString();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  try {
    return JSON.parse(out);
  } catch {
    return null;
  }
}

const validFixture = `\\documentclass{article}
\\pdfgentounicode=1
\\begin{document}
\\section{Education}
\\section{Experience}
\\section{Projects}
\\section{Skills}
\\resumeSubheading
\\resumeItem
\\resumeProjectHeading
\\end{document}
`;

describe('generate-latex compatibility', () => {
  it('returns HEAD-compatible JSON report keys for validation-only runs', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'latex-shape-'));
    const texPath = join(dir, 'cv.tex');
    writeFileSync(texPath, validFixture, 'utf-8');
    const report = await compileLatexFile(texPath, validFixture, null, false);
    rmSync(dir, { recursive: true, force: true });

    expect(report).toMatchObject({
      file: 'cv.tex',
      path: texPath,
      valid: true,
      compileOnly: false,
      counts: expect.objectContaining({
        resumeItems: expect.any(Number),
        subheadings: expect.any(Number),
        projectHeadings: expect.any(Number),
      }),
      issues: [],
    });
    expect(typeof report.sizeKB).toBe('number');
    expect(report.compiled === true || report.compileError || report.engine).toBeTruthy();
  });

  it('flags missing pdfgentounicode through the root facade JSON output', () => {
    const report = latexValidate(`\\documentclass{article}
\\begin{document}
\\section{A}
\\section{B}
\\section{C}
\\section{D}
\\resumeSubheading
\\resumeItem
\\resumeProjectHeading
\\end{document}
`);
    expect(report?.valid).toBe(false);
    expect(report?.issues.some((i) => /pdfgentounicode/i.test(i))).toBe(true);
  });

  it('reports engine missing without throwing when validation passes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'latex-engine-'));
    const texPath = join(dir, 'cv.tex');
    writeFileSync(texPath, validFixture, 'utf-8');
    const report = await compileLatexFile(texPath, validFixture, null, false);
    rmSync(dir, { recursive: true, force: true });

    if (report.engine) {
      expect(report.valid).toBe(true);
      expect(report.compiled).toBe(true);
    } else {
      expect(report.valid).toBe(true);
      expect(report.compiled).toBe(false);
      expect(report.compileError).toMatch(/No LaTeX engine found/i);
    }
  });

  it('supports --compile-only via root CLI JSON output', () => {
    const dir = mkdtempSync(join(tmpdir(), 'latex-compile-only-'));
    const texPath = join(dir, 'cv.tex');
    writeFileSync(texPath, '\\begin{document}\\end{document}', 'utf-8');
    let out;
    try {
      out = execFileSync(NODE, ['generate-latex.mjs', texPath, '--compile-only'], { cwd: ROOT, encoding: 'utf-8' });
    } catch (e) {
      out = (e.stdout || '').toString();
    }
    rmSync(dir, { recursive: true, force: true });
    const report = JSON.parse(out);
    expect(report.compileOnly).toBe(true);
    expect(report.issues).toEqual([]);
  });
});
