// View layer 3: the cross-stitch chart.
// STUB: add-stitch-chart-layer replaces this whole file with the real layer. Keep the export name
// createChartLayer and follow the view-layer contract in ../viewer.js, so that change
// touches no other file.

const NOTE_FONT = '16px system-ui, sans-serif';
const NOTE_COLOR = '#5C5C5C';

/**
 * Creates the Chart layer. It is available once a pattern exists (state.pattern is not null).
 * Until add-stitch-chart-layer lands it only draws a note in the middle of the frame.
 * Returns a view layer { id: 'chart', isAvailable, render }.
 */
export function createChartLayer() {
  return {
    id: 'chart',
    isAvailable: (state) => state.pattern !== null,
    render(ctx, frame) {
      ctx.font = NOTE_FONT;
      ctx.fillStyle = NOTE_COLOR;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('The Chart view is not available yet.', frame.width / 2, frame.height / 2);
    },
  };
}
