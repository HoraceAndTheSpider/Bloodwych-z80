#!/usr/bin/env python3
"""Portable source-driven graphics renderer for Bloodwych ZX Spectrum.

The routines reproduce the proved data-paths used by the Game TZX rather than
scaling editor artwork.  The dungeon wall/feature path mirrors Z80 $F097; the
masked sprite path is a pixel-equivalent implementation of the $F72B/$F80F
image+explicit-mask compositors.

Current scope:
* inventory object source graphics + Spectrum object attributes;
* champion portraits;
* wall/background perspective and wall switch/socket overlays;
* static floor-feature descriptors;
* floor-object perspective graphics and four sub-cell positions;
* actor/champion/monster appearance component construction at near/mid/far.

Closed-door procedural bars/panels and final actor colour/attribute assignment
remain documented as OPEN renderer supplements.  The static door overlay is
available and can be previewed.
"""
from __future__ import annotations
import argparse
from pathlib import Path
from typing import Iterable
from PIL import Image, ImageDraw, ImageFont

from zx_editor_model import GameImage, LevelPayload, s8

W, H = 104, 64
STRIDE = 13

# Z80-proved tables/ranges.
WALL_DESC = 0x8A0F
SWITCH_DESC = 0x88AC
SOCKET_DESC = 0x950D
DOOR_DESC = 0x897B
FLOOR_FEATURE_DESC = {0x08: 0x940D, 0x18: 0x92FE, 0x20: 0x938D,
                      0x28: 0x92FE, 0x30: 0x938D, 0x38: 0x948D}
VIEW_OFFSET_TABLE = 0x8FF7
WALL_DRAW_MASKS = 0x9067
WALL_OCCLUSION_MASKS = 0x908E
CEILING_SOURCE = 0x90B5
FLOOR_SOURCE = 0x9214
ACTOR_PACKAGE_MATRIX = 0x877B
ACTOR_DEPTHS = 0x87CF
ACTOR_COORDS = 0x87E3
OBJECT_POSITION_TABLES = 0x8809
OBJECT_Y_ADJUST = 0x9657
OBJECT_FAMILY = 0x6C52
OBJECT_DEPTH_GRAPHICS = 0x6C9E
OBJECT_GRAPHIC_MASK = 0x6CE6

SLOT_TO_SAMPLE = [0,1,1,2,2,3,3,4,5,6,6,7,7,8,8,9,10,11,12]
CENTER_SLOTS = {"far": 16, "middle": 17, "near": 18}

OBJECT_NAMES = [
"Empty","Coinage","Common Keys","Arrows","Elf Arrows","Drink (< half)","Drink (half)","Drink (full)",
"Food (partial)","Food (half)","Food (full)","N'Egg Green","N'Egg Blue","N'Egg Red","Snake Slime","Brimstone Ale",
"Dragon Broth","Moon Elixir","Leathers","Chain Mail","Plate Mail","Mithril Chain","Mithril Plate","Adamant Chain",
"Adamant Plate","Crystal Chain","Crystal Plate","Hide Shield","Buckler","Rune Shield","Large Shield","Moon Shield",
"Dragon Shield","War Shield","Dagger","Stealth Blade","Short Sword","Long Sword","Mithril Sword","Fleshbane",
"Demon Blade","Ace of Swords","Battle Axe","Mithril Axe","Troll's Axe","Brainbiter","Deathbringer","Staff",
"Battle Staff","Power Staff","Long Bow","Frost Bow","Crossbow","Snake Gem","Chaos Gem","Dragon Gem","Moon Gem",
"Tan Gem","Bluish Gem","Snake Key","Moon Key","Dragon Key","Chaos Key","Chromatic Key","Snake Wand",
"Chaos Wand","Dragon Wand","Moon Wand","Heal Wand","Yes Ring","Snake Ring","Chaos Ring","Dragon Ring","Moon Ring",
"Player 1 remains","Player 2 remains"
]

