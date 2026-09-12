#!/usr/bin/env node
'use strict';

const assert = require('assert');

// Regression: isolate the renderer-owned blink timer and the MAPS property
// MutationObserver self-loop that previously froze wall-cell selection.
const nativeSetInterval = global.setInterval;
const nativeMutationObserver = global.MutationObserver;
const nativeRequestAnimationFrame = global.requestAnimationFrame;
const rafQueue = [];
class FakeMutationObserver {
  constructor(callback){ this.callback = callback; this.target = null; this.options = null; }
  observe(target, options){ this.target = target; this.options = options; }
  fire(records=[{type:'childList'}]){ this.callback(records, this); }
  disconnect(){}
}
global.MutationObserver = FakeMutationObserver;
global.requestAnimationFrame = fn => { rafQueue.push(fn); return rafQueue.length; };
require('../js/map-renderer-guard.js');
const suppressed = global.setInterval(function(){ const lastRenderState=true; const marker='__blinkRedraw'; return lastRenderState && marker; }, 450);
assert.strictEqual(suppressed, 0);
assert.strictEqual(global.__bwMapBlinkSuppressed, true);

let observerPasses = 0;
const observer = new global.MutationObserver(()=>{ observerPasses++; });
observer.observe({id:'cellProperties'}, {childList:true, subtree:true});
assert.strictEqual(global.__bwCellPropertyObserverGuarded, true);
observer.fire();
observer.fire(); // self-mutation delivered before next animation frame
assert.strictEqual(observerPasses, 1);
assert.strictEqual(rafQueue.length, 1);
rafQueue.shift()();
observer.fire(); // a genuine later app update must still be handled
assert.strictEqual(observerPasses, 2);

global.__bwRestoreMapTimerGuard();
assert.strictEqual(global.setInterval, nativeSetInterval);
assert.strictEqual(global.MutationObserver, FakeMutationObserver);
global.MutationObserver = nativeMutationObserver;
global.requestAnimationFrame = nativeRequestAnimationFrame;

require('../js/dungeon-renderer.js');
const D = global.BWDungeonRenderer;
assert(D, 'BWDungeonRenderer export missing');

assert.strictEqual(D.W, 104);
assert.strictEqual(D.H, 64);
assert.strictEqual(D.STRIDE, 13);
const slotCsv = `slot,sample,depth_raw\n0,0,$F3\n1,1,$03\n2,1,$F3\n3,2,$02\n4,2,$F2\n5,3,$01\n6,3,$F1\n7,4,$F0\n8,5,$F3\n9,6,$03\n10,6,$F3\n11,7,$02\n12,7,$F2\n13,8,$01\n14,8,$F1\n15,9,$F0\n16,10,$03\n17,11,$02\n18,12,$01`;
const slotMap = D.parseDungeonSlotMapCsv(slotCsv);
assert.deepStrictEqual(slotMap, [0,1,1,2,2,3,3,4,5,6,6,7,7,8,8,9,10,11,12]);
assert.strictEqual(D.bitReverse(0x80), 0x01);
assert.strictEqual(D.bitReverse(0x55), 0xAA);
assert.strictEqual(D.s8(0xFF), -1);
assert.strictEqual(D.s8(0x7F), 127);

// Game-TZX override parser accepts the same unique $A500 flagged block as the
// bundled loader.  Parity is checked before the image becomes active.
const fakeRaw = new Uint8Array(D.GAME_SIZE + 2);
fakeRaw[0] = 0xFF; fakeRaw[fakeRaw.length - 1] = 0xFF;
global.BWTap = {parseTape(){ return {blocks:[{raw:fakeRaw}]}; }};
const parsedOverride = D.gameImageFromTapeBuffer(new ArrayBuffer(0));
assert(parsedOverride instanceof D.GameImage);
assert.strictEqual(parsedOverride.data.length, D.GAME_SIZE);

// Match the 68k Python map editor's view-relative QWEASD navigation frame.
assert.deepStrictEqual(D.moveInViewDirection(10,10,0,0,1), [10,9]);   // N forward
assert.deepStrictEqual(D.moveInViewDirection(10,10,0,-1,0), [9,10]); // N strafe left
assert.deepStrictEqual(D.moveInViewDirection(10,10,1,0,1), [11,10]); // E forward
assert.deepStrictEqual(D.moveInViewDirection(10,10,2,0,1), [10,11]); // S forward
assert.deepStrictEqual(D.moveInViewDirection(10,10,3,-1,0), [10,11]); // W strafe left

// F097's transform is destination-sensitive, but must always stay byte-sized.
for (const s of [0x00,0x55,0xAA,0xFF]) for (const d of [0x00,0x33,0xCC,0xFF]) {
  const v = D.f097Transform(s,d);
  assert(v >= 0 && v <= 0xFF);
}

