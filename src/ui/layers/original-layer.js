// View layer 1: the loaded image as it is. Follows the view-layer contract in ../viewer.js.

/**
 * Creates the Original layer. It is always available; the viewer only asks it to render
 * when an image is loaded.
 * Returns a view layer { id: 'original', isAvailable, render }.
 */
export function createOriginalLayer() {
  return {
    id: 'original',
    isAvailable: () => true,
    render(ctx, frame, state) {
      const { content, viewport } = frame;
      // From 100 % up, show crisp image pixels: they line up with the stitch grid of the
      // other layers, and blurring them would hide what the pattern is made from.
      ctx.imageSmoothingEnabled = viewport.scale < 1;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(state.image.bitmap, content.x, content.y, content.width, content.height);
    },
  };
}
