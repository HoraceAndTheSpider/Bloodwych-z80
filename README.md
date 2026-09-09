# Bloodwych ZX Level Editor — Stage 5

HTML5 level-data viewer/editor for the ZX Spectrum version of **Bloodwych**.

Stage 5 is the next level-editor milestone. It is **not** a complete game editor. The authoritative editable source remains the Level Data TZX; champion stats, pockets and other game-side/global resources remain future Game-TZX work.

## Recommended source

Use:

`data/Bloodwych - Level Data [ZX Spectrum].tzx`

The bundled file is byte-identical to the current GitHub repository source:

```text
SHA-256  25e716434acdb8220fa5ba1449b2247d20e2112578f20cb6e10cd69ff9cd1206
Git blob 0f964b771363c9c9152437ec38dfcb573665ea69
```

All ten `d..m` level blocks are the complete 2253-byte Spectrum blocks: one flag byte, `$08CB` payload bytes and one XOR parity byte.

The editor still accepts compatible TAP files through **OPEN LEVEL TAPE**, but the complete Level Data TZX is the Stage 5 editing authority.

## Run

```bash
cd Bloodwych-z80-stage5
python3 -m http.server 8000
```

Open `http://localhost:8000/` and press **BUNDLED LEVEL TZX**, or choose a compatible `.tzx`/`.tap` file.

## Stage 5 organisation

The editor uses the same high-level workspace organisation as the current Amiga/68k map editor, while retaining ZX-specific data semantics:

- **VIEWER** — clean inspection and optional overlays.
- **MAPS** — raw map-cell editing plus unified Event editing.
- **OBJECTS** — packed object-stack editing.
- **CHARACTERS / MONSTERS** — Stage 5 monster/team editing; champions are deliberately deferred.
- **LAYOUT** — floor descriptors, player starts, progression, teleport endpoints and crystal/socket special locations.

All five modes share one loaded tape, tower/floor selection, cursor, zoom, map style, undo state and byte-exact edit session.

## Map styles

- **Modern** — default editing view.
- **CPC / Amstrad** — historical-style symbolic presentation with the blue surround restricted to this mode.
- **Amiga-inspired** — procedural presentation adapted to the ZX bitfield. It does not import Amiga binary semantics.

## Stage 5 data model

The editor treats the map byte structurally:

```text
bits 0-1  base cell type
bit 2     object-stack-present
bits 3-6  feature/orientation/state
bit 7     occupied/actor state
```

Object and actor state therefore remain independent flags and may coexist on the same cell.

### Unified Events

ZX source-cell actions use the single 45-slot resource at loaded `$817-$8CA`. The editor resolves Events by their stored source map offset, not by switch encounter order.

- Archaus: 45/45 normal slots used; no additions allowed.
- Zendik: 36 normal slots; slots 36-44 are protected ending-message storage and are never offered as free Events.

### Objects

The object resource uses:

```text
$715-$716  used length, little-endian
$717-$816  fixed 256-byte packed arena
```

Stage 5 supports stack navigation, find/place/move, add/delete stack, item add/delete, item code, quantity/state byte and the two-bit mini-position.

Semantic moves maintain map bit 2. Object repacking rewrites only the new used prefix; bytes outside the used prefix are preserved byte-for-byte.

### Monsters and teams

Stage 5 exposes the 10×4 team table and the 42 allocated 16-byte monster records, including location, rotation/formation byte, levels, HP, action/behaviour fields, form and carried/drop-object candidate.

Semantic positioned-monster moves maintain map bit 7 conservatively while preserving bit 2 if the cell also contains an object stack. X=`$FF` remains supported for secondary team members.

### Layout

Layout controls cover:

- floor width/height;
- map-workspace data offset;
- floor X/Y alignment;
- P1/P2 X/Y/floor starts;
- non-final progression requirement;
- the two paired teleport records;
- the eight crystal/socket packed entries.

The two teleport records are edited as their stored A/B X/Y endpoint pairs; the level-side records contain no floor byte, so Stage 5 does not invent one. The eight crystal/socket entries are edited semantically as floor/X/Y plus the retained raw 4-bit variant: byte 0 and the low nibble of byte 1 form a 12-bit map-workspace offset, while the high nibble is the variant. Every non-zero record in the authoritative TZX resolves to an active map cell. The variant meaning remains deliberately unnamed. Zendik `$01E` is not exposed as a normal progression count.

## Raw map editing

Stage 4 shortcuts are retained:

- **X** — cut the selected raw byte and replace with `$00`;
- **C** — copy raw byte;
- **V** — paste raw byte;
- **Backspace** — clear raw byte to `$00`.

When a selected cell has a linked Event, Object stack or Monster, MAPS shows a warning that raw cell editing will not relocate the companion resource.

## INFO / DATA

Raw offsets, bit breakdowns, original/modified values, loaded/runtime addresses, companion records, evidence labels and consistency diagnostics are kept behind **INFO / DATA** instead of permanently cluttering the map workspace.

## 3D dungeon view

A visible placeholder is reserved for a future ZX-derived first-person renderer:

```text
3D DUNGEON VIEW
ZX graphics extraction / renderer pending
```

No substitute/generated artwork is used.

## Byte-exact session/export rules

- source bytes remain immutable in `originalRaw`;
- edits are applied to an in-memory modified copy;
- semantic operations are single Undo transactions even when several companion bytes change;
- unknown/unrelated bytes are not regenerated;
- TZX record sizes, text records and timing/pause metadata are preserved;
- only blocks with logical edits have parity recalculated;
- returning a block to its original logical bytes restores its original supplied parity byte;
- export remains Level Data TZX/TAP only.

There is no combined Game+Level exporter in Stage 5. The session model already reserves separate `level` and `game` source roles so Game-TZX support can be added later without replacing the edit architecture.

## Validation

Run:

```bash
node tools/stage5_selftest.js
```

The Stage 5 self-test checks the authoritative source identity, all ten complete blocks, byte-identical no-op export, Event capacity/protection, raw edit parity locality, semantic Event edits, Object arena preservation, bit-2/bit-7 maintenance, monster/team editing, semantic teleport/crystal Layout records and exact Undo.

See `docs/stage5-validation.md` and `reverse-engineering/stage5-selftest-output.txt`.
