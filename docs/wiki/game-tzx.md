# Game TZX and global resources

## Main loaded image — PROVEN

The main Game data payload is loaded at:

```text
RAM $5B00-$FFFF
size $A500 = 42,240 bytes
```

For the current source used during this investigation the loaded image SHA-256 is:

```text
6be0bb5b57ea3a0b7b07bf00fa60c8a929c98c3df749f34d882ad50c319e888b
```

`tools/extract_zx_resources.py` identifies the main standard-speed TZX data block, verifies Spectrum XOR parity, strips only flag/parity bytes and emits the `$5B00-$FFFF` payload plus named subresources.

## Important global resource ranges

Current editor-critical ranges include:

```text
$649E-$6845  self-describing inventory/object graphics
$6846-$6A59  packed 5-bit text/token dictionary
$6846-$68C5  overlapping 32 x 4 spell rune-definition bytes
$6A5A-$6AF1  76 compressed object-name token references
$6AF2-$6B3D  object colour-set selectors
$6B3E-$6BA1  Spectrum object attribute sets
$6BA2-$6C39  object inventory-graphic pointers
$6C3A-$6C51  inventory empty-slot/placeholder pointers
$6C52-$6C9D  object -> dungeon perspective family
$6C9E-$6CE5  family/depth -> perspective graphic index
$6CE6-$6D89  41 x (graphic pointer, explicit mask pointer)
$6D8A-$8277  sequential masked graphic bank
$8278-$86C3  actor component packages
$86C4-$877A  appearance body/identity vector tables
$877B-$87AA  actor facing/depth package matrix
$87B7-$87C6  four-member formation permutation table
$87CF-$8808  actor depth/coordinate data
$8809-$88A8  four object/actor perspective coordinate tables
$88AC...      wall-switch perspective descriptor/resources
$897B...      door static overlay descriptor/resources
$8A0F...      dungeon wall pointer/placement/resources
$8FF7...      first-person map sampling transforms and masks
$90B5...      ceiling/floor source textures and feature resources
$950D...      wall-socket perspective descriptor/resources
$9617...      procedural door geometry data
$9731-$983E  five-byte normal text glyphs
$983F-$9866  eight five-byte spell-rune glyphs
$9B23-$A0C2  16 x $5A champion templates
```

The raw extractor deliberately emits some overlapping logical ranges, because the executable itself deliberately reuses bytes. `$6846-$68C5` is the clearest example: the low three bits provide spell rune IDs while the full bytes simultaneously belong to the packed text resource.

## Editing principle

Game TZX and Level Data TZX must remain independently byte-preserving projects. Game edits such as starting champion equipment should be applied to the global Game block only; Level edits such as monster placement belong to the selected tower block only.
