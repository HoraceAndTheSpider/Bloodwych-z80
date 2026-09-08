/* ZX Spectrum TAP/TZX reader/writer for Bloodwych.
 *
 * Supported source formats in this editor:
 *   TAP: ordinary <length:LE16><block bytes> records.
 *   TZX: the block types actually used by the supplied Bloodwych images:
 *        $10 Standard Speed Data Block and $30 Text Description.
 *
 * Editing never changes record sizes or timing metadata. Export starts from an
 * exact copy of the loaded file and replaces only edited standard data-block
 * bytes plus their XOR parity byte.
 */
(function (global) {
  'use strict';

  function xorChecksum(bytes, endExclusive) {
    let x = 0;
    const end = endExclusive == null ? bytes.length : endExclusive;
    for (let i = 0; i < end; i++) x ^= bytes[i];
    return x & 0xff;
  }

  function copyBuffer(src) { return new Uint8Array(src); }

  function makeBlock(index, raw, fileOffset, extra) {
    return Object.assign({
      index,
      fileOffset,
      length: raw.length,
      raw,
      originalRaw: raw.slice(),
      checksumValid: raw.length ? xorChecksum(raw) === 0 : true,
      editable: raw.length >= 2
    }, extra || {});
  }

  function parseTapBytes(src) {
    const blocks = [];
    let pos = 0, index = 0;
    while (pos + 2 <= src.length) {
      const prefixOffset = pos;
      const length = src[pos] | (src[pos + 1] << 8);
      pos += 2;
      if (pos + length > src.length) {
        throw new Error(`TAP block ${index} overruns file: length ${length} at $${prefixOffset.toString(16).toUpperCase()}`);
      }
      const fileOffset = pos;
      const raw = src.slice(pos, pos + length);
      blocks.push(makeBlock(index, raw, fileOffset, {
        container: 'TAP', prefixOffset, recordOffset: prefixOffset,
        blockType: null, pauseMs: null
      }));
      pos += length; index++;
    }
    if (pos !== src.length) throw new Error(`Trailing byte(s) after final TAP block at ${pos}`);
    return { format: 'TAP', bytes: src, originalBytes: src.slice(), blocks, records: blocks };
  }

  function parseTzxBytes(src) {
    if (src.length < 10 || String.fromCharCode(...src.slice(0, 7)) !== 'ZXTape!' || src[7] !== 0x1a) {
      throw new Error('Not a TZX file (missing ZXTape! header).');
    }
    const major = src[8], minor = src[9];
    const blocks = [], records = [];
    let pos = 10, dataIndex = 0;
    while (pos < src.length) {
      const recordOffset = pos;
      const id = src[pos++];
      if (id === 0x10) {
        if (pos + 4 > src.length) throw new Error(`Truncated TZX $10 block at $${recordOffset.toString(16)}`);
        const pauseMs = src[pos] | (src[pos + 1] << 8);
        const length = src[pos + 2] | (src[pos + 3] << 8);
        pos += 4;
        const fileOffset = pos;
        if (pos + length > src.length) throw new Error(`TZX $10 block at $${recordOffset.toString(16)} overruns file.`);
        const raw = src.slice(pos, pos + length);
        const block = makeBlock(dataIndex++, raw, fileOffset, {
          container: 'TZX', recordOffset, blockType: 0x10, pauseMs
        });
        blocks.push(block);
        records.push({ id, recordOffset, endOffset: pos + length, block });
        pos += length;
      } else if (id === 0x30) {
        if (pos >= src.length) throw new Error(`Truncated TZX $30 block at $${recordOffset.toString(16)}`);
        const length = src[pos++];
        if (pos + length > src.length) throw new Error(`TZX text block at $${recordOffset.toString(16)} overruns file.`);
        const bytes = src.slice(pos, pos + length);
        let text = ''; for (const b of bytes) text += String.fromCharCode(b);
        records.push({ id, recordOffset, endOffset: pos + length, length, text });
        pos += length;
      } else {
        throw new Error(`Unsupported TZX block type $${id.toString(16).toUpperCase().padStart(2,'0')} at $${recordOffset.toString(16).toUpperCase()}. The supplied Bloodwych TZX files use only $10 and $30.`);
      }
    }
    return { format: 'TZX', version: `${major}.${minor}`, bytes: src, originalBytes: src.slice(), blocks, records };
  }

  function parseTape(arrayBuffer) {
    const src = new Uint8Array(arrayBuffer);
    if (src.length >= 8 && String.fromCharCode(...src.slice(0, 7)) === 'ZXTape!' && src[7] === 0x1a) return parseTzxBytes(src);
    return parseTapBytes(src);
  }

  function parseTap(arrayBuffer) { return parseTapBytes(new Uint8Array(arrayBuffer)); }
  function parseTzx(arrayBuffer) { return parseTzxBytes(new Uint8Array(arrayBuffer)); }

  function rebuildTape(tape) {
    const out = tape.originalBytes.slice();
    for (const block of tape.blocks) {
      const raw = block.raw.slice();
      if (raw.length) raw[raw.length - 1] = xorChecksum(raw, raw.length - 1);
      if (raw.length !== block.length) throw new Error('Editor cannot export a tape after changing a data-block length.');
      out.set(raw, block.fileOffset);
    }
    return out;
  }

  function rebuildTap(tap) { return rebuildTape(tap); }

  function replaceBlockByte(tape, blockIndex, blockOffset, value) {
    const b = tape.blocks[blockIndex];
    if (!b) throw new Error(`No tape data block ${blockIndex}`);
    if (blockOffset < 0 || blockOffset >= b.raw.length - 1) {
      throw new Error(`Invalid editable block offset $${blockOffset.toString(16)}`);
    }
    b.raw[blockOffset] = value & 0xff;
    b.raw[b.raw.length - 1] = xorChecksum(b.raw, b.raw.length - 1);
    b.checksumValid = xorChecksum(b.raw) === 0;
  }

  global.BWTap = { parseTape, parseTap, parseTzx, rebuildTape, rebuildTap, replaceBlockByte, xorChecksum };
})(window);
