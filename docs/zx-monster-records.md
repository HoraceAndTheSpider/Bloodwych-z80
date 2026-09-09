# Bloodwych ZX Spectrum — Monster Records and Teams

## Allocation

```text
loaded $44C-$473  40-byte team/member area
loaded $474       active monster count/state
loaded $475-$714  42 × 16-byte monster allocation
```

Unused record slots are `$FF`-filled.

## Team table

The 40-byte preceding area is strongly identified as:

```text
10 teams × 4 member record indexes
$FF = empty slot
```

A positioned leader owns the map location. Secondary members may store X=`$FF` and share/inherit the leader's location through team data.

## Current 16-byte record map

The following is the current ZX interpretation. Fields marked **STRONG** should remain byte-preserving in the editor even when shown semantically.

| Offset | Current field | Confidence |
|---:|---|---|
| `$00` | X position; `$FF` may denote secondary team member | **CONFIRMED / STRONG** |
| `$01` | Y position | **CONFIRMED** |
| `$02` | rotation / mini-space / formation state | **STRONG** |
| `$03` | floor | **CONFIRMED** |
| `$04` | action-cycle / movement timing state | **STRONG** |
| `$05` | base level | **STRONG** |
| `$06` | effective/current level | **STRONG** |
| `$07-$08` | current hit points, little-endian | **STRONG** |
| `$09` | action/status state | **STRONG** |
| `$0A` | behaviour/AI selector | **STRONG** |
| `$0B` | form / graphic/entity ID | **STRONG** |
| `$0C` | team/group field | **STRONG** |
| `$0D` | carried/drop-object candidate | **STRONG** |
| `$0E` | runtime/status byte | **OPEN** |
| `$0F` | runtime target/reference; `$FF` commonly means none | **STRONG** |

Do not use 68k offsets as proof of ZX meanings. The related 68k live actor structure is useful only as corroboration where the ZX accesses independently agree.

## Occupancy map flag

Map bit 7 is the actor/occupied state.

The original TZX already carries it, but the Z80 also performs a post-load monster preparation pass when the tower becomes active. This makes actor occupancy different from the object bit:

- monster records are an authoritative list of actors;
- the active map occupancy can be normalised/rebuilt as part of tower activation;
- the raw map's bit 7 is therefore best treated as stored initial/runtime cache state rather than the only source of monster placement.

The editor should nonetheless preserve and maintain it. A semantic monster move should update both monster/team data and occupancy state, rather than relying on a later game initialisation pass to repair a deliberately inconsistent edited map.

## Stage 5 operations

The monster editor should support:

- previous/next monster;
- find selected monster;
- place/move monster;
- X/Y/floor;
- rotation/formation state;
- team membership;
- form;
- base/effective level;
- HP;
- behaviour/action state;
- carried/drop object where the field remains consistent.

Team editing must:

- maintain the 10×4 table;
- understand X=`$FF` secondary members;
- enforce a maximum of four members per team;
- preserve unedited runtime bytes.

Keep `$0E` and any still-unproven flag bits raw/read-only initially.
