# Bloodwych ZX HTML5 Editor — Stage 5 Implementation

## Implemented

### Shared shell

- VIEWER / MAPS / OBJECTS / CHARACTERS-MONSTERS / LAYOUT tabs;
- one shared tape/tower/floor/cursor/zoom/session state;
- compact persistent source/tower/floor/style/export controls;
- INFO / DATA drawer;
- visible 3D DUNGEON VIEW placeholder.

### MAPS / Events

- Stage 4 X/C/V/Backspace raw map operations retained;
- raw companion warning;
- sequential switch numbering removed;
- one source-offset Event model;
- Event browse/edit/add/delete/find/move-source;
- Archaus/Zendik capacity protection.

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
- maintain bit 7 conservatively on semantic moves;
- handle X=`$FF` secondary members.

### Layout

- floor descriptor editing with fixed-map-workspace validation;
- player start editing with active-floor bounds validation;
- non-final progression editing;
- semantic teleport A/B X/Y endpoint editing (the record has no floor byte);
- semantic crystal/socket floor/X/Y editing using the decoded 12-bit map offset plus retained raw 4-bit variant;
- Zendik progression exception protected.

### Session/export

- transaction Undo;
- byte-exact no-op export;
- logical diff / affected parity reporting;
- future Game-TZX source slot reserved;
- no premature combined exporter.

## Deliberately deferred

- champion stats/pockets/spells/global definitions;
- Game-TZX project loading/editing/export;
- combined Game+Level TZX output;
- friendly naming of the crystal/socket raw variant nibble;
- actual ZX-derived first-person graphics renderer.

## Important presentation distinction

The Amiga/68k project informed the five-tab organisation and general map-dominant layout only. ZX resources, offsets, Event structure, Object packing and Monster data are decoded and written according to the ZX documentation/source evidence.
