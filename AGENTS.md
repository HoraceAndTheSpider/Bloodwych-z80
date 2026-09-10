# AGENTS.md — Bloodwych ZX editor

## Authority

For ZX level-data work use, in order:

1. the supplied/current ZX Level Data TZX;
2. demonstrated Z80 loading/access behaviour;
3. the repository ZX reverse-engineering documentation;
4. controlled editor/runtime validation;
5. other-platform Bloodwych implementations only as comparison.

Do not copy Amiga/68k data semantics onto the ZX format merely because the editors share UI organisation.

## Stage 5 scope

Stage 5 is a **level-data editor milestone**, not the complete game.

Main modes are:

`VIEWER / MAPS / OBJECTS / CHARACTERS-MONSTERS / LAYOUT`

All modes share one tape/session/floor/cell model. Do not create duplicate map models per tab.

Champion stats, pockets and global definitions are future Game-TZX work. Do not add a combined Game+Level exporter until Game-TZX project support exists and untouched Game blocks can be preserved byte-exactly.

## Stage 5.1 UI rules

The Amiga/Python map editor is the interaction/layout reference only. Keep the ZX editor map-dominant with large map/floor navigation and contextual controls.

- Use numeric X/Y coordinates throughout. Do not reintroduce alphabetic Y-row labels.
- MAPS should expose semantic CELL PROPERTIES controls for confirmed meanings; raw byte editing remains an advanced fallback.
- Preserve the shared model across all five tabs.

## Preservation rules

- Never overwrite the source tape automatically.
- Preserve unknown/reserved/unrelated bytes exactly.
- Treat Spectrum parity as derivative only for a logically edited block.
- Preserve TZX record sizes, timing/pause metadata and non-data records.
- Semantic operations must be transactions so Undo restores all companion bytes together.
- Raw MAPS editing may create companion inconsistencies, but must warn rather than silently rewriting Event/Object/Monster/special resources.

## Map flags

Working ZX map-byte model:

```text
bits 0-1  base cell type
bit 2     object-stack-present
bits 3-6  feature/orientation/state
bit 7     normally occupied/actor state
```

**Door exception:** for base type 2, bits 5-7 are the door lock/colour index. Bit 7 must not also be interpreted or maintained as Monster occupancy on a door.

Door field:

```text
bit 3     passage axis: 0=N/S, 1=E/W
bit 4     closed/blocking state
bits 5-7  lock/colour index 0-7
```

An N/S passage is drawn with a horizontal E/W door barrier; an E/W passage is drawn with a vertical N/S barrier. Do not reverse this again.

Semantic Object editing must maintain bit 2. Semantic positioned-Monster editing must maintain bit 7 conservatively on non-door cells and reject a door destination. Never clear the other flag while updating one.

Confirmed/strong stone-wall feature families:

```text
0       plain wall
4-7     empty socket N/E/S/W
8-11    switch N/E/S/W
12-15   filled crystal/gem socket N/E/S/W
```

## Events

Use the one source-offset-keyed Event table at loaded `$817`. Do not revive sequential switch numbering.

A map pad value is not the complete Event meaning. In particular, `$09` is a neutral floor pad/trigger family; derive Tower exit, Vivify, teleport, etc. from the linked Event.

Current regression case: Keep Event slots 16 and 18 source `$09` cells and use action `$22`, the Tower-exit/progression side-pad path.

- Archaus has no spare Event slot.
- Zendik slots 36-44 are protected ending-message storage.

## Objects

Object used length at `$715-$716` is little-endian. The arena is fixed at `$717-$816`.

Only the prefix covered by used length is the packed object resource. Do not rewrite the unused tail. Repacking may shift bytes within the used prefix; bytes outside the new used length should remain untouched.

## Monsters

Respect the 10×4 team table and X=`$FF` secondary members. Runtime byte `$0E` remains raw/unproven. Do not infer field meanings from 68k offsets alone.

Do not place a Monster semantically on a door cell: door bit 7 is part of its lock/colour field.

## Layout/special records

Validate floor descriptors against the fixed `$40C` map workspace. Validate P1/P2 starts against active floor bounds.

`$006-$015` contains **eight independent two-byte crystal/gem-socket map-location lookup records**. Do not group adjacent entries into invented A/B pairs.

```text
map_offset = ((byte1 & $0F) << 8) | byte0
variant    = (byte1 >> 4) & 7
```

The Z80 lookup scans from runtime `$9DC3` two bytes at a time and masks the high-nibble variant with 7. Preserve the stored ignored high bit on semantic rewrite rather than normalising it unnecessarily.

Friendly variant names:

```text
0 Serpent crystal
1 Chaos crystal
2 Dragon crystal
3 Moon crystal
4 Tan teleport gem
5 Bluish teleport gem
6-7 reserved
```

Variants 0-3 are strongly supported by the continuation blocks. Variant 4 is position-correlated with the 68k tan-gem resource; variant 5 is the remaining normal bluish scheme. ZX bytes remain authoritative.

The actual paired teleport endpoint records are separately at `$016-$01D`: two direct A-X/A-Y/B-X/B-Y records with no level-side floor byte. Do not invent one.

Moving a crystal/gem special-location record does not automatically rewrite the destination map cell into a filled socket; keep the resources separate until exact coupling rules are proved.

## Future save/snapshot features

Firepath, Mindrock and Formwall exist in the 68k map system, but no equivalent ZX Level-TZX encoding is currently proved. It is acceptable for a future save/snapshot model to attach those semantic runtime names to the renderer. Do not assign Level-TZX byte values by analogy with 68k.

## Validation before packaging

Run:

```bash
node tools/stage5_selftest.js
node tools/stage5_1_selftest.js
```

An unmodified export must be byte-identical to the source. A one-byte raw map edit should change only that byte plus the affected block parity. Semantic edit + Undo must return to exact source bytes.
