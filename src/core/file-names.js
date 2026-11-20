// File names of exports: the loaded image's name with another extension. Pure.

/** The base name used when the image name has none (e.g. '.png' or ''). */
export const FALLBACK_BASE_NAME = 'pattern';

/**
 * The file name without its last extension: 'cat.png' → 'cat', 'cat.photo.png' → 'cat.photo',
 * 'cat' → 'cat'; a name that is empty or only an extension ('', '.png', '  .jpg') → 'pattern'.
 */
export function baseFileName(fileName) {
  const dot = fileName.lastIndexOf('.');
  const base = dot === -1 ? fileName : fileName.slice(0, dot);
  return base.trim() === '' ? FALLBACK_BASE_NAME : base;
}

/** The export file name for an image: exportFileName('cat.png', 'pdf') → 'cat.pdf'. */
export function exportFileName(fileName, extension) {
  return `${baseFileName(fileName)}.${extension}`;
}
