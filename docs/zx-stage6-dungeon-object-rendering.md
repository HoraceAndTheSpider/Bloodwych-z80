# Dungeon Object Perspective Rendering

This chapter documents the first-person renderer for objects lying in the dungeon.

## Three-stage lookup chain

The object renderer around `$BD30-$BDEB` resolves an object graphic through three static tables:

```text
object code
   |
   v
$6C52[object]                 76 bytes
   -> perspective family 0..17
   |
   v
$6C9E[family*4 + depth]       18 x 4 bytes
   -> perspective graphic index
   |
   v
$6CE6[index*4]                41 x four-byte records
   word 0 = masked-record start
   word 1 = explicit mask pointer
```

This is distinct from the inventory object graphic bank at `$649E-$6845`.

## Depth selection

The renderer takes the current view-cell selector from `$87CF` and stores `value & 3` into the immediate operand used when indexing `$6C9E`. Therefore the four family entries are genuine perspective-depth variants.

Keep the values as depth indices `0..3` in code until the complete view-cell nomenclature/painter ordering is documented. Evidence indicates index 0 is the closest class, but numeric depth is the canonical representation.

## 18 perspective families

`$6C52` groups semantically related object codes so multiple inventory objects reuse the same shape when lying on the floor. Examples:

- all rings share one family;
- all normal/special keys share one family;
- bottle fill states share one family;
- food states share one family;
- all body armours share one family;
- all shields share one family;
- swords, axes, staves, bows, gems and N'Eggs each have their own families.

The exact grouping is exported in `tables/zx-stage6-object-to-perspective-family.csv`.

## Graphic records

`$6CE6-$6D89` contains 41 four-byte `(graphic,mask)` selections.

Every graphic pointer resolves into the masked record bank beginning at `$6D8A`. Every mask pointer checked so far equals the corresponding record's actual mask start, confirming the interpretation.

The 41 graphic selections occupy only the projectile/object portion of the masked bank, before the actor component region beginning at `$7108`.

## Draw path

The renderer:

1. obtains depth from the current 19-cell view selector;
2. gets an object code from the current visible object structure;
3. maps object -> family -> depth graphic;
4. retrieves graphic and mask pointers;
5. derives perspective placement from the current view geometry;
6. calls `$F72B`, the common masked draw routine;
7. repeats for objects in the visible stack.

This gives the editor enough information to render authentic floor objects without scaling the 16x inventory icons.
