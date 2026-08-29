import { type NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route-client'

export async function middleware(request: NextRequest) {
  const { client, response } = await createRouteClient(request)

  // Refresh session — if expired, cookie is cleared
  const { data: { user } } = await client.auth.getUser()

  const path = request.nextUrl.pathname

  // Protected routes redirect to login
  const protectedPaths = ['/dashboard', '/onboarding', '/api/protected']
  const isProtected = protectedPaths.some(p => path.startsWith(p))

  if (isProtected && !user) {
    const loginUrl = new URL('/', request.url)
    loginUrl.searchParams.set('signin', 'true')
    return Response.redirect(loginUrl)
  }

  // Already logged in, redirect from landing to dashboard
  if (path === '/' && user) {
    return Response.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}