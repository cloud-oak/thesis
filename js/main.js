'use strict';

import * as util from "./util.js";
import * as harmony from "./harmony.js";

var melody, original_progression, progression, scroller, svg;
var bpm = 100;
var playing = false;
var midi_ready;
var key;
var scroller;
var x, xinv, y;

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

const count_time = function() {
  let start = 0;
  return function(el) {
    el.start = start;
    start = start + el.duration;
    return el;
  }
}

const D = {bass: 35, ride: 51, hat_pedal: 44}
const beat = [
  {notes: [D.ride],                  duration:1},
  {notes: [D.ride, D.bass, D.hat_pedal], duration:2/3},
  {notes: [D.ride], duration:1/3},
  {notes: [D.ride],                  duration:1},
  {notes: [D.ride, D.bass, D.hat_pedal], duration:2/3},
  {notes: [D.ride], duration:1/3},
].map(count_time())

MIDI.loadPlugin({
  soundfontUrl: "./soundfont/selection/",
  instruments: [
    "acoustic_grand_piano",
    "acoustic_bass",
    "steel_drums"
  ],
  onsuccess: function() { 
    MIDI.programChange(1, MIDI.GM.byName['acoustic_bass'].number);  
    MIDI.programChange(2, MIDI.GM.byName['steel_drums'].number);  
    // midi_ready();
  }
});

const draw_notes = function() {
  const select = d3.select('#notes');
  const notes = !select.empty() ? select : scroller.append('g').attr('id', 'notes');
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
}

const draw_chords = function() {
  d3.select('#chords').remove();
  const chords = scroller.append('g').attr('id', 'chords');
  chords.selectAll()
    .data(progression)
    .enter()
    .append('text')
    .text(d => d.name)
    .attr('x', d => x(d.start) + 5)
    .attr('y', 100)
    .style('font-family', 'Patrick Hand, cursive')
    .style('font-size', '18pt');
  chords.selectAll()
    .data(progression)
    .enter()
    .append('text')
    .text(d => d.roman)
    .attr('x', d => x(d.start) + 5)
    .attr('y', 130)
    .style('font-family', 'serif')
    .style('font-size', '12pt');
}

const draw_barlines = function(duration) {
  const select = d3.select('#barlines');
  const barlines = !select.empty() ? select : scroller.append('g').attr('id', 'barlines');
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
}

const draw_button = function(name, px, py, symbol) {
  const select = d3.select(`#${name}`);
  const button = !select.empty() ? select : svg.append('g').attr('id', name)
  button.attr('transform', `translate(${px}, ${py})`);
  symbol(button);
  const surface = button.append('rect')
    .attr('x', 0).attr('y', 0)
    .attr('width', 50).attr('height', 50)
    .style('fill', 'rgba(255,255,255,0.01')
    .style('stroke', 'black');
  return surface;
}

const init = function() {
  x    = (t => t * 60);
  xinv = (t => t / 60);
  y    = (p => (84 - p) * 10);

  progression = original_progression;

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

  draw_notes();
  draw_chords();
  draw_barlines(duration);

  container.append('line')
    .attr('x1', 0)
    .attr('x2', 0)
    .attr('y1', y(0))
    .attr('y2', y(96))
    .style('stroke', 'red')
    .style('stroke-width', '3px');

  const scl = 15

  draw_button('play', 10, 500, x => {
    x.append('path')
      .attr('d', `M -${0.5*scl} -${Math.sqrt(3)/2*scl}` +
                 `L -${0.5*scl} ${ Math.sqrt(3)/2*scl}` +
                 `L ${scl} 0` +
                 `L -${0.5*scl} -${Math.sqrt(3)/2*scl}`)
      .attr('transform', 'translate(25, 25)')
      .style('fill', 'black');
  }).on('click', function() { play() });

  draw_button('pause', 70, 500, x => {
    x.append('rect')
      .attr('x', -scl)
      .attr('y', -scl)
      .attr('height', 2*scl)
      .attr('width', 4*scl/5)
      .attr('transform', 'translate(25, 25)');
    x.append('rect')
      .attr('x', scl/5)
      .attr('y', -scl)
      .attr('height', 2*scl)
      .attr('width', 4*scl/5)
      .attr('transform', 'translate(25, 25)');
  }).on('click', function() { pause() });

  draw_button('stop', 130, 500, x => {
    x.append('rect')
      .attr('x', -scl).attr('y', -scl)
      .attr('width', 2*scl).attr('height', 2*scl)
      .attr('transform', 'translate(25, 25)');
  }).on('clidk', function() { stop() });

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
    let beat_idx = 0;
    while(progression[beat_idx].start < (time % 4)) {
      beat_idx++;
    }
    const playnextnote = function() {
      if(!playing) return;
      const note = melody[note_idx];
      MIDI.noteOn( 0, note.note+12, 90, 0);
      MIDI.noteOff(0, note.note+12, b2ms(note.duration) / 1000);
      note_idx++;
      setTimeout(playnextnote, b2ms(melody[note_idx].start - gettime()))
    };
    const playnextchord = function() {
      if(!playing) return;
      const chord = progression[chord_idx];
      const notes = CHORDS[chord.mode].map(x => x+chord.base+48);
      MIDI.noteOn(  1, notes[0]-12, 90, 0);
      MIDI.noteOff( 1, notes[0]-12, b2ms(chord.duration) / 1000);
      MIDI.chordOn( 0, notes.slice(2), 60, 0);
      MIDI.chordOff(0, notes.slice(1), b2ms(chord.duration) / 1000);
      chord_idx++;
      setTimeout(playnextchord, b2ms(progression[chord_idx].start - gettime()))
    };
    const playnextdrums = function() {
      if(!playing) return;
      const chord = beat[beat_idx];
      MIDI.chordOn( 2, chord.notes, 90, 0);
      MIDI.chordOff(2, chord.notes, b2ms(chord.duration) / 1000);
      beat_idx = (beat_idx + 1) % beat.length;
      const delay = b2ms((((beat[beat_idx].start - gettime()) % 4) + 4) % 4);
      setTimeout(playnextdrums, delay);
    };
    setTimeout(playnextnote,  b2ms(melody[note_idx].start - time));
    setTimeout(playnextchord, b2ms(progression[chord_idx].start - time));
    setTimeout(playnextdrums, b2ms(beat[beat_idx].start - time));
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

  d3.select('body')
    .on('keydown', function() {
      const keycode = d3.event.keyCode;
      if(keycode === 32) {
        if(playing) pause();
        else        play();
      }
      else if(keycode === 39) {
        pause()
        const time = gettime() + 1;
        scroller.attr('transform', `translate(-${x(time)})`);
      }
      else if(keycode === 37) {
        pause()
        const time = gettime() - 1;
        scroller.attr('transform', `translate(-${x(time)})`);
      }
      else {
        progression = harmony.reharmonize(original_progression);
        console.log(progression);
        draw_chords();
      }
    })
};

fetch('leadsheets/autumn_leaves.ls')
  .then(resp => resp.text())
  .then((data) => {
    let chrdr = /([ABCDEFG_][#b]?)((?:|7|maj7|m7?|o7?|ø|\+)?)/;
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
      if (h.startsWith('bpm'))
        bpm = parseFloat(h.split(':')[1]);
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

    key = parse_chord(header.split(' ')[1]);
    const scale = scales[key.mode].map(s => (12 + s + key.base) % 12);
    console.log(scale);

    // Process chords
    let start = 0;
    original_progression = chords.map(function(c) {
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
