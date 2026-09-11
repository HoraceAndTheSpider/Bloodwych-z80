#!/usr/bin/env python3
"""Editor-facing byte-preserving models for Bloodwych ZX Spectrum resources.

This module deliberately operates on loaded Game RAM bytes and Level payload
bytes. It does not rewrite TZX containers. Unknown bytes remain untouched.
"""
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

GAME_BASE = 0x5B00
GAME_SIZE = 0xA500
LEVEL_SIZE = 0x08CB

FLOOR_DESC = 0x022
MAP_BASE = 0x040
MAP_SIZE = 0x40C
TEAM_BASE = 0x44C
TEAM_COUNT = 10
TEAM_WIDTH = 4
MONSTER_COUNT = 0x474
MONSTER_BASE = 0x475
MONSTER_MAX = 42
MONSTER_SIZE = 16
OBJECT_USED = 0x715
OBJECT_BASE = 0x717
OBJECT_SIZE = 0x100
EVENT_BASE = 0x817
EVENT_COUNT = 45
EVENT_SIZE = 4

CHAMPION_BASE = 0x9B23
CHAMPION_COUNT = 16
CHAMPION_STRIDE = 0x5A
CHAMPION_DATA = 0x2F
POCKET_FIRST = 0x17
POCKET_COUNT = 10
QUANTITY_FIRST = 0x13


def s8(v: int) -> int:
    return v - 256 if v & 0x80 else v


def le16(data: bytes | bytearray, p: int) -> int:
    return data[p] | data[p + 1] << 8


def be16(data: bytes | bytearray, p: int) -> int:
    return data[p] << 8 | data[p + 1]


@dataclass(frozen=True)
class FloorDescriptor:
    index: int
    width: int
    height: int
    data_offset: int
    x_align: int
    y_align: int

    @property
    def used(self) -> bool:
        return self.width > 0 and self.height > 0

    @property
    def count(self) -> int:
        return self.width * self.height


@dataclass(frozen=True)
class MonsterRecord:
    index: int
    raw: bytes

    @property
    def unused(self) -> bool:
        return all(v == 0xFF for v in self.raw)

    @property
    def x(self) -> int: return self.raw[0]
    @property
    def y(self) -> int: return self.raw[1]
    @property
    def orientation(self) -> int: return self.raw[2]
    @property
    def floor(self) -> int: return self.raw[3]
    @property
    def action_cycle(self) -> int: return self.raw[4]
    @property
    def base_level(self) -> int: return self.raw[5]
    @property
    def effective_level(self) -> int: return self.raw[6]
    @property
    def hp(self) -> int: return self.raw[7] | self.raw[8] << 8
    @property
    def action_status(self) -> int: return self.raw[9]
    @property
    def appearance(self) -> int: return self.raw[10]
    @property
    def dropped_object(self) -> int: return self.raw[11]
    @property
    def team_field(self) -> int: return self.raw[12]
    @property
    def entity_class(self) -> int: return self.raw[13]
    @property
    def runtime_status(self) -> int: return self.raw[14]
    @property
    def target_ref(self) -> int: return self.raw[15]


