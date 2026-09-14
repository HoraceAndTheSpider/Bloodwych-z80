# AGENTS.md — Bloodwych 8-bit ReSource, Wiki and Editor

## Project purpose

This repository is currently the active **ZX Spectrum** reverse-engineering and editor project for **Bloodwych**, but the intended scope is broader than one machine.

The project has four related purposes:

1. preserve and reverse-engineer the ZX Spectrum version accurately;
2. build a durable technical reference that can later encompass **ZX Spectrum, Amstrad CPC and Commodore 64** findings without confusing platform-specific formats;
3. use verified knowledge to support the HTML5 editor/viewer and related extraction/rendering tools;
4. work toward a **complete annotated SkoolKit source/disassembly of the ZX Spectrum Game image** as a long-term deliverable.

The public GitHub Wiki is the durable knowledge product:

`https://github.com/HoraceAndTheSpider/Bloodwych-z80/wiki`

The older Bloodwych-68k Wiki is a useful guide to documentation depth and topic organisation, but it is **comparison evidence only**:

`https://github.com/HoraceAndTheSpider/Bloodwych-68k/wiki`

Do not copy 68k byte semantics, addresses or renderer assumptions onto an 8-bit port without independent platform evidence.

---

## Documentation architecture

The GitHub Wiki should be organised by **game topic / subsystem**, not by research thread, chat number or milestone stage.

Permanent topic pages should explain:

- what the structure means in plain language;
- technical addresses/offsets and record lengths;
- byte/bit definitions;
- routines or tables that prove the interpretation;
- editing/rendering implications;
- confidence level for anything not fully closed.

### Exactly one progress page

Use **one and only one Wiki page** for rolling project progress, priorities and next steps:

`Current-Status.md`

All other Wiki pages are durable reference pages. A topic page may state that an individual field or routine is **OPEN**, but must not grow its own separate roadmap or “next investigation” list.

### Platform-specific naming

If a finding is only proved for one platform, the Wiki page title must identify the platform, e.g.:

- `ZX Spectrum - Level Data and Tower Structure`
- `ZX Spectrum - First-person Dungeon Rendering`
- future `Amstrad CPC - Graphics and Rendering`
- future `Commodore 64 - Graphics and Rendering`

Use a platform-neutral page only for structures genuinely shown to be shared, or for a comparison page that clearly labels what remains unverified.

### Repository `docs/` versus GitHub Wiki

Historical Stage 5/Stage 6 documents in `docs/` remain useful provenance. Topic-led material under `docs/wiki/` may continue to act as a working/source-backed mirror, but the public GitHub Wiki is the preferred handover/reference surface.

Do not create endless Stage 7/Stage 8/etc. documentation as the permanent architecture. Consolidate verified discoveries into the relevant Wiki topic.

---

## Before starting work

Before new reverse-engineering or editor work:

1. read current `AGENTS.md`;
2. read the relevant GitHub Wiki topic pages;
3. read `Current-Status.md` for the current unresolved priorities;
4. inspect any associated machine-readable tables under `data/reference/`;
5. inspect the current source Game/Level media for the target platform;
6. inspect the current implementation if it already consumes the structure;
7. check older Stage documents only where they contain provenance or unresolved detail not yet consolidated.

Do not repeat already-proved research merely to rediscover it.

---

## Authority and confidence

### ZX Spectrum authority order

For ZX work use, in order:

1. current checked-in ZX **Game TZX** and **Level Data TZX**;
2. demonstrated Z80 loading/access/mutation/rendering behaviour;
3. verified canonical Wiki findings and machine-readable reference tables derived from those bytes;
4. controlled emulator/editor mutation or rendering validation;
5. contemporary ZX documentation where relevant to the machine format;
6. CPC/C64/68k/PC Bloodwych material only as comparison.

When CPC or C64 investigation begins, apply the same principle with that platform's own executable/data first.

### Confidence labels

Use explicit confidence labels:

#### PROVEN

Direct platform evidence, e.g. executable access code, deterministic record boundaries, renderer table use, controlled mutation, emulator confirmation.

#### STRONG

Several independent correlations or a mostly proved code path with one semantic detail incomplete.

#### TENTATIVE

A useful working hypothesis with limited evidence. Do not convert this into a destructive editor operation or hide the raw value behind a friendly label.

#### OPEN

Observed bytes/routines/resources whose purpose is not sufficiently established.

Accuracy takes priority over preserving an older interpretation.

