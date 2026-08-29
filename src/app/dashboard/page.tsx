'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Dashboard() {
  const router = useRouter()
  const supabase = createClient()

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['auth.user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser()
      return data.user
    },
  })

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      if (!user) return null
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      return data
    },
    enabled: !!user,
  })

  const loading = userLoading || profileLoading

  useEffect(() => {
    if (!loading && !user) {
      router.push('/')
    }
  }, [loading, user, router])

  useEffect(() => {
    if (!loading && profile && !profile.onboarding_completed) {
      router.push('/onboarding')
    }
  }, [loading, profile, router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="m-0 text-2xl font-bold">Vetura</h1>
        <Button onClick={handleSignOut} variant="outline" size="sm">
          Sign out
        </Button>
      </div>

      {profile && (
        <div className="mb-8 rounded-xl bg-muted p-5">
          <h2 className="m-0 mb-1 text-lg font-semibold">
            Welcome, {profile.display_name || 'there'} 👋
          </h2>
          <p className="m-0 text-sm text-muted-foreground">
            {profile.target_roles?.length > 0
              ? `Targeting: ${profile.target_roles.join(', ')}`
              : 'Set your target roles in onboarding'}
            {profile.target_salary_min && ` · $${profile.target_salary_min.toLocaleString()}+ CAD`}
          </p>
        </div>
      )}

      <div className="rounded-xl border-2 border-dashed border-border p-10 text-center">
        <p className="mb-2 text-lg text-muted-foreground">
          Your pipeline is empty
        </p>
        <p className="m-0 text-sm text-muted-foreground/70">
          Scan job boards or add jobs manually to get started.
          Evaluation engine coming next.
        </p>
      </div>
    </main>
  )
}