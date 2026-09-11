# AGENTS.md — Bloodwych ZX Spectrum Reverse Engineering, Wiki and Editor

## Project purpose

This repository has three related purposes:

1. preserve and reverse-engineer the ZX Spectrum version of **Bloodwych** accurately;
2. build a durable, wiki-style technical reference covering the game's mechanics, data, graphics, rendering and runtime behaviour;
3. use that verified knowledge to support the HTML5 Bloodwych ZX editor/viewer.

The **master wiki/reference is the durable knowledge product**. Editor milestones and numbered research snapshots are useful history, but they must not become the primary documentation architecture. Organise durable documentation by game topic and subsystem, not by the order in which discoveries were made.

---

## Authority

For ZX work use, in order:

1. the supplied/current ZX Game and Level Data TZX files;
2. demonstrated Z80 loading, access, mutation and rendering behaviour;
3. verified ZX reverse-engineering documentation and machine-readable tables in this repository;
4. controlled emulator/editor/runtime validation;
5. contemporary ZX Spectrum documentation where it clearly refers to the Spectrum version;
6. other-platform Bloodwych implementations only as comparison.

Do not copy Amiga/68k semantics onto ZX structures merely because concepts, names or editor layouts are similar. Cross-platform material may suggest hypotheses, terminology or plausibility checks, but it is not proof of a ZX byte meaning unless ZX data/code independently supports it.

---

## Canonical documentation model

The repository should evolve toward a topic-led wiki/reference covering, at minimum:

- Game TZX format and memory map;
- Level Data TZX format and tower layout;
- map cells and dungeon mechanics;
- first-person dungeon rendering;
- walls, doors, switches, sockets and other features;
- events and actions;
- special locations and teleport resources;
- graphics formats and low-level drawing routines;
- fonts, text and runes;
- objects and object behaviour;
- object graphics, colours and perspective rendering;
- champion templates and portraits;
- champion statistics;
- inventory, equipment, pockets and quantities;
- spellbook data, learned spells and spell mechanics;
- monster records;
- monster teams and placement;
- monster/champion appearance construction;
- monster/special live-entity rendering;
- projectiles and spell entities;
- runtime overlays and initialisation;
- editor integration rules;
- unresolved / research ledger.

Prefer canonical topic filenames such as:

```text
docs/wiki/game-tzx.md
docs/wiki/level-data.md
docs/wiki/graphics.md
docs/wiki/dungeon-rendering.md
docs/wiki/objects.md
docs/wiki/champions.md
docs/wiki/inventory.md
docs/wiki/spells.md
docs/wiki/monsters.md
docs/wiki/events.md
docs/wiki/special-locations.md
docs/wiki/editor-integration.md
docs/wiki/open-research.md
```

Exact names may evolve, but the principle is fixed: **organise by subject, not by research stage**.

---

## Research snapshots and historical stage documents

Existing Stage 5/Stage 6 documents remain valuable implementation and provenance history. Do not keep creating successive Stage 7/8/etc. documents as the permanent knowledge base. Once a finding is sufficiently verified, consolidate it into the relevant canonical wiki topic and update the open-research ledger.

A new contributor should be able to understand Bloodwych ZX by reading the canonical wiki without reconstructing the chronology of ChatGPT threads.

---

## Before starting new reverse-engineering work

Always inspect:

1. current `AGENTS.md`;
2. the canonical wiki topic(s) relevant to the task;
3. `docs/wiki/open-research.md`;
4. associated machine-readable tables;
5. current Game/Level TZX files;
6. existing implementation where it already consumes the data.

Do not repeat already-proved work merely to rediscover it. Before investigating a field/table/routine, determine what is already **PROVEN**, what is **STRONG** but incomplete, what remains **OPEN**, and what evidence would close the question.

If old documentation conflicts with newer source proof, record the correction explicitly and update the canonical topic.

---

## Evidence and confidence

Use explicit confidence levels.

### PROVEN

Direct ZX evidence, for example: byte layout proved by access code; table boundary proved by sequential parsing; renderer directly consumes the field; mutation/death/action routine directly uses the value; emulator/editor test confirms the interpretation.

### STRONG

Multiple ZX correlations or a largely proved code path with one semantic detail still unresolved.

### OPEN

Observed raw data whose purpose is not sufficiently proved.

Do not promote an OPEN field to a friendly semantic label because another platform has a similar field. Unknown bytes must remain unknown until evidence supports a meaning.

---

## Correction policy

Accuracy takes priority over preserving an earlier interpretation. When new source evidence disproves an existing label:

1. do not rewrite the underlying source bytes;
2. record the old and new interpretations;
3. explain the ZX evidence causing the correction;
4. update the canonical wiki topic;
5. update editor labels only after the corrected meaning is sufficiently safe.

Known corrected monster fields include:

