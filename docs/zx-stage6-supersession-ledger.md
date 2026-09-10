# Stage 6 Supersession Ledger

This file records interpretations in earlier Stage 5 material that must not be carried into new implementation unchanged.

| Area | Earlier interpretation | Stage 6 interpretation | Confidence |
|---|---|---|---|
| Monster `+$0A` | behaviour / AI selector | appearance / graphics selector; directly consumed by actor compositor | source-proven |
| Monster `+$0B` | form / graphic/entity ID | object code dropped on death | source-proven |
| Monster `+$0D` | carried/drop-object candidate | special/live-entity class / death-lifecycle field; `$64` and bit-7 values receive special handling | strong, exact enum open |
| Monster `+$0E` | raw runtime/status | remains runtime/status; zero in all authored records; renderer/runtime code consumes it | strong, semantics open |
| Actor graphics bank end | `$8273` | `$8277`; `$8274` is a valid 1x1 transparent masked record | source-proven |
| `$7C00` | graphic start in an old secondary sheet | interior byte of the `$7BEE` image payload | source-proven |
| `$7490` | graphic start in an old secondary sheet | mask start for `$7478` | source-proven |
| `$7434/$7437` | separate graphic area in old secondary sheet | mask bytes for `$741C` | source-proven |
| `$777C` | graphic start in old secondary sheet | interior/mask data; not a record start | source-proven |
| Champion inventory | 12 free object slots | 10 actual equipment/pocket positions + fixed Coinage/Common-Key indicator entries | strong/source-backed |
| Object definitions | possible 88-object range | 76 normal object presentation codes + 12 separate placeholder graphics | source-proven |

Existing Stage 5 documents should be retained as historical implementation notes. New editor work should consume this ledger and the Stage 6 chapters as the newer interpretation layer.
