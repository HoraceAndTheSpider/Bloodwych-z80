# Bloodwych ZX Spectrum — Map Flags and Tower-Load Initialisation

## Working distinction

For non-door cells:

```text
bit 2  object stack present
bit 7  occupied / actor present
```

**Door exception:** base-type-2 cells use bits 5-7 as the door lock/colour index, so bit 7 is not actor occupancy on a door.

## Object bit 2

Static Z80 evidence and original level correlation support bit 2 as required stored map state. Object placement/removal code maintains the bit directly, and no complete tower-load pass has been identified that reconstructs every object flag from the packed arena.

Stage 5 therefore treats bit 2 and the Object arena as one consistency domain.

## Actor bit 7

On non-door cells the original map contains bit 7, but the Z80 has a separate post-load Monster preparation path that iterates loaded Monster data. Actor occupancy is therefore at least partly derived/normalised runtime state.

Stage 5 preserves and maintains bit 7 during semantic positioned-Monster moves rather than deliberately exporting a stale map cache.

The consistency audit should be read conservatively: an extra stored occupancy bit is a diagnostic, not proof that the Monster list is wrong.

### Door conflict

A door cell cannot use the same bit as normal Monster occupancy because its bits 5-7 encode lock/colour. Stage 5.1 therefore:

- decodes door bit 7 as part of `lockId`;
- reports `occupied = false` for the map-byte door model;
- refuses semantic Monster placement onto a door;
- reports a Monster/door conflict if source data nevertheless positions a Monster there.

## Editor policy

- semantic Object edit -> Object resource + bit 2 together;
- semantic positioned-Monster edit -> Monster resource + bit 7 together on non-door cells;
- semantic Monster move -> reject a door destination;
- raw MAPS edit -> byte only, with companion warning;
- untouched original flags remain untouched.
