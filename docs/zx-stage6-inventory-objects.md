# Inventory, Pockets and Object Presentation

## Champion inventory model

The champion-data record has:

```text
+$13-$16   shared quantities for object codes $01-$04

+$17       hand/equipment position 0
+$18       hand/equipment position 1
+$19       body armour
+$1A       shield
+$1B-$20   six general pockets

+$21       Coinage indicator object ($01)
+$22       Common-Key indicator object ($02)
```

The first ten positions form the actual equipment/pocket inventory. `$21/$22` are separately drawn status items and should not be exposed as general pockets.

## Shared quantities

For object codes `$01-$04`, held quantity is stored at:

```text
champion_data + $12 + object_code
```

therefore:

```text
+$13  object $01 quantity
+$14  object $02 quantity
+$15  object $03 quantity
+$16  object $04 quantity
```

This keeps quantity separate from the icon/object slot byte.

## Normal object definitions

Exactly 76 presentation codes:

```text
$00-$4B
```

Normal graphic pointers:

```text
$6BA2-$6C39
```

Colour-set selector per object:

```text
$6AF2-$6B3D
```

25 four-attribute colour sets:

```text
$6B3E-$6BA1
```

## Inventory empty-slot graphics

A separate 12-entry pointer table begins at `$6C3A`.

This is selected by an alternate/empty-slot render path and is not an extension of the object-code namespace.

The first ten entries correspond to the ten equipment/pocket positions. Proven/strong visual roles:

```text
slot 0  hand/equipment placeholder
slot 1  opposite hand/equipment placeholder
slot 2  body armour placeholder
slot 3  shield placeholder
slot 4  generic pocket
slot 5  generic pocket
slot 6  generic pocket
slot 7  generic pocket
slot 8  generic pocket
slot 9  generic pocket
```

## ZX-specific semantic naming

Use the ZX object catalogue, not 68k object-number ordering.

Strong code/category anchors:

```text
$12  first body-armour object
$1B  first shield object
$3B-$3F special coloured keys
$40-$44 wand family
$46-$49 four aligned coloured ring family
```

A final editor object-name table should preserve both:

- numeric ZX code as authority;
- friendly item name as annotation.

Do not make semantics depend on a PNG or friendly name.
