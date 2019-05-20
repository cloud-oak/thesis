'use strict';

import * as util from './util.js';

const Perfect1 = 0;
const Half     = 1;
const Whole    = 2;
const Min3     = 3;
const Maj3     = 4;
const Perfect4 = 5;
const Tritone  = 6;
const Perfect5 = 7;
const Min6     = 8;
const Maj6     = 9;
const Min7     = 10;
const Maj7     = 11;
const Octave   = 12;

const CHORDS = {
  "":    [Perfect1, Maj3, Perfect5],
  "maj7":[Perfect1, Maj3, Perfect5, Maj7],
  "7":   [Perfect1, Maj3, Perfect5, Min7],
  "+":   [Perfect1, Maj3, Min6],
  "m":   [Perfect1, Min3, Perfect5],
  "m7":  [Perfect1, Min3, Perfect5, Min7],
  "o":   [Perfect1, Min3, Tritone],
  "o7":  [Perfect1, Min3, Tritone, Maj6],
  "ø":   [Perfect1, Min3, Tritone, Min7],
}

const scales = {'': [0, 2, 4, 5, 7, 9, 11], 'm': [0, 2, 3, 5, 7, 8, 10]};
const roman_steps = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const pitch2note = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']

const note2pitch = {
  c: 0, 'c#': 1, 'db': 1, d: 2, 'd#': 3, 'eb': 3, e: 4,
  'e#': 5, 'fb': 4, f: 5, 'f#': 6, 'gb': 6, 'g': 7, 'g#': 8, 'ab': 8,
  'a': 9, 'a#': 10, 'bb': 10, 'b': 11, 'cb': 11, 'b#': 0, '_': null
};

const counttime = function() {
  let start = 0;
  return function(el) {
    el.start = start;
    start = start + el.duration;
    return el;
  }
}

const chordname = function(chord) {
  return pitch2note[chord.base] + chord.mode;
}

const relative = function(chord, key) {
  chord.base = (12 + chord.base - key.base) % 12;
  return chord;
}

const absolute = function(chord, key) {
  chord.base = (12 + chord.base + key.base) % 12;
  return chord;
}

const scaletone = function(chord, key) {
  const scale = scales[key.mode].map(x => (12+x+key.base)%12);
  let scalestep_zerobased = scale.indexOf(chord.base);
  if(scalestep_zerobased == -1)
    scalestep_zerobased = scale.indexOf((chord.base+1) % 12) - 0.5;
  chord.base = scalestep_zerobased+1;
  return chord;
}

const scaletone_to_absolute = function(rel, key) {
  const scale = scales[key.mode].map(x => (12+x+key.base)%12);
  let truestep = Math.ceil(rel.base-1);
  if(rel.base-1 === truestep)
    rel.base = scale[truestep];
  else
    rel.base = (scale[truestep] + 11) % 12;
  return rel;
}

const roman = function(chord, key) {
  const scale = scales[key.mode].map(x => (12+x+key.base)%12);
  const idx = roman_steps[scale.indexOf(chord.base)] ||
    (roman_steps[scale.indexOf((1+chord.base) % 12)] + "♭")
  return idx + chord.mode;
}

const roman_matchr = /([IV]+)((?:7|maj7|m7?|o7?|ø|\+)?)/;
const read_roman = function(r) {
  const [, base, mode] = r.match(roman_matchr);
  return [roman_steps.indexOf(base)+1, mode];
};

const isminor     = chord => chord.mode === 'm7'   || chord.mode === 'm';
const istonic     = chord => chord.mode === 'maj7' || chord.mode === '';
const isdominant  = chord => chord.mode === '7' || chord.mode === '';
const hasinterval = (c1, c2, interval) => (12 + c2.base - c1.base) % 12 === (12+interval)%12;

const find_patterns = function(chords) {
  let patterns = [];
  for(let i = 0; i<chords.length-1; i++) {
    const c1 = chords[i];
    const c2 = chords[i+1];
    const found = type => patterns.push({start:c1.start, duration:c2.start-c1.start, type:type});
    if(hasinterval(c1,c2, -Perfect5)) {
      if(isminor(c1) && isdominant(c2))
        found('ii-V');
      else if(isdominant(c1) && istonic(c2))
        found('V-I');
      else
        found('↷');
    }
    else if(hasinterval(c1,c2, +Perfect5)) {
      found('↶');
    }
    else if(hasinterval(c1,c2, -Half)) {
      if(isminor(c1) && isdominant(c2))
        found('ii-IIb');
      else if(isdominant(c1) && istonic(c2))
        found('IIb-I');
      else
        found('⬂');
    }
    else if(hasinterval(c1,c2, +Half)) {
      found('⬀');
    }
    else if(hasinterval(c1,c2, -Whole))
      found('⬊');
    else if(hasinterval(c1,c2, +Whole))
      found('⬈');
    else if(hasinterval(c1,c2, -Tritone))
      found('♆');
  }
  return patterns;
};

const dictify = function(raw_rules) {
  let rules = {};
  for(const [l,r] of raw_rules) {
    rules[l] = (rules[l] || []).concat([r]);
    rules[r] = (rules[r] || []).concat([l]);
  }
  return rules;
}

const tritonals = dictify(util.range(12).map(x =>
  [[x+1, '7'], [(x+7)%12, '7']]
));
console.log(tritonals);

const reharmonization_rules = dictify([
  ['IIIm7', 'Imaj7'],
  ['VIm7', 'Imaj7'],
  ['IVmaj7', 'IIm7'],
  ['IIm7', 'IVmaj7'],
  ['VIm7', 'IVmaj7'],
  ['I', 'IIIm7']
].map(x => x.map(read_roman)));

const reharmonize = function(progression, key) {
  return progression.map(function(chord) {
    let rel = relative(chord, key);
    const alternatives = tritonals[[rel.base, rel.mode]];
    if(alternatives && Math.random() > 0) {
      const selected = alternatives[Math.floor(Math.random()*alternatives.length)];
      [rel.base, rel.mode] = selected;
    }
    return absolute(rel, key);
  });
};

export { CHORDS, counttime, chordname, note2pitch, scales, roman, reharmonize, find_patterns };
