import { NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route-client'
import { parseCV, hashCV } from '@/lib/cv-parser'
import { z } from 'zod'
import type { NextRequest } from 'next/server'

const cvSchema = z.object({
  raw_cv: z.string().min(50, 'CV must be at least 50 characters'),
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

  const parsed = cvSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { raw_cv } = parsed.data

  // 1. Store raw CV + hash immediately
  const cvHash = hashCV(raw_cv)
  const { error: storeError } = await client
    .from('profiles')
    .update({
      raw_cv,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (storeError) {
    return NextResponse.json({ error: storeError.message }, { status: 500 })
  }

  // 2. Parse CV with LLM
  const { parsed_cv, token_count, cost_usd } = await parseCV(raw_cv)

  if (!parsed_cv) {
    // Raw CV is saved — parsing failed but user can retry
    return NextResponse.json({
      success: true,
      raw_saved: true,
      parsed: false,
      message: 'CV saved. AI parsing failed — you can retry.',
    })
  }

  // 3. Store parsed CV
  const { error: parseError } = await client
    .from('profiles')
    .update({
      parsed_cv: parsed_cv as any,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  // 4. Log usage
  await client.from('usage_log').insert({
    user_id: user.id,
    action: 'cv_parse',
    model: 'claude-haiku-4.5',
    token_count,
    cost_usd,
  })

  if (parseError) {
    return NextResponse.json({ error: parseError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    raw_saved: true,
    parsed: true,
    profile_hash: cvHash,
    skills_count: parsed_cv.skills?.length || 0,
    experience_count: parsed_cv.experience?.length || 0,
    cost_usd,
  })
}

export async function GET(request: NextRequest) {
  const { client } = await createRouteClient(request)

  const { data: { user } } = await client.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await client
    .from('profiles')
    .select('raw_cv, parsed_cv')
    .eq('id', user.id)
    .single()

  return NextResponse.json({
    has_raw: !!profile?.raw_cv,
    has_parsed: !!profile?.parsed_cv,
    parsed_cv: profile?.parsed_cv,
  })
}