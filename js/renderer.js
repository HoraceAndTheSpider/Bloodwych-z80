/* Shared Stage 5 map renderer. Visual styles are presentation only; all three
 * consume the same ZX cell/event/object/monster model.
 */
(function(global){
  'use strict';

  const AMIGA=['#000','#444','#666','#888','#aaa','#098a28','#18c229','#003fd1','#4488ee','#7c2617','#ad3622','#e49365','#d31b20','#efd31c','#eee','#b7008a'];
  const MOD={floor:'#f1f5f4',floor2:'#e7eeec',wall:'#343b43',wallLine:'#59636c',door:'#c9792b',switch:'#14b8a6',socket:'#7666d8',object:'#399457',monster:'#d94a55',event:'#00a7b7',special:'#8a5bd3',start1:'#2474d2',start2:'#d83e4b',grid:'#c5cdd3',ink:'#14202a'};
  const LOCK_COLOURS=['#888','#7c2617','#444','#18c229','#efd31c','#d31b20','#003fd1','#eee'];
  const SPECIAL_COLOURS={
    serpent:'#18c229',chaos:'#efd31c',dragon:'#d31b20',moon:'#4488ee',
    tan:'#e49365',bluish:'#7fa7e1',reserved6:'#b7008a',reserved7:'#eee'
  };
  const SPECIAL_LABELS={serpent:'S',chaos:'C',dragon:'D',moon:'M',tan:'T',bluish:'B',reserved6:'6',reserved7:'7'};

  // Kept for compatibility with existing callers; Stage 5.1 uses numeric X/Y
  // coordinates throughout rather than alphabetic row labels.
  function rowLabel(n){return String(n);}
  function text(ctx,v,x,y,size,c,align='center'){ctx.fillStyle=c;ctx.font=`${Math.max(7,size)}px ui-monospace,SFMono-Regular,Menlo,monospace`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(v,x,y);}
  function wall(ctx,x,y,s,c,line){ctx.fillStyle=c;ctx.fillRect(x,y,s,s);ctx.strokeStyle=line;ctx.lineWidth=Math.max(1,s*.035);for(let yy=y+s*.28;yy<y+s;yy+=s*.26){ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(x+s,yy);ctx.stroke();}}
  function ladder(ctx,x,y,s,c,up){ctx.strokeStyle=c;ctx.lineWidth=Math.max(2,s*.06);ctx.beginPath();ctx.moveTo(x+s*.32,y+s*.17);ctx.lineTo(x+s*.32,y+s*.83);ctx.moveTo(x+s*.68,y+s*.17);ctx.lineTo(x+s*.68,y+s*.83);ctx.stroke();for(let yy=.29;yy<.78;yy+=.15){ctx.beginPath();ctx.moveTo(x+s*.32,y+s*yy);ctx.lineTo(x+s*.68,y+s*yy);ctx.stroke();}text(ctx,up?'↑':'↓',x+s*.5,y+s*.52,s*.22,c);}
  function specialForCell(cell){return cell.specialLocations&&cell.specialLocations.length?cell.specialLocations[0]:null;}
  function specialColour(sp){return SPECIAL_COLOURS[sp&&sp.variantKey]||MOD.special;}
  function specialLabel(sp){return SPECIAL_LABELS[sp&&sp.variantKey]||'?';}

  function doorGeometry(ctx,x,y,s,t,style){
    // Orientation describes the PASSAGE axis.  A N/S passage is blocked by a
    // horizontal E/W door bar; an E/W passage is blocked by a vertical bar.
    const horizontal=t.orientation==='NS';
    const closed=t.closedBit!==false;
    const base=style==='amiga'?AMIGA[4]:style==='modern'?MOD.door:'#fff';
    ctx.fillStyle=base;
    if(closed){
      if(horizontal)ctx.fillRect(x+s*.08,y+s*.36,s*.84,s*.28);
      else ctx.fillRect(x+s*.36,y+s*.08,s*.28,s*.84);
    }else{
      if(horizontal){ctx.fillRect(x+s*.08,y+s*.36,s*.27,s*.28);ctx.fillRect(x+s*.65,y+s*.36,s*.27,s*.28);}
      else{ctx.fillRect(x+s*.36,y+s*.08,s*.28,s*.27);ctx.fillRect(x+s*.36,y+s*.65,s*.28,s*.27);}
    }
    if(t.lockId){
      if(style==='amstrad')text(ctx,String(t.lockId),x+s*.5,y+s*.52,s*.24,'#fff');
      else{
        ctx.fillStyle=LOCK_COLOURS[t.lockId]||'#eee';
        if(horizontal)ctx.fillRect(x+s*.40,y+s*.39,s*.20,s*.22);
        else ctx.fillRect(x+s*.39,y+s*.40,s*.22,s*.20);
      }
    }
  }

  function socketMark(ctx,x,y,s,cell,style){
    const t=cell.tile,sp=specialForCell(cell),filled=t.socketFilled;
    const outline=style==='amiga'?AMIGA[6]:style==='amstrad'?'#fff':MOD.socket;
    const gem=sp?specialColour(sp):(style==='amiga'?AMIGA[14]:style==='amstrad'?'#fff':MOD.special);
    ctx.strokeStyle=outline;ctx.lineWidth=Math.max(1,s*.065);ctx.strokeRect(x+s*.34,y+s*.34,s*.32,s*.32);
    if(filled){ctx.fillStyle=gem;ctx.beginPath();ctx.arc(x+s*.5,y+s*.5,s*.105,0,Math.PI*2);ctx.fill();}
    if(style==='modern'&&t.facing)text(ctx,t.facing,x+s*.5,y+s*.79,s*.16,filled?gem:outline);
  }

  function drawRuntimeMagic(ctx,x,y,s,cell,style){
    // Save-game/snapshot support can attach runtimeMagic without inventing a
    // Level-TZX byte encoding.  Current level data never sets this field.
    const k=cell.runtimeMagic||cell.runtimeFeature;
    if(!k)return;
    if(k==='firepath'){
      ctx.strokeStyle=style==='amiga'?AMIGA[12]:'#d94a55';ctx.lineWidth=Math.max(2,s*.07);ctx.strokeRect(x+s*.18,y+s*.18,s*.64,s*.64);text(ctx,'F',x+s*.5,y+s*.52,s*.24,style==='amiga'?AMIGA[13]:'#d94a55');
    }else if(k==='mindrock'){
      ctx.fillStyle=style==='amiga'?AMIGA[8]:'#5d7083';ctx.fillRect(x+s*.13,y+s*.13,s*.74,s*.74);text(ctx,'M',x+s*.5,y+s*.52,s*.24,'#fff');
    }else if(k==='formwall'){
      ctx.fillStyle=style==='amiga'?AMIGA[6]:'#399457';ctx.fillRect(x+s*.10,y+s*.10,s*.80,s*.80);text(ctx,'W',x+s*.5,y+s*.52,s*.24,style==='amiga'?AMIGA[0]:'#fff');
    }
  }

  function drawBase(ctx,x,y,s,cell,style,ix,iy){
    const t=cell.tile;
    if(style==='modern'){
      ctx.fillStyle=((ix+iy)&1)?MOD.floor2:MOD.floor;ctx.fillRect(x,y,s,s);
      if(t.baseType===3)wall(ctx,x,y,s,MOD.wall,MOD.wallLine);
      else if(t.baseType===2){ctx.fillStyle='#f5e7d9';ctx.fillRect(x,y,s,s);doorGeometry(ctx,x,y,s,t,style);}
      if(t.kind==='switch'){ctx.fillStyle=MOD.switch;ctx.fillRect(x+s*.34,y+s*.34,s*.32,s*.32);text(ctx,t.facing||'',x+s*.5,y+s*.5,s*.2,'#fff');}
      else if(t.kind==='socket')socketMark(ctx,x,y,s,cell,style);
      else if(t.kind==='pad'){ctx.strokeStyle='#b78a0a';ctx.lineWidth=Math.max(2,s*.06);ctx.strokeRect(x+s*.22,y+s*.22,s*.56,s*.56);}
      else if(t.kind==='ladder-up'||t.kind==='ladder-down')ladder(ctx,x,y,s,'#3977c3',t.kind==='ladder-up');
      drawRuntimeMagic(ctx,x,y,s,cell,style);return;
    }
    if(style==='amstrad'){
      ctx.fillStyle='#000';ctx.fillRect(x,y,s,s);ctx.strokeStyle='#fff';ctx.lineWidth=1;
      if(t.baseType===3){for(let yy=y+s*.28;yy<y+s*.8;yy+=s*.2){ctx.beginPath();ctx.moveTo(x+s*.12,yy);ctx.lineTo(x+s*.88,yy);ctx.stroke();}}
      else if(t.baseType===2)doorGeometry(ctx,x,y,s,t,style);
      else {for(let yy=y+s*.25;yy<y+s*.8;yy+=s*.25)for(let xx=x+s*.25;xx<x+s*.8;xx+=s*.25)ctx.fillRect(xx,yy,1,1);}
      if(t.kind==='switch')text(ctx,'S',x+s*.5,y+s*.52,s*.28,'#fff');
      else if(t.kind==='socket')socketMark(ctx,x,y,s,cell,style);
      else if(t.kind==='pad')ctx.strokeRect(x+s*.25,y+s*.25,s*.5,s*.5);
      else if(t.kind==='ladder-up'||t.kind==='ladder-down')ladder(ctx,x,y,s,'#fff',t.kind==='ladder-up');
      drawRuntimeMagic(ctx,x,y,s,cell,style);return;
    }
    // Amiga/AMOS-inspired procedural presentation, adapted to ZX semantics.
    ctx.fillStyle=AMIGA[0];ctx.fillRect(x,y,s,s);
    if(t.baseType===3){ctx.fillStyle=AMIGA[4];ctx.fillRect(x+s/16,y+s*2/16,s*15/16,s*13/16);}
    else if(t.baseType===2)doorGeometry(ctx,x,y,s,t,style);
    if(t.kind==='switch'){ctx.fillStyle=AMIGA[14];ctx.fillRect(x+s*.38,y+s*.38,s*.24,s*.24);}
    else if(t.kind==='socket')socketMark(ctx,x,y,s,cell,style);
    else if(t.kind==='pad'){ctx.fillStyle=AMIGA[6];ctx.fillRect(x+s*.24,y+s*.24,s*.52,s*.52);}
    else if(t.kind==='ladder-up'||t.kind==='ladder-down')ladder(ctx,x,y,s,AMIGA[t.kind==='ladder-up'?3:2],t.kind==='ladder-up');
    drawRuntimeMagic(ctx,x,y,s,cell,style);
  }

  function marker(ctx,label,x,y,s,fill,ink='#fff',corner='centre'){
    ctx.fillStyle=fill;
    if(corner==='br')ctx.fillRect(x+s*.62,y+s*.62,s*.32,s*.32);
    else if(corner==='bl')ctx.fillRect(x+s*.06,y+s*.62,s*.32,s*.32);
    else {ctx.beginPath();ctx.arc(x+s*.5,y+s*.5,s*.26,0,Math.PI*2);ctx.fill();}
    const tx=corner==='br'?x+s*.78:corner==='bl'?x+s*.22:x+s*.5,ty=corner==='centre'?y+s*.52:y+s*.78;
    text(ctx,label,tx,ty,s*.19,ink);
  }

  function render(canvas,tape,tower,floor,options){
    options=Object.assign({cellSize:30,aligned:true,showGrid:true,showHex:false,style:'modern',selected:null,overlays:{}},options||{});
    const s=options.cellSize,style=['modern','amstrad','amiga'].includes(options.style)?options.style:'modern';
    const ml=style==='modern'?42:36,mt=style==='modern'?34:28;
    let gw=floor.width,gh=floor.height,ox=0,oy=0;
    if(options.aligned){const used=tower.floors.filter(f=>f.used);gw=Math.max(...used.map(f=>f.width+f.xOffset));gh=Math.max(...used.map(f=>f.height+f.yOffset));ox=floor.xOffset;oy=floor.yOffset;}
    canvas.width=ml+gw*s+8;canvas.height=mt+gh*s+8;const ctx=canvas.getContext('2d');
    ctx.fillStyle=style==='modern'?'#d7e0e7':style==='amstrad'?'#060685':'#000';ctx.fillRect(0,0,canvas.width,canvas.height);
    const coord=style==='modern'?MOD.ink:'#ddd';for(let gx=0;gx<gw;gx++)text(ctx,String(gx),ml+gx*s+s*.5,mt*.5,s*.27,coord);for(let gy=0;gy<gh;gy++)text(ctx,String(gy),ml-7,mt+gy*s+s*.5,s*.27,coord,'right');
    for(let y=0;y<floor.height;y++)for(let x=0;x<floor.width;x++){
      const px=ml+(x+ox)*s,py=mt+(y+oy)*s,c=BWBloodwych.getCell(tape,tower,floor,x,y);if(!c)continue;drawBase(ctx,px,py,s,c,style,x,y);
      if(options.overlays.objects&&c.objectStacks.length)marker(ctx,c.objectStacks.length>1?`O${c.objectStacks.length}`:'O',px,py,s,style==='amiga'?AMIGA[5]:MOD.object,'#fff','bl');
      if(options.overlays.monsters&&c.monsters.length)marker(ctx,c.monsters.length>1?`M${c.monsters.length}`:'M',px,py,s,style==='amiga'?AMIGA[12]:MOD.monster,'#fff','br');
      if(options.overlays.events&&c.events.length)marker(ctx,c.events.length>1?`E${c.events.length}`:'E',px,py,s,style==='amiga'?AMIGA[8]:MOD.event,'#fff','centre');
      if(options.showHex)text(ctx,c.value.toString(16).toUpperCase().padStart(2,'0'),px+2,py+s*.14,s*.18,style==='modern'?'#52616d':'#aaa','left');
      if(options.showGrid){ctx.strokeStyle=style==='modern'?MOD.grid:'#202020';ctx.lineWidth=1;ctx.strokeRect(px+.5,py+.5,s-1,s-1);}
    }
    if(options.overlays.starts)for(const p of tower.playerStarts){if(p.floorIndex!==floor.floorIndex||p.x>=floor.width||p.y>=floor.height)continue;const px=ml+(p.x+ox)*s,py=mt+(p.y+oy)*s;ctx.fillStyle=p.player===1?MOD.start1:MOD.start2;ctx.fillRect(px+s*.18,py+s*.18,s*.64,s*.64);text(ctx,`P${p.player}`,px+s*.5,py+s*.52,s*.26,'#fff');}
    if(options.overlays.specials&&tower.specials)for(const sp of tower.specials.crystal){if(sp.empty||!sp.source||sp.source.floorIndex!==floor.floorIndex)continue;const px=ml+(sp.source.x+ox)*s,py=mt+(sp.source.y+oy)*s;marker(ctx,specialLabel(sp),px,py,s,specialColour(sp),'#fff','br');}
    if(options.selected){const px=ml+(options.selected.x+ox)*s,py=mt+(options.selected.y+oy)*s;ctx.strokeStyle=style==='modern'?'#008fa0':'#0ff';ctx.lineWidth=3;ctx.strokeRect(px+1.5,py+1.5,s-3,s-3);ctx.lineWidth=1;}
    return {marginLeft:ml,marginTop:mt,originX:ox,originY:oy,cellSize:s,gridW:gw,gridH:gh,style};
  }

  global.BWRenderer={render,rowLabel,RUNTIME_MAGIC_KINDS:['firepath','mindrock','formwall']};
})(window);
