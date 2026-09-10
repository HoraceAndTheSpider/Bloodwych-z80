# Monsters, Teams, Appearance and Rendering

## Level-TZX allocation

Loaded offsets:

```text
$44C-$473   10 teams x 4 member indices
$474        active monster count/state
$475-$714   42 x 16-byte monster records
```

Unused record slots are `$FF` filled. Team member `$FF` means empty.

At runtime this region is overlaid at:

```text
$A209   team table
$A231   count/state
$A232   monster records
```

## Corrected 16-byte field model

| Offset | Meaning | Confidence |
|---:|---|---|
| `$00` | X; `$FF` can mark a secondary team member | confirmed/strong |
| `$01` | Y | confirmed |
| `$02` | orientation / mini-space / formation state | strong |
| `$03` | floor | confirmed |
| `$04` | action-cycle / timing state | strong |
| `$05` | base level | strong |
| `$06` | effective/current level | strong |
| `$07-$08` | current HP little-endian | proven |
| `$09` | action/status | strong |
| `$0A` | appearance / graphics selector | proven |
| `$0B` | object code dropped on death | proven |
| `$0C` | team/group relationship | strong/proven |
| `$0D` | special/live-entity class / lifecycle field | strong, exact enum open |
| `$0E` | runtime visual/status/timer field | strong, authored data zero |
| `$0F` | runtime target/reference | strong |

## Drop-object proof

In the death path:

```text
D = monster +$0D
E = monster +$0B
...
A = E
...
object insertion path
```

Thus `+$0B` is the dropped object code.

## `+$0D`

Special handling includes:

- bit 7 set;
- value `$64`;
- runtime creation paths writing values such as `$80/$82/$83/$84/$87/$8E/$E4`.

This strongly indicates a special/live-entity class or form/lifecycle namespace distinct from ordinary appearance.

Do not expose a friendly enum until the ZX values are individually proved.

## `+$0E`

Zero in all supplied authored Level-TZX records. Runtime code writes/consumes it for some generated entities. Treat as raw/read-only until lifecycle semantics are closed.

## Appearance encoding

`+$0A` is passed directly into the actor compositor.

For ordinary direct appearances `1..25`:

```text
body_design = table[$86C4 + appearance - 1]
```

For encoded appearances `>= $1A`, the renderer derives compact body/identity selectors from `appearance-$1A`.

The exact formulas vary with distance because far-distance rendering collapses detail.

## Facing/depth package matrix

At `$877B-$87AA`, four facing rows x six words:

```text
row 0: 847C,8601,869E,8515,8638,86B8
row 1: 8278,855F,8652,8326,8596,866C
row 2: 847C,8601,869E,8515,8638,86B8
row 3: 837A,85B0,8678,8428,85E7,8692
```

Interpretation per row:

```text
near image/position package
middle image/position package
far image/position package
near companion mask table
middle companion mask table
far companion mask table
```

Rows 0 and 2 share/mirror artwork.

## Depth simplification

Near:

```text
multipart actor, commonly five selected components
```

Middle:

```text
two selected components
```

Far:

```text
single collapsed/combined graphic
```

This is deliberate Spectrum optimisation, not merely scaling.

## Package composition

Near package `$8278` contains component-choice group counts:

```text
5, 5, 22, 5, 5
```

followed by a zero terminator and 42 mask pointers, one per image choice.

The package mask pointer must be used. Do not assume the mask adjacent to an image is always the selected mask.

## Coordinates

Both X and Y component placement bytes are signed 8-bit values.

## Champion/direct identities

Appearances `$01-$10` align with the sixteen built-in champions, supported by champion IDs and sixteen distinct near identity/head choices.

Exact naming of special appearances `$11-$19` and encoded monster families `$1A+` remains open pending final catalogue rendering/identification.
