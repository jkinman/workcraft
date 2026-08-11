'use client';

import { useCallback, useState } from 'react';
import { collectValidationErrors } from '../../lib/services/onboarding-validation';
import { ClerkIdentityLoader } from './ClerkIdentityLoader';

function toggle(list, value) {
  return list.includes(value) ? list.filter(item => item !== value) : [...list, value];
}

const WORK_MODE_LABELS = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site'
};

export function OnboardingWizard({ options, initialAnswers, authEnabled = false }) {
  const seed = initialAnswers || {};
  const seedLocation = seed.location || {};
  const seedComp = seed.compensation || {};

  const [fullName, setFullName] = useState(seed.fullName || '');
  const [email, setEmail] = useState(seed.email || '');
  const [city, setCity] = useState(seedLocation.city || '');
  const [region, setRegion] = useState(seedLocation.region || '');
  const [country, setCountry] = useState(seedLocation.country || '');
  const [workModes, setWorkModes] = useState(seed.workModes || ['remote']);
  const [roleFocus, setRoleFocus] = useState(seed.roleFocus || []);
  const [customKeywords, setCustomKeywords] = useState((seed.customKeywords || []).join(', '));
  const [seniority, setSeniority] = useState(seed.seniority || ['Senior']);
  const [compCurrency, setCompCurrency] = useState(seedComp.currency || 'USD');
  const [compMin, setCompMin] = useState(seedComp.minimum || '');
  const [compTarget, setCompTarget] = useState(seedComp.target || '');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState([]);

  const applyIdentity = useCallback(identity => {
    setFullName(prev => prev || identity.fullName);
    setEmail(prev => prev || identity.email);
  }, []);

  function buildAnswers() {
    return {
      fullName,
      email,
      location: { city, region, country },
      workModes,
      roleFocus,
      customKeywords,
      seniority,
      compensation: { currency: compCurrency, minimum: compMin, target: compTarget }
    };
  }

  async function submit() {
    const answers = buildAnswers();
    const validationErrors = collectValidationErrors(answers);
    if (validationErrors.length) {
      setFieldErrors(validationErrors);
      setError(validationErrors.join(' '));
      return;
    }

    setIsSaving(true);
    setError(null);
    setFieldErrors([]);

    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers })
      });
      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Could not save your setup.');
        setIsSaving(false);
        return;
      }
      window.location.href = '/';
    } catch (caught) {
      setError(caught.message);
      setIsSaving(false);
    }
  }

  return (
    <div className="onboarding">
      {authEnabled ? <ClerkIdentityLoader onIdentity={applyIdentity} /> : null}

      <div className="onboarding-hero">
        <div className="section-title">Welcome to Career-Ops</div>
        <h2 className="onboarding-headline">Let&apos;s set up your job search</h2>
        <p className="muted">
          Tell us where you want to work and what roles you want. We&apos;ll use this to scan portals and score every
          job against your profile. You can change all of it later in <strong>/manage</strong>.
        </p>
      </div>

      <section className="onboarding-step card">
        <div className="step-head">
          <span className="step-num">1</span>
          <div>
            <strong>Where do you want to work?</strong>
            <div className="muted">Pick any that apply.</div>
          </div>
        </div>
        <div className="chip-row">
          {options.workModes.map(mode => (
            <button
              key={mode}
              type="button"
              className={`chip ${workModes.includes(mode) ? 'chip-on' : ''}`}
              onClick={() => setWorkModes(prev => toggle(prev, mode))}
            >
              {WORK_MODE_LABELS[mode] || mode}
            </button>
          ))}
        </div>
        <div className="field-grid">
          <label className="field">
            <span className="muted">City</span>
            <input className="input" value={city} placeholder="Vancouver" onChange={e => setCity(e.target.value)} />
          </label>
          <label className="field">
            <span className="muted">Region / State</span>
            <input className="input" value={region} placeholder="BC" onChange={e => setRegion(e.target.value)} />
          </label>
          <label className="field">
            <span className="muted">Country</span>
            <input className="input" value={country} placeholder="Canada" onChange={e => setCountry(e.target.value)} />
          </label>
        </div>
      </section>

      <section className="onboarding-step card">
        <div className="step-head">
          <span className="step-num">2</span>
          <div>
            <strong>What roles are you targeting?</strong>
            <div className="muted">Pick focus areas, then add any extra keywords.</div>
          </div>
        </div>
        <div className="chip-row">
          {options.roleFocus.map(option => (
            <button
              key={option.id}
              type="button"
              className={`chip ${roleFocus.includes(option.id) ? 'chip-on' : ''}`}
              onClick={() => setRoleFocus(prev => toggle(prev, option.id))}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="field">
          <span className="muted">Extra keywords (comma-separated)</span>
          <input
            className="input"
            value={customKeywords}
            placeholder="e.g. Registered Nurse, Account Executive, Founding Engineer"
            onChange={e => setCustomKeywords(e.target.value)}
          />
        </label>
      </section>

      <section className="onboarding-step card">
        <div className="step-head">
          <span className="step-num">3</span>
          <div>
            <strong>Seniority</strong>
            <div className="muted">Helps rank and filter listings.</div>
          </div>
        </div>
        <div className="chip-row">
          {options.seniority.map(level => (
            <button
              key={level}
              type="button"
              className={`chip ${seniority.includes(level) ? 'chip-on' : ''}`}
              onClick={() => setSeniority(prev => toggle(prev, level))}
            >
              {level}
            </button>
          ))}
        </div>
      </section>

      <section className="onboarding-step card">
        <div className="step-head">
          <span className="step-num">4</span>
          <div>
            <strong>Compensation target</strong>
            <div className="muted">Optional, but used in evaluations and negotiation.</div>
          </div>
        </div>
        <div className="field-grid">
          <label className="field">
            <span className="muted">Currency</span>
            <input className="input" value={compCurrency} onChange={e => setCompCurrency(e.target.value)} />
          </label>
          <label className="field">
            <span className="muted">Minimum</span>
            <input className="input" value={compMin} placeholder="$120K" onChange={e => setCompMin(e.target.value)} />
          </label>
          <label className="field">
            <span className="muted">Target</span>
            <input className="input" value={compTarget} placeholder="$150K-200K" onChange={e => setCompTarget(e.target.value)} />
          </label>
        </div>
      </section>

      <section className="onboarding-step card">
        <div className="step-head">
          <span className="step-num">5</span>
          <div>
            <strong>About you</strong>
            <div className="muted">Used on generated CVs. You can refine later.</div>
          </div>
        </div>
        <div className="field-grid">
          <label className="field">
            <span className="muted">Full name</span>
            <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} />
          </label>
          <label className="field">
            <span className="muted">Email</span>
            <input className="input" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
        </div>
      </section>

      {fieldErrors.length ? (
        <div className="alert error" role="alert">
          <ul className="validation-list">
            {fieldErrors.map(message => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error && !fieldErrors.length ? <div className="alert error">{error}</div> : null}

      <div className="onboarding-actions">
        <button className="btn btn-success btn-lg" type="button" disabled={isSaving} onClick={submit}>
          {isSaving ? 'SAVING...' : 'FINISH SETUP'}
        </button>
        <span className="muted">Next: add your resume and run your first scan.</span>
      </div>
    </div>
  );
}
