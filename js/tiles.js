/* Structural ZX map-byte decoding.
 *
 * Stage 5 treats the byte as a bitfield first. Friendly names are added only
 * where the current ZX evidence supports them. Object state remains bit 2.
 * Actor occupancy is bit 7 for non-door cells; on doors bits 5-7 are the
 * lock/colour index, so bit 7 must not also be described as occupancy.
 */
(function(global){
  'use strict';

  const FACING=['N','E','S','W'];

  function decode(value){
    value&=0xff;
    const baseType=value&3;
    const hasObject=!!(value&0x04);
    const feature=(value>>3)&0x0f;
    const facing=FACING[feature&3];
    const occupied=baseType===2?false:!!(value&0x80);

    let kind=['floor','floor-feature','door','wall'][baseType];
    let label=['Floor / space','Floor feature','Door','Stone wall'][baseType];
    let confidence='structural';
    let note='';
    let orientation=null;
    let lockId=null;
    let closedBit=null;
    let wallFeature=null;
    let socketFilled=false;

    if(baseType===1){
      // The feature field is independent of object/occupancy bits.
      if(feature===1){
        kind='pad';label='Floor pad / trigger';confidence='user-confirmed-family';
        note='The linked Event determines whether this pad is a tower exit, Vivify, teleport or another action.';
      }else if(feature===2){
        kind='pad';label='Invisible floor pad / trigger';confidence='user-confirmed-family';
        note='The linked Event determines the gameplay action.';
      }else if(feature===4){
        kind='floor-feature';label='Possible ladder-up variant';confidence='inferred';
      }else if(feature===5){
        kind='ladder-up';label='Ladder up';confidence='user-confirmed';note='Orientation is not yet proven.';
      }else if(feature===6){
        kind='ladder-down';label='Ladder down';confidence='user-confirmed';note='Orientation is not yet proven.';
      }else if(feature===7){
        kind='floor-feature';label='Possible ladder-down variant';confidence='inferred';
      }
    }else if(baseType===2){
      // Confirmed door family: bit 3 selects passage axis, bit 4 is the
      // closed/blocking state and bits 5-7 select the lock/colour index.
      orientation=(value&0x08)?'EW':'NS';
      closedBit=!!(value&0x10);
      lockId=(value>>5)&7;
      label=`Door (${orientation}, ${closedBit?'closed':'open'}${lockId?`, lock ${lockId}`:''})`;
      confidence='user-confirmed-family';
    }else if(baseType===3){
      // Features 4-7 are empty sockets, 8-11 switches and 12-15 filled
      // crystal/gem sockets.  The latter is corroborated by every non-zero
      // $006-$015 special-location record resolving onto this family.
      if(feature===0){
        wallFeature='plain';
      }else if(feature>=4&&feature<=7){
        kind='socket';wallFeature='socket';socketFilled=false;
        label='Empty gem socket';confidence='user-confirmed-family';
      }else if(feature>=8&&feature<=11){
        kind='switch';wallFeature='switch';
        label='Switch';confidence='user-confirmed-family';
      }else if(feature>=12){
        kind='socket';wallFeature='socket';socketFilled=true;
        label='Filled crystal / gem socket';confidence='strong-data-derived';
        note='Colour/identity is supplied by the matching $006-$015 special-location record when present.';
      }else{
        wallFeature='other';
        label=`Stone wall / feature ${feature}`;confidence='structural';
      }
    }

    const flags=[];
    if(hasObject)flags.push('object stack');
    if(occupied)flags.push('occupied');
    const displayLabel=flags.length?`${label} + ${flags.join(' + ')}`:label;

    return {
      value,baseType,baseLabel:['floor','floor feature','door','wall'][baseType],feature,
      hasObject,occupied,kind,label:displayLabel,featureLabel:label,confidence,note,
      facing:(kind==='switch'||kind==='socket')?facing:null,
      orientation,lockId,closedBit,wallFeature,socketFilled
    };
  }

  global.BWTiles={decode};
})(window);
