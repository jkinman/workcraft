import { NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route-client'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const { client } = await createRouteClient(request)

  const { data: { user } } = await client.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { display_name, target_roles, target_salary_min, target_salary_max, preferred_locations } = body

  const { data, error } = await client
    .from('profiles')
    .update({
      display_name: display_name ?? undefined,
      target_roles: target_roles ?? [],
      target_salary_min: target_salary_min ?? null,
      target_salary_max: target_salary_max ?? null,
      preferred_locations: preferred_locations ?? [],
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profile: data })
}