---

## Cross-platform policy

The project expects to support **ZX Spectrum, Amstrad CPC and Commodore 64**.

A current working hypothesis is that some **authored level data may be identical or closely related across the 8-bit ports**. This must be tested rather than assumed.

To promote a structure to “shared 8-bit” status, compare equivalent resources across platforms, ideally across several towers:

```text
tower/segment boundaries
player-start records
floor descriptors
map workspace
object packing
monster/team records
event/action structures
special-location records
```

Graphics and executable renderer code should be considered **platform-specific by default**. ZX, CPC and C64 have different display architectures, pixel packing, colour systems and — for C64 — CPU family.

Prefer this architecture when cross-platform editor support grows:

```text
shared semantic model only where proved compatible
  -> ZX parser/container + ZX renderer
  -> CPC parser/container + CPC renderer
  -> C64 parser/container + C64 renderer
```

Do not force CPC/C64 data into ZX encodings simply to reuse UI code.

---

## Game TZX versus Level Data TZX — ZX

Keep the two ZX source projects logically separate.

### Level Data TZX

Contains tower-specific authored resources such as starts, floor descriptors, map cells, special locations, team table, monster records, object arena and events.

### Game TZX

Contains global executable/resources such as graphics, renderer tables, object presentation definitions, fonts/runes, champion templates, spell definitions and global mechanics/tables.

The UI may present both together, but every byte must remain attributable to the correct source tape.

---

## Existing ZX Level Data model

Each loaded tower payload is `$08CB` bytes.

Important offsets:

```text
$000-$005   P1/P2 starts
$006-$015   eight crystal/gem special-location records
$016-$01D   two teleport endpoint pairs
$01E        progression field (Zendik exceptional)
$01F        segment/tower number
$020-$021   runtime scratch/state; preserve raw
$022-$03F   five 6-byte floor descriptors
$040-$44B   $40C-byte map workspace
$44C-$473   10 x 4 monster team table
$474        monster count/state
$475-$714   42 x 16-byte monster records
$715-$716   object-arena used length, little-endian
$717-$816   256-byte packed object arena
$817-$8CA   45 x 4 Event/action records
```

Zendik Event slots 36-44 are protected ending-message storage rather than free Event capacity.

### Floor descriptors — corrected order

Each descriptor is:

```text
+$00      width
+$01      height
+$02-$03  map-workspace offset, big-endian
+$04      Y alignment
+$05      X alignment
```

The Y/X order is source-validated by cross-floor stair/pit/hole alignment and must not regress to the earlier X/Y interpretation.

---

## ZX map byte rules

Structural model:

```text
bits 0-1  base cell type
bit 2     object-stack-present
bits 3-6  feature/orientation/state
bit 7     normally actor occupancy, with family-specific exceptions
```

Base types:

```text
0 floor/space
1 floor feature
2 door
3 stone wall
```

### Door exception

For base type 2:

```text
bit 3     passage axis: 0=N/S, 1=E/W
bit 4     closed/blocking state
bits 5-7  lock/colour index 0-7
```

Door bit 7 must not be interpreted as actor occupancy.

### Wall fixture state

For wall cells:

```text
cell & $60 = $20  dark/reserved wall-feature family
cell & $60 = $40  switch family
cell & $60 = $60  crystal/gem socket family
bits 3-4          wall face N/E/S/W
bit 7             fixture state (e.g. clicked switch / filled socket)
```

Do not normalise bit 7 away on wall fixtures.

### Reserved `$01`

`$01` is authored Reserved Space. Event context can refine individual instances, e.g. a linked spinner action. Do not globally rename `$01` as anti-magic or another special feature until runtime code proves that meaning.

---

## ZX graphics reverse-engineering rules

ZX source artwork is generally one-bit with Spectrum attributes applied separately. Do not bake guessed colours into extracted bitmaps.

### Image-only records

```text
width_bytes
height
bitmap[width_bytes * height]
```

### Sequential masked records

The `$6D8A-$8277` bank contains 162 sequential records:

```text
width_bytes
height
image[width_bytes * height]
mask[width_bytes * height]
```

Parse sequentially from the proved start; never scan arbitrary bitmap/mask bytes for plausible width/height headers.

### Actor/component packages

