// Lets the user choose an image (file chooser or drag-and-drop onto the frame) and puts the
// decoded image into the store. Only the most recent selection is ever shown.

import { loadImageFile, ImageDecodeError } from '../io/image-loader.js';

const SUPPORTED_FORMATS_TEXT = 'Try a JPG, PNG, WebP, GIF, BMP or AVIF file.';

/**
 * Connects the file chooser [data-role="file-input"] to image loading.
 * On success the image replaces the previous one; the pattern is cleared, the Original layer
 * is selected and the viewport is reset so the viewer fits the new image.
 * On failure the previous image stays and the status shows an error.
 * root   element (or document) containing the file chooser and the viewer
 * store  the app store from ./store.js
 * Returns loadFile(file), which the drag-and-drop handler also uses.
 */
export function setupImageInput(root, store) {
  const fileInput = root.querySelector('[data-role="file-input"]');
  let latestLoadId = 0;

  async function loadFile(file) {
    latestLoadId += 1;
    const loadId = latestLoadId;
    store.setState({ status: { kind: 'loading', text: `Loading ${file.name}…` } });

    let image;
    try {
      image = await loadImageFile(file);
    } catch (error) {
      reportLoadError(file.name, error, loadId === latestLoadId);
      return;
    }

    if (loadId !== latestLoadId) {
      image.bitmap.close(); // a newer selection was made while this one decoded
      return;
    }
    const previousImage = store.getState().image;
    store.setState({
      image,
      pattern: null,
      activeLayer: 'original',
      viewport: null,
      status: { kind: 'info', text: describeLoadedImage(image) },
    });
    previousImage?.bitmap.close();
  }

  function reportLoadError(fileName, error, isLatest) {
    const isExpected = error instanceof ImageDecodeError;
    if (!isExpected) {
      console.error(error);
    }
    if (!isLatest) {
      return; // the user has already moved on to a newer file; its status is what matters
    }
    const text = isExpected
      ? `Could not open "${fileName}": this browser cannot decode it as an image. ${SUPPORTED_FORMATS_TEXT}`
      : `Could not open "${fileName}": an unexpected error occurred.`;
    store.setState({ status: { kind: 'error', text } });
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = ''; // allows choosing the same file again
    if (file !== undefined) {
      loadFile(file);
    }
  });

  return loadFile;
}

/** Status text for a loaded image, e.g. "big.jpg — 2048 × 1365 px (downscaled from 6000 × 4000 px)". */
function describeLoadedImage(image) {
  const size = `${image.fileName} — ${image.width} × ${image.height} px`;
  if (!image.isDownscaled) {
    return size;
  }
  return `${size} (downscaled from ${image.sourceWidth} × ${image.sourceHeight} px)`;
}
