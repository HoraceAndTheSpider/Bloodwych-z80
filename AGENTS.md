# AGENTS.md — Bloodwych ZX Spectrum Reverse Engineering, Wiki and Editor

## Project purpose

This repository has three related purposes:

1. preserve and reverse-engineer the ZX Spectrum version of **Bloodwych** accurately;
2. build a durable, wiki-style technical reference covering the game's mechanics, data, graphics, rendering and runtime behaviour;
3. use that verified knowledge to support the HTML5 Bloodwych ZX editor/viewer.

The **master wiki/reference is the durable knowledge product**.

Editor milestones such as Stage 5 and research snapshots such as "Stage 6" are useful as implementation/history checkpoints, but they must **not become the primary documentation architecture**.

Documentation should ultimately be organised by game topic and subsystem, not by the order in which discoveries were made.

---

## Authority

For ZX work use, in order:

1. the supplied/current ZX Game and Level Data TZX files;
2. demonstrated Z80 loading, access, mutation and rendering behaviour;
3. verified ZX reverse-engineering documentation and machine-readable tables in this repository;
4. controlled emulator/editor/runtime validation;
5. contemporary ZX Spectrum documentation where it clearly refers to the Spectrum version;
6. other-platform Bloodwych implementations only as comparison.

Do not copy Amiga/68k semantics onto ZX structures merely because concepts, names or editor layouts are similar.

Cross-platform material is useful for:
- suggesting hypotheses;
- providing friendly terminology;
- checking whether a ZX interpretation is plausible.

It is **not proof of a ZX byte meaning** unless the ZX data/code independently supports it.

---

## Canonical documentation model

The repository should evolve toward a topic-led wiki/reference covering, at minimum:

- Game TZX format and memory map
- Level Data TZX format and tower layout
- map cells and dungeon mechanics
- first-person dungeon rendering
- walls, doors, switches, sockets and other features
- events and actions
- special locations and teleport resources
- graphics formats and low-level drawing routines
- fonts, text and runes
- objects and object behaviour
- object graphics, colours and perspective rendering
- champion templates and portraits
- champion statistics
- inventory, equipment, pockets and quantities
- spellbook data, learned spells and spell mechanics
- monster records
- monster teams and placement
- monster/champion appearance construction
- monster/special live-entity rendering
- projectiles and spell entities
- runtime overlays and initialisation
- editor integration rules
- unresolved / research ledger

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

Existing Stage 5 documents remain valuable implementation history.

Research snapshots or "Stage 6" documents may also be retained when they provide:
- dated evidence;
- transitional correction ledgers;
- machine-readable exports;
- proof images;
- a safe checkpoint before a long new investigation.

However:

- do not keep creating successive `stage7`, `stage8`, etc. documents as the permanent knowledge base;
- do not duplicate a solved finding across many stage files;
- once a finding is sufficiently verified, consolidate it into the relevant canonical wiki topic;
- retain the snapshot only as provenance/history if useful;
- future work should read the canonical wiki plus the open-research ledger before investigating.

The objective is that a new contributor can understand Bloodwych ZX by reading the wiki **without reconstructing the chronology of ChatGPT threads**.

---

## Before starting new reverse-engineering work

Always inspect:

1. current `AGENTS.md`;
2. the canonical wiki topic(s) relevant to the task;
3. `docs/wiki/open-research.md` or its current equivalent;
4. any machine-readable tables associated with the topic;
5. current Game/Level TZX files;
6. existing implementation where it already consumes the data.

Do not repeat already-proved work merely to rediscover it.

Before investigating a field/table/routine, determine:

- what is already PROVEN;
- what is STRONG but incomplete;
- what remains OPEN;
- what specific evidence would close the open question.

If old documentation conflicts with newer source proof, record the correction explicitly and update/consolidate the canonical topic.

---

## Evidence and confidence

Use explicit confidence levels.

### PROVEN

Direct ZX evidence, for example:
- byte layout proved by access code;
- table boundary proved by sequential parsing;
- renderer directly consumes the field;
- mutation/death/action routine directly uses the value;
- emulator/editor test confirms the interpretation.

### STRONG

Multiple ZX correlations or a largely proved code path with one semantic detail still unresolved.

