# Bloodwych ZX Spectrum — Level Data Format

## Scope and evidence

This document records the current reverse-engineering state of the supplied ZX Spectrum Bloodwych level-data TZX.

Evidence terms:

- **CONFIRMED** — demonstrated by ZX tape data and/or Z80 code.
- **STRONG** — well supported and suitable for cautious editor use, but a small semantic detail remains.
- **OPEN** — preserve byte-exactly and do not invent a semantic field.

The supplied ZX data is authoritative. The Amiga/68000 version is used only for comparison where explicitly stated.

## Authoritative level source

Use `Bloodwych - Level Data.tzx` as the preferred level-editing source.

Ten standard-speed level blocks are present:

| Flag | Segment | Working name |
|---:|:---:|---|
| `$64` | d | Keeps |
| `$65` | e | Serpents |
| `$66` | f | Serpent2 |
| `$67` | g | Moons |
| `$68` | h | Moon2 |
| `$69` | i | Dragons |
| `$6A` | j | Dragon2 |
| `$6B` | k | Archaus |
| `$6C` | l | Chaos2 |
| `$6D` | m | Zendiks |

Each block contains:

```text
1 byte       Spectrum flag
2251 bytes   Bloodwych payload ($08CB)
1 byte       Spectrum XOR parity
```

This matches the Z80 loader's fixed `$08CB` load length.

The older combined TAP contains shortened copies of some level blocks and should be retained only for compatibility/reference. The Level Data TZX is the preferred editing source.

## Runtime relocation

The first six loaded bytes are handled separately. The remaining `$08C5` bytes are copied from `$4806` to `$9DC3`.

For loaded offsets `$006+`:

```text
runtime address = $9DBD + loaded offset
```

Useful anchors:

```text
loaded $022 -> runtime $9DDF   floor descriptors
loaded $040 -> runtime $9DFD   map workspace
loaded $474 -> runtime $A231   monster count
loaded $475 -> runtime $A232   monster records
loaded $715 -> runtime $A4D2   object used length
loaded $717 -> runtime $A4D4   object arena
loaded $817 -> runtime $A5D4   event table
loaded $8A7 -> runtime $A664   Zendik ending text
```

## Complete top-level payload coverage

| Loaded offset | Size | Purpose | Status |
|---:|---:|---|---|
| `$000-$002` | 3 | P1 X/Y/floor | **CONFIRMED** |
| `$003-$005` | 3 | P2 X/Y/floor | **CONFIRMED** |
| `$006-$015` | 16 | Crystal/socket special-effect packed locations | **STRONG** |
| `$016-$019` | 4 | Teleport-gem endpoint pair A | **CONFIRMED structurally** |
| `$01A-$01D` | 4 | Teleport-gem endpoint pair B | **CONFIRMED structurally** |
| `$01E` | 1 | Progression requirement on non-final segments; final segment exceptional | **CONFIRMED conditionally** |
| `$01F` | 1 | Segment number `0..9` | **CONFIRMED** |
| `$020-$021` | 2 | Zero-initialised runtime scratch/state | **CONFIRMED as runtime state** |
| `$022-$03F` | 30 | Five 6-byte floor descriptors | **CONFIRMED** |
| `$040-$44B` | `$40C` | Fixed map workspace | **CONFIRMED** |
| `$44C-$473` | `$28` | 10 monster-team rows × 4 members | **STRONG** |
| `$474` | 1 | Active monster-record count/state | **CONFIRMED** |
| `$475-$714` | `$2A0` | 42 × 16-byte monster allocation | **CONFIRMED structurally** |
| `$715-$716` | 2 | Object arena used length | **CONFIRMED** |
| `$717-$816` | `$100` | Packed object arena | **CONFIRMED** |
| `$817-$8CA` | `$B4` | 45 × 4-byte unified event/action area, with Zendik tail reuse | **CONFIRMED structurally** |

There is no remaining unidentified top-level level-data section. Remaining uncertainties are field meanings inside known structures.

## Player starts

The first six payload bytes are:

```text
P1 X, P1 Y, P1 floor,
P2 X, P2 Y, P2 floor
```

Keeps begins:

```text
04 0E 01 06 0E 01
```

matching the known P1/P2 starting positions on floor 1.

These are **Layout** fields, not ordinary map cells.

## Floor descriptors

Five descriptors occupy `$022-$03F`, six bytes each:

```text
+0 width
+1 height
+2/+3 floor-data offset, big-endian
+4 X alignment
+5 Y alignment
```

Floor offsets are relative to the map workspace at `$040`.

## ZX map byte

The working ZX cell model is:

```text
bits 0-1   base cell type
bit 2      object-stack-present flag
bits 3-6   type-specific feature/orientation/state
bit 7      occupied/actor flag
```

Working base types:

```text
0 floor/space
1 floor feature
2 door
3 wall
```

Examples:

