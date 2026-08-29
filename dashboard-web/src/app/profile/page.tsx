'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ParsedCV {
  name?: string
  summary?: string
  skills?: { name: string; level?: string; years?: number }[]
  experience?: {
    company?: string
    title?: string
    start?: string
    end?: string | null
    bullets?: string[]
    ai_relevant?: boolean
  }[]
  education?: { institution?: string; degree?: string; year?: string }[]
  metadata?: { parsed_by?: string; parsed_at?: string; token_count?: number }
}

export default function ProfilePage() {
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
    if (!loading && !user) router.push('/')
  }, [loading, user, router])

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    )
  }

  const parsed = profile?.parsed_cv ? (profile.parsed_cv as ParsedCV) : null
  const hasParsed = !!parsed && !!parsed.skills

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Profile</h1>
        <div className="flex gap-2">
          {profile?.raw_cv && !hasParsed && (
            <Button onClick={() => router.push('/onboarding')} variant="outline" size="sm">
              Retry CV Parse
            </Button>
          )}
          <Button onClick={() => router.push('/dashboard')} variant="outline" size="sm">
            Dashboard
          </Button>
        </div>
      </div>

      {/* Basic Info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Basic Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="font-medium text-muted-foreground">Name</span>
              <p>{profile?.display_name || parsed?.name || '—'}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Email</span>
              <p>{profile?.email || user?.email || '—'}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Tier</span>
              <p className="capitalize">{profile?.tier || 'free'}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Evals Used</span>
              <p>{profile?.evals_used || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Target Roles */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Target Roles</CardTitle>
        </CardHeader>
        <CardContent>
          {profile?.target_roles && profile.target_roles.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {profile.target_roles.map((role: string, i: number) => (
                <span key={i} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">
                  {role.trim()}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No target roles set</p>
          )}

          {(profile?.target_salary_min || profile?.target_salary_max) && (
            <div className="mt-3 text-sm">
              <span className="font-medium text-muted-foreground">Compensation: </span>
              {profile.target_salary_min && `$${profile.target_salary_min.toLocaleString()} CAD`}
              {profile.target_salary_min && profile.target_salary_max && ' — '}
              {profile.target_salary_max && `$${profile.target_salary_max.toLocaleString()} CAD`}
            </div>
          )}

          {profile?.preferred_locations && profile.preferred_locations.length > 0 && (
            <div className="mt-1 text-sm">
              <span className="font-medium text-muted-foreground">Locations: </span>
              {profile.preferred_locations.join(', ')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CV / Parsed Data */}
      {hasParsed ? (
        <>
          {/* Summary */}
          {parsed.summary && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Professional Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{parsed.summary}</p>
              </CardContent>
            </Card>
          )}

          {/* Skills */}
          {parsed.skills && parsed.skills.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Skills ({parsed.skills.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {parsed.skills.map((skill, i) => (
                    <span
                      key={i}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        skill.level === 'expert'
                          ? 'bg-primary/10 text-primary'
                          : skill.level === 'intermediate'
                            ? 'bg-secondary text-secondary-foreground'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {skill.name}
                      {skill.years ? ` · ${skill.years}y` : ''}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Experience */}
          {parsed.experience && parsed.experience.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Experience ({parsed.experience.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {parsed.experience.map((exp, i) => (
                  <div key={i} className="border-l-2 border-border pl-4">
                    <div className="mb-1 flex items-start justify-between">
                      <div>
                        <p className="font-medium">{exp.title || 'Role'}</p>
                        <p className="text-sm text-muted-foreground">{exp.company}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {exp.ai_relevant && (
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            AI
                          </span>
                        )}
                        <span className="whitespace-nowrap text-xs text-muted-foreground">
                          {exp.start || ''} — {exp.end || 'Present'}
                        </span>
                      </div>
                    </div>
                    {exp.bullets && exp.bullets.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {exp.bullets.map((b, j) => (
                          <li key={j} className="text-sm text-muted-foreground">
                            • {b}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Education */}
          {parsed.education && parsed.education.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Education ({parsed.education.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {parsed.education.map((edu, i) => (
                  <div key={i}>
                    <p className="font-medium">{edu.degree || 'Degree'}</p>
                    <p className="text-sm text-muted-foreground">{edu.institution} · {edu.year}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card className="mb-6">
          <CardContent className="p-8 text-center">
            {profile?.raw_cv ? (
              <>
                <p className="mb-3 text-muted-foreground">CV saved but not yet parsed by AI.</p>
                <Button onClick={() => router.push('/onboarding')}>
                  Parse CV Now
                </Button>
              </>
            ) : (
              <>
                <p className="mb-3 text-muted-foreground">No CV uploaded yet.</p>
                <Button onClick={() => router.push('/onboarding')}>
                  Upload CV
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Raw CV (collapsible) */}
      {profile?.raw_cv && (
        <details className="rounded-lg border border-border">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
            Raw CV Text
          </summary>
          <pre className="max-h-96 overflow-auto border-t border-border p-4 text-xs leading-relaxed text-muted-foreground">
            {profile.raw_cv}
          </pre>
        </details>
      )}
    </main>
  )
}