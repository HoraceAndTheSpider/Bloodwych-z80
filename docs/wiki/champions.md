# Champion templates

## Static Game resource — PROVEN

Champion templates start at `$9B23`:

```text
16 records
stride $5A
```

Each record is:

```text
+$00-$1D  30-byte 16x15 portrait bitmap
+$1E-$2D  16-byte name field
+$2E       terminator/separator
+$2F-$59  43-byte champion data
```

The champion-selection routine indexes the selected record by `(index-1) * $5A` and copies the complete 43-byte data area byte-for-byte into runtime state. Therefore these bytes are authoritative authored starting values rather than a display-only template.

## Sixteen built-in names

1. BLODWYN STONEMAD
2. MURLOCK DARKHART
3. ELEANOR D'AVALON
4. ROSANNE FLYHAND
5. ASTROTH SLAMWORT
6. ZOTHEN RUNEMAKER
7. BALDRICK DUNG
8. ELFRIC THE ROSE
9. SIR,EDWARD LION
10. MEGRIM MOONWYCH
11. SETHRA BHOAGHAIL
12. MR.FLAY SEPULCRE
13. ULRICH STERNAXE
14. ZASTAPH MANTRIC
15. HENGIST HIRUDIN
16. THAI,CHANG YINN

## Relevant champion-data fields

Proved/strong authored fields include ID, level/statistics, current/maximum HP and Vitality, food, current/maximum spell points, base armour, shared quantities, equipment/pockets, continuing spell, prepared spell and four learned-spell flag bytes.

`+$0E-$12` and `+$25-$26` should remain raw/advanced until exact friendly runtime semantics are closed.
