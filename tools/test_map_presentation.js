#!/usr/bin/env node
/* Focused regression checks for ZX map presentation/layout.
 * Run from repository root with: node tools/test_map_presentation.js
 */
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');

function legacyDecode(value){
  value&=255;
  const baseType=value&3,feature=(value>>3)&15;
  return {
    value,baseType,feature,hasObject:!!(value&4),occupied:baseType===2?false:!!(value&0x80),
    kind:['floor','floor-feature','door','wall'][baseType],featureLabel:'legacy',
    wallFeature:baseType===3?(feature===0?'plain':'other'):null,
    orientation:baseType===2?((value&8)?'EW':'NS'):null,
    closedBit:baseType===2?!!(value&0x10):null,
    lockId:baseType===2?((value>>5)&7):null
  };
}
function floor(floorIndex,width,height,xOffset,yOffset){return {floorIndex,used:true,width,height,xOffset,yOffset,_grid:new Uint8Array(width*height),_events:new Map()};}
function put(f,x,y,value){f._grid[y*f.width+x]=value;}
function putEvent(f,x,y,action){f._events.set(`${x}:${y}`,[{action}]);}

// Raw descriptor interpretation before renderer.js installs the proved +4/+5 correction.
const tower={floors:[floor(0,10,6,15,0),floor(1,21,21,0,0),floor(2,17,17,2,2)],playerStarts:[],specials:{crystal:[]}};
put(tower.floors[0],1,5,0x29);put(tower.floors[0],7,5,0x29);
put(tower.floors[1],1,20,0x31);put(tower.floors[1],7,20,0x31);

const context={console,window:null};context.window=context;
context.BWTiles={decode:legacyDecode};
context.BWBloodwych={
  findTowers(){return [tower];},parseTower(){return tower;},
  writeFloorDescriptor(_session,_tower,_index,fields){context.lastWrite=fields;},
  getCell(_tape,_tower,f,x,y){
    if(x<0||y<0||x>=f.width||y>=f.height)return null;
    const value=f._grid[y*f.width+x]||0;
    return {x,y,value,tile:context.BWTiles.decode(value),events:f._events.get(`${x}:${y}`)||[],objectStacks:[],monsters:[],specialLocations:[]};
  }
};
vm.createContext(context);
const rendererPath=path.join(__dirname,'..','js','renderer.js');
vm.runInContext(fs.readFileSync(rendererPath,'utf8'),context,{filename:rendererPath});

const parsed=context.BWBloodwych.findTowers({})[0];
assert.equal(parsed.floors[0].xOffset,0,'descriptor +5 is X');
assert.equal(parsed.floors[0].yOffset,15,'descriptor +4 is Y');
context.BWBloodwych.writeFloorDescriptor(null,parsed,0,{xOffset:3,yOffset:7});
assert.equal(context.lastWrite.xOffset,7,'Y must be written to source +4');
assert.equal(context.lastWrite.yOffset,3,'X must be written to source +5');

for(const value of [0x0b,0x0f,0x8b,0x8f])assert.equal(context.BWTiles.decode(value).presentationKind,'mindrock');
assert.equal(context.BWTiles.decode(0x03).presentationKind,'wall');
assert.equal(context.BWTiles.decode(0x83).presentationKind,'wall');
assert.equal(context.BWTiles.decode(0x07).presentationKind,'wall');
assert.equal(context.BWTiles.decode(0x01).presentationKind,'reserved');
assert.equal(context.BWTiles.decode(0x13).presentationKind,'unknown');
assert.equal(context.BWTiles.decode(0x19).presentationKind,'upper-hole');
assert.equal(context.BWTiles.decode(0x21).presentationKind,'pit');
assert.equal(context.BWTiles.decode(0x33).presentationKind,'dark-fixture');
assert.equal(context.BWTiles.decode(0x63).presentationKind,'socket-empty');
assert.equal(context.BWTiles.decode(0xe3).presentationKind,'socket-filled');
assert.equal(context.BWTiles.decode(0x43).presentationKind,'switch');
assert.equal(context.BWTiles.decode(0xc3).switchUsed,true);
assert.equal(context.BWTiles.decode(0x29).presentationKind,'stair-up');
assert.equal(context.BWTiles.decode(0x31).presentationKind,'stair-down');

