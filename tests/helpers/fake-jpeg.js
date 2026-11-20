// Hand-made JPEG header bytes for PDF tests: SOI, a JFIF APP0 segment, a start-of-frame segment
// with the given size, then a few bytes of "scan data". Viewers could not decode it, but
// src/core/pdf-pictures.js reads its size and the PDF writer embeds it as it is.

/** A fake JPEG (Uint8Array) of width × height px with 3 color components. */
export function fakeJpeg(width, height) {
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
  const frame = [0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03];
  for (let component = 1; component <= 3; component++) {
    frame.push(component, 0x11, 0x00);
  }
  return Uint8Array.from([0xff, 0xd8, ...app0, ...frame, 0xff, 0xda, 0x00, 0x02, 0x12, 0x34, 0xff, 0xd9]);
}
