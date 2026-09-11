#!/usr/bin/env python3
"""
Extract authoritative raw data blocks from the Bloodwych ZX Spectrum TZX files.

This is deliberately a byte-preserving extractor, not a semantic re-encoder.
Generated files under data/extracts/ are reproducible from the checked-in
Game and Level Data TZX sources.

The named Game ranges are RAM-addressed against the main block loaded at
$5B00-$FFFF. Level ranges are payload offsets within each $08CB-byte tower
payload (Spectrum flag/parity excluded).
"""
from __future__ import annotations

import argparse
import hashlib
import json
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterator

REPO = Path(__file__).resolve().parents[1]
DEFAULT_GAME = REPO / "data" / "Bloodwych - The Game [ZX Spectrum].tzx"
DEFAULT_LEVELS = REPO / "data" / "Bloodwych - Level Data [ZX Spectrum].tzx"
DEFAULT_OUT = REPO / "data" / "extracts"

GAME_LOAD_BASE = 0x5B00
GAME_PAYLOAD_SIZE = 0xA500
LEVEL_PAYLOAD_SIZE = 0x08CB
LEVEL_NAMES = dict(zip(
    range(0x64, 0x6E),
    ("Keeps", "Serpents", "Serpent2", "Moons", "Moon2",
     "Dragons", "Dragon2", "Archaus", "Chaos2", "Zendiks"),
))