const analysis=context.BWRenderer.layoutAnalysis({},parsed);
assert.equal(analysis.issues.length,0,'representative Serpents stair features should align');
assert.equal(analysis.links.length,2,'representative Serpents F0/F1 stairs should pair');

function recordingContext(){
  const calls=[],stack=[];let currentPoint=null;
  return {
    calls,imageSmoothingEnabled:false,globalAlpha:1,fillStyle:'',strokeStyle:'',lineWidth:1,font:'',textAlign:'',textBaseline:'',
    save(){stack.push({globalAlpha:this.globalAlpha,fillStyle:this.fillStyle,strokeStyle:this.strokeStyle,lineWidth:this.lineWidth,font:this.font,textAlign:this.textAlign,textBaseline:this.textBaseline});},
    restore(){Object.assign(this,stack.pop()||{});},
    fillRect(x,y,w,h){calls.push({op:'fillRect',x,y,w,h,colour:this.fillStyle,alpha:this.globalAlpha});},
    strokeRect(x,y,w,h){calls.push({op:'strokeRect',x,y,w,h,colour:this.strokeStyle,alpha:this.globalAlpha});},
    beginPath(){currentPoint=null;calls.push({op:'beginPath',colour:this.strokeStyle,alpha:this.globalAlpha});},
    moveTo(x,y){currentPoint={x,y};calls.push({op:'moveTo',x,y,colour:this.strokeStyle,alpha:this.globalAlpha});},
    lineTo(x,y){if(currentPoint)calls.push({op:'segment',x1:currentPoint.x,y1:currentPoint.y,x2:x,y2:y,colour:this.strokeStyle,alpha:this.globalAlpha});currentPoint={x,y};},
    stroke(){calls.push({op:'stroke',colour:this.strokeStyle,alpha:this.globalAlpha});},
    arc(x,y,r){calls.push({op:'arc',x,y,r,colour:this.fillStyle,alpha:this.globalAlpha});},
    fill(){calls.push({op:'fill',colour:this.fillStyle,alpha:this.globalAlpha});},
    fillText(v,x,y){calls.push({op:'text',v:String(v),x,y,colour:this.fillStyle,alpha:this.globalAlpha});},
    setLineDash(v){calls.push({op:'dash',v:[...v]});}
  };
}
function renderFloor(f,style,opts={}){
  const t={floors:[f],playerStarts:[],specials:{crystal:[]}},ctx=recordingContext(),canvas={width:0,height:0,getContext(){return ctx;}};
  const metrics=context.BWRenderer.render(canvas,{},t,f,Object.assign({cellSize:32,aligned:false,showGrid:true,style,mode:'viewer'},opts));
  return {ctx,canvas,metrics,t};
}

// Door lock: AMOS style keeps a full colour line through the barrier.
const df=floor(0,1,1,0,0);put(df,0,0,0x72); // base 2, N/S passage, closed, lock 3
const dr=renderFloor(df,'amiga',{showGrid:false});
assert(dr.ctx.calls.some(r=>r.op==='fillRect'&&r.colour==='#18c229'&&r.w>20&&r.h<10),'AMOS lock colour must form a line through the horizontal door');

// The three map styles must remain visually independent.
const mf=floor(0,2,1,0,0); // two floor cells exercise modern checkerboard
let rr=renderFloor(mf,'modern',{showGrid:false});
assert(rr.ctx.calls.some(c=>c.op==='fillRect'&&c.colour==='#f1f5f4'),'Modern keeps light floor treatment');
assert(rr.ctx.calls.some(c=>c.op==='fillRect'&&c.colour==='#e7eeec'),'Modern keeps alternating floor treatment');

