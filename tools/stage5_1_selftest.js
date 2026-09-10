#!/usr/bin/env node
'use strict';

const assert=require('assert');
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..');
global.window=global;
for(const file of ['tap.js','tiles.js','session.js','bloodwych.js']){
  vm.runInThisContext(fs.readFileSync(path.join(ROOT,'js',file),'utf8'),{filename:file});
}

const SOURCE=path.join(ROOT,'data','Bloodwych - Level Data [ZX Spectrum].tzx');
const EXPECTED_SHA256='25e716434acdb8220fa5ba1449b2247d20e2112578f20cb6e10cd69ff9cd1206';
function arrayBuffer(buf){return buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength);}
function load(){
  const src=fs.readFileSync(SOURCE);
  assert.strictEqual(crypto.createHash('sha256').update(src).digest('hex'),EXPECTED_SHA256,'unexpected authoritative Level Data TZX');
  const tape=BWTap.parseTape(arrayBuffer(src));
  const session=new BWSession.EditSession();session.loadLevel(tape,'stage5.1-selftest');
  return {src,tape,session,towers:BWBloodwych.findTowers(tape)};
}
function towerById(state,id){return state.towers.find(t=>t.id===id)||BWBloodwych.findTowers(state.tape).find(t=>t.id===id);}
function rebuilt(state){return Buffer.from(state.session.rebuildLevelTape());}
function test(name,fn){try{fn();console.log(`PASS  ${name}`);}catch(err){console.error(`FAIL  ${name}`);throw err;}}

// Pure map-byte regressions first: these do not depend on any particular map.
test('door axis/state/lock field and bit-7 exception',()=>{
  const ew=BWTiles.decode(0x3a); // known lock-1 E/W closed form
  assert.strictEqual(ew.baseType,2);assert.strictEqual(ew.orientation,'EW');assert.strictEqual(ew.closedBit,true);assert.strictEqual(ew.lockId,1);assert.strictEqual(ew.occupied,false);
  const ns=BWTiles.decode(0x52); // known lock-2 N/S closed form
  assert.strictEqual(ns.baseType,2);assert.strictEqual(ns.orientation,'NS');assert.strictEqual(ns.closedBit,true);assert.strictEqual(ns.lockId,2);assert.strictEqual(ns.occupied,false);
  const high=BWTiles.decode(0xda); // lock 6 includes byte bit 7
  assert.strictEqual(high.lockId,6);assert.strictEqual(high.occupied,false,'door bit 7 was incorrectly treated as actor occupancy');
  const open=BWTiles.decode(0x22);assert.strictEqual(open.orientation,'NS');assert.strictEqual(open.closedBit,false);assert.strictEqual(open.lockId,1);
});

test('filled crystal/gem socket family is directional 12-15',()=>{
  for(const [value,facing] of [[0x63,'N'],[0x6b,'E'],[0x73,'S'],[0x7b,'W']]){
    const t=BWTiles.decode(value);assert.strictEqual(t.baseType,3);assert.strictEqual(t.kind,'socket');assert.strictEqual(t.socketFilled,true);assert.strictEqual(t.facing,facing);
  }
});

test('special variants have Stage 5.1 friendly names',()=>{
  assert.deepStrictEqual(BWBloodwych.SPECIAL_VARIANTS.slice(0,6).map(v=>v.name),[
    'Serpent crystal','Chaos crystal','Dragon crystal','Moon crystal','Tan teleport gem','Bluish teleport gem'
  ]);
});

test('all authoritative special locations resolve to filled sockets',()=>{
  const state=load();let count=0;
  for(const t of state.towers){
    for(const sp of t.specials.crystal){
      if(sp.empty)continue;count++;assert.ok(sp.source,`${t.id} special ${sp.index} did not resolve`);
      const f=t.floors[sp.source.floorIndex],c=BWBloodwych.getCell(state.tape,t,f,sp.source.x,sp.source.y);
      assert.ok(c,`${t.id} special ${sp.index} cell unavailable`);
      assert.strictEqual(c.tile.kind,'socket',`${t.id} special ${sp.index} did not point at a socket`);
      assert.strictEqual(c.tile.socketFilled,true,`${t.id} special ${sp.index} did not point at a filled socket`);
      assert.ok(c.specialLocations.some(q=>q.index===sp.index),`${t.id} special ${sp.index} was not linked back to its cell`);
      assert.ok(sp.variant>=0&&sp.variant<=7);
    }
  }
  assert.ok(count>0,'no special locations were found');
});

test('continuation blocks corroborate tower-crystal variants',()=>{
  const state=load();
  const expected={f:0,l:1,j:2,h:3};
  for(const [id,variant] of Object.entries(expected)){
    const t=towerById(state,id),used=t.specials.crystal.filter(s=>!s.empty);
    assert.ok(used.length,`${id} has no special-location record`);
    assert.strictEqual(used[0].variant,variant,`${id} special variant changed`);
  }
});

test('Keep slots 16 and 18 are $09 pads using Tower-exit side action $22',()=>{
  const state=load(),t=towerById(state,'d');
  for(const slot of [16,18]){
    const e=t.events[slot];assert.ok(e&&!e.empty&&!e.protected);assert.strictEqual(e.action,0x22);assert.match(e.actionLabel,/Tower exit \/ progression side-pad/i);assert.ok(e.source);
    const f=t.floors[e.source.floorIndex],c=BWBloodwych.getCell(state.tape,t,f,e.source.x,e.source.y);
    assert.strictEqual(c.value&0x7f,0x09);assert.strictEqual(c.tile.kind,'pad');assert.strictEqual(c.tile.featureLabel,'Floor pad / trigger');
  }
  assert.deepStrictEqual([t.events[16].source,t.events[18].source].map(s=>[s.floorIndex,s.x,s.y]),[[2,8,1],[2,10,1]]);
});

test('semantic Monster move refuses a door without residue',()=>{
  const state=load(),t=towerById(state,'d');
  const monster=t.monsters.find(m=>m.active&&!m.unused&&m.x!==0xff);assert.ok(monster,'no positioned monster available');
  let target=null,targetFloor=null;
  for(const f of t.floors){if(!f.used)continue;for(let y=0;y<f.height&&!target;y++)for(let x=0;x<f.width;x++){
    const c=BWBloodwych.getCell(state.tape,t,f,x,y);if(c&&c.tile.baseType===2){target=c;targetFloor=f;break;}
  }}
  assert.ok(target,'no door cell available for regression test');
  assert.throws(()=>state.session.transact('bad monster door move',()=>BWBloodwych.moveMonster(state.session,t,monster.index,targetFloor,target.x,target.y,monster.rotation)),/door cell/i);
  assert.deepStrictEqual(rebuilt(state),state.src,'rejected Monster/door move left source changes');
});

test('Stage 5.1 no-op export is byte-identical',()=>{const state=load();assert.deepStrictEqual(rebuilt(state),state.src);});

console.log('\nStage 5.1 map/UI model regression self-test complete.');
