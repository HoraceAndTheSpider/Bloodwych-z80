# First-person dungeon rendering

## Editor-ready view transform — PROVEN

The Z80 stores four facing-specific 14-cell coordinate sets at `$8FF7`. Rows are
North, East, South and West. Samples 0-12 are surrounding cells; sample 13 is the
current player cell. See `data/reference/dungeon_sample_offsets.csv`.

The 19 visual wall slots map onto surrounding samples as:

```text
slot    00 01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16 17 18
sample  00 01 01 02 02 03 03 04 05 06 06 07 07 08 08 09 10 11 12
```

`$9067` has 13 three-byte wall-draw masks. `$908E` has parallel occlusion masks.
For each opaque wall sample the renderer ORs its draw mask and ANDs the current
visibility with its occlusion mask. This reproduces the game's perspective
hiding before painter slots are traversed.

## Background — PROVEN

The 104×64 `$A6AA` work area is cleared. `$90B5` supplies 27×13 bytes of ceiling
texture to rows 0-26 and `$9214` supplies 18×13 bytes of floor texture to rows
46-63. `(playerX + playerY + facing) & 1` selects direct versus horizontally
mirrored texture parity.

## Wall perspective — PROVEN

The 19 wall pointers at `$8A0F` and 19 placements at `$8A37` select eleven
self-describing wall graphics in `$8A5D-$8FF6`. These are rendered by `$F097`.
The portable renderer implements the same operation.

## Wall overlays: switches and sockets — PROVEN

These are real perspective graphics and must not be replaced with editor icons.
On a wall cell, `(cell & $60)` selects the perspective family while bit 7
is a **separate state bit**:

```text
$40  switch family at descriptor $88AC
$20  dark/reserved wall-feature family using descriptor $950D (2D: wall + black fixture)
$60  crystal/gem socket family using descriptor $950D
$00  no switch/socket-family overlay
```

Facing is held in bits 3-4 (`0=N,1=E,2=S,3=W`). The Z80 visibility comparisons
use that face relative to the player's facing before calling `$F097`.

For authored socket cells, bit 7 distinguishes state: `$63` is empty and `$E3`
is the filled form of the same facing/family. The same state bit is retained for
switch cells and is presented as the used/clicked mark. In the 2D editor this is exposed as **On / unclicked** (bit 7 clear) and **Off / clicked** (bit 7 set). It must therefore not be normalised away as actor occupancy on wall cells.

The proof images `docs/wiki/proofs/switch-overlay-proof.png` and
`docs/wiki/proofs/socket-overlay-proof.png` show that the source-derived overlays materially change the perspective wall bitmap.
Filled-socket identity/colour remains separate from the common socket bitmap.

## Floor features — PROVEN static dispatch

The dispatcher at `$FCBD` masks the map cell with `$38`:

```text
$00  no static feature
$08  $940D — visible floor pad/trigger family
$10  no static draw — invisible trigger variant
$18  $92FE — $19 ceiling / upper-hole family
$20  $938D — $21 floor-pit family
$28  $92FE + additional procedural path — $29 ladder up
$30  $938D + additional procedural path — $31 ladder down
$38  $948D
```

Cross-floor Level-TZX alignment closes the common `$18/$20/$28/$30` friendly
names shown above. The `$28/$30` procedural supplement remains relevant to the
first-person ladder rendering even though the 2D editor presents those cells as
ladder icons.

## Painter order — PROVEN

For each visible non-wall slot:

```text
1  floor feature
2  object stacks in mini-positions 2 and 3
3  door
4  object stacks in mini-positions 0 and 1
5  actor/monster/team
```

Walls use the wall branch: main wall graphic first, then a correctly oriented
switch/socket overlay. This ordering is important for object/door occlusion.

## Doors

Door orientation and closed-state bits are proven. `$BBF3-$BD17` draws the door
using depth geometry at `$9617/$9637`, procedural line/fill helpers, then the
static `$897B` perspective overlay. The static overlay and all geometry source
blocks are extracted. The exact portable equivalent of the procedural panel is
still OPEN and therefore `zx_render.py` deliberately does not invent it.


## Emulator validation correction — vertical display order and central seam

A same-location comparison against a live Spectrum game capture on 2026-09-12
showed that the portable 104x64 buffer had been presented with the wrong final
scanline orientation.  The source work area itself remains addressed exactly as
proved above, but the **display conversion is bottom-to-top**: work-buffer row
63 is the top displayed row and row 0 is the bottom displayed row.  Presenting
row 0 at the top makes every wall graphic upside down and visibly swaps the
ceiling and floor.  `js/dungeon-renderer.js` therefore performs the Y inversion
only when painting the completed work buffer to the HTML canvas; source drawing
coordinates and painter order are not rewritten.

The same emulator comparison exposed a one-pixel seam through the central
paired wall.  The earlier portable interpretation displaced the mirrored
companion by one work-buffer scanline.  The displayed game does not contain
that step, so the browser renderer now keeps both halves on the same scanline
origin while retaining the proved horizontal mirror.  This is an
emulator-validated correction to the portable interpretation and should be
carried back into `zx_render.py` before that Python preview is used as a visual
authority again.

The comparison also confirms that a closed door cannot be considered rendered
by the `$897B` static component alone.  The clearly visible panel/frame in the
original game comes from the still-OPEN `$BBF3-$BD17` procedural path using
`$9617/$9637`.  The browser now reports each visible door slot explicitly so a
missing panel cannot be mistaken for a map-decoding failure.

## HTML5 VIEWER integration — IMPLEMENTED STATIC PASS

