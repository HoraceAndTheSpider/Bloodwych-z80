# Bloodwych ZX Level Editor — Stage 1

A TAP-native HTML5 viewer/editor for the ZX Spectrum version of **Bloodwych**.

This stage deliberately concentrates on the part now proved from the supplied tape: custom level-block parsing, floor geometry/alignment, one-byte map cells, inspection and safe editing. It does **not** emulate a ZX Spectrum and does not use manually extracted `.dat` files.

## Run it

The simplest reliable method is:

```bash
cd Bloodwych-zx-level-editor
python3 -m http.server 8000
```

Then open `http://localhost:8000/` and press **Load bundled TAP**.

You can also open `index.html` directly and choose the original TAP using the file picker; no preprocessing is required.

## What the editor does

- Reads the original `.TAP` directly in JavaScript.
- Finds the 10 custom blocks `d..m` and gives them the map-viewer names Keeps through Zendiks.
- Reads 5 × 6-byte floor descriptors from block offset `$23`.
- Treats the floor offset word as **big-endian**.
- Reads floor cells from block offset `$41 + floor_offset`, one byte per cell.
- Applies X/Y floor alignment.
- Displays a CPC-map-viewer-inspired symbolic map with local/aligned coordinates.
- Shows exact block and absolute TAP offsets for a selected cell.
- Separates confirmed, inferred and unknown tile semantics.
- Numbers switches in sequential map-storage order to help test the switch-action-table hypothesis.
- Keeps original/modified bytes separately.
- Exports modified TAP files with recalculated block XOR checksums.
- Exports patch JSON, raw custom blocks, raw floor bytes and tower JSON.

## Known caveat

The custom `e` / Serpents block physically ends before all bytes implied by its floor descriptors. The editor reports those floors as **PARTIAL**. It does not pretend this has been solved by decompression. Resolving how the loader combines/uses this data is a next Z80-analysis target.

## Offline verification

```bash
python3 tools/verify_tap.py "data/Bloodwych [ZX Spectrum].TAP"
python3 tools/extract_levels.py "data/Bloodwych [ZX Spectrum].TAP" extracted
```

These tools also read only from the TAP.

## Development direction

Next work should use SkoolKit (externally) or equivalent Z80 analysis to identify the non-map tables referenced by the zero-sized descriptor offsets, particularly switch effects, monsters/objects, starting positions and inter-floor transition logic. Those findings can then be exposed in the same inspector without changing the TAP-native architecture.
