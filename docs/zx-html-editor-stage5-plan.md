# Bloodwych ZX HTML5 Editor — Stage 5 Implementation Plan

## Objective

Refactor the current ZX editor to follow the cleaner organisation of the current Amiga/68k Map Viewer / Editor, while retaining ZX-specific structures, direct TZX editing and all existing map styles.

This milestone is a **level-data editor refactor**, not the complete game.

## Main modes

Use five shared modes:

1. **VIEWER**
2. **MAPS**
3. **OBJECTS**
4. **CHARACTERS / MONSTERS**
5. **LAYOUT**

All modes share the same:

- loaded tape/project;
- tower;
- floor;
- selected map coordinate;
- zoom/pan;
- overlay state;
- undo/modified state;
- underlying byte-exact level block.

Do not build separate duplicate map models per tab.

## Persistent header

Keep the always-visible UI compact:

- source/tape;
- tower;
- floor;
- map style;
- zoom / fit;
- mode tabs;
- save/export;
- **INFO / DATA**.

The map remains the dominant central surface.

## Map styles

Retain:

- **Modern** — default clarity;
- **CPC / Amstrad** — blue background only here;
- **Amiga / AMOS-inspired** — procedural symbolic presentation adapted to ZX data.

Do not reintroduce wooden-wall semantics into the ZX model.

## VIEWER

Purpose: clean inspection.

Overlays default off.

Available/anticipated overlays:

- player starts;
- unified events;
- object stacks;
- monsters/teams;
- crystal/socket special locations;
- teleport pairs;
- elevation/layout links.

### Reserved 3D dungeon view

Reserve a right-hand panel/space only:

```text
3D DUNGEON VIEW
ZX graphics extraction / renderer pending
```

Do not use substitute/generated artwork.

The eventual first-person preview must be built from graphics derived from the ZX game data.

## MAPS

Retain fast raw editing:

- `X` cut;
- `C` copy;
- `V` paste;
- `Backspace` clear to `$00`.

Decode/render the map byte as a bitfield first, then layer type-specific feature, object and occupancy state.

### Companion-resource warning

Raw byte operations must not silently rewrite companion data.

If a selected/copied/cut cell has linked records, show a compact warning, for example:

```text
This cell also has: EVENT, OBJECT STACK, MONSTER
Raw map edit will not relocate companion records.
```

Semantic relocation belongs in the dedicated mode.

## OBJECTS

The level-side object structure is sufficiently identified for semantic editing.

Controls:

- previous/next stack;
- find selected stack;
- place/move here;
- add/delete stack;
- add/delete object;
- object code;
- quantity/state;
- four mini-positions.

Consistency rules:

- create first stack at a cell -> set map bit 2;
- remove last stack from a cell -> clear bit 2;
- relocate -> update old/new map flags;
- preserve unrelated map bits;
- enforce the fixed 256-byte arena capacity.

Do not duplicate object names/semantics prematurely. Later use Game-TZX object definitions as the authoritative shared catalogue.

## CHARACTERS / MONSTERS

Initial Stage 5 scope is monsters only; champions can be added when Game-TZX stats/pockets are mapped.

Controls:

- previous/next monster;
- find;
- place/move;
- X/Y/floor;
- rotation/mini-space;
- team membership;
- form;
- base/effective level;
- HP;
- action/behaviour fields;
- carried/drop object;
- raw runtime bytes under INFO/DATA.

Team editing must maintain the 10×4 team table and understand X=`$FF` secondary members.

Monster semantic relocation should maintain map bit 7 even though tower initialisation may also derive/normalise occupancy from the monster list.

## LAYOUT

Expose:

- floor width/height;
- X/Y alignment;
- P1 start X/Y/floor;
- P2 start X/Y/floor;
- progression requirement on non-final segments;
- paired teleport locations;
- crystal/socket special locations plus raw variant nibble;
- layout/elevation diagnostics.

Do not show Zendik `$01E` as an ordinary progression count.

## Unified Event / Action model

Use one internal Event model, not separate Switch and Trigger tables.

Fields:

- source map offset / resolved floor/X/Y;
- action;
- target floor/X/Y;
- raw four-byte record.

Rules:

- semantic event relocation updates source offset;
- capacity is fixed at 45 normal slots except Zendik;
- Archaus has no spare slot;
- Zendik slots 36-44 are protected ending-message storage and are never free.

The map can still label source features as switch/pad/etc for presentation.

## INFO / DATA drawer

Move technical/interpretive material out of the main editor.

Show as applicable:

```text
coordinate
raw cell byte
base type / flag breakdown
original / modified value
loaded-data offset
TZX block/file offset
linked event
linked object stacks
linked monster/team
special crystal/teleport record
raw companion bytes
evidence status
Z80 address/routine notes
```

This drawer is also where unresolved fields remain visible without cluttering the normal workflow.

## Save/export

Retain byte-exact edit-session principles:

- source remains immutable;
- modified state separate;
- undo/reset;
- untouched bytes preserved;
- only affected Spectrum XOR parity recalculated;
- export same tape format for level-side edits.

## Combined TZX direction

Do **not** implement the combined Game+Level export before Game-TZX editing exists, but design the project/session layer so it can later hold both sides.

Later export choices:

- Game TZX;
- Level Data TZX;
- combined TZX containing both data sets in the required order.

This will be needed for champion pockets/stats and other game-side data.

## CPC/C64 comparison

When those files are supplied, compare:

- level payload structures/layouts separately;
- game-side/global definitions separately.

Expected differences are more likely in game/global implementation data than authored level placement, but no equivalence should be assumed in code.

## Recommended Stage 5 build order

1. Refactor shell into the five tabs without losing current map functionality.
2. Add INFO/DATA drawer and move interpretation out of the main UI.
3. Keep current three map styles and correct shared state across tabs.
4. Add unified Event model and event editor.
5. Add Object editor with bit-2 consistency and arena capacity checks.
6. Add Monster/team editor with bit-7 consistency.
7. Add Layout controls for starts, floor geometry and special locations.
8. Add 3D-view placeholder only.
9. Add validation/audit panel for companion-data inconsistencies.
10. Package as the next downloadable editor milestone and document remaining limitations.

## Acceptance checks

Stage 5 should not be considered complete unless:

- switching tabs preserves tower/floor/cursor/zoom;
- raw map edit behavior from Stage 4 still works;
- original Level Data TZX opens directly;
- export modifies only intended data + parity;
- object/event/monster semantic moves update their linked structures;
- Archaus/Zendik event capacities are enforced;
- unknown bytes remain unchanged;
- no persistent reverse-engineering clutter dominates the map screen;
- the 3D panel is visibly reserved but deliberately non-functional.
