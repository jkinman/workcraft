import type { Metadata } from 'next'
import './globals.css'
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { QueryProvider } from '@/lib/providers'

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="m-0 bg-background text-foreground antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}