# End addresses are exclusive.
GAME_RANGES = (
    ("graphics/AssortedGraphics_5EA7_649D.graphics", 0x5EA7, 0x649E,
     "assorted 1-bit graphics", "STRONG"),
    ("graphics/ObjectInventory.graphics", 0x649E, 0x6846,
     "35 self-describing inventory/object bitmap records", "PROVEN"),
    ("text/PackedTokenDictionary.data", 0x6846, 0x6A5A,
     "packed 5-bit text/token dictionary; first $80 bytes are dual-used by spell runes", "PROVEN"),
    ("spells/SpellRuneDefinitions.data", 0x6846, 0x68C6,
     "32 x 4 bytes whose low three bits are spell rune IDs; overlaps packed token dictionary", "PROVEN"),
    ("objects/ObjectNameTokens.lookup", 0x6A5A, 0x6AF2,
     "76 x two-byte compressed object-name token references", "PROVEN"),
    ("objects/Object_ColourSelectors.lookup", 0x6AF2, 0x6B3E,
     "76 object -> colour-set selectors", "PROVEN"),
    ("objects/Object_AttributeSets.colours", 0x6B3E, 0x6BA2,
     "25 x four-byte Spectrum attribute sets", "PROVEN"),
    ("objects/Object_GraphicPointers.lookup", 0x6BA2, 0x6C3A,
     "76 little-endian inventory graphic pointers", "PROVEN"),
    ("inventory/InventoryPlaceholders.lookup", 0x6C3A, 0x6C52,
     "12 little-endian empty-slot/placeholder graphic pointers", "PROVEN"),
    ("objects/Object_PerspectiveFamilies.lookup", 0x6C52, 0x6C9E,
     "76 object -> dungeon-perspective-family selectors", "PROVEN"),
    ("objects/Object_PerspectiveDepthGraphics.lookup", 0x6C9E, 0x6CE6,
     "18 x four-depth perspective graphic indices", "PROVEN"),
    ("objects/Object_PerspectiveGraphicMasks.lookup", 0x6CE6, 0x6D8A,
     "41 x (graphic pointer, explicit mask pointer)", "PROVEN"),
    ("graphics/ActorMaskedGraphics.graphics", 0x6D8A, 0x8278,
     "162 sequential width/height/image/mask records", "PROVEN"),
    ("graphics/ActorComponentPackages.layout", 0x8278, 0x86C4,
     "facing/depth component image and explicit-mask package data", "PROVEN"),
    ("graphics/Actor_DirectBodySelectors.lookup", 0x86C4, 0x86DD,
     "25 direct-appearance body selectors", "PROVEN"),
    ("graphics/Actor_NearIdentitySelectors.lookup", 0x86DD, 0x86F6,
     "25 near identity/centre-component selectors", "PROVEN"),
    ("graphics/Actor_NearBodyVectors.layout", 0x86F6, 0x8729,
     "width byte + 10 x five-component body vectors", "PROVEN"),
    ("graphics/Actor_MiddleIdentitySelectors.lookup", 0x8729, 0x8742,
     "25 middle identity/centre-component selectors", "PROVEN"),
    ("graphics/Actor_MiddleBodyVectors.layout", 0x8742, 0x8757,
     "width byte + 10 x two-component body vectors", "PROVEN"),
    ("graphics/Actor_FarIdentitySelectors.lookup", 0x8757, 0x8770,
     "25 far identity/component selectors", "PROVEN"),
    ("graphics/Actor_FarBodyVectors.layout", 0x8770, 0x877B,
     "width byte + 10 x one-component body vectors", "PROVEN"),
    ("graphics/Actor_FacingDepthPackages.lookup", 0x877B, 0x87AB,
     "4 facing rows x 6 little-endian package pointers", "PROVEN"),
    ("graphics/Actor_DepthVectorSelectors.lookup", 0x87AB, 0x87B7,
     "3 x (body-vector descriptor pointer, identity-selector pointer)", "PROVEN"),
    ("graphics/Actor_TeamFormationPermutations.lookup", 0x87B7, 0x87C7,
     "4 x four-byte team formation permutations", "PROVEN"),
    ("graphics/Actor_OrientationCoordinatePointers.lookup", 0x87C7, 0x87CF,
     "4 little-endian pointers to orientation-dependent coordinate layouts", "PROVEN"),
    ("graphics/Actor_ViewCellDepthClasses.lookup", 0x87CF, 0x87E2,
     "19-cell actor depth/special-class lookup", "PROVEN"),
    ("unclassified/Unclassified_87E2", 0x87E2, 0x87E3,
     "single byte between actor depth and coordinate tables", "OPEN"),
    ("graphics/Actor_OrdinaryViewCoordinates.layout", 0x87E3, 0x8809,
     "19 pairs consumed as actor view-position coordinate/base data", "PROVEN"),
    ("graphics/Actor_Orientation0ViewCoordinates.layout", 0x8809, 0x8831,
     "20 two-byte coordinate/base entries", "PROVEN"),
    ("graphics/Actor_Orientation1ViewCoordinates.layout", 0x8831, 0x8859,
     "20 two-byte coordinate/base entries", "PROVEN"),
    ("graphics/Actor_Orientation2ViewCoordinates.layout", 0x8859, 0x8881,
     "20 two-byte coordinate/base entries", "PROVEN"),
    ("graphics/Actor_Orientation3ViewCoordinates.layout", 0x8881, 0x88A9,
     "20 two-byte coordinate/base entries", "PROVEN"),
    ("dungeon/Dungeon_DummyGraphic.graphics", 0x88A9, 0x88AC,
     "1-byte x 1-row dummy unmasked graphic (01 01 55)", "PROVEN"),
    ("dungeon/WallSwitchDescriptor.layout", 0x88AC, 0x897B,
     "20 wall-switch graphic pointers/placements plus switch graphics", "PROVEN"),
    ("dungeon/DoorOverlayDescriptor.layout", 0x897B, 0x8A0F,
     "20 static door overlay pointers/placements plus graphics", "PROVEN"),
    ("dungeon/Dungeon_WallPointers.lookup", 0x8A0F, 0x8A35,
     "19 little-endian wall graphic pointers", "PROVEN"),
    ("unclassified/Unclassified_8A35_8A36", 0x8A35, 0x8A37,
     "two bytes between wall pointer and placement tables", "OPEN"),
    ("dungeon/Dungeon_WallPlacements.layout", 0x8A37, 0x8A5D,
     "19 x two-byte wall placements", "PROVEN"),
    ("dungeon/DungeonWalls.graphics", 0x8A5D, 0x8FF7,
     "main self-describing first-person wall graphics", "PROVEN"),
    ("dungeon/Dungeon_ViewCoordinateOffsets.layout", 0x8FF7, 0x9067,
     "4 facings x 14 signed map-coordinate pairs used by first-person sampling", "PROVEN"),
    ("dungeon/Dungeon_WallDrawMasks.lookup", 0x9067, 0x908E,
     "13 x three-byte masks mapping samples to 19 perspective wall slots", "PROVEN"),
    ("dungeon/Dungeon_WallOcclusionMasks.lookup", 0x908E, 0x90B5,
     "13 x three-byte masks removing hidden perspective slots", "PROVEN"),
    ("dungeon/Dungeon_CeilingTexture.graphics", 0x90B5, 0x9214,
     "27 x 13-byte ceiling/background source texture", "PROVEN"),
    ("dungeon/Dungeon_FloorTexture.graphics", 0x9214, 0x92FE,
     "18 x 13-byte floor/background source texture", "PROVEN"),
    ("dungeon/FloorFeature_18_28Descriptor.layout", 0x92FE, 0x938D,
     "perspective feature descriptor and source graphics for map masks $18/$28", "PROVEN"),
    ("dungeon/FloorFeature_20_30Descriptor.layout", 0x938D, 0x940D,
     "perspective feature descriptor and source graphics for map masks $20/$30", "PROVEN"),
    ("dungeon/FloorFeature_08Descriptor.layout", 0x940D, 0x948D,
     "perspective visible floor-pad/trigger descriptor and source graphics", "PROVEN"),
    ("dungeon/FloorFeature_38Descriptor.layout", 0x948D, 0x950D,
     "perspective feature descriptor and source graphics for map mask $38", "PROVEN"),
    ("dungeon/WallSocketDescriptor.layout", 0x950D, 0x95F0,
     "20 socket graphic pointers/placements plus socket graphics", "PROVEN"),
    ("dungeon/Dungeon_DynamicFeatureData.data", 0x95F0, 0x9617,
     "dynamic wall/floor feature data used by special feature branches", "STRONG"),
    ("dungeon/DoorClosedGeometry.layout", 0x9617, 0x9637,
     "depth-selected 10-byte closed-door procedural geometry records", "PROVEN"),
    ("dungeon/DoorCommonGeometry.layout", 0x9637, 0x9657,
     "depth-selected 8-byte door procedural geometry records", "PROVEN"),
    ("objects/ObjectPerspectiveVerticalAdjust.lookup", 0x9657, 0x965F,
     "8-byte depth/sub-position vertical adjustment table for floor objects", "PROVEN"),
    ("unclassified/Unclassified_965F_9730", 0x965F, 0x9731,
     "remaining renderer/global data gap; preserve raw", "OPEN"),
    ("fonts/TextGlyphs.font", 0x9731, 0x983F,
     "normal five-byte text glyph data", "PROVEN"),
    ("fonts/SpellRunes.font", 0x983F, 0x9867,
     "eight five-byte spell-rune glyphs", "PROVEN"),
    ("unclassified/Unclassified_9867_9B22", 0x9867, 0x9B23,
     "unclassified Game resource gap; preserve raw", "OPEN"),
    ("champions/ChampionTemplates", 0x9B23, 0xA0C3,
     "16 x $5A champion templates", "PROVEN"),
)

