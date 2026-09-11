# Events and actions

## Unified Level resource — PROVEN

```text
$817-$8CA
45 records x 4 bytes
```

ZX uses one source-offset-keyed Event table for switches, pads/triggers and other source-cell actions.

## Record format

```text
byte 0 bits 0-2  source map-offset bits 8-10
byte 0 bits 3-7  action selector
byte 1           source map-offset bits 0-7
byte 2 bits 0-4  target X
byte 2 bits 5-7  target floor
byte 3           target Y
```

Decode:

```text
source_offset = ((byte0 & $07) << 8) | byte1
action        = (byte0 & $F8) >> 2
target_floor  = byte2 >> 5
target_x      = byte2 & $1F
target_y      = byte3
```

Do not use sequential switch occurrence numbers: the source location is explicit.

## Current mechanically decoded actions

Known selectors include remove/create/toggle wall state, clear/set/toggle target bits, random/180-degree spinners, internal/external Vivify, teleport with/without flash, progression/tower exits, move/shift wall, feature-state changes and game completion.

Friendly labels should remain mechanical where the exact gameplay narrative is not independently proved.

## Capacity constraints

Archaus currently uses all normal Event slots. Zendik slots 36-44 are protected ending-message storage rather than free Event records.
