# Bloodwych ZX HTML5 Editor — Stage 5 / 5.1 Implementation

## Implemented

### Shared shell and Stage 5.1 layout

- VIEWER / MAPS / OBJECTS / CHARACTERS-MONSTERS / LAYOUT tabs;
- one shared tape/tower/floor/cursor/zoom/session state;
- Amiga/Python-editor-style large GAME MAPS/BLOCKS and FLOOR navigation on the left;
- map-dominant central workspace and contextual mode editor on the right;
- numeric X/Y map axes and coordinate wording throughout;
- DATA / FILES drawer for raw/reverse-engineering detail;
- visible 3D DUNGEON VIEW placeholder for the separate ZX graphics stage.

### MAPS / Events

- Stage 4 X/C/V/Backspace raw map operations retained under RAW / ADVANCED MAP EDIT;
- raw companion warning;
- dynamic CELL PROPERTIES controls for confirmed ZX map semantics;
- Type dropdown for floor/floor-feature/door/stone wall;
- wall Feature and Face controls for plain walls, switches, empty sockets and filled crystal/gem sockets;
- door Axis, State and Lock controls;
- corrected N/S vs E/W door presentation in Modern, CPC and Amiga-inspired renderers;
- restored door lock/colour presentation;
- door bit 7 treated as lock field rather than actor occupancy;
- semantic Monster placement onto door cells rejected;
- one source-offset Event model;
- Event browse/edit/add/delete/find/move-source;
- `$09` map pad kept neutral and labelled contextually from its linked Event;
- `$20/$22` shown as Tower-exit/progression centre/side-pad paths;
- Archaus/Zendik capacity protection.

### Crystal / teleport-gem sockets

- `$006-$015` corrected from four invented A/B pairs to eight independent two-byte map-location lookup records;
- every non-zero authoritative record linked back to its map cell;
- filled-socket map family (`feature 12-15`) recognised and rendered;
- variants 0-3 named Serpent/Chaos/Dragon/Moon crystals;
- variant 4 named Tan teleport gem;
- variant 5 named Bluish teleport gem;
- tan/bluish/tower-crystal colour shown directly on matching socket cells;
- special locations visible in VIEWER and MAPS rather than LAYOUT only;
- LAYOUT exposes each independent location with FIND ON MAP;
- runtime-significant variant range constrained to 0-7 while the ignored stored high bit is preserved on rewrite.

The separate `$016-$01D` teleport endpoint records remain two A/B X/Y pairs. They contain no floor byte, so no floor association is invented.

### Objects

- parse 256-byte packed arena from little-endian used length;
- browse/find/move/add/delete stack;
- edit mini-position and code/state item pairs;
- add/delete item;
- maintain bit 2;
- preserve unused arena tail;
- enforce arena capacity.

### Characters / Monsters

- Stage 5 scope deliberately monsters only;
- browse/find/place positioned records;
- edit decoded/strong fields while keeping runtime byte `$0E` raw;
- edit 10×4 team rows;
- maintain bit 7 conservatively on non-door semantic moves;
- handle X=`$FF` secondary members;
- reject a door as a semantic Monster destination because door bits 5-7 encode lock/colour.

### Layout

- floor descriptor editing with fixed-map-workspace validation;
- player start editing with active-floor bounds validation;
- non-final progression editing;
- semantic teleport A/B X/Y endpoint editing (the record has no floor byte);
- semantic crystal/gem-socket floor/X/Y + variant editing using the decoded 12-bit map offset;
- Zendik progression exception protected.

### Session/export

- transaction Undo;
- byte-exact no-op export;
- logical diff / affected parity reporting;
- future Game-TZX source slot reserved;
- no premature combined exporter.

## Runtime magic-feature preparation

The renderer recognises future semantic `firepath`, `mindrock` and `formwall` runtime features so save/snapshot support can display them later. This is deliberately **not** a Level-TZX encoding: the ZX storage representation still needs to be proved before these can be authored safely.

## Deliberately deferred

- champion stats/pockets/spells/global definitions;
- Game-TZX project loading/editing/export;
- combined Game+Level TZX output;
- proved ZX save/snapshot storage for Firepath/Mindrock/Formwall;
- actual ZX-derived first-person graphics renderer.

## Important presentation distinction

The Amiga/68k project informs the five-tab organisation, map-dominant layout and interaction style. ZX resources, offsets, Event structure, Object packing, Monster data and map-byte writes remain governed by ZX evidence. The 68k teleport-gem location resources were used only as cross-platform corroboration for the friendly tan/bluish variant names; the ZX packed record remains authoritative.
