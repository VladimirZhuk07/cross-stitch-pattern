// Unit tests for src/core/pdf-info-page.js, read back with tests/helpers/pdf-reader.js.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertClose } from '../../helpers/assert-close.js';
import { readContent } from '../../helpers/pdf-reader.js';
import { planPdfPages } from '../../../src/core/pdf-page-plan.js';
import { textWidth } from '../../../src/core/pdf-text.js';
import { PAGE_MAP_NOTE } from '../../../src/core/pdf-page-map.js';
import { infoPageContent } from '../../../src/core/pdf-info-page.js';

const MM = 72 / 25.4;
const PAGE_HEIGHT = 841.89;
const PICTURES = { original: { width: 1200, height: 804 }, dmc: { width: 1200, height: 804 } };

// A 100 × 67 pattern with 21 colors and 6,700 stitches (only the facts the page reads).
function catPattern(width = 100, height = 67, colorCount = 21) {
  const legend = Array.from({ length: colorCount }, (_, index) => ({ number: index + 1, stitchCount: 0 }));
  if (colorCount > 0) {
    legend[0].stitchCount = width * height - (colorCount - 1);
    for (let index = 1; index < colorCount; index++) {
      legend[index].stitchCount = 1;
    }
  }
  return { width, height, legend };
}

function infoPage({ pattern = catPattern(), fileName = 'cat.png', fabricCount = 14, pictures = PICTURES } = {}) {
  return readContent(infoPageContent({ pattern, plan: planPdfPages(pattern), fileName, fabricCount, pictures }));
}

function textsOf(page) {
  return page.texts.map((text) => text.text);
}

describe('infoPageContent title and pictures', () => {
  it('shows the title in bold and the file name below it', () => {
    const page = infoPage();
    const title = page.texts.find((text) => text.text === 'Cross-stitch pattern');
    assert.equal(title.font, 'F2');
    assert.equal(title.size, 18);
    const name = page.texts.find((text) => text.text === 'cat.png');
    assert.equal(name.size, 11);
    assert.ok(name.y < title.y);
  });

  it('shows accented names as they are and other scripts as ?', () => {
    assert.ok(textsOf(infoPage({ fileName: 'café.png' })).includes('café.png'));
    assert.ok(textsOf(infoPage({ fileName: 'Ёлка.png' })).includes('????.png'));
  });

  it('cuts a 200-character name to 190 mm', () => {
    const page = infoPage({ fileName: `${'w'.repeat(196)}.png` });
    const name = page.texts.find((text) => text.size === 11);
    assert.ok(name.text.endsWith('…'));
    assert.ok(textWidth(name.text, 'F1', 11) <= 190 * MM);
  });

  it('captions the pictures Original and DMC colors', () => {
    const page = infoPage();
    const original = page.texts.find((text) => text.text === 'Original');
    const dmc = page.texts.find((text) => text.text === 'DMC colors');
    assert.equal(original.font, 'F2');
    assertClose(original.x, 10 * MM, 0.01, 'Original x');
    assertClose(dmc.x, 110 * MM, 0.01, 'DMC colors x');
  });

  it('draws both pictures 90 mm wide and 60.3 mm high, top-aligned at 35 mm', () => {
    const page = infoPage();
    assert.deepEqual(page.images.map((image) => image.name), ['/Im1', '/Im2']);
    const [original, dmc] = page.images;
    for (const image of [original, dmc]) {
      assertClose(image.width, 90 * MM, 0.01, 'width');
      assertClose(image.height, 90 * MM * 804 / 1200, 0.01, 'height');
      assertClose(image.y + image.height, PAGE_HEIGHT - 35 * MM, 0.01, 'top');
    }
    assertClose(original.x, 10 * MM, 0.01, 'original x');
    assertClose(dmc.x, 110 * MM, 0.01, 'dmc x');
  });

  it('centres a tall picture in its box', () => {
    const page = infoPage({ pictures: { original: { width: 600, height: 1200 }, dmc: { width: 1200, height: 804 } } });
    const [original] = page.images;
    assertClose(original.height, 90 * MM, 0.01, 'height');
    assertClose(original.width, 45 * MM, 0.01, 'width');
    assertClose(original.x, 32.5 * MM, 0.01, 'x');
  });
});

describe('infoPageContent summary', () => {
  it('lists size, stitches, colors and finished size of the 100 × 67 example', () => {
    const page = infoPage();
    const labels = page.texts.filter((text) => text.font === 'F2' && text.size === 10).map((text) => text.text);
    const values = page.texts.filter((text) => text.font === 'F1' && text.size === 10).map((text) => text.text);
    assert.deepEqual(labels, ['Size', 'Stitches', 'Colors', 'Finished size']);
    assert.deepEqual(values, ['100 × 67 stitches', '6,700', '21 DMC colors', '7.1 × 4.8 in (18.1 × 12.2 cm) on 14 ct']);
    const sizeValue = page.texts.find((text) => text.text === '100 × 67 stitches');
    assertClose(sizeValue.x, 45 * MM, 0.01, 'value x');
    assertClose(sizeValue.y, PAGE_HEIGHT - 135 * MM, 0.01, 'first baseline');
  });

  it('reads 0 DMC colors and 0 stitches for a pattern without stitches', () => {
    const values = textsOf(infoPage({ pattern: catPattern(2, 2, 0) }));
    assert.ok(values.includes('0 DMC colors'));
    assert.ok(values.includes('0'));
  });
});

describe('infoPageContent page map', () => {
  it('shows the map heading, the note and the diagram when the map fits', () => {
    const page = infoPage({ pattern: catPattern(120, 90, 3) });
    const heading = page.texts.find((text) => text.text === 'Page map');
    assert.equal(heading.font, 'F2');
    assert.equal(heading.size, 12);
    assert.ok(textsOf(page).includes(PAGE_MAP_NOTE));
    assert.equal(PAGE_MAP_NOTE, 'Each chart page shows up to 50 columns × 80 rows. Info and legend pages are not numbered.');
    assert.deepEqual(page.texts.filter((text) => text.size === 7).map((text) => text.text), ['1', '2', '3', '4', '5', '6']);
  });

  it('points to the next 2 pages for 1000 × 1000', () => {
    const page = infoPage({ pattern: catPattern(1000, 1000, 24) });
    assert.ok(textsOf(page).includes('The page map is on the next 2 pages.'));
    assert.equal(page.texts.filter((text) => text.size === 7).length, 0, 'no diagram');
  });

  it('points to the next page for 751 × 80', () => {
    assert.ok(textsOf(infoPage({ pattern: catPattern(751, 80, 24) })).includes('The page map is on the next page.'));
  });
});
