# Bloodwych ZX Spectrum — Level Data Format

## Authority

The complete Level Data TZX is the Stage 5 source authority. Each `d..m` block contains one Spectrum flag byte, `$08CB` loaded payload bytes and one XOR parity byte.

Payload offsets below exclude the Spectrum flag byte.

## Top-level payload

```text
$000-$005  P1/P2 starts
$006-$015  eight crystal/gem-socket special-location records
$016-$01D  two paired teleport-gem endpoint records
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
$006 -> $9DC3 crystal/gem-socket special records
$016 -> $9DD3 teleport endpoint pairs
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

The current working model is:

```text
bits 0-1  base cell type
bit 2     object-stack-present
bits 3-6  feature/orientation/state
bit 7     normally occupied/actor state, EXCEPT on doors
```

Working base types:

```text
0 floor/space
1 floor feature
2 door
3 stone wall
```

Bit 2 is persistent/required with Object stacks and is maintained semantically by Stage 5.

### Door cells — important bit-7 exception

For base type 2 the upper bits are a door field, not the normal actor-occupancy layout:

```text
bits 0-1 = 2          door
bit 3                 passage axis: 0=N/S, 1=E/W
bit 4                 closed/blocking state
bits 5-7              lock/colour index 0-7
```

The orientation describes the **passage axis**. Therefore an N/S passage is drawn with a horizontal E/W door barrier, while an E/W passage is drawn with a vertical N/S barrier.

Because door bit 7 belongs to the lock/colour index, it must not also be treated as actor occupancy. Stage 5.1 consequently refuses semantic Monster placement onto a door cell and the audit reports a Monster/door conflict if one is encountered.

### Confirmed/strong wall-feature families

For base type 3, bits 3-6 form a directional wall-feature field. Current evidence supports:

```text
feature 0       plain stone wall
feature 4-7     empty gem socket, N/E/S/W
feature 8-11    switch, N/E/S/W
feature 12-15   filled crystal/gem socket, N/E/S/W
```

The filled-socket family is **strong/data-derived**: every non-zero `$006-$015` special-location record in the authoritative TZX resolves to a cell in this family.

### Floor pads

`$09` is no longer given a global “Vivify-machine floor pad” label. It is a floor pad/trigger family; the linked Event record determines the actual action. In the Keep, for example, Event slots 16 and 18 source `$09` cells and use the Tower-exit/progression side-pad action `$22`.

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

### Crystal/gem-socket locations `$006-$015`

There are **eight independent two-byte lookup records**. The earlier Stage 5 UI grouped adjacent entries into four A/B “pairs”; that relationship is not encoded and has been removed.

The record packing remains:

```text
byte 0       map-workspace offset bits 0-7
byte 1 & $0F map-workspace offset bits 8-11
byte 1 >> 4  variant field

map_offset = ((byte1 & $0F) << 8) | byte0
$0000      = unused entry
```

### Z80 lookup evidence

After the level payload is copied into its runtime workspace, `$006` is at `$9DC3`. The Game TZX routine at approximately `$C80D` starts at `$9DC3` and advances by two bytes while searching for a matching map offset. On a match it shifts the stored second byte right four places and masks it with `AND 7` before returning the variant.

This establishes two useful points for the editor:

1. the records are eight independent two-byte map-location lookups rather than four encoded endpoint pairs;
2. the runtime-significant variant is 3 bits (`0-7`). The top bit of the stored high nibble is preserved on rewrite rather than silently normalised.

### Variant names / colours

The current friendly mapping is:

| Variant | Meaning | Presentation |
|---:|---|---|
| 0 | Serpent crystal | green |
| 1 | Chaos crystal | yellow |
| 2 | Dragon crystal | red |
| 3 | Moon crystal | blue |
| 4 | Tan teleport gem | tan |
| 5 | Bluish teleport gem | blue-grey |
| 6 | reserved / not identified | raw |
| 7 | reserved / not identified | raw |

Variants 0-3 are strongly corroborated by the corresponding continuation blocks. Variant 4 is directly cross-correlated against the original 68k `gem-tan.locations` resource: the tower positions track the same tan-gem locations (with small platform coordinate/alignment differences). With variants 0-3 already accounting for the four tower crystals and the Z80 using six normal schemes, variant 5 is the remaining bluish teleport-gem scheme exposed by the 68k data. The packed ZX value remains the binary authority.

Every non-zero record across the ten supplied level blocks resolves to an active floor cell through the floor descriptors. The matching map cell is a filled socket (`feature 12-15`), allowing VIEWER/MAPS to display the socket and its tan/blue/tower-crystal identity without moving this information out to LAYOUT only.

Stage 5.1 edits these records as active/inactive + floor/X/Y + variant and recomputes the packed map offset. The original packed bytes remain visible under DATA / FILES.

The special-location record identifies/colours a filled socket; moving the record does **not** itself rewrite the destination map cell into a filled socket. This separation is retained deliberately rather than performing an unproved multi-resource transformation.

### Teleport endpoint pairs `$016-$01D`

These are the actual paired records. Two four-byte records are present; each stores two direct endpoint coordinate pairs:

```text
+0 endpoint A X
+1 endpoint A Y
+2 endpoint B X
+3 endpoint B Y
```

The level-side record contains no floor field. Stage 5 therefore does not invent a map overlay/floor association for these pairs. An all-zero four-byte pair is treated as unused. LAYOUT exposes active/inactive plus A X/Y and B X/Y while retaining the raw bytes under DATA / FILES.

## Runtime-only magic features

The Amiga/68k map format has explicit Firepath, Mindrock and Formwall semantics, but no equivalent ZX Level-TZX byte encoding has yet been demonstrated. Stage 5.1 therefore does **not** copy the 68k encoding into the ZX map decoder.

The renderer now has a presentation hook for future save-game/snapshot models to attach a semantic runtime feature named `firepath`, `mindrock` or `formwall`. Until the ZX runtime/save representation is proved, these remain presentation support only and cannot be authored into Level TZX data through an invented encoding.

## Progression

`$01E` behaves as the progression requirement on segments d-l. Zendik is exceptional and Stage 5 does not expose its `$01E` as a normal requirement count.

## Preservation rules

- untouched payload bytes remain byte-identical;
- raw map operations do not relocate companion records;
- semantic Object moves update Object location + bit 2;
- semantic Monster moves update Monster location + bit 7 on non-door cells only;
- semantic Monster placement onto door cells is rejected;
- semantic Event moves update the source offset;
- semantic crystal/gem-location moves update only the packed special record;
- Zendik slots 36-44 are protected;
- no-op export is byte-identical;
- only affected Spectrum data-block parity is recalculated.
