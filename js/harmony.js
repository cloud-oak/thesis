'use strict';

import * as util from './util.js';
import * as nn from './nn.js';
import * as markov from './markov.js';

const tf = mm.tf; // Recycle the tensorflowjs version bundled by Magenta

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

const CHORD2VEC = {
  G:[-0.0752885565161705, -0.7413208484649658, 1.625884771347046, -1.8664973974227905],
  Fm7:[0.8357461094856262, -1.5927082300186157, -0.45875540375709534, 0.20685531198978424],
  Gmaj7:[-0.3880741596221924, -0.15057063102722168, 0.578837513923645, -1.519753098487854],
  Amaj7:[0.43541866540908813, 0.7640015482902527, 1.0641616582870483, -0.4166770279407501],
  Abo:[0.3693399727344513, -0.9088125824928284, 1.062325119972229, -0.7439653277397156],
  Abo7:[0.3693399727344513, -0.9088125824928284, 1.062325119972229, -0.7439653277397156],
  "A+":[0.3008251488208771, -0.29361972212791443, 2.118706226348877, -0.47718924283981323],
  Ebm7:[1.3532090187072754, -0.2958826720714569, 0.5755455493927002, 0.8265842199325562],
  Bm7:[0.37324953079223633, 0.6513684391975403, 0.6151024103164673, -1.6874921321868896],
  Ab:[1.3750189542770386, -1.6484529972076416, 1.2192625999450684, 0.7045040726661682],
  E7:[0.5131220817565918, 0.3185122013092041, 1.3126431703567505, -0.7706155180931091],
  E:[1.7389775514602661, 0.7365717887878418, 1.3655343055725098, -1.0668524503707886],
  Em7:[-0.28317874670028687, 0.21619823575019836, 1.1160757541656494, -0.9473962187767029],
  Ebmaj7:[-0.07951493561267853, -1.3461787700653076, 0.42790183424949646, 0.47410452365875244],
  Abm:[2.0358047485351562, -0.38370823860168457, 1.262154221534729, -0.005967115983366966],
  "Gb+":[1.8411248922348022, -0.427708238363266, 0.1894751638174057, -1.3433846235275269],
  Abm7:[1.6593409776687622, 0.39169833064079285, 0.5092935562133789, 0.33272600173950195],
  Dø:[-0.4499378502368927, -1.5515916347503662, 0.7486857175827026, -0.020342878997325897],
  Cø:[1.353638768196106, -1.257704734802246, -0.8455597162246704, -0.20564574003219604],
  Db:[2.2080495357513428, -1.0946002006530762, 0.672049343585968, 0.435468465089798],
  Bbo:[0.6005855798721313, -0.4104647636413574, 1.0101494789123535, -0.9098342061042786],
  Bbo7:[0.6005855798721313, -0.4104647636413574, 1.0101494789123535, -0.9098342061042786],
  Dbm7:[1.5295284986495972, 0.3956880271434784, -0.016762953251600266, -0.7392878532409668],
  Bbmaj7:[-0.3621796667575836, -1.3542972803115845, -0.01851966232061386, -0.21353308856487274],
  Am7:[-0.7093169093132019, -0.5013644099235535, 1.2402536869049072, -0.942010223865509],
  Dbm:[2.0270845890045166, 0.14333929121494293, 1.4160720109939575, -0.39251357316970825],
  Bb:[0.2316899597644806, -2.426494836807251, 0.5995323061943054, -0.3592770993709564],
  Cmaj7:[-0.3434816002845764, -0.5269774794578552, -0.04428066313266754, -1.6804096698760986],
  Am:[0.25927460193634033, -0.7237977385520935, 1.4259341955184937, -1.7081471681594849],
  G7:[0.119764544069767, -1.1086645126342773, 0.44270846247673035, -1.4821640253067017],
  A7:[0.024881163612008095, -0.2944609224796295, 1.9900509119033813, -0.335904985666275],
  Gb:[2.5056943893432617, -0.5258026719093323, 0.4336298704147339, -0.32036057114601135],
  Gb7:[1.7158564329147339, -0.15695269405841827, -0.12885521352291107, -1.4694653749465942],
  Ebm:[1.9621134996414185, -1.123080849647522, 0.6763335466384888, 0.08664605021476746],
  Bm:[1.1671499013900757, -0.0027919411659240723, 1.4196481704711914, -1.6499907970428467],
  Dm7:[-0.8449335098266602, -1.2300176620483398, 0.7371889352798462, -0.8719363212585449],
  Fmaj7:[-0.06548206508159637, -1.0506911277770996, -0.3055724501609802, -1.266646146774292],
  Bbm7:[0.8307616114616394, -0.9007686972618103, 0.2948881983757019, 0.7674939632415771],
  Dm:[-0.014019745402038097, -1.4345309734344482, 1.5201283693313599, -1.1344797611236572],
  "F+":[0.849346935749054, -1.7102924585342407, 0.126865416765213, -0.6729702949523926],
  Bbm:[1.7132983207702637, -1.7273943424224854, 0.4426979422569275, 0.07088171690702438],
  Ab7:[1.4307489395141602, -0.40919429063796997, 1.157989501953125, 0.4856501817703247],
  Gbø:[0.2679894268512726, 0.14187870919704437, 0.17143048346042633, -2.039353609085083],
  Emaj7:[0.9215445518493652, 0.7975983023643494, 0.4286048114299774, -0.46417707204818726],
  Dbo:[0.4567996859550476, -1.1144955158233643, 0.7231321334838867, -0.8673044443130493],
  Dbo7:[0.4567996859550476, -1.1144955158233643, 0.7231321334838867, -0.8673044443130493],
  Gbo:[0.7026604413986206, -1.2150732278823853, 0.4352063238620758, -0.7881903648376465],
  Gbo7:[0.7026604413986206, -1.2150732278823853, 0.4352063238620758, -0.7881903648376465],
  "D+":[-0.03428694233298302, -0.9046230912208557, 1.7027822732925415, -0.8350731730461121],
  Ao:[1.0764844417572021, -0.7727481126785278, 0.911585807800293, -0.10429223626852036],
  Ao7:[1.0764844417572021, -0.7727481126785278, 0.911585807800293, -0.10429223626852036],
  Eb7:[0.802041232585907, -0.897408664226532, 1.464500069618225, 0.7852780222892761],
  Em:[0.6132403016090393, -0.1958741843700409, 1.420039176940918, -1.8696988821029663],
  Eb:[0.6808774471282959, -2.2367517948150635, 1.008720874786377, 0.44441482424736023],
  "B+":[1.3567142486572266, 0.11344118416309357, 0.6634173393249512, -1.4296091794967651],
  D7:[-0.28926995396614075, -0.8793833255767822, 1.5866224765777588, -0.7402509450912476],
  Ebo:[0.3490389287471771, -0.5441697239875793, 1.20708167552948, -0.801095724105835],
  Ebo7:[0.3490389287471771, -0.5441697239875793, 1.20708167552948, -0.801095724105835],
  Gø:[0.7385079860687256, -1.390445590019226, -0.3197747468948364, -0.3662770092487335],
  Bo:[0.866553008556366, -1.1676493883132935, 0.4653349220752716, -0.5113248229026794],
  Bo7:[0.866553008556366, -1.1676493883132935, 0.4653349220752716, -0.5113248229026794],
  Ebø:[1.245157241821289, 0.5563415288925171, 1.2136096954345703, 0.3580821454524994],
  Co:[1.1383774280548096, -0.2819714844226837, 0.6321636438369751, -0.942460298538208],
  Co7:[1.1383774280548096, -0.2819714844226837, 0.6321636438369751, -0.942460298538208],
  Dbmaj7:[1.341148018836975, -0.6729612946510315, -0.19121134281158447, 0.4163486957550049],
  Bø:[-0.11907842755317688, -0.11744619160890579, 0.28737547993659973, -1.9513487815856934],
  Bmaj7:[1.4331331253051758, 0.18422994017601013, -0.40709879994392395, -0.6859725713729858],
  Gbm:[1.6843377351760864, 0.2671351432800293, 1.4829905033111572, -0.9034717082977295],
  Bbø:[1.146032452583313, 0.02539602667093277, 0.525286078453064, 0.3776448965072632],
  "E+":[0.7355985045433044, 0.26266705989837646, 1.4759986400604248, -0.9364795088768005],
  C:[-0.004064609296619892, -1.461967945098877, 0.9204244017601013, -1.9718350172042847],
  Fm:[1.2687184810638428, -2.02666974067688, 0.5511162281036377, -0.2782440185546875],
  Abø:[1.1007381677627563, 0.73838210105896, 1.0774024724960327, -0.1319178342819214],
  A:[1.018060564994812, 0.5601209998130798, 2.025099992752075, -1.0989724397659302],
  Cm:[0.4634448289871216, -2.1359751224517822, 0.9615552425384521, -0.4216683506965637],
  Gbmaj7:[1.6019139289855957, -0.24943791329860687, -0.6030953526496887, -0.17692352831363678],
  F:[0.35562366247177124, -2.0636346340179443, 0.509880542755127, -1.439842700958252],
  Cm7:[0.30248281359672546, -1.6455143690109253, -0.5445417165756226, -0.5038033127784729],
  Gm:[0.05002613738179207, -1.9654141664505005, 1.2654211521148682, -0.776449978351593],
  "Db+":[1.9238593578338623, -0.47096946835517883, 0.45365092158317566, -0.37832212448120117],
  F7:[0.777697741985321, -1.6624585390090942, -0.20113827288150787, -0.6439704895019531],
  Gm7:[-0.1281334012746811, -1.4344252347946167, -0.14379844069480896, -1.0754399299621582],
  "Bb+":[0.6338878870010376, -1.634468913078308, 0.7488421201705933, 0.19551798701286316],
  Abmaj7:[0.4266056716442108, -0.8945357203483582, 0.5092280507087708, 0.6957411766052246],
  Fø:[1.5646547079086304, -0.8607141971588135, -0.626789927482605, 0.09324323385953903],
  "Ab+":[1.5634196996688843, -0.6465821862220764, 1.2795979976654053, 0.3896196186542511],
  Dbø:[0.7366135120391846, 0.24719788134098053, 0.3773530423641205, -1.4448461532592773],
  Fo:[0.9150006175041199, -0.32701078057289124, 0.7695603966712952, -1.0039000511169434],
  Fo7:[0.9150006175041199, -0.32701078057289124, 0.7695603966712952, -1.0039000511169434],
  Aø:[-0.6700593829154968, -1.337031364440918, 1.0923651456832886, -0.1127169132232666],
  Do:[1.1507295370101929, -0.5302445292472839, 0.9094887375831604, -0.2548634707927704],
  Do7:[1.1507295370101929, -0.5302445292472839, 0.9094887375831604, -0.2548634707927704],
  Dmaj7:[-0.06428457796573639, 0.241102397441864, 1.2086360454559326, -0.5542612671852112],
  D:[0.3605424463748932, -0.12016196548938751, 2.2140161991119385, -1.205197811126709],
  Go:[1.2507644891738892, -0.4003186821937561, 0.7736255526542664, -0.6293857097625732],
  Go7:[1.2507644891738892, -0.4003186821937561, 0.7736255526542664, -0.6293857097625732],
  Db7:[1.7792075872421265, -0.3204291760921478, 0.17180706560611725, -0.48411044478416443],
  "Eb+":[0.8980532884597778, -1.120400071144104, 1.5737295150756836, 0.5837599635124207],
  Eo:[0.9453214406967163, -1.000643014907837, 0.6442845463752747, -0.19582857191562653],
  Eo7:[0.9453214406967163, -1.000643014907837, 0.6442845463752747, -0.19582857191562653],
  "G+":[0.19335052371025085, -1.2324142456054688, 0.808272659778595, -1.4610568284988403],
  Eø:[-0.5346707701683044, -0.6964148879051208, 0.7658949494361877, -0.6570652723312378],
  B7:[1.155577540397644, 0.2405829131603241, 0.445981502532959, -1.5438735485076904],
  "C+":[0.746242105960846, -1.5361682176589966, 0.11108700931072235, -1.5865954160690308],
  B:[2.315333366394043, 0.021281443536281586, 0.6730377078056335, -1.0266350507736206],
  Gbm7:[1.0499234199523926, 0.6744816303253174, 0.13660402595996857, -1.3483033180236816],
  Bb7:[0.5416885018348694, -1.3794777393341064, 0.5965641736984253, 0.34864816069602966],
  C7:[0.6926381587982178, -1.4613877534866333, -0.2935695946216583, -1.497206449508667],
};

