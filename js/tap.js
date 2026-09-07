/* ZX Spectrum TAP reader/writer.
 *
 * CONFIRMED FROM THE PROVIDED TAP:
 *   Each TAP block is stored as <length:LE16><block bytes>.
 *   XOR of every byte in each block is zero; the final byte is the checksum.
 */
(function (global) {
  'use strict';

  function xorChecksum(bytes, endExclusive) {
    let x = 0;
    const end = endExclusive == null ? bytes.length : endExclusive;
    for (let i = 0; i < end; i++) x ^= bytes[i];
    return x & 0xff;
  }

  function parseTap(arrayBuffer) {
    const src = new Uint8Array(arrayBuffer);
    const blocks = [];
    let pos = 0;
    let index = 0;
    while (pos + 2 <= src.length) {
      const prefixOffset = pos;
      const length = src[pos] | (src[pos + 1] << 8);
      pos += 2;
      if (pos + length > src.length) {
        throw new Error(`TAP block ${index} overruns file: length ${length} at $${prefixOffset.toString(16)}`);
      }
      const fileOffset = pos; // absolute offset of first block byte, after length word
      const raw = src.slice(pos, pos + length);
      blocks.push({
        index,
        prefixOffset,
        fileOffset,
        length,
        raw,
        originalRaw: raw.slice(),
        checksumValid: xorChecksum(raw) === 0,
      });
      pos += length;
      index++;
    }
    if (pos !== src.length) throw new Error(`Trailing byte(s) after final TAP block at ${pos}`);
    return { bytes: src, blocks };
  }

  function rebuildTap(tap) {
    let total = 0;
    for (const b of tap.blocks) total += 2 + b.raw.length;
    const out = new Uint8Array(total);
    let p = 0;
    for (const block of tap.blocks) {
      // Recalculate checksum for any block having at least one byte.
      const raw = block.raw.slice();
      if (raw.length) raw[raw.length - 1] = xorChecksum(raw, raw.length - 1);
      out[p++] = raw.length & 0xff;
      out[p++] = (raw.length >>> 8) & 0xff;
      out.set(raw, p);
      p += raw.length;
    }
    return out;
  }

  function replaceBlockByte(tap, blockIndex, blockOffset, value) {
    const b = tap.blocks[blockIndex];
    if (!b) throw new Error(`No TAP block ${blockIndex}`);
    if (blockOffset < 0 || blockOffset >= b.raw.length - 1) {
      throw new Error(`Invalid editable block offset $${blockOffset.toString(16)}`);
    }
    b.raw[blockOffset] = value & 0xff;
    b.raw[b.raw.length - 1] = xorChecksum(b.raw, b.raw.length - 1);
  }

  global.BWTap = { parseTap, rebuildTap, replaceBlockByte, xorChecksum };
})(window);
