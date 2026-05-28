const fs = require('fs');
const path = require('path');
const CONFIG = require('../../config');
const { DEFAULT_TENANT_ID, normalizeTenantId } = require('../tenant-context');

class LocalCareerOpsRepository {
  constructor({ tenantId = DEFAULT_TENANT_ID, rootPath = CONFIG.CAREER_OPS_PATH } = {}) {
    this.tenantId = normalizeTenantId(tenantId);
    this.rootPath = rootPath;
  }

  tenantRoot() {
    if (this.tenantId === DEFAULT_TENANT_ID) {
      return this.rootPath;
    }
    return path.join(this.rootPath, 'tenants', this.tenantId);
  }

  dataPath(filename) {
    return path.join(this.tenantRoot(), 'data', filename);
  }

  reportsDir() {
    return path.join(this.tenantRoot(), 'reports');
  }

  outputDir() {
    return path.join(this.tenantRoot(), 'output');
  }

  profilePath() {
    return path.join(this.tenantRoot(), 'config', 'profile.yml');
  }

  portalsPath() {
    return path.join(this.tenantRoot(), 'portals.yml');
  }

  agentProfilePath() {
    return path.join(this.tenantRoot(), 'modes', '_profile.md');
  }

  interviewPrepDir() {
    return path.join(this.tenantRoot(), 'interview-prep');
  }

  cvPath() {
    return path.join(this.tenantRoot(), 'cv.md');
  }

  exists(filePath) {
    return fs.existsSync(filePath);
  }

  readText(filePath) {
    return fs.readFileSync(filePath, 'utf8');
  }

  readBinary(filePath) {
    return fs.readFileSync(filePath);
  }

  writeText(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
  }

  writeBinary(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }

  listMarkdownReports() {
    const reportsDir = this.reportsDir();
    if (!fs.existsSync(reportsDir)) return [];

    return this.listFilesInDirectory(reportsDir, file => file.endsWith('.md') && file !== '.gitkeep');
  }

  listFilesInDirectory(dir, predicate = () => true) {
    if (!fs.existsSync(dir)) return [];

    return fs.readdirSync(dir)
      .filter(predicate)
      .map(file => ({
        filename: file,
        path: path.join(dir, file),
        stat: fs.statSync(path.join(dir, file))
      }));
  }
}

module.exports = {
  LocalCareerOpsRepository
};
