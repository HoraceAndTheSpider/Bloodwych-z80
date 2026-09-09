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
function sourceBytes(){return fs.readFileSync(SOURCE);}
function arrayBuffer(buf){return buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength);}
function load(){
  const src=sourceBytes();
  const tape=BWTap.parseTape(arrayBuffer(src));
  const session=new BWSession.EditSession();
  session.loadLevel(tape,'selftest');
  return {src,tape,session,towers:BWBloodwych.findTowers(tape)};
}
function towerById(state,id){return BWBloodwych.findTowers(state.tape).find(t=>t.id===id);}
function diffBytes(a,b){
  assert.strictEqual(a.length,b.length,'file length changed');
  const out=[];for(let i=0;i<a.length;i++)if(a[i]!==b[i])out.push(i);return out;
}
function rebuiltBuffer(session){return Buffer.from(session.rebuildLevelTape());}
function assertExactRoundTrip(state,msg){assert.deepStrictEqual(rebuiltBuffer(state.session),state.src,msg||'round-trip differs from source');}
function findCleanCell(tape,tower,floor,mask){
  for(let y=0;y<floor.height;y++)for(let x=0;x<floor.width;x++){
    const c=BWBloodwych.getCell(tape,tower,floor,x,y);
    if(c && !(c.value&mask) && !c.objectStacks.length && !c.monsters.length)return c;
  }
  throw new Error('no clean target cell found');
}
function test(name,fn){try{fn();console.log(`PASS  ${name}`);}catch(e){console.error(`FAIL  ${name}`);throw e;}}

const sha=crypto.createHash('sha256').update(sourceBytes()).digest('hex');
test('authoritative source SHA-256',()=>assert.strictEqual(sha,EXPECTED_SHA256));

test('parse ten complete level blocks with valid parity',()=>{
  const s=load();assert.strictEqual(s.towers.length,10);assert.ok(s.towers.every(t=>t.semanticAvailable));assert.ok(s.tape.blocks.every(b=>b.checksumValid));
  assert.deepStrictEqual(s.towers.map(t=>t.id),['d','e','f','g','h','i','j','k','l','m']);
});

test('all non-empty crystal/socket records resolve through 12-bit map offsets',()=>{
  const s=load();for(const t of s.towers)for(const sp of t.specials.crystal.filter(v=>!v.empty)){assert.ok(sp.source,`${t.id} special ${sp.index} did not resolve`);assert.strictEqual(sp.mapOffset,((sp.bytes[1]&0x0f)<<8)|sp.bytes[0]);assert.strictEqual(sp.variant,(sp.bytes[1]>>4)&0x0f);}
});

test('authoritative towers pass companion consistency audit',()=>{
  const s=load();for(const t of s.towers)assert.deepStrictEqual(BWBloodwych.audit(s.tape,t),[],`${t.id} audit warnings`);
});

test('unmodified export is byte-identical',()=>{const s=load();assertExactRoundTrip(s);assert.strictEqual(s.session.logicalDiff().length,0);assert.strictEqual(s.session.changedParityBlocks().length,0);});

test('known Stage 5 event capacities',()=>{
  const s=load();const got=Object.fromEntries(s.towers.map(t=>[t.id,[t.eventCapacity.used,t.eventCapacity.free,t.eventCapacity.normal]]));
  assert.deepStrictEqual(got,{d:[22,23,45],e:[23,22,45],f:[37,8,45],g:[11,34,45],h:[32,13,45],i:[27,18,45],j:[22,23,45],k:[45,0,45],l:[28,17,45],m:[36,0,36]});
});

test('Archaus full and Zendik tail protected',()=>{
  const s=load(),k=towerById(s,'k'),m=towerById(s,'m');assert.strictEqual(BWBloodwych.firstFreeEventSlot(k),null);assert.strictEqual(BWBloodwych.firstFreeEventSlot(m),null);
  assert.ok(m.events.slice(36).every(e=>e.protected));
  assert.throws(()=>s.session.transact('bad zendik',()=>BWBloodwych.writeEvent(s.session,m,36,{sourceOffset:0,action:0,targetFloor:0,targetX:0,targetY:0})),/protected/);
  assertExactRoundTrip(s,'protected event write was not rolled back');
});

