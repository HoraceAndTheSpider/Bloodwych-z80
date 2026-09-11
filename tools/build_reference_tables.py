#!/usr/bin/env python3
from pathlib import Path
import csv,json,hashlib,sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from zx_editor_model import GameImage,LevelPayload,s8
from zx_render import Renderer,OBJECT_NAMES,SLOT_TO_SAMPLE,FLOOR_FEATURE_DESC

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/reference';OUT.mkdir(parents=True,exist_ok=True)
g=GameImage.from_file(ROOT/'data/extracts/game/Game_Main_5B00_FFFF.bin');r=Renderer(g)
lv=LevelPayload.from_file(ROOT/'data/extracts/levels/d-Keeps/LevelPayload.bin')

def write_csv(name,fields,rows):
    p=OUT/name
    with p.open('w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
    return p

def hx(v,w=2): return f'${v:0{w}X}'

# Object catalogue directly from Game source tables.
rows=[]
for code,name in enumerate(OBJECT_NAMES):
    gp=g.word(0x6BA2+2*code); cs=g.byte(0x6AF2+code); attrs=list(g.slice(0x6B3E+4*cs,0x6B42+4*cs))
    fam=g.byte(0x6C52+code)
    rows.append(dict(code=hx(code),name=name,inventory_graphic=hx(gp,4),colour_set=cs,perspective_family=fam,
                     attr0=hx(attrs[0]),attr1=hx(attrs[1]),attr2=hx(attrs[2]),attr3=hx(attrs[3])))
write_csv('object_catalogue.csv',list(rows[0]),rows)

# Perspective family/depth table.
rows=[]
for fam in range(18):
    vals=list(g.slice(0x6C9E+fam*4,0x6CA2+fam*4))
    codes=[hx(c) for c in range(0x4C) if g.byte(0x6C52+c)==fam]
    rows.append(dict(family=fam,depth0=vals[0],depth1=vals[1],depth2=vals[2],depth3=vals[3],object_codes=' '.join(codes)))
write_csv('object_perspective_families.csv',list(rows[0]),rows)
rows=[]
for gi in range(41):
    p=0x6CE6+gi*4;gp=g.word(p);mp=g.word(p+2);wb=g.byte(gp);h=g.byte(gp+1)
    rows.append(dict(graphic_index=gi,record_start=hx(gp,4),mask_pointer=hx(mp,4),width_bytes=wb,width_pixels=wb*8,height=h))
write_csv('object_perspective_graphics.csv',list(rows[0]),rows)

# Masked bank exact sequential boundaries.
rows=[];p=0x6D8A;i=0
while p<0x8278:
    wb=g.byte(p);h=g.byte(p+1);n=wb*h; mp=p+2+n; nxt=p+2+2*n
    rows.append(dict(index=i,record_start=hx(p,4),mask_start=hx(mp,4),next_record=hx(nxt,4),width_bytes=wb,width_pixels=wb*8,height=h,size=nxt-p))
    p=nxt;i+=1
assert p==0x8278 and i==162
write_csv('masked_graphics_records.csv',list(rows[0]),rows)

# Dungeon view slots and samples.
wallptr=[g.word(0x8A0F+2*i) for i in range(19)]
rows=[]
for slot,sample in enumerate(SLOT_TO_SAMPLE):
    rows.append(dict(slot=slot,sample=sample,depth_raw=hx(g.byte(0x87CF+slot)),depth_low2=g.byte(0x87CF+slot)&3,
                     wall_graphic=hx(wallptr[slot],4),wall_x_byte=g.byte(0x8A37+2*slot),wall_y=g.byte(0x8A38+2*slot),
                     overlay_side_bit=(1,0,1,0,1,0,1,1,1,0,1,0,1,0,1,1,1,1,1)[slot]))
write_csv('dungeon_view_slots.csv',list(rows[0]),rows)
rows=[]
for facing,name in enumerate(('N','E','S','W')):
    for sample,(dx,dy) in enumerate(r.sample_offsets(facing)):
        rows.append(dict(facing=facing,facing_name=name,sample=sample,dx=dx,dy=dy,current_cell=(sample==13)))
write_csv('dungeon_sample_offsets.csv',list(rows[0]),rows)

# Wall masks exact.
D,O=r.wall_masks();rows=[]
for i in range(13):
    rows.append(dict(sample=i,draw_mask=f'${D[i]:06X}',occlusion_mask=f'${O[i]:06X}',slots=' '.join(str(s) for s,x in enumerate(SLOT_TO_SAMPLE) if x==i)))
write_csv('dungeon_wall_masks.csv',list(rows[0]),rows)

# Wall overlay model.
rows=[
 dict(feature_range='$00-$03',kind='plain/other',descriptor='',face_bits='feature & 3',confidence='STRUCTURAL'),
 dict(feature_range='$04-$07',kind='empty gem socket',descriptor='$950D',face_bits='feature & 3',confidence='PROVEN family/render path'),
 dict(feature_range='$08-$0B',kind='switch',descriptor='$88AC',face_bits='feature & 3',confidence='PROVEN family/render path'),
 dict(feature_range='$0C-$0F',kind='filled crystal/gem socket',descriptor='$950D',face_bits='feature & 3',confidence='PROVEN bitmap family; identity/colour separate'),
]
write_csv('wall_feature_families.csv',list(rows[0]),rows)

# Generic descriptors pointer/placement exports.
for label,addr in [('wall',0x8A0F),('switch',0x88AC),('socket',0x950D),('door_static',0x897B),('floor_18_28',0x92FE),('floor_20_30',0x938D),('floor_08',0x940D),('floor_38',0x948D)]:
    rows=[]
    for slot in range(20):
        gp,x,y=r.descriptor(addr,slot)
        rows.append(dict(slot=slot,graphic_pointer=hx(gp,4),x_byte=x,y=y,dummy=(gp==0x88A9)))
    write_csv(f'descriptor_{label}.csv',list(rows[0]),rows)

rows=[]
for key,desc in [(0x00,None),(0x08,0x940D),(0x10,None),(0x18,0x92FE),(0x20,0x938D),(0x28,0x92FE),(0x30,0x938D),(0x38,0x948D)]:
    rows.append(dict(map_mask=hx(key),descriptor='' if desc is None else hx(desc,4),static_draw='yes' if desc else 'no',
                     procedural_supplement='yes' if key in (0x28,0x30) else 'no',confidence='PROVEN dispatcher'))
write_csv('floor_feature_dispatch.csv',list(rows[0]),rows)

# Four object sub-position perspective coordinate tables.
rows=[]
for pos in range(4):
    for slot in range(20):
        a=0x8809+pos*40+slot*2
        rows.append(dict(sub_position=pos,slot=slot,x=s8(g.byte(a)),y=g.byte(a+1)))
write_csv('object_subposition_coordinates.csv',list(rows[0]),rows)
rows=[]
rot=((0,1,2,3),(1,3,0,2),(3,2,1,0),(2,0,3,1))
for facing in range(4):
    for stored in range(4): rows.append(dict(player_facing=facing,stored_position=stored,render_position=rot[facing][stored]))
write_csv('object_subposition_rotation.csv',list(rows[0]),rows)

# Actor package matrix.
rows=[]
for pr in range(4):
    vals=[g.word(0x877B+pr*12+i*2) for i in range(6)]
    rows.append(dict(package_row=pr,near_image=hx(vals[0],4),middle_image=hx(vals[1],4),far_image=hx(vals[2],4),
                     near_masks=hx(vals[3],4),middle_masks=hx(vals[4],4),far_masks=hx(vals[5],4)))
write_csv('actor_package_matrix.csv',list(rows[0]),rows)

# Correct source-derived appearance vectors 01-99.
rows=[]
for app in range(1,0x9A):
    for depth,name in enumerate(('near','middle','far')):
        try: vec,body,si=r._appearance_vector(app,depth)
        except ValueError: continue
        rows.append(dict(appearance=hx(app),depth=name,body_design=body,identity_selector_index=si,vector=' '.join(map(str,vec))))
write_csv('actor_appearance_vectors_01_99.csv',list(rows[0]),rows)

# Champion authored starting inventory.
slot_names=['hand/equipment 0','hand/equipment 1','body armour','shield','pocket 0','pocket 1','pocket 2','pocket 3','pocket 4','pocket 5']
rows=[]
for ci in range(16):
    pockets=g.starting_pockets(ci);qs=g.shared_quantities(ci);d=g.champion_data(ci)
    row={'index':ci+1,'id':hx(d[0]),'name':g.champion_name(ci),'quantity_coinage':qs[0],'quantity_common_keys':qs[1],
         'quantity_arrows':qs[2],'quantity_elf_arrows':qs[3]}
    for si,v in enumerate(pockets):
        row[f'slot{si}_code']=hx(v);row[f'slot{si}_name']=OBJECT_NAMES[v] if v<len(OBJECT_NAMES) else 'raw'
    rows.append(row)
write_csv('champion_starting_inventory.csv',list(rows[0]),rows)
write_csv('champion_inventory_slots.csv',['slot','champion_data_offset','role'],
          [dict(slot=i,champion_data_offset=hx(0x17+i),role=n) for i,n in enumerate(slot_names)])

# Champion/monster field dictionaries.
champ=[
('$00','champion ID','PROVEN'),('$01','Level','PROVEN'),('$02','Strength','PROVEN'),('$03','Agility','PROVEN'),('$04','Intelligence','PROVEN'),('$05','Charisma','PROVEN'),
('$06','current HP','PROVEN'),('$07','maximum HP','PROVEN'),('$08','current Vitality','PROVEN'),('$09','maximum Vitality','PROVEN'),('$0A','Food','PROVEN/STRONG'),('$0B','current Spell Points','PROVEN'),('$0C','maximum Spell Points','PROVEN'),('$0D','base armour/protection','PROVEN'),('$0E-$12','runtime/other state','OPEN; zero in all authored templates'),('$13-$16','shared quantities object $01-$04','PROVEN'),('$17-$20','ten actual equipment/pocket slots','PROVEN'),('$21','fixed Coinage display object','STRONG'),('$22','fixed Common-Key display object','STRONG'),('$23','continuing/worn spell packed state','PROVEN structure'),('$24','prepared spell index; $FF none','PROVEN'),('$25-$26','casting-related runtime fields','STRONG; exact names OPEN'),('$27-$2A','32 learned-spell flags','PROVEN')]
write_csv('champion_fields.csv',['offset','meaning','confidence'],[dict(offset=a,meaning=b,confidence=c) for a,b,c in champ])
monster=[
('$00','X; $FF secondary team member','PROVEN/STRONG'),('$01','Y','PROVEN'),('$02','orientation / formation state','STRONG'),('$03','floor','PROVEN'),('$04','action-cycle/timing','STRONG'),('$05','base level','STRONG'),('$06','effective/current level','STRONG'),('$07-$08','current HP little-endian','PROVEN'),('$09','action/status','STRONG'),('$0A','appearance/graphics selector','PROVEN'),('$0B','object dropped on death','PROVEN'),('$0C','team relationship; leader team row, independent/secondary $FF','PROVEN/STRONG'),('$0D','special/live-entity class/lifecycle','STRONG; enum OPEN'),('$0E','runtime visual/status/countdown flags; authored zero','STRONG'),('$0F','runtime target/reference','STRONG')]
write_csv('monster_fields.csv',['offset','meaning','confidence'],[dict(offset=a,meaning=b,confidence=c) for a,b,c in monster])
rows=[]
raw=list(g.slice(0x87B7,0x87C7))
for row in range(4):
    rows.append(dict(row=row,member0=raw[row*4],member1=raw[row*4+1],member2=raw[row*4+2],member3=raw[row*4+3]))
write_csv('team_formation_permutations.csv',list(rows[0]),rows)

# Keeps concrete authored teams/monsters for editor examples.
rows=[]
for ti,t in enumerate(lv.teams()): rows.append(dict(team=ti,member0=hx(t[0]),member1=hx(t[1]),member2=hx(t[2]),member3=hx(t[3])))
write_csv('keeps_teams.csv',list(rows[0]),rows)
rows=[]
active=min(lv.data[0x474],42)
for i in range(active):
    m=lv.monster(i)
    rows.append(dict(index=i,x=hx(m.x),y=hx(m.y),orientation=hx(m.orientation),floor=m.floor,action_cycle=hx(m.action_cycle),base_level=m.base_level,effective_level=m.effective_level,hp=m.hp,action_status=hx(m.action_status),appearance=hx(m.appearance),dropped_object=hx(m.dropped_object),team_field=hx(m.team_field),entity_class=hx(m.entity_class),runtime_status=hx(m.runtime_status),target_ref=hx(m.target_ref)))
write_csv('keeps_monsters.csv',list(rows[0]),rows)

# Summary JSON: addresses and confidence for direct editor consumers.
summary={
 'game_load':{'base':'$5B00','end':'$FFFF','size':0xA500},
 'dungeon':{'buffer':'$A6AA','width_pixels':104,'height':64,'stride_bytes':13,'wall_descriptor':'$8A0F','switch_descriptor':'$88AC','socket_descriptor':'$950D','door_static_descriptor':'$897B','view_offsets':'$8FF7','wall_draw_masks':'$9067','wall_occlusion_masks':'$908E'},
 'levels':{'payload_size':0x08CB,'floor_descriptors':'$022-$03F','map':'$040-$44B','teams':'$44C-$473','monster_count':'$474','monsters':'$475-$714','object_used':'$715-$716','objects':'$717-$816','events':'$817-$8CA'},
 'champions':{'templates':'$9B23','count':16,'stride':'$5A','data_offset':'$2F','inventory_offsets':'$17-$20','quantity_offsets':'$13-$16'},
 'actor':{'masked_bank':'$6D8A-$8277','records':162,'packages':'$8278-$86C3','appearance_body':'$86C4','package_matrix':'$877B','formation':'$87B7'},
 'object':{'codes':'$00-$4B','inventory_graphics':'$649E-$6845','perspective_family':'$6C52','perspective_depth':'$6C9E','perspective_graphic_masks':'$6CE6'},
 'remaining_renderer_gaps':['closed-door procedural geometry portable implementation','dynamic supplement for floor feature masks $28/$30','actor Spectrum colour/attribute assignment','off-axis special/wrapped actor depth routing and live-entity special classes']
}
(OUT/'editor_reference.json').write_text(json.dumps(summary,indent=2)+'\n')
# SHA manifest.
files=sorted(p for p in OUT.iterdir() if p.is_file() and p.name!='SHA256SUMS.txt')
(OUT/'SHA256SUMS.txt').write_text(''.join(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n" for p in files))
print(f'Wrote {len(files)} reference files to {OUT}')
