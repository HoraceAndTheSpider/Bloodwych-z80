# Stage 6 Research Continuation Ledger

This file is the hand-off point for continued reverse-engineering after this snapshot. It exists so future work does not depend on chat history.

## Closed enough for editor-facing documentation

- Game TZX main block loaded at `$5B00-$FFFF`.
- text font and eight spell-rune glyphs.
- object image-only record format and normal 76-code presentation tables.
- 25 object Spectrum colour sets.
- empty inventory/equipment placeholder table.
- masked actor/effect graphics bank parsed sequentially through `$8277`, including transparent record `$8274`.
- actor facing/depth package matrix and multipart near/middle/far construction.
- signed actor component X/Y placement rule.
- 19-cell wall pointer and placement tables.
- perspective feature descriptor pattern and generic draw path.
- champion template allocation, 90-byte stride, 16x15 portrait, fixed name field and 43-byte data area.
- visible champion core stats, Food, spell points and base armour/protection.
- ten real equipment/pocket positions plus dedicated Coinage/Common-Key indicators.
- shared quantity counters for object codes `$01-$04`.
- worn/continuing spell, prepared spell and 32 learned-spell flags.
- monster team allocation and 16-byte record allocation.
- monster `+$0A` appearance selector and `+$0B` dropped-object code.

## Still to close before an authentic renderer/editor milestone is final

### Monster / actor

- final semantic enumeration of `+$0D`, especially authored `$65/$75/$78/$7A` and generated `$80+` values;
- exact lifecycle meaning of runtime `+$0E`;
- monster/actor Spectrum attribute/colour assignment;
- validated all-appearance contact sheet generated from exact compositor rules;
- friendly species names mapped to ZX appearance IDs only where source/corroboration is sufficient.

### Champion runtime/template tail

- classify `+$0E-$12` and `+$25-$26`, or prove them to be runtime/reserved;
- fully decode worn/continuing spell byte encoding beyond the Armour case;
- confirm whether any Game-TZX authored fields are transformed during party-selection copying and therefore should remain read-only in a first editor pass.

### Spells

- retain `$6846` as 32 x 4-byte rune definitions and prove/characterise upper five bits if meaningful;
- finish ZX spell-name/effect/cost provenance separation;
- record page/index/colour-class mapping in a machine-readable table.

### Dungeon

- finish door-specific perspective resources and painter ordering;
- resolve the special `$28` feature branch;
- establish final ordering among walls, fixtures, floor objects and actors;
- close animation/state selectors for switches, sockets, candles and other animated fixtures.

### Objects

- final ZX-native `$00-$4B` semantic name table with provenance;
- object-state byte semantics in Level-TZX object stacks;
- behavioural tables for consumables/weapons only where useful to editor semantics.

## Integration rule

Do not block read-only Game-TZX integration on OPEN fields. Preserve them raw. Do block semantic editing or authentic visual claims where a field or render path remains OPEN.
