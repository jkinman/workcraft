'use client';

import { useState } from 'react';
import { RepeatableList, TagListField, TextField } from './fields';

function emptyQuery() {
  return { name: '', query: '', enabled: true };
}

function emptyCompany() {
  return { name: '', careers_url: '', notes: '', enabled: true };
}

export function SearchSettingsForm({ initialPortals }) {
  const [portals, setPortals] = useState(initialPortals);
  const [status, setStatus] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  function setField(path, value) {
    setPortals(prev => {
      const next = structuredClone(prev);
      let target = next;
      for (let i = 0; i < path.length - 1; i++) target = target[path[i]];
      target[path[path.length - 1]] = value;
      return next;
    });
  }

  async function save() {
    setIsSaving(true);
    setStatus(null);
    try {
      const response = await fetch('/api/manage/portals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portals })
      });
      const data = await response.json();
      if (!data.success) {
        setStatus({ type: 'error', message: data.error || 'Save failed' });
      } else {
        if (data.portals) setPortals(data.portals);
        setStatus({ type: 'success', message: 'Search settings saved.' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setIsSaving(false);
    }
  }

  const enabledCompanies = portals.trackedCompanies.filter(c => c.enabled !== false).length;

  return (
    <div className="form-stack">
      <div className="card form-stack">
        <div className="section-title">Title filter</div>
        <p className="muted">A job title matches when it contains at least one positive keyword and no negative keywords.</p>
        <TagListField
          label="Positive keywords (must match one)"
          values={portals.titleFilter.positive}
          onChange={v => setField(['titleFilter', 'positive'], v)}
          placeholder="e.g. AI Engineer"
        />
        <TagListField
          label="Negative keywords (exclude)"
          values={portals.titleFilter.negative}
          onChange={v => setField(['titleFilter', 'negative'], v)}
          placeholder="e.g. Junior"
        />
        <TagListField
          label="Seniority boost (optional)"
          values={portals.titleFilter.seniority_boost}
          onChange={v => setField(['titleFilter', 'seniority_boost'], v)}
          placeholder="e.g. Senior, Staff, Lead"
        />
      </div>

      <div className="card form-stack">
        <div className="section-title">Search queries</div>
        <p className="muted">Each query runs against job boards during a scan.</p>
        <RepeatableList
          items={portals.searchQueries}
          onChange={v => setField(['searchQueries'], v)}
          newItem={emptyQuery}
          addLabel="+ ADD_QUERY"
          emptyLabel="No search queries yet."
          renderItem={(item, update) => (
            <div className="form-stack">
              <TextField label="Name" value={item.name} onChange={v => update({ ...item, name: v })} placeholder="Ashby — AI Engineer" />
              <TextField label="Query" value={item.query} onChange={v => update({ ...item, query: v })} placeholder='site:jobs.ashbyhq.com "AI Engineer" remote' />
              <label className="toggle-row">
                <input type="checkbox" checked={item.enabled !== false} onChange={e => update({ ...item, enabled: e.target.checked })} />
                <span>Enabled</span>
              </label>
            </div>
          )}
        />
      </div>

      <div className="card form-stack">
        <div className="section-title">Tracked companies ({enabledCompanies} enabled / {portals.trackedCompanies.length})</div>
        <p className="muted">Career pages checked directly during a scan. Other fields (API, scan method) are preserved.</p>
        <RepeatableList
          items={portals.trackedCompanies}
          onChange={v => setField(['trackedCompanies'], v)}
          newItem={emptyCompany}
          addLabel="+ ADD_COMPANY"
          emptyLabel="No tracked companies yet."
          renderItem={(item, update) => (
            <div className="form-stack">
              <div className="field-grid">
                <TextField label="Name" value={item.name} onChange={v => update({ ...item, name: v })} />
                <TextField label="Careers URL" value={item.careers_url} onChange={v => update({ ...item, careers_url: v })} />
              </div>
              <TextField label="Notes" value={item.notes} onChange={v => update({ ...item, notes: v })} />
              <label className="toggle-row">
                <input type="checkbox" checked={item.enabled !== false} onChange={e => update({ ...item, enabled: e.target.checked })} />
                <span>Enabled</span>
              </label>
            </div>
          )}
        />
      </div>

      <div className="card">
        <div className="nav-buttons">
          <button className="btn btn-success" disabled={isSaving} onClick={save} type="button">
            {isSaving ? 'SAVING...' : 'SAVE_SEARCH_SETTINGS'}
          </button>
        </div>
        {status ? <div className={`alert ${status.type}`}>{status.message}</div> : null}
      </div>
    </div>
  );
}
