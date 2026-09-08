/* Bloodwych ZX map-byte interpretation.
 *
 * Deliberately conservative. Exact user-confirmed values are listed first.
 * Anything broader is labelled "inferred" so the editor never disguises a
 * hypothesis as a known fact.
 */
(function (global) {
  'use strict';

  const EXACT = new Map();
  function add(value, kind, label, confidence, props) {
    EXACT.set(value, Object.assign({ value, kind, label, confidence }, props || {}));
  }

  // CONFIRMED / user-correlated map meanings.
  add(0x00, 'floor', 'Path / floor', 'confirmed');
  add(0x03, 'wall', 'Wall', 'confirmed');
  add(0x04, 'object', 'Object marker', 'user-observed');
  add(0x0d, 'pad', 'Pad / trigger (type 0)', 'user-observed');
  add(0x11, 'pad', 'Invisible floor pad (Vivify trigger)', 'user-confirmed');
  add(0x09, 'pad', 'Vivify-machine floor pad', 'user-confirmed', { note: 'Earlier observations contained a possible conflicting door interpretation; retain as a review point.' });

  add(0x23, 'socket', 'Empty socket', 'user-confirmed', { facing: 'N' });
  add(0x2b, 'socket', 'Empty socket', 'user-confirmed', { facing: 'E' });
  add(0x33, 'socket', 'Empty socket', 'user-confirmed', { facing: 'S' });
  add(0x3b, 'socket', 'Empty socket', 'user-confirmed', { facing: 'W' });

  add(0x43, 'switch', 'Switch', 'user-confirmed', { facing: 'N' });
  add(0x4b, 'switch', 'Switch', 'user-confirmed', { facing: 'E' });
  add(0x53, 'switch', 'Switch', 'user-confirmed', { facing: 'S' });
  add(0x5b, 'switch', 'Switch', 'user-confirmed', { facing: 'W' });

  add(0x29, 'ladder-up', 'Ladder up', 'user-confirmed', { note: 'Orientation, if encoded, is not yet confirmed.' });
  add(0x31, 'ladder-down', 'Ladder down', 'user-confirmed', { note: 'Orientation, if encoded, is not yet confirmed.' });

  // Exact door codes explicitly identified by the user.
  add(0x3a, 'door', 'Door, lock 1', 'user-confirmed', { orientation: 'EW', lockId: 1 });
  add(0x5a, 'door', 'Door, lock 2', 'user-confirmed', { orientation: 'EW', lockId: 2 });
  add(0x7a, 'door', 'Door, lock 3', 'user-confirmed', { orientation: 'EW', lockId: 3 });
  add(0xda, 'door', 'Door, lock 6', 'user-confirmed', { orientation: 'EW', lockId: 6 });
  add(0xfa, 'door', 'Door, lock 7', 'user-confirmed', { orientation: 'EW', lockId: 7 });
  add(0x52, 'door', 'Door, lock 2', 'user-confirmed', { orientation: 'NS', lockId: 2 });
  add(0xd2, 'door', 'Door, lock 6', 'user-confirmed', { orientation: 'NS', lockId: 6 });
  add(0x02, 'door', 'Door', 'user-confirmed', { orientation: 'NS' });
  // 0A is retained as strongly inferred counterpart to 02; 09 remains the Vivify pad.
  add(0x0a, 'door', 'Door', 'inferred', { orientation: 'EW', note: 'Directional counterpart to $02; verify in Z80 tile handling.' });

  add(0x80, 'monster', 'Monster marker', 'user-confirmed', { monsterCode: 0 });
  add(0x84, 'monster', 'Monster marker “0”', 'user-confirmed', { monsterCode: 4 });

  function decode(value) {
    value &= 0xff;
    const exact = EXACT.get(value);
    if (exact) return Object.assign({}, exact);

    const low = value & 0x0f;
    const high = (value >>> 4) & 0x0f;

    // Strongly supported family: xx2 / xxA door forms. User observations fit
    // bit 3 selecting axis and high-nibble bit 0 selecting closed/blocking state.
    if (low === 0x02 || low === 0x0a) {
      const lockId = high >>> 1;
      return {
        value, kind: 'door', label: lockId ? `Door, probable lock ${lockId}` : 'Door',
        orientation: low === 0x02 ? 'NS' : 'EW',
        lockId,
        closedBit: !!(high & 1),
        confidence: 'inferred',
        note: 'Generic $x2/$xA door-family decoding; exact open/closed semantics still to prove from Z80.'
      };
    }

    // User observation: high nibble 8 denotes a monster/occupant family.
    if (high === 0x08) {
      return {
        value, kind: 'monster', label: `Monster/occupant $${low.toString(16).toUpperCase()}`,
        monsterCode: low, confidence: 'inferred',
        note: 'High-nibble $8 family inferred from $80/$84.'
      };
    }

    // Directional ladder family inferred from confirmed $29/$31.
    if (value === 0x21) return { value, kind: 'ladder-up', label: 'Possible ladder up variant', confidence: 'inferred', note: 'Relationship to $29 is inferred; orientation is not yet confirmed.' };
    if (value === 0x39) return { value, kind: 'ladder-down', label: 'Possible ladder down variant', confidence: 'inferred', note: 'Relationship to $31 is inferred; orientation is not yet confirmed.' };

    return {
      value, kind: 'unknown', label: `Unknown $${value.toString(16).toUpperCase().padStart(2, '0')}`,
      lowNibble: low, highNibble: high, confidence: 'unknown'
    };
  }

  function allExact() {
    return [...EXACT.values()].sort((a, b) => a.value - b.value);
  }

  global.BWTiles = { decode, allExact };
})(window);