const wf=floor(0,1,1,0,0);put(wf,0,0,0x03);
rr=renderFloor(wf,'modern',{showGrid:false});
assert(rr.ctx.calls.some(c=>c.op==='fillRect'&&c.colour==='#343b43'),'Modern wall keeps dark brick treatment');
rr=renderFloor(wf,'amstrad',{showGrid:false});
assert(rr.ctx.calls.some(c=>c.op==='segment'&&c.colour==='#ffffff'),'Amstrad wall keeps monochrome line treatment');
rr=renderFloor(wf,'amiga',{showGrid:false});
assert(rr.ctx.calls.some(c=>c.op==='fillRect'&&c.colour==='#aaaaaa'&&c.w===32&&c.h===32),'Amiga plain wall must fill the complete cell');

// Facing wall furniture remains style-specific: CPC uses its own white S glyph,
// Modern uses its teal block, and neither falls back to AMOS geometry.
const sf=floor(0,1,1,0,0);put(sf,0,0,0x43); // switch, north-facing
rr=renderFloor(sf,'amstrad',{showGrid:false});
const cpcSwitch=rr.ctx.calls.find(c=>c.op==='text'&&c.v==='S');
assert(cpcSwitch&&cpcSwitch.y<rr.metrics.marginTop+16,'Amstrad north-facing switch must remain a CPC-style S on the north wall face');
rr=renderFloor(sf,'modern',{showGrid:false});
assert(rr.ctx.calls.some(c=>c.op==='fillRect'&&c.colour==='#14b8a6'&&c.y<rr.metrics.marginTop+16),'Modern north-facing switch must use the modern teal fixture');

// Ladder family must stay a ladder (two long vertical rails + rungs), not the
// AMOS stair-step glyph.
const lf=floor(0,1,1,0,0);put(lf,0,0,0x29);
for(const style of ['amiga','amstrad','modern']){
  rr=renderFloor(lf,style,{showGrid:false});
  const longVertical=rr.ctx.calls.filter(c=>c.op==='segment'&&Math.abs(c.x1-c.x2)<.01&&Math.abs(c.y2-c.y1)>16);
  assert(longVertical.length>=2,`${style} $29 must retain two ladder rails`);
}

// Grid must be drawn after style fills so it cannot disappear underneath them.
rr=renderFloor(wf,'modern',{showGrid:true});
const lastBaseFill=Math.max(...rr.ctx.calls.map((c,i)=>c.op==='fillRect'?i:-1));
const modernGridIndex=rr.ctx.calls.findIndex((c,i)=>i>lastBaseFill&&c.op==='strokeRect'&&c.colour==='#c5cdd3');
assert(modernGridIndex>lastBaseFill,'Modern grid must be painted after cell artwork');
rr=renderFloor(wf,'amiga',{showGrid:true});
assert(rr.ctx.calls.some(c=>c.op==='strokeRect'&&c.colour==='#303030'),'Amiga grid must remain visible');
rr=renderFloor(wf,'amstrad',{showGrid:true});
assert(rr.ctx.calls.some(c=>c.op==='strokeRect'&&c.colour==='#3f3f7f'),'Amstrad grid must remain visible');

// Aligned presentation uses a fixed world canvas, but only the selected-floor
// cells receive the strong/editable grid.
const gf=floor(0,2,3,20,15),other=floor(1,9,8,0,0),gt={floors:[gf,other],playerStarts:[],specials:{crystal:[]}};
let gctx=recordingContext(),gcanvas={width:0,height:0,getContext(){return gctx;}};
let gm=context.BWRenderer.render(gcanvas,{},gt,gf,{cellSize:16,aligned:true,showGrid:true,style:'amiga',mode:'viewer'});
assert.equal(gm.gridW,32);assert.equal(gm.gridH,32);assert.equal(gm.originX,20);assert.equal(gm.originY,15);
assert.equal(gcanvas.width,gm.marginLeft+32*16+8,'aligned canvas must reserve fixed world width');
assert.equal(gcanvas.height,gm.marginTop+32*16+8,'aligned canvas must reserve fixed world height');
const strongGrid=gctx.calls.filter(c=>c.op==='strokeRect'&&c.colour==='#303030'&&Math.abs(c.alpha-1)<.001);
assert.equal(strongGrid.length,6,'only selected floor cells are presented as editable grid squares');

