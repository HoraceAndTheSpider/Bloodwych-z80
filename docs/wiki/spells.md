# Spells, runes and overlapping text data

## Rune definitions — PROVEN

The visible spellbook contains 32 internal spells, each represented by four bytes starting at `$6846`.

For display:

```text
rune = definition_byte & 7
```

Rune IDs `0..7` map to the eight five-byte glyphs at `$983F-$9866` through the special `a..h` text-rendering channel.

## Important overlap correction — PROVEN

The complete bytes at `$6846` are not a conventional four-byte spell-mechanics table. `$6846-$6A59` is also consumed as a packed 5-bit text/token dictionary. Therefore the upper five bits of the 32×4 rune bytes must **not** be interpreted as spell flags merely because the rune UI masks them away.

## Learned/prepared/continuing state

Champion-data fields:

```text
+$24       prepared internal spell index; $FF = none
+$27-$2A   32 learned-spell bits
+$23       continuing/worn spell packed state
```

The continuing state structure is substantially decoded as:

```text
state = (magnitude << 3) | effect_id
```

with low-three-bit continuing effects:

```text
0 Armour
1 Deflect
2 Warpower
3 Vanish
4 Compass
5 Levitate
6 Antimage
7 Trueview
```

The high component is a decaying magnitude/duration value.

## Names and effects

The executable's packed dictionary supplies authoritative ZX spell text and a separate 32-entry effect-dispatch table has been located. Internal index remains the canonical key even when friendly names are shown.
