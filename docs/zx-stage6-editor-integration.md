# Editor Integration Guide — Stage 6 Research

## 1. Keep Game and Level projects separate

Stage 5 currently edits Level TZX blocks. Stage 6 introduces Game-TZX resources.

Do not create a combined exporter until both tape types have:

- preservation of untouched records;
- exact timing/pause metadata preservation;
- exact block length preservation unless explicitly changed;
- checksum/parity regeneration only for edited data blocks;
- byte-exact no-op export tests.

## 2. Recommended model split

```text
TapeSession
  LevelTapeProject
    Towers
    Floors
    Events
    Objects
    Monsters
    Specials

  GameTapeProject
    Graphics
    ObjectDefinitions
    ChampionTemplates
    SpellDefinitions
    RenderingTables
```

Shared UI may present both, but do not blur their source bytes into one model.

## 3. Immediate safe integration targets

### Graphics/data viewer

Read-only first:

- font/runes;
- raw graphics;
- object bitmaps;
- coloured object previews;
- masked component records;
- wall/feature records;
- actor package tables.

### Champion viewer

Display from template `$9B23 + n*$5A`:

- portrait;
- exact ZX name;
- core stats;
- Food;
- SP current/max;
- base armour;
- ten inventory positions;
- quantities `$01-$04`;
- Coinage/Common-Key indicators;
- continuing/prepared spell fields;
- learned-spell flags.

### Monster editor semantic corrections

Update display semantics:

```text
+$0A appearance
+$0B dropped object
+$0D special/live-entity class (raw until enum proved)
+$0E runtime status (read-only/raw)
```

Do not silently migrate bytes; this is a label/meaning correction.

## 4. Authentic rendering modules

Recommended independent modules:

```text
zxGraphics.js
zxObjectDefinitions.js
zxChampionDefinitions.js
zxSpellDefinitions.js
zxDungeonView.js
zxActorRenderer.js
```

The current top-down map renderer should remain responsible for the editor map.

## 5. Proof/data tables, not hard-coded prose

Prefer machine-readable tables for:

- masked record boundaries;
- object graphic pointers;
- object colour selectors;
- attribute sets;
- wall pointer/placement rows;
- actor facing/depth package matrix;
- appearance/body selectors;
- champion template field offsets.

The UI should consume those tables so research corrections do not require re-encoding knowledge in multiple JavaScript locations.

## 6. Confidence policy

Use three levels:

- `PROVEN`: direct ZX byte/code evidence.
- `STRONG`: multiple ZX correlations or direct code plus minor unresolved detail.
- `OPEN`: preserve raw and describe only what is observed.

Cross-platform evidence may improve a friendly annotation but must not upgrade an OPEN ZX field to PROVEN by itself.