# Payload offsets, end exclusive.
LEVEL_RANGES = (
    ("layout/PlayerStarts", 0x000, 0x006, "P1/P2 X,Y,floor", "PROVEN"),
    ("layout/CrystalSocketLocations", 0x006, 0x016,
     "8 x two-byte packed crystal/gem-socket locations", "STRONG"),
    ("layout/TeleportEndpoints", 0x016, 0x01E,
     "2 x four-byte teleport endpoint pairs", "PROVEN"),
    ("layout/ProgressionField", 0x01E, 0x01F,
     "progression requirement on non-final segments; Zendik exceptional", "PROVEN"),
    ("layout/SegmentNumber", 0x01F, 0x020, "segment number", "PROVEN"),
    ("runtime/LevelScratchState", 0x020, 0x022,
     "runtime scratch/state bytes preserved raw", "OPEN"),
    ("maps/FloorDescriptors.layout", 0x022, 0x040,
     "5 x six-byte floor descriptors", "PROVEN"),
    ("maps/MapWorkspace", 0x040, 0x44C,
     "$40C-byte packed map workspace", "PROVEN"),
    ("monsters/MonsterTeams", 0x44C, 0x474,
     "10 x four-byte monster team table", "PROVEN"),
    ("monsters/MonsterCount", 0x474, 0x475,
     "authored monster count/state", "PROVEN"),
    ("monsters/MonsterRecords", 0x475, 0x715,
     "42 x 16-byte monster allocation", "PROVEN"),
    ("objects/ObjectArenaUsedLength", 0x715, 0x717,
     "little-endian packed object-arena used length", "PROVEN"),
    ("objects/ObjectArena", 0x717, 0x817,
     "256-byte packed object arena including preserved unused tail", "PROVEN"),
    ("events/Events", 0x817, 0x8CB,
     "45 x four-byte unified event/action area; Zendik tail has ending text", "PROVEN"),
)

