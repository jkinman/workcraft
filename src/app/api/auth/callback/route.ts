import { NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route-client'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { client, response } = await createRouteClient(request)

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/onboarding'

  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  return NextResponse.redirect(new URL('/?error=auth', request.url))
}