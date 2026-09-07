#!/usr/bin/env python3
"""Extract raw Bloodwych custom blocks and physically-present floor bytes from TAP."""
from pathlib import Path
import argparse, json
NAMES = dict(zip('defghijklm', ['Keeps','Serpents','Serpent2','Moons','Moon2','Dragons','Dragon2','Archaus','Chaos2','Zendiks']))
HEADER=0x23; BASE=0x41

def blocks(src):
    p=0; i=0
    while p+2<=len(src):
        ln=int.from_bytes(src[p:p+2],'little'); p+=2; raw=src[p:p+ln]; yield i,p,raw; p+=ln;i+=1

def main():
    ap=argparse.ArgumentParser();ap.add_argument('tap',type=Path);ap.add_argument('out',type=Path);a=ap.parse_args();a.out.mkdir(parents=True,exist_ok=True)
    manifest=[]
    for bi,fileoff,b in blocks(a.tap.read_bytes()):
        if not b: continue
        ident=chr(b[0])
        if ident not in NAMES: continue
        stem=f'{ident}-{NAMES[ident]}'
        (a.out/f'{stem}.block.bin').write_bytes(b)
        t={'id':ident,'name':NAMES[ident],'tap_block':bi,'file_offset':fileoff,'floors':[]}
        for fi in range(5):
            q=HEADER+fi*6;w,h=b[q],b[q+1];off=int.from_bytes(b[q+2:q+4],'big');xo,yo=b[q+4],b[q+5];cells=w*h;start=BASE+off;avail=max(0,min(cells,(len(b)-1)-start));raw=b[start:start+avail]
            if cells:(a.out/f'{stem}.floor{fi}.bin').write_bytes(raw)
            t['floors'].append({'floor':fi,'width':w,'height':h,'offset':off,'x_offset':xo,'y_offset':yo,'available':avail,'complete':avail==cells if cells else True})
        manifest.append(t)
    (a.out/'manifest.json').write_text(json.dumps(manifest,indent=2))
if __name__=='__main__':main()
