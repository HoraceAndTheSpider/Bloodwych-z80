# ZX Graphics and Rendering Formats

## 1. Native colour model

Most source artwork is one-bit. ZX colour is applied separately through attribute bytes.

Spectrum attribute byte:

- bits 0-2: INK
- bits 3-5: PAPER
- bit 6: BRIGHT
- bit 7: FLASH

For the object colour definitions identified so far, PAPER is black.

## 2. Self-describing image-only records

Object/inventory graphics at `$649E-$6845` use:

```text
byte 0  width in bytes
byte 1  height
then    width*height bitmap bytes
```

Rows are stored bottom-to-top for the traced draw routines.

## 3. Masked graphics records

The complete actor/effect component bank is:

```text
$6D8A-$8277
```

Record format:

```text
byte 0   width in bytes
byte 1   height
image    width*height bytes
mask     width*height bytes
```

The final record at `$8274` is:

```text
01 01 00 FF
```

i.e. an 8x1 fully transparent dummy component used by actor composition packages.

Composition metadata begins at `$8278`.

## 4. Critical parser rule

Do not infer record starts by scanning for plausible `width,height` pairs. Parse sequentially:

```text
next = record + 2 + 2*(width*height)
```

This prevents image/mask interior bytes being misidentified as records.

Known historical false starts:

- `$7434/$7437`
- `$7490`
- `$777C`
- `$7C00`

## 5. Text font

Normal font:

```text
$9731-$9780   space through '/'
$9781-$97BC   0-9 : ;
$97BD-$983E   uppercase A-Z
```

Glyph width is five bytes.

There is no ordinary lowercase alphabet in this table.

## 6. Spell runes

`$983F-$9866` contains eight 5-byte special glyphs selected through the text renderer's lowercase branch. Spell UI produces `a` through `h`, therefore these are rune symbols, not lowercase text.

## 7. Low-level screen helpers

Known routines include:

- `$EA26`: pixel coordinate to Spectrum screen address.
- `$EA41/$EA51`: scanline stepping helpers in opposite directions.
- `$EE5F`: main raw copy/blit path.
- `$EE6D/$EE73`: mirrored / bit-reversed variants.
- `$F72B`: masked/scaled actor-component rendering path.

For editor rendering, reproduce the source data formats and composition rules; do not depend on native Spectrum address interleaving unless emulating the exact framebuffer.
