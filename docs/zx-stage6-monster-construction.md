# Bloodwych ZX Spectrum — Monster / Actor Graphics Construction Research

Status: Stage 6 reverse-engineering notes only; new standalone document. A final monster-form sheet is not yet claimed.

## Authored monster record versus renderer structure

The Level Data monster allocation is 42 x 16-byte records loaded at `$A232` (`$9DBD + $475`). The first-person actor renderer later works on a larger runtime/visible-actor structure and accesses offsets beyond `+$23`. These structures must not be conflated.

The raw Level Data field `+$0B` remains a strong form/entity identifier, but its conversion into the visible-actor component selector is still being traced. Therefore silhouettes are not yet being assigned to form numbers by visual inference.

## Masked actor/effect source bank

`$6D8A-$8277` parses exactly as 162 self-describing masked records:

`width_bytes, height, image, mask`

The early portion consists principally of small effects/projectiles. `$7108` onward is dominated by actor/creature components. `$8274` is the final 8x1 transparent dummy graphic and is deliberately selected as an empty component. Composition metadata begins at `$8278`.

## Component composition metadata

From `$8274` onward the game contains counted component/placement records. Entries provide signed X/position information and pointers into the image/mask bank. Near-view actor packages contain several independently selected components; middle and far representations collapse to fewer components.

A four-facing selector matrix at `$877B` chooses facing/depth-specific packages. A separate 19-entry lookup at `$87CF` maps the visible dungeon cells to depth/special rendering classes. This independently confirms that actor presentation is coupled to the same 19-cell first-person view concept used by the dungeon renderer.

## Proven correction to exploratory component sheets

Only sequential record headers from `zx-stage6-masked-graphics-records.csv` may be treated as standalone source records. `$7434`, `$7490`, `$777C` and `$7C00` were exploratory false starts caused by treating image/mask interior addresses as headers.

## Outstanding proof required before a monster-form sheet

1. Follow raw monster `+$0B` from the 16-byte allocation into the larger runtime actor structure.
2. Identify the exact form-to-component-family lookup.
3. Determine which component selector fields represent lower body, upper body, head/identity and optional attachments without relying only on appearance.
4. Render each authored form using the actual selector data at each supported distance/facing.
5. Only then attach friendly monster names.

## Facing/depth package matrix

The six-word rows at `$877B` resolve into three image-package pointers followed by the corresponding three mask-list pointers. Facing indexes 0 and 2 share the same artwork. Facing indexes 1 and 3 use distinct full-width packages. Friendly compass-facing names are not assigned yet.

Near packages have group counts of `5,5,22,5[,5]`; middle packages have `4,9`; far packages have one group of `6`. The exact matrix is in `zx-stage6-actor-package-matrix.csv`.

The near package at `$837A` also proves that image and mask choices are independently table-driven: one `$721E` image entry is deliberately paired with mask `$726A` rather than `$721E`'s native `$7238` mask. Therefore future reconstruction must use the package's mask-pointer list, not assume every image always uses its adjacent native mask.

## 19-cell depth selector

The 19 bytes at `$87CF-$87E1` are: `F3 03 F3 02 F2 01 F1 F0 F3 03 F3 02 F2 01 F1 F0 03 02 01`. Values `01-03` select ordinary render depths; `$F0-$F3` are special/edge classes whose exact semantics are still being traced.
