/**
 * Import-safe Markdown tracker row formatting primitives.
 */

export function rebuildRow(parts) {
  const cells = parts.slice(1);
  if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
  return `| ${cells.join(' | ')} |`;
}

export function cell(value) {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s*\|\s*/g, ' / ')
    .trim();
}
