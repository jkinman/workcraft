/**
 * Tracker row mutation primitives — shared by set-status.mjs and hosted transitions.
 */

import { rebuildRow, cell } from './row-format.mjs';

/**
 * Apply a canonical status/note mutation to one parsed tracker row.
 *
 * @param {object} params
 * @param {string[]} params.lines - Full tracker file lines (mutated in place on write path).
 * @param {object} params.target - Parsed row incl. lineIdx, status, num, company, role.
 * @param {Record<string, number>} params.colmap
 * @param {string} params.newStatus - Canonical label.
 * @param {string|null} [params.note]
 * @returns {{ changed: boolean, statusChanged: boolean, noteChanged: boolean, oldStatus: string, lines: string[] }}
 */
export function applyTrackerRowMutation({ lines, target, colmap, newStatus, note = null }) {
  const oldStatus = target.status;
  const parts = lines[target.lineIdx].split('|').map(s => s.trim());
  while (parts.length <= Math.max(colmap.status, colmap.notes ?? 0)) parts.push('');

  const statusChanged = parts[colmap.status] !== newStatus;
  parts[colmap.status] = newStatus;

  let noteChanged = false;
  const sanitizedNote = note != null ? cell(note) : null;
  if (sanitizedNote) {
    if (colmap.notes == null) {
      const err = new Error('Tracker has no Notes column — cannot apply note');
      err.code = 'no-notes-column';
      throw err;
    }
    const existing = parts[colmap.notes] ?? '';
    const hasNote = existing === sanitizedNote
      || existing.startsWith(`${sanitizedNote}; `)
      || existing.endsWith(`; ${sanitizedNote}`)
      || existing.includes(`; ${sanitizedNote}; `);
    if (!hasNote) {
      parts[colmap.notes] = existing && existing !== '—' && existing !== '-'
        ? `${existing}; ${sanitizedNote}`
        : sanitizedNote;
      noteChanged = true;
    }
  }

  const changed = statusChanged || noteChanged;
  if (changed) {
    lines[target.lineIdx] = rebuildRow(parts);
  }

  return { changed, statusChanged, noteChanged, oldStatus, lines };
}
