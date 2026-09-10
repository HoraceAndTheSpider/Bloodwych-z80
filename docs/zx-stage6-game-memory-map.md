# Game TZX Main Memory Map

The main Game TZX code block loads 42,240 bytes at `$5B00-$FFFF`.

Known high-value ranges:

| RAM range | Role |
|---|---|
| `$5B00...` | main executable/data image |
| `$5EA7-$649D` | assorted raw 1-bit graphics |
| `$649E-$6845` | 35 self-describing object/inventory bitmaps |
| `$6846...` | spell/rune definition data begins |
| `$6AF2-$6B3D` | 76 object colour-set selectors |
| `$6B3E-$6BA1` | 25 x four-byte Spectrum attribute sets |
| `$6BA2-$6C39` | 76 normal object graphic pointers |
| `$6C3A-$6C51` | 12 inventory empty-slot/placeholder graphic pointers |
| `$6D8A-$8277` | 162 masked graphics records |
| `$8278...` | actor component package metadata |
| `$877B-$87AA` | 4-facing x 6-word facing/depth package matrix |
| `$8A0F...` | first-person wall pointer/placement tables |
| `$8A5D-$8FF6` | main dungeon wall graphics |
| `$934E-$95F8` | perspective feature-family graphics |
| `$9731-$983E` | normal 5-byte text glyph data |
| `$983F-$9866` | eight spell-rune glyphs |
| `$9B23...` | 16 champion templates, stride `$5A` |
| `$EDF0` | text glyph renderer |
| `$EFE8...` | object renderer |
| `$F097...` | common perspective feature renderer |
| `$F72B...` | low-level masked actor/component draw path |

## Champion templates versus runtime records

The 16 built-in champion templates are static Game-TZX resources. Selection/startup code copies and rearranges champion data for gameplay. Do not assume the post-selection runtime champion structure is byte-identical to the template layout merely because fields overlap semantically.

For editor purposes, treat the `$9B23 + index*$5A` records as the canonical authored Game-TZX champion definitions.