// LAYOUT: adjacent floor grid geometry and directional elevation content.
const lb=floor(0,2,2,0,0),lc=floor(1,2,2,0,0),la=floor(2,2,2,0,0);
put(lb,0,0,0x29);put(lb,1,0,0x21);put(lb,0,1,0x31);put(lb,1,1,0x19);
put(la,0,0,0x31);put(la,1,0,0x19);put(la,0,1,0x29);put(la,1,1,0x21);
const lt={floors:[lb,lc,la],playerStarts:[],specials:{crystal:[]}};
const lctx=recordingContext(),lcanvas={width:0,height:0,getContext(){return lctx;}};
const lm=context.BWRenderer.render(lcanvas,{},lt,lc,{cellSize:32,aligned:true,showGrid:true,style:'amiga',mode:'layout'});
assert.equal(lm.layoutNativeShift,6,'32px cells use a clearly visible six-pixel adjacent-floor nudge');
assert.deepEqual(Array.from(context.BWRenderer.layoutAdjacentKinds('below')).sort(),['stair-up','upper-hole']);
assert.deepEqual(Array.from(context.BWRenderer.layoutAdjacentKinds('above')).sort(),['pit','stair-down']);
const adjacentGrid=lctx.calls.filter(c=>c.op==='strokeRect'&&Math.abs(c.alpha-.46)<.001);
assert.equal(adjacentGrid.length,8,'both enabled adjacent floors must draw full translucent 2x2 grids');
assert(adjacentGrid.some(c=>c.colour==='#69768a'&&Math.abs(c.x-(lm.marginLeft-5.5))<.001&&Math.abs(c.y-(lm.marginTop-5.5))<.001),'below grid must use the stronger negative nudge');
assert(adjacentGrid.some(c=>c.colour==='#8798b2'&&Math.abs(c.x-(lm.marginLeft+6.5))<.001&&Math.abs(c.y-(lm.marginTop+6.5))<.001),'above grid must use the stronger positive nudge');
const currentGrid=lctx.calls.filter(c=>c.op==='strokeRect'&&c.colour==='#2f799e'&&Math.abs(c.alpha-1)<.001);
assert.equal(currentGrid.length,4,'selected floor grid remains exact and strong');
const arrows=lctx.calls.filter(c=>c.op==='text'&&(c.v==='↑'||c.v==='↓'));
assert.equal(arrows.length,2,'adjacent content must suppress wrong-direction ladders');
assert(arrows.some(c=>c.v==='↑')&&arrows.some(c=>c.v==='↓'),'below shows up ladder; above shows down ladder');

// Vertical-opening validation mirrors Python layout.py.
const vb=floor(0,1,1,0,0),vc=floor(1,1,1,0,0),va=floor(2,1,1,0,0);
put(vb,0,0,0x19);put(vc,0,0,0x21);put(va,0,0,0x21);
const vt={floors:[vb,vc,va],playerStarts:[],specials:{crystal:[]}};
let vaa=context.BWRenderer.layoutAnalysis({},vt);
assert(!vaa.issues.some(i=>i.floor===1&&i.kind==='pit'),'$21 floor pit resolves to $19 ceiling hole below');
put(vc,0,0,0x19);vaa=context.BWRenderer.layoutAnalysis({},vt);
assert(!vaa.issues.some(i=>i.floor===1&&i.kind==='upper-hole'),'$19 ceiling hole resolves to $21 pit above');