ZX_NORMAL = [(0,0,0),(0,0,192),(192,0,0),(192,0,192),(0,192,0),(0,192,192),(192,192,0),(192,192,192)]
ZX_BRIGHT = [(0,0,0),(0,0,255),(255,0,0),(255,0,255),(0,255,0),(0,255,255),(255,255,0),(255,255,255)]


def zx_ink(attr: int):
    return (ZX_BRIGHT if attr & 0x40 else ZX_NORMAL)[attr & 7]


def bitreverse(v: int) -> int:
    v = ((v & 0xF0) >> 4) | ((v & 0x0F) << 4)
    v = ((v & 0xCC) >> 2) | ((v & 0x33) << 2)
    return ((v & 0xAA) >> 1) | ((v & 0x55) << 1)


def f097_transform(s: int, dst: int) -> int:
    """Exact byte transform at Z80 $F119-$F12D."""
    b = s
    c = s & 0xAA
    a = ((~s) & 0x55)
    a = ((a << 1) | (a >> 7)) & 0xFF
    c = a ^ c
    a = ((c >> 1) | ((c & 1) << 7)) & 0xFF
    c = a | c
    b = c & b
    return (((~c) & 0xFF) & dst) | b


class MonoBuffer:
    """Linear 104x64 game work buffer, row 0 at the top."""
    def __init__(self): self.data = bytearray(STRIDE * H)
    def copy(self):
        o = MonoBuffer(); o.data[:] = self.data; return o
    def get_pixel(self,x,y):
        if not (0 <= x < W and 0 <= y < H): return 0
        return (self.data[y*STRIDE+x//8] >> (7-(x&7))) & 1
    def set_pixel(self,x,y,v):
        if not (0 <= x < W and 0 <= y < H): return
        p=y*STRIDE+x//8; mask=1<<(7-(x&7))
        if v: self.data[p]|=mask
        else: self.data[p]&=(~mask)&0xFF
    def to_image(self, scale=1, ink=(255,255,255), paper=(0,0,0)):
        im=Image.new('RGB',(W,H),paper); px=im.load()
        for y in range(H):
            for x in range(W):
                if self.get_pixel(x,y): px[x,y]=ink
        if scale != 1: im=im.resize((W*scale,H*scale),Image.Resampling.NEAREST)
        return im


class Renderer:
    def __init__(self, game: GameImage): self.g = game
    def b(self,a): return self.g.byte(a)
    def w(self,a): return self.g.word(a)
    def raw(self,a,n): return self.g.slice(a,a+n)

    def record(self, ptr: int):
        wb=self.b(ptr); h=self.b(ptr+1); data=self.raw(ptr+2,wb*h)
        return wb,h,data

    def descriptor(self, base: int, slot: int):
        return self.w(base+2*slot), self.b(base+0x28+2*slot), self.b(base+0x29+2*slot)

    def draw_f097(self, buf: MonoBuffer, desc: int, slot: int):
        """Portable equivalent of the generic dungeon renderer at $F097."""
        gp,x,y=self.descriptor(desc,slot)
        wb,h,data=self.record(gp)
        if gp == 0x88A9: return
        mirror = 8 <= slot < 16
        pair = slot >= 16
        def one(x0,y0,mir):
            for sy in range(h):
                if not 0 <= y0+sy < H: continue
                for bx in range(wb):
                    sb=data[sy*wb+bx]
                    if mir: sb=bitreverse(sb); dx=x0+(wb-1-bx)
                    else: dx=x0+bx
                    if 0 <= dx < STRIDE:
                        p=(y0+sy)*STRIDE+dx
                        buf.data[p]=f097_transform(sb,buf.data[p])
        one(x,y,mirror)
        if pair:
            # Z80 $F0EC-$F0FF derives the mirrored companion destination.
            one(STRIDE-x-wb,y+1,True)

    def make_background(self, player_x: int, player_y: int, facing: int) -> MonoBuffer:
        """$B613-$B67A: clear work area and build checker/parity ceiling+floor."""
        out=MonoBuffer()
        parity=(player_x+player_y+facing)&1
        ceiling=self.raw(CEILING_SOURCE,0x15F) # 27*13
        floor=self.raw(FLOOR_SOURCE,0xEA)       # 18*13
        if parity:
            out.data[0:0x15F]=ceiling
            out.data[46*STRIDE:64*STRIDE]=floor
        else:
            for r in range(27):
                row=ceiling[r*STRIDE:(r+1)*STRIDE]
                out.data[r*STRIDE:(r+1)*STRIDE]=bytes(bitreverse(v) for v in row[::-1])
            for r in range(18):
                row=floor[r*STRIDE:(r+1)*STRIDE]
                p=(46+r)*STRIDE
                out.data[p:p+STRIDE]=bytes(bitreverse(v) for v in row[::-1])
        return out

    def sample_offsets(self, facing: int):
        p=VIEW_OFFSET_TABLE+(facing&3)*28
        return [(s8(self.b(p+2*i)),s8(self.b(p+2*i+1))) for i in range(14)]

    def wall_masks(self):
        draws=[]; occ=[]
        for i in range(13):
            q=WALL_DRAW_MASKS+i*3
            draws.append((self.b(q)<<16)|(self.b(q+1)<<8)|self.b(q+2))
            q=WALL_OCCLUSION_MASKS+i*3
            occ.append((self.b(q)<<16)|(self.b(q+1)<<8)|self.b(q+2))
        return draws,occ

    @staticmethod
    def _is_wall(cell: int) -> bool:
        return (cell & 3) == 3

    @staticmethod
    def _wall_overlay(cell: int):
        if (cell & 3) != 3: return None
        feature=(cell>>3)&0x0F
        if 8 <= feature <= 11: return SWITCH_DESC, feature&3, 'switch'
        if 4 <= feature <= 7: return SOCKET_DESC, feature&3, 'empty-socket'
        if 12 <= feature <= 15: return SOCKET_DESC, feature&3, 'filled-socket'
        return None

    @staticmethod
    def overlay_face_for_slot(slot: int, player_facing: int) -> int:
        # $BE39 rolling bitfield produces this 19-slot side/front sequence.
        seq=(1,0,1,0,1,0,1,1,1,0,1,0,1,0,1,1,1,1,1)
        side=seq[slot]
        if slot < 8:
            return (player_facing + (1 if side else 2)) & 3
        if slot < 16:
            return (player_facing + (3 if side else 2)) & 3
        return (player_facing+2)&3

    def masked_record(self, graphic_ptr: int, mask_ptr: int):
        wb=self.b(graphic_ptr); h=self.b(graphic_ptr+1)
        image=self.raw(graphic_ptr+2,wb*h)
        mask=self.raw(mask_ptr,wb*h)
        return wb,h,image,mask

    def draw_masked(self,buf:MonoBuffer,graphic_ptr:int,mask_ptr:int,xleft:int,ytop:int,mirror=False):
        """Pixel-equivalent of $F72B/$F80F using explicit package mask pointer.

        The masked actor/object records are stored bottom-to-top. The native
        routine walks the record in its storage order while its vertical setup
        yields the same displayed result; reversing source rows here is the
        clearest portable equivalent.
        """
        wb,h,img,mask=self.masked_record(graphic_ptr,mask_ptr)
        for dy in range(h):
            sy=h-1-dy
            for sx in range(wb*8):
                srcx=wb*8-1-sx if mirror else sx
                bt=srcx//8; bit=7-(srcx&7)
                ib=(img[sy*wb+bt]>>bit)&1
                mb=(mask[sy*wb+bt]>>bit)&1
                if not mb: buf.set_pixel(xleft+sx,ytop+dy,ib)

    def object_depth_class(self, slot:int)->int:
        return self.b(ACTOR_DEPTHS+slot)&3

    @staticmethod
    def rotate_object_position(position:int,facing:int)->int:
        table=((0,1,2,3),(1,3,0,2),(3,2,1,0),(2,0,3,1))
        return table[facing&3][position&3]

    def object_graphic(self,code:int,slot:int):
        family=self.b(OBJECT_FAMILY+code)
        depth=self.object_depth_class(slot)
        gi=self.b(OBJECT_DEPTH_GRAPHICS+family*4+depth)
        p=OBJECT_GRAPHIC_MASK+gi*4
        return family,depth,gi,self.w(p),self.w(p+2)

    def draw_floor_object(self,buf:MonoBuffer,code:int,position:int,slot:int,player_facing:int):
        pos=self.rotate_object_position(position,player_facing)
        q=OBJECT_POSITION_TABLES+pos*40+slot*2
        cx=s8(self.b(q)); cy=self.b(q+1)
        family,depth,gi,gp,mp=self.object_graphic(code,slot)
        wb,h,_=self.record(gp)
        xleft=cx-4*wb
        yadj=self.b(OBJECT_Y_ADJUST+2*depth+(1 if pos<2 else 0))
        ytop=cy+yadj-(h//2 if h>1 else 0)
        self.draw_masked(buf,gp,mp,xleft,ytop,False)
        return {"family":family,"depth":depth,"graphic_index":gi,"graphic":gp,"mask":mp,
                "position":pos,"xleft":xleft,"ytop":ytop}

    def draw_floor_feature(self,buf:MonoBuffer,cell:int,slot:int):
        key=cell&0x38
        desc=FLOOR_FEATURE_DESC.get(key)
        if desc is not None: self.draw_f097(buf,desc,slot)
        return desc

    def draw_door_static(self,buf:MonoBuffer,slot:int):
        """Draw only the static door overlay at $897B.

        Closed-door procedural geometry from $BBF3-$BD12 is intentionally not
        approximated; it remains a documented supplement.
        """
        self.draw_f097(buf,DOOR_DESC,slot)

    def _appearance_vector(self,appearance:int,depth:int):
        direct=list(self.raw(0x86C4,25))
        selectors=[list(self.raw(0x86DD,25)),list(self.raw(0x8729,25)),list(self.raw(0x8757,25))]
        widths=[self.b(0x86F6),self.b(0x8742),self.b(0x8770)]
        starts=[0x86F7,0x8743,0x8771]
        if 1 <= appearance <= 25:
            body=direct[appearance-1]; si=appearance-1
        elif appearance >= 0x1A:
            n=appearance-0x1A; body=n&7
            si=((n>>3)&0x1F) if depth<2 else (1 if body<6 else 2)
        else:
            raise ValueError("appearance 0 is not a normal compositor identity")
        width=widths[depth]
        if not 0 <= si < len(selectors[depth]):
            raise ValueError("appearance selects beyond proved identity table")
        # The source has ten rows. Encoded forms use body 0..7.
        row=list(self.raw(starts[depth]+body*width,width))
        row[width//2]=selectors[depth][si]
        return row,body,si

    def _package_groups(self,image_base:int,mask_base:int):
        p=image_base; groups=[]
        while True:
            count=self.b(p); p+=1
            if count==0: break
            row=[]
            for _ in range(count):
                row.append((s8(self.b(p)),s8(self.b(p+1)),self.w(p+2)));p+=4
            groups.append(row)
        mp=mask_base;masks=[]
        for row in groups:
            masks.append([self.w(mp+2*i) for i in range(len(row))]);mp+=2*len(row)
        return groups,masks

    def actor_package_row(self,actor_orientation:int,player_facing:int)->int:
        """Replicate $B86B row selection (3,2,1,0 according relative facing)."""
        a=player_facing&3
        for b in (3,2,1):
            if a==(actor_orientation&3): return b
            a=(a-1)&3
        return 0

    def draw_actor(self,buf:MonoBuffer,appearance:int,package_row:int,slot:int,pose_phase:int=0,
                   coords_base:int=ACTOR_COORDS):
        """Compose one source appearance at a perspective slot.

        package_row is the compositor's 0..3 relative-facing row. For an
        authored actor orientation use actor_package_row().  pose_phase is the
        proved +$0E bit-1 input; this portable catalogue currently preserves it
        as metadata but uses the ordinary vector selectors because the exact
        phase perturbation is a separate live-state animation detail.
        """
        depth_map={18:0,17:1,16:2}
        depth=depth_map.get(slot)
        if depth is None:
            raw=self.b(ACTOR_DEPTHS+slot)
            if raw not in (1,2,3):
                raise ValueError("off-axis actor package routing uses wrapped special depth codes; use central slots for catalogue")
            depth=raw-1
        rowbase=ACTOR_PACKAGE_MATRIX+package_row*12
        ib=self.w(rowbase+depth*2); mb=self.w(rowbase+(depth+3)*2)
        groups,masks=self._package_groups(ib,mb)
        vec,body,selector=self._appearance_vector(appearance,depth)
        cx=s8(self.b(coords_base+slot*2)); cy=self.b(coords_base+slot*2+1)
        used=[]
        for gi,choices in enumerate(groups):
            choice=(vec[gi] if gi<len(vec) else 1)-1
            if not 0 <= choice < len(choices): continue
            x,y,gp=choices[choice]; mp=masks[gi][choice]
            # $B86B: row0 retains initial positive=mirrored / negative=normal;
            # rows1-3 exchange the two calls.
            mirror=(y>=0) if package_row==0 else (y<0)
            self.draw_masked(buf,gp,mp,cx+x,cy+abs(y),mirror)
            used.append((gi,choice,gp,mp,x,y,mirror))
        return {"depth":depth,"body":body,"selector_index":selector,"vector":vec,"components":used}

    def render_scene(self,level:LevelPayload,floor:int,x:int,y:int,facing:int,
                     include_objects=True,include_static_doors=True,include_actors=False):
        """Render the proved static dungeon layers for one player view.

        Wall occlusion, wall overlays, floor features and floor objects follow
        source painter order. Procedural closed-door geometry and actor colour
        attributes are deliberately isolated rather than guessed.
        """
        buf=self.make_background(x,y,facing)
        offsets=self.sample_offsets(facing)
        cells=[]
        for i,(dx,dy) in enumerate(offsets[:13]):
            try: v=level.cell(floor,x+dx,y+dy)
            except IndexError: v=0x03 # outside floor behaves as opaque wall for preview
            cells.append(v)
        draws,occs=self.wall_masks(); visible=(1<<19)-1; wallbits=0
        for i,v in enumerate(cells):
            if self._is_wall(v):
                wallbits |= draws[i]
                visible &= occs[i]
        wallbits &= visible
        # Pre-index object stacks for source map cells.
        stacks_by_loc={}
        if include_objects:
            for st in level.object_stacks():
                if st['location'] is not None: stacks_by_loc.setdefault(tuple(st['location']),[]).append(st)
        for slot,sample in enumerate(SLOT_TO_SAMPLE):
            if not (visible>>slot)&1: continue
            dx,dy=offsets[sample]; sx,sy=x+dx,y+dy; cell=cells[sample]
            if (wallbits>>slot)&1:
                self.draw_f097(buf,WALL_DESC,slot)
                ov=self._wall_overlay(cell)
                if ov and ov[1]==self.overlay_face_for_slot(slot,facing):
                    self.draw_f097(buf,ov[0],slot)
                continue
            base=cell&3
            if base==1: self.draw_floor_feature(buf,cell,slot)
            sts=stacks_by_loc.get((floor,sx,sy),[])
            # Game draws back mini-positions 2/3 before the door.
            for st in sts:
                if st['position'] in (2,3):
                    for code,state in st['items']: self.draw_floor_object(buf,code,st['position'],slot,facing)
            if base==2 and include_static_doors: self.draw_door_static(buf,slot)
            for st in sts:
                if st['position'] in (0,1):
                    for code,state in st['items']: self.draw_floor_object(buf,code,st['position'],slot,facing)
            # Actor layer intentionally optional until colour/special off-axis path is finished.
        return buf

    def render_inventory_object(self,code:int,scale=4):
        gp=self.w(0x6BA2+2*code); wb,h,data=self.record(gp)
        sel=self.b(0x6AF2+code); attrs=list(self.raw(0x6B3E+sel*4,4))
        # Inventory record source is consumed top-to-bottom by its raw blitter.
        im=Image.new('RGB',(wb*8,h),(0,0,0)); px=im.load()
        for yy in range(h):
            for xx in range(wb*8):
                if (data[yy*wb+xx//8]>>(7-(xx&7)))&1:
                    # Four attrs correspond quadrants; choose by half width/height.
                    q=(0 if yy>=h/2 else 2)+(1 if xx>=wb*4 else 0)
                    px[xx,yy]=zx_ink(attrs[q])
        return im.resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST)

    def render_champion_portrait(self,index:int,scale=4):
        p=0x9B23+index*0x5A; data=self.raw(p,30)
        im=Image.new('1',(16,15),1); px=im.load()
        for y in range(15):
            for x in range(16):
                if (data[y*2+x//8]>>(7-(x&7)))&1: px[x,y]=0
        return im.resize((16*scale,15*scale),Image.Resampling.NEAREST)


def label_sheet(images, labels, cols, cell_w, cell_h, out):
    rows=(len(images)+cols-1)//cols
    sheet=Image.new('RGB',(cols*cell_w,rows*cell_h),'white'); d=ImageDraw.Draw(sheet)
    for i,im in enumerate(images):
        x=(i%cols)*cell_w;y=(i//cols)*cell_h
        sheet.paste(im,(x+(cell_w-im.width)//2,y+12))
        d.text((x+2,y+1),labels[i],fill='black')
    sheet.save(out)


def main():
    ap=argparse.ArgumentParser(); ap.add_argument('game',type=Path)
    ap.add_argument('--level',type=Path); ap.add_argument('--out',type=Path,default=Path('renders'))
    args=ap.parse_args();args.out.mkdir(parents=True,exist_ok=True)
    game=GameImage.from_file(args.game); r=Renderer(game)
    # Object catalogue.
    ims=[r.render_inventory_object(i,3) for i in range(0x4C)]
    label_sheet(ims,[f'{i:02X} {OBJECT_NAMES[i]}' for i in range(0x4C)],8,150,72,args.out/'objects_inventory.png')
    # Champion portraits.
    ims=[r.render_champion_portrait(i,3).convert('RGB') for i in range(16)]
    label_sheet(ims,[f'{i+1:02X} {game.champion_name(i)}' for i in range(16)],4,210,70,args.out/'champion_portraits.png')
    # Actor/monster appearance catalogues for central near/middle/far positions.
    for depth_name,slot in CENTER_SLOTS.items():
        ims=[]; labs=[]
        for app in range(1,0x9A):
            cell=Image.new('RGB',(104*2,64*2),'white')
            # front-facing and back-facing package rows are most identifiable; include all four in a strip.
            strip=Image.new('1',(104*4,64),1)
            for pr in range(4):
                b=MonoBuffer(); r.draw_actor(b,app,pr,slot); strip.paste(b.to_image(1).convert('1'),(pr*104,0))
            # downscale full strip to fit 208px cell while retaining nearest-neighbour pixels.
            cell=strip.convert('RGB').resize((208,32),Image.Resampling.NEAREST)
            ims.append(cell);labs.append(f'appearance ${app:02X} rows 0/1/2/3')
        label_sheet(ims,labs,6,220,48,args.out/f'actor_appearances_{depth_name}_01_99.png')
    if args.level:
        lv=LevelPayload.from_file(args.level)
        p1=tuple(lv.data[:3]);
        for facing in range(4):
            b=r.render_scene(lv,p1[2],p1[0],p1[1],facing)
            b.to_image(6).save(args.out/f'keeps_p1_start_facing{facing}.png')

if __name__=='__main__': main()
