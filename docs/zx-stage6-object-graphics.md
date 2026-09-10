# Bloodwych ZX Spectrum — Object Graphics and Colour Research

Status: Stage 6 reverse-engineering notes only; new standalone document.

## Confirmed object presentation tables

The ZX object/inventory presentation path covers 76 object codes `$00-$4B`. It uses three source tables:

- `$6BA2`: 76 little-endian graphic pointers (2 bytes per object).
- `$6AF2`: 76 one-byte colour-set selectors.
- `$6B3E`: 25 colour sets, each four Spectrum attribute bytes.

The graphic pointers select 31 of the 35 source records in the `$649E-$6845` bitmap bank; multiple object codes deliberately share source artwork.

## Attribute layout

The renderer applies four attribute bytes across the object's 16x16 pocket cell:

1. lower-left,
2. lower-right,
3. upper-left,
4. upper-right.

Thus colour is definition data, not embedded pixel data. Source object graphics remain 1-bit. All 25 colour sets in this table use black PAPER; INK and BRIGHT vary.

The companion `zx-stage6-object-definitions.csv` records every object code, source graphic pointer, colour-set index and exact attribute bytes.

## Current naming status

This document deliberately identifies objects by ZX code rather than importing Amiga object names. Friendly names should be added only when the ZX object text/definition relationship has been independently proved.

## Coloured review sheet

`bloodwych_zx_all_76_objects_coloured.png` is generated strictly from the three tables above. It is a derivative review image, not an authority.
