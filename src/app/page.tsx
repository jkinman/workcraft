'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

const emailPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type EmailPasswordData = z.infer<typeof emailPasswordSchema>

export default function Home() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const router = useRouter()
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailPasswordData>({
    resolver: zodResolver(emailPasswordSchema),
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.push('/dashboard')
    })
  }, [])

  const handleEmailAuth = async (data: EmailPasswordData) => {
    setLoading(true)
    setMessage('')

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })
      if (error) {
        setMessage(error.message)
      } else {
        setMessage('Account created! Check your email to confirm sign-up.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })
      if (error) {
        setMessage(error.message)
      } else {
        router.push('/dashboard')
      }
    }
    setLoading(false)
  }

  const handleMagicLink = async () => {
    setLoading(true)
    setMessage('')

    // Prompt for email via a simple approach — use the form email value
    const email = (document.querySelector('input[type="email"]') as HTMLInputElement)?.value
    if (!email) {
      setMessage('Enter your email address first')
      setLoading(false)
      return
    }

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
    <main className="mx-auto max-w-md px-6 pt-24 text-center">
      <h1 className="mb-2 text-4xl font-bold">Vetura</h1>
      <p className="mb-8 text-lg text-muted-foreground">
        AI-powered career intelligence. <br />
        Match your profile to the right roles.
      </p>

      {/* Email / Password Sign In or Sign Up */}
      <Tabs defaultValue="signin" onValueChange={(v: string) => setMode(v as 'signin' | 'signup')}>
        <TabsList className="mb-6 w-full">
          <TabsTrigger value="signin" className="flex-1">Sign In</TabsTrigger>
          <TabsTrigger value="signup" className="flex-1">Sign Up</TabsTrigger>
        </TabsList>

        <TabsContent value="signin">
          <form onSubmit={handleSubmit(handleEmailAuth)} className="space-y-3">
            <Input
              type="email"
              placeholder="you@company.com"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-left text-sm text-destructive">{errors.email.message}</p>
            )}
            <Input
              type="password"
              placeholder="Password"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-left text-sm text-destructive">{errors.password.message}</p>
            )}
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="signup">
          <form onSubmit={handleSubmit(handleEmailAuth)} className="space-y-3">
            <Input
              type="email"
              placeholder="you@company.com"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-left text-sm text-destructive">{errors.email.message}</p>
            )}
            <Input
              type="password"
              placeholder="Password (6+ characters)"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-left text-sm text-destructive">{errors.password.message}</p>
            )}
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      <div className="mb-5 mt-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-sm text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="space-y-3">
        <Button
          onClick={handleMagicLink}
          disabled={loading}
          variant="outline"
          className="w-full"
          size="lg"
        >
          Send Magic Link
        </Button>

        <Button
          onClick={handleGoogleSignIn}
          disabled={loading}
          variant="outline"
          className="w-full"
          size="lg"
        >
          Continue with Google
        </Button>
      </div>

      {message && (
        <p className="mt-5 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
          {message}
        </p>
      )}
    </main>
  )
}