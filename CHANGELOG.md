# Changelog

## Stage 5 — semantic level editor milestone

- Refactored the editor into **VIEWER / MAPS / OBJECTS / CHARACTERS-MONSTERS / LAYOUT** while keeping one shared map/session model.
- Added a compact persistent header and moved reverse-engineering detail into **INFO / DATA**.
- Retained Modern, CPC/Amstrad and Amiga-inspired map styles.
- Reserved a visible **3D DUNGEON VIEW** area; no substitute artwork or renderer is implemented yet.
- Replaced prototype sequential switch numbering with the ZX unified source-offset Event model.
- Added Event navigation/edit/add/delete/source relocation.
- Enforced Archaus 45/45 capacity and Zendik's 36 normal slots with protected slots 36-44.
- Added packed Object arena parsing/editing, stack relocation, add/delete stack and item editing.
- Semantic Object edits maintain map bit 2.
- Object repacking now writes only the used prefix and preserves the unused arena tail byte-for-byte.
- Added monster record editing and 10×4 team-table editing.
- Semantic positioned-monster moves maintain map bit 7 conservatively while preserving object bit 2.
- Added Layout controls for floor descriptors, P1/P2 starts and progression.
- Decoded the crystal/socket special packing as a 12-bit map-workspace offset plus raw 4-bit variant; all non-zero authoritative-TZX records resolve to active cells.
- Added semantic floor/X/Y + variant editing for crystal/socket records and direct X/Y endpoint editing for the two teleport pairs; teleport records contain no floor byte.
- Added semantic validation for Event fields, map-workspace geometry, player starts, Object capacity and team rows.
- Added transaction-based Undo for multi-byte semantic operations.
- Added separate `level`/future-`game` roles to the edit-session design without implementing Game-TZX or combined export prematurely.
- Corrected Stage 5 development validation to use the exact current GitHub Level Data TZX (SHA-256 `25e716...1206`).
- Added `tools/stage5_selftest.js` and a GitHub-ready validation report.

## Stage 4

- Removed persistent per-cell edit highlights after raw X/C/V operations.
- Added Backspace = clear selected map byte to `$00`.
- Corrected Modern door-axis drawing.
- Restricted the blue surround to CPC/Amstrad mode.
- Corrected AMOS locked/closed door and ladder presentation.
- Added visible P1/P2 start markers.

## Stage 3 — TAP + TZX

- Added direct TZX loading/export while preserving timing metadata and block sizes.
- Established the complete Level Data TZX as the preferred editing source.
- Confirmed all ten `d..m` Level Data blocks match the game's fixed `$08CB` payload length.

## Stage 2

- Made Modern the default map presentation.
- Added Amiga/AMOS-inspired display mode.
- Added unmodified X/C/V cut/copy/paste shortcuts.
