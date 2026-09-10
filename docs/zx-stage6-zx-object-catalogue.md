# ZX Spectrum Object Catalogue

The normal object presentation namespace is `$00-$4B`.

The numerical code is authoritative. Friendly names in the accompanying CSV are Spectrum-specific annotations correlated against a 1998 ZX Spectrum save-data hacking catalogue and checked against Z80 category boundaries, graphic reuse and colour tables.

Important category boundaries independently proved by Z80 code include:

```text
$12  first body armour: Leathers
$1B  first shield: Hide Shield
```

This aligns exactly with the Spectrum item catalogue.

## Families

```text
$01       Coinage
$02       Common Keys
$03-$04   Arrows / Elf Arrows
$05-$07   Drink fill states
$08-$0A   Food states
$0B-$0D   three N'Egg colours
$0E-$11   four potion/drink effects
$12-$1A   body armour
$1B-$21   shields
$22-$29   blades/swords
$2A-$2E   axes
$2F-$31   staves
$32-$34   bows/crossbow
$35-$3A   gems
$3B-$3F   special keys
$40-$44   wands
$45-$49   rings
$4A-$4B   player remains
```

Code `$45` is deliberately retained as `Yes Ring` in the CSV because that is what the Spectrum source calls it. A Grey Ring interpretation may be a useful cross-platform alias, but should not silently replace the ZX-source name until its ZX semantics are proved.
