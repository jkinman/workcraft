'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function Onboarding() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [profileId, setProfileId] = useState('')

  // Step 1: Profile
  const [displayName, setDisplayName] = useState('')
  const [targetRoles, setTargetRoles] = useState('')
  const [salaryMin, setSalaryMin] = useState('')
  const [salaryMax, setSalaryMax] = useState('')
  const [locations, setLocations] = useState('')

  // Step 2: CV
  const [rawCv, setRawCv] = useState('')

  // Step 3: Done
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) router.push('/')

      // Get profile to see if already completed
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, onboarding_completed, onboarding_step')
        .eq('id', user!.id)
        .single()

      if (profile) {
        setProfileId(profile.id)
        if (profile.onboarding_completed) {
          router.push('/dashboard')
        } else if (profile.onboarding_step > 1) {
          setStep(profile.onboarding_step)
        }
      }
    })
  }, [])

  const saveProfile = async () => {
    setSaving(true)
    const roles = targetRoles.split(',').map(s => s.trim()).filter(Boolean)
    const locs = locations.split(',').map(s => s.trim()).filter(Boolean)

    await fetch('/api/onboarding/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: displayName,
        target_roles: roles,
        target_salary_min: salaryMin ? parseInt(salaryMin) : null,
        target_salary_max: salaryMax ? parseInt(salaryMax) : null,
        preferred_locations: locs,
      }),
    })

    // Save step in local DB too
    await supabase.from('profiles').update({
      onboarding_step: 2,
      updated_at: new Date().toISOString(),
    }).eq('id', profileId)

    setSaving(false)
    setStep(2)
  }

  const saveCv = async () => {
    setSaving(true)
    await fetch('/api/onboarding/cv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_cv: rawCv }),
    })
    setSaving(false)
    setStep(3)
  }

  return (
    <main style={{ maxWidth: 560, margin: '60px auto', padding: '0 24px' }}>
      {/* Progress */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 40 }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: s <= step ? '#000' : '#e0e0e0',
          }} />
        ))}
      </div>

      {step === 1 && (
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>Tell us about yourself</h2>
          <p style={{ color: '#666', marginBottom: 32 }}>This helps us match you to the right roles.</p>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Name</label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)}
              style={inputStyle} placeholder="Joel Kinman" />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Target Roles</label>
            <input value={targetRoles} onChange={e => setTargetRoles(e.target.value)}
              style={inputStyle} placeholder="Senior Engineer, Staff Engineer, AI Engineer" />
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Min Salary (CAD)</label>
              <input type="number" value={salaryMin} onChange={e => setSalaryMin(e.target.value)}
                style={inputStyle} placeholder="150000" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Max Salary (CAD)</label>
              <input type="number" value={salaryMax} onChange={e => setSalaryMax(e.target.value)}
                style={inputStyle} placeholder="200000" />
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Preferred Locations</label>
            <input value={locations} onChange={e => setLocations(e.target.value)}
              style={inputStyle} placeholder="Vancouver, Remote (North America)" />
          </div>

          <button onClick={saveProfile} disabled={saving} style={btnStyle}>
            {saving ? 'Saving...' : 'Continue →'}
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>Paste your CV</h2>
          <p style={{ color: '#666', marginBottom: 32 }}>
            Or paste a text version of your resume. We'll parse it with AI to extract your skills and experience.
          </p>

          <textarea
            value={rawCv}
            onChange={e => setRawCv(e.target.value)}
            placeholder={`Joel Kinman\nSenior Engineer | Vancouver, BC\n\nEXPERIENCE\nHighspot — Senior Full Stack Engineer (2023-Present)\n...`}
            style={{ ...inputStyle, minHeight: 240, resize: 'vertical', fontFamily: 'monospace' }}
          />

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button onClick={() => setStep(1)} style={{ ...btnStyle, background: '#fff', color: '#000', border: '1px solid #ddd' }}>
              Back
            </button>
            <button onClick={saveCv} disabled={saving || rawCv.length < 50} style={btnStyle}>
              {saving ? 'Saving...' : 'Continue →'}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ textAlign: 'center', paddingTop: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
          <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>You're all set!</h2>
          <p style={{ color: '#666', marginBottom: 32 }}>
            Your profile is ready. We'll analyze job postings and find your best matches.
          </p>
          <button onClick={async () => {
            await supabase.from('profiles').update({
              onboarding_completed: true,
              onboarding_step: 3,
              updated_at: new Date().toISOString(),
            }).eq('id', profileId)
            router.push('/dashboard')
          }} style={btnStyle}>
            Go to Dashboard →
          </button>
        </div>
      )}
    </main>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', fontSize: 15,
  border: '1px solid #ddd', borderRadius: 8, boxSizing: 'border-box',
}

const btnStyle: React.CSSProperties = {
  padding: '12px 24px', fontSize: 16, fontWeight: 500,
  background: '#000', color: '#fff', border: 'none', borderRadius: 8,
  cursor: 'pointer', width: '100%',
}