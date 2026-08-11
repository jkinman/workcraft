'use client';

import { useState } from 'react';
import { LinesField, TagListField, TextAreaField, TextField } from './fields';

export function ProfileForm({ initialProfile, resumePrefill = null }) {
  const [profile, setProfile] = useState(initialProfile);
  const [status, setStatus] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const suggestedRoles = (resumePrefill?.suggestedRoles || []).filter(
    role => !profile.targetRoles.includes(role)
  );

  function setField(path, value) {
    setProfile(prev => {
      const next = structuredClone(prev);
      let target = next;
      for (let i = 0; i < path.length - 1; i++) target = target[path[i]];
      target[path[path.length - 1]] = value;
      return next;
    });
  }

  // Fill only empty candidate fields from the resume so we never clobber edits.
  function prefillFromResume() {
    if (!resumePrefill?.candidate) return;
    setProfile(prev => {
      const next = structuredClone(prev);
      for (const [key, value] of Object.entries(resumePrefill.candidate)) {
        if (value && !next.candidate[key]) next.candidate[key] = value;
      }
      return next;
    });
    setStatus({ type: 'success', message: 'Filled empty fields from your resume. Review, then Save.' });
  }

  function addRole(role) {
    if (!profile.targetRoles.includes(role)) {
      setField(['targetRoles'], [...profile.targetRoles, role]);
    }
  }

  async function save() {
    setIsSaving(true);
    setStatus(null);
    try {
      const response = await fetch('/api/manage/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile })
      });
      const data = await response.json();
      if (!data.success) {
        setStatus({ type: 'error', message: data.error || 'Save failed' });
      } else {
        if (data.profile) setProfile(data.profile);
        setStatus({ type: 'success', message: 'Profile saved.' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="card form-stack">
      {resumePrefill?.hasResume ? (
        <div className="prefill-banner">
          <span className="muted">Your résumé has contact details and work history we can reuse here.</span>
          <button type="button" className="btn" onClick={prefillFromResume}>
            PREFILL_FROM_RESUME
          </button>
        </div>
      ) : null}

      <div className="section-title">Candidate</div>
      <div className="field-grid">
        <TextField label="Full name" value={profile.candidate.full_name} onChange={v => setField(['candidate', 'full_name'], v)} />
        <TextField label="Email" value={profile.candidate.email} onChange={v => setField(['candidate', 'email'], v)} />
        <TextField label="Phone" value={profile.candidate.phone} onChange={v => setField(['candidate', 'phone'], v)} />
        <TextField label="Location" value={profile.candidate.location} onChange={v => setField(['candidate', 'location'], v)} />
        <TextField label="LinkedIn" value={profile.candidate.linkedin} onChange={v => setField(['candidate', 'linkedin'], v)} />
        <TextField label="Portfolio URL" value={profile.candidate.portfolio_url} onChange={v => setField(['candidate', 'portfolio_url'], v)} />
        <TextField label="GitHub" value={profile.candidate.github} onChange={v => setField(['candidate', 'github'], v)} />
      </div>

      <div className="section-title">Target roles</div>
      <TagListField
        label="Roles you're targeting"
        values={profile.targetRoles}
        onChange={v => setField(['targetRoles'], v)}
        placeholder="e.g. Senior AI Engineer"
        hint="These drive job matching and scoring. They come from onboarding, not your résumé — edit freely."
      />
      {suggestedRoles.length ? (
        <div className="suggestions">
          <span className="form-hint">From your résumé:</span>
          {suggestedRoles.map(role => (
            <button type="button" className="suggestion-chip" key={role} onClick={() => addRole(role)}>
              + {role}
            </button>
          ))}
        </div>
      ) : null}

      <div className="section-title">Compensation</div>
      <div className="field-grid">
        <TextField label="Target range" value={profile.compensation.target_range} onChange={v => setField(['compensation', 'target_range'], v)} placeholder="$150K-200K" />
        <TextField label="Currency" value={profile.compensation.currency} onChange={v => setField(['compensation', 'currency'], v)} placeholder="USD" />
        <TextField label="Minimum (walk-away)" value={profile.compensation.minimum} onChange={v => setField(['compensation', 'minimum'], v)} />
        <TextField label="Location flexibility" value={profile.compensation.location_flexibility} onChange={v => setField(['compensation', 'location_flexibility'], v)} />
      </div>

      <div className="section-title">Location</div>
      <div className="field-grid">
        <TextField label="Country" value={profile.location.country} onChange={v => setField(['location', 'country'], v)} />
        <TextField label="City" value={profile.location.city} onChange={v => setField(['location', 'city'], v)} />
        <TextField label="Region / state" value={profile.location.region} onChange={v => setField(['location', 'region'], v)} />
        <TextField label="Timezone" value={profile.location.timezone} onChange={v => setField(['location', 'timezone'], v)} />
      </div>
      <TagListField
        label="Work modes"
        values={profile.location.work_modes}
        onChange={v => setField(['location', 'work_modes'], v)}
        placeholder="remote, hybrid, onsite"
      />

      <div className="section-title">Narrative</div>
      <TextField label="Headline" value={profile.narrative.headline} onChange={v => setField(['narrative', 'headline'], v)} />
      <TextAreaField label="Exit story / what makes you unique" value={profile.narrative.exit_story} onChange={v => setField(['narrative', 'exit_story'], v)} rows={3} />
      <LinesField label="Superpowers (one per line)" values={profile.narrative.superpowers} onChange={v => setField(['narrative', 'superpowers'], v)} />

      <div className="nav-buttons">
        <button className="btn btn-success" disabled={isSaving} onClick={save} type="button">
          {isSaving ? 'SAVING...' : 'SAVE_PROFILE'}
        </button>
      </div>
      {status ? <div className={`alert ${status.type}`}>{status.message}</div> : null}
    </div>
  );
}
