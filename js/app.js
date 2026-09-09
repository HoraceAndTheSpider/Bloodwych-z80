(function(){
  'use strict';

  const $=id=>document.getElementById(id);
  const session=new BWSession.EditSession();
  let towers=[],tower=null,floor=null,selected=null,renderMetrics=null,mode='viewer';
  let clipboardByte=null,eventCursor=null,objectIndex=0,monsterCursor=null,teamCursor=0;
  const canvas=$('map');

  function hex(n,w=2){return '$'+(n>>>0).toString(16).toUpperCase().padStart(w,'0');}
  function h2(n){return (n&255).toString(16).toUpperCase().padStart(2,'0');}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function parseHexByte(v){const s=String(v).trim().replace(/^\$/,'').replace(/^0x/i,'');if(!/^[0-9a-f]{1,2}$/i.test(s))return null;return parseInt(s,16);}
  function parseHexWord(v,max=0xffff){const s=String(v).trim().replace(/^\$/,'').replace(/^0x/i,'');if(!/^[0-9a-f]{1,4}$/i.test(s))return null;const n=parseInt(s,16);return n<=max?n:null;}
  function parseDec(v,min=0,max=255){const n=Number(v);return Number.isInteger(n)&&n>=min&&n<=max?n:null;}
  function setStatus(msg,kind=''){const e=$('status');e.textContent=msg;e.className=`status${kind?' '+kind:''}`;}
  function download(name,bytes,mime='application/octet-stream'){const blob=new Blob([bytes],{type:mime}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  function selectedCell(){return selected&&session.tape&&tower&&floor?BWBloodwych.getCell(session.tape,tower,floor,selected.x,selected.y):null;}
  function semanticReady(){return !!(tower&&tower.semanticAvailable);}

  function loadBuffer(buf,label){
    try{
      const tape=BWTap.parseTape(buf);session.loadLevel(tape,label);towers=BWBloodwych.findTowers(tape);
      if(!towers.length)throw new Error('No Bloodwych d–m level blocks were found in this tape.');
      $('sourceName').textContent=label;populateTowers();
      const allParity=tape.blocks.every(b=>b.checksumValid),full=towers.filter(t=>t.semanticAvailable).length;
      setStatus(`Loaded ${label}: ${tape.format}${tape.version?' '+tape.version:''}; ${towers.length} level blocks, ${full} complete Stage 5 payloads; parity ${allParity?'OK':'has failures'}.`,allParity?'ok':'warn');
      renderAll();
    }catch(err){console.error(err);setStatus(err.message,'error');}
  }

  function populateTowers(preferredId){
    const sel=$('tower');sel.innerHTML='';
    towers.forEach((t,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=`${t.id.toUpperCase()} — ${t.name}${t.semanticAvailable?'':' [legacy partial]'}`;sel.appendChild(o);});
    let idx=preferredId?towers.findIndex(t=>t.id===preferredId):-1;if(idx<0)idx=0;sel.value=String(idx);selectTower(false);
  }

  function selectTower(renderNow=true){
    tower=towers[+$('tower').value]||towers[0];if(!tower)return;
    const fs=$('floor');fs.innerHTML='';tower.floors.forEach(f=>{const o=document.createElement('option');o.value=String(f.floorIndex);const st=!f.used?'unused':f.complete?'complete':`PARTIAL ${f.availableCells}/${f.cellCount}`;o.textContent=`Floor ${f.floorIndex} — ${f.width}×${f.height} +${f.xOffset},${f.yOffset} — ${st}`;fs.appendChild(o);});
    const first=tower.floors.find(f=>f.used)||tower.floors[0];fs.value=String(first.floorIndex);floor=first;selected=null;eventCursor=firstUsedEventSlot();objectIndex=0;monsterCursor=firstMonsterIndex();teamCursor=0;if(renderNow)renderAll();
  }

  function selectFloor(){floor=tower.floors[+$('floor').value]||tower.floors[0];if(selected&&(selected.x>=floor.width||selected.y>=floor.height))selected=null;renderAll();}

  function refreshModel(options={}){
    if(!session.tape)return;
    const tid=tower?tower.id:null,fi=floor?floor.floorIndex:0,sel=selected?{...selected}:null;
    towers=BWBloodwych.findTowers(session.tape);tower=towers.find(t=>t.id===tid)||towers[0];
    $('tower').value=String(towers.findIndex(t=>t.id===tower.id));
    floor=tower.floors[fi]||tower.floors.find(f=>f.used)||tower.floors[0];$('floor').value=String(floor.floorIndex);
    selected=sel&&floor.used&&sel.x<floor.width&&sel.y<floor.height?sel:null;
    if(!tower.events.some(e=>!e.empty&&!e.protected&&e.slot===eventCursor))eventCursor=firstUsedEventSlot();
    if(objectIndex>=tower.objects.stacks.length)objectIndex=Math.max(0,tower.objects.stacks.length-1);
    if(monsterCursor!=null&&!tower.monsters.some(m=>m.index===monsterCursor&&m.active&&!m.unused))monsterCursor=firstMonsterIndex();
    renderAll();
  }

  function withEdit(label,fn){
    try{session.transact(label,fn,{tower:tower&&tower.id});refreshModel();setStatus(`${label} applied.`,'ok');return true;}
    catch(err){console.error(err);setStatus(err.message,'error');return false;}
  }

  function firstUsedEventSlot(){if(!tower)return null;const e=tower.events.find(e=>e.normal&&!e.empty);return e?e.slot:null;}
  function activeEvents(){return tower?tower.events.filter(e=>e.normal&&!e.empty):[];}
  function activeMonsters(){return tower?tower.monsters.filter(m=>m.active&&!m.unused):[];}
  function firstMonsterIndex(){const a=activeMonsters();return a.length?a[0].index:null;}
  function currentMonster(){return monsterCursor==null?null:tower.monsters.find(m=>m.index===monsterCursor)||null;}
  function currentObject(){return tower&&tower.objects.stacks.length?tower.objects.stacks[objectIndex]||null:null;}

  function modeOverlays(){
    if(mode==='viewer')return {starts:$('ovStarts').checked,events:$('ovEvents').checked,objects:$('ovObjects').checked,monsters:$('ovMonsters').checked,specials:$('ovSpecials').checked};
    if(mode==='maps')return {starts:true,events:true,objects:true,monsters:true,specials:false};
    if(mode==='objects')return {starts:false,events:false,objects:true,monsters:false,specials:false};
    if(mode==='monsters')return {starts:false,events:false,objects:false,monsters:true,specials:false};
    return {starts:true,events:false,objects:false,monsters:false,specials:true};
  }

  function renderMap(){
    const frame=canvas.closest('.map-frame'),area=$('mapArea'),style=$('mapStyle').value||'modern';frame.className=`map-frame ${style}`;area.className=`map-area ${style}`;
    if(!session.tape||!tower||!floor||!floor.used){canvas.width=1;canvas.height=1;renderMetrics=null;return;}
    renderMetrics=BWRenderer.render(canvas,session.tape,tower,floor,{cellSize:+$('zoom').value,aligned:$('aligned').checked,showGrid:$('showGrid').checked,showHex:$('showHex').checked,style,selected,overlays:modeOverlays()});
  }

  function selectionText(c){if(!c)return 'Select a map cell.';return `<strong>${BWRenderer.rowLabel(c.y)}${c.x}</strong> · F${floor.floorIndex}<br>${esc(c.tile.featureLabel)}<br><span class="muted">${hex(c.value)} · ${c.events.length} event · ${c.objectStacks.length} stack · ${c.monsters.length} monster</span>`;}
  function renderSelection(){const c=selectedCell();$('selectionSummary').innerHTML=selectionText(c);$('mapSelection').innerHTML=selectionText(c);if(c)$('editByte').value=h2(c.value);else $('editByte').value='';
    const linked=[];if(c){if(c.events.length)linked.push('EVENT');if(c.objectStacks.length)linked.push('OBJECT STACK');if(c.monsters.length)linked.push('MONSTER');}
    const w=$('companionWarning');if(linked.length){w.textContent=`This cell also has: ${linked.join(', ')}. Raw map edit will not relocate companion records.`;w.classList.remove('hidden');}else w.classList.add('hidden');
  }

  function updateClipboard(){const e=$('clipboardInfo');if(clipboardByte==null){e.textContent='Clipboard: empty';e.classList.remove('has-value');}else{e.textContent=`Clipboard: ${hex(clipboardByte)} — ${BWTiles.decode(clipboardByte).featureLabel}`;e.classList.add('has-value');}}

  function renderEventEditor(){
    const box=$('eventEditor');if(!tower||!tower.semanticAvailable){box.innerHTML='<p class="muted">Unified Event editing requires a complete Level Data block.</p>';return;}
    const used=activeEvents();if(eventCursor==null&&used.length)eventCursor=used[0].slot;let ev=tower.events.find(e=>e.slot===eventCursor&&!e.empty&&!e.protected)||null;
    const c=selectedCell(),free=tower.eventCapacity.free;
    let html=`<div class="capacity">Normal slots: ${tower.eventCapacity.used}/${tower.eventCapacity.normal} used · ${free} free${tower.id==='m'?' · slots 36–44 protected':''}</div>`;
    if(ev){
      const actions=[...BWBloodwych.ACTION_LABELS.entries()].map(([v,n])=>`<option value="${v}" ${v===ev.action?'selected':''}>${hex(v)} — ${esc(n)}</option>`).join('');
      html+=`<div class="nav-row"><button data-act="event-prev">◀</button><span>Event slot ${ev.slot}</span><button data-act="event-next">▶</button></div>
      <div class="editor-grid">
      <label>Source <input value="${hex(ev.sourceOffset,3)}" disabled></label>
      <label>Action <select id="eventAction">${actions}</select></label>
      <label>Target floor <input id="eventTF" type="number" min="0" max="7" value="${ev.targetFloor}"></label>
      <label>Target X <input id="eventTX" type="number" min="0" max="31" value="${ev.targetX}"></label>
      <label>Target Y <input id="eventTY" type="number" min="0" max="255" value="${ev.targetY}"></label></div>
      <div class="button-row"><button data-act="event-save">SAVE EVENT</button><button data-act="event-find">FIND SOURCE</button></div>
      <div class="button-row"><button data-act="event-move">MOVE SOURCE HERE</button><button data-act="event-delete" class="danger">DELETE</button></div>`;
    } else html+='<p class="muted">No active event is selected.</p>';
    if(c)html+=`<button data-act="event-add" ${free<=0?'disabled':''}>ADD EVENT AT ${BWRenderer.rowLabel(c.y)}${c.x}</button>`;
    box.innerHTML=html;
  }

  function renderObjectEditor(){
    const box=$('objectEditor'),cap=$('objectCapacity');if(!tower||!tower.semanticAvailable){box.innerHTML='<p class="muted">Object editing requires a complete Level Data block.</p>';cap.textContent='';return;}
    const stacks=tower.objects.stacks,s=currentObject();$('objectCounter').textContent=stacks.length?`Stack ${objectIndex+1}/${stacks.length}`:'No stacks';
    cap.textContent=`Arena: ${tower.objects.used}/256 bytes used · ${tower.objects.free} free`;cap.className=`capacity${tower.objects.free<5?' bad':''}`;
    let html='';
    if(s){
      const pos=[0,1,2,3].map(v=>`<option value="${v}" ${v===s.position?'selected':''}>Mini-position ${v}</option>`).join('');
      html+=`<div class="editor-grid"><label>Map offset <input value="${hex(s.mapOffset,3)}" disabled></label><label>Position <select id="objPosition">${pos}</select></label></div>`;
      html+='<h3>Items</h3>';
      s.items.forEach((it,i)=>{html+=`<div class="raw-pair"><span>#${i}</span><input class="obj-code" data-i="${i}" value="${h2(it.code)}" title="Object code"><input class="obj-state" data-i="${i}" value="${h2(it.state)}" title="Quantity/state"></div>`;});
      html+=`<div class="button-row"><button data-act="object-save">SAVE STACK</button><button data-act="object-item-add">ADD ITEM</button><button data-act="object-item-delete">DELETE LAST ITEM</button></div><button data-act="object-delete" class="danger">DELETE STACK</button>`;
    }else html+='<p class="muted">No object stacks in this level.</p>';
    html+=`<hr><h3>New stack defaults</h3><div class="editor-grid"><label>Position <select id="newObjPos"><option>0</option><option>1</option><option>2</option><option>3</option></select></label><label>Object code <input id="newObjCode" value="00" maxlength="2"></label><label>Quantity/state <input id="newObjState" value="00" maxlength="2"></label></div>`;
    box.innerHTML=html;
  }

  function renderMonsterEditor(){
    const box=$('monsterEditor'),team=$('teamEditor');if(!tower||!tower.semanticAvailable){box.innerHTML='<p class="muted">Monster editing requires a complete Level Data block.</p>';team.innerHTML='';$('monsterCounter').textContent='No monsters';return;}
    const list=activeMonsters(),m=currentMonster();$('monsterCounter').textContent=m?`Monster ${list.findIndex(q=>q.index===m.index)+1}/${list.length} · record ${m.index}`:'No monsters';
    if(!m){box.innerHTML='<p class="muted">No active monster record.</p>';}
    else{
      box.innerHTML=`<div class="editor-grid">
      <label>X <input id="monX" value="${m.x===0xff?'FF':m.x}"></label><label>Y <input id="monY" type="number" min="0" max="255" value="${m.y}"></label>
      <label>Floor <input id="monFloor" type="number" min="0" max="4" value="${m.floorIndex}"></label><label>Rotation / mini-space <input id="monRot" value="${h2(m.rotation)}"></label>
      <label>Cycle/timing <input id="monCycle" value="${h2(m.cycle)}"></label><label>Base level <input id="monBase" value="${h2(m.baseLevel)}"></label>
      <label>Effective level <input id="monEff" value="${h2(m.effectiveLevel)}"></label><label>HP <input id="monHp" type="number" min="0" max="65535" value="${m.hp}"></label>
      <label>Action/status <input id="monAction" value="${h2(m.actionState)}"></label><label>Behaviour/AI <input id="monBehaviour" value="${h2(m.behaviour)}"></label>
      <label>Form <input id="monForm" value="${h2(m.form)}"></label><label>Team/group raw <input id="monTeamField" value="${h2(m.teamField)}"></label>
      <label>Carried/drop object <input id="monDrop" value="${h2(m.dropObject)}"></label></div>
      <p class="note">X = FF denotes a secondary team member. Runtime byte $0E stays raw/read-only under INFO / DATA.</p><button data-act="monster-save">SAVE MONSTER</button>`;
    }
    const t=tower.teams[teamCursor]||tower.teams[0];
    const rows=t.members.map((v,i)=>`<label>Member ${i+1} <input class="team-member" data-i="${i}" value="${h2(v)}"></label>`).join('');
    team.innerHTML=`<div class="nav-row"><button data-act="team-prev">◀</button><span>Team ${t.index}</span><button data-act="team-next">▶</button></div><div class="editor-grid">${rows}</div><p class="note">FF = empty. Secondary members may have X=FF and inherit the positioned leader.</p><button data-act="team-save">SAVE TEAM</button>`;
  }

  function renderLayoutEditor(){
    const box=$('layoutEditor');if(!tower){box.innerHTML='<p class="muted">Load a level tape.</p>';return;}const f=floor;
    let html=`<h3>Floor ${f.floorIndex}</h3><div class="editor-grid">
    <label>Width <input id="layW" type="number" min="0" max="255" value="${f.width}"></label><label>Height <input id="layH" type="number" min="0" max="255" value="${f.height}"></label>
    <label>Map offset <input id="layData" value="${f.dataOffset.toString(16).toUpperCase().padStart(4,'0')}"></label><label>X alignment <input id="layX" type="number" min="0" max="255" value="${f.xOffset}"></label><label>Y alignment <input id="layY" type="number" min="0" max="255" value="${f.yOffset}"></label></div>
    <p class="warning">Descriptor edits change geometry/alignment only; they do not rearrange the fixed $40C map workspace.</p><button data-act="layout-floor-save">SAVE FLOOR DESCRIPTOR</button>
    <hr><h3>Player starts</h3>`;
    for(const p of tower.playerStarts)html+=`<div class="raw-pair"><strong>P${p.player}</strong><input id="p${p.player}x" type="number" min="0" max="255" value="${p.x}" title="X"><input id="p${p.player}y" type="number" min="0" max="255" value="${p.y}" title="Y"></div><label>Floor <input id="p${p.player}f" type="number" min="0" max="4" value="${p.floorIndex}"></label>`;
    html+=`<button data-act="layout-start-save">SAVE PLAYER STARTS</button><hr><h3>Progression</h3>`;
    if(tower.id==='m')html+=`<p>Zendik loaded $01E = <span class="mono">${hex(tower.progression)}</span>. This is exceptional final-level data and is not exposed as a progression count.</p>`;
    else html+=`<label>Requirement <span class="inline"><input id="progression" type="number" min="0" max="255" value="${tower.progression}"><button data-act="layout-progression-save">SAVE</button></span></label>`;
    if(tower.semanticAvailable){
      html+='<hr><h3>Teleport pairs</h3><p class="note">Each four-byte record stores two direct X/Y endpoints. No floor byte is present in this level-side record, so Stage 5 does not invent one.</p>';
      tower.specials.teleports.forEach(tp=>{html+=`<div class="event-card"><div class="card-head"><strong>Pair ${tp.pair+1}</strong><label><input id="tp${tp.pair}active" type="checkbox" ${tp.empty?'':'checked'}> active</label></div><div class="editor-grid"><label>A X <input id="tp${tp.pair}ax" type="number" min="0" max="255" value="${tp.aCoord.x}"></label><label>A Y <input id="tp${tp.pair}ay" type="number" min="0" max="255" value="${tp.aCoord.y}"></label><label>B X <input id="tp${tp.pair}bx" type="number" min="0" max="255" value="${tp.bCoord.x}"></label><label>B Y <input id="tp${tp.pair}by" type="number" min="0" max="255" value="${tp.bCoord.y}"></label></div><div class="mono muted">raw ${tp.a.map(h2).join(' ')} · ${tp.b.map(h2).join(' ')}</div></div>`;});
      html+='<button data-act="layout-teleport-save">SAVE TELEPORT PAIRS</button><hr><h3>Crystal / socket special locations</h3><p class="note">Eight entries form four pairs. Stored packing is: byte 0 plus the low nibble of byte 1 = 12-bit map-workspace offset; the high nibble of byte 1 is the raw variant. Variant meaning remains deliberately unnamed.</p>';
      for(let pair=0;pair<4;pair++){
        html+=`<div class="event-card"><strong>Pair ${pair+1}</strong>`;
        for(const sp of tower.specials.crystal.filter(v=>v.pair===pair)){
          const src=sp.source||{floorIndex:f.floorIndex,x:0,y:0};
          html+=`<div class="special-row"><div class="card-head"><span>Endpoint ${sp.endpoint}</span><label><input id="cr${sp.index}active" type="checkbox" ${sp.empty?'':'checked'}> active</label></div><div class="editor-grid"><label>Floor <input id="cr${sp.index}f" type="number" min="0" max="4" value="${src.floorIndex}"></label><label>X <input id="cr${sp.index}x" type="number" min="0" max="255" value="${src.x}"></label><label>Y <input id="cr${sp.index}y" type="number" min="0" max="255" value="${src.y}"></label><label>Variant <input id="cr${sp.index}v" type="number" min="0" max="15" value="${sp.variant}"></label></div><div class="mono muted">raw ${sp.bytes.map(h2).join(' ')}${sp.empty?' · unused':sp.source?` · map ${hex(sp.mapOffset,3)}`:' · unresolved map offset'}</div></div>`;
        }
        html+='</div>';
      }
      html+='<button data-act="layout-crystal-save">SAVE SPECIAL LOCATIONS</button>';
    }else html+='<p class="warning">Companion Layout structures are unavailable in this shortened legacy block. Use the Level Data TZX for Stage 5 semantic editing.</p>';
    box.innerHTML=html;
  }

  function renderAudit(){
    const e=$('auditSummary');if(!tower){e.textContent='Load a level to run consistency checks.';e.className='audit-summary';return;}
    if(!tower.semanticAvailable){e.textContent='Semantic audit unavailable for this shortened legacy block.';e.className='audit-summary warn';return;}
    const issues=BWBloodwych.audit(session.tape,tower);if(!issues.length){e.textContent='No object-bit / positioned-monster occupancy inconsistencies detected.';e.className='audit-summary ok';}else{e.innerHTML=`<strong>${issues.length} warning${issues.length===1?'':'s'}</strong><br>${issues.slice(0,8).map(esc).join('<br>')}${issues.length>8?'<br>…see INFO / DATA':''}`;e.className='audit-summary warn';}
  }

  function infoRow(k,v){return `<tr><th>${esc(k)}</th><td>${v}</td></tr>`;}
  function renderInfo(){
    const box=$('infoContent');if(!tower||!session.tape){box.innerHTML='<p class="muted">Load a Level Data TZX and select a cell.</p>';return;}
    const b=session.tape.blocks[tower.blockIndex],c=selectedCell();let rows='';
    rows+=infoRow('Source',esc(session.level.label));rows+=infoRow('Role','Level Data TZX/TAP');rows+=infoRow('Tower',`${tower.id.toUpperCase()} — ${esc(tower.name)}`);rows+=infoRow('Segment number',hex(tower.segmentNumber));rows+=infoRow('Block index',String(tower.blockIndex));rows+=infoRow('Block file offset',`<span class="mono">${hex(tower.blockFileOffset,5)}</span>`);rows+=infoRow('Spectrum parity',b.checksumValid?'<span class="tag good">valid</span>':'<span class="tag warn">INVALID</span>');
    rows+=infoRow('Stage 5 companion data',tower.semanticAvailable?'<span class="tag good">complete</span>':'<span class="tag warn">legacy partial</span>');
    if(c){
      rows+=infoRow('Coordinate',`F${floor.floorIndex} ${BWRenderer.rowLabel(c.y)}${c.x} (local ${c.x},${c.y}; aligned ${c.globalX},${c.globalY})`);rows+=infoRow('Raw cell',`<span class="mono">${hex(c.value)}</span>${c.changed?` (original ${hex(c.original)})`:''}`);rows+=infoRow('Bit breakdown',`base ${c.tile.baseType} / bit2 object ${c.tile.hasObject?1:0} / feature ${hex(c.tile.feature,1)} / bit7 occupied ${c.tile.occupied?1:0}`);rows+=infoRow('Interpretation',esc(c.tile.featureLabel));rows+=infoRow('Evidence',`<span class="tag">${esc(c.tile.confidence)}</span>${c.tile.note?'<br>'+esc(c.tile.note):''}`);rows+=infoRow('Map workspace offset',`<span class="mono">${hex(c.mapOffset,3)}</span>`);rows+=infoRow('Loaded-data offset',`<span class="mono">${hex(c.loadedOffset,3)}</span>`);rows+=infoRow('Runtime address',`<span class="mono">${hex(BWBloodwych.loadedToRuntime(c.loadedOffset),4)}</span>`);rows+=infoRow('Tape block offset',`<span class="mono">${hex(c.blockOffset,4)}</span>`);rows+=infoRow('Absolute file offset',`<span class="mono">${hex(c.fileOffset,5)}</span>`);
      rows+=infoRow('Linked Event',c.events.length?c.events.map(e=>`slot ${e.slot}: <span class="mono">${e.raw.map(h2).join(' ')}</span> — ${esc(e.actionLabel)}`).join('<br>'):'none');
      rows+=infoRow('Linked Object stacks',c.objectStacks.length?c.objectStacks.map(s=>`stack ${s.index}, pos ${s.position}, <span class="mono">${s.raw.map(h2).join(' ')}</span>`).join('<br>'):'none');
      rows+=infoRow('Linked Monsters',c.monsters.length?c.monsters.map(m=>`record ${m.index}, form ${hex(m.form)}, raw <span class="mono">${m.raw.map(h2).join(' ')}</span>`).join('<br>'):'none');
    }
    rows+=infoRow('Event table',`loaded $817 · ${tower.eventCapacity.used}/${tower.eventCapacity.normal} normal slots used${tower.id==='m'?'; Zendik 36–44 protected':''}`);
    rows+=infoRow('Object arena',tower.semanticAvailable?`loaded $717 · ${tower.objects.used}/256 bytes used`:'unavailable');rows+=infoRow('Monster allocation',tower.semanticAvailable?`loaded $475 · count/state ${tower.monsterCount}, 42 × 16-byte allocation`:'unavailable');
    if(tower.semanticAvailable){
      rows+=infoRow('Teleport pairs',tower.specials.teleports.map(tp=>`pair ${tp.pair+1}: ${tp.empty?'unused':`A ${tp.aCoord.x},${tp.aCoord.y} ↔ B ${tp.bCoord.x},${tp.bCoord.y}`} · <span class="mono">${tp.a.map(h2).join(' ')} ${tp.b.map(h2).join(' ')}</span>`).join('<br>'));
      rows+=infoRow('Crystal / socket packed records',tower.specials.crystal.map(cr=>`#${cr.index+1} P${cr.pair+1}${cr.endpoint}: ${cr.empty?'unused':cr.source?`F${cr.source.floorIndex} ${cr.source.x},${cr.source.y} · variant ${hex(cr.variant,1)} · map ${hex(cr.mapOffset,3)}`:`unresolved map ${hex(cr.mapOffset,3)} · variant ${hex(cr.variant,1)}`} · <span class="mono">${cr.bytes.map(h2).join(' ')}</span>`).join('<br>'));
    }
    rows+=infoRow('Z80 relocation note','For loaded offsets $006+, runtime address = $9DBD + loaded offset. Raw runtime/scratch bytes remain preserved unless explicitly edited.');
    let html=`<table class="info-table">${rows}</table>`;
    if(tower.semanticAvailable){const issues=BWBloodwych.audit(session.tape,tower);html+=`<h3>Consistency audit</h3>${issues.length?`<div class="warning">${issues.map(esc).join('<br>')}</div>`:'<p class="muted">No object-bit / positioned-monster occupancy inconsistencies detected.</p>'}`;}
    const diffs=session.logicalDiff();html+=`<h3>Byte-exact session diff</h3><p class="muted">${diffs.length} intended data byte${diffs.length===1?'':'s'} changed. Spectrum parity is derived separately.</p>`;if(diffs.length)html+=`<div class="mono muted">${diffs.slice(0,80).map(d=>`block ${d.blockIndex} +${hex(d.blockOffset,4)} / file ${hex(d.fileOffset,5)}: ${hex(d.before)} → ${hex(d.after)}`).join('<br>')}${diffs.length>80?'<br>…':''}</div>`;
    box.innerHTML=html;
  }

  function renderSession(){const d=session.logicalDiff(),p=session.changedParityBlocks();$('changeCount').textContent=String(d.length);$('parityCount').textContent=String(p.length);$('undo').disabled=!session.undoStack.length;}
  function renderPanels(){document.querySelectorAll('.mode-panel').forEach(p=>p.classList.toggle('hidden',p.dataset.panel!==mode));document.querySelectorAll('.mode-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));renderEventEditor();renderObjectEditor();renderMonsterEditor();renderLayoutEditor();}
  function renderAll(){renderMap();renderSelection();updateClipboard();renderPanels();renderAudit();renderSession();renderInfo();}

  function cellFromClick(ev){if(!renderMetrics||!floor)return null;const r=canvas.getBoundingClientRect(),sx=canvas.width/r.width,sy=canvas.height/r.height,px=(ev.clientX-r.left)*sx,py=(ev.clientY-r.top)*sy;const gx=Math.floor((px-renderMetrics.marginLeft)/renderMetrics.cellSize),gy=Math.floor((py-renderMetrics.marginTop)/renderMetrics.cellSize),x=gx-renderMetrics.originX,y=gy-renderMetrics.originY;return BWBloodwych.getCell(session.tape,tower,floor,x,y);}
  canvas.addEventListener('click',ev=>{const c=cellFromClick(ev);if(!c)return;selected={x:c.x,y:c.y};if(c.events.length)eventCursor=c.events[0].slot;if(mode==='objects'&&c.objectStacks.length)objectIndex=c.objectStacks[0].index;if(mode==='monsters'&&c.monsters.length)monsterCursor=c.monsters[0].index;renderAll();});

  function rawMapEdit(value,label){const c=selectedCell();if(!c){setStatus('Select a map cell first.','warn');return;}if(value==null||value<0||value>255){setStatus('Enter a hexadecimal byte from 00 to FF.','error');return;}withEdit(label,()=>BWBloodwych.writeCell(session,tower,floor,c.x,c.y,value,{kind:'raw-map'}));}
  function copyCell(){const c=selectedCell();if(!c){setStatus('Select a map cell first.','warn');return;}clipboardByte=c.value;updateClipboard();setStatus(`Copied ${hex(c.value)} from ${BWRenderer.rowLabel(c.y)}${c.x}.`,'ok');}
  function cutCell(){const c=selectedCell();if(!c){setStatus('Select a map cell first.','warn');return;}clipboardByte=c.value;updateClipboard();rawMapEdit(0,'Cut map cell');}
  function pasteCell(){if(clipboardByte==null){setStatus('Clipboard is empty.','warn');return;}rawMapEdit(clipboardByte,'Paste map cell');}

  function setSelectedLocation(fi,x,y){const f=tower.floors[fi];if(!f||!f.used||x<0||y<0||x>=f.width||y>=f.height){setStatus('Referenced location is outside an active floor.','warn');return false;}floor=f;$('floor').value=String(fi);selected={x,y};renderAll();return true;}

  function eventNav(dir){const list=activeEvents();if(!list.length)return;let i=list.findIndex(e=>e.slot===eventCursor);if(i<0)i=0;else i=(i+dir+list.length)%list.length;eventCursor=list[i].slot;renderEventEditor();renderInfo();}
  function saveEvent(){const ev=tower.events.find(e=>e.slot===eventCursor&&!e.empty&&!e.protected);if(!ev)return;const action=+$('eventAction').value,tf=parseDec($('eventTF').value,0,7),tx=parseDec($('eventTX').value,0,31),ty=parseDec($('eventTY').value,0,255);if([tf,tx,ty].some(v=>v==null)){setStatus('Invalid Event target.','error');return;}withEdit(`Save event ${ev.slot}`,()=>BWBloodwych.writeEvent(session,tower,ev.slot,{sourceOffset:ev.sourceOffset,action,targetFloor:tf,targetX:tx,targetY:ty}));}
  function addEvent(){const c=selectedCell();if(!c)return;const slot=BWBloodwych.firstFreeEventSlot(tower);if(slot==null){setStatus(tower.id==='k'?'Archaus has no spare event slots.':tower.id==='m'?'Zendik has no spare normal event slots; 36–44 are protected ending-message storage.':'No spare event slot.','error');return;}if(withEdit(`Add event ${slot}`,()=>BWBloodwych.writeEvent(session,tower,slot,{sourceOffset:c.mapOffset,action:0,targetFloor:floor.floorIndex,targetX:c.x,targetY:c.y})))eventCursor=slot;}
  function moveEvent(){const c=selectedCell(),ev=tower.events.find(e=>e.slot===eventCursor&&!e.empty&&!e.protected);if(!c||!ev){setStatus('Select a destination cell and active Event.','warn');return;}withEdit(`Move event ${ev.slot} source`,()=>BWBloodwych.writeEvent(session,tower,ev.slot,{sourceOffset:c.mapOffset,action:ev.action,targetFloor:ev.targetFloor,targetX:ev.targetX,targetY:ev.targetY}));}
  function deleteEvent(){const ev=tower.events.find(e=>e.slot===eventCursor&&!e.empty&&!e.protected);if(!ev)return;withEdit(`Delete event ${ev.slot}`,()=>BWBloodwych.deleteEvent(session,tower,ev.slot));eventCursor=firstUsedEventSlot();}

  function objectNav(dir){const n=tower.objects.stacks.length;if(!n)return;objectIndex=(objectIndex+dir+n)%n;renderAll();}
  function findObject(){const s=currentObject();if(!s||!s.source){setStatus('This object stack does not resolve to an active floor.','warn');return;}setSelectedLocation(s.source.floorIndex,s.source.x,s.source.y);}
  function saveObject(){const s=currentObject();if(!s)return;const pos=parseDec($('objPosition').value,0,3),codes=[...document.querySelectorAll('.obj-code')],states=[...document.querySelectorAll('.obj-state')];const items=[];for(let i=0;i<codes.length;i++){const code=parseHexByte(codes[i].value),state=parseHexByte(states[i].value);if(code==null||state==null){setStatus('Object code/state must be hexadecimal 00–FF.','error');return;}items.push({code,state});}withEdit(`Save object stack ${s.index}`,()=>BWBloodwych.replaceObjectStack(session,tower,s.index,pos,items));}
  function addObjectStack(){const c=selectedCell();if(!c){setStatus('Select a destination cell first.','warn');return;}const pos=parseDec($('newObjPos')?.value||0,0,3),code=parseHexByte($('newObjCode')?.value||'00'),state=parseHexByte($('newObjState')?.value||'00');if(pos==null||code==null||state==null){setStatus('Invalid new object stack values.','error');return;}const newIndex=tower.objects.stacks.length;if(withEdit('Add object stack',()=>BWBloodwych.addObjectStack(session,tower,floor,c.x,c.y,pos,code,state)))objectIndex=newIndex;}
  function moveObject(){const c=selectedCell(),s=currentObject();if(!c||!s){setStatus('Select a map destination and object stack.','warn');return;}const pos=parseDec($('objPosition')?.value??s.position,0,3);withEdit(`Move object stack ${s.index}`,()=>BWBloodwych.moveObjectStack(session,tower,s.index,floor,c.x,c.y,pos));}
  function addObjectItem(){const s=currentObject();if(!s)return;const items=s.items.map(i=>({code:i.code,state:i.state}));items.push({code:0,state:0});withEdit(`Add item to stack ${s.index}`,()=>BWBloodwych.replaceObjectStack(session,tower,s.index,s.position,items));}
  function deleteObjectItem(){const s=currentObject();if(!s)return;if(s.items.length<=1){setStatus('Delete the stack instead of removing its final object.','warn');return;}const items=s.items.slice(0,-1).map(i=>({code:i.code,state:i.state}));withEdit(`Delete item from stack ${s.index}`,()=>BWBloodwych.replaceObjectStack(session,tower,s.index,s.position,items));}

  function monsterNav(dir){const list=activeMonsters();if(!list.length)return;let i=list.findIndex(m=>m.index===monsterCursor);if(i<0)i=0;else i=(i+dir+list.length)%list.length;monsterCursor=list[i].index;renderAll();}
  function findMonster(){const m=currentMonster();if(!m)return;if(m.x!==0xff){setSelectedLocation(m.floorIndex,m.x,m.y);return;}for(const ti of m.teamIndexes){const t=tower.teams[ti];for(const mi of t.members){if(mi===0xff)continue;const leader=tower.monsters[mi];if(leader&&!leader.unused&&leader.x!==0xff){setSelectedLocation(leader.floorIndex,leader.x,leader.y);setStatus(`Monster ${m.index} is secondary (X=FF); found positioned team member ${leader.index}.`,'ok');return;}}}setStatus('Secondary monster has no positioned team member to find.','warn');}
  function placeMonster(){const c=selectedCell(),m=currentMonster();if(!c||!m){setStatus('Select a destination cell and monster.','warn');return;}const rot=parseHexByte($('monRot')?.value??h2(m.rotation));if(rot==null){setStatus('Invalid rotation byte.','error');return;}withEdit(`Move monster ${m.index}`,()=>BWBloodwych.moveMonster(session,tower,m.index,floor,c.x,c.y,rot));}
  function saveMonster(){
    const m=currentMonster();if(!m)return;const xs=String($('monX').value).trim().toUpperCase();const x=xs==='FF'?0xff:parseDec(xs,0,255),y=parseDec($('monY').value,0,255),fi=parseDec($('monFloor').value,0,4),rot=parseHexByte($('monRot').value),cycle=parseHexByte($('monCycle').value),base=parseHexByte($('monBase').value),eff=parseHexByte($('monEff').value),hp=parseDec($('monHp').value,0,65535),action=parseHexByte($('monAction').value),beh=parseHexByte($('monBehaviour').value),form=parseHexByte($('monForm').value),teamField=parseHexByte($('monTeamField').value),drop=parseHexByte($('monDrop').value);
    if([x,y,fi,rot,cycle,base,eff,hp,action,beh,form,teamField,drop].some(v=>v==null)){setStatus('One or more monster fields are invalid.','error');return;}
    const target=tower.floors[fi];if(x!==0xff&&(!target||!target.used||x>=target.width||y>=target.height)){setStatus('Positioned monster location is outside the target floor.','error');return;}
    withEdit(`Save monster ${m.index}`,()=>{
      if(x===0xff){
        if(m.x!==0xff){const old=tower.floors[m.floorIndex],other=tower.monsters.some(q=>q.index!==m.index&&!q.unused&&q.x!==0xff&&q.floorIndex===m.floorIndex&&q.x===m.x&&q.y===m.y);if(old&&old.used&&!other)BWBloodwych.setMapFlag(session,tower,old,m.x,m.y,0x80,false,{kind:'monster-flag'});}
        BWBloodwych.writeMonsterField(session,tower,m.index,0,0xff);BWBloodwych.writeMonsterField(session,tower,m.index,1,y);BWBloodwych.writeMonsterField(session,tower,m.index,3,fi);BWBloodwych.writeMonsterField(session,tower,m.index,2,rot);
      } else BWBloodwych.moveMonster(session,tower,m.index,target,x,y,rot);
      BWBloodwych.writeMonsterField(session,tower,m.index,4,cycle);BWBloodwych.writeMonsterField(session,tower,m.index,5,base);BWBloodwych.writeMonsterField(session,tower,m.index,6,eff);BWBloodwych.writeMonsterField(session,tower,m.index,7,hp&255);BWBloodwych.writeMonsterField(session,tower,m.index,8,(hp>>8)&255);BWBloodwych.writeMonsterField(session,tower,m.index,9,action);BWBloodwych.writeMonsterField(session,tower,m.index,10,beh);BWBloodwych.writeMonsterField(session,tower,m.index,11,form);BWBloodwych.writeMonsterField(session,tower,m.index,12,teamField);BWBloodwych.writeMonsterField(session,tower,m.index,13,drop);
    });
  }
  function teamNav(dir){teamCursor=(teamCursor+dir+10)%10;renderMonsterEditor();}
  function saveTeam(){const vals=[...document.querySelectorAll('.team-member')].map(i=>parseHexByte(i.value));if(vals.some(v=>v==null)){setStatus('Team members must be hexadecimal 00–29 or FF.','error');return;}withEdit(`Save team ${teamCursor}`,()=>BWBloodwych.writeTeam(session,tower,teamCursor,vals));}

  function saveFloorLayout(){const w=parseDec($('layW').value),h=parseDec($('layH').value),data=parseHexWord($('layData').value,0x40b),xo=parseDec($('layX').value),yo=parseDec($('layY').value);if([w,h,data,xo,yo].some(v=>v==null)){setStatus('Invalid floor descriptor value.','error');return;}withEdit(`Save floor ${floor.floorIndex} descriptor`,()=>BWBloodwych.writeFloorDescriptor(session,tower,floor.floorIndex,{width:w,height:h,dataOffset:data,xOffset:xo,yOffset:yo}));}
  function saveStarts(){const vals=[];for(const p of [1,2]){const x=parseDec($(`p${p}x`).value),y=parseDec($(`p${p}y`).value),f=parseDec($(`p${p}f`).value,0,4);if([x,y,f].some(v=>v==null)){setStatus('Invalid player start.','error');return;}vals.push({p,x,y,f});}withEdit('Save player starts',()=>vals.forEach(v=>BWBloodwych.writePlayerStart(session,tower,v.p,v.x,v.y,v.f)));}
  function saveProgression(){const v=parseDec($('progression').value);if(v==null){setStatus('Invalid progression value.','error');return;}withEdit('Save progression requirement',()=>BWBloodwych.writeProgression(session,tower,v));}
  function saveTeleports(){const rows=[];for(let p=0;p<2;p++){const active=$(`tp${p}active`).checked,ax=parseDec($(`tp${p}ax`).value,0,255),ay=parseDec($(`tp${p}ay`).value,0,255),bx=parseDec($(`tp${p}bx`).value,0,255),by=parseDec($(`tp${p}by`).value,0,255);if(active&&[ax,ay,bx,by].some(v=>v==null)){setStatus('Teleport X/Y values must be 0–255.','error');return;}rows.push({p,active,ax:ax||0,ay:ay||0,bx:bx||0,by:by||0});}withEdit('Save teleport pairs',()=>rows.forEach(v=>BWBloodwych.writeTeleportPair(session,tower,v.p,v.active,v.ax,v.ay,v.bx,v.by)));}
  function saveCrystals(){const rows=[];for(let i=0;i<8;i++){const active=$(`cr${i}active`).checked,f=parseDec($(`cr${i}f`).value,0,4),x=parseDec($(`cr${i}x`).value,0,255),y=parseDec($(`cr${i}y`).value,0,255),variant=parseDec($(`cr${i}v`).value,0,15);if(active&&[f,x,y,variant].some(v=>v==null)){setStatus('Crystal/socket location requires a valid floor, X/Y and variant 0–15.','error');return;}rows.push({i,active,f:f||0,x:x||0,y:y||0,variant:variant||0});}withEdit('Save crystal/socket special locations',()=>rows.forEach(v=>BWBloodwych.writeSpecialLocation(session,tower,v.i,v.active,v.f,v.x,v.y,v.variant)));}

  function fitMap(){if(!floor||!floor.used)return;const area=$('mapArea'),aligned=$('aligned').checked;let w=floor.width,h=floor.height;if(aligned){const used=tower.floors.filter(f=>f.used);w=Math.max(...used.map(f=>f.width+f.xOffset));h=Math.max(...used.map(f=>f.height+f.yOffset));}const cell=Math.max(18,Math.min(48,Math.floor(Math.min((area.clientWidth-70)/Math.max(1,w),(area.clientHeight-70)/Math.max(1,h)))));$('zoom').value=String(cell);renderMap();}

  document.querySelector('.mode-tabs').addEventListener('click',e=>{const b=e.target.closest('button[data-mode]');if(!b)return;mode=b.dataset.mode;renderAll();});
  ['ovStarts','ovEvents','ovObjects','ovMonsters','ovSpecials','ovTeleports','zoom','aligned','showGrid','showHex','mapStyle'].forEach(id=>$(id).addEventListener('input',renderMap));
  $('fitMap').addEventListener('click',fitMap);$('tower').addEventListener('change',()=>selectTower());$('floor').addEventListener('change',selectFloor);
  $('tapFile').addEventListener('change',async()=>{const f=$('tapFile').files[0];if(f)loadBuffer(await f.arrayBuffer(),f.name);});
  async function loadBundled(path,label){try{const r=await fetch(path);if(!r.ok)throw new Error(`HTTP ${r.status}`);loadBuffer(await r.arrayBuffer(),label);}catch(err){setStatus(`Could not load bundled ${label}: ${err.message}. Use OPEN LEVEL TAPE or serve the repository with a local web server.`,'warn');}}
  $('loadBundled').addEventListener('click',()=>loadBundled('data/Bloodwych%20-%20Level%20Data%20%5BZX%20Spectrum%5D.tzx','Bloodwych - Level Data [ZX Spectrum].tzx'));

  $('cutCell').addEventListener('click',cutCell);$('copyCell').addEventListener('click',copyCell);$('pasteCell').addEventListener('click',pasteCell);$('applyEdit').addEventListener('click',()=>rawMapEdit(parseHexByte($('editByte').value),'Edit map byte'));
  $('objectPrev').addEventListener('click',()=>objectNav(-1));$('objectNext').addEventListener('click',()=>objectNav(1));$('objectFind').addEventListener('click',findObject);$('objectPlace').addEventListener('click',moveObject);$('objectAdd').addEventListener('click',addObjectStack);
  $('monsterPrev').addEventListener('click',()=>monsterNav(-1));$('monsterNext').addEventListener('click',()=>monsterNav(1));$('monsterFind').addEventListener('click',findMonster);$('monsterPlace').addEventListener('click',placeMonster);

  document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act;
    if(a==='event-prev')eventNav(-1);else if(a==='event-next')eventNav(1);else if(a==='event-save')saveEvent();else if(a==='event-find'){const ev=tower.events.find(e=>e.slot===eventCursor);if(ev&&ev.source)setSelectedLocation(ev.source.floorIndex,ev.source.x,ev.source.y);else setStatus('Event source does not resolve to an active floor.','warn');}else if(a==='event-move')moveEvent();else if(a==='event-delete')deleteEvent();else if(a==='event-add')addEvent();
    else if(a==='object-save')saveObject();else if(a==='object-item-add')addObjectItem();else if(a==='object-item-delete')deleteObjectItem();else if(a==='object-delete'){const s=currentObject();if(s&&withEdit(`Delete object stack ${s.index}`,()=>BWBloodwych.deleteObjectStack(session,tower,s.index)))objectIndex=Math.max(0,objectIndex-1);}
    else if(a==='monster-save')saveMonster();else if(a==='team-prev')teamNav(-1);else if(a==='team-next')teamNav(1);else if(a==='team-save')saveTeam();
    else if(a==='layout-floor-save')saveFloorLayout();else if(a==='layout-start-save')saveStarts();else if(a==='layout-progression-save')saveProgression();else if(a==='layout-teleport-save')saveTeleports();else if(a==='layout-crystal-save')saveCrystals();
  });

  document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable))return;const k=e.key.toLowerCase();if(k==='x'){e.preventDefault();cutCell();}else if(k==='c'){e.preventDefault();copyCell();}else if(k==='v'){e.preventDefault();pasteCell();}else if(e.key==='Backspace'){e.preventDefault();rawMapEdit(0,'Clear map cell');}});

  $('undo').addEventListener('click',()=>{const tx=session.undo();if(!tx){setStatus('Nothing to undo.','warn');return;}refreshModel();setStatus(`Undid: ${tx.label}.`,'ok');});
  $('resetAll').addEventListener('click',()=>{if(!session.tape)return;session.reset();refreshModel();setStatus('All edits reset to the loaded source.','ok');});
  $('exportLevel').addEventListener('click',()=>{if(!session.tape)return;const ext=session.tape.format==='TZX'?'tzx':'tap',name=`Bloodwych-Level-Data-Stage5-modified.${ext}`;download(name,session.rebuildLevelTape());setStatus(`Exported ${name}. Only intended data bytes and affected Spectrum parity bytes differ from the loaded source.`,'ok');});
  $('exportPatch').addEventListener('click',()=>{if(!session.tape)return;const obj={format:'Bloodwych-zx-level-edits-v2',sourceRole:'level',source:session.level.label,tapeFormat:session.tape.format,logicalChanges:session.logicalDiff(),parityBlocks:session.changedParityBlocks().map(b=>b.index)};download('bloodwych-zx-stage5-level-edits.json',JSON.stringify(obj,null,2),'application/json');});
  $('exportBlock').addEventListener('click',()=>{if(!tower)return;download(`${tower.id}-${tower.name}-block.bin`,session.tape.blocks[tower.blockIndex].raw);});
  $('exportFloor').addEventListener('click',()=>{if(!floor||!floor.used)return;const b=session.tape.blocks[tower.blockIndex],start=BWBloodwych.rawOffset(BWBloodwych.MAP_BASE+floor.dataOffset);download(`${tower.id}-${tower.name}-floor${floor.floorIndex}.bin`,b.raw.slice(start,start+floor.availableCells));});
  $('exportJson').addEventListener('click',()=>{if(!tower)return;const obj={id:tower.id,name:tower.name,segment:tower.segmentNumber,playerStarts:tower.playerStarts,floors:tower.floors.map(f=>({floor:f.floorIndex,width:f.width,height:f.height,dataOffset:f.dataOffset,xOffset:f.xOffset,yOffset:f.yOffset,complete:f.complete})),events:tower.events.filter(e=>e.normal&&!e.empty).map(e=>({slot:e.slot,sourceOffset:e.sourceOffset,source:e.source,action:e.action,target:[e.targetFloor,e.targetX,e.targetY],raw:e.raw})),objects:tower.objects.stacks,monsterCount:tower.monsterCount,monsters:tower.monsters.filter(m=>m.active&&!m.unused),teams:tower.teams};download(`${tower.id}-${tower.name}-stage5.json`,JSON.stringify(obj,null,2),'application/json');});

  function openInfo(on){const d=$('infoDrawer'),shade=$('drawerShade');const open=on==null?!d.classList.contains('open'):on;d.classList.toggle('open',open);d.setAttribute('aria-hidden',String(!open));shade.classList.toggle('hidden',!open);if(open)renderInfo();}
  $('infoToggle').addEventListener('click',()=>openInfo());$('infoClose').addEventListener('click',()=>openInfo(false));$('drawerShade').addEventListener('click',()=>openInfo(false));

  updateClipboard();renderAll();
})();
