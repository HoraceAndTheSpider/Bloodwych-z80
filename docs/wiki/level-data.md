# Level Data TZX and tower payload

## Tower payload — PROVEN

Each authored tower uses a loaded payload of:

```text
$08CB bytes
```

The ten current tower flags/names are:

```text
d  Keeps
e  Serpents
f  Serpent2
g  Moons
h  Moon2
i  Dragons
j  Dragon2
k  Archaus
l  Chaos2
m  Zendiks
```

The extractor strips the Spectrum flag/parity bytes but otherwise preserves each `$08CB` payload exactly.

## Editor-critical layout

```text
$000-$005  player starts: P1 X/Y/floor, P2 X/Y/floor
$006-$015  eight packed crystal/gem special-location records
$016-$01D  two teleport endpoint pairs
$01E       progression field
$01F       segment/tower number
$020-$021  runtime/scratch state; preserve raw
$022-$03F  five 6-byte floor descriptors
$040-$44B  $40C-byte map workspace
$44C-$473  10 x 4 monster team table
$474       authored monster count/state
$475-$714  42 x 16-byte monster allocation
$715-$716  object-arena used length, little-endian
$717-$816  256-byte packed object arena
$817-$8CA  45 x 4-byte Event/action records
```

Zendik is exceptional: the Event tail includes protected ending-message storage and must not be treated as spare Event capacity.

## Floor descriptors — PROVEN

Each of the five descriptors is:

```text
+$00 width
+$01 height
+$02-$03 map-workspace offset, big-endian
+$04 Y alignment/offset
+$05 X alignment/offset
```

A physical floor map is `width * height` bytes beginning at `map workspace + offset`.


### Floor-alignment byte order — PROVEN correction

The alignment bytes are **Y then X**, not X then Y. This is directly
cross-checked against the authoritative Serpents payload rather than inferred
from the Amiga layout:

```text
Serpents floor 0: 10 x 6, stored +4/+5 = 15,0
$29 stairs: local (1,5), (7,5)

Serpents floor 1: 21 x 21, stored +4/+5 = 0,0
$31 stairs: local (1,20), (7,20)
```

Interpreting `+4 = Y 15` and `+5 = X 0` places both floor-0 stairs at world
coordinates `(1,20)` and `(7,20)`, exactly over their floor-1 counterparts.
The previous X/Y interpretation does not align them.

The same correction is independently confirmed one floor higher:

```text
floor 1 $19 ceiling holes: (13,2), (10,13)
floor 2 stored +4/+5:  2,2
floor 2 $21 floor pits:     (11,0), (8,11)
world positions:        (13,2), (10,13)
```

The HTML editor must therefore use the descriptor offsets only for **layout
world-space alignment**. Floor-local map coordinates remain zero-based and
Event/object map offsets remain based on the packed map workspace rather than
having the visual alignment offset added to them.

## Map byte

General model:

```text
bits 0-1  base cell type
bit 2     packed object stack present
bits 3-6  feature/orientation/state
bit 7     normally actor occupancy
```

Door exception:

```text
bit 3     N/S versus E/W passage axis
bit 4     closed/blocking
bits 5-7  lock/colour index
```

Door bit 7 is therefore not actor occupancy.

## Safe editor implication

Map geometry, object presence and actor occupancy are coupled but not interchangeable. Moving a team or object stack must update its companion map bit without destroying the other flag or unrelated feature/state bits.


## Map-presentation baseline — editor-facing

Map semantics are shared across the three presentation styles, but their visual
languages are deliberately kept separate:

- **Amiga / AMOS** is the default and follows the original AMOS editor where a
  ZX mapping is established;
- **CPC / Amstrad** retains the established monochrome/dotted viewer style and
  its own icon treatment;
- **Modern** retains the existing light floor, dark-wall and coloured-fixture
  presentation, with semantic corrections applied without replacing the style.

A semantic fix (for example a facing switch/socket or Mindrock) must therefore
be implemented in each style rather than by replacing all three with the AMOS
geometry.

For presentation, persistent object bit 2 is independent of the map icon. Actor
occupancy bit 7 is ignored only for walkable/floor cells. **Wall cells are also
an exception:** bit 7 is part of wall-fixture state and must be retained. Doors
continue to use bits 5-7 as their lock/colour field.

Currently established visual codes include:

```text
$00  empty space
$01  Reserved Space; Event context can refine its purpose
$03  plain stone wall
$0B  Mindrock                         user-confirmed presentation
$09  floor pad / trigger
$11  invisible floor pad / trigger
$19  ceiling / upper hole
$21  floor pit
$29  ladder up family
$31  ladder down family
```

Wall fixtures use a different split from the earlier Stage 5 presentation.
For wall cells, bits 5-6 select the perspective family, bits 3-4 retain N/E/S/W
facing, and bit 7 retains fixture state:

```text
cell & $60 = $20   dark / reserved wall-feature family ($950D graphics)
cell & $60 = $40   switch family ($88AC graphics)
cell & $60 = $60   crystal / gem socket family ($950D graphics)
bit 7              state: used/clicked switch, or filled socket
```