test('raw map edit changes one data byte plus affected parity only',()=>{
  const s=load(),t=towerById(s,'d'),f=t.floors[0],c=BWBloodwych.getCell(s.tape,t,f,0,0),before=s.src;
  s.session.transact('raw map',()=>BWBloodwych.writeCell(s.session,t,f,0,0,c.value^1,{kind:'raw-map'}));
  const out=rebuiltBuffer(s.session),diff=diffBytes(before,out),block=s.tape.blocks[t.blockIndex],parityOffset=block.fileOffset+block.length-1;
  assert.deepStrictEqual(diff.sort((a,b)=>a-b),[c.fileOffset,parityOffset].sort((a,b)=>a-b));assert.ok(block.checksumValid);
  s.session.undo();assertExactRoundTrip(s,'raw map undo did not restore exact source');
});

test('event semantic edit is source-offset keyed and undo-exact',()=>{
  const s=load(),t=towerById(s,'d'),e=t.events.find(q=>q.normal&&!q.empty),old=e.raw.slice();
  s.session.transact('event target',()=>BWBloodwych.writeEvent(s.session,t,e.slot,{sourceOffset:e.sourceOffset,action:e.action,targetFloor:e.targetFloor,targetX:e.targetX,targetY:(e.targetY+1)&255}));
  const t2=towerById(s,'d'),e2=t2.events[e.slot];assert.strictEqual(e2.sourceOffset,e.sourceOffset);assert.strictEqual(e2.targetY,(e.targetY+1)&255);assert.notDeepStrictEqual(e2.raw,old);
  s.session.undo();assertExactRoundTrip(s,'event undo did not restore exact source');
});

test('event add uses a real free slot and undo restores it',()=>{
  const s=load(),t=towerById(s,'d'),slot=BWBloodwych.firstFreeEventSlot(t),f=t.floors[0],c=BWBloodwych.getCell(s.tape,t,f,0,0);assert.notStrictEqual(slot,null);
  s.session.transact('event add',()=>BWBloodwych.writeEvent(s.session,t,slot,{sourceOffset:c.mapOffset,action:0,targetFloor:0,targetX:0,targetY:0}));
  const t2=towerById(s,'d');assert.strictEqual(t2.eventCapacity.used,t.eventCapacity.used+1);assert.strictEqual(t2.events[slot].sourceOffset,c.mapOffset);
  s.session.undo();assertExactRoundTrip(s);
});

test('object move maintains bit 2 without rewriting free arena tail',()=>{
  const s=load(),t=towerById(s,'d'),stack=t.objects.stacks[0],src=stack.source,srcFloor=t.floors[src.floorIndex],target=findCleanCell(s.tape,t,srcFloor,0x04),oldUsed=t.objects.used;
  const block=s.tape.blocks[t.blockIndex],freeStart=BWBloodwych.rawOffset(BWBloodwych.OBJECT_BASE+oldUsed),freeBefore=block.raw.slice(freeStart,BWBloodwych.rawOffset(BWBloodwych.OBJECT_BASE+BWBloodwych.OBJECT_ARENA_SIZE));
  s.session.transact('object move',()=>BWBloodwych.moveObjectStack(s.session,t,stack.index,srcFloor,target.x,target.y,stack.position));
  const t2=towerById(s,'d'),moved=t2.objects.stacks[0],oldCell=BWBloodwych.getCell(s.tape,t2,t2.floors[src.floorIndex],src.x,src.y),newCell=BWBloodwych.getCell(s.tape,t2,t2.floors[src.floorIndex],target.x,target.y);
  assert.strictEqual(moved.source.x,target.x);assert.strictEqual(moved.source.y,target.y);assert.strictEqual(oldCell.value&0x04,0);assert.strictEqual(newCell.value&0x04,0x04);
  const freeAfter=s.tape.blocks[t2.blockIndex].raw.slice(freeStart,BWBloodwych.rawOffset(BWBloodwych.OBJECT_BASE+BWBloodwych.OBJECT_ARENA_SIZE));assert.deepStrictEqual(freeAfter,freeBefore);
  s.session.undo();assertExactRoundTrip(s,'object move undo did not restore exact source');
});

