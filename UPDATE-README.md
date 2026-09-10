# Bloodwych ZX editor — Stage 5.1 map/UI update

This is a **drop-in update overlay** for `HoraceAndTheSpider/Bloodwych-z80`.

Prepared against repository `main` commit:

```text
7b55be2fbf455a68bc880c5b7afde7d804784373  Updated Editor
```

No supplied game/TZX/TAP binary is included or modified by this archive. Extract the ZIP over a current checkout of the repository, preserving the paths below.

## Changed files

```text
index.html
css/editor.css
js/app.js
js/bloodwych.js
js/renderer.js
js/tiles.js
CHANGELOG.md
AGENTS.md
docs/README.md
docs/zx-spectrum-level-data.md
docs/zx-level-event-actions.md
docs/zx-map-runtime-initialisation.md
docs/zx-html-editor-stage5-implementation.md
docs/stage5-validation.md
```

## New files

```text
docs/zx-html-editor-stage5-1-map-ui.md
tools/stage5_1_selftest.js
UPDATE-README.md
MANIFEST-SHA256.txt
```

## What to test first

1. Open/serve the repository as before and load the bundled Level Data TZX.
2. Confirm the page now follows the Amiga/Python editor structure more closely: map/block and floor buttons at left, dominant map centre, contextual tab controls at right.
3. Confirm both map axes and all selected-cell locations use numeric `X, Y` coordinates.
4. In MAPS, select several plain walls, switches, sockets and doors and check that **CELL PROPERTIES** changes dynamically.
5. Check doors in all three display styles. N/S passage doors must appear as horizontal barriers; E/W passage doors as vertical barriers. Locked doors should show their lock colour/identifier.
6. In the Keep, inspect Event slots 16 and 18 / their source cells. They should resolve to Floor 2 `X 8,Y 1` and `X 10,Y 1`, use action `$22`, and no longer be globally described as Vivify pads.
7. Inspect filled crystal/gem sockets. Tower crystals plus tan/bluish teleport-gem sockets should be visible on the map; LAYOUT should list eight independent special locations rather than four A/B pairs.
8. Export an unmodified TZX and confirm byte identity using the existing Stage 5 test suite.

## Automated checks

From the repository root after applying this overlay:

```bash
node tools/stage5_selftest.js
node tools/stage5_1_selftest.js
```

The update files themselves have also been syntax-checked with `node --check`. The Stage 5.1 pure map-byte checks were run during packaging. The full data-driven Stage 5.1 test requires the repository's existing authoritative Level Data TZX, which is intentionally not duplicated in this overlay ZIP.

## Important model corrections

- Door bit 7 is part of the door lock/colour field, not Monster occupancy.
- `$09` is a floor pad/trigger family; the linked Event determines whether it is an exit, Vivify, teleport, etc.
- `$006-$015` contains eight independent two-byte crystal/gem-socket map-location lookups, not four A/B endpoint pairs.
- Wall features 12-15 are the filled crystal/gem-socket N/E/S/W family.
- Special variants are presented as 0 Serpent, 1 Chaos, 2 Dragon, 3 Moon, 4 Tan teleport gem, 5 Bluish teleport gem; 6/7 remain reserved.
- `$016-$01D` remains the separate pair of four-byte A/B teleport endpoint records.
- Firepath/Mindrock/Formwall have a future runtime rendering hook only; no ZX Level-TZX encoding has been invented for them.

## Notes on the special-variant names

Variants 0-3 are strongly supported by the tower continuation blocks. Variant 4 is position-correlated with the original 68k tan-teleport-gem location resource. With the four crystals plus tan accounting for variants 0-4 and the Z80 lookup using six normal schemes, variant 5 is presented as the remaining bluish teleport-gem scheme. The raw ZX packed value remains authoritative.

## If your checkout has moved on

If `main` has changed after `7b55be2`, review the six changed HTML/CSS/JS files before overwriting them. The documentation file `docs/zx-html-editor-stage5-1-map-ui.md` is designed to be the durable specification for reapplying these corrections to a later UI revision.
