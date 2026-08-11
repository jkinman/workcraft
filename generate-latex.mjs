#!/usr/bin/env node

/**
 * generate-latex.mjs — thin CLI facade over lib/documents/latex.mjs
 */

export {
  validateLatexContent,
  detectLatexEngine,
  compileLatexFile,
  compileLatexToPdf,
} from './lib/documents/latex.mjs';

import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { compileLatexFile } from './lib/documents/latex.mjs';

async function main() {
  const rawArgs = process.argv.slice(2);
  const compileOnly = rawArgs.includes('--compile-only');
  const args = rawArgs.filter((a) => a !== '--compile-only');
  const inputPath = args[0];
  const outputPath = args[1];

  if (!inputPath) {
    console.error('Usage: node generate-latex.mjs <input.tex> [output.pdf] [--compile-only]');
    process.exit(1);
  }

  const absPath = resolve(inputPath);
  let content;
  try {
    content = await readFile(absPath, 'utf-8');
  } catch (err) {
    console.error(`Error reading ${absPath}: ${err.message}`);
    process.exit(1);
  }

  const report = await compileLatexFile(absPath, content, outputPath || null, compileOnly);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.compiled ? 0 : (report.valid ? 1 : 1));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main();
}
