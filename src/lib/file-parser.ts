import { Buffer } from 'buffer'

/**
 * Extract text from uploaded file buffers.
 * Supports PDF, DOCX, TXT, and RTF.
 */
export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  try {
    switch (mimeType) {
      case 'application/pdf': {
        const { PDFParse } = await import('pdf-parse')
        const parser = new PDFParse({ data: buffer })
        try {
          const result = await parser.getText()
          return result.text
        } finally {
          await parser.destroy()
        }
      }

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
        const mammoth = await import('mammoth') as typeof import('mammoth')
        const result = await mammoth.extractRawText({ buffer })
        return result.value
      }

      case 'text/plain': {
        return buffer.toString('utf-8')
      }

      case 'text/rtf': {
        const text = buffer.toString('utf-8')
        return stripRtf(text)
      }

      default: {
        const text = buffer.toString('utf-8')
        if (text.startsWith('{\\rtf')) {
          return stripRtf(text)
        }
        throw new Error(`Unsupported file type: ${mimeType}`)
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`File extraction failed: ${msg}`)
  }
}

function stripRtf(rtf: string): string {
  let result = rtf

  // Remove all RTF groups { keyword ... }
  result = result.replace(/\{[^{}]*\}/g, ' ')

  // Strip control words: \pard, \fs24, \par, etc.
  result = result.replace(/\\[a-z0-9]+-?[0-9]*/gi, '')

  // Strip hex escapes like \'e9
  result = result.replace(/\\'[0-9a-f]{2}/gi, '')

  // Remove remaining backslashes that aren't \n
  result = result.replace(/\\(?!n)/g, '')

  // Collapse multiple whitespace chars
  result = result.replace(/[ \t]+/g, ' ')

  // Normalize newlines
  result = result.replace(/\n{3,}/g, '\n\n')
  result = result.replace(/^[ \t]*\n/gm, '\n')

  return result.trim()
}

