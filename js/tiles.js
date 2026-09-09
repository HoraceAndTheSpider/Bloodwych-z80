/* Structural ZX map-byte decoding.
 *
 * Stage 5 treats the byte as a bitfield first. Friendly names are added only
 * where the existing ZX evidence supports them; object and actor state remain
 * independent flags rather than fake standalone tile types.
 */
(function(global){
  'use strict';

  const FACING=['N','E','S','W'];
  const EXACT_FEATURES=new Map([
    [0x09,{kind:'pad',label:'Vivify-machine floor pad',confidence:'user-confirmed',note:'Keep exact gameplay wording under review where earlier observations conflicted.'}],
    [0x0D,{kind:'pad',label:'Pad / trigger (type 0)',confidence:'user-observed'}],
    [0x11,{kind:'pad',label:'Invisible floor pad (Vivify trigger)',confidence:'user-confirmed'}],
    [0x21,{kind:'floor-feature',label:'Possible ladder-up variant',confidence:'inferred'}],
    [0x29,{kind:'ladder-up',label:'Ladder up',confidence:'user-confirmed',note:'Orientation is not yet proven.'}],
    [0x31,{kind:'ladder-down',label:'Ladder down',confidence:'user-confirmed',note:'Orientation is not yet proven.'}],
    [0x39,{kind:'floor-feature',label:'Possible ladder-down variant',confidence:'inferred'}]
  ]);

  function decode(value){
    value&=0xff;
    const baseType=value&3;
    const hasObject=!!(value&0x04);
    const feature=(value>>3)&0x0f;
    const occupied=!!(value&0x80);
    const facing=FACING[feature&3];
    let kind=['floor','floor-feature','door','wall'][baseType];
    let label=['Floor / space','Floor feature','Door','Stone wall'][baseType];
    let confidence='structural';
    let note='';
    let orientation=null;

    const featureOnly=value&0x7b; // remove object bit and actor bit while retaining base + feature bits
    const exact=EXACT_FEATURES.get(featureOnly);
    if(exact){kind=exact.kind;label=exact.label;confidence=exact.confidence;note=exact.note||'';}

    if(baseType===2){
      orientation=(value&0x08)?'EW':'NS';
      label=`Door (${orientation})`;
      confidence='structural';
    } else if(baseType===3){
      // Directional wall features demonstrated by sockets/switches. Removing
      // bit 2/7 keeps the feature while object/actor flags remain independent.
      const v=value&0x7b;
      if([0x23,0x2b,0x33,0x3b].includes(v)){
        kind='socket';label='Empty socket';confidence='user-confirmed';
      } else if([0x43,0x4b,0x53,0x5b].includes(v)){
        kind='switch';label='Switch';confidence='user-confirmed';
      }
    }

    const flags=[];if(hasObject)flags.push('object stack');if(occupied)flags.push('occupied');
    const displayLabel=flags.length?`${label} + ${flags.join(' + ')}`:label;
    return {value,baseType,baseLabel:['floor','floor feature','door','wall'][baseType],feature,hasObject,occupied,
      kind,label:displayLabel,featureLabel:label,confidence,note,facing:(kind==='switch'||kind==='socket')?facing:null,orientation};
  }

  global.BWTiles={decode};
})(window);
