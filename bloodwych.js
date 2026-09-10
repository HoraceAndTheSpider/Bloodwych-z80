/* Bloodwych ZX Spectrum Level Data model — Stage 5.
 *
 * Offsets below are LOADED PAYLOAD offsets. Tape data blocks include the
 * one-byte Spectrum flag first, therefore payload offset $000 is raw[1].
 * Unknown bytes are never regenerated: semantic writes patch only explicit
 * bytes in the loaded source block.
 */
(function (global) {
  'use strict';

  const BLOCK_NAMES = {
    d: 'Keeps', e: 'Serpents', f: 'Serpent2', g: 'Moons', h: 'Moon2',
    i: 'Dragons', j: 'Dragon2', k: 'Archaus', l: 'Chaos2', m: 'Zendiks'
  };

  const PAYLOAD_BIAS = 1;
  const PAYLOAD_SIZE = 0x08CB;
  const FLOOR_HEADER = 0x022;
  const FLOOR_DESCRIPTOR_SIZE = 6;
  const FLOOR_COUNT = 5;
  const MAP_BASE = 0x040;
  const MAP_SIZE = 0x40C;
  const TEAM_BASE = 0x44C;
  const TEAM_COUNT = 10;
  const TEAM_WIDTH = 4;
  const MONSTER_COUNT_OFFSET = 0x474;
  const MONSTER_BASE = 0x475;
  const MONSTER_COUNT_MAX = 42;
  const MONSTER_SIZE = 16;
  const OBJECT_USED_OFFSET = 0x715;
  const OBJECT_BASE = 0x717;
  const OBJECT_ARENA_SIZE = 0x100;
  const EVENT_BASE = 0x817;
  const EVENT_COUNT = 45;
  const EVENT_SIZE = 4;
  const ZENDIK_NORMAL_EVENT_COUNT = 36;

  const ACTION_LABELS = new Map([
    [0x00,'Remove stone wall'], [0x02,'Clear target bit 4'], [0x04,'Set target bit 4'],
    [0x06,'Toggle target bit 4'], [0x08,'Random spinner'], [0x0A,'Turn 180 degrees'],
    [0x0C,'Random ±90-degree spinner'], [0x0E,'Internal Vivify'], [0x10,'External/remains Vivify'],
    [0x12,'Toggle floor / stone wall'], [0x14,'Create stone wall'],
    [0x16,'Set target feature/orientation field to $10'], [0x18,'Teleport F/X/Y with flash'],
    [0x1A,'Teleport F/X/Y without flash'], [0x1C,'Advance target orientation/subfield by one $08 step'],
    [0x1E,'Toggle target bit 5'], [0x20,'Tower exit / progression centre-pad path'],
    [0x22,'Tower exit / progression side-pad path'], [0x24,'Move/shift stone wall to following map byte'],
    [0x26,'Toggle target feature/subfield state'], [0x28,'Game completion'],
    [0x2A,'Set target feature/orientation field to $08']
  ]);

  function rawOffset(loadedOffset) { return PAYLOAD_BIAS + loadedOffset; }
  function payloadByte(block, loadedOffset) { const p=rawOffset(loadedOffset); return p < block.raw.length-1 ? block.raw[p] : 0xff; }
  function payloadSlice(block, start, end) { const out=new Uint8Array(Math.max(0,end-start)); for(let i=0;i<out.length;i++)out[i]=payloadByte(block,start+i); return out; }
  function be16(block, loadedOffset) { return (payloadByte(block, loadedOffset) << 8) | payloadByte(block, loadedOffset + 1); }
  function le16(block, loadedOffset) { return payloadByte(block, loadedOffset) | (payloadByte(block, loadedOffset + 1) << 8); }
  function hex(n,w=2){return '$'+(n>>>0).toString(16).toUpperCase().padStart(w,'0');}
  function integerIn(value,min,max,label){
    if(!Number.isInteger(value)||value<min||value>max)throw new Error(`${label} must be ${min}-${max}.`);
    return value;
  }

  function loadedToRuntime(loadedOffset) {
    return loadedOffset >= 0x006 ? 0x9DBD + loadedOffset : null;
  }

  function parseDescriptor(block, floorIndex) {
    const p = FLOOR_HEADER + floorIndex * FLOOR_DESCRIPTOR_SIZE;
    return {
      floorIndex,
      descriptorLoadedOffset: p,
      width: payloadByte(block,p),
      height: payloadByte(block,p+1),
      dataOffset: be16(block,p+2),
      xOffset: payloadByte(block,p+4),
      yOffset: payloadByte(block,p+5)
    };
  }

  function floorForMapOffset(tower, mapOffset) {
    for (const f of tower.floors) {
      if (!f.used) continue;
      const start=f.dataOffset,end=start+f.cellCount;
      if (mapOffset>=start && mapOffset<end) {
        const idx=mapOffset-start;
        return { floor:f, x:idx%f.width, y:Math.floor(idx/f.width), cellIndex:idx };
      }
    }
    return null;
  }

  function mapOffsetForCell(floor,x,y) {
    if (!floor || !floor.used || x<0 || y<0 || x>=floor.width || y>=floor.height) return null;
    return floor.dataOffset + y*floor.width+x;
  }

  function parseEvents(block, towerId, floors) {
    const out=[];
    const normalLimit=towerId==='m'?ZENDIK_NORMAL_EVENT_COUNT:EVENT_COUNT;
    for(let slot=0;slot<EVENT_COUNT;slot++){
      const p=EVENT_BASE+slot*EVENT_SIZE;
      const raw=Array.from(payloadSlice(block,p,p+4));
      const protectedSlot=towerId==='m' && slot>=ZENDIK_NORMAL_EVENT_COUNT;
      const empty=!protectedSlot && raw.every(v=>v===0xff);
      const sourceOffset=((raw[0]&7)<<8)|raw[1];
      const action=(raw[0]&0xf8)>>2;
      const targetFloor=raw[2]>>5,targetX=raw[2]&0x1f,targetY=raw[3];
      let source=null;
      if(!empty && !protectedSlot){
        for(const f of floors){
          if(!f.used)continue;
          if(sourceOffset>=f.dataOffset && sourceOffset<f.dataOffset+f.cellCount){
            const idx=sourceOffset-f.dataOffset;
            source={floorIndex:f.floorIndex,x:idx%f.width,y:Math.floor(idx/f.width),cellIndex:idx};break;
          }
        }
      }
      out.push({slot,loadedOffset:p,raw,empty,protected:protectedSlot,normal:slot<normalLimit,
        sourceOffset,source,action,actionLabel:ACTION_LABELS.get(action)||`Action ${hex(action)}`,
        targetFloor,targetX,targetY});
    }
    return out;
  }

  function parseObjectArena(block, floors) {
    const used=le16(block,OBJECT_USED_OFFSET);
    const safeUsed=Math.min(used,OBJECT_ARENA_SIZE);
    const stacks=[];let p=0,index=0,error=null;
    while(p<safeUsed){
      if(p+3>safeUsed){error=`Object arena ends inside stack header at +${hex(p,3)}`;break;}
      const b0=payloadByte(block,OBJECT_BASE+p),b1=payloadByte(block,OBJECT_BASE+p+1),count=payloadByte(block,OBJECT_BASE+p+2);
      const len=3+count*2;
      if(count>126 || p+len>safeUsed){error=`Object stack ${index} overruns used arena at +${hex(p,3)}`;break;}
      const mapOffset=((b0&0x3f)<<8)|b1,position=b0>>6;
      let source=null;
      for(const f of floors){
        if(!f.used)continue;
        if(mapOffset>=f.dataOffset&&mapOffset<f.dataOffset+f.cellCount){const i=mapOffset-f.dataOffset;source={floorIndex:f.floorIndex,x:i%f.width,y:Math.floor(i/f.width),cellIndex:i};break;}
      }
      const items=[];
      for(let i=0;i<count;i++)items.push({index:i,code:payloadByte(block,OBJECT_BASE+p+3+i*2),state:payloadByte(block,OBJECT_BASE+p+4+i*2)});
      stacks.push({index,arenaOffset:p,loadedOffset:OBJECT_BASE+p,length:len,mapOffset,position,count,items,source,raw:Array.from(payloadSlice(block,OBJECT_BASE+p,OBJECT_BASE+p+len))});
      p+=len;index++;
    }
    return {used,safeUsed,free:Math.max(0,OBJECT_ARENA_SIZE-safeUsed),stacks,error};
  }

  function parseTeams(block){
    const teams=[];
    for(let t=0;t<TEAM_COUNT;t++){
      const members=[];for(let i=0;i<TEAM_WIDTH;i++)members.push(payloadByte(block,TEAM_BASE+t*TEAM_WIDTH+i));
      teams.push({index:t,members});
    }
    return teams;
  }

  function parseMonsters(block, teams){
    const count=payloadByte(block,MONSTER_COUNT_OFFSET);
    const records=[];
    for(let i=0;i<MONSTER_COUNT_MAX;i++){
      const p=MONSTER_BASE+i*MONSTER_SIZE,raw=Array.from(payloadSlice(block,p,p+MONSTER_SIZE));
      const unused=raw.every(v=>v===0xff);
      const teamIndexes=[];for(const team of teams)if(team.members.includes(i))teamIndexes.push(team.index);
      records.push({index:i,loadedOffset:p,raw,unused,active:i<count,
        x:raw[0],y:raw[1],rotation:raw[2],floorIndex:raw[3],cycle:raw[4],baseLevel:raw[5],effectiveLevel:raw[6],
        hp:raw[7]|(raw[8]<<8),actionState:raw[9],behaviour:raw[10],form:raw[11],teamField:raw[12],dropObject:raw[13],runtime0E:raw[14],targetRef:raw[15],teamIndexes});
    }
    return {count,records};
  }

  function resolveMapOffset(floors,mapOffset){
    for(const f of floors){
      if(!f.used)continue;
      const start=f.dataOffset,end=start+f.cellCount;
      if(mapOffset>=start&&mapOffset<end){
        const cellIndex=mapOffset-start;
        return {floorIndex:f.floorIndex,x:cellIndex%f.width,y:Math.floor(cellIndex/f.width),cellIndex};
      }
    }
    return null;
  }

  // $006-$015 variant values.  0-3 are fixed by the tower-crystal
  // continuation blocks; 4/5 are cross-correlated with the original 68k
  // tan/blu teleport-gem location tables.  The Z80 lookup at $C80D masks the
  // high nibble with 7, so only variants 0-7 are runtime-significant.
  const SPECIAL_VARIANTS=[
    {id:0,key:'serpent',name:'Serpent crystal',colour:'green'},
    {id:1,key:'chaos',name:'Chaos crystal',colour:'yellow'},
    {id:2,key:'dragon',name:'Dragon crystal',colour:'red'},
    {id:3,key:'moon',name:'Moon crystal',colour:'blue'},
    {id:4,key:'tan',name:'Tan teleport gem',colour:'tan'},
    {id:5,key:'bluish',name:'Bluish teleport gem',colour:'blue'},
    {id:6,key:'reserved6',name:'Reserved variant 6',colour:null},
    {id:7,key:'reserved7',name:'Reserved variant 7',colour:null}
  ];
  function specialVariantInfo(variant){return SPECIAL_VARIANTS[variant&7]||SPECIAL_VARIANTS[7];}

  function parseSpecials(block,floors){
    const crystal=[];
    for(let i=0;i<8;i++){
      const p=0x006+i*2,lo=payloadByte(block,p),hi=payloadByte(block,p+1),empty=lo===0&&hi===0;
      const mapOffset=((hi&0x0f)<<8)|lo,rawVariant=(hi>>4)&0x0f,variant=rawVariant&7,variantInfo=specialVariantInfo(variant);
      crystal.push({index:i,loadedOffset:p,bytes:[lo,hi],empty,mapOffset,rawVariant,variant,variantIgnoredBit:!!(rawVariant&8),
        variantKey:variantInfo.key,variantName:variantInfo.name,variantColour:variantInfo.colour,source:empty?null:resolveMapOffset(floors,mapOffset)});
    }
    const teleports=[];
    for(let pair=0;pair<2;pair++){
      const p=0x016+pair*4,a=[payloadByte(block,p),payloadByte(block,p+1)],b=[payloadByte(block,p+2),payloadByte(block,p+3)];
      teleports.push({pair,loadedOffset:p,a,b,aCoord:{x:a[0],y:a[1]},bCoord:{x:b[0],y:b[1]},empty:[...a,...b].every(v=>v===0)});
    }
    return {crystal,teleports};
  }

  function parseTower(block) {
    const id=String.fromCharCode(block.raw[0]||0);if(!(id in BLOCK_NAMES))return null;
    const semanticAvailable=block.raw.length>=PAYLOAD_BIAS+PAYLOAD_SIZE+1;
    const physicalPayload=Math.max(0,block.raw.length-2);
    const floors=[];
    for(let i=0;i<FLOOR_COUNT;i++){
      const d=parseDescriptor(block,i),cellCount=d.width*d.height,loadedStart=MAP_BASE+d.dataOffset;
      const available=Math.max(0,Math.min(cellCount,physicalPayload-loadedStart,MAP_BASE+MAP_SIZE-loadedStart));
      floors.push(Object.assign(d,{used:d.width>0&&d.height>0,cellCount,loadedStart,
        blockStart:rawOffset(loadedStart),absoluteFileStart:block.fileOffset+rawOffset(loadedStart),availableCells:available,complete:available===cellCount}));
    }
    const teams=semanticAvailable?parseTeams(block):[];
    const monsterArea=semanticAvailable?parseMonsters(block,teams):{count:0,records:[]};
    const objects=semanticAvailable?parseObjectArena(block,floors):{used:0,safeUsed:0,free:0,stacks:[],error:'Semantic companion data unavailable in shortened legacy tape block.'};
    const specials=semanticAvailable?parseSpecials(block,floors):{crystal:[],teleports:[]};
    const tower={id,name:BLOCK_NAMES[id],segmentNumber:payloadByte(block,0x01f),progression:payloadByte(block,0x01e),
      blockIndex:block.index,blockFileOffset:block.fileOffset,blockLength:block.raw.length,checksumValid:block.checksumValid,semanticAvailable,
      playerStarts:[{player:1,x:payloadByte(block,0),y:payloadByte(block,1),floorIndex:payloadByte(block,2)},{player:2,x:payloadByte(block,3),y:payloadByte(block,4),floorIndex:payloadByte(block,5)}],
      floors,teams,monsterCount:monsterArea.count,monsters:monsterArea.records,objects,specials};
    tower.events=semanticAvailable?parseEvents(block,id,floors):[];
    tower.eventCapacity={normal:id==='m'?ZENDIK_NORMAL_EVENT_COUNT:EVENT_COUNT,used:tower.events.filter(e=>e.normal&&!e.empty).length};
    tower.eventCapacity.free=tower.eventCapacity.normal-tower.eventCapacity.used;
    return tower;
  }

  function findTowers(tape){const out=[];for(const b of tape.blocks){const t=parseTower(b);if(t)out.push(t);}return out;}

  function getCell(tape,tower,floor,x,y){
    const mapOffset=mapOffsetForCell(floor,x,y);if(mapOffset==null)return null;
    const loadedOffset=MAP_BASE+mapOffset,blockOffset=rawOffset(loadedOffset),block=tape.blocks[tower.blockIndex];
    const value=block.raw[blockOffset],original=block.originalRaw[blockOffset];
    const events=tower.events.filter(e=>!e.empty&&!e.protected&&e.sourceOffset===mapOffset);
    const objectStacks=tower.objects.stacks.filter(s=>s.mapOffset===mapOffset);
    const monsters=tower.monsters.filter(m=>!m.unused&&m.x!==0xff&&m.floorIndex===floor.floorIndex&&m.x===x&&m.y===y);
    const starts=tower.playerStarts.filter(p=>p.floorIndex===floor.floorIndex&&p.x===x&&p.y===y);
    const specialLocations=tower.specials&&tower.specials.crystal?tower.specials.crystal.filter(sp=>!sp.empty&&sp.mapOffset===mapOffset):[];
    return {x,y,index:y*floor.width+x,mapOffset,globalX:x+floor.xOffset,globalY:y+floor.yOffset,loadedOffset,blockOffset,fileOffset:block.fileOffset+blockOffset,
      value,original,changed:value!==original,tile:BWTiles.decode(value),events,objectStacks,monsters,playerStarts:starts,specialLocations};
  }

  function writePayloadByte(session,tower,loadedOffset,value,metadata){return session.writeBlockByte(tower.blockIndex,rawOffset(loadedOffset),value,metadata);}

  function writeCell(session,tower,floor,x,y,value,metadata){
    const mapOffset=mapOffsetForCell(floor,x,y);if(mapOffset==null)throw new Error('Cell outside the selected floor.');
    return writePayloadByte(session,tower,MAP_BASE+mapOffset,value,metadata||{kind:'map'});
  }

  function setMapFlag(session,tower,floor,x,y,mask,on,metadata){
    const cell=getCell(session.tape,tower,floor,x,y);if(!cell)throw new Error('Map cell is unavailable.');
    const value=on?(cell.value|mask):(cell.value&~mask);
    writeCell(session,tower,floor,x,y,value,metadata||{kind:'map-flag'});
  }

  function encodeEvent(event){
    const action=event.action&0x3e,source=event.sourceOffset&0x7ff;
    return [((source>>8)&7)|((action<<2)&0xf8),source&0xff,((event.targetFloor&7)<<5)|(event.targetX&0x1f),event.targetY&0xff];
  }

  function writeEvent(session,tower,slot,event){
    integerIn(slot,0,EVENT_COUNT-1,'Event slot');
    if(tower.id==='m'&&slot>=ZENDIK_NORMAL_EVENT_COUNT)throw new Error('Zendik event slots 36-44 are protected ending-message storage.');
    integerIn(event.sourceOffset,0,0x7ff,'Event source offset');
    integerIn(event.action,0,0x3e,'Event action');if(event.action&1)throw new Error('Event action must be an even selector value.');
    integerIn(event.targetFloor,0,7,'Event target floor');integerIn(event.targetX,0,31,'Event target X');integerIn(event.targetY,0,255,'Event target Y');
    const bytes=encodeEvent(event),p=EVENT_BASE+slot*4;
    for(let i=0;i<4;i++)writePayloadByte(session,tower,p+i,bytes[i],{kind:'event',slot});
  }

  function deleteEvent(session,tower,slot){
    if(tower.id==='m'&&slot>=ZENDIK_NORMAL_EVENT_COUNT)throw new Error('Zendik ending-message storage cannot be deleted as an event.');
    const p=EVENT_BASE+slot*4;for(let i=0;i<4;i++)writePayloadByte(session,tower,p+i,0xff,{kind:'event-delete',slot});
  }

  function firstFreeEventSlot(tower){const e=tower.events.find(e=>e.normal&&e.empty);return e?e.slot:null;}

  function objectStackBytes(stack){
    const b0=((stack.position&3)<<6)|((stack.mapOffset>>8)&0x3f),b1=stack.mapOffset&0xff;
    const out=[b0,b1,stack.items.length&0xff];for(const it of stack.items)out.push(it.code&0xff,it.state&0xff);return out;
  }

  function rebuildObjects(session,tower,stacks){
    const bytes=[];
    for(const s of stacks)bytes.push(...objectStackBytes(s));
    if(bytes.length>OBJECT_ARENA_SIZE)throw new Error(`Object arena capacity exceeded: ${bytes.length}/256 bytes.`);
    writePayloadByte(session,tower,OBJECT_USED_OFFSET,bytes.length&0xff,{kind:'object-length'});
    writePayloadByte(session,tower,OBJECT_USED_OFFSET+1,(bytes.length>>8)&0xff,{kind:'object-length'});
    // Only the packed prefix is logically owned by the object resource.  Bytes
    // beyond the new used length are ignored by the game and are preserved
    // byte-for-byte.  In the supplied Level Data TZX they are normally $00,
    // and rewriting the free tail would violate the Stage 5 preservation rule.
    for(let i=0;i<bytes.length;i++)writePayloadByte(session,tower,OBJECT_BASE+i,bytes[i],{kind:'object-arena'});
  }

  function cloneStacks(tower){return tower.objects.stacks.map(s=>({mapOffset:s.mapOffset,position:s.position,items:s.items.map(i=>({code:i.code,state:i.state}))}));}

  function moveObjectStack(session,tower,stackIndex,targetFloor,x,y,position){
    const stacks=cloneStacks(tower),s=stacks[stackIndex];if(!s)throw new Error('Object stack not found.');
    const old=floorForMapOffset(tower,s.mapOffset),newOffset=mapOffsetForCell(targetFloor,x,y);if(newOffset==null)throw new Error('Invalid object destination.');
    s.mapOffset=newOffset;if(position!=null)s.position=position&3;rebuildObjects(session,tower,stacks);
    if(old){const remains=stacks.some((q,i)=>i!==stackIndex&&q.mapOffset===old.floor.dataOffset+old.cellIndex);if(!remains)setMapFlag(session,tower,old.floor,old.x,old.y,0x04,false,{kind:'object-flag'});}
    setMapFlag(session,tower,targetFloor,x,y,0x04,true,{kind:'object-flag'});
  }

  function addObjectStack(session,tower,targetFloor,x,y,position,code,state){
    const stacks=cloneStacks(tower),mapOffset=mapOffsetForCell(targetFloor,x,y);if(mapOffset==null)throw new Error('Invalid object destination.');
    stacks.push({mapOffset,position:position&3,items:[{code:code&0xff,state:state&0xff}]});rebuildObjects(session,tower,stacks);setMapFlag(session,tower,targetFloor,x,y,0x04,true,{kind:'object-flag'});
  }

  function deleteObjectStack(session,tower,stackIndex){
    const stacks=cloneStacks(tower),s=stacks[stackIndex];if(!s)throw new Error('Object stack not found.');
    const old=floorForMapOffset(tower,s.mapOffset);stacks.splice(stackIndex,1);rebuildObjects(session,tower,stacks);
    if(old&&!stacks.some(q=>q.mapOffset===s.mapOffset))setMapFlag(session,tower,old.floor,old.x,old.y,0x04,false,{kind:'object-flag'});
  }

  function replaceObjectStack(session,tower,stackIndex,position,items){
    const stacks=cloneStacks(tower),s=stacks[stackIndex];if(!s)throw new Error('Object stack not found.');s.position=position&3;s.items=items.map(i=>({code:i.code&0xff,state:i.state&0xff}));
    if(!s.items.length)throw new Error('A stack must contain at least one object; delete the stack instead.');rebuildObjects(session,tower,stacks);
  }

  function writeMonsterField(session,tower,index,offset,value){
    integerIn(index,0,MONSTER_COUNT_MAX-1,'Monster index');integerIn(offset,0,MONSTER_SIZE-1,'Monster field offset');integerIn(value,0,255,'Monster field value');
    writePayloadByte(session,tower,MONSTER_BASE+index*MONSTER_SIZE+offset,value,{kind:'monster',index,offset});
  }

  function moveMonster(session,tower,index,targetFloor,x,y,rotation){
    const m=tower.monsters[index];if(!m||m.unused)throw new Error('Monster record not available.');
    const targetCell=getCell(session.tape,tower,targetFloor,x,y);if(!targetCell)throw new Error('Monster destination is unavailable.');
    if(targetCell.tile.baseType===2)throw new Error('A monster cannot be positioned on a door cell: door bits 5-7 store the lock/colour index, including bit 7.');
    const oldFloor=m.x===0xff?null:tower.floors[m.floorIndex];
    writeMonsterField(session,tower,index,0,x);writeMonsterField(session,tower,index,1,y);writeMonsterField(session,tower,index,3,targetFloor.floorIndex);if(rotation!=null)writeMonsterField(session,tower,index,2,rotation);
    if(oldFloor&&oldFloor.used){
      const other=tower.monsters.some(q=>q.index!==index&&!q.unused&&q.x!==0xff&&q.floorIndex===m.floorIndex&&q.x===m.x&&q.y===m.y);
      const oldCell=getCell(session.tape,tower,oldFloor,m.x,m.y);
      if(!other&&oldCell&&oldCell.tile.baseType!==2)setMapFlag(session,tower,oldFloor,m.x,m.y,0x80,false,{kind:'monster-flag'});
    }
    setMapFlag(session,tower,targetFloor,x,y,0x80,true,{kind:'monster-flag'});
  }

  function writeTeam(session,tower,teamIndex,members){
    if(teamIndex<0||teamIndex>=TEAM_COUNT)throw new Error('Team must be 0-9.');
    const vals=members.slice(0,4);while(vals.length<4)vals.push(0xff);
    const active=vals.filter(v=>v!==0xff);if(new Set(active).size!==active.length)throw new Error('A monster cannot appear twice in one team row.');
    for(const v of active)if(v<0||v>=MONSTER_COUNT_MAX)throw new Error('Team member index must be 0-41 or FF.');
    for(let i=0;i<4;i++)writePayloadByte(session,tower,TEAM_BASE+teamIndex*4+i,vals[i],{kind:'team',teamIndex});
  }

  function writeFloorDescriptor(session,tower,floorIndex,fields){
    integerIn(floorIndex,0,FLOOR_COUNT-1,'Floor index');
    const current=tower.floors[floorIndex],width='width'in fields?integerIn(fields.width,0,255,'Floor width'):current.width,height='height'in fields?integerIn(fields.height,0,255,'Floor height'):current.height,dataOffset='dataOffset'in fields?integerIn(fields.dataOffset,0,MAP_SIZE-1,'Floor data offset'):current.dataOffset;
    if((width===0)!==(height===0))throw new Error('Floor width and height must both be zero for an unused floor, or both be non-zero.');
    if(width&&dataOffset+width*height>MAP_SIZE)throw new Error(`Floor data exceeds the fixed ${hex(MAP_SIZE,3)} map workspace.`);
    if('xOffset'in fields)integerIn(fields.xOffset,0,255,'Floor X alignment');if('yOffset'in fields)integerIn(fields.yOffset,0,255,'Floor Y alignment');
    const p=FLOOR_HEADER+floorIndex*6;
    if('width'in fields)writePayloadByte(session,tower,p,fields.width,{kind:'layout'});
    if('height'in fields)writePayloadByte(session,tower,p+1,fields.height,{kind:'layout'});
    if('dataOffset'in fields){writePayloadByte(session,tower,p+2,(fields.dataOffset>>8)&255,{kind:'layout'});writePayloadByte(session,tower,p+3,fields.dataOffset&255,{kind:'layout'});}
    if('xOffset'in fields)writePayloadByte(session,tower,p+4,fields.xOffset,{kind:'layout'});
    if('yOffset'in fields)writePayloadByte(session,tower,p+5,fields.yOffset,{kind:'layout'});
  }

  function writePlayerStart(session,tower,player,x,y,floorIndex){
    if(player!==1&&player!==2)throw new Error('Player start must be P1 or P2.');integerIn(floorIndex,0,FLOOR_COUNT-1,'Player start floor');
    const f=tower.floors[floorIndex];if(!f||!f.used)throw new Error('Player start must reference an active floor.');integerIn(x,0,f.width-1,'Player start X');integerIn(y,0,f.height-1,'Player start Y');
    const p=player===2?3:0;writePayloadByte(session,tower,p,x,{kind:'layout-start'});writePayloadByte(session,tower,p+1,y,{kind:'layout-start'});writePayloadByte(session,tower,p+2,floorIndex,{kind:'layout-start'});
  }
  function writeProgression(session,tower,value){if(tower.id==='m')throw new Error('Zendik $01E is exceptional and is not exposed as a progression count.');integerIn(value,0,255,'Progression requirement');writePayloadByte(session,tower,0x01e,value,{kind:'layout-progression'});}
  function writeRawPair(session,tower,loadedOffset,a,b,kind){integerIn(loadedOffset,0,PAYLOAD_SIZE-2,'Packed-record offset');integerIn(a,0,255,'Packed-record byte');integerIn(b,0,255,'Packed-record byte');writePayloadByte(session,tower,loadedOffset,a,{kind});writePayloadByte(session,tower,loadedOffset+1,b,{kind});}

  function writeTeleportPair(session,tower,pair,enabled,ax,ay,bx,by){
    integerIn(pair,0,1,'Teleport pair');
    const p=0x016+pair*4;
    if(!enabled){for(let i=0;i<4;i++)writePayloadByte(session,tower,p+i,0,{kind:'layout-teleport'});return;}
    integerIn(ax,0,255,'Teleport endpoint A X');integerIn(ay,0,255,'Teleport endpoint A Y');integerIn(bx,0,255,'Teleport endpoint B X');integerIn(by,0,255,'Teleport endpoint B Y');
    if(ax===0&&ay===0&&bx===0&&by===0)throw new Error('All-zero teleport pair is reserved for an unused record. Disable the pair instead.');
    [ax,ay,bx,by].forEach((v,i)=>writePayloadByte(session,tower,p+i,v,{kind:'layout-teleport'}));
  }

  function writeSpecialLocation(session,tower,index,enabled,floorIndex,x,y,variant){
    integerIn(index,0,7,'Crystal/socket special index');
    const p=0x006+index*2;
    if(!enabled){writePayloadByte(session,tower,p,0,{kind:'layout-crystal-special'});writePayloadByte(session,tower,p+1,0,{kind:'layout-crystal-special'});return;}
    integerIn(floorIndex,0,FLOOR_COUNT-1,'Special-location floor');integerIn(variant,0,7,'Special-location variant');
    const f=tower.floors[floorIndex];if(!f||!f.used)throw new Error('Special location must reference an active floor.');
    integerIn(x,0,f.width-1,'Special-location X');integerIn(y,0,f.height-1,'Special-location Y');
    const mapOffset=mapOffsetForCell(f,x,y);if(mapOffset==null||mapOffset>0x0fff)throw new Error('Special location does not fit the 12-bit map-workspace offset.');
    const lo=mapOffset&0xff,oldHi=payloadByte(session.tape.blocks[tower.blockIndex],p+1),hi=(oldHi&0x80)|((variant&7)<<4)|((mapOffset>>8)&0x0f);
    if(lo===0&&hi===0)throw new Error('$0000 is reserved for an unused crystal/socket special record. Choose another cell/variant or disable the record.');
    writePayloadByte(session,tower,p,lo,{kind:'layout-crystal-special'});writePayloadByte(session,tower,p+1,hi,{kind:'layout-crystal-special'});
  }

  function audit(tape,tower){
    const issues=[];
    // Object bit 2 consistency.
    const objectOffsets=new Set(tower.objects.stacks.map(s=>s.mapOffset));
    for(const f of tower.floors){if(!f.used)continue;for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++){
      const c=getCell(tape,tower,f,x,y);if(!c)continue;const should=objectOffsets.has(c.mapOffset),has=!!(c.value&4);
      if(should!==has)issues.push(`OBJECT FLAG F${f.floorIndex} ${x},${y}: map bit 2 ${has?'set':'clear'}, arena ${should?'has':'has no'} stack.`);
    }}
    const monsterCells=new Set(tower.monsters.filter(m=>!m.unused&&m.x!==0xff&&m.floorIndex<5).map(m=>`${m.floorIndex}:${m.x}:${m.y}`));
    for(const f of tower.floors){if(!f.used)continue;for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++){
      const c=getCell(tape,tower,f,x,y);if(!c)continue;const should=monsterCells.has(`${f.floorIndex}:${x}:${y}`),has=c.tile.occupied;
      if(should&&c.tile.baseType===2){issues.push(`MONSTER/DOOR CONFLICT F${f.floorIndex} ${x},${y}: bit 7 is part of the door lock/colour field and cannot be used as occupancy.`);continue;}
      // A positioned monster without bit 7 is a consistency problem for an
      // edited level.  The reverse is deliberately not treated as an error:
      // original maps contain extra stored occupancy/cache bits and tower-load
      // monster preparation appears able to normalise actor state at runtime.
      if(should&&!has)issues.push(`OCCUPANCY FLAG F${f.floorIndex} ${x},${y}: positioned monster present but map bit 7 is clear.`);
    }}
    if(tower.objects.error)issues.push(tower.objects.error);
    if(tower.objects.used>OBJECT_ARENA_SIZE)issues.push(`Object used length ${tower.objects.used} exceeds 256-byte arena.`);
    return issues;
  }

  global.BWBloodwych={BLOCK_NAMES,PAYLOAD_SIZE,FLOOR_HEADER,FLOOR_DESCRIPTOR_SIZE,FLOOR_COUNT,MAP_BASE,MAP_SIZE,TEAM_BASE,TEAM_COUNT,MONSTER_COUNT_OFFSET,MONSTER_BASE,MONSTER_COUNT_MAX,MONSTER_SIZE,OBJECT_USED_OFFSET,OBJECT_BASE,OBJECT_ARENA_SIZE,EVENT_BASE,EVENT_COUNT,ZENDIK_NORMAL_EVENT_COUNT,ACTION_LABELS,SPECIAL_VARIANTS,
    rawOffset,loadedToRuntime,findTowers,parseTower,getCell,mapOffsetForCell,floorForMapOffset,writePayloadByte,writeCell,setMapFlag,
    encodeEvent,writeEvent,deleteEvent,firstFreeEventSlot,moveObjectStack,addObjectStack,deleteObjectStack,replaceObjectStack,
    writeMonsterField,moveMonster,writeTeam,writeFloorDescriptor,writePlayerStart,writeProgression,writeRawPair,writeTeleportPair,writeSpecialLocation,audit,hex};
})(window);
