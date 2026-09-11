# Objects and graphical presentation

## Authoritative object namespace

Normal object codes are `$00-$4B` inclusive: 76 entries. Keep numeric ZX code as the stable key even where friendly names are provided.

Global presentation consists of separate resources:

```text
object code
 -> inventory graphic pointer
 -> colour-set selector / Spectrum attributes
 -> dungeon perspective family
```

These are not interchangeable representations.

## First-person floor-object chain — PROVEN

The dungeon renderer resolves an object through:

```text
$6C52[object]                 -> family 0..17
$6C9E[family * 4 + depth]     -> perspective graphic index
$6CE6[index * 4]              -> explicit graphic pointer + mask pointer
$6D8A+                        -> native masked bitmap data
```

Dedicated perspective artwork exists and must be used instead of scaling inventory icons. `docs/wiki/proofs/object-perspective-near.png` is a source-derived near-depth catalogue used to verify this path.

## Packed Level object arena

```text
$715-$716  used length
$717-$816  256-byte arena
```

A stack begins with packed map position/sub-position metadata, followed by an item count and two bytes per item (`object code`, `state`). Unused arena tail must be preserved byte-for-byte.

## Sub-cell placement — PROVEN

The stored two-bit mini-position is rotated according to player facing before using the four coordinate tables at `$8809/$8831/$8859/$8881`.

Facing transformation:

```text
facing 0: 0 1 2 3
facing 1: 1 3 0 2
facing 2: 3 2 1 0
facing 3: 2 0 3 1
```

Painter order deliberately separates back positions 2/3 from front positions 0/1 around the door layer.

## Open semantic work

The second per-item state byte is preserved and editable as raw data. Object-family-specific friendly semantics such as charges/fill transitions should only become dedicated controls once proved.
