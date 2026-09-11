# Editor integration contract

The editor should consume one shared byte model and one shared source-driven
renderer. Reverse-engineered constants should come from `data/reference/` or be
read from the Game resource image, not be independently hard-coded in multiple
UI modules.

## Integration sequence now supported

### 1. Game resources / graphical catalogue

Load the Game payload and initialise:

- object graphics/attributes;
- perspective object families/masks;
- wall/feature/switch/socket/door descriptor resources;
- actor masked records/packages/appearance vectors;
- champion templates/portraits;
- fonts/runes.

`tools/zx_render.py` is a Python reference implementation of these paths.

### 2. Level model

Load an independent `$08CB` tower payload. Parse floor descriptors/maps, teams,
monsters, object arena, Events and special locations. Preserve unused arena bytes
and all OPEN record fields.

### 3. Authentic first-person preview

Given player/focus `floor,x,y,facing`:

```text
sample 13 surrounding cells using $8FF7
 -> build wall visibility/occlusion from $9067/$908E
 -> iterate 19 perspective slots in source order
 -> wall + oriented switch/socket overlay
    OR
 -> static floor feature
 -> back object positions 2/3
 -> door
 -> front object positions 0/1
 -> actor/team
```

The top-down map renderer remains separate.

### 4. Monster/team editing

Use semantic transactions, not unrelated byte pokes. A team move must update
leader location, secondary inherited context and map occupancy together. Door
cells are invalid actor destinations. Preserve all runtime/special fields unless
explicitly edited in an advanced raw view.

### 5. Starting inventory editing

Expose only ten genuine pocket/equipment bytes (`champion data +$17-$20`). Keep
Coinage/Common-Key display entries separate. Expose object `$01-$04` shared
quantities separately at `+$13-$16`.


## Generating editor resources

The repository TZX files remain authoritative. Generate raw resource blocks and then machine-readable reference tables with:

```bash
python tools/extract_zx_resources.py
python tools/build_reference_tables.py
python tools/selftest.py
```

The generated roots are `data/extracts/` and `data/reference/`. They can be regenerated at any time; do not hand-edit generated binary extracts.

## Validation gates before Game-TZX write-back

- no-op TZX output byte-identical;
- one-pocket champion change touches only the intended payload byte plus data
  block parity;
- Undo restores exact source bytes;
- Level semantic team/object edits maintain companion map bits;
- representative source renders compare with emulator screenshots.