### OPEN

Observed raw data whose purpose is not sufficiently proved.

Do not promote an OPEN field to a friendly semantic label because the Amiga version has a similar field.

Unknown bytes must remain unknown until evidence supports a meaning.

---

## Correction policy

Accuracy takes priority over preserving an earlier interpretation.

When new source evidence disproves an existing label:

1. do not rewrite the underlying source bytes;
2. record the old and new interpretations;
3. explain the ZX evidence causing the correction;
4. update the canonical wiki topic;
5. update editor labels only after the corrected meaning is sufficiently safe.

Example currently known corrections include the monster record interpretation discovered after Stage 5:
- `+$0A` is appearance/graphics-related rather than simply behaviour/AI;
- `+$0B` is the dropped-object code rather than the monster form;
- `+$0D` is a special/live-entity/lifecycle field rather than the ordinary drop object;
- `+$0E` remains runtime/status-oriented and should not be invented as an authored field.

Historical Stage 5 documentation may retain its original wording for provenance, but the canonical wiki must carry the corrected model.

---

## Graphics reverse-engineering rules

ZX graphics are generally one-bit source graphics with colour applied separately through Spectrum attributes.

Do not assume colour is embedded in the bitmap.

For self-describing records, prove the format and parse sequentially.

For the masked graphics bank currently identified:

```text
width_bytes
height
image[width_bytes * height]
mask[width_bytes * height]
```

Do not search arbitrary bytes for plausible `width,height` headers and treat them as new records.

Past false starts such as addresses inside image/mask payloads demonstrated why this is unsafe.

When reconstructing actor components:
- use only proved record starts;
- use package-selected explicit mask pointers;
- treat both X and Y component positions as signed where the Z80 does;
- preserve facing/depth package selection;
- do not name a silhouette as a creature until the appearance mapping is supported.

Proof/contact sheets must be reproducible from source bytes and documented tables.

---

## Game TZX versus Level Data TZX

Keep the two projects logically separate.

### Level Data TZX

Contains tower-specific authored resources such as:
- starts;
- floor descriptors;
- map cells;
- special locations;
- team table;
- monster records;
- object arena;
- events.

### Game TZX

Contains global executable/resources such as:
- graphics;
- rendering tables;
- object presentation definitions;
- fonts/runes;
- champion templates;
- spell definitions;
- global mechanics/tables.

Do not create a combined Game+Level exporter until both tape types have independent byte-preserving project support.

The UI may present information from both together, but their source bytes must remain attributable to the correct tape.

---

## Preservation rules

Never overwrite source tapes automatically.

Preserve:
- unknown bytes;
- reserved bytes;
- unrelated data;
- unused arena tails;
- TZX record structure;
- pause/timing metadata;
- untouched block bytes.

Spectrum checksum/parity is derivative and should only change for a logically edited data block.

Semantic operations should be transactional so Undo restores all companion bytes together.

A no-op export must be byte-identical to the source.

If a semantic write requires changing multiple coupled bytes, document the coupling and update them as one transaction.

---

## Existing Level Data model

The current Level Data loaded-payload model remains authoritative unless newer Z80 evidence corrects it.

Important ranges include:

