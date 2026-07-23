/**
 * Pure reusable filename sanitizer.
 * Removes path traversal, directory paths, normalizes unsafe characters,
 * preserves a safe extension, prevents empty filenames, and limits length.
 */
export function sanitizeFilename(rawFilename: string): string {
  if (!rawFilename) {
    return 'unnamed_asset';
  }

  // 1. Remove directory components (everything up to the last slash/backslash)
  let clean = rawFilename.replace(/^.*[\\\/]/, '');

  // 2. Remove path traversal patterns
  clean = clean.replace(/\.\.+[\\\/]/g, '');
  clean = clean.replace(/\.\./g, '');

  // 3. Separate extension and base name
  const lastDotIndex = clean.lastIndexOf('.');
  let baseName = lastDotIndex !== -1 ? clean.slice(0, lastDotIndex) : clean;
  let ext = lastDotIndex !== -1 ? clean.slice(lastDotIndex + 1) : '';

  // 4. Normalize base name and extension to safe characters (a-z, A-Z, 0-9, dash, underscore, dot)
  baseName = baseName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  ext = ext.replace(/[^a-zA-Z0-9\-_]/g, '');

  // 5. Trim leading/trailing dots/spaces/dashes/underscores
  baseName = baseName.trim().replace(/^[._\-]+|[._\-]+$/g, '');
  ext = ext.trim().replace(/^[._\-]+|[._\-]+$/g, '');

  // 6. Enforce fallbacks for empty names/extensions
  if (!baseName) {
    baseName = 'unnamed_asset';
  }

  // 7. Enforce maximum length (e.g. 120 chars for base, 10 chars for extension)
  if (baseName.length > 120) {
    baseName = baseName.slice(0, 120);
  }
  if (ext.length > 10) {
    ext = ext.slice(0, 10);
  }

  return ext ? `${baseName}.${ext}` : baseName;
}

/**
 * Derives a clean and safe display name from a sanitized filename.
 */
export function deriveDisplayName(sanitizedFilename: string): string {
  const lastDot = sanitizedFilename.lastIndexOf('.');
  const base = lastDot !== -1 ? sanitizedFilename.slice(0, lastDot) : sanitizedFilename;
  return base || 'Unnamed Asset';
}
