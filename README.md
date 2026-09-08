# Bloodwych ZX Level Editor — Stage 4

A TAP/TZX-native HTML5 viewer/editor for the ZX Spectrum version of **Bloodwych**.

The editor reads the supplied tape image directly in the browser. It does not emulate a Spectrum and does not depend on manually extracted `.dat` floor files.

## Recommended source

Use **`Bloodwych - Level Data.tzx`** for editing levels.

The newly supplied TZX resolves an important ambiguity in the older combined TAP: all ten level blocks `d..m` are exactly 2253 bytes in the TZX (flag + 2251 data bytes + parity), matching the game's fixed `DE=$08CB` loader length. In the older TAP, blocks `e`, `f` and `m` are physically shortened; `e` even ends inside map data. The editor therefore keeps TAP support for inspection/compatibility, but treats the Level Data TZX as the authoritative editing source.

## Run it

```bash
cd Bloodwych-zx-level-editor
python3 -m http.server 8000
```

Open `http://localhost:8000/` and press **Load bundled Level Data TZX**.

You can also choose another compatible `.tap` or `.tzx` file with the file picker.

## Current features

- Reads TAP and TZX directly in JavaScript.
- TZX support preserves the supplied file header, text-description block, per-block pauses/timing metadata and block sizes.
- Supports the TZX block types actually present in the supplied Bloodwych images: `$10` Standard Speed Data and `$30` Text Description.
- Finds custom level blocks `d..m` and names them Keeps through Zendiks.
- Reads the five 6-byte floor descriptors at block offset `$23`.
- Treats floor offsets as big-endian.
- Reads map bytes from block offset `$41 + floor_offset`, one byte per cell.
- Applies each floor's X/Y alignment.
- Shows local/aligned coordinates and exact tape-file offsets.
- Separates confirmed, inferred and unknown map-byte meanings.
- Numbers switches in sequential map-storage order.
- Keeps original and modified bytes separate.
- Recalculates the affected Spectrum XOR parity byte after edits.
- Exports a modified source-format tape (`.tzx` stays TZX; `.tap` stays TAP), patch JSON, raw tower block, raw floor and tower JSON.

## Fast editing

Select a map cell and use the unmodified single-key shortcuts:

- **X** — Cut: copy the selected raw byte, then replace the cell with `$00`.
- **C** — Copy the selected raw byte.
- **V** — Paste the stored raw byte into the selected cell.

The same operations have visible buttons in the Tile Inspector. The internal clipboard remains available when changing floor or tower. X/C/V are deliberately ignored while typing in input/select fields, and Ctrl/Cmd combinations are left to the browser.

## Map styles

The **Modern** map is the default.

1. **Modern** — colour-coded, high-contrast editor view.
2. **Amstrad / CPC** — monochrome symbolic presentation retained as a reference option.
3. **Amiga / AMOS** — coloured procedural view inspired by the 68k editor's 16×8 logical map cells and palette. This is a visual translation only; the ZX and Amiga binary formats differ.

## Tape-format finding

The Level Data TZX contains ten `$10` Standard Speed Data blocks, each 2253 bytes:

```text
flag d..m            1 byte
Bloodwych level data 2251 bytes ($08CB)
Spectrum XOR parity  1 byte
                     ----
                     2253 bytes
```

The per-block pauses are retained exactly on export. A test edit to the TZX changes exactly two bytes in the whole file: the selected map byte and that block's parity byte.

The supplied combined TAP is not byte-for-byte equivalent to the TZX level side: `e`, `f` and `m` are shortened there. That now explains the earlier conflict between the fixed loader length and the TAP's physical block sizes, and is also a plausible reason stricter emulators object to that TAP while Fuse accepts it.

## Offline verification

```bash
python3 tools/verify_tape.py "data/Bloodwych - Level Data.tzx"
python3 tools/verify_tape.py "data/Bloodwych [ZX Spectrum].TAP"
```

Saved audit examples are in `reverse-engineering/tzx-verify-output.txt` and `reverse-engineering/tap-verify-output-stage3.txt`.

## Development direction

The next reverse-engineering work should now use the complete TZX blocks when decoding the data after the floor grids: switch actions, triggers, monster/object records and other per-tower tables. The loader investigation can also proceed against a tape image whose block sizes now exactly match the Z80 loader.

### Stage 4 controls/display

`X`, `C`, `V` are unmodified cut/copy/paste shortcuts. `Backspace` clears the selected cell to `$00`. P1/P2 entry positions are shown directly on their stored floor. Modern door-axis rendering now agrees with the AMOS view; ladder orientation remains deliberately unspecified until verified from the Z80 logic.
