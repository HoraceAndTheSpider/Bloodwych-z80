# Open research ledger

This ledger contains only work that remains material to a more complete editor
or exact renderer. Items already closed by source proof are not repeated.

## High priority renderer gaps

1. **Closed doors:** port the procedural drawing performed by `$BBF3-$BD12` using
   depth geometry `$9617/$9637`. Static `$897B` overlay and raw geometry are
   already extracted. Door map bit semantics and painter position are proved.
2. **Floor feature `$28/$30` procedural supplement:** static descriptors are
   reproduced; identify/port the remaining dynamic drawing branch.
3. **Actor colour/attributes:** determine the exact Spectrum attribute assignment
   after composite actor bitmap construction.
4. **Off-axis/special actor routes:** fully model `$87CF` wrapped `$F0-$F3` depth
   values and `$80+` `+$0D` live-entity classes before declaring every projectile
   and special entity renderable.

## Monster/live state

- finish friendly classification of authored `+$0D` values such as `$65/$75/$78/$7A`;
- enumerate generated `$80+` classes from creation/update/death paths;
- complete friendly names for `+$0E` timer/action flags. Its low-three-bit
  countdown structure and several flag-dependent transitions are already known.

## Object semantics

- classify object-specific second-byte state for every Level object family where
  semantic editing beyond move/add/remove is desired;
- prove any charge/fill transformations that should be exposed as controls rather
  than raw state.

## Champion/spell mechanics

- exact friendly semantics of champion runtime `$0E-$12` and casting-related
  `$25-$26` remain optional advanced research;
- spell cost/difficulty/effect mechanics can be documented further, but the rune
  upper-bit question is CLOSED: those bits overlap the compressed text resource.

## Validation

The generated catalogues are source-derived proofs, not substitutes for emulator
comparison. Capture representative emulator frames for wall+switch, socket,
door, floor object, champion/monster and compare pixel-for-pixel where practical.
