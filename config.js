// config.js - Configuration and constants
const fs = require('fs');
const path = require('path');

function hasCareerOpsTemplates(candidate) {
  return fs.existsSync(path.join(candidate, 'templates', 'portals.example.yml'));
}

function findCareerOpsRoot(startPath) {
  let current = path.resolve(startPath);

  for (let i = 0; i < 8; i++) {
    if (hasCareerOpsTemplates(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return null;
}

function resolveCareerOpsPath() {
  if (process.env.CAREER_OPS_PATH) return process.env.CAREER_OPS_PATH;

  return findCareerOpsRoot(process.cwd()) ||
    findCareerOpsRoot(__dirname) ||
    path.join(__dirname, '..');
}

const CONFIG = {
  PORT: process.env.PORT || 3000,
  CAREER_OPS_PATH: resolveCareerOpsPath(),
  DATA_DIR: 'data',
  PIPELINE_FILE: 'pipeline.md',
  DASHBOARD_URL: process.env.DASHBOARD_URL || `http://localhost:${process.env.PORT || 3000}`
};

module.exports = CONFIG;