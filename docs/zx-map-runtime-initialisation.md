# Bloodwych ZX Spectrum — Map Flags and Tower-Load Initialisation

## Question addressed

The original ZX level map already contains object and monster/occupancy flags. On the related 68k version, comparable flags can be populated during tower initialisation from the object/monster resources.

This note records the current ZX conclusion.

## Map flag model

```text
bit 2  object stack present
bit 7  occupied / actor present
```

These can coexist on one cell.

## Object flag — bit 2

The static Z80 evidence shows direct maintenance during gameplay:

- placing/creating an object stack sets bit 2 on its map cell;
- removing the final relevant stack clears bit 2;
- moving stacks therefore requires old/new map cells to be updated.

The original TZX's active map cells and packed object-stack locations correlate directly.

### Tower-load behaviour

No complete tower-load pass has yet been identified that scans every packed object record and reconstructs bit 2 across the map.

**Current conclusion:** bit 2 should be treated as **persistent required map state**, not merely a disposable derived cache.

For editing, the object arena and bit 2 must always be updated together.

## Monster/occupancy flag — bit 7

The original TZX also contains bit 7 on actor-occupied cells.

Unlike objects, the Z80 has a distinct post-load monster preparation/initialisation path which iterates monster data after a tower has been loaded into the active runtime structures.

This indicates that actor occupancy is at least partly **derived/normalised runtime state** from the monster/team list.

**Current conclusion:** bit 7 does not appear to be the sole authoritative source of monster placement. Monster records/team data are authoritative enough for the game to prepare the active actor state after load.

However, because the original level payload already contains the bit and the exact stale-bit cleanup behaviour has not yet been proven experimentally, the editor should still preserve and maintain it rather than deliberately export inconsistent data.

## Recommended definitive runtime test

Four modified-level tests would settle the distinction completely:

1. leave monster record present but clear source-cell bit 7;
2. remove/move monster record but leave stale bit 7;
3. leave object stack present but clear source-cell bit 2;
4. remove/move object stack but leave stale bit 2.

Inspect the active runtime map after tower initialisation.

Expected from current static evidence:

- actor bit 7 is reconstructed/normalised from monster data;
- object bit 2 is not globally reconstructed and must already match the packed object data.

## Editor policy now

Do not wait for the runtime experiment before Stage 5.

Use conservative consistency rules:

- semantic object edits update bit 2 and object records together;
- semantic monster edits update actor/team data and bit 7 together;
- raw map editing can create inconsistency, but INFO/DATA should warn when companion resources disagree;
- preserve original flags in all untouched cells.
