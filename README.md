# Bloodwych ZX Level Editor — Stage 2

A TAP-native HTML5 viewer/editor for the ZX Spectrum version of **Bloodwych**.

The editor reads the supplied ZX `.TAP` directly. It does not emulate a Spectrum and does not depend on manually extracted `.dat` floor files.

## Run it

```bash
cd Bloodwych-zx-level-editor
python3 -m http.server 8000
```

Open `http://localhost:8000/` and press **Load bundled TAP**.

You can also choose another compatible TAP with the file picker.

## Current features

- Reads the original `.TAP` directly in JavaScript.
- Finds custom level blocks `d..m` and names them Keeps through Zendiks.
- Reads the five 6-byte floor descriptors at block offset `$23`.
- Treats floor offsets as big-endian.
- Reads map bytes from block offset `$41 + floor_offset`, one byte per cell.
- Applies each floor's X/Y alignment.
- Shows local and aligned coordinates plus exact block/TAP file offsets.
- Separates confirmed, inferred and unknown map-byte meanings.
- Numbers switches in sequential map-storage order for switch-table investigation.
- Keeps original and modified bytes separate.
- Recalculates the affected TAP block XOR checksum after edits.
- Exports a modified TAP, patch JSON, raw tower block, raw floor and tower JSON.

## Fast editing

Select a map cell and use the unmodified single-key shortcuts:

- **X** — Cut: copy the selected raw byte, then replace the cell with `$00`.
- **C** — Copy the selected raw byte.
- **V** — Paste the stored raw byte into the selected cell.

The same operations have visible buttons in the Tile Inspector. The internal clipboard remains available when changing floor or tower. X/C/V are deliberately ignored while typing in input/select fields, and Ctrl/Cmd combinations are left to the browser.

## Map styles

The **Modern** map is now the default because it gives clearer separation between walls, paths and interactive cells.

Three styles are available without changing the underlying map data:

1. **Modern** — colour-coded, high-contrast editor view for routine work.
2. **Amstrad / CPC** — the monochrome symbolic presentation retained from Stage 1 as a historical/reference option.
3. **Amiga / AMOS** — a coloured procedural view inspired by the 68k editor's AMOS-style 16×8 logical map cells and original 16-colour palette. Because the ZX map stores a different one-byte format, this is a visual translation of equivalent concepts rather than an assertion that the two binary formats are identical.

The chosen style only affects rendering. Edits always operate on the original ZX map byte.

## Known caveat

The custom `e` / Serpents block physically ends before all bytes implied by its floor descriptors. Those floors remain marked **PARTIAL**; the editor does not invent missing data or treat this as a decompression issue.

## Offline verification

```bash
python3 tools/verify_tap.py "data/Bloodwych [ZX Spectrum].TAP"
python3 tools/extract_levels.py "data/Bloodwych [ZX Spectrum].TAP" extracted
```

## Development direction

The next reverse-engineering work remains the data surrounding the raw floor grids: switch actions, trigger functions, player starts, monster/object records and the loader behaviour around split/partial tower data. These should feed back into this same TAP-native editor rather than creating a separate data model.