@dataclass
class TzxBlock:
    index: int
    block_id: int
    file_offset: int
    body_offset: int
    data: bytes | None = None

def u16(b: bytes, p: int) -> int:
    return b[p] | (b[p + 1] << 8)

def u24(b: bytes, p: int) -> int:
    return b[p] | (b[p + 1] << 8) | (b[p + 2] << 16)

def u32(b: bytes, p: int) -> int:
    return int.from_bytes(b[p:p + 4], "little")

def iter_tzx(src: bytes) -> Iterator[TzxBlock]:
    if len(src) < 10 or src[:8] != b"ZXTape!\x1a":
        raise ValueError("Not a TZX file (missing ZXTape! signature)")
    p = 10
    index = 0
    while p < len(src):
        start = p
        bid = src[p]
        p += 1
        data = None
        body = p

        if bid == 0x10:  # standard speed data
            if p + 4 > len(src): raise ValueError("truncated TZX $10 header")
            ln = u16(src, p + 2)
            p += 4
            data = src[p:p + ln]
            p += ln
        elif bid == 0x11:
            if p + 18 > len(src): raise ValueError("truncated TZX $11 header")
            ln = u24(src, p + 15)
            p += 18 + ln
        elif bid == 0x12:
            p += 4
        elif bid == 0x13:
            n = src[p]; p += 1 + 2 * n
        elif bid == 0x14:
            ln = u24(src, p + 7); p += 10 + ln
        elif bid == 0x15:
            ln = u24(src, p + 5); p += 8 + ln
        elif bid in (0x18, 0x19):
            ln = u32(src, p); p += 4 + ln
        elif bid == 0x20:
            p += 2
        elif bid == 0x21:
            ln = src[p]; p += 1 + ln
        elif bid in (0x22, 0x25, 0x27):
            pass
        elif bid in (0x23, 0x24):
            p += 2
        elif bid == 0x26:
            n = u16(src, p); p += 2 + 2 * n
        elif bid == 0x28:
            ln = u16(src, p); p += 2 + ln
        elif bid == 0x2A:
            p += 4
        elif bid == 0x2B:
            ln = u32(src, p); p += 4 + ln
        elif bid == 0x30:
            ln = src[p]; p += 1 + ln
        elif bid == 0x31:
            ln = src[p + 1]; p += 2 + ln
        elif bid == 0x32:
            ln = u16(src, p); p += 2 + ln
        elif bid == 0x33:
            n = src[p]; p += 1 + 3 * n
        elif bid == 0x35:
            ln = u32(src, p + 10); p += 14 + ln
        elif bid == 0x40:
            ln = u24(src, p + 1); p += 4 + ln
        elif bid == 0x4B:
            ln = u32(src, p); p += 4 + ln
        elif bid == 0x5A:
            p += 9
        else:
            raise ValueError(f"Unsupported TZX block ${bid:02X} at file ${start:04X}")

        if p > len(src):
            raise ValueError(f"Truncated TZX block ${bid:02X} at file ${start:04X}")
        yield TzxBlock(index, bid, start, body, data)
        index += 1

