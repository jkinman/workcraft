'use client';

import { useRef, useState } from 'react';
import { resolveWorkloadResponse } from '../../lib/client/job-polling';
import { LinesField, RepeatableList, TagListField, TextAreaField, TextField } from './fields';

const SKILL_CATEGORIES = [
  { key: 'frontend', label: 'Frontend' },
  { key: 'backend', label: 'Backend' },
  { key: 'cloud', label: 'Cloud' },
  { key: 'data', label: 'Data & AI' },
  { key: 'architecture', label: 'Architecture' }
];

function emptyExperience() {
  return { company: '', role: '', date: '', description: '', highlights: [], technologies: [] };
}

function resumeIsEmpty(resume) {
  return !resume.summary && !resume.experience?.length && !resume.strengths?.length;
}

export function ResumeForm({ initialResume }) {
  const [resume, setResume] = useState(initialResume);
  const [status, setStatus] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);

  function setField(path, value) {
    setResume(prev => {
      const next = structuredClone(prev);
      let target = next;
      for (let i = 0; i < path.length - 1; i++) target = target[path[i]];
      target[path[path.length - 1]] = value;
      return next;
    });
  }

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
        setResume(data.resume);
        setStatus({
          type: 'success',
          message: `Imported ${data.filename}. Review the fields below, then Save.`
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
        body: JSON.stringify({ resume })
      });
      const data = await response.json();
      if (!data.success) {
        setStatus({ type: 'error', message: data.error || 'Save failed' });
      } else {
        setResume(data.resume);
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
      const company = resume.experience?.[0]?.company || 'Career-Ops';
      const role = resume.experience?.[0]?.role || 'Candidate';
      const response = await fetch('/api/generate-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company, role })
      });
      const data = await resolveWorkloadResponse(response, {
        onProgress: job => {
          if (job.status === 'queued' || job.status === 'running') {
            setStatus({ type: 'info', message: `Generating PDF (${job.status})...` });
          }
        }
      });
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
      <div className="card form-stack">
        <div className="resume-import">
          <div>
            <strong>Import a resume</strong>
            <div className="muted">PDF, DOCX, TXT, or Markdown. We auto-fill the fields below — Save when it looks right.</div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
            style={{ display: 'none' }}
            onChange={event => importFile(event.target.files?.[0])}
          />
          <button className="btn" type="button" disabled={isImporting} onClick={() => fileInputRef.current?.click()}>
            {isImporting ? 'READING...' : 'IMPORT_RESUME'}
          </button>
        </div>

        <div className="section-title">Identity</div>
        <TextField label="Full name" value={resume.name} onChange={v => setField(['name'], v)} placeholder="Jane Smith" />
        <TextAreaField
          label="Tagline / headline"
          value={resume.tagline}
          onChange={v => setField(['tagline'], v)}
          rows={2}
          placeholder="What you do in one line"
        />

        <div className="section-title">Contact</div>
        <div className="field-grid">
          <TextField label="Location" value={resume.contact.location} onChange={v => setField(['contact', 'location'], v)} />
          <TextField label="Email" value={resume.contact.email} onChange={v => setField(['contact', 'email'], v)} />
          <TextField label="Phone" value={resume.contact.phone} onChange={v => setField(['contact', 'phone'], v)} />
          <TextField label="Website" value={resume.contact.website} onChange={v => setField(['contact', 'website'], v)} />
          <TextField label="LinkedIn" value={resume.contact.linkedin} onChange={v => setField(['contact', 'linkedin'], v)} />
        </div>

        <div className="section-title">Summary</div>
        <TextAreaField
          label="Professional summary"
          value={resume.summary}
          onChange={v => setField(['summary'], v)}
          rows={5}
          placeholder="A short paragraph about your background."
        />

        <div className="section-title">Strengths</div>
        <LinesField
          label="One strength per line"
          values={resume.strengths}
          onChange={v => setField(['strengths'], v)}
          placeholder={'Senior engineering judgment\nShips fast without sacrificing quality'}
        />

        <div className="section-title">Skills</div>
        <div className="field-grid">
          {SKILL_CATEGORIES.map(cat => (
            <TagListField
              key={cat.key}
              label={cat.label}
              values={resume.skills[cat.key]}
              onChange={v => setField(['skills', cat.key], v)}
              placeholder="Add skill"
            />
          ))}
        </div>

        <div className="section-title">Experience</div>
        <RepeatableList
          items={resume.experience}
          onChange={v => setField(['experience'], v)}
          newItem={emptyExperience}
          addLabel="+ ADD_ROLE"
          emptyLabel="No roles yet. Import a resume or add one."
          renderItem={(exp, update) => (
            <div className="form-stack">
              <div className="field-grid">
                <TextField label="Company" value={exp.company} onChange={v => update({ ...exp, company: v })} />
                <TextField label="Role" value={exp.role} onChange={v => update({ ...exp, role: v })} />
                <TextField label="Dates" value={exp.date} onChange={v => update({ ...exp, date: v })} placeholder="Jan 2020 - Present" />
              </div>
              <TextAreaField
                label="Description"
                value={exp.description}
                onChange={v => update({ ...exp, description: v })}
                rows={3}
              />
              <LinesField
                label="Achievements (one per line)"
                values={exp.highlights}
                onChange={v => update({ ...exp, highlights: v })}
              />
              <TagListField
                label="Technologies"
                values={exp.technologies}
                onChange={v => update({ ...exp, technologies: v })}
                placeholder="Add technology"
              />
            </div>
          )}
        />

        <div className="nav-buttons">
          <button className="btn btn-success" disabled={isSaving} onClick={save} type="button">
            {isSaving ? 'SAVING...' : 'SAVE_RESUME'}
          </button>
          <button
            className="btn"
            disabled={isGenerating || resumeIsEmpty(resume)}
            onClick={generatePdf}
            type="button"
            title={resumeIsEmpty(resume) ? 'Add a summary or experience first.' : 'Generate a PDF from your resume.'}
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
        <div className="muted">PREVIEW — what your PDF will contain</div>
        <ResumePreview resume={resume} />
      </div>
    </div>
  );
}

function ResumePreview({ resume }) {
  if (resumeIsEmpty(resume)) {
    return (
      <div className="alert">
        <strong>Nothing to preview yet.</strong>
        <p className="muted">Import a resume or fill in the summary and experience on the left.</p>
      </div>
    );
  }

  return (
    <div className="report-body resume-preview">
      <h3>{resume.name || 'Unnamed'}</h3>
      {resume.tagline ? <div className="muted">{resume.tagline}</div> : null}
      {resume.summary ? <p>{resume.summary}</p> : null}

      {resume.experience?.length ? <div className="section-title">Experience</div> : null}
      {resume.experience?.map((exp, index) => (
        <div className="preview-job" key={index}>
          <div className="preview-job-head">
            <strong>{exp.company || 'Company'}</strong>
            <span className="muted">{exp.date}</span>
          </div>
          <div className="preview-job-role">{exp.role}</div>
          {exp.description ? <p className="preview-job-desc">{exp.description}</p> : null}
          {exp.highlights?.length ? (
            <ul>
              {exp.highlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          ) : null}
          {exp.technologies?.length ? <div className="preview-tech">{exp.technologies.join(' · ')}</div> : null}
        </div>
      ))}

      {resume.strengths?.length ? (
        <>
          <div className="section-title">Strengths</div>
          <ul>
            {resume.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