class GameImage:
    def __init__(self, data: bytes | bytearray):
        if len(data) != GAME_SIZE:
            raise ValueError(f"Game image must be {GAME_SIZE} loaded bytes ($5B00-$FFFF)")
        self.data = bytearray(data)

    @classmethod
    def from_file(cls, path: str | Path) -> "GameImage":
        return cls(Path(path).read_bytes())

    def off(self, address: int) -> int:
        if not (GAME_BASE <= address <= 0xFFFF):
            raise IndexError(f"Game RAM address ${address:04X} outside $5B00-$FFFF")
        return address - GAME_BASE

    def byte(self, address: int) -> int:
        return self.data[self.off(address)]

    def slice(self, start: int, end: int) -> bytes:
        return bytes(self.data[self.off(start): self.off(end - 1) + 1])

    def word(self, address: int) -> int:
        p = self.off(address)
        return le16(self.data, p)

    def champion_offset(self, champion_index: int) -> int:
        if not 0 <= champion_index < CHAMPION_COUNT:
            raise IndexError("champion index must be 0..15")
        return self.off(CHAMPION_BASE + champion_index * CHAMPION_STRIDE)

    def champion_name(self, champion_index: int) -> str:
        p = self.champion_offset(champion_index) + 0x1E
        return bytes(self.data[p:p + 16]).split(b"\0", 1)[0].decode("latin1", "replace").rstrip()

    def champion_data(self, champion_index: int) -> bytes:
        p = self.champion_offset(champion_index) + CHAMPION_DATA
        return bytes(self.data[p:p + 43])

    def starting_pockets(self, champion_index: int) -> list[int]:
        p = self.champion_offset(champion_index) + CHAMPION_DATA + POCKET_FIRST
        return list(self.data[p:p + POCKET_COUNT])

    def shared_quantities(self, champion_index: int) -> list[int]:
        p = self.champion_offset(champion_index) + CHAMPION_DATA + QUANTITY_FIRST
        return list(self.data[p:p + 4])

    def set_starting_pocket(self, champion_index: int, pocket_index: int, object_code: int) -> None:
        """Patch one of the ten real starting equipment/pocket slots only."""
        if not 0 <= pocket_index < POCKET_COUNT:
            raise IndexError("pocket index must be 0..9")
        if not 0 <= object_code <= 0x4B:
            raise ValueError("normal authored object code must be $00-$4B")
        p = self.champion_offset(champion_index) + CHAMPION_DATA + POCKET_FIRST + pocket_index
        self.data[p] = object_code

    def set_shared_quantity(self, champion_index: int, object_code: int, quantity: int) -> None:
        """Set the separate shared quantity for object codes $01-$04."""
        if not 1 <= object_code <= 4:
            raise ValueError("shared quantity exists only for object codes $01-$04")
        if not 0 <= quantity <= 0xFF:
            raise ValueError("quantity must fit one byte")
        p = self.champion_offset(champion_index) + CHAMPION_DATA + 0x12 + object_code
        self.data[p] = quantity


