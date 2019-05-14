'use strict';

import * as util from "./util.js";

var melody, progression, scroller, svg;
var bpm = 150;
var playing = false;
var midi_ready;

const CHORDS = {
  "maj": [0, 4, 7],
  "maj7":[0, 4, 7, 11],
  "7":   [0, 4, 7, 10],
  "m":   [0, 3, 7],
  "m7":  [0, 3, 7, 10],
  "o":   [0, 3, 6],
  "o7":  [0, 3, 6, 9],
  "ø":   [0, 3, 6, 10],
  "+":   [0, 4, 8]
}

const lead = 'soprano_sax';
MIDI.loadPlugin({
  soundfontUrl: "./soundfont/selection/",
  instruments: [
    "acoustic_grand_piano",
    "acoustic_bass",
    "percussion"
  ],
  onsuccess: function() { 
    MIDI.programChange(1, MIDI.GM.byName['acoustic_bass'].number);  
    // MIDI.programChange(2, MIDI.GM.byName[lead].number);  
    midi_ready();
  }
});

const init = function() {
  let x    = (t => t * 60);
  let xinv = (t => t / 60);
  let y    = (p => (84 - p) * 10);

  const events = melody.concat(progression)
  let duration = d3.max(events.map(x => x.start+x.duration));

  svg = d3.select('#drawing')
    .append('svg')
    .style('height', '100vh')
    .style('width', '100vw');

  const container = svg.append('g').attr('id', 'container')
    .attr('transform', 'translate(100,0)');
  scroller  = container.append('g').attr('id', 'scroller')
    .attr('transform', 'translate(0,0)');
  const notes     = scroller.append('g').attr('id', 'notes');
  const chords    = scroller.append('g').attr('id', 'chords');
  const barlines  = scroller.append('g').attr('id', 'barlines');
  notes.selectAll()
    .data(melody)
    .enter()
    .append('rect')
    .attr('x', d => x(d.start))
    .attr('y', d => y(d.note))
    .attr('width', d => x(d.duration))
    .attr('height', 10)
    .style('stroke', 'white')
    .style('stroke-width', 3);
  chords.selectAll()
    .data(progression)
    .enter()
    .append('text')
    .text(d => d.name)
    .attr('x', d => x(d.start) + 5)
    .attr('y', 100)
    .style('font-family', 'Patrick Hand, cursive')
    .style('font-size', '18pt');
  barlines.selectAll()
    .data(util.range(Math.ceil(duration / 4)))
    .enter()
    .append('line')
    .attr('x1', d => x(4*d))
    .attr('x2', d => x(4*d))
    .attr('y1', y(0))
    .attr('y2', y(96))
    .style('stroke', 'lightgray')
    .style('stroke-width', '1px');
  container.append('line')
    .attr('x1', 0)
    .attr('x2', 0)
    .attr('y1', y(0))
    .attr('y2', y(96))
    .style('stroke', 'red')
    .style('stroke-width', '3px');

  const scl = 15
  const playbutton = svg.append('g')
    .attr('transform', 'translate(10, 500)');
  playbutton.append('rect')
    .attr('x', 0).attr('y', 0)
    .attr('width', 50).attr('height', 50)
    .style('fill', 'white')
  const play_symbol = playbutton.append('path')
    .attr('d', `M -${0.5*scl} -${Math.sqrt(3)/2*scl}` +
               `L -${0.5*scl} ${ Math.sqrt(3)/2*scl}` +
               `L ${scl} 0` +
               `L -${0.5*scl} -${Math.sqrt(3)/2*scl}`)
    .attr('transform', 'translate(25, 25)')
    .style('fill', 'gray');
  const play_surface = playbutton.append('rect')
    .attr('x', 0).attr('y', 0)
    .attr('width', 50).attr('height', 50)
    .style('fill', 'rgba(255,255,255,0.01')
    .style('stroke', 'black')

  midi_ready = function() {
    play_symbol.style('fill', 'black');
    play_surface.on('click', function() { play() });
  }

  const pausebutton = svg.append('g');
  pausebutton.append('rect')
    .attr('x', 0).attr('y', 0)
    .attr('width', 50).attr('height', 50)
    .style('fill', 'white')
  pausebutton.append('rect')
    .attr('x', -scl)
    .attr('y', -scl)
    .attr('height', 2*scl)
    .attr('width', 4*scl/5)
    .attr('transform', 'translate(25, 25)')
  pausebutton.append('rect')
    .attr('x', scl/5)
    .attr('y', -scl)
    .attr('height', 2*scl)
    .attr('width', 4*scl/5)
    .attr('transform', 'translate(25, 25)')
  pausebutton.attr('transform', 'translate(70, 500)');
  pausebutton.append('rect')
    .attr('x', 0).attr('y', 0)
    .attr('width', 50).attr('height', 50)
    .style('fill', 'rgba(255,255,255,0.01')
    .style('stroke', 'black')
    .on('click', function() { pause() });

  const stopbutton = svg.append('g')
    .attr('transform', 'translate(130, 500)');
  stopbutton.append('rect')
    .attr('x', 0).attr('y', 0)
    .attr('width', 50).attr('height', 50)
    .style('fill', 'white')
  stopbutton.append('rect')
    .attr('x', -scl)
    .attr('y', -scl)
    .attr('height', 2*scl)
    .attr('width', 2*scl)
    .attr('transform', 'translate(25, 25)')
  stopbutton.append('rect')
    .attr('x', 0).attr('y', 0)
    .attr('width', 50).attr('height', 50)
    .style('fill', 'rgba(255,255,255,0.01')
    .style('stroke', 'black')
    .on('click', function() { stop() });

  const gettime = function() {
    return -xinv(scroller.node().transform.baseVal.consolidate().matrix.e);
  };

  const b2ms = (beats => 1000 * 60 / bpm * beats);

  const play = function() {
    scroller.interrupt();
    playing = true;
    const time = gettime();
    scroller.transition()
      .duration(b2ms(duration - time))
      .ease(d3.easeLinear)
      .attr('transform', `translate(-${x(duration)}, 0)`);

    console.log(time);
    let note_idx  = 0;
    while(melody[note_idx].start < time) note_idx++;
    let chord_idx = 0;
    while(progression[chord_idx].start < time) chord_idx++;
    const playnextnote = function() {
      if(!playing) return;
      const note = melody[note_idx];
      MIDI.noteOn( 0, note.note, 90, 0);
      MIDI.noteOff(0, note.note, b2ms(note.duration) / 1000);
      note_idx++;
      setTimeout(playnextnote, b2ms(melody[note_idx].start - gettime()))
    };
    const playnextchord = function() {
      if(!playing) return;
      const chord = progression[chord_idx];
      const notes = CHORDS[chord.mode].map(x => x+chord.base+48);
      console.log('playing ' + notes);
      MIDI.noteOn(  1, notes[0]-12, 90, 0);
      MIDI.noteOff( 1, notes[0]-12, b2ms(chord.duration) / 1000);
      MIDI.chordOn( 0, notes.slice(2), 60, 0);
      MIDI.chordOff(0, notes.slice(1), b2ms(chord.duration) / 1000);
      chord_idx++;
      setTimeout(playnextchord, b2ms(progression[chord_idx].start - gettime()))
    };
    setTimeout(playnextnote,  b2ms(melody[note_idx].start - time))
    setTimeout(playnextchord, b2ms(progression[chord_idx].start - time))
  };

  const stop = function() {
    scroller.interrupt();
    playing = false;
    scroller.transition()
      .duration(500)
      .attr('transform', 'translate(0,0)');
  }

  const pause = function() {
    scroller.interrupt();
    playing = false;
  };
};

