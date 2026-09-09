# Bloodwych ZX Spectrum — Map Flags and Tower-Load Initialisation

## Working distinction

```text
bit 2  object stack present
bit 7  occupied / actor present
```

## Object bit 2

Static Z80 evidence and original level correlation support bit 2 as required stored map state. Object placement/removal code maintains the bit directly, and no complete tower-load pass has been identified that reconstructs every object flag from the packed arena.

Stage 5 therefore treats bit 2 and the Object arena as one consistency domain.

## Actor bit 7

The original map also contains bit 7, but the Z80 has a separate post-load monster preparation path that iterates loaded monster data. Actor occupancy is therefore at least partly derived/normalised runtime state.

Stage 5 still preserves and maintains bit 7 during semantic positioned-monster moves rather than deliberately exporting a stale map cache.

The consistency audit should be read conservatively: an extra stored occupancy bit is a diagnostic, not proof that the monster list is wrong.

## Editor policy

- semantic Object edit -> Object resource + bit 2 together;
- semantic positioned-Monster edit -> Monster resource + bit 7 together;
- raw MAPS edit -> byte only, with companion warning;
- untouched original flags remain untouched.