const scales = {'': [0, 2, 4, 5, 7, 9, 11], 'm': [0, 2, 3, 5, 7, 8, 10]};
const roman_steps = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const pitch2note = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

const mode2mode_tonal = {
  "": "",
  "maj7": "Maj7",
  "7": "7",
  "+": "M#5",
  "m": "m",
  "m7": "m7",
  "o": "o",
  "o7": "o7",
  "ø": "m7b5"
}

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

const chordname_tonal = function(chord) {
  return pitch2note[chord.base] + mode2mode_tonal[chord.mode];
}

const relative = function(chord, key) {
  let newchord = {};
  for(key in chord) {
    newchord[k] = chord[k]; // shallow copy
  }
  newchord.base = (12 + chord.base - key.base) % 12;
  return newchord;
}

const absolute = function(chord, key) {
  let newchord = {};
  for(k in chord) {
    newchord[k] = chord[k]; // shallow copy
  }
  newchord.base = (12 + chord.base + key.base) % 12;
  return newchord;
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

const allchords = [];
for(let base of util.range(12)) {
  for(let mode of Object.keys(CHORDS)) {
    allchords.push({base: base, mode: mode})
  }
}

const alternatives = {};
const add_alternative = function(chord, alt) {
  chord[0] = (12+chord[0]) % 12;
  alt[0]   = (12+alt[0]) % 12;
  const value = alternatives[chord] || [];
  if(!value.includes(alt)) {
    value.push(alt);
    alternatives[chord] = value;
  }
}
util.range(12).map(x => {
  add_alternative([x,'7'],    [x+Tritone,'7']); // Tritonal substitution
  add_alternative([x,'maj7'], [x+Maj3,'m7']); // 6.2.1 a)
  add_alternative([x,'maj7'], [x-Min3,'m7']); // 6.2.1 a)
  add_alternative([x,''],     [x+Maj3,'m7']); // 6.2.1 a) for non-maj7
  add_alternative([x,''],     [x-Maj3,'m7']); // 6.2.1 a) for non-maj7
  add_alternative([x,'m7'],   [x-Maj3,'maj7']); // 6.2.1 a) reverse
  add_alternative([x,'m7'],   [x-Maj3,'maj7']); // 6.2.1 a) reverse
  add_alternative([x,'o7'],   [x+Min3, 'o7']);
  add_alternative([x,'o7'],   [x+2*Min3, 'o7']);
  add_alternative([x,'o7'],   [x+3*Min3, 'o7']);
  add_alternative([x,'o'],    [x, 'o7']);
  add_alternative([x,'o'],    [x+Min3, 'o7']);
  add_alternative([x,'o'],    [x+2*Min3, 'o7']);
  add_alternative([x,'o'],    [x+3*Min3, 'o7']);
});

const realization_distance = function(R, S) {
  const c = 2;
  return d3.sum(S.map(s => d3.min(R.map(r => Math.abs(s - r) + (r === s ? 0 : c))) || 0))
}

const chord_realizations = function*(chord, lower_bound=30, upper_bound=48) {
  const mods = CHORDS[chord.mode].map(x => (x + chord.base) % 12);
  for(let first = lower_bound; first < upper_bound; first++) {
    if(!mods.includes(first % 12)) continue;

    for(let second = first+1; second < upper_bound; second++) {
    if(!mods.includes(second % 12)) continue;
      // These are boring: yield [first, second]; // Two-element chords

      for(let third = second+1; third < upper_bound; third++) {
        if(!mods.includes(third % 12)) continue;
        yield [first, second, third]; // Three-element chords

        for(let fourth = third+1; fourth < upper_bound; fourth++) {
        if(!mods.includes(fourth % 12)) continue;
          yield [first, second, third, fourth] // Four-element chords

          for(let fifth = fourth+1; fifth < upper_bound; fifth++) {
            if(!mods.includes(fifth % 12)) continue;
            yield [first, second, third, fourth, fifth] // Five-element chords
          }
        }
      }
    }
  }
}

const melody_to_notesequence = function(melody, shift) {
  const notes = melody.map(function(n) {
    return {
      pitch: n.note,
      quantizedStartStep: Math.round((n.start+shift) / 6),
      quantizedEndStep: Math.round((n.start+shift+n.duration) / 6)
    }
  });
  const totalQuantizedSteps = d3.max(notes => n.quantizedEndStep);
  return {
    notes: notes,
    quantizationInfo: {stepsPerQuarter: 4},
    tempos: [{time: 0, qpm: 120}],
    totalQuantizedSteps: totalQuantizedSteps
  }
}

const notesequence_to_melody = function(notesequence, shift) {
  return notesequence.notes.map(function(n) {
    return {
      note: n.pitch,
      start: n.quantizedStartStep * 6 + shift,
      duration: (n.quantizedEndStep - n.quantizedStartStep) * 6,
      changed: true
    }
  })
}

const pianoroll_to_melody = function(pianoroll, shift) {
  let notes = [];
  let start = 0;
  for(let p = 0; p < 36; p++) {
    let ison = false;
    for(let t = 0; t < 32; t++) {
      let noteon = pianoroll[t][p] > 0;
      if(noteon && (t == 0 || !ison)) {
        ison = true;
        start = t;
      } else if(ison && (!noteon || t == 31)) {
        ison = false;
        if(t == 31) { t++ };
        notes.push({
          note: p + 48,
          start: shift + start * 6,
          duration: (t - start) * 6,
          changed: true
        });
      }
    }
  }
  return notes.sort((a, b) => (a.start - b.start));
}

const reharmonize = function(progression, use_chord2vec=false) {
  return progression.map(function(oldchord) {
    let chord = {}
    Object.assign(chord, oldchord);
    chord.reharmonized = false;
    let newchords = alternatives[[chord.base, chord.mode]];
    if(newchords) {
      if(use_chord2vec) {
        newchords  = [[oldchord.base, oldchord.mode]].concat(newchords);
        const embeddings  = newchords.map(ary => CHORD2VEC[chordname({base: ary[0], mode: ary[1]})]);
        const norms = embeddings.map(e => Math.sqrt(d3.sum(e.map(x => x*x))));
        const cosine_dist = embeddings.map((e, i) => Math.max(0, d3.sum(e.map((v, j) => v * embeddings[0][j])) / norms[0] / norms[i]));

        let random = Math.random() * d3.sum(cosine_dist);
        let idx = 0;
        while(random > cosine_dist[idx]) random -= cosine_dist[idx++];
        
        if(idx > 0) {
          const selected = newchords[idx];
          chord.original = oldchord;
          [chord.base, chord.mode] = selected;
          chord.reharmonized = true;
        }

      } else if(Math.random() > 0.5) {
        const selected = newchords[Math.floor(Math.random()*newchords.length)];
        chord.original = oldchord;
        [chord.base, chord.mode] = selected;
        chord.reharmonized = true;
      }
    }
    return chord;
  });
};

const markov_reharmonize = function(progression, melody, hidden_markov=false, use_grammar=false) {
  let indices = util.range(progression.length);
  util.shuffle(indices);
  
  let conditional_prob; // Make conditional_prob escape the if-scope
  const modes = {"": 0, "7": 1, "maj7": 2, "m": 3, "m7": 4, "o": 5, "o7": 6};
  if(hidden_markov) {
    const last_note = melody[melody.length-1];
    const end  = 8 * Math.ceil((last_note.start + last_note.duration) / 48);
    let melodies = tf.buffer([end, 12]);
    for(let note of melody) {
      const notestart = Math.round(note.start / 6);
      const noteend   = Math.round((note.start+note.duration) / 6);
      for(let t = notestart; t < noteend; t++) {
        melodies.set(1, t, note.note%12);
      }
    }
    melodies = melodies.toTensor().reshape([-1, 8, 12]);
    const chord_probs = hidden_markov_net.predict(melodies).reshape([-1, 12, 7]).arraySync();
    conditional_prob = (replacement, base) => {
      if(replacement.mode === "+" || replacement.mode === "ø") // These are not in the model..
        return 0;
      const tensor_start = Math.floor(base.start / 2);
      const tensor_end   = Math.min(Math.ceil((base.start+base.duration) / 2), chord_probs.length);
      let logsum = 0;
      let logcount = 0;
      for(let t = tensor_start; t < tensor_end; t++) {
        const p = chord_probs[t][replacement.base][modes[replacement.mode]];
        logsum += Math.log(p);
        logcount += 1;
      }
      if(logcount == 0) logcount = 1;
      return Math.exp(logsum / logcount);
    };
  }

  return indices.map(function(i) {
    const oldchord = progression[i];
    let chord = {}
    Object.assign(chord, oldchord);
    chord.reharmonized = false;

    let search_space = allchords;
    if(use_grammar) {
      search_space = alternatives[[oldchord.base, oldchord.mode]];
      if(search_space === undefined)
        return chord;
      search_space = search_space.map(([b, m]) => ({base: b, mode: m}));
      search_space.push(oldchord); // Allow not changing the chord!
    }

    if(search_space.length == 0 && search_space !== undefined) {
      return chord;
    }

    let markov_prob = null;
    if(i == 0) {
      const next = chordname(progression[1])
      markov_prob = (chord => markov.initials[chord] * markov.probs[chordname(chord)][next]);
    } else if(i == progression.length-1) {
      const second_last = chordname(progression[progression.length-2])
      markov_prob = (chord => markov.probs[second_last][chordname(chord)]);
    } else {
      const last    = chordname(progression[i-1]);
      const next    = chordname(progression[i+1]);
      markov_prob = (chord => markov.probs[last][chordname(chord)] * markov.probs[chordname(chord)][next]);
    }

    let prob = markov_prob;
    if(hidden_markov) {
      prob = (chord => markov_prob(chord) * conditional_prob(chord, progression[i]));
    }
    
    let probabilities = util.normalize(search_space.map(prob));
    let random = Math.random();
    let idx = 0;
    while(random > probabilities[idx]) random -= probabilities[idx++];

    const newchord = search_space[idx];
    if(chordname(newchord) !== chordname(oldchord)) {
      chord.reharmonized = true;
      chord.base = newchord.base
      chord.mode = newchord.mode;
      chord.original = oldchord;
    }

    return chord;
  }).sort((x, y) => x.start - y.start);
};

export { CHORDS, counttime, chordname, note2pitch, scales, roman, reharmonize, find_patterns, notesequence_to_melody, melody_to_notesequence, pianoroll_to_melody, chordname_tonal, markov_reharmonize, chord_realizations, realization_distance
};