def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def write_raw(root: Path, rel: str, data: bytes) -> Path:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return path

def _source_name(source: Path) -> str:
    try:
        return source.resolve().relative_to(REPO.resolve()).as_posix()
    except ValueError:
        return source.as_posix()


def manifest_entry(*, name: str, path: Path, data: bytes, source: Path,
                   source_kind: str, source_offset: int | None = None,
                   ram_start: int | None = None, loaded_start: int | None = None,
                   confidence: str, description: str, extra: dict | None = None) -> dict:
    d = {
        "name": name,
        "path": path.as_posix(),
        "source": _source_name(source),
        "source_kind": source_kind,
        "source_offset": source_offset,
        "ram_start": ram_start,
        "loaded_start": loaded_start,
        "length": len(data),
        "sha256": sha256(data),
        "confidence": confidence,
        "description": description,
    }
    if extra:
        d.update(extra)
    return d

def extract_game(path: Path, out: Path, manifest: list[dict]) -> bytes:
    src = path.read_bytes()
    blocks = list(iter_tzx(src))
    candidates = [
        b for b in blocks
        if b.block_id == 0x10 and b.data and len(b.data) == GAME_PAYLOAD_SIZE + 2
        and b.data[0] == 0xFF
    ]
    if len(candidates) != 1:
        raise ValueError(f"Expected one Game main $10 block; found {len(candidates)}")
    b = candidates[0]
    assert b.data is not None
    # Spectrum data block is flag + payload + parity; XOR of all bytes is zero.
    if _xor(b.data) != 0:
        raise ValueError("Game main block parity/XOR check failed")
    payload = b.data[1:-1]
    if len(payload) != GAME_PAYLOAD_SIZE:
        raise AssertionError("Game payload length mismatch")

    game_root = out / "game"
    p = write_raw(game_root, "Game_Main_5B00_FFFF.bin", payload)
    manifest.append(manifest_entry(
        name="Game_Main_5B00_FFFF.bin", path=p.relative_to(out), data=payload, source=path,
        source_kind="game-tzx", source_offset=b.file_offset + 5 + 1,
        ram_start=GAME_LOAD_BASE, confidence="PROVEN",
        description="complete main RAM payload loaded at $5B00-$FFFF",
        extra={"tzx_block_index": b.index, "tzx_block_id": b.block_id,
               "spectrum_flag": b.data[0], "spectrum_parity": b.data[-1]},
    ))

    for rel, start, end, description, confidence in GAME_RANGES:
        if not (GAME_LOAD_BASE <= start < end <= GAME_LOAD_BASE + len(payload)):
            raise AssertionError(f"Bad Game range {rel}: ${start:04X}-${end:04X}")
        data = payload[start - GAME_LOAD_BASE:end - GAME_LOAD_BASE]
        p = write_raw(game_root, rel, data)
        manifest.append(manifest_entry(
            name=Path(rel).name, path=p.relative_to(out), data=data, source=path,
            source_kind="game-tzx",
            source_offset=b.file_offset + 5 + 1 + (start - GAME_LOAD_BASE),
            ram_start=start, confidence=confidence, description=description,
            extra={"ram_end_exclusive": end},
        ))

    payload_file_offset = b.file_offset + 6
    split_champions(payload, path, game_root, out, manifest, payload_file_offset)
    return payload