fetch('leadsheets/autumn_leaves.ls')
  .then(resp => resp.text())
  .then((data) => {
    let chrdr = /([ABCDEFG_][#b]?)((?:|7|maj7|m7?|o7?|ø)?)/;
    let lengthr = /:(e|s|\d*\.?\d+)([t.]?)/;
    let noter = /([abcdefg_][#b]?)(\d*):?((?:e|\d*\.?\d+)?)([t.]?)/;

    const chrd_to_idx = {
      c: 0, 'c#': 1, 'db': 1, d: 2, 'd#': 3, 'eb': 3, e: 4,
      'e#': 5, 'fb': 4, f: 5, 'f#': 6, 'gb': 6, 'g': 7, 'g#': 8, 'ab': 8,
      'a': 9, 'a#': 10, 'bb': 10, 'b': 11, 'cb': 11, 'b#': 0, '_': null
    };

    const scales = {'maj': [0, 2, 4, 5, 7, 9, 11], 'm': [0, 2, 3, 5, 7, 8, 10]};
    const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

    let lines = data
      .split('\n')
      .filter(line => (line !== '') & (line[0] !== '#'));
    let header = lines[0];
    let chords = "";
    let notes = "";
    for (let [i, line] of lines.entries()) {
      if (i === 0) continue;
      if (i % 2 === 0) notes += " " + line;
      else chords += " " + line;
    }
    chords = chords.replace(/\|/g, '').split(/\s+/).filter(x => x !== '');
    notes = notes.replace(/\|/g, '').split(/\s+/).filter(x => x !== '');

    let default_note = 1, default_chord = 4;
    for (let h of header.split(' ')) {
      if (h.startsWith('default_note'))
        default_note = parseFloat(h.split(':')[1]);
      if (h.startsWith('default_chord'))
        default_chord = parseFloat(h.split(':')[1]);
    }

    let parse_chord = function(chord) {
      let [, base, mode] = chord.match(chrdr);
      let chordname = base + mode;
      if(mode === '') mode = 'maj';
      base = chrd_to_idx[base.toLowerCase()];

      let length = chord.match(lengthr),
          duration = 0;
      if(length) {
        let [, beats, triplet] = length;
        if(beats === 'e')         duration = 0.5;
        else if(beats === 's')    duration = 0.25;
        else                      duration = +beats;
        if(triplet === 't')       duration = 2 * duration / 3;
        else if(triplet === '.')  duration = 3 * duration / 2;
      } else {
        duration = default_chord;
      }
      return {base:base, mode:mode, duration:duration, name:chordname};
    };

    const key = parse_chord(header.split(' ')[1]);
    const scale = scales[key.mode].map(s => (12 + s + key.base) % 12);
    console.log(scale);

    // Process chords
    let start = 0;
    progression = chords.map(function(c) {
      let chord = parse_chord(c);
      let relative = (roman[scale.indexOf(chord.base)] || roman[scale.indexOf((1+chord.base) % 12)] + "b") + chord.mode;
      const val = {base:chord.base, mode:chord.mode, start:start, duration:chord.duration,
        name:chord.name, roman:relative};
      start += chord.duration;
      return val;
    }).filter(x => x.base !== null && x.base !== undefined);

    start = 0;
    console.log(notes);
    melody = notes.map(function(n) {
      let [, note, octave, duration, triplet] = n.match(noter);
      if(duration === '')       duration = default_note;
      else if(duration === 'e') duration = 0.5;
      else if(duration === 's') duration = 0.25;
      else                      duration = +duration;
      if(triplet === 't')       duration = 2 * duration / 3;
      else if(triplet === '.')  duration = 3 * duration / 2;
      if(octave === '')         octave = 1;
      note = chrd_to_idx[note];
      let this_start = start;
      start += duration;
      if(note == null)
        return {note:null};
      else
        note = +note;
      return {note:note + 36 + 12 * octave, start:this_start, duration:duration};
    }).filter(x => x.note !== null);

    init();
  });
