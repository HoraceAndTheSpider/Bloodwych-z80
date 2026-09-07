#!/usr/bin/env python3
"""Inspect the supplied Bloodwych ZX TAP and verify direct map extraction.

No .dat inputs are used. All offsets are relative to the TAP/custom blocks.
"""
from __future__ import annotations
from pathlib import Path
import argparse

NAMES = dict(zip('defghijklm', ['Keeps','Serpents','Serpent2','Moons','Moon2','Dragons','Dragon2','Archaus','Chaos2','Zendiks']))
HEADER=0x23; BASE=0x41

def read_blocks(path: Path):
    src=path.read_bytes(); p=0; out=[]
    while p+2<=len(src):
        ln=int.from_bytes(src[p:p+2],'little'); prefix=p; p+=2
        raw=src[p:p+ln]; out.append((prefix,p,raw)); p+=ln
    if p!=len(src): raise ValueError('trailing bytes')
    return out

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('tap',type=Path); args=ap.parse_args()
    blocks=read_blocks(args.tap)
    print(f'{len(blocks)} TAP blocks')
    for i,(prefix,fileoff,b) in enumerate(blocks):
        xor=0
        for v in b: xor ^= v
        ident=chr(b[0]) if b and 32<=b[0]<127 else '.'
        print(f'{i:2} file=${fileoff:05X} len={len(b):5} id={ident!r} xor={xor:02X}')
        if ident not in NAMES: continue
        print(f'   {NAMES[ident]} descriptor=${HEADER:02X} map_base=${BASE:02X}')
        for f in range(5):
            q=HEADER+f*6; w,h=b[q],b[q+1]; off=int.from_bytes(b[q+2:q+4],'big'); xo,yo=b[q+4],b[q+5]
            start=BASE+off; cells=w*h; avail=max(0,min(cells,(len(b)-1)-start))
            state='unused' if not cells else ('complete' if avail==cells else f'PARTIAL {avail}/{cells}')
            print(f'     F{f}: {w:2}x{h:<2} offset=${off:04X} align=({xo},{yo}) block=${start:04X} {state}')
if __name__=='__main__': main()
