# ZX graphics and rendering formats

## Spectrum colour model

Most source artwork is one-bit. Colour is applied separately using Spectrum attributes:

```text
bits 0-2 INK
bits 3-5 PAPER
bit 6    BRIGHT
bit 7    FLASH
```

Do not bake guessed colours into bitmap extraction.

## Self-describing image-only records

Inventory/object graphics use:

```text
width_bytes
height
bitmap[width_bytes * height]
```

The source draw path stores/consumes rows in the proved game order; portable rendering should reproduce the access semantics rather than assuming a conventional PNG layout.

## Sequential masked records — PROVEN

The full bank `$6D8A-$8277` contains exactly **162** sequential records:

```text
width_bytes
height
image[width_bytes * height]
mask [width_bytes * height]
```

The final record at `$8274` is:

```text
01 01 00 FF
```

and composition metadata begins exactly at `$8278`.

Never locate masked records by scanning arbitrary bytes for plausible dimensions. Parse from `$6D8A` sequentially.

## Component packages

Actor image packages contain grouped graphic choices plus a separate explicit mask-pointer list. The package-selected mask is authoritative; it must not be inferred by assuming a mask follows a graphic record.

Placement bytes are not a normal `(signed X, signed Y)` pair:

- byte 0 = signed horizontal pixel displacement;
- byte 1 magnitude contributes vertical displacement;
- byte 1 sign selects local-side/mirrored compositor behaviour, adjusted by relative facing.

## Low-level actor surface

The actor/dungeon work bitmap has a 13-byte / 104-pixel row stride. The normal and mirrored component blitters reproduce shifted masked drawing at pixel resolution; mirroring a finished sprite is not equivalent.

## Font and runes

```text
$9731-$983E  five-byte normal glyphs
$983F-$9866  eight five-byte rune glyphs
```

The spell UI maps rune IDs `0..7` through the special lowercase `a..h` channel.
