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

  async writeProfile(content) {
    return await this.repository.writeText(this.repository.profilePath(), content);
  }

  readCv() {
    return this.readOptionalText(this.repository.cvPath());
  }

  async writeCv(content) {
    return await this.repository.writeText(this.repository.cvPath(), content);
  }

  readPortals() {
    return this.readOptionalText(this.repository.portalsPath());
  }

  async writePortals(content) {
    return await this.repository.writeText(this.repository.portalsPath(), content);
  }

  readArticleDigest() {
    return this.readOptionalText(this.repository.articleDigestPath());
  }

  readAgentProfile() {
    return this.readOptionalText(this.repository.agentProfilePath());
  }

  async writeAgentProfile(content) {
    return await this.repository.writeText(this.repository.agentProfilePath(), content);
  }

  readStoryBank() {
    return this.readOptionalText(this.repository.storyBankPath());
  }

  readInterviewPrep(filename) {
    const safeName = path.basename(filename);
    return this.readOptionalText(path.join(this.repository.interviewPrepDir(), safeName));
  }

  async writeInterviewPrep(filename, content) {
    const safeName = path.basename(filename);
    return await this.repository.writeText(path.join(this.repository.interviewPrepDir(), safeName), content);
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

  async writePipeline(content) {
    return await this.repository.writeText(this.repository.dataPath('pipeline.md'), content);
  }

  readApplications() {
    return this.readOptionalText(this.repository.dataPath('applications.md'));
  }

  async writeApplications(content) {
    return await this.repository.writeText(this.repository.dataPath('applications.md'), content);
  }

  trackerDocumentPath() {
    return this.repository.dataPath('applications.md');
  }

  readStatusLog() {
    return this.readOptionalText(this.repository.dataPath('status-log.tsv'));
  }

  async appendStatusLog(chunk) {
    const key = this.repository.dataPath('status-log.tsv');
    const existing = this.readStatusLog() || '';
    return await this.repository.writeText(key, `${existing}${chunk}`);
  }

  async writeStatusLog(content) {
    return await this.repository.writeText(this.repository.dataPath('status-log.tsv'), content);
  }

  async deleteStatusLog() {
    const key = this.repository.dataPath('status-log.tsv');
    if (typeof this.repository.deleteText === 'function') {
      return await this.repository.deleteText(key);
    }
    return await this.repository.writeText(key, '');
  }

  readFollowUps() {
    return this.readOptionalText(this.repository.dataPath('follow-ups.md'));
  }

  async writeFollowUps(content) {
    return await this.repository.writeText(this.repository.dataPath('follow-ups.md'), content);
  }

  readScanHistory() {
    return this.readOptionalText(this.repository.dataPath('scan-history.tsv'));
  }

  async writeScanHistory(content) {
    return await this.repository.writeText(this.repository.dataPath('scan-history.tsv'), content);
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

  async writeReport(filename, content) {
    const safeName = path.basename(filename);
    const key = `${this.repository.reportsDir()}/${safeName}`;
    return await this.repository.writeText(key, content);
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
    return await this.repository.writeBinary(this.outputFileKey(filename), content);
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

  async ensureOutputDir() {
    await this.repository.writeText(path.join(this.repository.outputDir(), '.gitkeep'), '');
    return this.repository.outputDir();
  }

  listFilesInDirectory(dir, predicate) {
    return this.repository.listFilesInDirectory(dir, predicate);
  }

  /**
   * Multi-document mutation seam for tracker transitions and evaluation persistence.
   */
  async mutateDocuments(mutations) {
    const snapshots = new Map();
    const applied = [];
    const client = this;

    async function rollbackApplied() {
      for (let i = applied.length - 1; i >= 0; i -= 1) {
        const key = applied[i];
        const previous = snapshots.get(key);
        if (previous == null) {
          if (typeof client.repository.deleteText === 'function') {
            await client.repository.deleteText(key);
          } else {
            await client.repository.writeText(key, '');
          }
        } else {
          await client.repository.writeText(key, previous);
        }
      }
    }

    try {
      for (const { key, content } of mutations) {
        snapshots.set(key, client.repository.exists(key) ? client.repository.readText(key) : null);
        await client.repository.writeText(key, content);
        applied.push(key);
      }
    } catch (err) {
      await rollbackApplied();
      throw err;
    }

    return {
      applied,
      rollback: rollbackApplied,
    };
  }
}

function createDataClient(repository) {
  return new CareerOpsDataClient(repository);
}

module.exports = {
  CareerOpsDataClient,
  createDataClient
};
