'use client';

import { EditorForm } from './EditorForm';

export function StrategyEditor({ initialContent }) {
  return (
    <EditorForm
      endpoint="/api/manage/strategy"
      initialContent={initialContent}
      label="modes/_profile.md — archetypes, narrative, negotiation scripts, location policy"
      placeholder="# User Profile Context..."
      saveLabel="SAVE_STRATEGY"
    />
  );
}
