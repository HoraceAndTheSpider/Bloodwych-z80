# Remaining Research Before Stage 6 Can Be Called Complete

This snapshot is suitable for beginning read-only/editor-integration design, but the following should still be resolved before a fully authentic Game-TZX editor/renderer is considered complete.

## Champion

- classify `+$0E-$12`;
- classify `+$25-$26`;
- prove any template-vs-runtime initialisation transformations relevant to editing;
- document continuing-spell byte encoding in full, not just Armour/cancel behaviour.

## Spellbook

- decode upper five bits of the four `$6846` spell-definition bytes, or prove they are irrelevant to drawing;
- establish a ZX-native friendly spell-name source if available;
- fully document cost/difficulty/effect tables if Game-TZX editing will expose them.

## Monsters

- identify ordinary authored `+$0D` values such as `$65/$75/$78/$7A`;
- fully classify generated `$80+`/special live-entity classes;
- decode `+$0E` timer/status lifecycle;
- finish Spectrum attribute/colour application for actors;
- produce final all-appearance contact sheets using exact signed X/Y placement and explicit package masks;
- attach friendly species/form names only after the ZX appearance mapping is proved.

## Dungeon renderer

- finish door-specific perspective graphics and painter order;
- resolve the `$28` feature branch;
- document exact draw ordering among walls, fixtures, objects and actors;
- floor-object perspective lookup chain is now structurally decoded; remaining work is exact placement/painter ordering;
- close any animation/frame selectors used by candles, switches, sockets and moving features.

## Objects

- finalise a ZX-native code-to-name catalogue with source provenance;
- decode all object-state bytes/quantities used in dungeon stacks;
- document consumable/equipment behaviour tables only where needed by editor semantics.

## Validation

Before enabling Game-TZX writes:

- no-op Game-TZX export byte-identical;
- single-byte template edit changes only intended byte + derived checksum;
- Undo returns byte-identical source;
- visual proof renders compare against emulator screenshots for a representative champion, inventory page, object, dungeon wall and actor.
