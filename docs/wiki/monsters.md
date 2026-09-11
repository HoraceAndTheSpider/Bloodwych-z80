# Monsters, teams and appearance construction

## Level allocation

```text
$44C-$473  10 teams x 4 monster indexes
$474       monster count/state
$475-$714  42 x 16-byte monster records
```

Unused monster slots are `$FF` filled. Team member `$FF` means empty.

## Corrected 16-byte record

```text
+$00       X; $FF marks a secondary team member
+$01       Y
+$02       orientation / formation state
+$03       floor
+$04       action-cycle / timing
+$05       base level
+$06       effective/current level
+$07-$08   current HP little-endian
+$09       action/status
+$0A       appearance / graphics selector
+$0B       normal object dropped on death
+$0C       team relationship
+$0D       special/live-entity class/lifecycle field
+$0E       runtime visual/status/countdown field
+$0F       runtime target/reference
```

`+$0E` low bits include a three-bit runtime countdown and authored Level records are normally zero. High-bit friendly status names remain incomplete.

## Team representation — PROVEN/STRONG

A positioned leader contains the team row index in `+$0C`. Secondary members use `X=$FF` and normally `+$0C=$FF`; their Y/floor context follows the leader. Independent positioned monsters also use `+$0C=$FF`.

The four team-formation permutation rows at `$87B7` are:

```text
2 0 3 1
3 2 1 0
1 3 0 2
0 1 2 3
```

A semantic team move must update leader position, secondary inherited context and source/destination map occupancy together.

## Appearance construction — PROVEN

`+$0A` is passed directly to the actor compositor.

Direct appearances `$01-$19` use the 25-byte body selector table at `$86C4`. Appearances `$01-$10` align with the sixteen built-in champions. Encoded appearances `>= $1A` derive body and identity selectors algorithmically.

Depth deliberately simplifies composition:

```text
near    five selected components
middle  two selected components
far     one collapsed component
```

The facing/depth package matrix at `$877B` selects image package and explicit mask lists. See `docs/wiki/proofs/actor-appearances-near-01-99.png` for the source-derived near catalogue.

## Open renderer work

Final Spectrum colour/attribute assignment for composite actors, off-axis wrapped depth routes and friendly classification of special `$80+` live entities remain OPEN.
