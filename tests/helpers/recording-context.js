// A fake CanvasRenderingContext2D for Node tests: it draws nothing and records what a view
// layer asked for, so tests can check texts, fills and strokes without a browser.
//
// createRecordingContext() returns { ctx, texts, fills, strokes, images, drawCallCount }:
//   ctx       pass it to layer.render(ctx, frame, state)
//   texts     list of { text, x, y, font, fontSize, fillStyle, textAlign, textBaseline }
//   fills     list of { fillStyle, rects, polygons }, one per fill() or fillRect():
//             rects are { x, y, width, height }, polygons are lists of { x, y }
//   strokes   list of { strokeStyle, lineWidth, segments }, one per stroke():
//             segments are { x1, y1, x2, y2 }
//   images    list of { image, args, imageSmoothingEnabled }, one per drawImage(image, ...args)
//   drawCallCount()  number of fill, fillRect, stroke, fillText and drawImage calls
// measureText(text).width is 0.55 × font size per character (a typical digit width).
//
// createFakeCellCanvasFactory() returns { createCellCanvas, canvases }: pass createCellCanvas
// to createChartLayer({ createCellCanvas }) or createDmcLayer({ createCellCanvas }); every
// canvas it makes is listed in canvases as { width, height, pixels, puts }:
//   pixels  the canvas content as RGBA bytes (null until the first putImageData), updated by
//           every putImageData(image, dx, dy, dirtyX, dirtyY, dirtyWidth, dirtyHeight) for
//           its dirty rectangle (the whole image when no rectangle is given)
//   puts    one { dx, dy, dirtyX, dirtyY, dirtyWidth, dirtyHeight } per putImageData call
//   width, height  plain properties; a layer releases a canvas by setting both to 0

const DIGIT_WIDTH_EM = 0.55;

export function createRecordingContext() {
  const texts = [];
  const fills = [];
  const strokes = [];
  const images = [];
  const stateStack = [];
  let path = emptyPath();
  let current = null;

  const ctx = {
    font: '10px sans-serif',
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    textAlign: 'start',
    textBaseline: 'alphabetic',
    imageSmoothingEnabled: true,
    save() {
      stateStack.push(styleOf(ctx));
    },
    restore() {
      Object.assign(ctx, stateStack.pop());
    },
    beginPath() {
      path = emptyPath();
      current = null;
    },
    rect(x, y, width, height) {
      path.rects.push({ x, y, width, height });
    },
    moveTo(x, y) {
      current = { x, y };
      path.polygons.push([{ x, y }]);
    },
    lineTo(x, y) {
      if (current !== null) {
        path.segments.push({ x1: current.x, y1: current.y, x2: x, y2: y });
        path.polygons[path.polygons.length - 1].push({ x, y });
      }
      current = { x, y };
    },
    closePath() {},
    fill() {
      fills.push({ fillStyle: ctx.fillStyle, rects: [...path.rects], polygons: path.polygons.map((p) => [...p]) });
    },
    fillRect(x, y, width, height) {
      fills.push({ fillStyle: ctx.fillStyle, rects: [{ x, y, width, height }], polygons: [] });
    },
    stroke() {
      strokes.push({ strokeStyle: ctx.strokeStyle, lineWidth: ctx.lineWidth, segments: [...path.segments] });
    },
    fillText(text, x, y) {
      texts.push({
        text: String(text),
        x,
        y,
        font: ctx.font,
        fontSize: fontSizeOf(ctx.font),
        fillStyle: ctx.fillStyle,
        textAlign: ctx.textAlign,
        textBaseline: ctx.textBaseline,
      });
    },
    measureText(text) {
      return { width: String(text).length * DIGIT_WIDTH_EM * fontSizeOf(ctx.font) };
    },
    drawImage(image, ...args) {
      images.push({ image, args, imageSmoothingEnabled: ctx.imageSmoothingEnabled });
    },
    clearRect() {},
    setTransform() {},
  };

  function drawCallCount() {
    return texts.length + fills.length + strokes.length + images.length;
  }

  return { ctx, texts, fills, strokes, images, drawCallCount };
}

export function createFakeCellCanvasFactory() {
  const canvases = [];

  function createCellCanvas(width, height) {
    const canvas = {
      width,
      height,
      pixels: null,
      puts: [],
      getContext() {
        return {
          createImageData(imageWidth, imageHeight) {
            return { width: imageWidth, height: imageHeight, data: new Uint8ClampedArray(imageWidth * imageHeight * 4) };
          },
          putImageData(image, dx, dy, dirtyX = 0, dirtyY = 0, dirtyWidth = image.width, dirtyHeight = image.height) {
            canvas.puts.push({ dx, dy, dirtyX, dirtyY, dirtyWidth, dirtyHeight });
            copyDirtyRect(canvas, image, dx, dy, { x: dirtyX, y: dirtyY, width: dirtyWidth, height: dirtyHeight });
          },
        };
      },
    };
    canvases.push(canvas);
    return canvas;
  }

  return { createCellCanvas, canvases };
}

// Copies the dirty rectangle of image into canvas.pixels at (dx, dy), like the real canvas.
function copyDirtyRect(canvas, image, dx, dy, dirty) {
  if (canvas.pixels === null) {
    canvas.pixels = new Uint8ClampedArray(canvas.width * canvas.height * 4);
  }
  for (let row = dirty.y; row < dirty.y + dirty.height; row++) {
    const from = (row * image.width + dirty.x) * 4;
    const to = ((dy + row) * canvas.width + dx + dirty.x) * 4;
    canvas.pixels.set(image.data.subarray(from, from + dirty.width * 4), to);
  }
}

function emptyPath() {
  return { rects: [], segments: [], polygons: [] };
}

function styleOf(ctx) {
  const { font, fillStyle, strokeStyle, lineWidth, textAlign, textBaseline, imageSmoothingEnabled } = ctx;
  return { font, fillStyle, strokeStyle, lineWidth, textAlign, textBaseline, imageSmoothingEnabled };
}

function fontSizeOf(font) {
  const match = /([\d.]+)px/.exec(font);
  return match === null ? NaN : Number(match[1]);
}
