# Bloodwych ZX HTML5 Editor — Stage 5.1 Map/UI Corrections

Updated: 9 September 2026

This note records the evidence and design decisions behind the Stage 5.1 map-editor correction pass. It is intended to prevent a later UI refactor from reintroducing the same assumptions.

## 1. UI/layout target

The current Amiga/68k Python Map Viewer / Editor remains the presentation reference:

- top-level VIEWER / MAPS / OBJECTS / CHARACTERS-MONSTERS / LAYOUT organisation;
- large map/tower and floor selectors rather than burying them in compact dropdowns;
- map as the dominant workspace;
- contextual controls adjacent to the map;
- MAPS exposes semantic cell properties and does not force normal users to edit raw packed values.

The ZX implementation now follows this arrangement more closely while retaining its own TZX model and three display styles.

## 2. Coordinate convention

The Stage 5 renderer displayed numeric X across the top but alphabetic rows down Y while packed records and editors used numeric X/Y. This made location records unnecessarily difficult to follow.

Stage 5.1 uses numeric coordinates consistently:

```text
Floor 2 · X 8, Y 1
```

The renderer, selection summaries, Events, Layout records and DATA / FILES drawer all use the same convention.

## 3. Door field and renderer correction

For a map cell whose low two bits are `2`:

```text
bit 3     passage axis: 0=N/S, 1=E/W
bit 4     closed/blocking state
bits 5-7  lock/colour index
```

The Stage 5 refactor accidentally reversed the drawn axis. The correct presentation is based on the **passage** rather than the long axis of the barrier:

```text
N/S passage -> horizontal E/W door barrier
E/W passage -> vertical N/S door barrier
```

This has been corrected in Modern, CPC/Amstrad and Amiga-inspired modes.

Door lock colour is again shown. Most importantly, bit 7 cannot simultaneously be treated as Monster occupancy on a door. Monster semantic placement therefore rejects a door destination.

## 4. `$09` is a pad family, not a global Vivify label

The map byte does not contain the Event action. The linked source-offset Event supplies that context.

The authoritative Keep gives the specific regression case requested during review:

```text
slot 16  -> Floor 2, X 8,  Y 1 -> $09 -> action $22
slot 18  -> Floor 2, X 10, Y 1 -> $09 -> action $22
```

These are the two-player Tower exit pads. `$09` is therefore presented neutrally as `Floor pad / trigger`, with MAPS adding a contextual `Tower exit / progression side pad` label when the linked Event is `$22`.

## 5. `$006-$015` are eight independent special-location records

The earlier Stage 5 UI called these four `Pair n / Endpoint A/B` entries. That pairing was an editor invention arising from the fact each record is two bytes.

The Game TZX gives a stronger answer. Once the level payload has been relocated, loaded `$006` is runtime `$9DC3`. The lookup routine around `$C80D` starts at `$9DC3`, compares a two-byte packed map location, then advances the pointer by two bytes and repeats. It does not process adjacent entries as A/B endpoints.

On a match the routine extracts the high nibble from the second byte and masks it with `AND 7`. Stage 5.1 therefore treats this resource as:

```text
8 × 2-byte independent map-location lookup records
```

The actual two-way A/B teleport records remain separately at `$016-$01D`.

## 6. Filled socket map family

Cross-correlation of all non-zero `$006-$015` records with their resolved map cells shows that they land on the wall-feature family 12-15:

```text
12 = filled socket N
13 = filled socket E
14 = filled socket S
15 = filled socket W
```

Together with the already established families:

```text
4-7   empty socket N/E/S/W
8-11  switch N/E/S/W
```

this lets the map display the crystal/gem socket directly rather than drawing an unrelated generic special-location marker only.

## 7. Special variant names

Variants 0-3 correlate naturally with the four tower continuation blocks:

```text
0 Serpent crystal (green)
1 Chaos crystal (yellow)
2 Dragon crystal (red)
3 Moon crystal (blue)
```

Variant 4 was checked against the original 68k `gem-tan.locations` resource and tracks the same tower locations (allowing for small platform coordinate/alignment differences). Variants 0-3 already account for the four tower crystals; the Z80 uses six normal schemes, leaving variant 5 as the bluish teleport-gem scheme also exposed by the 68k data:

```text
4 Tan teleport gem
5 Bluish teleport gem
```

This is used as friendly presentation metadata. The packed ZX value remains authoritative and reserved variants 6/7 stay raw.

## 8. Editing model for special locations

A special-location record stores a map-workspace location and variant. A filled socket also exists independently in the map byte.

Stage 5.1 intentionally keeps these resources separate:

- moving a special-location record changes that packed record;
- changing a map wall into a filled socket changes the map byte;
- the editor does not silently perform both operations because the exact game-side coupling rules have not been demonstrated.

MAPS shows the linked special record when one exists. LAYOUT lists all eight records independently and provides FIND ON MAP.

## 9. Firepath / Mindrock / Formwall

The 68k source has explicit map-type-7 semantics for Firepath, Mindrock and Formwall. That is useful for knowing what future snapshot/save support should be able to display, but it is not evidence that the ZX Level TZX uses the same packed representation.

Stage 5.1 therefore adds only a renderer-level semantic hook. A future snapshot model may provide one of:

```text
firepath
mindrock
formwall
```

and the renderer can distinguish it. No Level-TZX value is assigned these names until the ZX runtime/save storage is proved.

## 10. Regression rules for future work

Do not:

- bring back alphabetic Y coordinates;
- infer crystal/gem A/B pairs from `$006-$015` adjacency;
- call `$09` a Vivify pad without inspecting the Event;
- use door bit 7 as Monster occupancy;
- reverse passage-axis door drawing;
- hide special-location sockets exclusively under LAYOUT;
- import the 68k Firepath/Mindrock/Formwall encoding into ZX without ZX evidence.
