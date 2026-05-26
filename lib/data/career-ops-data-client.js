const path = require('path');

class CareerOpsDataClient {
  constructor(repository) {
    this.repository = repository;
  }

  tenantRoot() {
    return this.repository.tenantRoot();
  }

  readOptionalText(filePath) {
    return this.repository.exists(filePath) ? this.repository.readText(filePath) : null;
  }

  readProfile() {
    return this.readOptionalText(this.repository.profilePath());
  }

  writeProfile(content) {
    this.repository.writeText(this.repository.profilePath(), content);
  }

  readCv() {
    return this.readOptionalText(this.repository.cvPath());
  }

  readPortals() {
    return this.readOptionalText(this.repository.portalsPath());
  }

  readArticleDigest() {
    return this.readOptionalText(path.join(this.repository.tenantRoot(), 'article-digest.md'));
  }

  readStoryBank() {
    return this.readOptionalText(path.join(this.repository.tenantRoot(), 'interview-prep', 'story-bank.md'));
  }

  listJobDescriptions() {
    const dir = path.join(this.repository.tenantRoot(), 'jds');
    return this.listFilesInDirectory(dir, file => file.endsWith('.md') || file.endsWith('.txt'));
  }

  readPipeline() {
    return this.readOptionalText(this.repository.dataPath('pipeline.md'));
  }

  writePipeline(content) {
    this.repository.writeText(this.repository.dataPath('pipeline.md'), content);
  }

  readApplications() {
    return this.readOptionalText(this.repository.dataPath('applications.md'));
  }

  writeApplications(content) {
    this.repository.writeText(this.repository.dataPath('applications.md'), content);
  }

  readFollowUps() {
    return this.readOptionalText(this.repository.dataPath('follow-ups.md'));
  }

  writeFollowUps(content) {
    this.repository.writeText(this.repository.dataPath('follow-ups.md'), content);
  }

  readScanHistory() {
    return this.readOptionalText(this.repository.dataPath('scan-history.tsv'));
  }

  writeScanHistory(content) {
    this.repository.writeText(this.repository.dataPath('scan-history.tsv'), content);
  }

  listReports() {
    return this.repository.listMarkdownReports().map(file => ({
      filename: file.filename,
      stat: file.stat
    }));
  }

  readReport(filename) {
    const safeName = path.basename(filename);
    return this.readOptionalText(path.join(this.repository.reportsDir(), safeName));
  }

  writeReport(filename, content) {
    const safeName = path.basename(filename);
    this.repository.writeText(path.join(this.repository.reportsDir(), safeName), content);
  }

  readOutputFile(filename) {
    const safeName = path.basename(filename);
    const filePath = path.join(this.repository.outputDir(), safeName);
    return this.repository.exists(filePath) ? this.repository.readBinary(filePath) : null;
  }

  writeOutputFile(filename, content) {
    const safeName = path.basename(filename);
    this.repository.writeBinary(path.join(this.repository.outputDir(), safeName), content);
  }

  resolveOutputPath(filename) {
    return path.join(this.repository.outputDir(), path.basename(filename));
  }

  ensureOutputDir() {
    this.repository.writeText(path.join(this.repository.outputDir(), '.gitkeep'), '');
    return this.repository.outputDir();
  }

  listFilesInDirectory(dir, predicate) {
    const fs = require('fs');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(predicate)
      .map(filename => ({ filename, path: path.join(dir, filename) }));
  }
}

function createDataClient(repository) {
  return new CareerOpsDataClient(repository);
}

module.exports = {
  CareerOpsDataClient,
  createDataClient
};
