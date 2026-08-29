import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Vetura — AI Career Intelligence',
  description: 'Evaluate job postings against your unique profile. AI-powered matching, pipeline management, strategic career insights.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}