// Lets the user choose an image (file chooser or drag-and-drop onto the frame) and puts the
// decoded image into the store. Only the most recent selection is ever shown.

import { loadImageFile, ImageDecodeError } from '../io/image-loader.js';

const SUPPORTED_FORMATS_TEXT = 'Try a JPG, PNG, WebP, GIF, BMP or AVIF file.';

/**
 * Connects the file chooser [data-role="file-input"] and drops onto the viewer
 * [data-role="viewer"] to image loading. When several files are dropped, the first is used.
 * On success the image replaces the previous one; the pattern is cleared, the Original layer
 * is selected and the viewport is reset so the viewer fits the new image.
 * On failure the previous image stays and the status shows an error.
 * Drops outside the viewer are blocked so the browser does not navigate away to the file.
 * root   element (or document) containing the file chooser and the viewer
 * store  the app store from ./store.js
 */
export function setupImageInput(root, store) {
  const fileInput = root.querySelector('[data-role="file-input"]');
  const viewer = root.querySelector('[data-role="viewer"]');
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

  setupDropTarget(viewer, loadFile);
}

/** Makes viewer accept dropped files and blocks file drops everywhere else on the page. */
function setupDropTarget(viewer, loadFile) {
  const page = viewer.ownerDocument;

  function acceptDrag(event) {
    if (!isFileDrag(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    viewer.classList.add('viewer--drop-target');
  }

  viewer.addEventListener('dragenter', acceptDrag);
  viewer.addEventListener('dragover', acceptDrag);
  viewer.addEventListener('dragleave', (event) => {
    if (!viewer.contains(event.relatedTarget)) {
      viewer.classList.remove('viewer--drop-target');
    }
  });
  viewer.addEventListener('drop', (event) => {
    event.preventDefault();
    event.stopPropagation();
    viewer.classList.remove('viewer--drop-target');
    const file = event.dataTransfer?.files[0];
    if (file !== undefined) {
      loadFile(file);
    }
  });

  // Without this, dropping a file next to the frame would open it in the tab.
  page.addEventListener('dragover', (event) => {
    if (isFileDrag(event)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'none';
    }
  });
  page.addEventListener('drop', (event) => {
    if (isFileDrag(event)) {
      event.preventDefault();
    }
  });
}

function isFileDrag(event) {
  return event.dataTransfer?.types.includes('Files') ?? false;
}

/** Status text for a loaded image, e.g. "big.jpg — 2048 × 1365 px (downscaled from 6000 × 4000 px)". */
function describeLoadedImage(image) {
  const size = `${image.fileName} — ${image.width} × ${image.height} px`;
  if (!image.isDownscaled) {
    return size;
  }
  return `${size} (downscaled from ${image.sourceWidth} × ${image.sourceHeight} px)`;
}
