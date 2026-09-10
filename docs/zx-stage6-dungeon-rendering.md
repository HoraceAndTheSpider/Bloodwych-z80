# Dungeon / First-Person Rendering

## Main wall bank

Self-describing wall records:

```text
$8A5D  16x57
$8AD1  48x57
$8C29  24x40
$8CA3  40x40
$8D6D  32x29
$8DE3  32x29
$8E59  16x64
$8EDB  16x40
$8F4F  16x40
$8FA1  16x29
$8FDD   8x24
```

## 19-view-cell wall table

The first-person renderer uses a 19-cell view layout.

Pointer table at `$8A0F`:

```text
8FDD,8D6D,8FA1,8C29,8F4F,8A5D,8EDB,8E59,
8FDD,8D6D,8FA1,8C29,8F4F,8A5D,8EDB,8E59,
8DE3,8CA3,8AD1
```

A following/fallback pointer is `$F238`.

Parallel placement words at `$8A37`:

```text
(0,26),(0,22),(3,22),(0,15),(2,15),(0,4),(1,4),(0,0),
(12,26),(9,22),(8,22),(10,15),(9,15),(11,4),(10,4),(11,0),
(3,22),(2,15),(1,4)
```

## Perspective feature families

A common perspective feature renderer is centred around `$F097`.

Feature-family descriptors use two parallel 20-entry areas:

1. 20 x 16-bit resource/graphic pointers;
2. at `+$28`, 20 x 16-bit screen-placement values.

The selected view-cell index is doubled and applied to both arrays.

Known wrappers select different feature-family structures, including bases around:

- `$92FE`
- `$938D`
- `$940D`
- `$948D`

The feature dispatcher masks the map feature with `$38`.

## Level map byte model

Current Level-TZX model remains:

```text
bits 0-1  base cell type
bit 2     object-stack-present
bits 3-6  feature/orientation/state
bit 7     normally actor occupancy
```

Door exception:

```text
bit 3     passage axis
bit 4     closed/blocking
bits 5-7  lock/colour index
```

Do not interpret door bit 7 as monster occupancy.

## Editor integration

Keep the existing top-down map renderer separate from a first-person authentic-resource renderer.

Recommended first-person pipeline:

```text
player floor/X/Y/facing
 -> resolve 19 visible map cells
 -> classify base cell + feature
 -> wall/door draw in source order
 -> feature overlays
 -> object stacks
 -> actors/monsters
```

Open work before an exact first-person renderer is declared complete:

- final door-specific draw tables/order;
- exact `$28` feature branch;
- final painter/order interactions among walls, features, objects and actors.
