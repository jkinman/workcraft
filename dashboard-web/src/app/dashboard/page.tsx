'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function Dashboard() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push('/')
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(data)
      setLoading(false)
    })
  }, [])

  // Redirect to onboarding if not completed
  useEffect(() => {
    if (!loading && profile && !profile.onboarding_completed) {
      router.push('/onboarding')
    }
  }, [loading, profile])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const completeOnboarding = async () => {
    await supabase
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', profile.id)
    setProfile({ ...profile, onboarding_completed: true })
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
        <p style={{ color: '#666' }}>Loading...</p>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          Vetura
        </h1>
        <button onClick={handleSignOut} style={{
          padding: '8px 16px', fontSize: 14,
          background: 'none', border: '1px solid #ddd', borderRadius: 6,
          cursor: 'pointer',
        }}>
          Sign out
        </button>
      </div>

      {profile && (
        <div style={{ marginBottom: 32, padding: 20, background: '#f9f9f9', borderRadius: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px' }}>
            Welcome, {profile.display_name || 'there'} 👋
          </h2>
          <p style={{ color: '#666', margin: 0, fontSize: 14 }}>
            {profile.target_roles?.length > 0
              ? `Targeting: ${profile.target_roles.join(', ')}`
              : 'Set your target roles in onboarding'}
            {profile.target_salary_min && ` · $${profile.target_salary_min.toLocaleString()}+ CAD`}
          </p>
        </div>
      )}

      <div style={{
        padding: 40, textAlign: 'center',
        border: '2px dashed #ddd', borderRadius: 12,
      }}>
        <p style={{ fontSize: 18, color: '#999', marginBottom: 8 }}>
          Your pipeline is empty
        </p>
        <p style={{ color: '#bbb', margin: 0, fontSize: 14 }}>
          Scan job boards or add jobs manually to get started.
          Evaluation engine coming next.
        </p>
      </div>
    </main>
  )
}