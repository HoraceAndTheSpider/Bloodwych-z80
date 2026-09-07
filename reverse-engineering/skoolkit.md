# SkoolKit next-pass workflow

SkoolKit is intended as a reverse-engineering aid, not a runtime dependency of the HTML5 editor.

The most useful next targets are:

1. Extract main machine-code TAP block 5 (header says load at `$5B00`, length `$A500`).
2. Generate a Z80 disassembly/control-file baseline with SkoolKit locally.
3. Search/trace routines that use:
   - custom block IDs `d..m`;
   - descriptor offset `$23` and/or map base `$41`;
   - 6-byte descriptor stepping;
   - tile comparisons against confirmed values `$43/$4B/$53/$5B`, `$23/$2B/$33/$3B`, door `$x2/$xA` families;
   - sequential switch enumeration and associated action tables.
4. Feed only proved table semantics back into `js/tiles.js` and the editor inspector.

SkoolKit is intentionally not vendored here. Install it from the official project on the machine used for reverse engineering, then retain generated `.ctl`/`.skool` artefacts under this directory as the analysis matures.
