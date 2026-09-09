#!/usr/bin/env python3
"""Audit Bloodwych ZX TAP/TZX data blocks without modifying them."""
from __future__ import annotations
import sys
from pathlib import Path

NAMES = dict(zip('defghijklm', ['Keeps','Serpents','Serpent2','Moons','Moon2','Dragons','Dragon2','Archaus','Chaos2','Zendiks']))

def xor_ok(raw: bytes) -> bool:
    x = 0
    for b in raw: x ^= b
    return x == 0

def parse_tap(data: bytes):
    p=0; n=0
    while p+2 <= len(data):
        rec=p; ln=int.from_bytes(data[p:p+2],'little'); p+=2
        if p+ln > len(data): raise ValueError(f'TAP block {n} overruns file')
        raw=data[p:p+ln]; yield n,p,raw,None,rec; p+=ln; n+=1
    if p != len(data): raise ValueError('Trailing TAP bytes')

def parse_tzx(data: bytes):
    if data[:8] != b'ZXTape!\x1a': raise ValueError('Bad TZX header')
    p=10; n=0
    while p < len(data):
        rec=p; bid=data[p]; p+=1
        if bid == 0x30:
            ln=data[p]; p+=1+ln
        elif bid == 0x10:
            pause=int.from_bytes(data[p:p+2],'little'); ln=int.from_bytes(data[p+2:p+4],'little'); p+=4
            if p+ln > len(data): raise ValueError(f'TZX $10 block at {rec:#x} overruns file')
            raw=data[p:p+ln]; yield n,p,raw,pause,rec; p+=ln; n+=1
        else:
            raise ValueError(f'Unsupported TZX block {bid:#04x} at {rec:#x}')

def main(path: str) -> int:
    data=Path(path).read_bytes(); is_tzx=data[:8]==b'ZXTape!\x1a'
    print(f'{Path(path).name}: {"TZX" if is_tzx else "TAP"}, {len(data)} bytes')
    parser=parse_tzx if is_tzx else parse_tap
    found=0
    for i,off,raw,pause,rec in parser(data):
        flag=chr(raw[0]) if raw and 32 <= raw[0] < 127 else f'${raw[0]:02X}' if raw else 'empty'
        print(f'data {i:02}: file ${off:05X}, len {len(raw):4}, flag {flag!s:>3}, xor {"OK" if xor_ok(raw) else "BAD"}' + (f', pause {pause}ms' if pause is not None else ''))
        if raw and chr(raw[0]) in NAMES:
            found+=1; ident=chr(raw[0]); print(f'  {ident} {NAMES[ident]}')
            for fi in range(5):
                q=0x23+fi*6
                w,h=raw[q],raw[q+1]; rel=int.from_bytes(raw[q+2:q+4],'big'); xo,yo=raw[q+4],raw[q+5]
                cells=w*h; start=0x41+rel; avail=max(0,min(cells,(len(raw)-1)-start))
                state='unused' if not cells else ('complete' if avail==cells else f'PARTIAL {avail}/{cells}')
                print(f'    F{fi}: {w:2}x{h:<2} rel ${rel:04X} align +{xo},{yo} -> {state}')
    print(f'Bloodwych d-m blocks found: {found}')
    return 0

if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1] if len(sys.argv)>1 else 'data/Bloodwych - Level Data [ZX Spectrum].tzx'))
