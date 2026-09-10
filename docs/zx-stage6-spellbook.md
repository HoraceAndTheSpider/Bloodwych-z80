# Spellbook and Learned Spells

## Spell-rune glyphs

`$983F-$9866` contains eight five-byte rune glyphs reached through the text renderer's lowercase path.

The spell UI converts rune value `0..7` to character code `a..h`, therefore the lowercase route is a special rune channel.

## Spell definition table

Immediately after the object bitmap bank, spell-definition data begins at:

```text
$6846
```

The spellbook indexes:

```text
page * $20 + entry * 4
```

so the visible definition table contains:

```text
4 pages * 8 entries * 4 bytes = 128 bytes
```

For each of the four bytes, the rune renderer uses:

```text
rune = byte & $07
```

The meaning of the upper five bits is not yet proved and should remain raw.

## Learned-spell flags

Champion-data offsets:

```text
+$27 -> internal spell indices 0-7
+$28 -> 8-15
+$29 -> 16-23
+$2A -> 24-31
```

Within each byte:

```text
bit 7  first displayed entry
...
bit 0  eighth displayed entry
```

This is source-proven by the spellbook renderer modifying its own Z80 `BIT` opcode from bit 7 down to bit 0.

## Prepared spell

```text
champion +$24 = internal spell index
champion +$24 = $FF means no prepared spell
```

The spellbook writes this only when the learned-spell bit allows the selected entry.

## Continuing/worn spell

```text
champion +$23
```

is a continuing/worn spell state. Cancellation code tests and clears it, and armour calculation consumes it when the continuing effect is Armour.

## Spell colour class

The ZX code independently maps internal spell indices to four magic colours and uses Spectrum attributes equivalent to:

```text
green   Serpent
yellow  Chaos/Shadow
red     Dragon
cyan    Moon
```

The four visible pages are groups of eight internal spell indices; they are not simply the four magic colours.

## Friendly spell names

The ZX executable does not presently provide a proved 32-name ASCII table in the traced range. Friendly names may be supplied from manual/cross-version corroboration, but internal index remains authoritative.