def split_champions(payload: bytes, source: Path, root: Path, out: Path,
                    manifest: list[dict], payload_file_offset: int) -> None:
    base = 0x9B23
    for i in range(16):
        addr = base + i * 0x5A
        rec = payload[addr - GAME_LOAD_BASE:addr - GAME_LOAD_BASE + 0x5A]
        if len(rec) != 0x5A:
            raise AssertionError("champion split range outside Game payload")
        stem = f"champions/records/{i+1:02d}"
        parts = (
            ("template", 0x00, 0x5A, "complete $5A champion template"),
            ("portrait.graphics", 0x00, 0x1E, "16x15 one-bit portrait bitmap"),
            ("name.raw", 0x1E, 0x2E, "16-byte champion name field"),
            ("data", 0x2F, 0x5A, "43-byte champion data record"),
            ("quantities", 0x2F + 0x13, 0x2F + 0x17,
             "shared quantities for objects $01-$04"),
            ("pockets", 0x2F + 0x17, 0x2F + 0x21,
             "ten actual equipment/pocket object bytes"),
            ("learned-spells.flags", 0x2F + 0x27, 0x2F + 0x2B,
             "32 learned-spell flags"),
        )
        for suffix, a, z, desc in parts:
            data = rec[a:z]
            p = write_raw(root, f"{stem}.{suffix}", data)
            manifest.append(manifest_entry(
                name=p.name, path=p.relative_to(out), data=data, source=source,
                source_kind="game-tzx", source_offset=payload_file_offset + (addr + a - GAME_LOAD_BASE), ram_start=addr + a,
                confidence="PROVEN", description=desc,
                extra={"champion_index": i + 1, "record_ram_start": addr},
            ))

def _xor(data: bytes) -> int:
    v = 0
    for b in data:
        v ^= b
    return v

def extract_levels(path: Path, out: Path, manifest: list[dict]) -> None:
    src = path.read_bytes()
    seen: set[int] = set()
    for b in iter_tzx(src):
        if b.block_id != 0x10 or b.data is None or len(b.data) != LEVEL_PAYLOAD_SIZE + 2:
            continue
        flag = b.data[0]
        if flag not in LEVEL_NAMES:
            continue
        if _xor(b.data) != 0:
            raise ValueError(f"Level ${flag:02X} parity/XOR check failed")
        if flag in seen:
            raise ValueError(f"Duplicate Level Data flag ${flag:02X}")
        seen.add(flag)
        payload = b.data[1:-1]
        ident = chr(flag)
        root = out / "levels" / f"{ident}-{LEVEL_NAMES[flag]}"
        whole = write_raw(root, "LevelPayload.bin", payload)
        manifest.append(manifest_entry(
            name=f"{ident}-{LEVEL_NAMES[flag]} LevelPayload",
            path=whole.relative_to(out), data=payload, source=path,
            source_kind="level-tzx", source_offset=b.file_offset + 5 + 1,
            loaded_start=0, confidence="PROVEN",
            description="complete $08CB-byte tower payload (flag/parity excluded)",
            extra={"tzx_block_index": b.index, "spectrum_flag": flag,
                   "spectrum_parity": b.data[-1]},
        ))

        for rel, start, end, description, confidence in LEVEL_RANGES:
            data = payload[start:end]
            p = write_raw(root, rel, data)
            manifest.append(manifest_entry(
                name=Path(rel).name, path=p.relative_to(out), data=data, source=path,
                source_kind="level-tzx",
                source_offset=b.file_offset + 5 + 1 + start,
                loaded_start=start, confidence=confidence, description=description,
                extra={"tower_flag": flag, "tower_id": ident,
                       "loaded_end_exclusive": end},
            ))
        payload_file_offset = b.file_offset + 6
        split_monsters(payload, path, root, out, manifest, flag, payload_file_offset)
        split_floors(payload, path, root, out, manifest, flag, payload_file_offset)

    missing = set(LEVEL_NAMES) - seen
    if missing:
        raise ValueError("Missing Level Data block(s): " +
                         ", ".join(f"${x:02X}" for x in sorted(missing)))

