/* Bloodwych ZX map presentation — style-preserving Stage 5.2 refresh.
 *
 * The three presentation styles are deliberately independent:
 *   - Amiga / AMOS is the default and follows the AMOS editor icon language;
 *   - CPC / Amstrad retains its established monochrome viewer language;
 *   - Modern retains the existing refreshed floor/wall/door presentation.
 *
 * Reverse-engineered semantics are shared, but a semantic correction must not
 * collapse the visual styles into one geometry.
 *
 * This module also applies the proved ZX floor-descriptor alignment correction
 * before app.js is loaded: descriptor +4 is Y alignment and +5 is X alignment.
 * Serpents is the regression proof: F0 $29 stairs at local (1,5)/(7,5), with
 * descriptor bytes 15,0, align at world (1,20)/(7,20) with F1 $31 stairs only
 * when +4=Y and +5=X. Vertical pit/hole validation follows the Python
 * Layout checker: a floor pit resolves to a ceiling hole on floor-1, while a
 * ceiling/upper hole resolves to a pit on floor+1.
 */
(function(global){
  'use strict';

  const AMIGA=['#000000','#444444','#666666','#888888','#aaaaaa','#098a28','#18c229','#003fd1','#4488ee','#7c2617','#ad3622','#e49365','#d31b20','#efd31c','#eeeeee','#b7008a'];
  const MODERN=['#f1f5f4','#c5cdd3','#82909c','#647687','#343b43','#399457','#14b8a6','#3467be','#4488ee','#8a5140','#b56a35','#d39963','#d94a55','#d4b72a','#f6f8f9','#ff00ff'];
  const CPC=['#000000','#0000aa','#00aaaa','#ffffff','#555555','#00aa00','#00ff00','#0000ff','#55aaff','#aa5500','#ff5500','#ffaa55','#ff0000','#ffff00','#ffffff','#ff00ff'];
  const LOCK_COLOURS=['#888888','#7c2617','#444444','#18c229','#efd31c','#d31b20','#003fd1','#eeeeee'];
  const MOD={floor:'#f1f5f4',floor2:'#e7eeec',wall:'#343b43',wallLine:'#59636c',door:'#c9792b',switch:'#14b8a6',socket:'#7666d8',pad:'#b78a0a',ladder:'#3977c3',pit:'#59636c',hole:'#647687',mindrock:'#5d7083',grid:'#c5cdd3',ink:'#14202a'};
  const CPC_INK='#ffffff';
  const SPECIAL_COLOURS={
    serpent:'#18c229',chaos:'#efd31c',dragon:'#d31b20',moon:'#4488ee',
    tan:'#e49365',bluish:'#7fa7e1',reserved6:'#ff00ff',reserved7:'#eeeeee'
  };
  const SPECIAL_LABELS={serpent:'S',chaos:'C',dragon:'D',moon:'M',tan:'T',bluish:'B',reserved6:'6',reserved7:'7'};
  const ELEVATION_KINDS=new Set(['stair-up','stair-down','pit','upper-hole']);
  const BELOW_ELEVATION_KINDS=new Set(['stair-up','upper-hole']);
  const ABOVE_ELEVATION_KINDS=new Set(['stair-down','pit']);
  const MAGENTA='#ff00ff';

  function byId(id){return typeof document!=='undefined'?document.getElementById(id):null;}
  function palette(style){return style==='modern'?MODERN:style==='amstrad'?CPC:AMIGA;}
  function hex2(n){return (n&255).toString(16).toUpperCase().padStart(2,'0');}
  function rowLabel(n){return String(n);}
  function specialForCell(cell){return cell&&cell.specialLocations&&cell.specialLocations.length?cell.specialLocations[0]:null;}
  function specialColour(sp){return SPECIAL_COLOURS[sp&&sp.variantKey]||AMIGA[14];}
  function specialLabel(sp){return SPECIAL_LABELS[sp&&sp.variantKey]||'?';}

  /* -----------------------------------------------------------------------
   * Data-model corrections / presentation semantics
   * -------------------------------------------------------------------- */

  function installAlignmentCorrection(){
    const bw=global.BWBloodwych;
    if(!bw||bw.__xyAlignmentCorrected)return;

    function correctTower(tower){
      if(!tower||tower.__xyAlignmentCorrected)return tower;
      for(const floor of tower.floors||[]){
        const oldX=floor.xOffset;
        floor.xOffset=floor.yOffset;
        floor.yOffset=oldX;
      }
      tower.__xyAlignmentCorrected=true;
      return tower;
    }

    const oldFind=bw.findTowers;
    bw.findTowers=function(tape){return oldFind(tape).map(correctTower);};

    const oldParse=bw.parseTower;
    if(oldParse)bw.parseTower=function(block){return correctTower(oldParse(block));};

    /* The existing writer uses +4 for xOffset and +5 for yOffset. Feed the
     * fields crossed so semantic edits write +4=Y and +5=X without changing
     * any unrelated bytes. */
    const oldWrite=bw.writeFloorDescriptor;
    if(oldWrite)bw.writeFloorDescriptor=function(session,tower,floorIndex,fields){
      const translated=Object.assign({},fields);
      const hasX=Object.prototype.hasOwnProperty.call(fields,'xOffset');
      const hasY=Object.prototype.hasOwnProperty.call(fields,'yOffset');
      if(hasX||hasY){
        delete translated.xOffset;delete translated.yOffset;
        if(hasY)translated.xOffset=fields.yOffset; // old +4 writer => corrected Y
        if(hasX)translated.yOffset=fields.xOffset; // old +5 writer => corrected X
      }
      return oldWrite(session,tower,floorIndex,translated);
    };

    bw.__xyAlignmentCorrected=true;
  }

  function installTilePresentation(){
    const tiles=global.BWTiles;
    if(!tiles||tiles.__amosPresentationPatched)return;
    const oldDecode=tiles.decode;
    tiles.decode=function(value){
      const t=oldDecode(value);
      const raw=value&255;

      /* Door bit 7 is lock/colour, not occupancy, so doors retain the raw
       * upper bits. For every other cell only the persistent Object bit 2 and
       * actor occupancy bit 7 are ignored for presentation classification. */
      if(t.baseType===2){
        t.presentationCode=raw;
        t.presentationKind='door';
        t.knownPresentation=true;
        return t;
      }
      const core=raw&0x7b; // clear bit 7 occupancy + bit 2 Object marker
      t.presentationCode=core;
      t.knownPresentation=true;

      if(core===0x00){
        t.presentationKind='space';t.kind='floor';t.featureLabel='Floor / space';
      }else if(core===0x03){
        t.presentationKind='wall';t.kind='wall';t.wallFeature='plain';t.featureLabel='Plain stone wall';
      }else if(core===0x0b){
        /* User-correlated against the original editor/game presentation. It
         * must not fall through to the plain-wall glyph simply because low
         * bits are 3. */
        t.presentationKind='mindrock';t.kind='mindrock';t.wallFeature='other';
        t.featureLabel='Mindrock';t.confidence='user-confirmed-presentation';
        t.note='ZX map presentation: normalised $0B is Mindrock.';
      }else if(core===0x09){
        t.presentationKind='pad';t.kind='pad';t.featureLabel='Floor pad / trigger';
      }else if(core===0x11){
        t.presentationKind='invisible-pad';t.kind='pad';t.featureLabel='Invisible floor pad / trigger';
      }else if(core===0x19){
        t.presentationKind='pit';t.kind='pit';t.featureLabel='Pit / lower opening';t.confidence='user-confirmed';
      }else if(core===0x21){
        t.presentationKind='upper-hole';t.kind='upper-hole';t.featureLabel='Upper / ceiling hole';t.confidence='alignment-proven';
      }else if(core===0x29){
        t.presentationKind='stair-up';t.kind='ladder-up';t.featureLabel='Stairs / ladder up';
      }else if(core===0x31){
        t.presentationKind='stair-down';t.kind='ladder-down';t.featureLabel='Stairs / ladder down';
      }else if((core&3)===3){
        const feature=(core>>3)&15;
        const face=['N','E','S','W'][feature&3];
        if(feature>=4&&feature<=7){
          t.presentationKind='socket-empty';t.kind='socket';t.wallFeature='socket';t.socketFilled=false;t.facing=face;t.featureLabel='Empty gem socket';
        }else if(feature>=8&&feature<=11){
          t.presentationKind='switch';t.kind='switch';t.wallFeature='switch';t.facing=face;t.featureLabel='Switch';
        }else if(feature>=12&&feature<=15){
          t.presentationKind='socket-filled';t.kind='socket';t.wallFeature='socket';t.socketFilled=true;t.facing=face;t.featureLabel='Filled crystal / gem socket';
        }else{
          t.knownPresentation=false;
        }
      }else{
        t.knownPresentation=false;
      }

      if(!t.knownPresentation){
        t.presentationKind='unknown';t.kind='unknown';
        t.featureLabel=`Unknown map cell $${hex2(core)}`;
        t.confidence='open';
        t.note='Not $00/$03 and no confirmed presentation rule. Object/occupancy bits are ignored for this classification.';
      }
      return t;
    };
    tiles.__amosPresentationPatched=true;
  }

  installAlignmentCorrection();
  installTilePresentation();

  /* -----------------------------------------------------------------------
   * Presentation primitives.  Semantic kinds are shared, but Modern, CPC and
   * Amiga/AMOS each keep their own established drawing language.
   * -------------------------------------------------------------------- */

  function text(ctx,v,x,y,size,c,align='center'){
    ctx.fillStyle=c;ctx.font=`${Math.max(7,size)}px ui-monospace,SFMono-Regular,Menlo,monospace`;
    ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(v,x,y);
  }

  function wallModern(ctx,x,y,s){
    ctx.fillStyle=MOD.wall;ctx.fillRect(x,y,s,s);ctx.strokeStyle=MOD.wallLine;ctx.lineWidth=Math.max(1,s*.035);
    for(let yy=y+s*.28;yy<y+s;yy+=s*.26){ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(x+s,yy);ctx.stroke();}
  }

  function wallAmstrad(ctx,x,y,s){
    ctx.fillStyle='#000';ctx.fillRect(x,y,s,s);ctx.strokeStyle=CPC_INK;ctx.lineWidth=1;
    for(let yy=y+s*.28;yy<y+s*.8;yy+=s*.2){ctx.beginPath();ctx.moveTo(x+s*.12,yy);ctx.lineTo(x+s*.88,yy);ctx.stroke();}
  }

  function lrect(ctx,x,y,s,colour,lx,ly,lw,lh,alpha){
    const ux=s/16,uy=s/8;ctx.save();if(alpha!=null)ctx.globalAlpha*=alpha;ctx.fillStyle=colour;
    ctx.fillRect(x+lx*ux,y+ly*uy,Math.max(1,lw*ux),Math.max(1,lh*uy));ctx.restore();
  }
  function lbox(ctx,x,y,s,colour,x1,y1,x2,y2,alpha){
    lrect(ctx,x,y,s,colour,x1,y1,x2-x1+1,1,alpha);lrect(ctx,x,y,s,colour,x1,y2,x2-x1+1,1,alpha);
    lrect(ctx,x,y,s,colour,x1,y1,1,y2-y1+1,alpha);lrect(ctx,x,y,s,colour,x2,y1,1,y2-y1+1,alpha);
  }
  function wallAmiga(ctx,x,y,s){lrect(ctx,x,y,s,AMIGA[4],1,2,15,6);}

  /* The ZX editor describes these as ladders.  Keep the vertical rails/rungs
     used by the earlier HTML presentation; do not silently replace them with
     the AMOS stair-step symbol merely because the 68k editor calls the family
     stairs. */
  function ladder(ctx,x,y,s,c,up,style){
    ctx.save();ctx.strokeStyle=c;ctx.lineWidth=Math.max(style==='amstrad'?1:2,s*.055);
    ctx.beginPath();ctx.moveTo(x+s*.32,y+s*.17);ctx.lineTo(x+s*.32,y+s*.83);ctx.moveTo(x+s*.68,y+s*.17);ctx.lineTo(x+s*.68,y+s*.83);ctx.stroke();
    for(let yy=.29;yy<.79;yy+=.15){ctx.beginPath();ctx.moveTo(x+s*.32,y+s*yy);ctx.lineTo(x+s*.68,y+s*yy);ctx.stroke();}
    text(ctx,up?'↑':'↓',x+s*.5,y+s*.52,s*.20,c);ctx.restore();
  }

  function fixtureAnchor(face,x,y,s){
    if(face==='N')return {cx:x+s*.5,cy:y+s*.16};
    if(face==='E')return {cx:x+s*.84,cy:y+s*.5};
    if(face==='S')return {cx:x+s*.5,cy:y+s*.84};
    if(face==='W')return {cx:x+s*.16,cy:y+s*.5};
    return {cx:x+s*.5,cy:y+s*.5};
  }

  function drawAmigaFixture(ctx,x,y,s,cell){
    const t=cell.tile,dir=['N','E','S','W'].indexOf(t.facing);if(dir<0)return;
    const isSwitch=t.presentationKind==='switch',filled=t.presentationKind==='socket-filled';
    const sp=specialForCell(cell);let outer=isSwitch?AMIGA[14]:(filled?(sp?specialColour(sp):AMIGA[14]):AMIGA[14]);
    const inner=isSwitch?AMIGA[0]:(filled?outer:AMIGA[0]);
    if(dir===0){lrect(ctx,x,y,s,outer,7,1,2,3);lrect(ctx,x,y,s,outer,5,1,6,2);lrect(ctx,x,y,s,inner,7,1,2,1);}
    else if(dir===1){lrect(ctx,x,y,s,outer,10,4,6,1);lrect(ctx,x,y,s,outer,12,3,4,3);lrect(ctx,x,y,s,inner,14,4,2,1);}
    else if(dir===2){lrect(ctx,x,y,s,outer,7,5,2,3);lrect(ctx,x,y,s,outer,5,6,6,2);lrect(ctx,x,y,s,inner,7,7,2,1);}
    else {lrect(ctx,x,y,s,outer,1,4,6,1);lrect(ctx,x,y,s,outer,1,3,4,3);lrect(ctx,x,y,s,inner,1,4,2,1);}
  }

  function drawModernFixture(ctx,x,y,s,cell){
    const t=cell.tile,a=fixtureAnchor(t.facing,x,y,s),isSwitch=t.presentationKind==='switch',filled=t.presentationKind==='socket-filled',sp=specialForCell(cell);
    if(isSwitch){ctx.fillStyle=MOD.switch;ctx.fillRect(a.cx-s*.11,a.cy-s*.11,s*.22,s*.22);ctx.strokeStyle='#ffffff';ctx.lineWidth=Math.max(1,s*.035);ctx.strokeRect(a.cx-s*.08,a.cy-s*.08,s*.16,s*.16);}
    else {const c=filled?(sp?specialColour(sp):MOD.socket):MOD.socket;ctx.strokeStyle=c;ctx.lineWidth=Math.max(2,s*.05);ctx.strokeRect(a.cx-s*.11,a.cy-s*.11,s*.22,s*.22);if(filled){ctx.fillStyle=c;ctx.beginPath();ctx.arc(a.cx,a.cy,s*.065,0,Math.PI*2);ctx.fill();}}
  }

  function drawAmstradFixture(ctx,x,y,s,cell){
    const t=cell.tile,a=fixtureAnchor(t.facing,x,y,s),isSwitch=t.presentationKind==='switch',filled=t.presentationKind==='socket-filled';
    if(isSwitch)text(ctx,'S',a.cx,a.cy,s*.22,CPC_INK);
    else {ctx.strokeStyle=CPC_INK;ctx.lineWidth=1;ctx.strokeRect(a.cx-s*.10,a.cy-s*.10,s*.20,s*.20);if(filled){ctx.fillStyle=CPC_INK;ctx.fillRect(a.cx-s*.045,a.cy-s*.045,s*.09,s*.09);}}
  }

  function drawAmigaDoor(ctx,x,y,s,cell){
    const t=cell.tile,horizontal=t.orientation==='NS',closed=t.closedBit!==false,lock=t.lockId?LOCK_COLOURS[t.lockId]||AMIGA[14]:null;
    ctx.fillStyle=AMIGA[0];ctx.fillRect(x,y,s,s);
    if(horizontal){lrect(ctx,x,y,s,AMIGA[4],1,3,15,3);if(lock)lrect(ctx,x,y,s,lock,1,4,15,1);if(!closed)lrect(ctx,x,y,s,AMIGA[0],5,3,7,3);}
    else {lrect(ctx,x,y,s,AMIGA[4],5,1,6,7);if(lock)lrect(ctx,x,y,s,lock,7,1,2,7);if(!closed)lrect(ctx,x,y,s,AMIGA[0],5,3,6,3);}
  }

  function drawModernDoor(ctx,x,y,s,cell){
    const t=cell.tile,horizontal=t.orientation==='NS',closed=t.closedBit!==false;
    ctx.fillStyle='#f5e7d9';ctx.fillRect(x,y,s,s);ctx.fillStyle=MOD.door;
    if(closed){if(horizontal)ctx.fillRect(x+s*.08,y+s*.36,s*.84,s*.28);else ctx.fillRect(x+s*.36,y+s*.08,s*.28,s*.84);}
    else if(horizontal){ctx.fillRect(x+s*.08,y+s*.36,s*.27,s*.28);ctx.fillRect(x+s*.65,y+s*.36,s*.27,s*.28);}
    else {ctx.fillRect(x+s*.36,y+s*.08,s*.28,s*.27);ctx.fillRect(x+s*.36,y+s*.65,s*.28,s*.27);}
    if(t.lockId){ctx.fillStyle=LOCK_COLOURS[t.lockId]||'#eee';if(horizontal)ctx.fillRect(x+s*.08,y+s*.47,s*.84,Math.max(2,s*.06));else ctx.fillRect(x+s*.47,y+s*.08,Math.max(2,s*.06),s*.84);}
  }

  function drawAmstradDoor(ctx,x,y,s,cell){
    const t=cell.tile,horizontal=t.orientation==='NS',closed=t.closedBit!==false;
    ctx.fillStyle='#000';ctx.fillRect(x,y,s,s);ctx.fillStyle=CPC_INK;
    if(closed){if(horizontal)ctx.fillRect(x+s*.08,y+s*.39,s*.84,s*.22);else ctx.fillRect(x+s*.39,y+s*.08,s*.22,s*.84);}
    else if(horizontal){ctx.fillRect(x+s*.08,y+s*.39,s*.27,s*.22);ctx.fillRect(x+s*.65,y+s*.39,s*.27,s*.22);}
    else {ctx.fillRect(x+s*.39,y+s*.08,s*.22,s*.27);ctx.fillRect(x+s*.39,y+s*.65,s*.22,s*.27);}
    if(t.lockId)text(ctx,String(t.lockId),x+s*.5,y+s*.52,s*.23,CPC_INK);
  }

  function drawUnknown(ctx,x,y,s,cell,style){
    ctx.save();ctx.fillStyle='rgba(255,0,255,.58)';ctx.fillRect(x+s*.08,y+s*.08,s*.84,s*.84);ctx.strokeStyle=MAGENTA;ctx.lineWidth=Math.max(2,s*.06);ctx.strokeRect(x+s*.08,y+s*.08,s*.84,s*.84);
    ctx.beginPath();ctx.moveTo(x+s*.18,y+s*.18);ctx.lineTo(x+s*.82,y+s*.82);ctx.moveTo(x+s*.82,y+s*.18);ctx.lineTo(x+s*.18,y+s*.82);ctx.stroke();text(ctx,hex2(cell.tile.presentationCode),x+s*.5,y+s*.52,s*.20,style==='modern'?'#111':'#fff');ctx.restore();
  }

  function drawMindrock(ctx,x,y,s,style){
    if(style==='modern'){ctx.fillStyle=MOD.mindrock;ctx.fillRect(x+s*.13,y+s*.13,s*.74,s*.74);text(ctx,'M',x+s*.5,y+s*.52,s*.24,'#fff');}
    else if(style==='amstrad'){ctx.fillStyle='#000';ctx.fillRect(x,y,s,s);ctx.strokeStyle=CPC_INK;ctx.lineWidth=1;ctx.strokeRect(x+s*.16,y+s*.16,s*.68,s*.68);text(ctx,'M',x+s*.5,y+s*.52,s*.25,CPC_INK);}
    else {lrect(ctx,x,y,s,AMIGA[8],1,1,15,7);lbox(ctx,x,y,s,AMIGA[7],1,1,15,7);lbox(ctx,x,y,s,AMIGA[7],2,1,14,7);}
  }

  function drawPadFamily(ctx,x,y,s,style,kind){
    if(style==='modern'){
      if(kind==='pad'){ctx.strokeStyle=MOD.pad;ctx.lineWidth=Math.max(2,s*.06);ctx.strokeRect(x+s*.22,y+s*.22,s*.56,s*.56);}
      else if(kind==='invisible-pad'){ctx.strokeStyle='#9aa4ad';ctx.setLineDash&&ctx.setLineDash([Math.max(2,s*.08),Math.max(2,s*.05)]);ctx.strokeRect(x+s*.24,y+s*.24,s*.52,s*.52);ctx.setLineDash&&ctx.setLineDash([]);}
      else if(kind==='pit'){ctx.fillStyle=MOD.pit;ctx.fillRect(x+s*.19,y+s*.19,s*.62,s*.62);}
      else {ctx.strokeStyle=MOD.hole;ctx.lineWidth=Math.max(1,s*.045);ctx.strokeRect(x+s*.18,y+s*.18,s*.64,s*.64);ctx.strokeRect(x+s*.24,y+s*.18,s*.52,s*.64);}
    }else if(style==='amstrad'){
      ctx.strokeStyle=CPC_INK;ctx.fillStyle=CPC_INK;ctx.lineWidth=1;
      if(kind==='pad')ctx.strokeRect(x+s*.25,y+s*.25,s*.5,s*.5);
      else if(kind==='invisible-pad'){ctx.strokeRect(x+s*.30,y+s*.30,s*.4,s*.4);}
      else if(kind==='pit')ctx.fillRect(x+s*.22,y+s*.22,s*.56,s*.56);
      else {ctx.strokeRect(x+s*.20,y+s*.20,s*.60,s*.60);ctx.strokeRect(x+s*.27,y+s*.20,s*.46,s*.60);}
    }else {
      if(kind==='pad')lrect(ctx,x,y,s,AMIGA[6],3,2,11,5);
      else if(kind==='invisible-pad')lrect(ctx,x,y,s,AMIGA[1],3,2,11,5);
      else if(kind==='pit')lrect(ctx,x,y,s,AMIGA[2],3,2,11,5);
      else {lbox(ctx,x,y,s,AMIGA[1],3,2,13,6);lbox(ctx,x,y,s,AMIGA[1],4,2,12,6);}
    }
  }

  function drawRuntimeMagic(ctx,x,y,s,cell,style){
    const k=cell.runtimeMagic||cell.runtimeFeature;if(!k)return;
    if(k==='mindrock')drawMindrock(ctx,x,y,s,style);
    else if(k==='firepath'){ctx.strokeStyle=style==='amstrad'?CPC_INK:style==='modern'?'#d94a55':AMIGA[12];ctx.lineWidth=Math.max(2,s*.07);ctx.strokeRect(x+s*.18,y+s*.18,s*.64,s*.64);text(ctx,'F',x+s*.5,y+s*.52,s*.24,ctx.strokeStyle);}
    else if(k==='formwall'){ctx.strokeStyle=style==='amstrad'?CPC_INK:style==='modern'?'#399457':AMIGA[6];ctx.lineWidth=Math.max(2,s*.07);ctx.strokeRect(x+s*.10,y+s*.10,s*.80,s*.80);text(ctx,'W',x+s*.5,y+s*.52,s*.22,ctx.strokeStyle);}
  }

  function drawBaseModern(ctx,x,y,s,cell,ix,iy){
    const k=cell.tile.presentationKind;ctx.fillStyle=((ix+iy)&1)?MOD.floor2:MOD.floor;ctx.fillRect(x,y,s,s);
    if(k==='wall')wallModern(ctx,x,y,s);
    else if(k==='door')drawModernDoor(ctx,x,y,s,cell);
    else if(k==='switch'||k==='socket-empty'||k==='socket-filled'){wallModern(ctx,x,y,s);drawModernFixture(ctx,x,y,s,cell);}
    else if(k==='mindrock')drawMindrock(ctx,x,y,s,'modern');
    else if(k==='pad'||k==='invisible-pad'||k==='pit'||k==='upper-hole')drawPadFamily(ctx,x,y,s,'modern',k);
    else if(k==='stair-up'||k==='stair-down')ladder(ctx,x,y,s,MOD.ladder,k==='stair-up','modern');
    else if(k==='unknown')drawUnknown(ctx,x,y,s,cell,'modern');
    drawRuntimeMagic(ctx,x,y,s,cell,'modern');
  }

  function drawBaseAmstrad(ctx,x,y,s,cell){
    const k=cell.tile.presentationKind;ctx.fillStyle='#000';ctx.fillRect(x,y,s,s);
    if(k==='wall')wallAmstrad(ctx,x,y,s);
    else if(k==='door')drawAmstradDoor(ctx,x,y,s,cell);
    else if(k==='switch'||k==='socket-empty'||k==='socket-filled'){wallAmstrad(ctx,x,y,s);drawAmstradFixture(ctx,x,y,s,cell);}
    else if(k==='mindrock')drawMindrock(ctx,x,y,s,'amstrad');
    else if(k==='pad'||k==='invisible-pad'||k==='pit'||k==='upper-hole')drawPadFamily(ctx,x,y,s,'amstrad',k);
    else if(k==='stair-up'||k==='stair-down')ladder(ctx,x,y,s,CPC_INK,k==='stair-up','amstrad');
    else if(k==='unknown')drawUnknown(ctx,x,y,s,cell,'amstrad');
    else {ctx.fillStyle=CPC_INK;for(let yy=y+s*.25;yy<y+s*.8;yy+=s*.25)for(let xx=x+s*.25;xx<x+s*.8;xx+=s*.25)ctx.fillRect(xx,yy,1,1);}
    drawRuntimeMagic(ctx,x,y,s,cell,'amstrad');
  }

  function drawBaseAmiga(ctx,x,y,s,cell){
    const k=cell.tile.presentationKind;ctx.fillStyle=AMIGA[0];ctx.fillRect(x,y,s,s);
    if(k==='wall')wallAmiga(ctx,x,y,s);
    else if(k==='door')drawAmigaDoor(ctx,x,y,s,cell);
    else if(k==='switch'||k==='socket-empty'||k==='socket-filled'){wallAmiga(ctx,x,y,s);drawAmigaFixture(ctx,x,y,s,cell);}
    else if(k==='mindrock')drawMindrock(ctx,x,y,s,'amiga');
    else if(k==='pad'||k==='invisible-pad'||k==='pit'||k==='upper-hole')drawPadFamily(ctx,x,y,s,'amiga',k);
    else if(k==='stair-up'||k==='stair-down')ladder(ctx,x,y,s,AMIGA[k==='stair-up'?3:2],k==='stair-up','amiga');
    else if(k==='unknown')drawUnknown(ctx,x,y,s,cell,'amiga');
    drawRuntimeMagic(ctx,x,y,s,cell,'amiga');
  }

  function drawBase(ctx,x,y,s,cell,style,ix,iy){
    if(style==='modern')drawBaseModern(ctx,x,y,s,cell,ix,iy);
    else if(style==='amstrad')drawBaseAmstrad(ctx,x,y,s,cell);
    else drawBaseAmiga(ctx,x,y,s,cell);
  }

  function drawElevationIcon(ctx,x,y,s,kind,style){
    if(kind==='stair-up'||kind==='stair-down'){
      const c=style==='modern'?MOD.ladder:style==='amstrad'?CPC_INK:AMIGA[kind==='stair-up'?3:2];
      ladder(ctx,x,y,s,c,kind==='stair-up',style);return;
    }
    drawPadFamily(ctx,x,y,s,style,kind);
  }

  function marker(ctx,label,x,y,s,fill,ink='#fff',corner='centre'){
    ctx.fillStyle=fill;if(corner==='br')ctx.fillRect(x+s*.62,y+s*.62,s*.32,s*.32);else if(corner==='bl')ctx.fillRect(x+s*.06,y+s*.62,s*.32,s*.32);else {ctx.beginPath();ctx.arc(x+s*.5,y+s*.5,s*.26,0,Math.PI*2);ctx.fill();}
    const tx=corner==='br'?x+s*.78:corner==='bl'?x+s*.22:x+s*.5,ty=corner==='centre'?y+s*.52:y+s*.78;text(ctx,label,tx,ty,s*.19,ink);
  }

  /* -----------------------------------------------------------------------
   * Layout overlays and alignment validation
   * -------------------------------------------------------------------- */

  function cellAtWorld(tape,tower,floorIndex,wx,wy){
    const f=tower.floors[floorIndex];if(!f||!f.used)return null;const x=wx-f.xOffset,y=wy-f.yOffset;
    if(x<0||y<0||x>=f.width||y>=f.height)return null;return global.BWBloodwych.getCell(tape,tower,f,x,y);
  }

  function layoutAnalysis(tape,tower){
    const issues=[],links=[];const expected={'stair-up':{delta:1,kind:'stair-down'},'stair-down':{delta:-1,kind:'stair-up'},'pit':{delta:-1,kind:'upper-hole'},'upper-hole':{delta:1,kind:'pit'}};
    for(const f of tower.floors||[]){if(!f.used)continue;for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++){
      const c=global.BWBloodwych.getCell(tape,tower,f,x,y);if(!c)continue;const rule=expected[c.tile.presentationKind];if(!rule)continue;
      const wx=f.xOffset+x,wy=f.yOffset+y,targetFloor=f.floorIndex+rule.delta,target=cellAtWorld(tape,tower,targetFloor,wx,wy);
      if(!target||target.tile.presentationKind!==rule.kind)issues.push({floor:f.floorIndex,x,y,worldX:wx,worldY:wy,kind:c.tile.presentationKind,expectedFloor:targetFloor,expectedKind:rule.kind});
      else if(c.tile.presentationKind==='stair-up')links.push({floor:f.floorIndex,x,y,targetFloor,targetX:target.x,targetY:target.y,worldX:wx,worldY:wy});
    }}return {issues,links};
  }

  function drawElevationOverlay(ctx,x,y,s,kind,style,colour,alpha){
    ctx.save();ctx.globalAlpha=alpha;drawElevationIcon(ctx,x,y,s,kind,style);ctx.strokeStyle=colour;ctx.lineWidth=Math.max(1,s*.045);ctx.strokeRect(x+s*.10,y+s*.10,s*.80,s*.80);ctx.restore();
  }

  function modeName(){const e=typeof document!=='undefined'?document.querySelector('.mode-tabs button.active'):null;return e&&e.dataset?e.dataset.mode:'viewer';}
  function checked(id,defaultValue=false){const e=byId(id);return e?!!e.checked:defaultValue;}

  function installUi(){
    if(typeof document==='undefined')return;const sel=byId('mapStyle');
    if(sel){const modern=sel.querySelector('option[value="modern"]'),amiga=sel.querySelector('option[value="amiga"]'),cpc=sel.querySelector('option[value="amstrad"]');if(modern)modern.textContent='Modern';if(cpc)cpc.textContent='CPC / Amstrad';if(amiga)amiga.textContent='Amiga / AMOS';sel.value='amiga';}
    const tabs=document.querySelector('.mode-tabs');if(tabs&&!tabs.__mapPresentationHook){tabs.addEventListener('click',event=>{if(!event.target.closest('button[data-mode]'))return;setTimeout(()=>{const proxy=byId('showGrid');if(proxy)proxy.dispatchEvent(new Event('input',{bubbles:true}));},0);});tabs.__mapPresentationHook=true;}
    const strip=document.querySelector('.overlay-strip');if(strip&&!byId('ovLayoutAbove')){
      const defs=[['ovLayoutAbove','ABOVE FLOOR',true,'Layout: translucent floor +1 grid and downward/opening features'],['ovLayoutBelow','BELOW FLOOR',true,'Layout: translucent floor -1 grid and upward/opening features'],['ovLayoutLinks','STAIR LINKS',false,'Layout: show verified inter-floor stair links']];
      for(const [id,label,on,title] of defs){const lab=document.createElement('label');lab.className='layout-overlay-control';lab.title=title;const input=document.createElement('input');input.type='checkbox';input.id=id;input.checked=on;lab.append(input,document.createTextNode(' '+label));strip.appendChild(lab);input.addEventListener('input',()=>{const proxy=byId('showGrid');if(proxy)proxy.dispatchEvent(new Event('input',{bubbles:true}));});}
    }
  }
  installUi();

  function overlayEnabled(options,id,key){const e=byId(id);return e?!!e.checked:!!(options.overlays&&options.overlays[key]);}
  function gridColour(style,mode){if(mode==='layout')return '#2f799e';if(style==='modern')return MOD.grid;if(style==='amstrad')return '#3f3f7f';return '#303030';}

  function render(canvas,tape,tower,floor,options){
    options=Object.assign({cellSize:30,aligned:true,showGrid:true,showHex:false,style:'amiga',selected:null,overlays:{}},options||{});
    const s=options.cellSize,style=['modern','amstrad','amiga'].includes(options.style)?options.style:'amiga',mode=options.mode||modeName();
    if(typeof document!=='undefined')document.querySelectorAll('.layout-overlay-control').forEach(el=>el.classList.toggle('hidden',mode!=='layout'));
    const ml=style==='modern'?42:36,mt=style==='modern'?34:28,gw=Math.max(1,floor.width),gh=Math.max(1,floor.height);
    canvas.width=ml+gw*s+8;canvas.height=mt+gh*s+8;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
    ctx.fillStyle=style==='modern'?'#d7e0e7':style==='amstrad'?'#060685':'#000';ctx.fillRect(0,0,canvas.width,canvas.height);
    const coord=style==='modern'?MOD.ink:'#ddd';for(let x=0;x<floor.width;x++)text(ctx,String(x),ml+x*s+s*.5,mt*.5,s*.27,coord);for(let y=0;y<floor.height;y++)text(ctx,String(y),ml-7,mt+y*s+s*.5,s*.27,coord,'right');

    const analysis=mode==='layout'?layoutAnalysis(tape,tower):{issues:[],links:[]},issueSet=new Set(analysis.issues.map(i=>`${i.floor}:${i.x}:${i.y}`));
    const relativeOrigin=f=>({x:f.xOffset-floor.xOffset,y:f.yOffset-floor.yOffset}),nativeShift=1,adjacent=[];
    if(mode==='layout'){if(checked('ovLayoutBelow',true))adjacent.push({index:floor.floorIndex-1,shift:-nativeShift,colour:'#69768a',kinds:BELOW_ELEVATION_KINDS});if(checked('ovLayoutAbove',true))adjacent.push({index:floor.floorIndex+1,shift:nativeShift,colour:'#8798b2',kinds:ABOVE_ELEVATION_KINDS});}

    /* Adjacent geometry is a translucent world-aligned reference only. */
    for(const adj of adjacent){const f=tower.floors[adj.index];if(!f||!f.used)continue;const o=relativeOrigin(f);ctx.save();ctx.globalAlpha=.32;ctx.strokeStyle=adj.colour;ctx.lineWidth=1;
      for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++){const px=ml+(o.x+x)*s+adj.shift,py=mt+(o.y+y)*s+adj.shift;ctx.strokeRect(px+.5,py+.5,s-1,s-1);}ctx.restore();}
    for(const adj of adjacent){const f=tower.floors[adj.index];if(!f||!f.used)continue;const o=relativeOrigin(f);for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++){
      const c=global.BWBloodwych.getCell(tape,tower,f,x,y);if(!c||!adj.kinds.has(c.tile.presentationKind))continue;const localX=o.x+x,localY=o.y+y;if(localX<-1||localY<-1||localX>floor.width||localY>floor.height)continue;
      const px=ml+localX*s+adj.shift,py=mt+localY*s+adj.shift;drawElevationOverlay(ctx,px,py,s,c.tile.presentationKind,style,adj.colour,.35);
      if(issueSet.has(`${f.floorIndex}:${x}:${y}`)){ctx.save();ctx.globalAlpha=.85;ctx.strokeStyle='#f55a50';ctx.lineWidth=Math.max(2,s*.07);ctx.strokeRect(px+s*.06,py+s*.06,s*.88,s*.88);ctx.restore();}
    }}

    /* Draw selected-floor cell presentation first. Grid lines are deliberately
       drawn AFTER the cells so style fills can never erase the grid. */
    for(let y=0;y<floor.height;y++)for(let x=0;x<floor.width;x++){
      const px=ml+x*s,py=mt+y*s,c=global.BWBloodwych.getCell(tape,tower,floor,x,y);if(!c)continue;
      if(mode==='layout'){
        if(ELEVATION_KINDS.has(c.tile.presentationKind)){drawElevationOverlay(ctx,px,py,s,c.tile.presentationKind,style,'#4b8eb4',.72);if(issueSet.has(`${floor.floorIndex}:${x}:${y}`)){ctx.save();ctx.strokeStyle='#f55a50';ctx.lineWidth=Math.max(2,s*.07);ctx.strokeRect(px+s*.04,py+s*.04,s*.92,s*.92);ctx.restore();}}
      }else drawBase(ctx,px,py,s,c,style,x,y);
    }

    if(options.showGrid){ctx.save();ctx.globalAlpha=1;ctx.strokeStyle=gridColour(style,mode);ctx.lineWidth=1;for(let y=0;y<floor.height;y++)for(let x=0;x<floor.width;x++)ctx.strokeRect(ml+x*s+.5,mt+y*s+.5,s-1,s-1);ctx.restore();}

    const overlays=mode==='layout'?{starts:false,events:false,objects:false,monsters:false,specials:false}:{starts:overlayEnabled(options,'ovStarts','starts'),events:overlayEnabled(options,'ovEvents','events'),objects:overlayEnabled(options,'ovObjects','objects'),monsters:overlayEnabled(options,'ovMonsters','monsters'),specials:overlayEnabled(options,'ovSpecials','specials')};
    if(mode!=='layout')for(let y=0;y<floor.height;y++)for(let x=0;x<floor.width;x++){
      const px=ml+x*s,py=mt+y*s,c=global.BWBloodwych.getCell(tape,tower,floor,x,y);if(!c)continue;
      if(overlays.objects&&c.objectStacks.length)marker(ctx,c.objectStacks.length>1?`O${c.objectStacks.length}`:'O',px,py,s,style==='amiga'?AMIGA[5]:MOD.object,'#fff','bl');
      if(overlays.monsters&&c.monsters.length)marker(ctx,c.monsters.length>1?`M${c.monsters.length}`:'M',px,py,s,style==='amiga'?AMIGA[12]:MOD.monster,'#fff','br');
      if(overlays.events&&c.events.length)marker(ctx,c.events.length>1?`E${c.events.length}`:'E',px,py,s,style==='amiga'?AMIGA[8]:MOD.event,'#fff','centre');
      if(options.showHex)text(ctx,c.value.toString(16).toUpperCase().padStart(2,'0'),px+2,py+s*.14,s*.18,style==='modern'?'#52616d':'#aaa','left');
    }
    if(overlays.starts)for(const ps of tower.playerStarts||[]){if(ps.floorIndex!==floor.floorIndex||ps.x>=floor.width||ps.y>=floor.height)continue;const px=ml+ps.x*s,py=mt+ps.y*s;ctx.fillStyle=ps.player===1?'#2474d2':'#d83e4b';ctx.fillRect(px+s*.18,py+s*.18,s*.64,s*.64);text(ctx,`P${ps.player}`,px+s*.5,py+s*.52,s*.26,'#fff');}
    if(overlays.specials&&tower.specials)for(const sp of tower.specials.crystal||[]){if(sp.empty||!sp.source||sp.source.floorIndex!==floor.floorIndex)continue;const px=ml+sp.source.x*s,py=mt+sp.source.y*s;marker(ctx,specialLabel(sp),px,py,s,specialColour(sp),'#fff','br');}

    if(mode==='layout'&&checked('ovLayoutLinks',false)){ctx.save();ctx.strokeStyle='#50e1a5';ctx.lineWidth=Math.max(2,s*.05);for(const link of analysis.links){if(link.floor!==floor.floorIndex&&link.targetFloor!==floor.floorIndex)continue;const source=tower.floors[link.floor],target=tower.floors[link.targetFloor];if(!source||!target)continue;const so=relativeOrigin(source),to=relativeOrigin(target);let sx=ml+(so.x+link.x+.5)*s,sy=mt+(so.y+link.y+.5)*s,tx=ml+(to.x+link.targetX+.5)*s,ty=mt+(to.y+link.targetY+.5)*s;if(link.floor===floor.floorIndex-1){sx-=nativeShift;sy-=nativeShift;}else if(link.floor===floor.floorIndex+1){sx+=nativeShift;sy+=nativeShift;}if(link.targetFloor===floor.floorIndex-1){tx-=nativeShift;ty-=nativeShift;}else if(link.targetFloor===floor.floorIndex+1){tx+=nativeShift;ty+=nativeShift;}ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(tx,ty);ctx.stroke();}ctx.restore();}

    if(options.selected){const px=ml+options.selected.x*s,py=mt+options.selected.y*s;ctx.strokeStyle=style==='modern'?'#008fa0':'#00ffff';ctx.lineWidth=3;ctx.strokeRect(px+1.5,py+1.5,s-3,s-3);ctx.lineWidth=1;}
    return {marginLeft:ml,marginTop:mt,originX:0,originY:0,cellSize:s,gridW:gw,gridH:gh,style,layoutIssues:analysis.issues,layoutNativeShift:nativeShift};
  }

  global.BWRenderer={render,rowLabel,RUNTIME_MAGIC_KINDS:['firepath','mindrock','formwall'],layoutAnalysis,layoutAdjacentKinds(side){return Array.from(side==='below'?BELOW_ELEVATION_KINDS:side==='above'?ABOVE_ELEVATION_KINDS:[]);},presentationCore(value){return (value&3)===2?(value&255):(value&0x7b);},ELEVATION_KINDS:Array.from(ELEVATION_KINDS)};
})(window);
