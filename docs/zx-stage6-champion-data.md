# Champion Templates, Stats and Portraits

## Template allocation

```text
base    $9B23
count   16
stride  $5A / 90 bytes
```

Template structure:

```text
+$00-$1D   30-byte portrait bitmap = 16x15 one-bit image
+$1E-$2D   16-character name field
+$2E       $00 terminator
+$2F-$59   43-byte champion data
```

The selection renderer draws the first 30 bytes with width two bytes and height 15, independently proving the portrait boundary.

## 43-byte champion-data record

Offsets below are relative to template `+$2F`.

| Offset | Meaning | Confidence |
|---:|---|---|
| `$00` | champion ID `$01-$10` | proven |
| `$01` | Level | proven |
| `$02` | Strength | proven |
| `$03` | Agility | proven |
| `$04` | Intelligence | proven |
| `$05` | Charisma | proven |
| `$06` | current HP | proven |
| `$07` | maximum HP | proven |
| `$08` | current Vitality | proven |
| `$09` | maximum Vitality | proven |
| `$0A` | Food | strong/proven by stats bar |
| `$0B` | current Spell Points | proven |
| `$0C` | maximum Spell Points | proven |
| `$0D` | base armour/protection | proven |
| `$0E-$12` | runtime/other champion state | open |
| `$13-$16` | shared quantities for object `$01-$04` | proven |
| `$17-$20` | ten actual equipment/pocket slots | proven/strong |
| `$21` | fixed Coinage display object `$01` | strong |
| `$22` | fixed Common-Key display object `$02` | strong |
| `$23` | worn/continuing spell state | proven |
| `$24` | prepared spell index; `$FF` = none | proven |
| `$25-$26` | runtime/other champion state | open |
| `$27-$2A` | 32 learned-spell flags | proven |

## Champion IDs

`$01-$10` correspond to the sixteen built-in champions in template order:

1. Blodwyn Stonemaid
2. Murlock Darkhart
3. Eleanor D'Avalon
4. Rosanne Flyhand
5. Astroth Slamwort
6. Zothen Runemaker
7. Baldrick Dung
8. Elfric The Rose
9. Sir Edward Lion
10. Megrim Moonwych
11. Sethra Bhoaghail
12. Mr. Flay Sepulcre
13. Ulrich Sternaxe
14. Zastaph Mantric
15. Hengist Hirudin
16. Thai Chang Yinn

Name spelling should ultimately follow the bytes in the ZX template when shown in an editor. Friendly canonical spellings may be offered separately.

## Stats drawing

The stats panel reads the core stat bytes sequentially. Food is drawn as a proportional bar. Current/max Spell Points are displayed as the `SP.PT /` pair.

## Armour Class

Effective protection combines:

1. protection from the active continuing Armour spell, where applicable;
2. base protection at `+$0D`;
3. worn body armour in pocket slot `+$19`;
4. worn shield in pocket slot `+$1A`.

Displayed AC is:

```text
AC = 10 - effective_protection
```

Body armour contribution for object code `>= $12`:

```text
((object - $12) * 2) + 3
```

Shield contribution uses a lookup indexed from object `$1B`.
