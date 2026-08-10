'use client';

import { useEffect, useRef, useState } from 'react';

const REQUIRED_SECTIONS = ['### Summary', '### Skills', '### Experience'];

function findMissingSections(markdown) {
  return REQUIRED_SECTIONS.filter(section => !markdown.includes(section));
}

function previewIsEmpty(preview) {
  if (!preview) return true;
  return !preview.summary && !preview.experience?.length && !preview.strengths?.length;
}

export function ResumeStudio({ initialContent = '', initialPreview = null }) {
  const [content, setContent] = useState(initialContent);
  const [preview, setPreview] = useState(initialPreview);
  const [status, setStatus] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);

  const missingSections = findMissingSections(content);

  // Live preview: re-parse the editor content (debounced) so the right pane
  // always reflects what the PDF will contain, not just the last save.
  useEffect(() => {
    const handle = setTimeout(async () => {
      try {
        const response = await fetch('/api/manage/resume/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content })
        });
        const data = await response.json();
        if (data.success) setPreview(data.preview);
      } catch {
        // Keep the last good preview on transient errors.
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [content]);

  async function importFile(file) {
    if (!file) return;
    setIsImporting(true);
    setStatus(null);

    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/manage/resume/import', { method: 'POST', body });
      const data = await response.json();

      if (!data.success) {
        setStatus({ type: 'error', message: data.error || 'Could not read that file.' });
      } else {
        setContent(data.content);
        setStatus({
          type: 'success',
          message: data.structured
            ? `Imported ${data.filename}. Review and Save.`
            : `Imported text from ${data.filename}. Reorganize it into the sections, then Save.`
        });
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function save() {
    setIsSaving(true);
    setStatus(null);

    try {
      const response = await fetch('/api/manage/resume', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const data = await response.json();

      if (!data.success) {
        setStatus({ type: 'error', message: data.error || 'Save failed' });
      } else {
        setPreview(data.preview);
        setStatus({ type: 'success', message: 'Resume saved.' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setIsSaving(false);
    }
  }

  async function generatePdf() {
    setIsGenerating(true);
    setStatus(null);

    try {
      const company = preview?.experience?.[0]?.company || 'Career-Ops';
      const role = preview?.experience?.[0]?.role || 'Candidate';
      const response = await fetch('/api/generate-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company, role })
      });
      const data = await response.json();

      if (!data.success) {
        setStatus({ type: 'error', message: data.error || 'PDF generation failed' });
      } else {
        setStatus({ type: 'success', message: 'Resume PDF generated.', downloadUrl: data.downloadUrl });
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="grid-two">
      <div className="card">
        <div className="resume-import">
          <div>
            <strong>Upload your resume</strong>
            <div className="muted">PDF, DOCX, TXT, or Markdown. We extract the text for you to review.</div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
            style={{ display: 'none' }}
            onChange={event => importFile(event.target.files?.[0])}
          />
          <button
            className="btn"
            type="button"
            disabled={isImporting}
            onClick={() => fileInputRef.current?.click()}
          >
            {isImporting ? 'READING...' : 'UPLOAD_RESUME'}
          </button>
        </div>
        <div className="muted">EDITOR — raw cv.md (this is the source text)</div>
        <textarea
          className="input editor-textarea"
          value={content}
          spellCheck={false}
          placeholder={'# Your Name\n## Tagline\n\n### Summary\nA short paragraph...\n\n### Skills\n- Skill area\n\n### Experience\n**Company** | Role | 2020-2024'}
          onChange={event => setContent(event.target.value)}
        />
        {missingSections.length ? (
          <div className="alert error">
            Missing required sections: {missingSections.join(', ')}. Text only appears in your PDF if it sits under
            these headings.
          </div>
        ) : null}
        <div className="nav-buttons">
          <button className="btn btn-success" disabled={isSaving} onClick={save} type="button">
            {isSaving ? 'SAVING...' : 'SAVE_RESUME'}
          </button>
          <button
            className="btn"
            disabled={isGenerating || missingSections.length > 0 || previewIsEmpty(preview)}
            onClick={generatePdf}
            type="button"
            title={
              missingSections.length || previewIsEmpty(preview)
                ? 'Add content under the required sections before generating a PDF.'
                : 'Generate a PDF from your resume.'
            }
          >
            {isGenerating ? 'GENERATING...' : 'GENERATE_RESUME_PDF'}
          </button>
        </div>
        {status ? (
          <div className={`alert ${status.type}`}>
            {status.message}
            {status.downloadUrl ? (
              <>
                {' '}
                <a href={status.downloadUrl}>Download</a>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="card">
        <div className="muted">PREVIEW — exactly what your PDF will contain (updates as you type)</div>
        {previewIsEmpty(preview) ? (
          <div className="alert error">
            <strong>Nothing is being read from your resume yet.</strong>
            <p className="muted">
              Your text isn&apos;t under the headings the PDF needs. Click <strong>UPLOAD_RESUME</strong> to re-import
              (it now auto-sorts your sections), or move text directly under <code>### Summary</code>,{' '}
              <code>### Skills</code>, and <code>### Experience</code> on the left.
            </p>
          </div>
        ) : (
          <ResumePreview preview={preview} />
        )}
      </div>
    </div>
  );
}

function ResumePreview({ preview }) {
  return (
    <div className="report-body">
      <h3>{preview.name || 'Unnamed'}</h3>
      <div className="muted">{preview.tagline}</div>
      {preview.summary ? <p>{preview.summary}</p> : <p className="muted">No summary parsed.</p>}

      <div className="section-title">Experience</div>
      {preview.experience?.length ? (
        preview.experience.map(exp => (
          <div className="activity-row" key={`${exp.company}-${exp.role}`}>
            <strong>{exp.company}</strong>
            <span>{exp.role}</span>
            <span className="muted">{exp.date}</span>
          </div>
        ))
      ) : (
        <span className="muted">No experience parsed.</span>
      )}

      <div className="section-title">Strengths</div>
      {preview.strengths?.length ? (
        <ul>{preview.strengths.map(item => <li key={item}>{item}</li>)}</ul>
      ) : (
        <span className="muted">No strengths parsed.</span>
      )}
    </div>
  );
}
