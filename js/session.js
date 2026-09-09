/* Byte-exact editing session for Bloodwych ZX projects.
 *
 * Stage 5 owns a Level Data tape only, but the project shape deliberately has
 * separate level/game source slots so Game-TZX resources can be added later
 * without replacing the session architecture.
 */
(function (global) {
  'use strict';

  class EditSession {
    constructor() {
      this.sources = { level: null, game: null };
      this.activeRole = 'level';
      this.undoStack = [];
      this.currentTransaction = null;
      this.revision = 0;
    }

    loadLevel(tape, label) {
      this.sources.level = { role: 'level', tape, label: label || 'Level Data tape' };
      this.activeRole = 'level';
      this.undoStack.length = 0;
      this.currentTransaction = null;
      this.revision++;
    }

    get level() { return this.sources.level; }
    get tape() { return this.level ? this.level.tape : null; }

    transact(label, fn, metadata) {
      if (!this.tape) throw new Error('No Level Data tape loaded.');
      if (this.currentTransaction) return fn();
      const tx = { label: label || 'Edit', metadata: metadata || {}, writes: [] };
      this.currentTransaction = tx;
      try {
        const result = fn();
        this.currentTransaction = null;
        const compact = [];
        const byKey = new Map();
        for (const w of tx.writes) {
          const key = `${w.blockIndex}:${w.blockOffset}`;
          if (!byKey.has(key)) {
            const c = Object.assign({}, w);
            byKey.set(key, c); compact.push(c);
          } else {
            byKey.get(key).after = w.after;
          }
        }
        tx.writes = compact.filter(w => w.before !== w.after);
        if (tx.writes.length) {
          this.undoStack.push(tx);
          this.revision++;
        }
        return result;
      } catch (err) {
        // Roll back any writes performed before the failure.
        for (let i = tx.writes.length - 1; i >= 0; i--) {
          const w = tx.writes[i];
          BWTap.replaceBlockByte(this.tape, w.blockIndex, w.blockOffset, w.before);
        }
        this.currentTransaction = null;
        throw err;
      }
    }

    writeBlockByte(blockIndex, blockOffset, value, metadata) {
      if (!this.tape) throw new Error('No Level Data tape loaded.');
      const block = this.tape.blocks[blockIndex];
      if (!block) throw new Error(`No tape data block ${blockIndex}.`);
      const before = block.raw[blockOffset];
      const after = value & 0xff;
      if (before === after) return false;
      if (!this.currentTransaction) {
        return this.transact('Byte edit', () => this.writeBlockByte(blockIndex, blockOffset, after, metadata), metadata);
      }
      this.currentTransaction.writes.push({ blockIndex, blockOffset, before, after, metadata: metadata || {} });
      BWTap.replaceBlockByte(this.tape, blockIndex, blockOffset, after);
      return true;
    }

    undo() {
      const tx = this.undoStack.pop();
      if (!tx || !this.tape) return null;
      for (let i = tx.writes.length - 1; i >= 0; i--) {
        const w = tx.writes[i];
        BWTap.replaceBlockByte(this.tape, w.blockIndex, w.blockOffset, w.before);
      }
      this.revision++;
      return tx;
    }

    reset() {
      if (!this.tape) return;
      for (const block of this.tape.blocks) block.raw = block.originalRaw.slice();
      this.undoStack.length = 0;
      this.currentTransaction = null;
      this.revision++;
    }

    logicalDiff() {
      if (!this.tape) return [];
      const out = [];
      for (const block of this.tape.blocks) {
        const last = Math.max(0, block.raw.length - 1); // parity is derivative, not an intended edit
        for (let i = 0; i < last; i++) {
          if (block.raw[i] !== block.originalRaw[i]) {
            out.push({
              blockIndex: block.index,
              blockOffset: i,
              fileOffset: block.fileOffset + i,
              before: block.originalRaw[i],
              after: block.raw[i]
            });
          }
        }
      }
      return out;
    }

    changedParityBlocks() {
      if (!this.tape) return [];
      return this.tape.blocks.filter(b => b.raw.length && b.raw[b.raw.length - 1] !== b.originalRaw[b.originalRaw.length - 1]);
    }

    rebuildLevelTape() {
      if (!this.tape) throw new Error('No Level Data tape loaded.');
      return BWTap.rebuildTape(this.tape);
    }
  }

  global.BWSession = { EditSession };
})(window);