test('object item growth consumes only newly used free bytes',()=>{
  const s=load(),t=towerById(s,'d'),stack=t.objects.stacks[0],oldUsed=t.objects.used,newUsed=oldUsed+2,block=s.tape.blocks[t.blockIndex];
  const preservedStart=BWBloodwych.rawOffset(BWBloodwych.OBJECT_BASE+newUsed),preservedBefore=block.raw.slice(preservedStart,BWBloodwych.rawOffset(BWBloodwych.OBJECT_BASE+BWBloodwych.OBJECT_ARENA_SIZE));
  const items=stack.items.map(i=>({code:i.code,state:i.state}));items.push({code:0x12,state:0x34});
  s.session.transact('object grow',()=>BWBloodwych.replaceObjectStack(s.session,t,0,stack.position,items));
  const t2=towerById(s,'d');assert.strictEqual(t2.objects.used,newUsed);assert.strictEqual(t2.objects.stacks[0].items.length,stack.items.length+1);
  const preservedAfter=s.tape.blocks[t2.blockIndex].raw.slice(preservedStart,BWBloodwych.rawOffset(BWBloodwych.OBJECT_BASE+BWBloodwych.OBJECT_ARENA_SIZE));assert.deepStrictEqual(preservedAfter,preservedBefore);
  s.session.undo();assertExactRoundTrip(s,'object grow undo did not restore exact source');
});

test('monster move preserves object flag and maintains occupancy bit 7',()=>{
  const s=load(),t=towerById(s,'d'),m=t.monsters.find(q=>q.active&&!q.unused&&q.x!==0xff),oldFloor=t.floors[m.floorIndex],oldCell0=BWBloodwych.getCell(s.tape,t,oldFloor,m.x,m.y),target=findCleanCell(s.tape,t,oldFloor,0x80);
  s.session.transact('monster move',()=>BWBloodwych.moveMonster(s.session,t,m.index,oldFloor,target.x,target.y,m.rotation));
  const t2=towerById(s,'d'),m2=t2.monsters[m.index],oldCell=BWBloodwych.getCell(s.tape,t2,t2.floors[m.floorIndex],m.x,m.y),newCell=BWBloodwych.getCell(s.tape,t2,t2.floors[m.floorIndex],target.x,target.y);
  assert.strictEqual(m2.x,target.x);assert.strictEqual(m2.y,target.y);assert.strictEqual(oldCell.value&0x80,0);assert.strictEqual(newCell.value&0x80,0x80);assert.strictEqual(oldCell.value&0x04,oldCell0.value&0x04,'object flag was damaged when clearing occupancy');
  s.session.undo();assertExactRoundTrip(s,'monster move undo did not restore exact source');
});

test('team edit validates members and is undo-exact',()=>{
  const s=load(),t=towerById(s,'d'),row=t.teams[0].members.slice(),swapped=[row[1],row[0],row[2],row[3]];
  s.session.transact('team swap',()=>BWBloodwych.writeTeam(s.session,t,0,swapped));assert.deepStrictEqual(towerById(s,'d').teams[0].members,swapped);s.session.undo();assertExactRoundTrip(s);
  assert.throws(()=>s.session.transact('bad team',()=>BWBloodwych.writeTeam(s.session,t,0,[3,3,0xff,0xff])),/twice/);assertExactRoundTrip(s);
});

