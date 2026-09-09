# Bloodwych ZX HTML5 Editor — UI Refactor Plan

## Goal

Refactor the ZX HTML5 editor to follow the cleaner architecture of the current Amiga/68k Map Viewer / Editor while preserving ZX-specific data structures and the three existing map styles.

The map should remain the dominant workspace. Functional interpretation, raw offsets and reverse-engineering evidence should not permanently occupy the main UI.

## Main modes

Use five shared modes:

1. **VIEWER**
2. **MAPS**
3. **OBJECTS**
4. **CHARACTERS / MONSTERS**
5. **LAYOUT**

All modes must share the same loaded project/tape source, tower, floor, selected coordinate, zoom/pan state, overlay state and edit session.

Do not create separate duplicated models for the same floor/cell across tabs.

## Persistent controls

Keep always-visible UI compact:

- source/project selector;
- tower selector;
- floor selector;
- map style selector;
- zoom / fit;
- five mode tabs;
- save/export controls;
- **INFO / DATA** button.

Avoid keeping raw byte dumps, long interpretations or large legends permanently visible.

## Map styles

Retain all three current ZX map presentations.

### Modern
Default view for editing clarity.

### Amstrad / CPC
Optional historical-style symbolic view. The blue background belongs only to this mode.

### Amiga / AMOS-inspired
Optional procedural style based on the current Amiga editor's visual language, adapted to the ZX one-byte bitfield rather than pretending the formats are identical.

## Shared ZX map model

Stage 5 should decode the map byte structurally:

```text
bits 0-1   base cell type
bit 2      object-stack-present
bits 3-6   type-specific feature/orientation/state
bit 7      occupied/actor
```

Rendering and semantic editing should layer object/occupancy/feature state over the base type instead of relying on a flat dictionary of complete byte values.

## VIEWER mode

Purpose: clean browsing and inspection.

Default overlays should be off.

Potential overlay toggles:

- player starts;
- events;
- monsters;
- objects;
- elevation links;
- other confirmed special locations.

### Reserved 3D dungeon view

Leave a dedicated panel/space now, but do not implement substitute graphics.

Placeholder:

```text
3D DUNGEON VIEW
Graphics extraction / renderer pending
```

The eventual preview must use graphics derived from the ZX game data.

## MAPS mode

Purpose: ordinary map-cell editing.

Retain:

- `X` — cut;
- `C` — copy;
- `V` — paste;
- `Backspace` — clear selected cell to `$00`.

Confirmed semantic controls can be displayed in this mode. Raw offsets, bit breakdowns and evidence belong in **INFO / DATA**.

### Companion-data warning

Raw map edits do not automatically relocate companion resources.

Examples:

- moving a switch/pad byte does not move its unified event record;
- moving an object marker does not move its object stack;
- moving an occupied cell does not move its monster/team record.

Semantic editing in the dedicated modes should update both sides of the relationship.

## OBJECTS mode

Use the confirmed 256-byte object arena and variable-length stack records.

Expected controls:

- previous/next stack;
- find stack;
- place here;
- add/delete stack;
- add/delete item;
- object code;
- quantity/state;
- two-bit floor-object mini-position once names are confirmed.

The object editor must maintain map bit 2:

```text
create stack       -> set bit 2
remove final stack -> clear bit 2
relocate stack     -> update old/new cells
```

## CHARACTERS / MONSTERS mode

Initial level-data scope:

- monster list;
- location;
- team/group;
- form/type;
- HP/level/state once fully decoded;
- find/place controls.

The monster editor should eventually maintain map bit 7 for positioned actors while preserving bit 2 when objects share the cell.

Later Game-TZX scope can add:

- champion stats;
- pockets;
- spells;
- other champion/game-side data.

Expand this mode rather than creating a separate application.

## LAYOUT mode

Use for:

- floor width/height;
- floor X/Y alignment;
- P1 start X/Y/floor;
- P2 start X/Y/floor;
- progression field where valid;
- crystal/socket special locations once fully named;
- elevation diagnostics.

Do not expose Zendik's `$01E` byte as a generic progression-count control.

## Unified Event / Action model

ZX switches and triggers share one 45-slot event table.

The editor should therefore have one internal Event/Action model rather than separate switch and trigger resources.

The map presentation may still distinguish source feature types visually.

Semantic event relocation should update the record `source_offset` when the source cell is moved.

Zendik must reserve event slots 36-44 for the ending message and treat only 0-35 as normal event capacity.

## INFO / DATA drawer

Put functional/interpretive/reverse-engineering detail behind one button.

Possible fields:

```text
Coordinate
Raw value
Base type / bit flags
Original / modified value
Loaded-data offset
Tape-block offset
Absolute TZX offset
Interpretation
Evidence status
Companion event/object/monster record
Z80 routine/address
Notes
```

Also keep confidence labels, raw packed records, source cross-references and audit diagnostics here.

## Session principles

- Original source remains immutable.
- Maintain separate modified state.
- Support undo/reset.
- Preserve unknown/reserved bytes.
- Recalculate only required Spectrum parity/checksum fields.
- Never overwrite the source automatically.

## Tape/project direction

Eventually support both:

- **Game TZX**
- **Level Data TZX**

Export options should eventually include:

- modified Game TZX;
- modified Level Data TZX;
- combined TZX containing both sides/sets in the required order.

Add combined export only after both sides are sufficiently mapped to preserve all untouched blocks exactly.

## Recommended implementation order

1. Finish remaining monster/object semantics and cross-correlation audits.
2. Refactor current HTML editor into the five-mode layout.
3. Add the 3D-view placeholder only.
4. Add INFO / DATA drawer and remove interpretive clutter from the main UI.
5. Add semantic event/object/monster editors using the confirmed companion-data model.
6. Add Game-TZX parsing/editing.
7. Add combined-TZX export.
8. Extract ZX graphics and build the real first-person dungeon view.
9. Compare CPC/C64 data and document platform differences separately.
