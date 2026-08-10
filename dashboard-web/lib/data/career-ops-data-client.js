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
    return this.repository.writeText(this.repository.profilePath(), content);
  }

  readCv() {
    return this.readOptionalText(this.repository.cvPath());
  }

  writeCv(content) {
    return this.repository.writeText(this.repository.cvPath(), content);
  }

  readPortals() {
    return this.readOptionalText(this.repository.portalsPath());
  }

  writePortals(content) {
    return this.repository.writeText(this.repository.portalsPath(), content);
  }

  readArticleDigest() {
    return this.readOptionalText(path.join(this.repository.tenantRoot(), 'article-digest.md'));
  }

  readAgentProfile() {
    return this.readOptionalText(this.repository.agentProfilePath());
  }

  writeAgentProfile(content) {
    return this.repository.writeText(this.repository.agentProfilePath(), content);
  }

  readStoryBank() {
    return this.readOptionalText(path.join(this.repository.tenantRoot(), 'interview-prep', 'story-bank.md'));
  }

  readInterviewPrep(filename) {
    const safeName = path.basename(filename);
    return this.readOptionalText(path.join(this.repository.interviewPrepDir(), safeName));
  }

  writeInterviewPrep(filename, content) {
    const safeName = path.basename(filename);
    this.repository.writeText(path.join(this.repository.interviewPrepDir(), safeName), content);
  }

  listInterviewPrep() {
    return this.repository.listFilesInDirectory(
      this.repository.interviewPrepDir(),
      file => file.endsWith('.md') && file !== '.gitkeep'
    );
  }

  listJobDescriptions() {
    const dir = path.join(this.repository.tenantRoot(), 'jds');
    return this.repository.listFilesInDirectory(dir, file => file.endsWith('.md') || file.endsWith('.txt'));
  }

  readPipeline() {
    return this.readOptionalText(this.repository.dataPath('pipeline.md'));
  }

  writePipeline(content) {
    return this.repository.writeText(this.repository.dataPath('pipeline.md'), content);
  }

  readApplications() {
    return this.readOptionalText(this.repository.dataPath('applications.md'));
  }

  writeApplications(content) {
    return this.repository.writeText(this.repository.dataPath('applications.md'), content);
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
    const key = `${this.repository.reportsDir()}/${safeName}`;
    return this.repository.writeText(key, content);
  }

  readOutputFile(filename) {
    const safeName = path.basename(filename);
    const filePath = path.join(this.repository.outputDir(), safeName);
    return this.repository.exists(filePath) ? this.repository.readBinary(filePath) : null;
  }

  async writeOutputFile(filename, content) {
    const safeName = path.basename(filename);
    const key = `${this.repository.outputDir()}/${safeName}`;
    return this.repository.writeBinary(key, content);
  }

  async putGeneratedFile({ filename, content, type = 'unknown', relatedEntity = null }) {
    await this.writeOutputFile(filename, content);
    return {
      filename: path.basename(filename),
      type,
      relatedEntity,
      storage: this.repository.constructor?.name?.includes('Supabase') ? 'supabase' : 'local',
      path: this.resolveOutputPath(filename)
    };
  }

  getGeneratedFile(filename) {
    const content = this.readOutputFile(filename);
    if (!content) return null;
    return {
      filename: path.basename(filename),
      content,
      storage: 'local',
      path: this.resolveOutputPath(filename)
    };
  }

  resolveOutputPath(filename) {
    return path.join(this.repository.outputDir(), path.basename(filename));
  }

  listGeneratedFiles() {
    return this.repository
      .listFilesInDirectory(this.repository.outputDir(), file => file !== '.gitkeep')
      .map(file => ({ filename: file.filename, stat: file.stat }));
  }

  ensureOutputDir() {
    this.repository.writeText(path.join(this.repository.outputDir(), '.gitkeep'), '');
    return this.repository.outputDir();
  }

  listFilesInDirectory(dir, predicate) {
    return this.repository.listFilesInDirectory(dir, predicate);
  }
}

function createDataClient(repository) {
  return new CareerOpsDataClient(repository);
}

module.exports = {
  CareerOpsDataClient,
  createDataClient
};
