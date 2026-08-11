const fs = require('fs');
const path = require('path');
const CONFIG = require('../../config');
const { DEFAULT_TENANT_ID, normalizeTenantId } = require('../tenant-context');

class LocalCareerOpsRepository {
  constructor({ tenantId = DEFAULT_TENANT_ID, rootPath } = {}) {
    this.tenantId = normalizeTenantId(tenantId);
    this.rootPath = rootPath || process.env.CAREER_OPS_PATH || CONFIG.CAREER_OPS_PATH;
    this.storageAdapter = 'local';
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

  articleDigestPath() {
    return path.join(this.tenantRoot(), 'article-digest.md');
  }

  storyBankPath() {
    return path.join(this.tenantRoot(), 'interview-prep', 'story-bank.md');
  }

  jdsDir() {
    return path.join(this.tenantRoot(), 'jds');
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

  async writeText(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
  }

  async deleteText(filePath) {
    if (!fs.existsSync(filePath)) return false;
    fs.unlinkSync(filePath);
    return true;
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

  async listOutputFiles() {
    return this.listFilesInDirectory(this.outputDir(), file => file !== '.gitkeep');
  }
}

module.exports = {
  LocalCareerOpsRepository
};
