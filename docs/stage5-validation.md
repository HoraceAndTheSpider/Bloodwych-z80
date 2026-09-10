# Stage 5 / 5.1 Validation

## Source identity

The bundled authoritative Level Data TZX remains:

```text
size      22620 bytes
SHA-256   25e716434acdb8220fa5ba1449b2247d20e2112578f20cb6e10cd69ff9cd1206
Git blob  0f964b771363c9c9152437ec38dfcb573665ea69
```

All ten `d..m` data blocks are 2253 bytes and have valid Spectrum XOR parity.

## Existing Stage 5 model/export test

Run:

```bash
node tools/stage5_selftest.js
```

The existing suite continues to cover source identity, ten complete payloads, parity, Event capacity and editing, Object repacking/flags, Monster/team editing, Layout writes, Undo, byte-exact export and validation rollback.

## Stage 5.1 regression test

This update adds:

```bash
node tools/stage5_1_selftest.js
```

It checks the corrections introduced after the Stage 5 UI refactor:

1. door N/S and E/W axis decoding;
2. door closed-state and lock/colour index decoding;
3. door bit 7 is not reported as actor occupancy;
4. filled socket family `feature 12-15` and N/E/S/W facing;
5. all non-zero `$006-$015` locations resolve to filled socket cells;
6. special variants 0-5 have the expected crystal/teleport-gem names;
7. Keep Event slots 16 and 18 source `$09` pads and use action `$22`;
8. action `$22` carries the Tower-exit/progression side-pad label;
9. semantic Monster relocation to a door is rejected without leaving edits behind;
10. no-op export remains byte-identical after the added model semantics.

## Browser presentation checks

In addition to the Node model tests, Stage 5.1 should be checked visually in a browser:

- both map axes are numeric;
- N/S passage doors draw as horizontal barriers and E/W passage doors as vertical barriers in all three styles;
- locked doors show their lock colour/identifier;
- MAPS CELL PROPERTIES changes dynamically by selected map type;
- Keep exit-pad cells no longer claim to be Vivify pads;
- filled crystal/gem sockets are visible on the map and tan/bluish locations use distinct colours;
- LAYOUT lists eight independent crystal/gem locations rather than four invented A/B pairs.

## Known diagnostics

The original level maps can contain stored bit-7 occupancy/cache state beyond the immediately positioned Monster list. Because Z80 tower initialisation appears to normalise actor state, Stage 5 only treats a positioned Monster with a missing bit 7 as a consistency error for non-door cells. A door is a separate exception: its bit 7 belongs to the lock/colour field, and a positioned Monster on a door is reported as a conflict.

Firepath/Mindrock/Formwall rendering is currently a semantic hook only. No Level-TZX bytes are assigned those meanings until the ZX runtime/save format is demonstrated.
