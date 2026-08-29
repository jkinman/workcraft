'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

type EmailFormData = z.infer<typeof emailSchema>

export default function Home() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.push('/dashboard')
    })
  }, [])

  const handleSignIn = async (data: EmailFormData) => {
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithOtp({
      email: data.email,
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
    <main className="mx-auto max-w-md px-6 pt-32 text-center">
      <h1 className="mb-2 text-4xl font-bold">Vetura</h1>
      <p className="mb-10 text-lg text-muted-foreground">
        AI-powered career intelligence. <br />
        Match your profile to the right roles.
      </p>

      <form onSubmit={handleSubmit(handleSignIn)} className="mb-5">
        <Input
          type="email"
          placeholder="you@company.com"
          {...register('email')}
          className="mb-3"
        />
        {errors.email && (
          <p className="mb-2 text-sm text-destructive">{errors.email.message}</p>
        )}
        <Button
          type="submit"
          disabled={loading}
          className="w-full"
          size="lg"
        >
          {loading ? 'Sending...' : 'Send Magic Link'}
        </Button>
      </form>

      <div className="mb-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-sm text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button
        onClick={handleGoogleSignIn}
        disabled={loading}
        variant="outline"
        className="w-full"
        size="lg"
      >
        Continue with Google
      </Button>

      {message && (
        <p className="mt-5 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
          {message}
        </p>
      )}
    </main>
  )
}