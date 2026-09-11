# Inventory, equipment and starting pockets

## Ten genuine equipment/pocket positions — PROVEN

Within the 43-byte champion-data block:

```text
+$17  hand/equipment position 0
+$18  hand/equipment position 1
+$19  body armour
+$1A  shield
+$1B  general pocket 0
+$1C  general pocket 1
+$1D  general pocket 2
+$1E  general pocket 3
+$1F  general pocket 4
+$20  general pocket 5
```

These ten bytes are the editor's authored starting inventory slots.

## Shared quantities — PROVEN

Object codes `$01-$04` store quantities separately:

```text
+$13  object $01 quantity
+$14  object $02 quantity
+$15  object $03 quantity
+$16  object $04 quantity
```

Do not encode these quantities in a pocket byte.

## Separate status-display objects

```text
+$21  Coinage indicator object
+$22  Common-Key indicator object
```

These are separately rendered status items and must not be exposed as two extra free pockets.

## Editor write rule

A normal starting-pocket edit should touch exactly one byte in the selected champion template. Quantity edits touch the corresponding separate quantity byte. Game-TZX container parity/checksum handling belongs to the later byte-preserving Game exporter.

See `docs/wiki/proofs/champion-starting-inventory.png` for a source-derived graphical verification of the authored inventory set.