// Synthetic $5B00-$FFFF image validates background parity and source-table access
// without depending on generated binary extracts.
const bytes = new Uint8Array(D.GAME_SIZE);
const off = a => a - D.GAME_BASE;
for (let i=0;i<27*13;i++) bytes[off(0x90B5)+i] = (i & 1) ? 0x81 : 0x24;
for (let i=0;i<18*13;i++) bytes[off(0x9214)+i] = (i & 1) ? 0x18 : 0x42;
for (let f=0;f<4;f++) for (let i=0;i<14;i++) {
  bytes[off(0x8FF7)+f*28+i*2] = i;
  bytes[off(0x8FF7)+f*28+i*2+1] = (256-i)&255;
}
const game = new D.GameImage(bytes), r = new D.DungeonRenderer(game, slotMap);
const direct = r.makeBackground(0,0,1), mirrored = r.makeBackground(0,0,0);
assert.strictEqual(direct.data.length, 13*64);
assert.strictEqual(direct.data[0], 0x24);
assert.strictEqual(mirrored.data[0], D.bitReverse(bytes[off(0x90B5)+12]));
assert.deepStrictEqual(r.sampleOffsets(2)[3], [3,-3]);

// Emulator validation: the completed work buffer is displayed bottom-to-top.
// A pixel authored in work-buffer row 0 must therefore appear on canvas row 63.
const displayBuf = new D.MonoBuffer();
displayBuf.data[0] = 0x80;
let painted = null;
const fakeCanvas = {
  width:0,height:0,
  getContext(){ return {
    imageSmoothingEnabled:false,
    createImageData(w,h){ return {data:new Uint8ClampedArray(w*h*4)}; },
    putImageData(image){ painted = image.data; }
  }; }
};
displayBuf.paint(fakeCanvas);
const rgba = (x,y) => painted[(y*D.W+x)*4];
assert.strictEqual(rgba(0,0), 0);
assert.strictEqual(rgba(0,D.H-1), 255);

// Emulator validation: central paired wall halves share one scanline origin.
// The earlier portable Y+1 companion interpretation caused a visible seam.
const pairBytes = new Uint8Array(D.GAME_SIZE);
const poff = a => a - D.GAME_BASE;
const descBase = 0xA100, graphic = 0xA200, pairSlot = 16;
pairBytes[poff(descBase + pairSlot*2)] = graphic & 255;
pairBytes[poff(descBase + pairSlot*2 + 1)] = graphic >>> 8;
pairBytes[poff(descBase + 0x28 + pairSlot*2)] = 3;
pairBytes[poff(descBase + 0x29 + pairSlot*2)] = 10;
pairBytes[poff(graphic)] = 1; pairBytes[poff(graphic+1)] = 1; pairBytes[poff(graphic+2)] = 0xFF;
const pairRenderer = new D.DungeonRenderer(new D.GameImage(pairBytes), slotMap);
const pairBuf = new D.MonoBuffer();
pairRenderer.drawF097(pairBuf, descBase, pairSlot);
assert.notStrictEqual(pairBuf.data[10*D.STRIDE+3], 0);
assert.notStrictEqual(pairBuf.data[10*D.STRIDE+9], 0);
assert.strictEqual(pairBuf.data[11*D.STRIDE+9], 0);

const switchCell = 0x43; // switch family, N face, state clear
const clickedSwitch = 0xC3;
const emptySocket = 0x63;
const filledSocket = 0xE3;
assert.strictEqual(D.DungeonRenderer.wallOverlay(switchCell).kind, 'switch');
assert.strictEqual(D.DungeonRenderer.wallOverlay(clickedSwitch).kind, 'switch');
assert.strictEqual(D.DungeonRenderer.wallOverlay(emptySocket).kind, 'socket');
assert.strictEqual(D.DungeonRenderer.wallOverlay(filledSocket).kind, 'socket');
assert.strictEqual(D.DungeonRenderer.wallOverlay(filledSocket).state, true);

console.log('dungeon renderer tests: OK');

// Painter-order regression: rear objects -> door -> front objects -> actor.
global.BWBloodwych = { getCell(){ return {value:0x12}; } }; // closed door, N/S axis
const order = [];
r.drawDoorStatic = () => order.push('door');
const fakeFloor = {width:1,height:1,floorIndex:0};
const scene = r.renderScene({}, {}, fakeFloor, 0, 0, 0, {layers:{
  backObjects(){ order.push('back'); },
  frontObjects(){ order.push('front'); },
  actor(){ order.push('actor'); }
}});
assert.strictEqual(scene.open.closedDoor, true);
assert.strictEqual(scene.open.doors.length, 19);
assert(scene.open.doors.every(d => d.closed && d.cell === 0x12));
assert.strictEqual(order.length, 19*4);
for (let i=0;i<19;i++) assert.deepStrictEqual(order.slice(i*4,i*4+4), ['back','door','front','actor']);

console.log('dungeon painter-order tests: OK');
