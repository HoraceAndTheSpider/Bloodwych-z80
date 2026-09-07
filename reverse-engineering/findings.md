# Confirmed TAP/map findings

This document records findings demonstrated directly against the supplied `Bloodwych [ZX Spectrum].TAP`, rather than external copies or manually extracted `.dat` files.

## TAP structure

The supplied tape has 16 blocks. Blocks 6–15 are custom Bloodwych blocks beginning with ASCII `d` through `m`. All blocks currently validate with XOR 0, including their final checksum byte.

| ID | Viewer name | TAP block |
|---|---|---:|
| d | Keeps | 6 |
| e | Serpents | 7 |
| f | Serpent2 | 8 |
| g | Moons | 9 |
| h | Moon2 | 10 |
| i | Dragons | 11 |
| j | Dragon2 | 12 |
| k | Archaus | 13 |
| l | Chaos2 | 14 |
| m | Zendiks | 15 |

## Floor descriptor table

Within every custom block, five 6-byte floor descriptors begin at block offset `$23`:

```
+0 width
+1 height
+2 floor data offset high byte
+3 floor data offset low byte
+4 X alignment offset
+5 Y alignment offset
```

The floor-data offset is **big-endian**. Map data begins at block offset `$41`, and each floor's byte stream begins at `$41 + floor_data_offset`.

For complete floors the next descriptor's offset equals the current offset plus `width * height`, proving one map byte per cell without a decompression stage at this level.

Example, Keeps:

```
0F 0F 00 00 02 02   # 15×15, data +0000, align +2,+2
13 13 00 E1 00 00   # 19×19, data +00E1
13 13 02 4A 00 00   # 19×19, data +024A
00 00 04 03 00 00
00 00 04 17 00 00
```

The first floor therefore occupies `225 == $E1` bytes and floor 1 starts immediately afterwards.

## Important caveat: Serpents (`e`)

The Serpents descriptor declares floors whose combined cell data extends beyond the physical end of custom TAP block `e`. The editor marks these floors **partial** rather than silently inventing data or applying an unsupported decompression theory. This is a target for loader/Z80 analysis and correlation with `Serpent2`.

## Ancillary data after floors

When a descriptor has `width=height=0`, its offset can still point beyond the last map cell. In Keeps, for example, the first unused descriptor points `$50` bytes after the end of floor 2, and the next points another `$14` bytes later. These offsets appear useful for identifying the non-map per-level tables (switch effects, objects/monsters, etc.) and are deliberately retained in the editor.

## Tile interpretation policy

The viewer uses exact tile meanings only where already correlated by the user, and labels broader patterns as inferred. It does **not** include wooden-wall types; these are not part of the ZX version findings.
