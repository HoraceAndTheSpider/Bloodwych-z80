# Bloodwych ZX Spectrum — Monster Records and Teams

## Allocation

```text
loaded $44C-$473  10 teams × 4 member indexes
loaded $474       active monster count/state
loaded $475-$714  42 × 16-byte monster allocation
```

Unused record slots are `$FF`-filled. Team member `$FF` means empty.

## Current 16-byte interpretation

| Offset | Current field | Confidence |
|---:|---|---|
| `$00` | X; `$FF` may denote secondary team member | confirmed/strong |
| `$01` | Y | confirmed |
| `$02` | rotation / mini-space / formation state | strong |
| `$03` | floor | confirmed |
| `$04` | action-cycle / movement timing state | strong |
| `$05` | base level | strong |
| `$06` | effective/current level | strong |
| `$07-$08` | current HP, little-endian | strong |
| `$09` | action/status state | strong |
| `$0A` | behaviour/AI selector | strong |
| `$0B` | form / graphic/entity ID | strong |
| `$0C` | team/group field | strong |
| `$0D` | carried/drop-object candidate | strong |
| `$0E` | runtime/status byte | open |
| `$0F` | runtime target/reference; `$FF` commonly none | strong |

Do not use 68k record offsets as proof of ZX field meanings.

## Stage 5 behaviour

Stage 5 supports record navigation/find/place, location, rotation/formation, cycle state, levels, HP, action, behaviour, form, team/group field and carried/drop-object candidate.

Runtime byte `$0E` stays raw/read-only in INFO / DATA.

Positioned semantic moves maintain map bit 7 conservatively. If an Object stack shares the old cell, clearing occupancy must preserve map bit 2.

Team editing writes the 10×4 table directly, validates indexes `0-41`/`$FF`, rejects duplicate members within a row and understands X=`$FF` secondary members.