- use proved record starts;
- use package-selected explicit mask pointers;
- package byte 0 is signed horizontal displacement;
- package byte 1 magnitude contributes vertical displacement;
- package byte 1 sign also affects local-side/mirroring behaviour and must not be simplified to a normal signed Y coordinate;
- preserve facing/depth package selection;
- reproduce source normal/mirrored compositor behaviour rather than mirroring a completed sprite;
- do not assign creature names to silhouettes without supported appearance mapping.

---

## ZX first-person dungeon renderer

The authentic renderer is source/table driven, not editor-art driven.

Current proved pipeline:

```text
player floor/X/Y/facing
 -> facing-relative sample transform at $8FF7
 -> 13 surrounding map samples (+ current-cell sample 13)
 -> wall draw/occlusion masks at $9067/$908E
 -> 19 perspective slots
 -> wall or non-wall painter branch
```

For a non-wall visible slot:

```text
floor feature
objects in sub-positions 2/3
door
objects in sub-positions 0/1
actor/team
```

Wall switches and gem sockets are source perspective overlays, not UI icons.

### Emulator-validated display corrections

The completed 104×64 logical work buffer must be displayed **bottom-to-top**:

```text
work row 63 -> display top
work row 0  -> display bottom
```

Do not “fix” individual graphics by vertically reversing their source records.

The mirrored companion of the central paired wall uses the **same vertical origin** as its first half. Do not reintroduce the earlier one-scanline seam.

### Closed doors

Door map semantics and static `$897B` overlay are known, but the visible closed-door panel/frame depends on procedural code around `$BBF3-$BD17` and geometry at `$9617/$9637`.

Do not fabricate substitute door artwork. Until the procedural path is ported, identify the case as incomplete.

### Ladders

`$29/$31` static descriptor families are known, but their extra `$28/$30` procedural supplement remains incomplete. Do not approximate it silently.

---

## ZX Events

Use the source-offset-keyed Event table at loaded `$817` / runtime `$A5D4`.

Record structure:

```text
byte 0 bits 0-2  source map-offset bits 8-10
byte 0 bits 3-7  action selector
byte 1           source map-offset bits 0-7
byte 2 bits 0-4  target X
byte 2 bits 5-7  target floor
byte 3           target Y
```

Do not revive sequential switch numbering. A map feature byte alone is not the complete action meaning; linked Event context supplies Vivify, teleport, progression, spinner, wall mutation etc.

Preserve capacity constraints: Archaus has no free normal Event slots; Zendik 36-44 are protected ending text.

---

## ZX Objects

The Level object arena has used length at `$715-$716` and fixed storage `$717-$816`.

Keep separate:

- object code;
- inventory graphic;
- Spectrum attributes;
- dungeon perspective graphic family;
- packed sub-cell position;
- per-object state/quantity.

The mini-position is rotated by player facing before perspective placement. Use the source rotation/coordinate tables; do not treat it as a fixed screen quadrant.

Dedicated perspective graphics exist. Do not render dungeon objects by scaling inventory icons.

Preserve the unused arena tail byte-for-byte.

---

## ZX Monsters and teams

Level allocation:

```text
$44C-$473  10 x 4 team-member indexes
$474       monster count/state
$475-$714  42 x 16-byte records
```

Corrected important record fields include:

```text
+$00       X; $FF secondary team member
+$01       Y
+$03       floor
+$05       base level
+$06       current/effective level
+$07-$08   current HP little-endian
+$0A       appearance/graphics selector
+$0B       dropped-object code
+$0C       team relationship
+$0D       special/live-entity class/lifecycle field
+$0E       runtime visual/status/countdown state
```

A team leader carries location/context; secondary members can use X=`$FF`.

Semantic team moves must update team membership, leader location, inherited member context and map occupancy as one transaction.

Door cells are invalid semantic actor destinations because door bit 7 belongs to the lock field.

---

## ZX Champions, inventory and spells

Champion templates begin at `$9B23`, 16 records, stride `$5A`:

```text
+$00-$1D  portrait
+$1E-$2D  name
+$2E       separator
+$2F-$59  43-byte champion data
```

The selection path copies the 43-byte data area byte-for-byte into runtime state.

Ten authored equipment/pocket bytes are champion-data `+$17-$20`.

Object `$01-$04` quantities are separate at `+$13-$16`.

Coinage/Common-Key indicator objects are separate at `+$21/$22`; do not expose them as free pockets.

Spell rune bytes at `$6846` overlap the packed text/token dictionary. Only the low three bits are proven rune IDs; do not invent spell flags from the upper five bits.

---

## Special locations

