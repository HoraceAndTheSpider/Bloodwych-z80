# Stage 5 Validation

## Source identity

The bundled authoritative Level Data TZX is the current repository blob:

```text
size      22620 bytes
SHA-256   25e716434acdb8220fa5ba1449b2247d20e2112578f20cb6e10cd69ff9cd1206
Git blob  0f964b771363c9c9152437ec38dfcb573665ea69
```

All ten `d..m` data blocks are 2253 bytes and have valid Spectrum XOR parity.

## Automated model/export test

Run:

```bash
node tools/stage5_selftest.js
```

Covered checks:

1. authoritative source SHA-256;
2. ten complete Stage 5 level payloads and valid parity;
3. every non-empty crystal/socket record resolves through the 12-bit map-workspace-offset packing;
4. all ten authoritative towers pass the Object/positioned-Monster companion consistency audit;
5. unmodified export is byte-identical;
6. documented Event capacities for all ten towers;
7. Archaus full capacity and Zendik protected tail;
8. single raw map edit changes only the cell byte plus affected parity;
9. Event semantic edit/source-key behaviour + exact Undo;
10. Event addition uses a real free slot;
11. Object move maintains map bit 2 and preserves unused arena tail;
12. Object stack growth consumes only newly used arena bytes;
13. Monster move maintains bit 7 while preserving bit 2;
14. team validation/edit + exact Undo;
15. player starts, progression, semantic teleport endpoints and semantic crystal/socket locations + exact Undo;
16. Zendik ending text survives unrelated edits;
17. overflow/invalid Event, Object, floor, player-start and special-location operations roll back cleanly.

## Acceptance result

The byte/model acceptance checks for Stage 5 pass against the exact authoritative TZX.

Browser presentation is implemented as ordinary static HTML/CSS/JavaScript with no build dependency. JavaScript source files are syntax-checked with `node --check` as part of packaging.

## Known diagnostics

The original level maps can contain stored bit-7 occupancy/cache state beyond the immediately positioned monster list. Because Z80 tower initialisation appears to normalise actor state, Stage 5 only treats a positioned monster with a missing bit 7 as a consistency error; an extra stored bit 7 is preserved and remains visible through the raw map/INFO data rather than being silently cleared.
