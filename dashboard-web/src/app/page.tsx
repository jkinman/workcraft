'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function Home() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.push('/dashboard')
    })
  }, [])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Check your email for the magic link!')
    }
    setLoading(false)
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })
    setLoading(false)
  }

  return (
    <main style={{ maxWidth: 480, margin: '120px auto', padding: '0 24px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 36, fontWeight: 700, marginBottom: 8 }}>Vetura</h1>
      <p style={{ color: '#666', marginBottom: 40, fontSize: 18 }}>
        AI-powered career intelligence. <br />
        Match your profile to the right roles.
      </p>

      <form onSubmit={handleSignIn} style={{ marginBottom: 20 }}>
        <input
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: '100%', padding: '12px 16px', fontSize: 16,
            border: '1px solid #ddd', borderRadius: 8, marginBottom: 12,
            boxSizing: 'border-box',
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', padding: '12px', fontSize: 16,
            background: '#000', color: '#fff', border: 'none',
            borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Sending...' : 'Send Magic Link'}
        </button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, height: 1, background: '#ddd' }} />
        <span style={{ color: '#999' }}>or</span>
        <div style={{ flex: 1, height: 1, background: '#ddd' }} />
      </div>

      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        style={{
          width: '100%', padding: '12px', fontSize: 16,
          background: '#fff', color: '#000', border: '1px solid #ddd',
          borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        Continue with Google
      </button>

      {message && (
        <p style={{ marginTop: 20, padding: 12, background: '#f5f5f5', borderRadius: 8, fontSize: 14 }}>
          {message}
        </p>
      )}
    </main>
  )
}