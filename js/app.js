(function(){
  'use strict';
  let tap=null,towers=[],tower=null,floor=null,selected=null,renderMetrics=null;
  const changes=[];
  const $=id=>document.getElementById(id);
  const fileInput=$('tapFile'),towerSel=$('tower'),floorSel=$('floor'),canvas=$('map');

  function hex(n,w=2){return '$'+n.toString(16).toUpperCase().padStart(w,'0');}
  function setStatus(msg,kind=''){const e=$('status');e.textContent=msg;e.className=kind;}
  function download(name, bytes, mime='application/octet-stream'){
    const blob=new Blob([bytes],{type:mime});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  function loadBuffer(buf,label){
    try{
      tap=BWTap.parseTap(buf);towers=BWBloodwych.findTowers(tap);
      if(towers.length!==10) setStatus(`Loaded ${label}: found ${towers.length} custom blocks (expected 10).`,'warn');
      else setStatus(`Loaded ${label}: ${tap.blocks.length} TAP blocks, 10 Bloodwych data blocks. Checksums ${tap.blocks.every(b=>b.checksumValid)?'OK':'include failures'}.`,'ok');
      changes.length=0; populateTowers();
    }catch(e){console.error(e);setStatus(e.message,'error');}
  }

  function populateTowers(){
    towerSel.innerHTML='';
    towers.forEach((t,i)=>{const o=document.createElement('option');o.value=i;o.textContent=`${t.id.toUpperCase()} — ${t.name}`;towerSel.appendChild(o);});
    towerSel.value='0';selectTower();
  }
  function selectTower(){
    tower=towers[+towerSel.value];floorSel.innerHTML='';
    tower.floors.forEach((f,i)=>{const o=document.createElement('option');o.value=i;const state=!f.used?'unused':f.complete?'complete':`PARTIAL ${f.availableCells}/${f.cellCount}`;o.textContent=`Floor ${i}: ${f.width}×${f.height} @ +${f.xOffset},${f.yOffset} — ${state}`;floorSel.appendChild(o);});
    const first=tower.floors.find(f=>f.used);floorSel.value=first?String(first.floorIndex):'0';selectFloor();renderTowerInfo();
  }
  function selectFloor(){floor=tower.floors[+floorSel.value];selected=null;render();renderInspector(null);}

  function render(){
    if(!tap||!tower||!floor||!floor.used){canvas.width=1;canvas.height=1;return;}
    renderMetrics=BWRenderer.render(canvas,tap,tower,floor,{
      cellSize:+$('zoom').value,
      aligned:$('aligned').checked,
      showHex:$('showHex').checked,
      showGrid:$('showGrid').checked,
      selected
    });
    $('floorWarning').textContent=floor.complete?'':`This floor is physically partial in this TAP block: ${floor.availableCells}/${floor.cellCount} bytes available.`;
  }

  function renderTowerInfo(){
    const lines=[];
    lines.push(`${tower.name} [${tower.id}]`);
    lines.push(`TAP block: ${tower.blockIndex}`);
    lines.push(`Block file offset: ${hex(tower.blockFileOffset,5)}`);
    lines.push(`Block length: ${tower.blockLength} bytes`);
    lines.push(`Checksum: ${tap.blocks[tower.blockIndex].checksumValid?'valid':'INVALID'}`);
    lines.push(`Descriptor table: block +$23`);
    lines.push(`Map base: block +$41`);
    lines.push(`Switch count (map order): ${tower.switchCount}`);
    $('towerInfo').textContent=lines.join('\n');
  }

  function renderInspector(cell){
    if(!cell){$('tileInfo').textContent='Select a map cell.';$('editByte').value='';return;}
    const t=cell.tile;
    const lines=[
      `Local: ${BWRenderer.rowLabel(cell.y)}${cell.x}`,
      `Aligned: ${BWRenderer.rowLabel(cell.globalY)}${cell.globalX}`,
      `Byte: ${hex(cell.value)}${cell.changed?`  (original ${hex(cell.original)})`:''}`,
      `Binary: ${cell.value.toString(2).padStart(8,'0')}`,
      `Nibbles: high ${hex(cell.value>>>4,1)}, low ${hex(cell.value&15,1)}`,
      `Type: ${t.label}`,
      `Kind: ${t.kind}`,
      `Confidence: ${t.confidence}`,
      t.facing?`Facing: ${t.facing}`:'',
      t.orientation?`Orientation: ${t.orientation}`:'',
      t.lockId!=null?`Lock: ${t.lockId}`:'',
      cell.switchSequence!=null?`Switch sequence: #${cell.switchSequence}`:'',
      `Floor data index: ${cell.index}`,
      `Custom-block offset: ${hex(cell.blockOffset,4)}`,
      `Absolute TAP file offset: ${hex(cell.fileOffset,5)}`,
      t.note?`Note: ${t.note}`:''
    ].filter(Boolean);
    $('tileInfo').textContent=lines.join('\n');$('editByte').value=cell.value.toString(16).toUpperCase().padStart(2,'0');
  }

  function cellFromClick(ev){
    if(!renderMetrics||!floor)return null;const r=canvas.getBoundingClientRect();
    const scaleX=canvas.width/r.width,scaleY=canvas.height/r.height;
    const px=(ev.clientX-r.left)*scaleX,py=(ev.clientY-r.top)*scaleY;
    const gx=Math.floor((px-renderMetrics.marginLeft)/renderMetrics.cellSize);
    const gy=Math.floor((py-renderMetrics.marginTop)/renderMetrics.cellSize);
    const x=gx-renderMetrics.originX,y=gy-renderMetrics.originY;
    return BWBloodwych.getCell(tap,tower,floor,x,y);
  }

  canvas.addEventListener('click',ev=>{const c=cellFromClick(ev);if(!c)return;selected={x:c.x,y:c.y};render();renderInspector(c);});

  $('applyEdit').addEventListener('click',()=>{
    if(!selected)return;let v=parseInt($('editByte').value,16);if(!Number.isInteger(v)||v<0||v>255){setStatus('Enter a byte from 00 to FF.','error');return;}
    const before=BWBloodwych.getCell(tap,tower,floor,selected.x,selected.y);const oldTower=tower;
    tower=BWBloodwych.writeCell(tap,tower,floor,selected.x,selected.y,v);
    towers[towers.findIndex(t=>t.blockIndex===tower.blockIndex)]=tower;floor=tower.floors[floor.floorIndex];
    changes.push({tower:tower.id,floor:floor.floorIndex,x:selected.x,y:selected.y,from:before.value,to:v,fileOffset:before.fileOffset});
    render();renderInspector(BWBloodwych.getCell(tap,tower,floor,selected.x,selected.y));renderTowerInfo();renderChanges();
  });

  function renderChanges(){
    $('changeCount').textContent=String(changes.length);
    $('changes').innerHTML=changes.slice().reverse().map(c=>`<li>${c.tower.toUpperCase()} F${c.floor} ${BWRenderer.rowLabel(c.y)}${c.x}: ${hex(c.from)} → ${hex(c.to)} <small>@ ${hex(c.fileOffset,5)}</small></li>`).join('')||'<li>No edits.</li>';
  }

  $('resetAll').addEventListener('click',()=>{
    if(!tap)return;for(const b of tap.blocks)b.raw=b.originalRaw.slice();changes.length=0;towers=BWBloodwych.findTowers(tap);tower=towers.find(t=>t.id===tower.id)||towers[0];floor=tower.floors[floor.floorIndex];render();renderTowerInfo();renderChanges();if(selected)renderInspector(BWBloodwych.getCell(tap,tower,floor,selected.x,selected.y));
  });

  $('exportTap').addEventListener('click',()=>{if(!tap)return;download('Bloodwych-modified.TAP',BWTap.rebuildTap(tap));});
  $('exportBlock').addEventListener('click',()=>{if(!tap||!tower)return;download(`Bloodwych-${tower.id}-${tower.name}-block.bin`,tap.blocks[tower.blockIndex].raw);});
  $('exportFloor').addEventListener('click',()=>{if(!floor||!floor.used)return;const block=tap.blocks[tower.blockIndex];const bytes=block.raw.slice(floor.blockStart,floor.blockStart+floor.availableCells);download(`${tower.id}-${tower.name}-floor${floor.floorIndex}.bin`,bytes);});
  $('exportPatch').addEventListener('click',()=>{download('bloodwych-level-edits.json',JSON.stringify({format:'Bloodwych-zx-level-edits-v1',changes},null,2),'application/json');});
  $('exportJson').addEventListener('click',()=>{
    if(!tower)return;const obj={id:tower.id,name:tower.name,blockIndex:tower.blockIndex,floors:tower.floors.map(f=>({floor:f.floorIndex,width:f.width,height:f.height,xOffset:f.xOffset,yOffset:f.yOffset,dataOffset:f.dataOffset,complete:f.complete,bytes:f.used?Array.from(tap.blocks[tower.blockIndex].raw.slice(f.blockStart,f.blockStart+f.availableCells)):[]}))};
    download(`${tower.id}-${tower.name}.json`,JSON.stringify(obj,null,2),'application/json');
  });

  fileInput.addEventListener('change',async()=>{const f=fileInput.files[0];if(f)loadBuffer(await f.arrayBuffer(),f.name);});
  $('loadBundled').addEventListener('click',async()=>{try{const r=await fetch('../data/Bloodwych%20%5BZX%20Spectrum%5D.TAP');if(!r.ok)throw new Error(`HTTP ${r.status}`);loadBuffer(await r.arrayBuffer(),'bundled TAP');}catch(e){setStatus('Bundled TAP could not be loaded. Use “Choose TAP” or serve the repo with python -m http.server.','warn');}});
  towerSel.addEventListener('change',selectTower);floorSel.addEventListener('change',selectFloor);
  ['zoom','aligned','showHex','showGrid'].forEach(id=>$(id).addEventListener('input',render));

  renderChanges();
})();
