/* Bloodwych ZX map renderer.
 *
 * Three display styles are provided:
 *   modern  - clear, colour-coded editor view (default)
 *   amstrad - monochrome symbolic view inspired by Philip M. Taglione's CPC viewer
 *   amiga   - AMOS/Amiga-editor-inspired coloured procedural icons, adapted to
 *             the one-byte ZX map format rather than pretending the formats are identical.
 */
(function (global) {
  'use strict';

  const AMIGA_PALETTE = [
    '#000000','#444444','#666666','#888888','#AAAAAA','#009922','#11CC11','#0000EE',
    '#4488EE','#882211','#BB3311','#EE9966','#DD0000','#FFDD00','#EEEEEE','#CC0088'
  ];

  function rowLabel(n) {
    let s = '';
    n++;
    while (n > 0) {
      n--;
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26);
    }
    return s;
  }

  function text(ctx, value, x, y, size, colour, align='center') {
    ctx.fillStyle = colour;
    ctx.font = `${Math.max(7, size)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(value, x, y);
  }

  // ---------------------------------------------------------------------------
  // Amstrad/CPC symbolic renderer (kept as an authenticity/reference option).
  // ---------------------------------------------------------------------------
  function cpcDoor(ctx, x, y, s, tile) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, s / 12);
    const q = s * 0.19, gap = s * 0.06;
    for (let r=0;r<2;r++) for(let c=0;c<2;c++) {
      ctx.strokeRect(x+s*.22+c*(q+gap), y+s*.25+r*(q+gap), q, q);
    }
    if (tile.lockId != null && tile.lockId > 0) text(ctx,String(tile.lockId),x+s*.5,y+s*.5,s*.35,'#fff');
  }
  function cpcWall(ctx, x, y, s) {
    ctx.strokeStyle='#fff'; ctx.lineWidth=1;
    for (let yy=y+s*.25; yy<y+s*.8; yy+=s*.18) {
      ctx.beginPath(); ctx.moveTo(x+s*.12, yy); ctx.lineTo(x+s*.88, yy); ctx.stroke();
    }
  }
  function cpcPath(ctx, x, y, s) {
    ctx.fillStyle='#777'; const step=Math.max(4,s*.24);
    for(let yy=y+s*.2; yy<y+s*.85; yy+=step) for(let xx=x+s*.2; xx<x+s*.85; xx+=step) ctx.fillRect(xx,yy,1,1);
  }
  function cpcSwitch(ctx,x,y,s,t){
    cpcWall(ctx,x,y,s); ctx.fillStyle='#fff'; const cx=x+s*.5,cy=y+s*.5;
    ctx.fillRect(cx-s*.09,cy-s*.09,s*.18,s*.18); text(ctx,t.facing||'S',cx,cy,s*.26,'#000');
  }
  function cpcSocket(ctx,x,y,s,t){
    cpcWall(ctx,x,y,s); ctx.strokeStyle='#fff';ctx.strokeRect(x+s*.36,y+s*.36,s*.28,s*.28);
    text(ctx,t.facing||'',x+s*.5,y+s*.5,s*.25,'#fff');
  }
  function cpcLadder(ctx,x,y,s,up){
    ctx.strokeStyle='#fff';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(x+s*.32,y+s*.18);ctx.lineTo(x+s*.32,y+s*.82);ctx.moveTo(x+s*.68,y+s*.18);ctx.lineTo(x+s*.68,y+s*.82);ctx.stroke();
    for(let yy=y+s*.28;yy<y+s*.78;yy+=s*.16){ctx.beginPath();ctx.moveTo(x+s*.32,yy);ctx.lineTo(x+s*.68,yy);ctx.stroke();}
    text(ctx,up?'↑':'↓',x+s*.5,y+s*.5,s*.28,'#fff');
  }
  function drawAmstradCell(ctx, px, py, s, cell) {
    const t=cell.tile;
    if(t.kind==='floor') cpcPath(ctx,px,py,s);
    else if(t.kind==='wall') cpcWall(ctx,px,py,s);
    else if(t.kind==='door') cpcDoor(ctx,px,py,s,t);
    else if(t.kind==='switch') cpcSwitch(ctx,px,py,s,t);
    else if(t.kind==='socket') cpcSocket(ctx,px,py,s,t);
    else if(t.kind==='ladder-up') cpcLadder(ctx,px,py,s,true);
    else if(t.kind==='ladder-down') cpcLadder(ctx,px,py,s,false);
    else if(t.kind==='monster') text(ctx,'M',px+s*.5,py+s*.54,s*.45,'#fff');
    else if(t.kind==='pad') {cpcPath(ctx,px,py,s);ctx.strokeStyle='#fff';ctx.strokeRect(px+s*.28,py+s*.28,s*.44,s*.44);}
    else if(t.kind==='object') {cpcPath(ctx,px,py,s);text(ctx,'O',px+s*.5,py+s*.54,s*.42,'#fff');}
    else {ctx.fillStyle='#333';ctx.fillRect(px+s*.12,py+s*.12,s*.76,s*.76);text(ctx,'$'+cell.value.toString(16).toUpperCase().padStart(2,'0'),px+s*.5,py+s*.54,s*.28,'#fff');}
  }

  // ---------------------------------------------------------------------------
  // Modern editor renderer. This is deliberately not an attempt to emulate
  // either 8-bit game: it is designed to make topology and special cells obvious.
  // ---------------------------------------------------------------------------
  const MODERN = {
    floor:'#F1F5F4', floorAlt:'#E7EEEC', wall:'#343B43', wallLine:'#515C67',
    door:'#C9792B', doorLock:'#FFE0A8', switch:'#14B8A6', socket:'#7C6FDB',
    monster:'#D94A55', pad:'#D9AA20', object:'#4A9B61', ladder:'#3977C3',
    unknown:'#A83DA8', grid:'#C5CDD3', ink:'#14202A', coord:'#CBD6DE'
  };
  function modernBase(ctx,px,py,s,fill){ctx.fillStyle=fill;ctx.fillRect(px,py,s,s);}
  function modernWall(ctx,px,py,s){
    modernBase(ctx,px,py,s,MODERN.wall);ctx.strokeStyle=MODERN.wallLine;ctx.lineWidth=Math.max(1,s*.035);
    for(let yy=py+s*.27;yy<py+s;yy+=s*.26){ctx.beginPath();ctx.moveTo(px,yy);ctx.lineTo(px+s,yy);ctx.stroke();}
    ctx.beginPath();ctx.moveTo(px+s*.5,py);ctx.lineTo(px+s*.5,py+s*.27);ctx.stroke();
    ctx.beginPath();ctx.moveTo(px+s*.27,py+s*.27);ctx.lineTo(px+s*.27,py+s*.53);ctx.moveTo(px+s*.74,py+s*.27);ctx.lineTo(px+s*.74,py+s*.53);ctx.stroke();
  }
  function modernDoor(ctx,px,py,s,t){
    modernBase(ctx,px,py,s,'#F5E7D9');ctx.fillStyle=MODERN.door;
    if(t.orientation==='NS') ctx.fillRect(px+s*.36,py+s*.08,s*.28,s*.84);
    else ctx.fillRect(px+s*.08,py+s*.36,s*.84,s*.28);
    if(t.lockId!=null && t.lockId>0){ctx.fillStyle=MODERN.doorLock;ctx.beginPath();ctx.arc(px+s*.5,py+s*.5,s*.16,0,Math.PI*2);ctx.fill();text(ctx,String(t.lockId),px+s*.5,py+s*.5,s*.32,'#4A2A0D');}
  }
  function modernFacingMarker(ctx,px,py,s,facing,colour){
    const c={N:[.5,.18],E:[.82,.5],S:[.5,.82],W:[.18,.5]}[facing]||[.5,.5];
    ctx.fillStyle=colour;ctx.beginPath();ctx.arc(px+s*c[0],py+s*c[1],Math.max(2,s*.08),0,Math.PI*2);ctx.fill();
  }
  function drawModernCell(ctx,px,py,s,cell,x,y){
    const t=cell.tile; modernBase(ctx,px,py,s,((x+y)&1)?MODERN.floorAlt:MODERN.floor);
    if(t.kind==='wall') modernWall(ctx,px,py,s);
    else if(t.kind==='door') modernDoor(ctx,px,py,s,t);
    else if(t.kind==='switch') {modernWall(ctx,px,py,s);ctx.fillStyle=MODERN.switch;ctx.fillRect(px+s*.34,py+s*.34,s*.32,s*.32);modernFacingMarker(ctx,px,py,s,t.facing,'#E9FFFC');}
    else if(t.kind==='socket') {modernWall(ctx,px,py,s);ctx.strokeStyle=MODERN.socket;ctx.lineWidth=Math.max(2,s*.08);ctx.strokeRect(px+s*.33,py+s*.33,s*.34,s*.34);modernFacingMarker(ctx,px,py,s,t.facing,'#EEEAFE');}
    else if(t.kind==='ladder-up'||t.kind==='ladder-down') {ctx.strokeStyle=MODERN.ladder;ctx.lineWidth=Math.max(2,s*.065);ctx.strokeRect(px+s*.30,py+s*.18,s*.40,s*.64);for(let yy=.30;yy<.72;yy+=.15){ctx.beginPath();ctx.moveTo(px+s*.30,py+s*yy);ctx.lineTo(px+s*.70,py+s*yy);ctx.stroke();}text(ctx,t.kind==='ladder-up'?'↑':'↓',px+s*.5,py+s*.5,s*.30,MODERN.ladder);}
    else if(t.kind==='monster') {ctx.fillStyle=MODERN.monster;ctx.beginPath();ctx.arc(px+s*.5,py+s*.5,s*.28,0,Math.PI*2);ctx.fill();text(ctx,'M',px+s*.5,py+s*.52,s*.34,'#fff');}
    else if(t.kind==='pad') {ctx.fillStyle='#FFF3C4';ctx.fillRect(px+s*.16,py+s*.16,s*.68,s*.68);ctx.strokeStyle=MODERN.pad;ctx.lineWidth=Math.max(2,s*.06);ctx.strokeRect(px+s*.22,py+s*.22,s*.56,s*.56);text(ctx,'P',px+s*.5,py+s*.51,s*.28,'#705300');}
    else if(t.kind==='object') {ctx.fillStyle=MODERN.object;ctx.fillRect(px+s*.23,py+s*.23,s*.54,s*.54);text(ctx,'O',px+s*.5,py+s*.52,s*.31,'#fff');}
    else if(t.kind==='unknown') {ctx.fillStyle='#F6E5F6';ctx.fillRect(px+s*.08,py+s*.08,s*.84,s*.84);ctx.strokeStyle=MODERN.unknown;ctx.lineWidth=Math.max(1,s*.05);ctx.strokeRect(px+s*.08,py+s*.08,s*.84,s*.84);text(ctx,'$'+cell.value.toString(16).toUpperCase().padStart(2,'0'),px+s*.5,py+s*.51,s*.25,MODERN.unknown);}
  }

  // ---------------------------------------------------------------------------
  // AMOS/Amiga editor-inspired rendering. Geometry and palette are adapted from
  // Bloodwych-68k/tools/map_editor/render.py. The ZX map encoding is different,
  // so only visually equivalent concepts are translated here.
  // ---------------------------------------------------------------------------
  function amigaRect(ctx,px,py,s,colour,x,y,w,h){
    const scale=s/16;ctx.fillStyle=AMIGA_PALETTE[colour];ctx.fillRect(px+x*scale,py+y*scale,w*scale,h*scale);
  }
  function amigaWall(ctx,px,py,s){amigaRect(ctx,px,py,s,4,1,2,15,13);}
  function amigaDoor(ctx,px,py,s,t){
    const lockPalette=[3,9,1,6,13,12,7,14];
    const lock=t.lockId!=null?lockPalette[Math.min(t.lockId,7)]:null;
    if(t.orientation==='EW'){
      amigaRect(ctx,px,py,s,4,5,2,6,13);
      if(lock!=null) amigaRect(ctx,px,py,s,lock,7,2,2,13);
      amigaRect(ctx,px,py,s,0,5,6,6,5);
    }else{
      amigaRect(ctx,px,py,s,4,1,6,15,5);
      if(lock!=null) amigaRect(ctx,px,py,s,lock,1,7,15,2);
      amigaRect(ctx,px,py,s,0,5,6,7,5);
    }
  }
  function amigaDirectionalFurniture(ctx,px,py,s,t,kind){
    amigaWall(ctx,px,py,s);
    const colour=kind==='switch'?14:6,inner=kind==='socket'?0:15;
    const scale=s/16;let x=7,y=2,w=2,h=4;
    if(t.facing==='E'){x=11;y=6;w=4;h=2;} else if(t.facing==='S'){x=7;y=10;w=2;h=4;} else if(t.facing==='W'){x=1;y=6;w=4;h=2;}
    ctx.fillStyle=AMIGA_PALETTE[colour];ctx.fillRect(px+x*scale,py+y*scale,w*scale,h*scale);
    if(kind==='socket'){ctx.fillStyle=AMIGA_PALETTE[inner];ctx.fillRect(px+(x+1)*scale,py+(y+1)*scale,Math.max(scale,w*scale-2*scale),Math.max(scale,h*scale-2*scale));}
  }
  function amigaLadder(ctx,px,py,s,up){
    const colour=up?3:2,scale=s/16;ctx.fillStyle=AMIGA_PALETTE[0];ctx.fillRect(px,py,s,s);
    ctx.fillStyle=AMIGA_PALETTE[colour];
    if(up){for(const y of [2,6,10])ctx.fillRect(px+2*scale,py+y*scale,12*scale,2*scale);} else {for(const y of [4,8,12])ctx.fillRect(px+2*scale,py+y*scale,12*scale,2*scale);}
    ctx.strokeStyle=AMIGA_PALETTE[1];ctx.lineWidth=Math.max(1,scale);ctx.strokeRect(px+1*scale,py+1*scale,14*scale,14*scale);
  }
  function drawAmigaCell(ctx,px,py,s,cell){
    const t=cell.tile;ctx.fillStyle=AMIGA_PALETTE[0];ctx.fillRect(px,py,s,s);
    if(t.kind==='floor') return;
    if(t.kind==='wall') amigaWall(ctx,px,py,s);
    else if(t.kind==='door') amigaDoor(ctx,px,py,s,t);
    else if(t.kind==='switch') amigaDirectionalFurniture(ctx,px,py,s,t,'switch');
    else if(t.kind==='socket') amigaDirectionalFurniture(ctx,px,py,s,t,'socket');
    else if(t.kind==='ladder-up') amigaLadder(ctx,px,py,s,true);
    else if(t.kind==='ladder-down') amigaLadder(ctx,px,py,s,false);
    else if(t.kind==='pad') amigaRect(ctx,px,py,s,6,3,3,10,10);
    else if(t.kind==='object') {amigaRect(ctx,px,py,s,5,3,3,10,10);text(ctx,'O',px+s*.5,py+s*.52,s*.30,AMIGA_PALETTE[14]);}
    else if(t.kind==='monster') {amigaRect(ctx,px,py,s,12,3,3,10,10);text(ctx,'M',px+s*.5,py+s*.52,s*.30,AMIGA_PALETTE[14]);}
    else {amigaRect(ctx,px,py,s,15,2,2,12,12);text(ctx,'$'+cell.value.toString(16).toUpperCase().padStart(2,'0'),px+s*.5,py+s*.52,s*.23,AMIGA_PALETTE[14]);}
  }

  function render(canvas, tap, tower, floor, options) {
    options=Object.assign({cellSize:28, aligned:true, showHex:false, showGrid:true, selected:null, style:'modern'},options||{});
    const style=['modern','amstrad','amiga'].includes(options.style)?options.style:'modern';
    const s=options.cellSize;
    const marginLeft=style==='modern'?42:36, marginTop=style==='modern'?34:28;
    let gridW=floor.width,gridH=floor.height,originX=0,originY=0;
    if(options.aligned){
      const used=tower.floors.filter(f=>f.used);
      gridW=Math.max(...used.map(f=>f.width+f.xOffset));
      gridH=Math.max(...used.map(f=>f.height+f.yOffset));
      originX=floor.xOffset;originY=floor.yOffset;
    }
    canvas.width=marginLeft+gridW*s+8;
    canvas.height=marginTop+gridH*s+8;
    const ctx=canvas.getContext('2d');
    const bg=style==='modern'?'#D7E0E7':'#000';
    const coord=style==='modern'?MODERN.ink:'#ddd';
    ctx.fillStyle=bg;ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.font=`${Math.max(8,s*.3)}px ui-monospace, SFMono-Regular, Menlo, monospace`;ctx.fillStyle=coord;ctx.textAlign='center';ctx.textBaseline='middle';
    for(let gx=0;gx<gridW;gx++) ctx.fillText(String(gx),marginLeft+gx*s+s*.5,marginTop*.5);
    ctx.textAlign='right';for(let gy=0;gy<gridH;gy++) ctx.fillText(rowLabel(gy),marginLeft-6,marginTop+gy*s+s*.5);

    for(let y=0;y<floor.height;y++) for(let x=0;x<floor.width;x++) {
      const gx=x+originX,gy=y+originY,px=marginLeft+gx*s,py=marginTop+gy*s;
      const cell=BWBloodwych.getCell(tap,tower,floor,x,y);
      if(!cell){ctx.strokeStyle=style==='modern'?'#C34C4C':'#522';ctx.strokeRect(px+.5,py+.5,s-1,s-1);continue;}
      if(style==='modern') drawModernCell(ctx,px,py,s,cell,x,y);
      else if(style==='amiga') drawAmigaCell(ctx,px,py,s,cell);
      else drawAmstradCell(ctx,px,py,s,cell);

      if(options.showGrid){ctx.strokeStyle=style==='modern'?MODERN.grid:'#202020';ctx.lineWidth=1;ctx.strokeRect(px+.5,py+.5,s-1,s-1);}
      if(options.showHex && cell.tile.kind!=='unknown') text(ctx,cell.value.toString(16).toUpperCase().padStart(2,'0'),px+2,py+s*.16,Math.max(7,s*.20),style==='modern'?'#52616D':'#aaa','left');
      if(cell.changed){ctx.strokeStyle=style==='modern'?'#E1A600':'#ff0';ctx.lineWidth=2;ctx.strokeRect(px+2,py+2,s-4,s-4);ctx.lineWidth=1;}
      if(cell.switchSequence!=null) text(ctx,'#'+cell.switchSequence,px+s-2,py+s*.84,Math.max(7,s*.21),style==='modern'?'#006C73':'#0ff','right');
    }
    if(options.selected){
      const sx=options.selected.x+originX,sy=options.selected.y+originY;
      ctx.strokeStyle=style==='modern'?'#008FA0':'#0ff';ctx.lineWidth=3;ctx.strokeRect(marginLeft+sx*s+1.5,marginTop+sy*s+1.5,s-3,s-3);ctx.lineWidth=1;
    }
    return {marginLeft,marginTop,originX,originY,cellSize:s,gridW,gridH,style};
  }

  global.BWRenderer={render,rowLabel};
})(window);
