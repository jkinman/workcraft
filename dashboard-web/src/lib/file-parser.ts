import { Buffer } from 'buffer'

/**
 * Extract text from uploaded file buffers.
 * Supports PDF, DOCX, TXT, and RTF.
 */
export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
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
      // mammoth doesn't ship its own types, but has a stable API
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
      // Fallback: detect RTF by content signature
      const text = buffer.toString('utf-8')
      if (text.startsWith('{\\rtf')) {
        return stripRtf(text)
      }
      throw new Error(`Unsupported file type: ${mimeType}`)
    }
  }
}

/**
 * Strip RTF control codes from raw RTF text, leaving plain text content.
 */
function stripRtf(rtf: string): string {
  let result = rtf

  // Remove font table, color table, stylesheet, and other RTF groups
  result = result.replace(/\{\\fonttbl[^}]*\}/g, '')
  result = result.replace(/\{\\colortbl[^}]*\}/g, '')
  result = result.replace(/\{\\stylesheet[^}]*\}/g, '')
  result = result.replace(/\{\\generator[^}]*\}/g, '')
  result = result.replace(/\{\\info[^}]*\}/g, '')
  result = result.replace(/\{\\mmathPr[^}]*\}/g, '')

  // Remove control words with optional numeric argument (e.g. \fs24, \par)
  result = result.replace(/\\[a-z]+[-]?\d*/g, '')

  // Remove curly braces that are part of RTF grouping
  result = result.replace(/[{}]/g, '')

  // Remove backslash-prefixed symbols like \'e9 (escaped chars)
  result = result.replace(/\\'[0-9a-fA-F]{2}/g, '')

  // Remove lone backslashes
  result = result.replace(/\\/g, '')

  // Convert multiple consecutive newlines into single newlines
  result = result.replace(/\n{3,}/g, '\n\n')

  // Trim whitespace
  result = result.trim()

  return result
}