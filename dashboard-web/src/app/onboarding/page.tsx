'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

const profileSchema = z.object({
  displayName: z.string().min(1, 'Name is required'),
  targetRoles: z.string().min(1, 'At least one target role is required'),
  salaryMin: z.string().optional(),
  salaryMax: z.string().optional(),
  locations: z.string().optional(),
})

type ProfileFormData = z.infer<typeof profileSchema>

const cvSchema = z.object({
  rawCv: z.string().min(50, 'CV must be at least 50 characters'),
})

type CvFormData = z.infer<typeof cvSchema>

export default function Onboarding() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [profileId, setProfileId] = useState('')

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: '',
      targetRoles: '',
      salaryMin: '',
      salaryMax: '',
      locations: '',
    },
  })

  const cvForm = useForm<CvFormData>({
    resolver: zodResolver(cvSchema),
    defaultValues: {
      rawCv: '',
    },
  })

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) router.push('/')

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

  const saveProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const roles = data.targetRoles.split(',').map(s => s.trim()).filter(Boolean)
      const locs = (data.locations || '').split(',').map(s => s.trim()).filter(Boolean)

      const res = await fetch('/api/onboarding/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: data.displayName,
          target_roles: roles,
          target_salary_min: data.salaryMin ? Number(data.salaryMin) : null,
          target_salary_max: data.salaryMax ? Number(data.salaryMax) : null,
          preferred_locations: locs,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save profile')
      }

      await supabase.from('profiles').update({
        onboarding_step: 2,
        updated_at: new Date().toISOString(),
      }).eq('id', profileId)
    },
    onSuccess: () => {
      setStep(2)
    },
  })

  const saveCvMutation = useMutation({
    mutationFn: async (data: CvFormData) => {
      const res = await fetch('/api/onboarding/cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_cv: data.rawCv }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save CV')
      }
    },
    onSuccess: () => {
      setStep(3)
    },
  })

  const handleComplete = useCallback(async () => {
    await supabase.from('profiles').update({
      onboarding_completed: true,
      onboarding_step: 3,
      updated_at: new Date().toISOString(),
    }).eq('id', profileId)
    router.push('/dashboard')
  }, [supabase, profileId, router])

  return (
    <main className="mx-auto max-w-lg px-6 pt-16">
      {/* Progress bar */}
      <div className="mb-10 flex gap-2">
        {[1, 2, 3].map(s => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${
              s <= step ? 'bg-foreground' : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {step === 1 && (
        <div>
          <h2 className="mb-1 text-2xl font-semibold">Tell us about yourself</h2>
          <p className="mb-8 text-muted-foreground">This helps us match you to the right roles.</p>

          <form onSubmit={profileForm.handleSubmit((data) => saveProfileMutation.mutate(data))}>
            <div className="mb-5">
              <Label htmlFor="displayName" className="mb-1.5 block font-medium">Name</Label>
              <Input id="displayName" placeholder="Joel Kinman" {...profileForm.register('displayName')} />
              {profileForm.formState.errors.displayName && (
                <p className="mt-1 text-sm text-destructive">{profileForm.formState.errors.displayName.message}</p>
              )}
            </div>

            <div className="mb-5">
              <Label htmlFor="targetRoles" className="mb-1.5 block font-medium">Target Roles</Label>
              <Input id="targetRoles" placeholder="Senior Engineer, Staff Engineer, AI Engineer" {...profileForm.register('targetRoles')} />
              {profileForm.formState.errors.targetRoles && (
                <p className="mt-1 text-sm text-destructive">{profileForm.formState.errors.targetRoles.message}</p>
              )}
            </div>

            <div className="mb-5 flex gap-3">
              <div className="flex-1">
                <Label htmlFor="salaryMin" className="mb-1.5 block font-medium">Min Salary (CAD)</Label>
                <Input id="salaryMin" type="number" placeholder="150000" {...profileForm.register('salaryMin')} />
              </div>
              <div className="flex-1">
                <Label htmlFor="salaryMax" className="mb-1.5 block font-medium">Max Salary (CAD)</Label>
                <Input id="salaryMax" type="number" placeholder="200000" {...profileForm.register('salaryMax')} />
              </div>
            </div>

            <div className="mb-8">
              <Label htmlFor="locations" className="mb-1.5 block font-medium">Preferred Locations</Label>
              <Input id="locations" placeholder="Vancouver, Remote (North America)" {...profileForm.register('locations')} />
            </div>

            <Button type="submit" disabled={saveProfileMutation.isPending} className="w-full" size="lg">
              {saveProfileMutation.isPending ? 'Saving...' : 'Continue →'}
            </Button>

            {saveProfileMutation.isError && (
              <p className="mt-3 text-sm text-destructive">
                {saveProfileMutation.error?.message || 'Something went wrong'}
              </p>
            )}
          </form>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="mb-1 text-2xl font-semibold">Paste your CV</h2>
          <p className="mb-8 text-muted-foreground">
            Or paste a text version of your resume. We&apos;ll parse it with AI to extract your skills and experience.
          </p>

          <form onSubmit={cvForm.handleSubmit((data) => saveCvMutation.mutate(data))}>
            <textarea
              {...cvForm.register('rawCv')}
              placeholder={`Joel Kinman\nSenior Engineer | Vancouver, BC\n\nEXPERIENCE\nHighspot — Senior Full Stack Engineer (2023-Present)\n...`}
              className="w-full min-h-[240px] resize-y rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            {cvForm.formState.errors.rawCv && (
              <p className="mt-1 text-sm text-destructive">{cvForm.formState.errors.rawCv.message}</p>
            )}

            <div className="mt-6 flex gap-3">
              <Button type="button" variant="outline" onClick={() => setStep(1)} size="lg" className="flex-1">
                Back
              </Button>
              <Button type="submit" disabled={saveCvMutation.isPending} size="lg" className="flex-1">
                {saveCvMutation.isPending ? 'Saving...' : 'Continue →'}
              </Button>
            </div>

            {saveCvMutation.isError && (
              <p className="mt-3 text-sm text-destructive">
                {saveCvMutation.error?.message || 'Something went wrong'}
              </p>
            )}
          </form>
        </div>
      )}

      {step === 3 && (
        <div className="pt-10 text-center">
          <div className="mb-4 text-5xl">🎉</div>
          <h2 className="mb-2 text-2xl font-semibold">You&apos;re all set!</h2>
          <p className="mb-8 text-muted-foreground">
            Your profile is ready. We&apos;ll analyze job postings and find your best matches.
          </p>
          <Button onClick={handleComplete} size="lg" className="w-full">
            Go to Dashboard →
          </Button>
        </div>
      )}
    </main>
  )
}