// Unit tests for src/core/crc32.js.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { crc32 } from '../../../src/core/crc32.js';

const ascii = (text) => new TextEncoder().encode(text);

describe('crc32', () => {
  it('gives the standard check value for "123456789"', () => {
    assert.equal(crc32(ascii('123456789')), 0xcbf43926);
  });

  it('is 0 for no bytes', () => {
    assert.equal(crc32(new Uint8Array(0)), 0);
  });

  it('continues a running checksum', () => {
    assert.equal(crc32(ascii('6789'), crc32(ascii('12345'))), 0xcbf43926);
  });

  it('matches node:zlib for many byte values', () => {
    const bytes = Uint8Array.from({ length: 1000 }, (_, index) => (index * 7919) % 256);
    assert.equal(crc32(bytes), zlib.crc32(bytes));
  });
});