This is why `$63` is an **empty** socket while `$E3` is the corresponding
**filled** socket. The `$20` family (for example `$33`) is not labelled as a
normal socket; in the editor it is deliberately presented as a **normal wall with a black wall-mounted fixture** until its exact gameplay role is closed. The wall itself remains visible; only the fixture is black.

In the Amiga/AMOS style, locked doors use the AMOS convention where the lock
colour is a line **through the centre of the door**, rather than a coloured
block placed at the centre. The editor-facing lock names are now: `1 Void Lock` (black), `2 Common Lock` (tan/off-yellow), `3 Snake Lock` (green), `4 Chaos Lock` (yellow), `5 Dragon Lock` (red), `6 Moon Lock` (blue), and `7 Chromatic Lock` (white). Index 0 remains Unlocked.

`$01` is no longer magenta unknown. Authoritative Level-TZX examples establish
it as authored **Reserved Space**, rendered as a single dark-grey cell. Where an
Event uses that exact cell as its source, the Event can refine the label. A
proved example is Serpents floor 3 `(4,5)`, whose `$01` source is action `$0A`
(Turn 180) and is therefore shown as a spinner/turn trigger. `$01` cells without
such context remain Reserved Space.

Other unrecognised presentation codes are deliberately shown in **magenta as
unknown**. They must not silently fall through to blank space or a plain wall.


### Cell-property editor labels/state

The MAPS cell editor follows the same byte semantics as the renderer:

- raw floor feature `$3` is labelled **Ceiling Hole**;
- raw floor feature `$4` is **Floor Pit**;
- wall-family `$20` is **Dark wall fixture / reserved wall feature**;
- switches expose a separate state control: **On / unclicked** versus **Off / clicked**; the latter is bit 7 set and is rendered with the black clicked mark;
- Empty Socket, Switch and Filled Socket selections now write the correct `$60/$40/$E0` wall-family encodings rather than the earlier feature-nibble approximation;
- the wall-feature dropdown is re-synchronised from the decoded byte after every edit, so choosing Empty Gem Socket does not visually fall back to Plain wall.

### Layout/elevation validation

The selected floor always owns a **floor-local editable grid of exactly
`width x height` cells**. Alignment offsets do not enlarge that grid or create
editable-looking padding around it. They are used only to project another
floor into the selected floor's coordinate space for layout comparison.

LAYOUT is deliberately an elevation-only view, matching the Python editor's
purpose. Ordinary walls, doors, switches, sockets, Objects, Monsters, Events,
player starts and other map furniture are not drawn there. The selected floor
shows only established elevation-change families:

```text
$29 / $31  ladders up / down
$19        ceiling / upper hole
$21        floor pit
```

Adjacent-floor previews follow the Python editor's **world-aligned floor
geometry** rather than showing isolated symbols. When enabled, the complete
grid boundary of the neighbouring floor is projected through its X/Y alignment
offset and drawn translucently behind the selected floor. The selected floor's
editable grid is still exactly its own `width x height`; the adjacent grid is a
visual comparison layer only and cannot be clicked as extra map cells.

The aligned view now uses a **fixed world canvas of at least 32 × 32 cells**.
A selected floor is placed on that canvas at its X/Y alignment offset, but only
its actual `width × height` cells receive the strong/editable grid. This removes
the misleading editable-looking border while keeping enough world space to see
misaligned adjacent floors.

To make coincident adjacent-floor grid lines visible, their preview is nudged
by approximately **one fifth of the current cell size** on both axes (below negative, above positive; 6 px at a 32 px cell). This gives the adjacent geometry a clearer separation at ordinary zoom levels. Adjacent grids are drawn at about 46% opacity and adjacent elevation symbols at about 62% opacity, so the comparison layer remains visibly distinct without overpowering the selected floor.

Adjacent-floor *contents* are filtered to the elevation features that can link
back to the selected floor:

```text
below floor  $29 ladder UP, $19 ceiling/upper hole
above floor  $31 ladder DOWN, $21 floor pit
```

This matches the Python/Layout correlation: a `$21` floor pit expects a `$19`
ceiling hole on `floor - 1`, while a `$19` ceiling/upper hole expects a `$21`
floor pit on `floor + 1`.
Ladders retain their corresponding up/down adjacent-floor relationship.

The selected floor itself continues to show all established elevation-change
families. Ordinary walls, doors and wall furniture remain suppressed in Layout.
Mismatches are highlighted for review. Above/below previews are presentation
only and never change packed map coordinates or floor descriptors.


### Grid draw order

The selected-floor grid is drawn **after** the cell artwork in all three map
styles. This prevents wall/floor fills from erasing grid lines. The adjacent
Layout grids remain lower/translucent layers, while the selected-floor grid is
the strongest layer.


### Cursor and floor switching

The map cursor is a flashing selection outline. When changing floors, the editor
preserves the cursor's **world-space position** rather than its old local X/Y.
For example, if the next floor is aligned two cells differently, a local `(1,1)`
selection may become `(3,3)` on that floor. If the projected world position lies
outside the new floor, it is clamped to the nearest valid local cell.

`FIT` in aligned/Layout mode fits the fixed world canvas, not just the selected
floor bounds.
