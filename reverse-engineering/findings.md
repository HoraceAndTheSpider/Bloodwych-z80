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

## 2026-09-08 — TZX resolves fixed loader length

The supplied `Bloodwych - Level Data.tzx` is TZX v1.10 and contains a text-description block followed by ten `$10` Standard Speed Data blocks. Every Bloodwych block `d` through `m` is exactly 2253 bytes: one flag byte, `$08CB` (2251) data bytes, and one Spectrum XOR parity byte. This exactly matches the Z80 level-loader's fixed `LD DE,$08CB` before its ROM tape-load call.

The previously supplied combined TAP does **not** preserve all of those bytes. Relative to the TZX:

- `d`, `g`, `h`, `i`, `j`, `k`, `l` are complete/equal;
- TAP `e` is only 807 bytes instead of 2253;
- TAP `f` is 1861 bytes instead of 2253;
- TAP `m` is 1574 bytes instead of 2253.

For each shortened TAP block, bytes up to its penultimate byte match the TZX, while the TAP's final byte is already its parity byte at a point where the TZX continues with real level data. Therefore these are genuine shortened tape records, not merely trailing-FF trimming. In `e`, the shortening cuts into floors declared by the descriptor table.

This resolves the earlier apparent contradiction between the fixed loader size and the TAP. For reverse engineering and level editing, the Level Data TZX should now be treated as the authoritative supplied tape source. The combined TAP remains useful as a compatibility/reference image, but stricter emulator rejection is unsurprising.
