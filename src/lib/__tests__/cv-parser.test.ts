import { describe, it, expect } from 'vitest'
import { hashCV } from '../cv-parser'

describe('hashCV', () => {
  it('returns a consistent hash for the same text', () => {
    const cv = 'Joel Kinman - Senior Engineer with 10 years experience'
    expect(hashCV(cv)).toBe(hashCV(cv))
  })

  it('returns different hashes for different texts', () => {
    const h1 = hashCV('Joel Kinman - Senior Engineer')
    const h2 = hashCV('Jane Doe - Junior Developer')
    expect(h1).not.toBe(h2)
  })

  it('returns an 8-character hex string', () => {
    const hash = hashCV('Test CV content here')
    expect(hash).toMatch(/^[0-9a-f]{8}$/)
  })
})

describe('cv-parser API contract', () => {
  it('the parseCV function signature is stable', () => {
    const fs = require('fs')
    const content = fs.readFileSync('src/lib/cv-parser.ts', 'utf-8')
    expect(content).toContain('export async function parseCV')
    expect(content).toContain('export function hashCV')
    expect(content).toContain('parsed_cv: ParsedCV | null')
    expect(content).toContain('token_count: number')
    expect(content).toContain('cost_usd: number')
  })

  it('prompt instructs JSON-only response with low temperature', () => {
    const fs = require('fs')
    const content = fs.readFileSync('src/lib/cv-parser.ts', 'utf-8')
    expect(content).toContain('Respond with ONLY the JSON')
    expect(content).toContain('temperature: 0.1')
    expect(content).toContain('max_tokens: 4000')
  })
})