// $01 is Reserved Space unless Event context proves a spinner source.
const rf=floor(0,1,1,0,0);put(rf,0,0,0x01);
rr=renderFloor(rf,'amiga',{showGrid:false});
assert(rr.ctx.calls.some(c=>c.op==='fillRect'&&c.colour==='#444444'&&c.w===32&&c.h===32),'plain $01 Reserved Space is solid dark grey');
putEvent(rf,0,0,0x0a);
rr=renderFloor(rf,'amiga',{showGrid:false});
assert(rr.ctx.calls.some(c=>c.op==='text'&&c.v==='180'),'event action $0A refines $01 Reserved Space to a turn-180 spinner source');

// $33 is the dark/black wall-feature family, not a normal empty socket.
const darkf=floor(0,1,1,0,0);put(darkf,0,0,0x33);
rr=renderFloor(darkf,'amiga',{showGrid:false});
assert(rr.ctx.calls.some(c=>c.op==='fillRect'&&c.colour==='#aaaaaa'&&c.w===32&&c.h===32),'$20 wall-feature family remains a wall');
assert(rr.ctx.calls.some(c=>c.op==='fillRect'&&c.colour==='#000000'&&c.w<20&&c.h<20),'$20 wall-feature family draws a black wall-mounted fixture');

// Socket state is bit 7 within the $60 family: $63 empty, $E3 filled.
const sock=floor(0,2,1,0,0);put(sock,0,0,0x63);put(sock,1,0,0xe3);
assert.equal(context.BWTiles.decode(sock._grid[0]).socketFilled,false);
assert.equal(context.BWTiles.decode(sock._grid[1]).socketFilled,true);
assert.equal(context.BWTiles.decode(0x43).switchUsed,false);
assert.equal(context.BWTiles.decode(0xc3).switchUsed,true);
assert.equal(context.BWTiles.decode(0x19).featureLabel,'Ceiling / upper hole');
assert.equal(context.BWTiles.decode(0x21).featureLabel,'Floor pit');

// Door lock index 1 is black; index 3 remains Serpent green.
const blackDoor=floor(0,1,1,0,0);put(blackDoor,0,0,0x22);
rr=renderFloor(blackDoor,'amiga',{showGrid:false});
assert(rr.ctx.calls.some(c=>c.op==='fillRect'&&c.colour==='#000000'&&c.w>20),'lock index 1 must render black');
const commonDoor=floor(0,1,1,0,0);put(commonDoor,0,0,0x52);
rr=renderFloor(commonDoor,'amiga',{showGrid:false});
assert(rr.ctx.calls.some(c=>c.op==='fillRect'&&c.colour==='#e49365'&&c.w>20),'lock index 2 Common Lock uses the tan/off-yellow shade');


// Cursor transfer preserves world-space position across differently aligned floors.
const cf1=floor(0,10,10,4,4),cf2=floor(1,10,10,2,2);
let cp=context.BWRenderer.worldToFloorCursor(cf2,cf1.xOffset+1,cf1.yOffset+1,true);
assert.deepEqual({x:cp.x,y:cp.y},{x:3,y:3},'floor switch must translate local cursor through world alignment');

// Default renderer style remains Amiga / AMOS.
const def=renderFloor(mf,undefined,{showGrid:false});
assert.equal(def.metrics.style,'amiga');

console.log('PASS ZX map presentation regressions');
console.log('  Amiga / Amstrad / Modern styles remain independent');
console.log('  grid is painted after cell artwork in all styles');
console.log('  $29/$31 render as ladders, not stair-step glyphs');
console.log('  wall fixtures retain facing without collapsing style');
console.log('  aligned view uses fixed 32x32 world canvas; editable grid remains floor-local');
console.log('  Layout adjacent grids use visible zoom-scaled nudge');
console.log('  below: ladder-up + $19 upper-hole; above: ladder-down + $21 pit');
console.log('  $01 Reserved Space, $33 dark fixture, socket bit7 state and black lock 1');
