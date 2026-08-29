'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

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
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex h-8 items-center justify-center rounded-lg border border-transparent bg-clip-padding px-2.5 text-sm font-medium whitespace-nowrap transition-all outline-none select-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px"
          >
            {profile?.display_name || 'Menu'}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push('/profile')}>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut} variant="destructive">
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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

          {profile.raw_cv && !profile.parsed_cv && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800/30 dark:bg-amber-950/20">
              <p className="mb-2 text-amber-800 dark:text-amber-300">
                CV saved but AI parsing failed.
              </p>
              <Button
                onClick={() => router.push('/onboarding')}
                variant="outline"
                size="sm"
              >
                Retry CV Parsing
              </Button>
            </div>
          )}

          {!profile.raw_cv && (
            <div className="mt-4">
              <Button
                onClick={() => router.push('/onboarding')}
                variant="outline"
                size="sm"
              >
                Complete Onboarding
              </Button>
            </div>
          )}
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