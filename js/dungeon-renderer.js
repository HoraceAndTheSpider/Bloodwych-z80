/* Bloodwych ZX authentic first-person dungeon renderer.
 *
 * This is the browser port of the source-driven paths documented in
 * docs/wiki/dungeon-rendering.md and implemented for research in
 * tools/zx_render.py.  It consumes the bundled Game TZX for source graphics and
 * the same live Level-tape/tower/floor model already passed to BWRenderer by
 * app.js.  No editor substitute graphics are used.
 *
 * First integration scope:
 *   - 104x64 / 13-byte scene bitmap;
 *   - ceiling/floor source textures;
 *   - four-facing sample transform;
 *   - wall draw + occlusion masks and 19 perspective slots;
 *   - perspective walls;
 *   - facing-filtered switch/socket/dark-fixture overlays;
 *   - static floor pads, pits, ceiling holes and static ladder families;
 *   - door static source overlay.
 *
 * Deliberately OPEN / not approximated:
 *   - procedural closed-door panel/bars ($BBF3-$BD17, geometry $9617/$9637);
 *   - procedural supplements for ladder-up/down map families $28/$30;
 *   - floor objects, actors and monsters (later compositor layers).
 */
(function (global) {
  'use strict';

  if (global.__bwRestoreMapTimerGuard) global.__bwRestoreMapTimerGuard();

  const W = 104, H = 64, STRIDE = 13;
  const GAME_BASE = 0x5B00, GAME_SIZE = 0xA500;
  const GAME_TZX_URL = 'data/Bloodwych - The Game [ZX Spectrum].tzx';
  const RAW_GITHUB_BASE = 'https://raw.githubusercontent.com/HoraceAndTheSpider/Bloodwych-z80/main/';

  const WALL_DESC = 0x8A0F;
  const SWITCH_DESC = 0x88AC;
  const DOOR_DESC = 0x897B;
  const SOCKET_DESC = 0x950D;
  const VIEW_OFFSET_TABLE = 0x8FF7;
  const WALL_DRAW_MASKS = 0x9067;
  const WALL_OCCLUSION_MASKS = 0x908E;
  const CEILING_SOURCE = 0x90B5;
  const FLOOR_SOURCE = 0x9214;
  const FLOOR_FEATURE_DESC = new Map([
    [0x08, 0x940D],
    [0x18, 0x92FE],
    [0x20, 0x938D],
    [0x28, 0x92FE],
    [0x30, 0x938D],
    [0x38, 0x948D]
  ]);
  const SLOT_MAP_URL = 'data/reference/dungeon_view_slots.csv';
  function sourceUrl(path) {
    if (global.location && global.location.protocol === 'file:') {
      return RAW_GITHUB_BASE + String(path).split('/').map(encodeURIComponent).join('/');
    }
    return encodeURI(path);
  }
  const FACE_NAMES = ['N','E','S','W'];
  const FACE_STEPS = [[0,-1],[1,0],[0,1],[-1,0]];
  const RIGHT_STEPS = [[1,0],[0,1],[-1,0],[0,-1]];

  function moveInViewDirection(x, y, facing, lateral, forward) {
    const f = FACE_STEPS[facing & 3], r = RIGHT_STEPS[facing & 3];
    return [x + r[0] * lateral + f[0] * forward, y + r[1] * lateral + f[1] * forward];
  }

  function s8(v) { return (v & 0x80) ? v - 0x100 : v; }
  function bitReverse(v) {
    v = ((v & 0xF0) >>> 4) | ((v & 0x0F) << 4);
    v = ((v & 0xCC) >>> 2) | ((v & 0x33) << 2);
    return (((v & 0xAA) >>> 1) | ((v & 0x55) << 1)) & 0xFF;
  }
  function f097Transform(source, dest) {
    let b = source & 0xFF;
    let c = source & 0xAA;
    let a = ((~source) & 0x55);
    a = ((a << 1) | (a >>> 7)) & 0xFF;
    c = (a ^ c) & 0xFF;
    a = ((c >>> 1) | ((c & 1) << 7)) & 0xFF;
    c = (a | c) & 0xFF;
    b = c & b;
    return ((((~c) & 0xFF) & dest) | b) & 0xFF;
  }
  function xorBytes(bytes) {
    let x = 0;
    for (const b of bytes) x ^= b;
    return x & 0xFF;
  }

  class GameImage {
    constructor(data) {
      if (!(data instanceof Uint8Array)) data = new Uint8Array(data);
      if (data.length !== GAME_SIZE) throw new Error(`Game image must be $A500 bytes; got ${data.length}.`);
      this.data = data;
    }
    off(address) {
      if (address < GAME_BASE || address > 0xFFFF) throw new RangeError(`Game address $${address.toString(16)} outside $5B00-$FFFF.`);
      return address - GAME_BASE;
    }
    byte(address) { return this.data[this.off(address)]; }
    word(address) {
      const p = this.off(address);
      return this.data[p] | (this.data[p + 1] << 8);
    }
    raw(address, length) {
      const p = this.off(address);
      return this.data.slice(p, p + length);
    }
  }

  class MonoBuffer {
    constructor() { this.data = new Uint8Array(STRIDE * H); }
    getPixel(x, y) {
      if (x < 0 || x >= W || y < 0 || y >= H) return 0;
      return (this.data[y * STRIDE + (x >>> 3)] >>> (7 - (x & 7))) & 1;
    }
    paint(canvas) {
      if (!canvas) return;
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d', {alpha:false});
      ctx.imageSmoothingEnabled = false;
      const image = ctx.createImageData(W, H), out = image.data;
      let p = 0;
      // The game's 104x64 work buffer is copied to the Spectrum viewport in
      // bottom-to-top scanline order.  The source records/placement tables are
      // expressed in that work-buffer coordinate frame, so the final display
      // conversion must invert Y.  Rendering row 0 at the top produces the
      // exact failure seen against the emulator: ceiling/floor swapped and all
      // wall graphics vertically inverted.
      for (let y = 0; y < H; y++) {
        const sourceY = H - 1 - y;
        for (let x = 0; x < W; x++, p += 4) {
          const on = this.getPixel(x, sourceY) ? 255 : 0;
          out[p] = out[p + 1] = out[p + 2] = on;
          out[p + 3] = 255;
        }
      }
      ctx.putImageData(image, 0, 0);
    }
  }

  class DungeonRenderer {
    constructor(game, slotToSample) {
      this.g = game;
      if (!Array.isArray(slotToSample) || slotToSample.length !== 19) throw new Error('Dungeon slot map must contain 19 entries.');
      this.slotToSample = slotToSample.slice();
    }
    b(address) { return this.g.byte(address); }
    w(address) { return this.g.word(address); }
    raw(address, length) { return this.g.raw(address, length); }

    record(ptr) {
      const widthBytes = this.b(ptr), height = this.b(ptr + 1);
      return {widthBytes, height, data:this.raw(ptr + 2, widthBytes * height)};
    }

    descriptor(base, slot) {
      return {
        graphic:this.w(base + 2 * slot),
        x:this.b(base + 0x28 + 2 * slot),
        y:this.b(base + 0x29 + 2 * slot)
      };
    }

    drawF097(buffer, descriptorBase, slot) {
      const d = this.descriptor(descriptorBase, slot);
      if (d.graphic === 0x88A9) return;
      const rec = this.record(d.graphic);
      const mirror = slot >= 8 && slot < 16;
      const pair = slot >= 16;
      const one = (x0, y0, mirrored) => {
        for (let sy = 0; sy < rec.height; sy++) {
          const yy = y0 + sy;
          if (yy < 0 || yy >= H) continue;
          for (let bx = 0; bx < rec.widthBytes; bx++) {
            let sb = rec.data[sy * rec.widthBytes + bx];
            let dx;
            if (mirrored) {
              sb = bitReverse(sb);
              dx = x0 + (rec.widthBytes - 1 - bx);
            } else dx = x0 + bx;
            if (dx < 0 || dx >= STRIDE) continue;
            const p = yy * STRIDE + dx;
            buffer.data[p] = f097Transform(sb, buffer.data[p]);
          }
        }
      };
      one(d.x, d.y, mirror);
      if (pair) {
        // Emulator validation showed that the central paired wall must share
        // the same scanline origin.  Treating the source companion adjustment
        // as Y+1 creates a visible one-pixel horizontal seam half-way across
        // the wall.  Horizontal mirroring is retained; only the erroneous
        // portable vertical displacement is removed.
        one(STRIDE - d.x - rec.widthBytes, d.y, true);
      }
    }

    makeBackground(playerX, playerY, facing) {
      const out = new MonoBuffer();
      const parity = (playerX + playerY + facing) & 1;
      const ceiling = this.raw(CEILING_SOURCE, 27 * STRIDE);
      const floor = this.raw(FLOOR_SOURCE, 18 * STRIDE);
      if (parity) {
        out.data.set(ceiling, 0);
        out.data.set(floor, 46 * STRIDE);
      } else {
        for (let row = 0; row < 27; row++) {
          const src = ceiling.slice(row * STRIDE, (row + 1) * STRIDE);
          for (let i = 0; i < STRIDE; i++) out.data[row * STRIDE + i] = bitReverse(src[STRIDE - 1 - i]);
        }
        for (let row = 0; row < 18; row++) {
          const src = floor.slice(row * STRIDE, (row + 1) * STRIDE);
          const dest = (46 + row) * STRIDE;
          for (let i = 0; i < STRIDE; i++) out.data[dest + i] = bitReverse(src[STRIDE - 1 - i]);
        }
      }
      return out;
    }

    sampleOffsets(facing) {
      const p = VIEW_OFFSET_TABLE + (facing & 3) * 28;
      const out = [];
      for (let i = 0; i < 14; i++) out.push([s8(this.b(p + i * 2)), s8(this.b(p + i * 2 + 1))]);
      return out;
    }

    wallMasks() {
      const draws = [], occlusion = [];
      for (let i = 0; i < 13; i++) {
        let p = WALL_DRAW_MASKS + i * 3;
        draws.push((this.b(p) << 16) | (this.b(p + 1) << 8) | this.b(p + 2));
        p = WALL_OCCLUSION_MASKS + i * 3;
        occlusion.push((this.b(p) << 16) | (this.b(p + 1) << 8) | this.b(p + 2));
      }
      return {draws, occlusion};
    }

    static isWall(cell) { return (cell & 3) === 3; }

    static wallOverlay(cell) {
      if ((cell & 3) !== 3) return null;
      const family = cell & 0x60;
      const face = (cell >>> 3) & 3;
      if (family === 0x40) return {descriptor:SWITCH_DESC, face, kind:'switch', state:!!(cell & 0x80)};
      if (family === 0x20) return {descriptor:SOCKET_DESC, face, kind:'dark-fixture', state:!!(cell & 0x80)};
      if (family === 0x60) return {descriptor:SOCKET_DESC, face, kind:'socket', state:!!(cell & 0x80)};
      return null;
    }

    static overlayFaceForSlot(slot, playerFacing) {
      const sequence = [1,0,1,0,1,0,1,1,1,0,1,0,1,0,1,1,1,1,1];
      const side = sequence[slot];
      if (slot < 8) return (playerFacing + (side ? 1 : 2)) & 3;
      if (slot < 16) return (playerFacing + (side ? 3 : 2)) & 3;
      return (playerFacing + 2) & 3;
    }

    drawFloorFeature(buffer, cell, slot) {
      const key = cell & 0x38;
      const descriptor = FLOOR_FEATURE_DESC.get(key);
      if (descriptor != null) this.drawF097(buffer, descriptor, slot);
      return descriptor == null ? null : descriptor;
    }

    drawDoorStatic(buffer, slot) { this.drawF097(buffer, DOOR_DESC, slot); }

    renderScene(tape, tower, floor, x, y, facing, options) {
      const buffer = this.makeBackground(x, y, facing);
      const layers = options && options.layers ? options.layers : {};
      const offsets = this.sampleOffsets(facing);
      const cells = [];
      for (let i = 0; i < 13; i++) {
        const [dx, dy] = offsets[i];
        let value = 0x03;
        try {
          const cell = global.BWBloodwych && global.BWBloodwych.getCell
            ? global.BWBloodwych.getCell(tape, tower, floor, x + dx, y + dy)
            : null;
          if (cell) value = cell.value & 0xFF;
        } catch (_) { value = 0x03; }
        cells.push(value);
      }

      const masks = this.wallMasks();
      let visible = (1 << 19) - 1, wallBits = 0;
      for (let i = 0; i < 13; i++) {
        if (!DungeonRenderer.isWall(cells[i])) continue;
        wallBits |= masks.draws[i];
        visible &= masks.occlusion[i];
      }
      wallBits &= visible;

      const open = {closedDoor:false, ladderSupplement:false, doors:[]};
      for (let slot = 0; slot < 19; slot++) {
        if (((visible >>> slot) & 1) === 0) continue;
        const sample = this.slotToSample[slot], cell = cells[sample];
        if (((wallBits >>> slot) & 1) !== 0) {
          this.drawF097(buffer, WALL_DESC, slot);
          const overlay = DungeonRenderer.wallOverlay(cell);
          if (overlay && overlay.face === DungeonRenderer.overlayFaceForSlot(slot, facing)) {
            this.drawF097(buffer, overlay.descriptor, slot);
          }
          continue;
        }

        const base = cell & 3;
        const [dx, dy] = offsets[sample];
        const paintContext = {buffer, slot, sample, cell, floor, x:x+dx, y:y+dy, facing};

        // Proved non-wall painter architecture. Object/actor callbacks are
        // intentionally empty in this pass, but their positions are fixed here
        // so later layers do not have to restructure the compositor.
        if (base === 1) {
          this.drawFloorFeature(buffer, cell, slot);
          const key = cell & 0x38;
          if (key === 0x28 || key === 0x30) open.ladderSupplement = true;
        }
        if (typeof layers.backObjects === 'function') layers.backObjects(paintContext);
        if (base === 2) {
          this.drawDoorStatic(buffer, slot);
          const closed = !!(cell & 0x10);
          open.doors.push({slot, sample, cell, closed});
          if (closed) open.closedDoor = true;
        }
        if (typeof layers.frontObjects === 'function') layers.frontObjects(paintContext);
        if (typeof layers.actor === 'function') layers.actor(paintContext);
      }
      return {buffer, cells, visible, wallBits, open};
    }
  }

  function parseDungeonSlotMapCsv(text) {
    const rows = String(text).trim().split(/\r?\n/);
    if (!rows.length || rows[0].split(',').slice(0,2).join(',') !== 'slot,sample') throw new Error('Unexpected dungeon_view_slots.csv header.');
    const pairs = rows.slice(1).filter(Boolean).map(row => {
      const cols = row.split(',');
      return [Number(cols[0]), Number(cols[1])];
    }).filter(([slot,sample]) => Number.isInteger(slot) && Number.isInteger(sample));
    pairs.sort((a,b)=>a[0]-b[0]);
    if (pairs.length !== 19 || pairs.some(([slot],i)=>slot!==i)) throw new Error(`Expected 19 sequential dungeon slots; found ${pairs.length}.`);
    return pairs.map(([,sample])=>sample);
  }

  async function loadDungeonSlotMap() {
    const response = await fetch(sourceUrl(SLOT_MAP_URL));
    if (!response.ok) throw new Error(`Could not load dungeon slot reference table (${response.status}).`);
    return parseDungeonSlotMapCsv(await response.text());
  }

  function gameImageFromTapeBuffer(buffer) {
    if (!global.BWTap || !global.BWTap.parseTape) throw new Error('BWTap is not available.');
    const tape = global.BWTap.parseTape(buffer);
    const candidates = (tape.blocks || []).filter(b => b.raw && b.raw.length === GAME_SIZE + 2 && b.raw[0] === 0xFF);
    if (candidates.length !== 1) throw new Error(`Expected one $A500 Game payload; found ${candidates.length}.`);
    const raw = candidates[0].raw;
    if (xorBytes(raw) !== 0) throw new Error('Game main-block parity/XOR failed.');
    return new GameImage(raw.slice(1, raw.length - 1));
  }

  async function loadBundledGameImage() {
    const response = await fetch(sourceUrl(GAME_TZX_URL));
    if (!response.ok) throw new Error(`Could not load bundled Game TZX (${response.status}).`);
    return gameImageFromTapeBuffer(await response.arrayBuffer());
  }

  const api = {
    W, H, STRIDE, GAME_BASE, GAME_SIZE,
    GameImage, MonoBuffer, DungeonRenderer,
    parseDungeonSlotMapCsv, gameImageFromTapeBuffer,
    bitReverse, f097Transform, s8, moveInViewDirection,
    loadBundledGameImage, loadDungeonSlotMap, sourceUrl
  };
  global.BWDungeonRenderer = api;

  if (typeof document === 'undefined' || !global.BWRenderer || typeof global.BWRenderer.render !== 'function') return;

  let latest = null, facing = 0, gamePromise = null, slotMapPromise = null, engine = null, renderQueued = false;
  let activeGameImage = null, activeGameSourceName = null;
  const originalMapRender = global.BWRenderer.render;

  function updateGameSourceUi(message, warning) {
    const label = typeof document !== 'undefined' ? document.getElementById('gameSourceName') : null;
    if (label) {
      label.textContent = message;
      label.classList.toggle('warn', !!warning);
    }
  }

  function setActiveGameImage(game, label) {
    activeGameImage = game;
    activeGameSourceName = label || 'Game TZX';
    api.activeGameSourceName = activeGameSourceName;
    engine = null;
    gamePromise = null;
    updateGameSourceUi(`Game: ${activeGameSourceName}`, false);
    scheduleRender();
    return game;
  }

  async function useBundledGame() {
    updateGameSourceUi('Game: loading repository default…', false);
    try {
      const game = await loadBundledGameImage();
      return setActiveGameImage(game, 'Bloodwych - The Game [ZX Spectrum].tzx');
    } catch (err) {
      updateGameSourceUi(`Game: load failed — ${err.message}`, true);
      throw err;
    }
  }

  async function useGameTapeBuffer(buffer, label) {
    try {
      return setActiveGameImage(gameImageFromTapeBuffer(buffer), label || 'modified Game TZX');
    } catch (err) {
      updateGameSourceUi(`Game: invalid override — ${err.message}`, true);
      throw err;
    }
  }

  async function preloadBundledSources() {
    if (!slotMapPromise) slotMapPromise = loadDungeonSlotMap().catch(err => { slotMapPromise = null; throw err; });
    const game = activeGameImage ? Promise.resolve(activeGameImage) : useBundledGame();
    await Promise.all([game, slotMapPromise]);
    return true;
  }

  api.useBundledGame = useBundledGame;
  api.useGameTapeBuffer = useGameTapeBuffer;
  api.preloadBundledSources = preloadBundledSources;
  api.activeGameSourceName = activeGameSourceName;

  function installGameSourceControls() {
    const input = document.getElementById('gameFile');
    if (input && !input.__bwDungeonGameHook) {
      input.addEventListener('change', async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        try { await useGameTapeBuffer(await file.arrayBuffer(), file.name); }
        catch (err) { console.error(err); setUiLoading(`Game TZX override failed: ${err.message}`, true); }
      });
      input.__bwDungeonGameHook = true;
    }
    const bundled = document.getElementById('loadBundledGame');
    if (bundled && !bundled.__bwDungeonGameHook) {
      bundled.addEventListener('click', () => useBundledGame().catch(err => { console.error(err); setUiLoading(`Bundled Game TZX failed: ${err.message}`, true); }));
      bundled.__bwDungeonGameHook = true;
    }
  }

  function ensureUi() {
    installGameSourceControls();
    const host = document.querySelector('.dungeon-placeholder');
    if (!host) return null;
    if (host.dataset.bwDungeonReady === '1') return host;
    host.dataset.bwDungeonReady = '1';
    host.innerHTML = `
      <h3>3D DUNGEON VIEW</h3>
      <div class="bw-dungeon-frame"><canvas id="bwDungeonCanvas" width="104" height="64" aria-label="Bloodwych ZX first-person dungeon viewport"></canvas></div>
      <div class="bw-dungeon-face" aria-label="Facing">
        ${FACE_NAMES.map((n,i)=>`<button type="button" data-bw-face="${i}">${n}</button>`).join('')}
      </div>
      <div class="bw-dungeon-nav" aria-label="Dungeon cursor navigation">
        <button type="button" data-bw-nav="turn-left" title="Q · Turn left"><kbd>Q</kbd><span>Turn left</span></button>
        <button type="button" data-bw-nav="forward" title="W · Move cursor forward"><kbd>W</kbd><span>Forward</span></button>
        <button type="button" data-bw-nav="turn-right" title="E · Turn right"><kbd>E</kbd><span>Turn right</span></button>
        <button type="button" data-bw-nav="left" title="A · Strafe cursor left"><kbd>A</kbd><span>Left</span></button>
        <button type="button" data-bw-nav="back" title="S · Move cursor backward"><kbd>S</kbd><span>Back</span></button>
        <button type="button" data-bw-nav="right" title="D · Strafe cursor right"><kbd>D</kbd><span>Right</span></button>
      </div>
      <div class="bw-dungeon-keyhelp">Q/E turn · W/S forward/back · A/D strafe · arrows move absolute</div>
      <div id="bwDungeonMeta" class="bw-dungeon-meta">Select a map cell.</div>
      <div id="bwDungeonGap" class="bw-dungeon-gap">Source-backed geometry renderer. Objects and actors are intentionally omitted in this pass.</div>`;
    host.addEventListener('click', event => {
      const faceButton = event.target.closest('[data-bw-face]');
      if (faceButton) {
        facing = Number(faceButton.dataset.bwFace) & 3;
        scheduleRender();
        return;
      }
      const nav = event.target.closest('[data-bw-nav]');
      if (!nav || !latest || !latest.options || !latest.options.selected) return;
      navigateCursor(nav.dataset.bwNav);
    });
    return host;
  }


  function navigateCursor(action) {
    if (!latest || !latest.options || !latest.options.selected) return false;
    if (action === 'turn-left') { facing = (facing + 3) & 3; scheduleRender(); return true; }
    if (action === 'turn-right') { facing = (facing + 1) & 3; scheduleRender(); return true; }
    const pos = latest.options.selected;
    let lateral = 0, forward = 0;
    if (action === 'forward') forward = 1;
    else if (action === 'back') forward = -1;
    else if (action === 'left') lateral = -1;
    else if (action === 'right') lateral = 1;
    else return false;
    const target = moveInViewDirection(pos.x, pos.y, facing, lateral, forward);
    moveMapSelection(target[0], target[1]);
    return true;
  }

  function moveMapSelectionAbsolute(dx, dy) {
    if (!latest || !latest.options || !latest.options.selected) return false;
    const pos = latest.options.selected;
    moveMapSelection(pos.x + dx, pos.y + dy);
    return true;
  }

  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
    const key = event.key.toLowerCase();
    const action = {q:'turn-left', w:'forward', e:'turn-right', a:'left', s:'back', d:'right'}[key];
    let handled = action ? navigateCursor(action) : false;
    if (!handled) {
      if (event.key === 'ArrowUp') handled = moveMapSelectionAbsolute(0, -1);
      else if (event.key === 'ArrowDown') handled = moveMapSelectionAbsolute(0, 1);
      else if (event.key === 'ArrowLeft') handled = moveMapSelectionAbsolute(-1, 0);
      else if (event.key === 'ArrowRight') handled = moveMapSelectionAbsolute(1, 0);
    }
    if (handled) event.preventDefault();
  });

  function moveMapSelection(x, y) {
    if (!latest || !latest.floor || !latest.canvas || !latest.metrics) return;
    const floor = latest.floor;
    if (x < 0 || y < 0 || x >= floor.width || y >= floor.height) return;
    const canvas = latest.canvas, metrics = latest.metrics, rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const px = metrics.marginLeft + (metrics.originX + x + 0.5) * metrics.cellSize;
    const py = metrics.marginTop + (metrics.originY + y + 0.5) * metrics.cellSize;
    canvas.dispatchEvent(new MouseEvent('click', {
      bubbles:true,
      clientX:rect.left + px * rect.width / canvas.width,
      clientY:rect.top + py * rect.height / canvas.height
    }));
  }

  function setUiLoading(message, warning) {
    ensureUi();
    const meta = document.getElementById('bwDungeonMeta');
    if (meta) { meta.textContent = message; meta.classList.toggle('warn', !!warning); }
  }

  function getEngine() {
    if (engine) return Promise.resolve(engine);
    if (!slotMapPromise) slotMapPromise = loadDungeonSlotMap().catch(err => { slotMapPromise = null; throw err; });
    if (!gamePromise) {
      const game = activeGameImage ? Promise.resolve(activeGameImage) : useBundledGame();
      gamePromise = Promise.all([game, slotMapPromise]).catch(err => { gamePromise = null; throw err; });
    }
    return gamePromise.then(([game, slotMap]) => (engine = new DungeonRenderer(game, slotMap)));
  }

  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    const run = () => { renderQueued = false; renderLatest(); };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run); else setTimeout(run, 0);
  }

  async function renderLatest() {
    const host = ensureUi();
    if (!host || !latest) return;
    const selected = latest.options && latest.options.selected;
    const canvas = document.getElementById('bwDungeonCanvas');
    const meta = document.getElementById('bwDungeonMeta');
    const gap = document.getElementById('bwDungeonGap');
    host.querySelectorAll('[data-bw-face]').forEach(b => b.classList.toggle('active', Number(b.dataset.bwFace) === facing));
    if (!selected) {
      if (canvas) { const ctx = canvas.getContext('2d'); ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height); }
      if (meta) meta.textContent = 'Select a map cell to place the 3D cursor.';
      return;
    }

    setUiLoading(activeGameSourceName ? `Rendering with ${activeGameSourceName}…` : 'Loading source Game graphics…', false);
    try {
      const renderer = await getEngine();
      if (!latest || !latest.options || !latest.options.selected) return;
      const pos = latest.options.selected;
      const scene = renderer.renderScene(latest.tape, latest.tower, latest.floor, pos.x, pos.y, facing);
      scene.buffer.paint(canvas);
      if (meta) {
        meta.classList.remove('warn');
        meta.textContent = `${latest.tower.name} · Floor ${latest.floor.floorIndex} · X ${pos.x}, Y ${pos.y} · Facing ${FACE_NAMES[facing]}`;
      }
      if (gap) {
        const notes = [];
        if (scene.open.closedDoor) {
          const count = scene.open.doors.filter(d => d.closed).length;
          notes.push(`Closed door${count===1?'':'s'} detected (${count} visible): static $897B component rendered; source procedural panel/bars remain OPEN.`);
        }
        if (scene.open.ladderSupplement) notes.push('Ladder: static source family rendered; procedural supplement remains OPEN.');
        if (!notes.length) notes.push('Source-backed background, walls, occlusion and static environmental layers active.');
        gap.textContent = notes.join(' ');
        gap.classList.toggle('warn', !!(scene.open.closedDoor || scene.open.ladderSupplement));
      }
    } catch (err) {
      console.error(err);
      if (meta) { meta.textContent = `3D renderer unavailable: ${err.message}`; meta.classList.add('warn'); }
      if (gap) { gap.textContent = 'No substitute graphics were drawn.'; gap.classList.add('warn'); }
    }
  }

  global.BWRenderer.render = function (canvas, tape, tower, floor, options) {
    const metrics = originalMapRender.apply(this, arguments);
    latest = {
      canvas, tape, tower, floor,
      options:Object.assign({}, options || {}, {selected:options && options.selected ? {x:options.selected.x, y:options.selected.y} : null}),
      metrics
    };
    scheduleRender();
    return metrics;
  };

  ensureUi();
})(typeof window !== 'undefined' ? window : globalThis);
