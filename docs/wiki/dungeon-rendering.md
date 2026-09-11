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
