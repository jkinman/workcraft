'use client'

import { Suspense } from 'react'
import OnboardingInner from './onboarding-inner'

export default function Onboarding() {
  return (
    <Suspense fallback={
      <main className="mx-auto max-w-lg px-6 pt-16">
        <div className="mb-10 flex gap-2">
          {[1, 2, 3].map(s => (
            <div key={s} className="h-1 flex-1 rounded-full bg-muted" />
          ))}
        </div>
        <p className="text-center text-muted-foreground">Loading...</p>
      </main>
    }>
      <OnboardingInner />
    </Suspense>
  )
}