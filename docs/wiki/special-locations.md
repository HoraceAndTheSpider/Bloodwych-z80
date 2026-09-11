# Special locations and teleport resources

## Crystal/gem locations — STRONG/PROVEN structure

Loaded Level offsets `$006-$015` contain eight two-byte packed locations.

The low byte plus low nibble of the second byte encode a map-workspace offset. The high nibble provides a variant selector; runtime lookup masks it to three significant bits.

Current safely named variants include the four tower crystal colours and two teleport-gem variants. Reserved/unknown variants must remain raw until directly proved.

Filled socket wall cells use the same socket bitmap family as empty sockets; the special-location resource supplies identity/context rather than a completely separate perspective bitmap.

## Teleport endpoints — PROVEN

`$016-$01D` contains two endpoint pairs, four bytes per pair:

```text
A.x A.y B.x B.y
```

Keep this resource distinct from Events even when an Event triggers teleport behaviour.

## Editor rule

Do not merge wall socket state, special-location identity and Event action into one synthetic record. They are separate authored resources which may refer to the same logical gameplay location.
