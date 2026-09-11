# Generated ZX raw extracts

This directory is populated by:

```bash
python tools/extract_zx_resources.py
```

The extractor reads the repository's current ZX Game and Level Data TZX files and emits byte-identical named raw blocks plus `manifest.json` / `manifest.sha256`.

The directory convention deliberately mirrors the extracted-data approach used by Bloodwych-68k while keeping Game and Level source provenance separate.

Generated roots include:

```text
data/extracts/game/
data/extracts/levels/d-Keeps/
data/extracts/levels/e-Serpents/
...
data/extracts/levels/m-Zendiks/
```

Do not hand-edit extracted binaries. Edit the authoritative TZX project through the semantic editor/export path, then regenerate extracts when required.
