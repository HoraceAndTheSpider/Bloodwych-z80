# Stage 6 Source Provenance and Confidence Rules

Repository reference used for this consolidation:

```text
HoraceAndTheSpider/Bloodwych-z80
main commit: f46c5dcd61536b1396f0c2bcbc5e0c875172a39d
```

Primary ZX artefacts:

```text
data/Bloodwych - The Game [ZX Spectrum].tzx
size: 49,623 bytes
Git blob: 0f3c3a8c056534e5175d0ccb8eed47f1579b9ec2

data/Bloodwych - Level Data [ZX Spectrum].tzx
size: 22,620 bytes
Git blob: 0f964b771363c9c9152437ec38dfcb573665ea69
```

## Authority order

1. ZX Game / Level TZX bytes.
2. Demonstrated Z80 access, mutation and drawing behaviour.
3. Current repository ZX documentation and validation.
4. Cross-platform Bloodwych material only as corroboration or a search aid.

Cross-platform agreement must never silently turn an unresolved ZX byte into a proved semantic field.

## Confidence terms

- **PROVEN** — direct ZX byte structure or demonstrated Z80 code path.
- **STRONG** — multiple independent ZX correlations or direct code with one residual semantic uncertainty.
- **OPEN** — observed bytes/behaviour retained without assigning a semantic meaning.

## Important historical corrections

See `zx-stage6-supersession-ledger.md`. In particular, earlier Stage 5 monster labels for `+$0A`, `+$0B` and `+$0D` must not be copied into future code unchanged.