def split_monsters(payload: bytes, source: Path, root: Path, out: Path,
                   manifest: list[dict], flag: int, payload_file_offset: int) -> None:
    base = 0x475
    for i in range(42):
        data = payload[base + i * 16:base + (i + 1) * 16]
        p = write_raw(root, f"monsters/records/{i:02d}.monster", data)
        manifest.append(manifest_entry(
            name=p.name, path=p.relative_to(out), data=data, source=source,
            source_kind="level-tzx", source_offset=payload_file_offset + base + i * 16, loaded_start=base + i * 16,
            confidence="PROVEN", description="one raw 16-byte authored monster slot",
            extra={"tower_flag": flag, "monster_slot": i},
        ))

def split_floors(payload: bytes, source: Path, root: Path, out: Path,
                 manifest: list[dict], flag: int, payload_file_offset: int) -> None:
    workspace = payload[0x040:0x44C]
    for i in range(5):
        q = 0x022 + i * 6
        w, h = payload[q], payload[q + 1]
        off = int.from_bytes(payload[q + 2:q + 4], "big")
        size = w * h
        if off > len(workspace) or off + size > len(workspace):
            # Preserve descriptor but do not invent/clip an invalid floor slice.
            continue
        data = workspace[off:off + size]
        p = write_raw(root, f"maps/floors/floor{i}.map", data)
        manifest.append(manifest_entry(
            name=p.name, path=p.relative_to(out), data=data, source=source,
            source_kind="level-tzx", source_offset=payload_file_offset + 0x040 + off, loaded_start=0x040 + off,
            confidence="PROVEN", description="physically authored floor map bytes",
            extra={"tower_flag": flag, "floor": i, "width": w, "height": h,
                   "workspace_offset": off, "x_alignment": payload[q + 4],
                   "y_alignment": payload[q + 5]},
        ))

def clean_generated(out: Path) -> None:
    # Do not delete README/source-control notes. Remove only generated roots/files.
    for name in ("game", "levels"):
        p = out / name
        if p.exists():
            import shutil
            shutil.rmtree(p)
    for name in ("manifest.json", "manifest.sha256"):
        p = out / name
        if p.exists():
            p.unlink()


def extract_game_ram(path: Path, out: Path, manifest: list[dict]) -> bytes:
    payload = path.read_bytes()
    if len(payload) != GAME_PAYLOAD_SIZE:
        raise ValueError(f"Game RAM extract must be exactly ${GAME_PAYLOAD_SIZE:X} bytes")
    game_root = out / "game"
    p = write_raw(game_root, "Game_Main_5B00_FFFF.bin", payload)
    manifest.append(manifest_entry(name="Game_Main_5B00_FFFF.bin", path=p.relative_to(out), data=payload,
        source=path, source_kind="game-ram-extract", ram_start=GAME_LOAD_BASE,
        confidence="PROVEN", description="complete main RAM payload loaded at $5B00-$FFFF"))
    for rel,start,end,description,confidence in GAME_RANGES:
        data=payload[start-GAME_LOAD_BASE:end-GAME_LOAD_BASE]
        p=write_raw(game_root,rel,data)
        manifest.append(manifest_entry(name=Path(rel).name,path=p.relative_to(out),data=data,
            source=path,source_kind="game-ram-extract",ram_start=start,confidence=confidence,
            description=description,extra={"ram_end_exclusive":end}))
    split_champions(payload,path,game_root,out,manifest,0)
    return payload


