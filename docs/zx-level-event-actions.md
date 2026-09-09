# Bloodwych ZX Spectrum — Unified Event / Action Records

## Structure

The ZX level block uses one event resource for switches, pads/triggers and other source-cell actions:

```text
loaded $817-$8CA
45 records × 4 bytes
runtime base $A5D4
```

This differs from the Amiga implementation, which uses separate switch and trigger resources.

## Record format

```text
byte 0:
  bits 0-2  source map-offset bits 8-10
  bits 3-7  action selector

byte 1:
  source map-offset bits 0-7

byte 2:
  bits 0-4  target X
  bits 5-7  target floor

byte 3:
  target Y
```

Decode:

```text
source_offset = ((byte0 & $07) << 8) | byte1
action        = (byte0 & $F8) >> 2
target_floor  = byte2 >> 5
target_x      = byte2 & $1F
target_y      = byte3
```

The source location is explicit. Sequential encounter-order switch numbering is not part of the ZX format.

## Current action table

Use mechanical ZX-derived labels where gameplay wording is not fully proven:

| Action | Current effect |
|---:|---|
| `$00` | Remove stone wall |
| `$02` | Clear target bit 4 |
| `$04` | Set target bit 4 |
| `$06` | Toggle target bit 4 |
| `$08` | Random spinner |
| `$0A` | Turn 180 degrees |
| `$0C` | Random ±90-degree spinner |
| `$0E` | Internal Vivify |
| `$10` | External/remains Vivify |
| `$12` | Toggle floor / stone wall |
| `$14` | Create stone wall |
| `$16` | Set target feature/orientation field to `$10` |
| `$18` | Teleport F/X/Y with flash |
| `$1A` | Teleport F/X/Y without flash |
| `$1C` | Advance target orientation/subfield by one `$08` step |
| `$1E` | Toggle target bit 5 |
| `$20` | Progression/entrance centre-pad path |
| `$22` | Progression/entrance side-pad path |
| `$24` | Move/shift stone wall to following map byte |
| `$26` | Toggle target feature/subfield state |
| `$28` | Game completion |
| `$2A` | Set target feature/orientation field to `$08` |

Do not replace a mechanical label with an Amiga action name merely because the effect looks similar.

## Source-cell resolution

```text
selected map cell
  -> sequential map-data offset
  -> matching event.source_offset
  -> event action/target
```

A single internal Event model should serve wall switches, pads/triggers and any other source features.

## Capacity

Current normal-event usage:

| Segment | Used | Free normal slots |
|---|---:|---:|
| Keeps | 22 | 23 |
| Serpents | 23 | 22 |
| Serpent2 | 37 | 8 |
| Moons | 11 | 34 |
| Moon2 | 32 | 13 |
| Dragons | 27 | 18 |
| Dragon2 | 22 | 23 |
| Archaus | 45 | 0 |
| Chaos2 | 28 | 17 |
| Zendiks | 36 | 0 |

Non-final unused records are `$FF FF FF FF`.

Archaus has no spare event capacity without a structural change.

## Zendik special case

Slots 36-44 are reused for:

```text
ACCURSED MORTALS, I SHALL RETURN\0
```

plus the remaining `$FF` bytes.

Action `$28` displays the message at runtime `$A664`.

Therefore:

- only slots 0-35 are normal Zendik events;
- slots 36-44 are protected ending-message storage;
- they must never be presented as free editor capacity.

## Editor requirements

- resolve by source map offset, never occurrence order;
- allow the map to distinguish feature type visually while keeping one Event model internally;
- semantic relocation must update `source_offset`;
- refuse additions when no normal slot is free;
- protect Zendik slots 36-44;
- retain raw record bytes in INFO/DATA;
- keep raw target fields accessible where an action's user-facing meaning remains incomplete.
