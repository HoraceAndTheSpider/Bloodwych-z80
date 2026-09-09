# Bloodwych ZX — Stage 5 edit session

## Project shape

The browser owns one `EditSession`:

```text
sources.level  current Level Data TZX/TAP
sources.game   reserved for future Game-TZX support
```

Stage 5 only loads/exports `sources.level`. Reserving the Game role now avoids replacing the session architecture later when champion/global resources are added.

## Original versus modified bytes

Each tape data block retains:

- `originalRaw` — immutable bytes from the loaded source;
- `raw` — in-memory working copy.

All semantic editors patch explicit offsets in `raw`. Unknown blocks/bytes are never regenerated.

## Transactions and Undo

A semantic operation may touch several locations. Examples:

- Object move -> packed location + old map bit 2 + new map bit 2;
- Monster move -> record X/Y/floor/rotation + old bit 7 + new bit 7;
- Event edit -> up to four record bytes.

`session.transact()` groups these writes into one Undo step. Repeated writes to the same byte inside one operation are compacted to the first `before` and final `after` value. A thrown validation/capacity error rolls back all writes in that transaction.

## Parity

Spectrum XOR parity is not counted as an intended logical edit.

- unchanged block -> preserve original supplied parity byte;
- logically edited block -> recalculate parity;
- Undo returning all logical bytes to the original -> restore original supplied parity.

This ensures a no-op export is byte-identical and avoids normalising unrelated source data.

## Export

`rebuildLevelTape()` starts from the original full tape and replaces only the working bytes of data blocks. TZX text records, block lengths and timing/pause metadata are not rebuilt.

Stage 5 exports only the Level Data tape. A combined exporter is intentionally absent until Game-TZX support has equivalent byte-preservation guarantees.