Level offsets `$006-$015` contain eight independent two-byte crystal/gem lookup records.

`$016-$01D` contains two four-byte teleport endpoint pairs.

Do not merge:

- wall socket state;
- special-location identity;
- Event action;

into one synthetic editor record merely because they can refer to the same logical place.

---

## Editor integration rules

The editor is a consumer of the reverse-engineered model, not its authority.

Prefer:

- one shared byte model;
- machine-readable tables under `data/reference/`;
- source-driven renderers;
- raw-byte provenance;
- semantic controls only for meanings safe enough to edit;
- advanced raw views for unresolved bytes;
- transactional multi-byte edits with exact Undo.

Keep the top-down map renderer separate from the authentic first-person renderer while sharing the same source model.

### Startup sources

Normal startup should automatically load the default checked-in Level Data TZX and Game TZX. Either can later be overridden with a modified file.

For exact local checkout testing, a lightweight local server is preferred so browser `fetch()` can read sibling TZX/CSV files. Direct `file://` use may fall back to raw GitHub defaults or manual file selection.

### Navigation

Follow the 68k Python editor movement convention unless a deliberate UX change is agreed:

```text
Q/E  turn left/right
W/S  forward/back relative to facing
A/D  strafe relative to facing
Arrow keys  absolute map movement
```

Editor cursor movement ignores gameplay collision.

### Debugging

Retain an opt-in browser debug mode (currently `?bwdebug=1` / `#bwdebug`) for selection/render/observer timing and error capture when UI lockups are investigated.

---

## Preservation and validation

Never overwrite source media automatically.

Preserve:

- source TZX/DSK/D64 files;
- unknown/reserved bytes;
- untouched TZX records/timing metadata;
- unused object-arena tails;
- protected Zendik ending data;
- unrelated bytes when performing a narrow semantic edit.

A no-op export must be byte-identical.

Before enabling or expanding write-back, test:

- byte-identical no-op export;
- narrow semantic edit scope;
- exact Undo;
- checksum/parity changes only where logically required;
- representative emulator validation;
- round-trip reparsing of edited structures.

Where visual rendering is implemented, compare representative frames against emulator screenshots rather than relying only on reconstructed contact sheets.

---

## SkoolKit long-term plan — ZX

A complete annotated SkoolKit source is a long-term project strand.

Requirements:

- use the authoritative loaded Game image;
- mark known data ranges so they are not mis-disassembled as code;
- preserve address-derived labels until routine purpose is proved;
- import known renderer/data labels from established research;
- connect routine comments to the canonical Wiki/data tables;
- validate source/disassembly output against the original binary image;
- avoid naming routines from 68k analogy alone.

The SkoolKit source should become another evidence surface feeding the Wiki/editor, not a competing interpretation.

---

## Wiki update packaging

The user will manually push periodic Wiki updates.

When supplying a Wiki update:

- provide a **separate contained ZIP** intended for the GitHub Wiki clone;
- include only Wiki Markdown/support files intended to live there;
- preserve stable page names where possible so links/history remain useful;
- update `Home.md` and `_Sidebar.md` when navigation changes;
- update `Current-Status.md` for progress/next steps;
- update permanent topic pages only with durable findings;
- do not create multiple progress/roadmap pages;
- do not put application code in the Wiki ZIP.

For a full replacement Wiki package, say explicitly that it is a full replacement rather than an incremental merge.

---

## Repository update packaging

Repository update ZIPs are separate from Wiki ZIPs.

When supplying a repository update:

- paths are relative to repository root;
- state clearly whether the ZIP is **add/replace only** or contains explicit deletions;
- never imply deletion of sibling files merely because a partial directory is included;
- take particular care with macOS Finder merge/replace behaviour;
- if a directory update could be mistaken for a wholesale replacement, either include the necessary companion files or make the add/replace-only intent unambiguous;
- include generated reference/extract files only if they are intended repository files;
- include proof PNGs only where they materially demonstrate or verify a finding;
- list and sanity-check ZIP contents before delivery.

---

## Overall principle

The project should become a **technical encyclopedia and reproducible ReSource of Bloodwych's 8-bit versions**, beginning with the ZX Spectrum and expanding carefully to CPC and C64.

The standard is not merely “the editor seems to work”. The standard is:

```text
source bytes understood where claimed
platform provenance explicit
unknowns preserved
rendering reproduced from authentic resources
technical findings explained clearly
future threads can continue without redoing settled research
```
