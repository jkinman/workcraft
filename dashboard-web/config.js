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
  get PORT() {
    return process.env.PORT || 3000;
  },
  get CAREER_OPS_PATH() {
    return resolveCareerOpsPath();
  },
  DATA_DIR: 'data',
  PIPELINE_FILE: 'pipeline.md',
  get DASHBOARD_URL() {
    return process.env.DASHBOARD_URL || `http://localhost:${this.PORT}`;
  }
};

module.exports = CONFIG;