```text
$006-$015   eight independent crystal/gem special-location records
$016-$01D   two teleport endpoint pairs
$022...     floor descriptors
$040...     map workspace
$44C-$473   10 x 4 monster team table
$474        monster count/state
$475-$714   42 x 16-byte monster records
$715-$716   object-arena used length, little-endian
$717-$816   packed object arena
$817...     event table
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

Door bit 7 must not also be interpreted as monster occupancy.

Semantic object editing must maintain bit 2.

Semantic positioned-monster editing must maintain bit 7 conservatively on non-door cells and reject door destinations.

Never clear one companion flag while updating the other.

---

## Events

Use the source-offset-keyed Event table at loaded `$817`.

Do not revive sequential switch numbering.

A map-cell feature value alone is not the complete Event meaning. Derive actions such as Tower exit, Vivify and teleport from the linked Event record.

Preserve known capacity constraints:
- Archaus has no spare Event slot;
- Zendik slots 36-44 contain protected ending-message storage.

---

## Objects

The Level-TZX object arena remains a packed resource with used length at `$715-$716` and fixed arena `$717-$816`.

Do not rewrite the unused tail.

Game-TZX object presentation is separate from Level-TZX object placement/state.

Current global object-presentation namespace is `$00-$4B`.

Keep separate:
- object code;
- inventory graphic;
- Spectrum colour/attribute definition;
- dungeon perspective graphic family;
- object state;
- quantity;
- placement.

Do not render dungeon objects by scaling inventory icons when the game contains dedicated perspective representations.

---

## Champions and inventory

Global champion templates live in Game-TZX resources and should not be confused with post-selection runtime structures.

Current template model:

```text
16 records
stride $5A
portrait + name + 43-byte champion data
```

Champion inventory should expose the proved ten actual equipment/pocket positions rather than treating the separately rendered Coinage/Common-Key indicators as free pockets.

Unresolved champion bytes must remain raw until proved.

---

## Spells

Keep these concepts separate:

- spell definition/rune sequence;
- internal spell index;
- learned-spell availability bit;
- prepared spell;
- continuing/worn spell;
- spell colour/class;
- spell effect routine;
- spell cost/difficulty/effect mechanics.

Friendly names may be supplied from reliable Spectrum documentation or cross-version corroboration, but the internal ZX index remains the authoritative key.

---

## Monsters and live entities

Respect the 10 x 4 Level-TZX team table and X=`$FF` secondary-member behaviour.

Use the current corrected monster field interpretation from the canonical monster wiki.

Do not expose runtime-only fields as normal authored controls.

Distinguish:
- ordinary placed monsters;
- champion-like/humanoid appearance composition;
- large/special entities;
- projectiles/spell entities.

The same 16-byte allocation can contain runtime-created entities with values that do not have the same semantics as normal authored monsters.

---

## Editor integration

The editor is a consumer of the reverse-engineered model, not the authority for it.

Prefer:
- one shared model;
- table-driven rendering;
- raw-byte provenance;
- semantic controls only for proved meanings;
- advanced raw view for unresolved bytes.

Do not hard-code reverse-engineered tables independently in multiple UI files.

Prefer machine-readable source tables under a dedicated data/reference location and have renderers/editors consume them.

Keep the current top-down map renderer separate from any authentic first-person dungeon renderer.

---

## Documentation requirements for new findings

For each meaningful new discovery, capture:

- source file/tape;
- RAM or loaded-data address;
- record/table size;
- access/render routine;
- byte or bit semantics;
- confidence;
- effect on prior documentation;
- editor implication, if any.

If the discovery closes an item in `open-research`, update that ledger.

If it changes a canonical model, update the appropriate topic document rather than creating a new stage document.

Machine-readable CSV/JSON should accompany large tables where useful.

Rendered proof PNGs should accompany visual data where they materially help verification.

---

## Research completion standard

A topic is ready for editor integration when:

- its primary byte layout is proved;
- important lookup tables are bounded;
- renderer/access logic is understood sufficiently to reproduce it;
- unresolved fields are explicitly isolated;
- no known newer evidence contradicts the canonical interpretation;
- machine-readable data is available where implementation would otherwise duplicate large constants.

Not every byte must be named before integration begins.

It is acceptable to implement a partly understood structure provided:
- proved fields are semantic;
- unresolved bytes are preserved and exposed as raw;
- the implementation does not fabricate semantics.

---

## Validation

For Level-TZX changes continue to run the existing Stage 5/5.1 self-tests.

Before enabling Game-TZX writes, add equivalent tests covering:

- byte-identical no-op Game export;
- one-field champion edit changes only intended bytes plus required checksum/parity;
- semantic edit + Undo returns exact source bytes;
- untouched TZX metadata remains byte-identical;
- representative graphics render directly from Game-TZX source data.

Where visual rendering is implemented, validate representative outputs against emulator screenshots rather than only against reconstructed contact sheets.

---

## Overall principle

The repository should become a **technical encyclopedia of Bloodwych ZX Spectrum**, backed by source evidence and usable by both humans and the editor.

Research threads, stage numbers and temporary snapshots are means to that end, not the documentation structure itself.
