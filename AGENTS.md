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

## Preservation rules

- Never overwrite the source tape automatically.
- Preserve unknown/reserved/unrelated bytes exactly.
- Treat Spectrum parity as derivative only for a logically edited block.
- Preserve TZX record sizes, timing/pause metadata and non-data records.
- Semantic operations must be transactions so Undo restores all companion bytes together.
- Raw MAPS editing may create companion inconsistencies, but must warn rather than silently rewriting Event/Object/Monster resources.

## Map flags

Working ZX map-byte model:

```text
bits 0-1  base cell type
bit 2     object-stack-present
bits 3-6  feature/orientation/state
bit 7     occupied/actor state
```

Semantic Object editing must maintain bit 2. Semantic positioned-Monster editing must maintain bit 7 conservatively. Never clear the other flag while updating one.

## Events

Use the one source-offset-keyed Event table at loaded `$817`. Do not revive sequential switch numbering.

- Archaus has no spare Event slot.
- Zendik slots 36-44 are protected ending-message storage.

## Objects

Object used length at `$715-$716` is little-endian. The arena is fixed at `$717-$816`.

Only the prefix covered by used length is the packed object resource. Do not rewrite the unused tail. Repacking may shift bytes within the used prefix; bytes outside the new used length should remain untouched.

## Monsters

Respect the 10×4 team table and X=`$FF` secondary members. Runtime byte `$0E` remains raw/unproven. Do not infer field meanings from 68k offsets alone.

## Layout/special records

Validate floor descriptors against the fixed `$40C` map workspace. Validate P1/P2 starts against active floor bounds.

Working Stage 5 special-location model: each crystal/socket entry stores `map_offset = ((byte1 & $0F) << 8) | byte0`; `byte1 >> 4` is the raw variant. All non-zero records in the authoritative TZX resolve to active floor cells. Preserve the variant numerically until its gameplay meaning is proved. Teleport pairs store two direct X/Y endpoints and contain no level-side floor byte; do not invent one.

## Validation before packaging

Run:

```bash
node tools/stage5_selftest.js
```

An unmodified export must be byte-identical to the source. A one-byte raw map edit should change only that byte plus the affected block parity. Semantic edit + Undo must return to exact source bytes.