test('layout starts/progression/special locations are semantic and undo-exact',()=>{
  const s=load();let t=towerById(s,'d'),p=t.playerStarts[0];
  s.session.transact('start',()=>BWBloodwych.writePlayerStart(s.session,t,1,(p.x+1)&255,p.y,p.floorIndex));assert.strictEqual(towerById(s,'d').playerStarts[0].x,(p.x+1)&255);s.session.undo();assertExactRoundTrip(s);
  t=towerById(s,'d');s.session.transact('progression',()=>BWBloodwych.writeProgression(s.session,t,(t.progression+1)&255));assert.strictEqual(towerById(s,'d').progression,(t.progression+1)&255);s.session.undo();assertExactRoundTrip(s);
  t=towerById(s,'e');const tp=t.specials.teleports[0];s.session.transact('teleport semantic pair',()=>BWBloodwych.writeTeleportPair(s.session,t,tp.pair,true,tp.aCoord.x+1,tp.aCoord.y,tp.bCoord.x,tp.bCoord.y));let t2=towerById(s,'e');assert.strictEqual(t2.specials.teleports[0].aCoord.x,tp.aCoord.x+1);assert.strictEqual(t2.specials.teleports[0].aCoord.y,tp.aCoord.y);s.session.undo();assertExactRoundTrip(s);
  t=towerById(s,'e');const sp=t.specials.crystal.find(v=>!v.empty),src=sp.source,newX=src.x+1;s.session.transact('crystal semantic location',()=>BWBloodwych.writeSpecialLocation(s.session,t,sp.index,true,src.floorIndex,newX,src.y,(sp.variant+1)&15));t2=towerById(s,'e');const sp2=t2.specials.crystal[sp.index];assert.deepStrictEqual(sp2.source,{floorIndex:src.floorIndex,x:newX,y:src.y,cellIndex:src.cellIndex+1});assert.strictEqual(sp2.variant,(sp.variant+1)&15);assert.strictEqual(sp2.mapOffset,BWBloodwych.mapOffsetForCell(t2.floors[src.floorIndex],newX,src.y));s.session.undo();assertExactRoundTrip(s);
  const m=towerById(s,'m');assert.throws(()=>s.session.transact('zendik progression',()=>BWBloodwych.writeProgression(s.session,m,0)),/exceptional/);assertExactRoundTrip(s);
});

test('Zendik protected ending text bytes survive unrelated edits',()=>{
  const s=load(),m=towerById(s,'m'),block=s.tape.blocks[m.blockIndex],start=BWBloodwych.rawOffset(BWBloodwych.EVENT_BASE+36*4),before=block.raw.slice(start,BWBloodwych.rawOffset(BWBloodwych.EVENT_BASE+BWBloodwych.EVENT_COUNT*4));
  const f=m.floors[0],c=BWBloodwych.getCell(s.tape,m,f,0,0);s.session.transact('unrelated zendik map',()=>BWBloodwych.writeCell(s.session,m,f,0,0,c.value^1));
  const after=s.tape.blocks[m.blockIndex].raw.slice(start,BWBloodwych.rawOffset(BWBloodwych.EVENT_BASE+BWBloodwych.EVENT_COUNT*4));assert.deepStrictEqual(after,before);s.session.undo();assertExactRoundTrip(s);
});

test('semantic validators reject overflow/invalid geometry without residue',()=>{
  let s=load(),t=towerById(s,'d'),stack=t.objects.stacks[0],tooMany=Array.from({length:126},(_,i)=>({code:i&255,state:0}));
  assert.throws(()=>s.session.transact('overflow objects',()=>BWBloodwych.replaceObjectStack(s.session,t,stack.index,stack.position,tooMany)),/capacity exceeded/);assertExactRoundTrip(s);
  s=load();t=towerById(s,'d');assert.throws(()=>s.session.transact('bad floor',()=>BWBloodwych.writeFloorDescriptor(s.session,t,0,{width:255,height:255,dataOffset:0})),/exceeds/);assertExactRoundTrip(s);
  s=load();t=towerById(s,'d');assert.throws(()=>s.session.transact('bad start',()=>BWBloodwych.writePlayerStart(s.session,t,1,255,255,0)),/start X|start Y/);assertExactRoundTrip(s);
  s=load();t=towerById(s,'d');assert.throws(()=>s.session.transact('bad event',()=>BWBloodwych.writeEvent(s.session,t,0,{sourceOffset:0,action:3,targetFloor:0,targetX:0,targetY:0})),/even selector/);assertExactRoundTrip(s);
  s=load();t=towerById(s,'e');assert.throws(()=>s.session.transact('bad special',()=>BWBloodwych.writeSpecialLocation(s.session,t,0,true,1,255,255,0)),/Special-location X|Special-location Y/);assertExactRoundTrip(s);
});

console.log('\nStage 5 model/export self-test complete.');
