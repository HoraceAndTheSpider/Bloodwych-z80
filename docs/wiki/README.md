# Bloodwych ZX Spectrum technical wiki

This directory is the canonical, topic-led technical reference for the ZX Spectrum version of **Bloodwych**. Numbered Stage documents elsewhere in `docs/` remain useful provenance, but verified findings should be consolidated here.

## Core topics

- [Game TZX and global memory resources](game-tzx.md)
- [Level Data TZX and tower payload](level-data.md)
- [Graphics and source formats](graphics.md)
- [First-person dungeon rendering](dungeon-rendering.md)
- [Objects and perspective presentation](objects.md)
- [Champion templates](champions.md)
- [Inventory, equipment and starting pockets](inventory.md)
- [Monsters, teams and appearances](monsters.md)
- [Spells and rune/text resources](spells.md)
- [Events and actions](events.md)
- [Special locations and teleport resources](special-locations.md)
- [Editor integration contract](editor-integration.md)
- [Open research](open-research.md)

## Generated supporting data

`tools/extract_zx_resources.py` extracts byte-identical raw blocks from the checked-in Game and Level Data TZX files into `data/extracts/`.

`tools/build_reference_tables.py` converts proved lookup structures into machine-readable `data/reference/` CSV/JSON for renderer/editor consumption.

These generated resources are derivative. The current TZX files and demonstrated Z80 behaviour remain authoritative.
