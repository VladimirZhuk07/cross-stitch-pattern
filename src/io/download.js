// Saves a Blob as a file on the user's device through a temporary object URL and an <a download>.
// Nothing is uploaded: the URL points to memory of this page.

const REVOKE_DELAY_MS = 60_000;

/**
 * Starts the browser download of blob under fileName.
 * blob      the file content (e.g. a PDF, XLSX or .stitch Blob)
 * fileName  the suggested file name, e.g. 'cat.pdf'
 * doc       the document (default globalThis.document)
 */
export function downloadBlob(blob, fileName, doc = globalThis.document) {
  const url = URL.createObjectURL(blob);
  const link = doc.createElement('a');
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  doc.body.append(link);
  link.click();
  link.remove();
  // Revoked later, not at once: some browsers still read the URL after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