- `+$0A` = appearance/graphics selector;
- `+$0B` = dropped-object code;
- `+$0D` = special/live-entity/class/lifecycle field;
- `+$0E` = runtime visual/status/countdown state, authored Level records normally zero.

---

## Graphics reverse-engineering rules

ZX graphics are generally one-bit source graphics with colour applied separately through Spectrum attributes. Do not assume colour is embedded in the bitmap.

For self-describing records, prove the format and parse sequentially. For the masked graphics bank currently identified:

```text
width_bytes
height
image[width_bytes * height]
mask[width_bytes * height]
```

Do not scan arbitrary image/mask bytes for plausible `width,height` headers and treat them as records.

For actor/component composition:

- use only proved record starts;
- use package-selected explicit mask pointers;
- package byte 0 is a signed horizontal pixel offset;
- package byte 1 magnitude contributes the vertical offset, while its sign selects local-side/mirroring behaviour; it must not be simplified to an ordinary signed Cartesian Y coordinate;
- preserve facing/depth package selection;
- reproduce the normal/mirrored compositor behaviour rather than mirroring whole finished sprites;
- do not name a silhouette as a creature until the appearance mapping is supported.

Proof/contact sheets must be reproducible from source bytes and documented tables.

---

## Game TZX versus Level Data TZX

Keep the two source projects logically separate.

### Level Data TZX

Contains tower-specific authored resources such as starts, floor descriptors, map cells, special locations, team table, monster records, object arena and events.

### Game TZX

Contains global executable/resources such as graphics, rendering tables, object presentation definitions, fonts/runes, champion templates, spell definitions and global mechanics/tables.

The UI may present information from both together, but source bytes must remain attributable to the correct tape.

---

## Raw extraction convention

Verified Game and Level resource blocks may be exported under `data/extracts/` in a form comparable to the Bloodwych-68k extracted-data convention.

Requirements:

- extraction is deterministic from the checked-in TZX source;
- raw bytes remain primary; decoded CSV/JSON/PNG are derivative views;
- preserve source tape, file offset, RAM/loaded offset, length, SHA-256, description and confidence in a manifest;
- allow overlapping logical extracts where the original game deliberately reuses bytes;
- never replace the source TZX with an extracted/repacked equivalent;
- keep Game and per-tower Level extracts in separate trees.

`tools/extract_zx_resources.py` is the reference extractor for this convention.

---

## Preservation rules

Never overwrite source tapes automatically. Preserve unknown/reserved bytes, unrelated data, unused arena tails, TZX record structure, timing/pause metadata and untouched block bytes. Spectrum checksum/parity is derivative and should only change for a logically edited block.

Semantic operations should be transactional so Undo restores all companion bytes together. A no-op export must be byte-identical to the source.

---

## Existing Level Data model

Important loaded-payload ranges:

```text
$000-$005   P1/P2 starts
$006-$015   eight crystal/gem special-location records
$016-$01D   two teleport endpoint pairs
$022-$03F   five floor descriptors
$040-$44B   map workspace
$44C-$473   10 x 4 monster team table
$474        monster count/state
$475-$714   42 x 16-byte monster records
$715-$716   object-arena used length, little-endian
$717-$816   packed object arena
$817-$8CA   45 x 4 event/action records (Zendik tail exceptional)
```

Do not merge logically separate resources merely because they refer to the same map cell.

---

## Map flags

Working ZX map-byte model:

```text
bits 0-1  base cell type
bit 2     object-stack-present
bits 3-6  feature/orientation/state
bit 7     normally occupied/actor state
```

Door exception:

```text
bit 3     passage axis: 0=N/S, 1=E/W
bit 4     closed/blocking state
bits 5-7  lock/colour index 0-7
```

Door bit 7 must not also be interpreted as monster occupancy. Semantic object editing must maintain bit 2. Semantic positioned-monster/team editing must maintain bit 7 on non-door cells and reject door destinations. Never clear one companion flag while updating the other.

---

## First-person dungeon rendering

The authentic renderer is source/table driven, not editor-art driven.

Current proved pipeline:

```text
player floor/X/Y/facing
 -> four-way view transform at $8FF7
 -> 13 surrounding map samples
 -> wall visibility/occlusion from $9067/$908E
 -> 19 perspective slots
 -> wall or non-wall painter branch
```

For a non-wall visible slot the proved painter order is:

```text
floor feature
objects in sub-positions 2/3
door
objects in sub-positions 0/1
actor/team
```

Wall switches and gem sockets are perspective overlays, not UI icons. The switch descriptor is `$88AC`; the socket descriptor is `$950D`. Preserve face/orientation filtering before drawing them.

Do not render dungeon objects by scaling inventory icons when dedicated perspective graphics exist.

---

## Events

Use the source-offset-keyed Event table at loaded `$817`. Do not revive sequential switch numbering. A map-cell feature value alone is not the complete Event meaning; derive actions such as Tower exit, Vivify and teleport from the linked Event record.

