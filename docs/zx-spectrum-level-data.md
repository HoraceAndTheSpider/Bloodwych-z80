# Bloodwych ZX Spectrum — Level Data Format

## Authority

The complete Level Data TZX is the Stage 5 source authority. Each `d..m` block contains one Spectrum flag byte, `$08CB` loaded payload bytes and one XOR parity byte.

Payload offsets below exclude the Spectrum flag byte.

## Top-level payload

```text
$000-$005  P1/P2 starts
$006-$015  crystal/socket special packed locations
$016-$01D  two paired teleport-gem records
$01E       progression field on non-final levels; Zendik exceptional
$01F       segment number
$020-$021  runtime scratch/state
$022-$03F  five floor descriptors
$040-$44B  $40C map workspace
$44C-$473  10 × 4 monster team-member table
$474       monster count/state
$475-$714  42 × 16-byte monster records
$715-$716  object used length, little-endian
$717-$816  256-byte packed object arena
$817-$8CA  45 × 4-byte unified event/action area
```

Zendik uses normal Event slots 0-35 and reuses slots 36-44 for the ending message `ACCURSED MORTALS, I SHALL RETURN`.

## Runtime relocation

The first six loaded bytes are handled separately. For loaded offsets `$006+`:

```text
runtime address = $9DBD + loaded offset
```

Useful anchors:

```text
$022 -> $9DDF floor descriptors
$040 -> $9DFD map workspace
$474 -> $A231 monster count/state
$475 -> $A232 monster allocation
$715 -> $A4D2 object used length
$717 -> $A4D4 object arena
$817 -> $A5D4 Event table
$8A7 -> $A664 Zendik ending text / Event slot 36
```

## Floor descriptors

Five descriptors at `$022-$03F`, six bytes each:

```text
+0 width
+1 height
+2/+3 map-workspace data offset, big-endian
+4 X alignment
+5 Y alignment
```

Stage 5 validates active floor geometry against the fixed `$40C` map workspace. Descriptor editing changes geometry/alignment only; it does not rearrange map bytes automatically.

## Map byte

Working model:

```text
bits 0-1  base cell type
bit 2     object-stack-present
bits 3-6  feature/orientation/state
bit 7     occupied/actor state
```

Working base types:

```text
0 floor/space
1 floor feature
2 door
3 wall
```

Bit 2 is persistent/required with object stacks and is maintained semantically by Stage 5. Bit 7 is at least partly runtime-normalised from monster data, but Stage 5 also maintains it conservatively during semantic positioned-monster moves.

## Object arena

```text
$715-$716 used length, little-endian
$717-$816 256-byte fixed arena
```

Packed stack:

```text
+0/+1 packed location
+2    object count
+3/+4 object code / quantity-or-state
+5/+6 next object code / quantity-or-state
...
```

Location:

```text
mini_position = byte0 >> 6
map_offset    = ((byte0 & $3F) << 8) | byte1
```

The bytes after used length are not regenerated. Stage 5 writes only the packed prefix required by the new used length, preserving the remainder of the arena exactly.

## Unified Events

See `zx-level-event-actions.md`. Source locations are explicit map-workspace offsets. Sequential map encounter order is not part of the ZX format.

## Monsters / teams

See `zx-monster-records.md`. The 40-byte area is 10 rows × four monster record indexes, with `$FF` representing an empty member slot. Secondary members may use X=`$FF`.

## Special records

### Crystal/socket locations `$006-$015`

The eight two-byte entries form four pairs. **STRONG / data-derived:** cross-correlation of every non-zero entry in the authoritative TZX gives the Stage 5 working decode:

```text
byte 0       map-workspace offset bits 0-7
byte 1 & $0F map-workspace offset bits 8-11
byte 1 >> 4  raw variant nibble

map_offset = ((byte1 & $0F) << 8) | byte0
$0000      = unused entry
```

Every non-zero record across the ten supplied level blocks resolves to an active floor cell through the floor descriptors. This makes floor/X/Y relocation safe for the editor. The high-nibble variant is retained numerically because its exact gameplay/directional naming is not yet proved.

Stage 5 therefore edits these records as active/inactive + floor/X/Y + raw variant and recomputes the packed bytes. The original packed bytes remain visible in INFO / DATA.

### Teleport endpoint pairs `$016-$01D`

Two four-byte records are present. **STRONG / structurally corroborated:** each record stores two direct endpoint coordinate pairs:

```text
+0 endpoint A X
+1 endpoint A Y
+2 endpoint B X
+3 endpoint B Y
```

The level-side record contains no floor field. This agrees with the previously traced Z80 behaviour which compares the current position with one endpoint and selects its partner, but Stage 5 does not invent a floor association that is not stored here.

An all-zero four-byte pair is treated as unused. Stage 5 exposes active/inactive plus A X/Y and B X/Y, while retaining the raw bytes under INFO / DATA.

## Progression

`$01E` behaves as the progression requirement on segments d-l. Zendik is exceptional and Stage 5 does not expose its `$01E` as a normal requirement count.

## Preservation rules

- untouched payload bytes remain byte-identical;
- raw map operations do not relocate companion records;
- semantic Object moves update object location + bit 2;
- semantic Monster moves update monster location + bit 7 conservatively;
- semantic Event moves update the source offset;
- Zendik slots 36-44 are protected;
- no-op export is byte-identical;
- only affected Spectrum data-block parity is recalculated.