class LevelPayload:
    def __init__(self, data: bytes | bytearray):
        if len(data) != LEVEL_SIZE:
            raise ValueError(f"Level payload must be {LEVEL_SIZE} bytes ($08CB)")
        self.data = bytearray(data)

    @classmethod
    def from_file(cls, path: str | Path) -> "LevelPayload":
        return cls(Path(path).read_bytes())

    def floor(self, index: int) -> FloorDescriptor:
        if not 0 <= index < 5:
            raise IndexError("floor index must be 0..4")
        p = FLOOR_DESC + index * 6
        return FloorDescriptor(index, self.data[p], self.data[p + 1], be16(self.data, p + 2), self.data[p + 4], self.data[p + 5])

    def floors(self) -> list[FloorDescriptor]:
        return [self.floor(i) for i in range(5)]

    def map_offset(self, floor_index: int, x: int, y: int) -> int:
        f = self.floor(floor_index)
        if not f.used or not (0 <= x < f.width and 0 <= y < f.height):
            raise IndexError(f"cell ({x},{y}) outside floor {floor_index}")
        return f.data_offset + y * f.width + x

    def map_loaded_offset(self, floor_index: int, x: int, y: int) -> int:
        return MAP_BASE + self.map_offset(floor_index, x, y)

    def cell(self, floor_index: int, x: int, y: int) -> int:
        return self.data[self.map_loaded_offset(floor_index, x, y)]

    def set_cell(self, floor_index: int, x: int, y: int, value: int) -> None:
        self.data[self.map_loaded_offset(floor_index, x, y)] = value & 0xFF

    def resolve_map_offset(self, map_offset: int):
        for f in self.floors():
            if f.used and f.data_offset <= map_offset < f.data_offset + f.count:
                i = map_offset - f.data_offset
                return f.index, i % f.width, i // f.width
        return None

    def team(self, index: int) -> list[int]:
        if not 0 <= index < TEAM_COUNT:
            raise IndexError("team index must be 0..9")
        p = TEAM_BASE + index * TEAM_WIDTH
        return list(self.data[p:p + TEAM_WIDTH])

    def teams(self) -> list[list[int]]:
        return [self.team(i) for i in range(TEAM_COUNT)]

    def monster(self, index: int) -> MonsterRecord:
        if not 0 <= index < MONSTER_MAX:
            raise IndexError("monster index must be 0..41")
        p = MONSTER_BASE + index * MONSTER_SIZE
        return MonsterRecord(index, bytes(self.data[p:p + MONSTER_SIZE]))

    def monsters(self) -> list[MonsterRecord]:
        return [self.monster(i) for i in range(MONSTER_MAX)]

    def _monster_byte(self, index: int, field: int, value: int) -> None:
        self.data[MONSTER_BASE + index * MONSTER_SIZE + field] = value & 0xFF

    def team_for_leader(self, monster_index: int) -> int | None:
        t = self.monster(monster_index).team_field
        return t if 0 <= t < TEAM_COUNT else None

    def members_for_team(self, team_index: int) -> list[int]:
        return [m for m in self.team(team_index) if m != 0xFF]

    def positioned_monsters_at(self, floor: int, x: int, y: int, *, excluding: Iterable[int] = ()) -> list[int]:
        ex = set(excluding)
        out = []
        active = min(self.data[MONSTER_COUNT], MONSTER_MAX)
        for i in range(active):
            if i in ex:
                continue
            m = self.monster(i)
            if not m.unused and m.x != 0xFF and (m.floor, m.x, m.y) == (floor, x, y):
                out.append(i)
        return out

    def _set_occupancy(self, floor: int, x: int, y: int, occupied: bool) -> None:
        v = self.cell(floor, x, y)
        if (v & 3) == 2:
            if occupied:
                raise ValueError("door bit 7 is lock/colour state, not actor occupancy")
            return
        self.set_cell(floor, x, y, (v | 0x80) if occupied else (v & 0x7F))

    def move_monster_or_team(self, monster_index: int, x: int, y: int, floor: int) -> list[int]:
        """Move an individual or positioned team leader transactionally.

        For a team leader, all secondary members keep X=$FF and have Y/floor
        synchronised to the leader. Map occupancy bit 7 is updated without
        disturbing object bit 2. Door destinations are rejected.
        """
        m = self.monster(monster_index)
        if m.unused:
            raise ValueError("cannot move unused monster slot")
        if m.x == 0xFF:
            raise ValueError("secondary team member has no independent map position; move its leader")
        # Validate destination before mutation.
        dv = self.cell(floor, x, y)
        if (dv & 3) == 2:
            raise ValueError("monster/team cannot be placed on a door cell")
        old = (m.floor, m.x, m.y)
        team = self.team_for_leader(monster_index)
        affected = [monster_index]
        if team is not None:
            members = self.members_for_team(team)
            if monster_index not in members:
                raise ValueError(f"leader +$0C={team} but team table does not contain monster {monster_index}")
            affected = members
        # Patch leader.
        self._monster_byte(monster_index, 0, x)
        self._monster_byte(monster_index, 1, y)
        self._monster_byte(monster_index, 3, floor)
        # Secondary members inherit position context but retain X=$FF.
        if team is not None:
            for idx in affected:
                if idx == monster_index:
                    continue
                self._monster_byte(idx, 0, 0xFF)
                self._monster_byte(idx, 1, y)
                self._monster_byte(idx, 3, floor)
                self._monster_byte(idx, 12, 0xFF)
        # Clear old occupancy only if no other positioned actor remains.
        if not self.positioned_monsters_at(*old, excluding=affected):
            self._set_occupancy(*old, False)
        self._set_occupancy(floor, x, y, True)
        return affected

    def set_team(self, team_index: int, members: list[int], leader_index: int, x: int, y: int, floor: int) -> None:
        """Assign a four-slot team and normalise leader/secondary coupling.

        This is intentionally explicit: caller must nominate the positioned
        leader and coordinates rather than relying on a guessed convention.
        """
        if not 0 <= team_index < TEAM_COUNT:
            raise IndexError("team index must be 0..9")
        if not 1 <= len(members) <= 4 or len(set(members)) != len(members):
            raise ValueError("team must contain 1..4 unique monster indexes")
        if any(not 0 <= i < MONSTER_MAX for i in members):
            raise ValueError("monster indexes must be 0..41")
        if leader_index not in members:
            raise ValueError("leader must be one of the supplied members")
        if (self.cell(floor, x, y) & 3) == 2:
            raise ValueError("team leader cannot occupy a door cell")
        p = TEAM_BASE + team_index * 4
        row = members + [0xFF] * (4 - len(members))
        self.data[p:p + 4] = bytes(row)
        for idx in members:
            self._monster_byte(idx, 1, y)
            self._monster_byte(idx, 3, floor)
            if idx == leader_index:
                self._monster_byte(idx, 0, x)
                self._monster_byte(idx, 12, team_index)
            else:
                self._monster_byte(idx, 0, 0xFF)
                self._monster_byte(idx, 12, 0xFF)
        self._set_occupancy(floor, x, y, True)

    def object_arena_used(self) -> int:
        return le16(self.data, OBJECT_USED)

    def object_stacks(self) -> list[dict]:
        used = min(self.object_arena_used(), OBJECT_SIZE)
        p = 0
        out = []
        while p < used:
            if p + 3 > used:
                raise ValueError("object arena ends inside a stack header")
            b0, b1, count = self.data[OBJECT_BASE + p:OBJECT_BASE + p + 3]
            size = 3 + count * 2
            if count > 126 or p + size > used:
                raise ValueError(f"object stack at +${p:03X} overruns used arena")
            pos = b0 >> 6
            mo = ((b0 & 0x3F) << 8) | b1
            items = []
            for i in range(count):
                q = OBJECT_BASE + p + 3 + i * 2
                items.append((self.data[q], self.data[q + 1]))
            out.append({"arena_offset": p, "map_offset": mo, "position": pos,
                        "location": self.resolve_map_offset(mo), "items": items,
                        "raw": bytes(self.data[OBJECT_BASE + p:OBJECT_BASE + p + size])})
            p += size
        return out

    def validate_editor_coupling(self) -> list[str]:
        """Return human-readable invariant errors without changing bytes."""
        errors = []
        active = min(self.data[MONSTER_COUNT], MONSTER_MAX)
        for ti, row in enumerate(self.teams()):
            vals = [v for v in row if v != 0xFF]
            if len(vals) != len(set(vals)):
                errors.append(f"team {ti}: duplicate member index")
            for v in vals:
                if v >= active:
                    errors.append(f"team {ti}: member {v} outside active count {active}")
            leaders = [v for v in vals if self.monster(v).x != 0xFF]
            if vals and len(leaders) != 1:
                errors.append(f"team {ti}: expected one positioned leader, found {leaders}")
            if leaders and self.monster(leaders[0]).team_field != ti:
                errors.append(f"team {ti}: leader {leaders[0]} +$0C != team index")
            for v in vals:
                if v not in leaders and self.monster(v).team_field != 0xFF:
                    errors.append(f"team {ti}: secondary {v} +$0C should be $FF")
        for i in range(active):
            m = self.monster(i)
            if m.unused or m.x == 0xFF:
                continue
            try:
                cell = self.cell(m.floor, m.x, m.y)
            except IndexError:
                errors.append(f"monster {i}: positioned outside floor bounds")
                continue
            if (cell & 3) == 2:
                errors.append(f"monster {i}: positioned on door cell")
            elif not (cell & 0x80):
                errors.append(f"monster {i}: map occupancy bit 7 is not set")
        return errors
