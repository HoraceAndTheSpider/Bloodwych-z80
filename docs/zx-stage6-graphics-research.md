# Bloodwych ZX Spectrum — Stage 6 Graphics Research

Status: reverse-engineering notes only. This is a new Stage 6 document and does not replace the Stage 5 editor documentation. No implementation changes are implied.

## Authority

1. `Bloodwych - The Game [ZX Spectrum].tzx` bytes and Z80 access behaviour.
2. `Bloodwych - Level Data [ZX Spectrum].tzx` where runtime structures must be correlated with authored monster data.
3. Existing ZX repository documentation.
4. Other Bloodwych platforms only as conceptual comparison.

## Confirmed bitmap rules

Source graphics are 1-bit. Spectrum colour is supplied separately through attributes. The game contains at least two important source formats:

- Self-describing unmasked bitmap: `width_bytes, height, image[width*height]`.
- Self-describing masked bitmap: `width_bytes, height, image[width*height], mask[width*height]`.

For the masked actor/effect bank `$6D8A-$8277`, sequential parsing consumes exactly 5,358 bytes and yields 162 records. The final record at `$8274` is an 8x1 fully transparent dummy component (`01 01 00 FF`) used repeatedly by the actor packages. This exact parse is the canonical boundary list.

Source scanlines in the previously traced blitters are stored bottom-to-top.

## Record-boundary correction

Earlier exploratory sheets accidentally displayed several interior image/mask addresses as records. They must not be used:

- `$7434` — mask start for record `$741C`, not a record.
- `$7490` — mask start for record `$7478`, not a record.
- `$777C` — interior/mask data, not a record.
- `$7C00` — inside the image payload of record `$7BEE`, not a record.

Two real records omitted by that exploratory list were `$77C2` and `$7898`.

Example: `$7BEE` is 16x23: image `$7BF0-$7C1D`, mask `$7C1E-$7C4B`; the next record is `$7C4C`.

The companion CSV `zx-stage6-masked-graphics-records.csv` is the machine-readable canonical list for this bank.
