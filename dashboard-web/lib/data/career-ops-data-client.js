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
    return this.readOptionalText(this.repository.articleDigestPath());
  }

  readAgentProfile() {
    return this.readOptionalText(this.repository.agentProfilePath());
  }

  writeAgentProfile(content) {
    return this.repository.writeText(this.repository.agentProfilePath(), content);
  }

  readStoryBank() {
    return this.readOptionalText(this.repository.storyBankPath());
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
    return this.repository.listFilesInDirectory(
      this.repository.jdsDir(),
      file => file.endsWith('.md') || file.endsWith('.txt')
    );
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

  outputFileKey(filename) {
    const safeName = path.basename(filename);
    return `${this.repository.outputDir()}/${safeName}`;
  }

  async readOutputFile(filename) {
    const key = this.outputFileKey(filename);
    if (this.repository.storageAdapter === 'local' && !this.repository.exists(key)) {
      return null;
    }
    return this.repository.readBinary(key);
  }

  async writeOutputFile(filename, content) {
    return this.repository.writeBinary(this.outputFileKey(filename), content);
  }

  async putGeneratedFile({ filename, content, type = 'unknown', relatedEntity = null }) {
    await this.writeOutputFile(filename, content);
    return {
      filename: path.basename(filename),
      type,
      relatedEntity,
      storage: this.repository.storageAdapter,
      path: this.resolveOutputPath(filename)
    };
  }

  async getGeneratedFile(filename) {
    const content = await this.readOutputFile(filename);
    if (!content) return null;
    return {
      filename: path.basename(filename),
      content,
      storage: this.repository.storageAdapter,
      path: this.resolveOutputPath(filename)
    };
  }

  resolveOutputPath(filename) {
    const safeName = path.basename(filename);
    if (this.repository.storageAdapter === 'supabase') {
      return this.outputFileKey(safeName);
    }
    return path.join(this.repository.outputDir(), safeName);
  }

  async listGeneratedFiles() {
    return this.repository.listOutputFiles();
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
