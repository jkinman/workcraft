'use client';

import { EditorForm } from './EditorForm';

export function ProfileEditor({ initialContent }) {
  return (
    <EditorForm
      endpoint="/api/manage/profile"
      initialContent={initialContent}
      label="config/profile.yml — candidate, target roles, narrative, compensation, location"
      placeholder="candidate:\n  full_name: ..."
      saveLabel="SAVE_PROFILE"
    />
  );
}
