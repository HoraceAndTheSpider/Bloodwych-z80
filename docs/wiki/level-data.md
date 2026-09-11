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
floor 1 $19 pits:       (13,2), (10,13)
floor 2 stored +4/+5:  2,2
floor 2 $21 openings:   (11,0), (8,11)
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

For presentation, persistent object bit 2 and ordinary actor-occupancy bit 7
are ignored when identifying a non-door cell. Doors are the exception because
bits 5-7 belong to their lock/colour field.

Currently established visual codes include:

```text
$00  empty space
$03  plain stone wall
$0B  Mindrock                         user-confirmed presentation
$09  floor pad / trigger
$11  invisible floor pad / trigger
$19  pit / lower opening
$21  upper / ceiling opening
$29  ladder up family
$31  ladder down family
```

Wall sockets and switches retain their N/E/S/W facing in the map icon. Empty
and filled sockets are visually distinct. In the Amiga/AMOS style, locked doors use the AMOS convention where the lock
colour is a line **through the centre of the door**, rather than a coloured
block placed at the centre. Other presentation styles retain their own door
language while consuming the same ZX lock/axis semantics.

Any non-door presentation code that is neither a proved/confirmed feature nor
normalised `$00`/`$03` is deliberately shown in **magenta as unknown**. It must
not silently fall through to blank space or a plain-wall icon. This makes
remaining map semantics visible for investigation without fabricating them.

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
$19        pit / lower opening
$21        upper / ceiling opening
```

Adjacent-floor previews follow the Python editor's **world-aligned floor
geometry** rather than showing isolated symbols. When enabled, the complete
grid boundary of the neighbouring floor is projected through its X/Y alignment
offset and drawn translucently behind the selected floor. The selected floor's
editable grid is still exactly its own `width x height`; the adjacent grid is a
visual comparison layer only and cannot be clicked as extra map cells.

To make coincident grid lines visible, the below-floor grid is displaced
**-1 actual canvas pixel** on both axes and the above-floor grid **+1 actual
canvas pixel** on both axes. This is a fixed presentation displacement rather
than a zoom-scaled map offset. Adjacent grids are drawn at about 32% opacity.

Adjacent-floor *contents* are filtered to the elevation features that can link
back to the selected floor:

```text
below floor  $29 ladder UP, $21 ceiling/upper hole
above floor  $31 ladder DOWN, $19 floor pit
```

This matches the Python Layout check: a floor pit expects a ceiling hole on
`floor - 1`, while a ceiling/upper hole expects a floor pit on `floor + 1`.
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
