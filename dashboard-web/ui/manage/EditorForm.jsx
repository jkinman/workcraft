'use client';

import { useState } from 'react';

export function EditorForm({
  endpoint,
  initialContent = '',
  label,
  placeholder = '',
  saveLabel = 'SAVE',
  onSaved,
  children
}) {
  const [content, setContent] = useState(initialContent);
  const [status, setStatus] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  async function save() {
    setIsSaving(true);
    setStatus(null);

    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const data = await response.json();

      if (!data.success) {
        setStatus({ type: 'error', message: data.error || 'Save failed' });
      } else {
        setStatus({ type: 'success', message: 'Saved.' });
        if (onSaved) onSaved(data);
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="card">
      {label ? <div className="muted">{label}</div> : null}
      <textarea
        className="input editor-textarea"
        value={content}
        spellCheck={false}
        placeholder={placeholder}
        onChange={event => setContent(event.target.value)}
      />
      {children ? children(content) : null}
      <div className="nav-buttons">
        <button className="btn btn-success" disabled={isSaving} onClick={save} type="button">
          {isSaving ? 'SAVING...' : saveLabel}
        </button>
      </div>
      {status ? <div className={`alert ${status.type}`}>{status.message}</div> : null}
    </div>
  );
}
