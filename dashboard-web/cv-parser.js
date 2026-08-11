// cv-parser.js — CJS shim; canonical parser: lib/documents/cv-parse.mjs

const fs = require('fs');
const path = require('path');
const CONFIG = require('./config');

function parseCVContent(content) {
  const mod = global.__careerOpsCvParse;
  if (!mod) {
    throw new Error('CV parser not initialized. Load services through tenant-services first.');
  }
  return mod.parseCVContent(content);
}

function parseCV() {
  const cvPath = path.join(CONFIG.CAREER_OPS_PATH, 'cv.md');
  if (!fs.existsSync(cvPath)) {
    throw new Error('cv.md not found at ' + cvPath);
  }
  return parseCVContent(fs.readFileSync(cvPath, 'utf8'));
}

module.exports = { parseCV, parseCVContent };
