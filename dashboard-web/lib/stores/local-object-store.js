class LocalObjectStore {
  constructor(dataClient) {
    this.dataClient = dataClient;
    this.adapter = 'local';
  }

  async putObject({ key, content, contentType = 'application/octet-stream', metadata = {} }) {
    const result = await this.dataClient.putGeneratedFile({
      filename: key,
      content,
      type: metadata.type || 'object',
      relatedEntity: metadata.relatedEntity || null
    });

    return {
      key: result.filename,
      contentType,
      metadata,
      storage: result.storage,
      path: result.path
    };
  }

  getObject(key) {
    const result = this.dataClient.getGeneratedFile(key);
    if (!result) return null;

    return {
      key: result.filename,
      content: result.content,
      storage: result.storage,
      path: result.path
    };
  }

  getSignedUrl(key) {
    const result = this.dataClient.getGeneratedFile(key);
    if (!result) return null;
    return `/download-pdf?file=${encodeURIComponent(result.filename)}`;
  }
}

module.exports = {
  LocalObjectStore
};
