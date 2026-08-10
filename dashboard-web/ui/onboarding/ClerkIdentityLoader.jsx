'use client';

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

export function ClerkIdentityLoader({ onIdentity }) {
  const { isLoaded, isSignedIn, user } = useUser();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    onIdentity({
      fullName: user.fullName || '',
      email: user.primaryEmailAddress?.emailAddress || ''
    });
  }, [isLoaded, isSignedIn, user, onIdentity]);

  return null;
}
