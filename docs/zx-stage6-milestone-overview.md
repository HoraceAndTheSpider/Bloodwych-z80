# Bloodwych ZX Spectrum — Stage 6 Reverse-Engineering Snapshot

Status: consolidated research snapshot for editor integration planning  
Repository authority: current `HoraceAndTheSpider/Bloodwych-z80` main branch  
ZX authority order: Game/Level TZX bytes -> demonstrated Z80 access/draw behaviour -> repository ZX documentation -> controlled comparison.

This snapshot is intentionally additive. It does not replace existing Stage 5 documents. Where Stage 6 evidence corrects a Stage 5 interpretation, the correction is listed explicitly in `zx-stage6-supersession-ledger.md`.

## Scope now covered

The current research provides implementation-grade or near-implementation-grade descriptions of:

- Game TZX main-code memory layout.
- ZX text font and spell-rune glyphs.
- raw and self-describing graphics records.
- the complete masked actor/component graphics bank.
- normal object graphic, colour and inventory-placeholder definitions.
- first-person dungeon wall/feature pointer and placement tables.
- the champion template record and portrait format.
- visible champion statistics and the inventory/pocket layout.
- shared object quantity counters.
- learned-spell flags and prepared/continuing spell state.
- monster teams, record allocation, corrected appearance/drop semantics.
- multipart monster/champion actor construction by facing and depth.
- editor-integration constraints and remaining unknowns.

## Critical Stage 6 corrections

1. Monster `+$0A` is an appearance/graphics selector, not simply a behaviour/AI selector.
2. Monster `+$0B` is the object dropped on death, not the form/graphic ID.
3. Monster `+$0D` is a special/live-entity class or lifecycle field; it is not the ordinary drop-object field.
4. Monster `+$0E` is runtime-only/status-oriented in supplied authored data and remains non-authorable until fully decoded.
5. The normal ZX object-presentation range is exactly `$00-$4B` (76 entries including empty). A following 12-entry table is inventory-placeholder artwork, not object IDs `$4C-$57`.
6. The ZX champion inventory contains ten actual equipment/pocket positions. Two additional separately drawn entries are fixed Coinage/Common-Key indicators, not free pockets.
7. The masked actor/component graphics bank continues through the valid transparent record at `$8274-$8277`; composition metadata begins at `$8278`.
8. All actor component X and Y placement bytes must be treated as signed.
9. Contact-sheet addresses such as `$7434/$7437`, `$7490`, `$777C` and `$7C00` are not independent graphic records.

## Integration posture

Do not implement the remaining open fields by analogy with the Amiga version. The editor should expose Stage 6-confirmed meanings where proved and retain raw-byte fallbacks for unresolved fields.

Recommended next implementation boundary:

- Game-TZX read-only viewer first.
- Object/graphics/champion template inspection next.
- Only then add Game-TZX editing with byte-preservation and exact export guarantees equivalent to the Level-TZX model.
