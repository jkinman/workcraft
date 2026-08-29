import { NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route-client'
import { extractTextFromFile } from '@/lib/file-parser'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const { client } = await createRouteClient(request)

  const { data: { user } } = await client.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Validate file size (10MB limit)
  const MAX_SIZE = 10 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
  }

  // Validate file type
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/rtf',
  ]

  // Allow fallback RTF detection based on file extension
  const extension = file.name.split('.').pop()?.toLowerCase()
  let mimeType = file.type

  if (!mimeType || mimeType === 'application/octet-stream') {
    // Infer from extension
    if (extension === 'pdf') mimeType = 'application/pdf'
    else if (extension === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    else if (extension === 'txt') mimeType = 'text/plain'
    else if (extension === 'rtf') mimeType = 'text/rtf'
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const text = await extractTextFromFile(buffer, mimeType)

    return NextResponse.json({
      text,
      filename: file.name,
      fileType: mimeType,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse file'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}