```text
$00 floor
$04 floor + object flag
$80 occupied floor
$84 occupied floor + object flag
```

This replaces the earlier flat interpretation in which `$84` was treated as a separate monster value.

### Persistent versus derived map flags

The raw TZX already contains object and actor/occupancy flags, but their runtime treatment differs.

**Object bit 2:**

- original active map cells and packed object records correlate directly;
- object creation/placement code sets bit 2;
- removing the last relevant stack clears bit 2;
- no equivalent full object-list-to-map reconstruction pass has yet been identified during tower load.

Current conclusion: **bit 2 should be treated as required stored map state and maintained together with the object arena.**

**Actor/occupancy bit 7:**

- the original map contains the flag;
- a post-load monster initialisation/preparation pass exists and iterates the loaded monster data;
- this is capable of normalising/rebuilding live actor occupancy when a tower becomes active.

Current conclusion: **bit 7 is at least partly derived/runtime occupancy state, but the editor should still preserve the original byte and maintain it during semantic monster moves.** A controlled load-time experiment clearing/staling the bit is still the best final proof of exactly how aggressively the Z80 rebuilds it.

See `zx-map-runtime-initialisation.md`.

## Crystal/socket special area `$006-$015`

The 16 bytes resolve naturally as eight packed 16-bit values / four paired special locations.

Observed non-zero references resolve to active map positions. The high nibble acts as a type/direction/variant value.

On Zendik, four special references form the cardinal puzzle arrangement around the central area, strongly supporting a directional role.

Editor rule: expose resolved location plus raw variant nibble; do not invent a friendly nibble name until the exact Z80 meaning is proven.

### Final-level crystal behavior

The crystal/socket special effect is explicitly gated to segment 9 in the Z80. Therefore crystal insertion removing specific walls is a Zendik-specific behavior, not a universal socket rule.

## Teleport-gem pairs `$016-$01D`

Two four-byte paired-location records are present:

```text
$016-$019  pair A
$01A-$01D  pair B
```

The Z80 compares the current position with one endpoint and selects the partner endpoint.

These can safely be exposed as paired teleport locations. Colour/object names should come from later Game-TZX object-definition work rather than being guessed here.

## Progression `$01E`

For segments d-l, the field behaves as the progression crystal/gem requirement.

Observed sequence:

```text
d 0
e 2
f 3
g 3
h 4
i 4
j 5
k 5
l 6
m $4A
```

Zendik's `$4A` is not a meaningful requirement count because there is no next tower block. Do not expose `$01E` as a universal "gems required" field on the final segment.

## Monster area

`$474` is the active monster-record count/state. The 16-byte records begin at `$475`.

The preceding 40-byte area is best interpreted as:

```text
10 teams × 4 member-record indexes
$FF = empty
```

Secondary team members may use X=`$FF` and inherit the positioned leader's location.

See `zx-monster-records.md`.

## Object arena

The arena is fixed at 256 bytes:

```text
$715-$716 used length
$717-$816 packed records/free space
```

Current record structure:

```text
+0/+1 packed location
+2    number of contained objects
+3/+4 object code / quantity-or-state
+5/+6 next object code / quantity-or-state
...
```

Packed location:

```text
position   = byte0 >> 6
map_offset = ((byte0 & $3F) << 8) | byte1
```

The two-bit position gives four mini-positions. NW/NE/SW/SE is a strong cross-platform interpretation but should remain labelled cautiously until the ZX renderer is traced.

The second byte paired with each object code is **quantity/state**, not necessarily a universal quantity. Object-specific semantics belong with Game-TZX object definitions.

Semantic object editing must maintain map bit 2.

## Unified event/action table

`$817-$8CA` is 45 four-byte slots. See `zx-level-event-actions.md`.

The source cell is identified by a direct map-data offset, proving that ZX switches/triggers are not numbered by encounter order.

## Zendik event-tail reuse

Slot 36 begins at loaded `$8A7` / runtime `$A664`.

Zendik stores:

```text
ACCURSED MORTALS, I SHALL RETURN\0
```

in the last nine nominal event slots, followed by the remaining `$FF` padding.

Completion action `$28` uses this storage. Those slots are protected content, not spare event capacity.

## Editor preservation rules

- preserve unknown/runtime-only fields byte-exactly;
- raw map edits may remain byte-level, but warn when companion data exists;
- semantic object moves must update packed object location and map bit 2;
- semantic event moves must update event source offset;
- semantic monster moves should update the monster/team representation and actor occupancy state;
- protect Zendik event slots 36-44;
- refuse new events where there is no free normal slot;
- recalculate only affected Spectrum block parity on export.

## Investigation conclusion

The **top-level ZX level format is complete enough for Stage 5 editor work**.

Remaining uncertainties should not block the UI refactor. Preserve them raw and expose them under INFO/DATA until further Z80 work or controlled runtime tests settle them.
