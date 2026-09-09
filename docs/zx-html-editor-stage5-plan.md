# Bloodwych ZX HTML5 Editor — Stage 5 Plan

## Objective

Refactor the ZX editor to follow the cleaner organisation of the current Amiga/68k Map Viewer / Editor while retaining ZX-specific structures, direct TZX editing and all existing map styles.

This milestone is a **level-data editor refactor**, not the complete game.

## Main modes

1. **VIEWER**
2. **MAPS**
3. **OBJECTS**
4. **CHARACTERS / MONSTERS**
5. **LAYOUT**

All modes share the loaded tape/project, tower, floor, selected coordinate, zoom, overlay state, undo/modified state and the same byte-exact level block.

## Required Stage 5 work

- keep the map dominant and uncluttered;
- move offsets/confidence/Z80 detail behind **INFO / DATA**;
- retain Modern, CPC/Amstrad and Amiga-inspired map styles;
- reserve **3D DUNGEON VIEW** without substitute artwork;
- replace sequential switch numbering with the unified source-offset Event model;
- add semantic Event editing with Archaus/Zendik capacity protection;
- add Object editing with bit-2 and fixed-arena consistency;
- add Monster/team editing with conservative bit-7 consistency;
- add Layout controls for floors, player starts, teleport pairs and crystal/socket records;
- preserve unknown bytes byte-for-byte;
- export only the modified Level Data tape, changing intended bytes and affected parity only.

Do not add a combined Game+Level TZX exporter before proper Game-TZX project support exists.

## Event rules

- one Event model internally, even when map presentation distinguishes switches/pads;
- source relocation updates the stored source map offset;
- 45 normal slots except Zendik;
- Archaus has no spare slot;
- Zendik slots 36-44 are protected ending-message storage.

## Object rules

- create first stack on a cell -> set bit 2;
- remove final stack from a cell -> clear bit 2;
- relocate -> maintain old/new flags without damaging unrelated cell bits;
- enforce 256-byte arena capacity.

## Monster rules

- maintain 10×4 team rows;
- understand X=`$FF` secondary members;
- semantic positioned moves maintain map bit 7 conservatively;
- preserve unproven runtime bytes.

## Acceptance checks

Stage 5 is accepted when:

- tab changes retain the shared working state;
- Stage 4 raw map editing remains available;
- the authoritative Level Data TZX opens directly;
- no-op export is byte-identical;
- edited export changes only intended logical bytes plus affected parity;
- Event/Object/Monster semantic moves update linked structures;
- Archaus/Zendik capacities are enforced;
- unknown bytes remain untouched;
- the map is not dominated by reverse-engineering detail;
- the 3D panel is visibly reserved but deliberately non-functional.

## Implementation status

The accompanying Stage 5 package implements the above level-data scope. Game-TZX resources, champion editing, combined export and a ZX-derived 3D renderer remain deferred by design.
