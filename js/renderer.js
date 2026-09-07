/* Monochrome symbolic map renderer inspired by the original CPC map viewer,
 * but driven directly from ZX map bytes.
 */
(function (global) {
  'use strict';

  function rowLabel(n) {
    // A..Z, AA.. if ever needed.
    let s = '';
    n++;
    while (n > 0) {
      n--;
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26);
    }
    return s;
  }

  function drawDoor(ctx, x, y, s, tile) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, s / 12);
    const q = s * 0.19, gap = s * 0.06;
    if (tile.orientation === 'NS') {
      for (let r=0;r<2;r++) for(let c=0;c<2;c++) ctx.strokeRect(x+s*.24+c*(q+gap), y+s*.24+r*(q+gap), q, q);
    } else {
      for (let r=0;r<2;r++) for(let c=0;c<2;c++) ctx.strokeRect(x+s*.20+c*(q+gap), y+s*.28+r*(q+gap), q, q);
    }
    if (tile.lockId != null && tile.lockId > 0) {
      ctx.fillStyle='#fff'; ctx.font=`${Math.max(8,s*.35)}px monospace`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(String(tile.lockId), x+s*.5, y+s*.5);
    }
  }

  function drawWall(ctx, x, y, s) {
    ctx.strokeStyle='#fff'; ctx.lineWidth=1;
    for (let yy=y+s*.25; yy<y+s*.8; yy+=s*.18) {
      ctx.beginPath(); ctx.moveTo(x+s*.12, yy); ctx.lineTo(x+s*.88, yy); ctx.stroke();
    }
  }

  function drawPath(ctx, x, y, s) {
    ctx.fillStyle='#777';
    const step=Math.max(4,s*.24);
    for(let yy=y+s*.2; yy<y+s*.85; yy+=step) for(let xx=x+s*.2; xx<x+s*.85; xx+=step) ctx.fillRect(xx,yy,1,1);
  }

  function drawSwitch(ctx,x,y,s,t){
    drawWall(ctx,x,y,s); ctx.fillStyle='#fff';
    const cx=x+s*.5,cy=y+s*.5;
    ctx.fillRect(cx-s*.09,cy-s*.09,s*.18,s*.18);
    ctx.font=`${Math.max(7,s*.26)}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(t.facing||'S',cx,cy);
  }
  function drawSocket(ctx,x,y,s,t){
    drawWall(ctx,x,y,s); ctx.strokeStyle='#fff';ctx.strokeRect(x+s*.36,y+s*.36,s*.28,s*.28);
    ctx.font=`${Math.max(7,s*.25)}px monospace`;ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(t.facing||'',x+s*.5,y+s*.5);
  }
  function drawLadder(ctx,x,y,s,up){
    ctx.strokeStyle='#fff';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(x+s*.32,y+s*.18);ctx.lineTo(x+s*.32,y+s*.82);ctx.moveTo(x+s*.68,y+s*.18);ctx.lineTo(x+s*.68,y+s*.82);ctx.stroke();
    for(let yy=y+s*.28;yy<y+s*.78;yy+=s*.16){ctx.beginPath();ctx.moveTo(x+s*.32,yy);ctx.lineTo(x+s*.68,yy);ctx.stroke();}
    ctx.fillStyle='#fff';ctx.font=`${Math.max(8,s*.28)}px monospace`;ctx.textAlign='center';ctx.fillText(up?'↑':'↓',x+s*.5,y+s*.5);
  }

  function render(canvas, tap, tower, floor, options) {
    options=Object.assign({cellSize:28, aligned:true, showHex:false, showGrid:true, selected:null},options||{});
    const s=options.cellSize;
    const marginLeft=36, marginTop=28;
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
    ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.font=`${Math.max(8,s*.3)}px monospace`;ctx.fillStyle='#ddd';ctx.textAlign='center';ctx.textBaseline='middle';
    for(let gx=0;gx<gridW;gx++) ctx.fillText(String(gx),marginLeft+gx*s+s*.5,marginTop*.5);
    ctx.textAlign='right';
    for(let gy=0;gy<gridH;gy++) ctx.fillText(rowLabel(gy),marginLeft-5,marginTop+gy*s+s*.5);

    for(let y=0;y<floor.height;y++) for(let x=0;x<floor.width;x++) {
      const gx=x+originX,gy=y+originY,px=marginLeft+gx*s,py=marginTop+gy*s;
      const cell=BWBloodwych.getCell(tap,tower,floor,x,y);
      if(!cell){ctx.strokeStyle='#522';ctx.strokeRect(px+.5,py+.5,s-1,s-1);continue;}
      const t=cell.tile;
      if(options.showGrid){ctx.strokeStyle='#202020';ctx.strokeRect(px+.5,py+.5,s-1,s-1);}
      if(t.kind==='floor') drawPath(ctx,px,py,s);
      else if(t.kind==='wall') drawWall(ctx,px,py,s);
      else if(t.kind==='door') drawDoor(ctx,px,py,s,t);
      else if(t.kind==='switch') drawSwitch(ctx,px,py,s,t);
      else if(t.kind==='socket') drawSocket(ctx,px,py,s,t);
      else if(t.kind==='ladder-up') drawLadder(ctx,px,py,s,true);
      else if(t.kind==='ladder-down') drawLadder(ctx,px,py,s,false);
      else if(t.kind==='monster') {ctx.fillStyle='#fff';ctx.font=`${Math.max(9,s*.45)}px monospace`;ctx.textAlign='center';ctx.fillText('M',px+s*.5,py+s*.55);}
      else if(t.kind==='pad') {drawPath(ctx,px,py,s);ctx.strokeStyle='#fff';ctx.strokeRect(px+s*.28,py+s*.28,s*.44,s*.44);}
      else if(t.kind==='object') {drawPath(ctx,px,py,s);ctx.fillStyle='#fff';ctx.font=`${Math.max(9,s*.42)}px monospace`;ctx.textAlign='center';ctx.fillText('O',px+s*.5,py+s*.55);}
      else {ctx.fillStyle='#333';ctx.fillRect(px+s*.12,py+s*.12,s*.76,s*.76);ctx.fillStyle='#fff';ctx.font=`${Math.max(8,s*.28)}px monospace`;ctx.textAlign='center';ctx.fillText('$'+cell.value.toString(16).toUpperCase().padStart(2,'0'),px+s*.5,py+s*.55);}
      if(options.showHex && t.kind!=='unknown'){ctx.fillStyle='#aaa';ctx.font=`${Math.max(7,s*.22)}px monospace`;ctx.textAlign='left';ctx.fillText(cell.value.toString(16).toUpperCase().padStart(2,'0'),px+2,py+s*.18);}
      if(cell.changed){ctx.strokeStyle='#ff0';ctx.lineWidth=2;ctx.strokeRect(px+2,py+2,s-4,s-4);ctx.lineWidth=1;}
      if(cell.switchSequence!=null){ctx.fillStyle='#0ff';ctx.font=`${Math.max(7,s*.22)}px monospace`;ctx.textAlign='right';ctx.fillText('#'+cell.switchSequence,px+s-2,py+s*.85);}
    }
    if(options.selected){
      const sx=options.selected.x+originX,sy=options.selected.y+originY;
      ctx.strokeStyle='#0ff';ctx.lineWidth=2;ctx.strokeRect(marginLeft+sx*s+1,marginTop+sy*s+1,s-2,s-2);
    }
    return {marginLeft,marginTop,originX,originY,cellSize:s,gridW,gridH};
  }

  global.BWRenderer={render,rowLabel};
})(window);
