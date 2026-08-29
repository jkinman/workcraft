import { NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route-client'
import { z } from 'zod'
import type { NextRequest } from 'next/server'

const profileSchema = z.object({
  display_name: z.string().min(1, 'Display name is required'),
  target_roles: z.array(z.string()).optional().default([]),
  target_salary_min: z.number().positive().nullable().optional(),
  target_salary_max: z.number().positive().nullable().optional(),
  preferred_locations: z.array(z.string()).optional().default([]),
})

export async function POST(request: NextRequest) {
  const { client } = await createRouteClient(request)

  const { data: { user } } = await client.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = profileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { display_name, target_roles, target_salary_min, target_salary_max, preferred_locations } = parsed.data

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