def extract_one_level_payload(path: Path, out: Path, manifest: list[dict], flag: int = 0x64) -> None:
    payload=path.read_bytes()
    if len(payload)!=LEVEL_PAYLOAD_SIZE:
        raise ValueError(f"Level payload extract must be exactly ${LEVEL_PAYLOAD_SIZE:X} bytes")
    name=LEVEL_NAMES.get(flag,"Level")
    ident=chr(flag) if flag in LEVEL_NAMES else f"{flag:02X}"
    root=out/"levels"/f"{ident}-{name}"
    whole=write_raw(root,"LevelPayload.bin",payload)
    manifest.append(manifest_entry(name=f"{ident}-{name} LevelPayload",path=whole.relative_to(out),data=payload,
        source=path,source_kind="level-payload-extract",loaded_start=0,confidence="PROVEN",
        description="complete $08CB-byte tower payload (flag/parity excluded)",extra={"tower_flag":flag}))
    for rel,start,end,description,confidence in LEVEL_RANGES:
        data=payload[start:end]; p=write_raw(root,rel,data)
        manifest.append(manifest_entry(name=Path(rel).name,path=p.relative_to(out),data=data,source=path,
            source_kind="level-payload-extract",loaded_start=start,confidence=confidence,description=description,
            extra={"tower_flag":flag,"tower_id":ident,"loaded_end_exclusive":end}))
    split_monsters(payload,path,root,out,manifest,flag,0)
    split_floors(payload,path,root,out,manifest,flag,0)

def main() -> None:
    ap = argparse.ArgumentParser(
        description="Extract raw Bloodwych ZX Game/Level TZX resources"
    )
    ap.add_argument("--game", type=Path, default=DEFAULT_GAME)
    ap.add_argument("--levels", type=Path, default=DEFAULT_LEVELS)
    ap.add_argument("--game-ram", type=Path, help="already extracted $5B00-$FFFF Game RAM image")
    ap.add_argument("--level-payload", type=Path, help="one already extracted $08CB Level payload")
    ap.add_argument("--level-flag", type=lambda x:int(x,0), default=0x64, help="flag for --level-payload, default 0x64 Keeps")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--game-only", action="store_true")
    ap.add_argument("--levels-only", action="store_true")
    ap.add_argument("--no-clean", action="store_true",
                    help="do not remove previous generated game/levels roots first")
    args = ap.parse_args()
    if args.game_only and args.levels_only:
        ap.error("--game-only and --levels-only are mutually exclusive")
    args.out.mkdir(parents=True, exist_ok=True)
    if not args.no_clean:
        clean_generated(args.out)

    manifest: list[dict] = []
    if not args.levels_only:
        if args.game_ram: extract_game_ram(args.game_ram,args.out,manifest)
        else: extract_game(args.game,args.out,manifest)
    if not args.game_only:
        if args.level_payload: extract_one_level_payload(args.level_payload,args.out,manifest,args.level_flag)
        else: extract_levels(args.levels,args.out,manifest)

    manifest.sort(key=lambda x: x["path"])
    meta = {
        "format": "Bloodwych ZX raw extraction manifest",
        "version": 1,
        "generated_from": {
            "game": args.game.as_posix() if not args.levels_only else None,
            "levels": args.levels.as_posix() if not args.game_only else None,
        },
        "entries": manifest,
    }
    encoded = (json.dumps(meta, indent=2) + "\n").encode()
    (args.out / "manifest.json").write_bytes(encoded)
    (args.out / "manifest.sha256").write_text(
        hashlib.sha256(encoded).hexdigest() + "  manifest.json\n", encoding="ascii"
    )
    print(f"Wrote {len(manifest)} entries to {args.out}")
    print(f"Manifest SHA256 {hashlib.sha256(encoded).hexdigest()}")

if __name__ == "__main__":
    main()