`js/dungeon-renderer.js` now ports the proved static first-person pipeline into
the browser. It loads the authoritative bundled Game TZX, identifies the unique
Spectrum data block containing the `$A500` main payload, verifies XOR parity and
uses the source bytes directly. The browser renderer does not use 2D editor
icons or recreated substitute wall artwork.

The renderer consumes the **same live Level tape, tower, floor and selected map
cell** already passed to `BWRenderer.render()` by the editor. This deliberately
avoids a second Level-data model: edits made through MAPS continue to feed the
first-person view through the normal editor render cycle.

Current browser pipeline:

```text
selected tower / floor / cursor X,Y / facing
 -> bundled Game $5B00-$FFFF image
 -> 104x64 / 13-byte logical bitmap
 -> source ceiling/floor parity background
 -> $8FF7 facing-relative samples
 -> `data/reference/dungeon_view_slots.csv` slot→sample mapping
 -> $9067/$908E wall visibility + occlusion
 -> 19 perspective painter slots
 -> $8A0F wall geometry
 -> facing-filtered $88AC/$950D wall fixtures
 -> static $FCBD floor-feature descriptor families
 -> static $897B door overlay
 -> final bottom-to-top work-buffer display conversion
```

The VIEWER mirrors the established 68k Python map-editor navigation frame:
`Q`/`E` turn left/right, `W`/`S` move forward/backward and `A`/`D` strafe
left/right relative to the current facing. Arrow keys move the map cursor in
absolute map directions. These keys operate wherever the shared map cursor is
active, matching the Python editor's cross-mode navigation principle. The
on-screen movement controls use the same six actions; direct N/E/S/W facing
buttons remain as an additional browser convenience. Cursor movement is editor
navigation and is deliberately not blocked by gameplay collision rules.

This first pass intentionally omits object stacks and actors/monsters. The JS
compositor nevertheless keeps explicit no-op hook positions for rear objects,
door, front objects and actor so those later layers can be added without changing
the proved painter order.

### Remaining renderer gaps kept OPEN

The browser port follows the same non-invention rule as the Python reference:

- closed doors are detected and receive the authentic static `$897B` component, but the
  visually essential procedural `$BBF3-$BD17` panel/bars are not yet ported;
- `$29/$31` ladders receive their proved static `$92FE/$938D` family, but the
  remaining `$28/$30` procedural supplement is not approximated;
- final Spectrum colour/attribute assignment for the 3D work bitmap remains
  separate from the proved 1-bit geometry path, so the initial browser canvas
  presents the source bitmap in monochrome rather than guessing attributes.

When one of these OPEN cases is visible, the VIEWER labels the gap rather than
silently presenting it as complete.

## Map-grid click freeze — IMPLEMENTATION FIX

The click freeze was traced to the MAPS cell-property presentation hook in
`renderer.js`, not to the 3D renderer.  `#cellProperties` is watched by a
`MutationObserver`; when a wall cell is selected the callback rewrites
`.property-flags.textContent`.  That rewrite is itself a `childList` mutation
inside the observed subtree, so the observer can continually queue itself in
the browser microtask loop.  A wall-cell click can therefore lock the UI before
the event loop returns.

`js/map-renderer-guard.js` now gates **only that observer** to one callback per
animation frame.  The first callback still applies the proved wall/switch/socket
presentation controls, while the mutation created by that callback in the same
frame is discarded.  A later genuine app update rearms the observer normally.

The guard also retains the earlier suppression of the renderer-owned 450 ms
full-map cursor-blink interval.  That timer was an unnecessary performance cost
on the aligned 32x32+ canvas, but is no longer documented as the primary freeze
cause.  The selected-cell outline remains visible as a static outline.

### Browser diagnostic mode

Launch the editor as `index.html?bwdebug=1` (or append `#bwdebug`) to enable a
small on-screen diagnostic panel.  It records:

- map-click capture;
- whether the event loop resumed after the click;
- `BWRenderer.render` start/end timing and selected coordinate;
- guarded cell-property observer passes and suppressed self-mutations;
- browser errors and unhandled promise rejections.

The same log is available as `window.BWDEBUG.dump()` in the browser console, and
the panel has a **COPY DEBUG** button.  This mode is deliberately opt-in and has
no logging/render-timing overhead in normal use.


## Editor source loading

The HTML5 editor now treats the checked-in Spectrum tapes as its default startup sources:

- `data/Bloodwych - Level Data [ZX Spectrum].tzx` supplies the live editable tower/map model;
- `data/Bloodwych - The Game [ZX Spectrum].tzx` supplies the source graphics/tables used by the first-person renderer.

When the editor is served over HTTP/HTTPS (including GitHub Pages or the repository-local launcher), both defaults are loaded automatically on startup. When `index.html` is opened directly as `file://`, the browser cannot read sibling files with `fetch()`, so startup instead loads the same default Game TZX, Level Data TZX and renderer reference CSV from the raw `HoraceAndTheSpider/Bloodwych-z80` GitHub `main` branch. The existing **OPEN LEVEL TAPE** control remains a Level-TZX override and **OPEN GAME TAPE** is the equivalent Game-TZX override. **BUNDLED LEVEL TZX** / **BUNDLED GAME TZX** restore the repository defaults. A Game override is validated for the unique `$A500` flag-`$FF` payload and Spectrum XOR parity before it replaces the active renderer source.

For testing the exact files in a local checkout (including uncommitted local TZX changes), use `START-LOCAL.command` on macOS (or `python3 tools/serve_editor.py`; `START-LOCAL.bat` is supplied for Windows). The launcher is standard-library only, serves the repository on loopback, opens `index.html`, and makes startup use the checkout's local `.tzx` and CSV files. Direct `file://` use instead follows GitHub `main`; if that network fetch is unavailable, the normal **OPEN LEVEL TAPE** / **OPEN GAME TAPE** overrides remain available.
