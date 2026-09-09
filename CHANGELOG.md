# Changelog

## Stage 3 — TAP + TZX

- Added direct TZX loading and export.
- Supports supplied Bloodwych TZX `$10` Standard Speed Data and `$30` Text Description blocks.
- Level Data TZX is now the recommended/default bundled source.
- Preserves original TZX timing/pause metadata and all untouched source bytes on export.
- Recalculates only the modified Spectrum data-block parity byte.
- Added source-format and TZX pause information to the tower inspector.
- Added a TAP/TZX offline verifier.
- Confirmed all ten Level Data TZX blocks `d..m` are 2253 bytes, matching the game's `$08CB` load length.
- Confirmed the older TAP's `e`, `f` and `m` blocks are physically shortened relative to the TZX; the TZX restores the missing data.
- Modern/CPC/Amiga display modes and single-key X/C/V editing retained.

## Stage 2

- Modern map display made default.
- Added Amiga/AMOS-inspired display mode.
- Added X/C/V cut/copy/paste without Ctrl modifier.

## Stage 4

- Removed the persistent per-cell edit highlight left behind after X/C/V operations; the change list remains authoritative.
- Added Backspace = clear selected map cell to `$00`.
- Corrected Modern N/S vs E/W door drawing to match the AMOS view.
- Restricted the blue map surround/canvas to Amstrad/CPC mode only.
- Fixed AMOS locked/closed doors so they no longer render with an open gap.
- Reworked AMOS ZX ladder icons as narrow rails/rungs rather than stair-like bars.
- Removed unverified N/S/E/W claims from ladder descriptions.
- Added visible P1/P2 start markers from the first six level-block data bytes and reports them in the cell inspector.