Preserve known capacity constraints: Archaus has no spare Event slot; Zendik slots 36-44 contain protected ending-message storage.

---

## Objects

The Level-TZX object arena has used length at `$715-$716` and fixed arena `$717-$816`. Do not rewrite the unused tail.

Keep separate:

- object code;
- inventory graphic;
- Spectrum colour/attribute definition;
- dungeon perspective graphic family;
- object state;
- quantity;
- packed sub-cell position.

The sub-cell position is facing-rotated before perspective placement; use the source rotation table rather than treating it as a screen quadrant.

---

## Champions and inventory

Global champion templates are 16 records, stride `$5A`, containing portrait + name + 43-byte champion data. The selection path copies the 43-byte data area byte-for-byte into runtime state.

Starting inventory editing should expose the ten proved equipment/pocket bytes at champion-data `+$17-$20`. Coinage/Common-Key indicators are separate. Shared quantities for object codes `$01-$04` are stored separately at `+$13-$16`.

Unresolved champion bytes remain raw until proved.

---

## Spells

Keep separate spell definition/rune sequence, internal index, learned flag, prepared spell, continuing/worn spell, colour/class, effect routine and cost/difficulty/effect mechanics.

The `$6846` region is deliberately overlapping: low three bits of the first `$80` bytes provide 32×4 rune IDs while the same complete bytes participate in a packed 5-bit text/token dictionary. Do not invent spell mechanics from the upper five bits.

---

## Monsters and teams

Respect the 10×4 Level team table and X=`$FF` secondary-member behaviour. A team leader carries the team row in `+$0C`; secondary members normally carry `+$0C=$FF` and inherit contextual location from the leader.

Team edits must update the team table, leader/member location coupling and map occupancy as one semantic transaction. Distinguish ordinary authored monsters from runtime-created/special entities using the same 16-byte allocation.

---

## Editor integration

The editor is a consumer of the reverse-engineered model, not the authority for it. Prefer one shared model, table-driven rendering, raw-byte provenance, semantic controls only for proved meanings, and an advanced raw view for unresolved bytes.

Do not hard-code reverse-engineered tables independently in multiple UI files. Prefer machine-readable source tables under `data/reference/` and have renderers/editors consume them.

Keep the top-down map renderer separate from the authentic first-person renderer.

---

## Documentation requirements for new findings

For each meaningful new discovery capture source file/tape, RAM or loaded-data address, record/table size, access/render routine, byte/bit semantics, confidence, effect on prior documentation and editor implication.

If a discovery closes an item in `open-research`, update that ledger. If it changes a canonical model, update the relevant topic document rather than creating a new stage document.

Machine-readable CSV/JSON should accompany large tables where useful. Rendered proof PNGs should accompany visual data only where they materially help verification.

---

## Repo deliverables and packaging

When supplying a repository update to the user:

- provide **only files that are new or modified relative to the repository**, preserving repository-relative paths;
- the ZIP should be directly extractable at repository root;
- do not include unchanged repository files merely for context;
- do not include standalone-pack READMEs, duplicate source tapes, scratch files or packaging-only material unless they are themselves intended repository changes;
- generated data/reference or extract files should be included only when they are intended to live in the repository; otherwise provide the deterministic generator that recreates them from checked-in sources;
- provide additional files such as PNGs only when they materially **demonstrate an implementation** or **query/verify a finding or operation**;
- bulk screenshots, incidental contact sheets or exploratory images that are not needed for implementation/proof should stay outside the repo-update ZIP;
- if a proof image is included, place it in an intentional documentation/proof location and reference it from the relevant canonical topic;
- before delivering a ZIP, list and sanity-check its contents so the user can apply it without filtering unrelated files.

---

## Research completion standard

A topic is ready for editor integration when its primary byte layout is proved, important lookup tables are bounded, renderer/access logic is understood sufficiently to reproduce it, unresolved fields are explicitly isolated, no newer evidence contradicts the canonical interpretation, and machine-readable data is available where implementation would otherwise duplicate large constants.

Not every byte must be named before integration begins. It is acceptable to implement a partly understood structure provided proved fields are semantic, unresolved bytes are preserved/exposed as raw, and the implementation does not fabricate semantics.

---

## Validation

For Level-TZX changes continue to run the existing Stage 5/5.1 self-tests. Before enabling Game-TZX writes, add equivalent tests covering byte-identical no-op export, narrow champion edits, semantic edit+Undo, untouched TZX metadata and representative graphics rendered directly from Game-TZX source data.

Where visual rendering is implemented, validate representative outputs against emulator screenshots rather than only reconstructed contact sheets.

---

## Overall principle

The repository should become a **technical encyclopedia of Bloodwych ZX Spectrum**, backed by source evidence and usable by both humans and the editor. Research threads, stage numbers and temporary snapshots are means to that end, not the documentation structure itself.
