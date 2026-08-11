function formatSize(size) {
  if (size === null || size === undefined) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function AssetList({ files = [] }) {
  if (!files.length) {
    return (
      <div className="card">
        <span className="muted">No generated files yet. Export a resume or report to populate this list.</span>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="activity-list">
        {files.map(file => (
          <div className="activity-row" key={file.filename}>
            <strong>{file.filename}</strong>
            <span className="muted">{formatSize(file.size)}</span>
            <a href={file.downloadUrl}>DOWNLOAD</a>
          </div>
        ))}
      </div>
    </div>
  );
}
