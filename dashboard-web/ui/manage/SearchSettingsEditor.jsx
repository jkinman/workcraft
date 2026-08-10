'use client';

import { EditorForm } from './EditorForm';

export function SearchSettingsEditor({ initialContent }) {
  return (
    <EditorForm
      endpoint="/api/manage/portals"
      initialContent={initialContent}
      label="portals.yml — title filters, search queries, tracked companies"
      placeholder="title_filter:\n  positive:\n    - ..."
      saveLabel="SAVE_SEARCH_SETTINGS"
    />
  );
}
