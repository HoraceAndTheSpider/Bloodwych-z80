#!/usr/bin/env python3
from pathlib import Path
import hashlib,sys,tempfile
sys.path.insert(0,str(Path(__file__).resolve().parent))
from zx_editor_model import GameImage,LevelPayload,MONSTER_BASE,MONSTER_SIZE
from zx_render import Renderer,MonoBuffer

ROOT=Path(__file__).resolve().parents[1]
GAME=ROOT/'data/extracts/game/Game_Main_5B00_FFFF.bin'
KEEPS=ROOT/'data/extracts/levels/d-Keeps/LevelPayload.bin'

def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def changed(a,b):return [i for i,(x,y) in enumerate(zip(a,b)) if x!=y]

def main():
    lines=[]
    def ok(name, detail=''):
        lines.append(f'PASS {name}' + (f' — {detail}' if detail else ''))
    assert GAME.stat().st_size==0xA500;ok('Game loaded image size','$A500 bytes')
    assert sha(GAME)=='6be0bb5b57ea3a0b7b07bf00fa60c8a929c98c3df749f34d882ad50c319e888b';ok('Game image SHA-256')
    assert KEEPS.stat().st_size==0x08CB;ok('Keeps Level payload size','$08CB bytes')
    g=GameImage.from_file(GAME);lv=LevelPayload.from_file(KEEPS);r=Renderer(g)

    # Exact masked bank parse.
    p=0x6D8A;n=0
    while p<0x8278:
        wb=g.byte(p);h=g.byte(p+1);p+=2+2*wb*h;n+=1
    assert p==0x8278 and n==162;ok('Masked bank sequential parse','162 records; exact $8278 boundary')
    assert g.slice(0x8274,0x8278)==bytes.fromhex('010100ff');ok('Transparent dummy record','$8274 = 01 01 00 FF')

    # Starting inventory patch should be one authored byte only.
    original=bytes(g.data);old=g.starting_pockets(0)[0];g.set_starting_pocket(0,0,0x22)
    diff=changed(original,g.data);expected=(0x9B23-0x5B00)+0x2F+0x17
    assert diff==[expected];ok('Starting pocket semantic write','exactly one champion payload byte changed')
    g.data[:]=original;assert bytes(g.data)==original;ok('Starting pocket undo','byte-identical restore')

    # Team invariants in the actual Keeps payload.
    errs=lv.validate_editor_coupling();assert not errs,errs;ok('Keeps team/occupancy invariants','all authored teams consistent')
    assert lv.team(0)==[3,4,0xFF,0xFF]
    assert lv.monster(3).team_field==0 and lv.monster(4).x==0xFF;ok('Keeps team 0 representation','leader 3, secondary 4')

    # Find a free object-bearing cell and verify team move preserves object bit2.
    dest=None
    for f in lv.floors():
        if not f.used:continue
        for y in range(f.height):
            for x in range(f.width):
                v=lv.cell(f.index,x,y)
                if (v&3)!=2 and (v&4) and not (v&0x80):
                    dest=(f.index,x,y,v);break
            if dest:break
        if dest:break
    assert dest is not None
    test=LevelPayload(bytes(lv.data));m=test.monster(3);oldloc=(m.floor,m.x,m.y);affected=test.move_monster_or_team(3,dest[1],dest[2],dest[0])
    assert affected==[3,4]
    assert test.monster(4).x==0xFF and (test.monster(4).y,test.monster(4).floor)==(dest[2],dest[0])
    assert test.cell(dest[0],dest[1],dest[2])&0x84==0x84;ok('Team semantic move','secondary inherited context + object bit2 + occupancy preserved')
    assert not test.validate_editor_coupling(),test.validate_editor_coupling();ok('Post-move team invariants')

    # Switch/socket overlays must materially change the source-derived wall view.
    p1x,p1y,p1f=lv.data[0],lv.data[1],lv.data[2]
    def synth(v):
        q=LevelPayload(bytes(lv.data));q.set_cell(p1f,p1x,p1y+1,v)
        return bytes(r.render_scene(q,p1f,p1x,p1y,2,include_objects=False).data)
    plain=synth(0x03);sw=synth(0x43);sock=synth(0x23)
    assert plain!=sw and plain!=sock and sw!=sock;ok('Wall overlay compositor','switch $88AC and socket $950D alter wall bitmap')

    # Perspective object and actor renders should consume real masked data.
    b=MonoBuffer();meta=r.draw_floor_object(b,0x22,0,18,0)
    assert any(b.data) and meta['graphic']>=0x6D8A;ok('Perspective object render','Dagger uses native family/depth/mask chain')
    b=MonoBuffer();meta=r.draw_actor(b,1,1,18)
    assert any(b.data) and len(meta['components'])>0;ok('Actor compositor','appearance $01 near row1 composed from package graphics/masks')

    # Stable proof hashes, useful when porting to JS.
    scene=r.render_scene(lv,p1f,p1x,p1y,0)
    lines.append('HASH Keeps P1 facing0 work-buffer SHA256 '+hashlib.sha256(scene.data).hexdigest())
    b=MonoBuffer();r.draw_actor(b,1,1,18)
    lines.append('HASH appearance01 near row1 work-buffer SHA256 '+hashlib.sha256(b.data).hexdigest())
    text='\n'.join(lines)+'\n'
    print(text,end='')
    (ROOT/'tests/selftest-results.txt').write_text(text)

if __name__=='__main__':main()
