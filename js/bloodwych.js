/* Bloodwych-specific TAP structures discovered directly in the supplied TAP.
 *
 * CONFIRMED:
 *   - custom data blocks begin with ASCII d..m (TAP blocks 6..15 in supplied file)
 *   - 5 floor descriptors begin at custom-block offset $23
 *   - each descriptor is 6 bytes: width, height, BIG-ENDIAN 16-bit offset, xoff, yoff
 *   - map-data base is custom-block offset $41
 *   - one byte per map cell, row-major for complete floors
 */
(function (global) {
  'use strict';

  const BLOCK_NAMES = {
    d: 'Keeps', e: 'Serpents', f: 'Serpent2', g: 'Moons', h: 'Moon2',
    i: 'Dragons', j: 'Dragon2', k: 'Archaus', l: 'Chaos2', m: 'Zendiks'
  };
  const HEADER_OFFSET = 0x23;
  const DESCRIPTOR_SIZE = 6;
  const FLOOR_COUNT = 5;
  const FLOOR_DATA_BASE = 0x41;

  function be16(raw, p) { return ((raw[p] << 8) | raw[p + 1]) >>> 0; }

  function parseDescriptor(raw, floorIndex) {
    const p = HEADER_OFFSET + floorIndex * DESCRIPTOR_SIZE;
    return {
      floorIndex,
      descriptorOffset: p,
      width: raw[p],
      height: raw[p + 1],
      dataOffset: be16(raw, p + 2),
      xOffset: raw[p + 4],
      yOffset: raw[p + 5]
    };
  }

  function parseTower(block) {
    const id = String.fromCharCode(block.raw[0] || 0);
    if (!(id in BLOCK_NAMES)) return null;
    if (block.raw.length < FLOOR_DATA_BASE + 1) throw new Error(`Custom block ${id} is too short`);

    const floors = [];
    for (let i = 0; i < FLOOR_COUNT; i++) {
      const d = parseDescriptor(block.raw, i);
      const cellCount = d.width * d.height;
      const blockStart = FLOOR_DATA_BASE + d.dataOffset;
      const maxDataEnd = block.raw.length - 1; // checksum not map data
      const available = Math.max(0, Math.min(cellCount, maxDataEnd - blockStart));
      const bytes = cellCount ? block.raw.slice(blockStart, blockStart + available) : new Uint8Array(0);
      floors.push(Object.assign(d, {
        used: d.width > 0 && d.height > 0,
        cellCount,
        blockStart,
        absoluteFileStart: block.fileOffset + blockStart,
        availableCells: available,
        complete: cellCount === available,
        bytes
      }));
    }

    // Sequential switch indices are calculated in storage order across floors.
    let switchIndex = 0;
    for (const floor of floors) {
      floor.switches = [];
      if (!floor.used) continue;
      for (let idx = 0; idx < floor.bytes.length; idx++) {
        const t = BWTiles.decode(floor.bytes[idx]);
        if (t.kind === 'switch') {
          floor.switches.push({
            sequence: switchIndex++,
            cellIndex: idx,
            x: idx % floor.width,
            y: Math.floor(idx / floor.width),
            value: floor.bytes[idx]
          });
        }
      }
    }

    return {
      id,
      name: BLOCK_NAMES[id],
      blockIndex: block.index,
      blockFileOffset: block.fileOffset,
      blockLength: block.raw.length,
      checksumValid: block.checksumValid,
      floors,
      rawHeader: block.raw.slice(0, FLOOR_DATA_BASE),
      switchCount: switchIndex
    };
  }

  function findTowers(tap) {
    const towers = [];
    for (const block of tap.blocks) {
      if (!block.raw.length) continue;
      const id = String.fromCharCode(block.raw[0]);
      if (id in BLOCK_NAMES) towers.push(parseTower(block));
    }
    return towers;
  }

  function getCell(tap, tower, floor, x, y) {
    if (!floor.used || x < 0 || y < 0 || x >= floor.width || y >= floor.height) return null;
    const idx = y * floor.width + x;
    if (idx >= floor.availableCells) return null;
    const block = tap.blocks[tower.blockIndex];
    const blockOffset = floor.blockStart + idx;
    const value = block.raw[blockOffset];
    const original = block.originalRaw[blockOffset];
    const switchEntry = floor.switches.find(s => s.cellIndex === idx) || null;
    return {
      x, y, index: idx,
      globalX: x + floor.xOffset,
      globalY: y + floor.yOffset,
      blockOffset,
      fileOffset: block.fileOffset + blockOffset,
      value,
      original,
      changed: value !== original,
      tile: BWTiles.decode(value),
      switchSequence: switchEntry ? switchEntry.sequence : null
    };
  }

  function writeCell(tap, tower, floor, x, y, value) {
    const cell = getCell(tap, tower, floor, x, y);
    if (!cell) throw new Error('Cell unavailable or outside physically present floor data');
    BWTap.replaceBlockByte(tap, tower.blockIndex, cell.blockOffset, value);
    // Keep parsed view pointing at updated source. Reparse tower so switch indices update too.
    return parseTower(tap.blocks[tower.blockIndex]);
  }

  global.BWBloodwych = {
    BLOCK_NAMES, HEADER_OFFSET, FLOOR_DATA_BASE, findTowers, parseTower, getCell, writeCell
  };
})(window);
