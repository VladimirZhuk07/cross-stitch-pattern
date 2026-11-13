// View layer 2: the image in DMC colors (color blocks).
// STUB: add-dmc-preview-layer replaces this whole file with the real layer. Keep the export name
// createDmcLayer and follow the view-layer contract in ../viewer.js, so that change
// touches no other file.

const NOTE_FONT = '16px system-ui, sans-serif';
const NOTE_COLOR = '#5C5C5C';

/**
 * Creates the DMC colors layer. It is available once a pattern exists (state.pattern is not null).
 * Until add-dmc-preview-layer lands it only draws a note in the middle of the frame.
 * Returns a view layer { id: 'dmc', isAvailable, render }.
 */
export function createDmcLayer() {
  return {
    id: 'dmc',
    isAvailable: (state) => state.pattern !== null,
    render(ctx, frame) {
      ctx.font = NOTE_FONT;
      ctx.fillStyle = NOTE_COLOR;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('The DMC colors view is not available yet.', frame.width / 2, frame.height / 2);
    },
  };
}
