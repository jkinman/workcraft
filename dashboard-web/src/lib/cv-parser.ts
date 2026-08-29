import { createClient } from '@/lib/supabase/server'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

interface ParsedCV {
  name: string
  summary: string
  skills: { name: string; level: string; years: number }[]
  experience: {
    company: string
    title: string
    start: string
    end: string | null
    bullets: string[]
    ai_relevant: boolean
  }[]
  education: { institution: string; degree: string; year: string }[]
  metadata: { parsed_by: string; parsed_at: string; token_count: number }
}

const EXTRACT_PROMPT = `You are a CV parser. Extract structured data from the CV text below.

Return valid JSON with these fields:
{
  "name": "Full name",
  "summary": "2-3 sentence professional summary",
  "skills": [
    {"name": "Skill name", "level": "beginner|intermediate|expert", "years": 5}
  ],
  "experience": [
    {
      "company": "Company name",
      "title": "Job title",
      "start": "YYYY-MM" or "YYYY",
      "end": "YYYY-MM" or "YYYY" or null,
      "bullets": ["bullet point 1", "bullet point 2"],
      "ai_relevant": true (if role involved AI/ML/data/automation)
    }
  ],
  "education": [
    {"institution": "School name", "degree": "Degree name", "year": "YYYY"}
  ]
}

Extract ALL skills mentioned. For AI-relevant experience, set ai_relevant=true for roles that involve machine learning, AI, data science, automation, or LLMs.

Respond with ONLY the JSON. No markdown, no explanation.`

export async function parseCV(rawCv: string): Promise<{
  parsed_cv: ParsedCV | null
  token_count: number
  cost_usd: number
}> {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://vetura.app',
      'X-Title': 'Vetura',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-haiku-4.5',
      messages: [
        { role: 'system', content: EXTRACT_PROMPT },
        { role: 'user', content: rawCv.slice(0, 8000) },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('OpenRouter CV parse failed:', response.status, errorText)
    return { parsed_cv: null, token_count: 0, cost_usd: 0 }
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''
  const usage = data.usage || {}

  // Parse JSON from response (handle markdown-wrapped JSON)
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error('No JSON found in CV parse response')
    return { parsed_cv: null, token_count: usage.total_tokens || 0, cost_usd: 0 }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return {
      parsed_cv: parsed,
      token_count: usage.total_tokens || 0,
      cost_usd: (usage.total_tokens || 0) * 0.0000015, // Haiku ~$1.50/M tokens
    }
  } catch (e) {
    console.error('Failed to parse CV JSON:', e)
    return { parsed_cv: null, token_count: usage.total_tokens || 0, cost_usd: 0 }
  }
}

// Helper: generate a hash of the CV for version tracking
export function hashCV(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit int
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}