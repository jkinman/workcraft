'use client';

import { SignInButton, SignOutButton, UserButton, useUser } from '@clerk/nextjs';

export function AuthControls() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return null;

  return (
    <div className="auth-controls">
      {isSignedIn ? (
        <>
        <UserButton />
        <SignOutButton>
          <button className="btn" type="button">sign_out</button>
        </SignOutButton>
        </>
      ) : (
        <SignInButton mode="modal">
          <button className="btn" type="button">sign_in</button>
        </SignInButton>
      )}
    </div>
  );
}
