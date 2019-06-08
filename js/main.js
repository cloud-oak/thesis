'use strict';

import * as util from "./util.js";
import * as harmony from "./harmony.js";

var original_melody, melody, original_progression, progression, scroller, svg, button_pane;
var bpm = 100;
var playing = false;
var enabled = {melody:true, harmony:true, bass:true, drums:true};
var midi_ready;
var key;
var scroller;
var x, xinv, y;

const D = {bass: 35, ride: 51, hat_pedal: 44}
const beat = [
  {notes: [D.ride], duration:1},
  {notes: [D.ride, D.bass, D.hat_pedal], duration:2/3},
  {notes: [D.ride], duration:1/3},
  {notes: [D.ride], duration:1},
  {notes: [D.ride, D.bass, D.hat_pedal], duration:2/3},
  {notes: [D.ride], duration:1/3},
].map(harmony.counttime())


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

const mvae = new mm.MusicVAE("https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/mel_chords");

const draw_notes = function() {
  d3.select('#notes').remove();
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
    .style('stroke-width', 3)
    .style('fill', d => d.changed ? 'teal': 'black');
}

const draw_chords = function() {
  d3.select('#chords').remove();
  const chords = scroller.append('g').attr('id', 'chords');
  const maxnote = d3.max(melody.map(n => n.note));

  chords
    .append('g').attr('id', 'chordnames').selectAll()
    .data(progression)
    .enter()
    .append('text')
      .text(d => harmony.chordname(d))
      .attr('x', d => x(d.start) + 5)
      .attr('y', y(maxnote+8))
      .style('font-family', 'Patrick Hand, cursive')
      .style('font-size', '18pt')
      .style('fill', d => d.reharmonized ? 'teal' : 'black');
  chords
    .append('g').attr('id', 'romannames').selectAll()
    .data(progression)
    .enter()
    .append('text')
      .text(d => harmony.roman(d, key))
      .attr('x', d => x(d.start) + 5)
      .attr('y', y(maxnote+2))
      .style('font-family', 'serif')
      .style('font-size', '12pt');
  chords
    .append('g').attr('id', 'originals').selectAll()
    .data(progression.filter(x => x.reharmonized))
    .enter()
    .append('text')
      .text(d => harmony.chordname(d.original))
      .attr('x', d => x(d.start) + 5)
      .attr('y', y(maxnote+5))
      .style('font-family', 'Patrick Hand, cursive')
      .style('font-size', '18pt')
      .style('fill', 'gray')
      .style('text-decoration', 'line-through')
  const offset = 20;
  const patterns = chords
    .append('g').attr('id', 'patterns').selectAll()
    .data(harmony.find_patterns(progression))
    .enter();
  patterns.append('path')
    .attr('d', p =>
              `M ${x(p.start) + offset} ${y(maxnote + 11)} ` +
              `v -10 h${x(p.duration)} v 10`)
    .style('fill', 'none')
    .style('stroke', 'black')
    .style('stroke-width', 1);
  patterns.append('text')
    .text(p => p.type)
    .attr('x', p => x(p.start + p.duration/2) + offset)
    .attr('y', p => y(maxnote + 13))
    .attr('text-anchor', 'middle')
    .style('font-size', p => p.type.length > 1 ? '12pt' : '18pt');
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

const prepare_button = function(base, name, px, py, w, h, symbol) {
  const select = d3.select(`#${name}`);
  const button = !select.empty() ? select : base.append('g').attr('id', name)
  button.attr('transform', `translate(${px}, ${py})`);
  button.append('rect')
    .attr('x', 0).attr('y', 0)
    .attr('width', w).attr('height', h)
    .style('fill', 'white')
  symbol(button);
  const surface = button.append('rect')
    .attr('x', 0).attr('y', 0)
    .attr('width', w).attr('height', h)
    .style('fill', 'rgba(255,255,255,0.01')
    .style('stroke', 'black');
  return surface;
}

const draw_buttons = function(play, pause, stop) {
  const select = d3.select('#buttons');
  button_pane = !select.empty() ? select : svg.append('g').attr('id', 'buttons');
  const scl = 15

  button_pane.attr('transform', 'translate(10, 70)');

  const options = button_pane.append('g')
    .attr('transform', 'translate(0,60) scale(1,0)')

  let more_label;
  let is_extended = false;
  prepare_button(button_pane, 'more', 0, 0, 50, 50, x => {
    const transformer = x.append('g').attr('transform', `translate(25, 25)`);
    more_label = transformer.append('g')
      .attr('transform', 'rotate(270)');
    more_label.append('text')
      .text('⚙')
      .attr('y', 8)
      .attr('text-anchor', 'middle')
      .style('font-size', '25px');
  }).on('click', function() {
    is_extended = !is_extended;
    const dur = 500;
    options.transition()
      .duration(dur)
      .attr('transform', is_extended ? 'translate(0, 60) scale(1,1)' : 'translate(0, 60) scale(1,0)')
      .ease(d3.easeCubic);
    more_label.transition()
      .duration(dur)
      .attr('transform', is_extended ? 'rotate(90)' : 'rotate(270)')
  });
  prepare_button(button_pane, 'play', 60, 0, 50, 50, x => {
    x.append('path')
      .attr('d', `M -${0.5*scl} -${Math.sqrt(3)/2*scl}` +
                 `L -${0.5*scl} ${ Math.sqrt(3)/2*scl}` +
                 `L ${scl} 0` +
                 `L -${0.5*scl} -${Math.sqrt(3)/2*scl}`)
      .attr('transform', 'translate(25, 25)')
      .style('fill', 'black');
  }).on('click', function() { play() });
  prepare_button(button_pane, 'pause', 120, 0, 50, 50, x => {
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
  prepare_button(button_pane, 'stop', 180, 0, 50, 50, x => {
    x.append('rect')
      .attr('x', -scl).attr('y', -scl)
      .attr('width', 2*scl).attr('height', 2*scl)
      .attr('transform', 'translate(25, 25)');
  }).on('click', function() { stop() });
  let dy = 0;
  prepare_button(options, 'original', 0, dy, 170, 50, x => {
    x.append('text')
      .text('original')
      .attr('x', 170/2)
      .attr('y', 33)
      .attr('text-anchor', 'middle')
      .style('font-family', 'Patrick Hand')
      .style('font-size', '18pt');
  }).on('click', function() {
    progression = original_progression;
    melody = original_melody;
    draw_notes();
    draw_chords();
  });
  dy += 60;
  prepare_button(options, 'reharmonize', 0, dy, 170, 50, x => {
    x.append('text')
      .text('reharmonize')
      .attr('x', 170/2)
      .attr('y', 33)
      .attr('text-anchor', 'middle')
      .style('font-family', 'Patrick Hand')
      .style('font-size', '18pt');
  }).on('click', function() {
    progression = harmony.reharmonize(original_progression, key);
    draw_chords();
  });
  dy += 60;
  prepare_button(options, 'improvise', 0, dy, 170, 50, x => {
    x.append('text')
      .text('improvise')
      .attr('x', 170/2)
      .attr('y', 33)
      .attr('text-anchor', 'middle')
      .style('font-family', 'Patrick Hand')
      .style('font-size', '18pt')
      .style('fill', 'gray');
  })
  for(const el of ['melody', 'harmony', 'bass', 'drums']) {
    dy += 60;
    const btn = prepare_button(options, el, 0, dy, 170, 50, x => {
      x.append('text')
        .text(el)
        .attr('x', 170/2)
        .attr('y', 33)
        .attr('text-anchor', 'middle')
        .style('font-family', 'Patrick Hand')
        .style('font-size', '18pt');
    })
    btn.on('click', function() {
      enabled[el] = !enabled[el];
      if(enabled[el])
        btn.style('fill', 'rgba(255,255,255,0.01)');
      else
        btn.style('fill', 'rgba(255,255,255,0.5)');
    });
  }
}

const init = function() {
  playing = false;
  x    = (t => t * 60);
  xinv = (t => t / 60);
  y    = (p => (96 - p) * 10);

  progression = original_progression;
  melody = original_melody;

  const events = melody.concat(progression)
  let duration = d3.max(events.map(x => x.start+x.duration));

  d3.select('#drawing').select('svg').remove();
  svg = d3.select('#drawing')
    .append('svg')
    .style('height', '100vh')
    .style('width', '100vw');

  const container = svg.append('g').attr('id', 'container')
    .attr('transform', 'translate(100,0)');

  container.append('line')
    .attr('x1', 0)
    .attr('x2', 0)
    .attr('y1', y(0))
    .attr('y2', y(96))
    .style('stroke', 'teal')
    .style('stroke-width', '3px');

  scroller  = container.append('g').attr('id', 'scroller')
    .attr('transform', 'translate(0,0)');

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
      .attr('transform', `translate(${-x(duration)}, 0)`)
      .on('end', function() { playing = false });

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
      if(enabled.melody) {
        MIDI.noteOn( 0, note.note+12, 90, 0);
        MIDI.noteOff(0, note.note+12, b2ms(note.duration) / 1000);
      }
      note_idx++;
      setTimeout(playnextnote, b2ms(melody[note_idx].start - gettime()))
    };
    const playnextchord = function() {
      if(!playing) return;
      const chord = progression[chord_idx];
      const notes = harmony.CHORDS[chord.mode].map(x => x+chord.base+48);
      if(enabled.bass) {
        MIDI.noteOn(  1, notes[0]-12, 90, 0);
        MIDI.noteOff( 1, notes[0]-12, b2ms(chord.duration) / 1000);
      }
      if(enabled.harmony) {
        MIDI.chordOn( 0, notes.slice(1), 60, 0);
        MIDI.chordOff(0, notes.slice(1), b2ms(chord.duration) / 1000);
      }
      chord_idx++;
      setTimeout(playnextchord, b2ms(progression[chord_idx].start - gettime()))
    };
    const playnextdrums = function() {
     if(!playing) return;
      const chord = beat[beat_idx];
      if(enabled.drums) {
        MIDI.chordOn( 2, chord.notes, 90, 0);
        MIDI.chordOff(2, chord.notes, b2ms(chord.duration) / 1000);
      }
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
  draw_notes();
  draw_chords();
  draw_barlines(duration);
  draw_buttons(play, pause, stop);
  d3.select('body')
    .on('keydown', function() {
      const keycode = d3.event.keyCode;
      if(keycode === 32) {
        if(playing) pause();
        else        play();
      }
      else if(keycode === 39) {
        pause()
        let time = gettime() + 4;
        time -= time % 4;
        scroller.attr('transform', `translate(${-x(time)})`);
      }
      else if(keycode === 37) {
        pause()
        let time = gettime() - 4;
        time -= time % 4;
        scroller.attr('transform', `translate(${-x(time)})`);
      }
    });

  window.mvae = mvae;
  mvae.initialize().then(function(x) {
    const latent_noise = mm.tf.randomNormal([1, 128], 0, 0.3);
    d3.select('#improvise')
      .on('click', function() {
        for(let start = 4; start < duration - 8; start += 8) {
          const chords    = progression.filter(t => t.start >= start && t.start <= start+8);
          const submelody = original_melody.filter(t => t.start >= start && t.start <= start+8);

          let chord_progression = new Array(8).fill(mm.constants.NO_CHORD);
          for(let beat = 0; beat < 8; ++beat) {
            for(let c of chords) {
              if(c.start <= beat+start && c.start+c.duration > beat+start) {
                chord_progression[beat] = harmony.chordname_tonal(c);
              }
            }
          }
          console.log(chord_progression);

          const notesequence = harmony.melody_to_notesequence(submelody, -start);
          mvae.encode([notesequence], chord_progression).then(function(latent) {
            // Perturb latent code
            latent = mm.tf.add(latent, latent_noise);
            mvae.decode(latent, null, chord_progression).then(function(res) {
              const pre  = melody.filter(t => t.start < start);
              const post = melody.filter(t => t.start >= start+8);
              console.log(res[0]);
              const newnotes = harmony.notesequence_to_melody(res[0], start);
              //aconsole.log(newnotes[0]);
              melody = pre.concat(newnotes).concat(post);
              window.melody = melody;
              draw_notes();
            });
          });
        }
      });
    d3.select('#improvise > text')
      .style('fill', 'black');
  });
};

const load_song = function(song) {
  fetch(`leadsheets/${song}.ls`)
    .then(resp => resp.text())
    .then((data) => {
      let chrdr = /([ABCDEFG_][#b]?)((?:|7|maj7|m7?|o7?|ø|\+)?)/;
      let lengthr = /:(e|s|\d*\.?\d+)([t.]?)/;
      let noter = /([abcdefg_][#b]?)(\d*):?((?:e|\d*\.?\d+)?)([t.]?)/;

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
        base = harmony.note2pitch[base.toLowerCase()];

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
        return {base:base, mode:mode, duration:duration, reharmonized:false};
      };

      key = parse_chord(header.split(' ')[1]);
      const scale = harmony.scales[key.mode].map(s => (12 + s + key.base) % 12);

      // Process chords
      let start = 0;
      original_progression = chords
        .map(parse_chord)
        .map(harmony.counttime())
        .filter(x => x.base !== null && x.base !== undefined);

      start = 0;
      console.log(notes);
      original_melody = notes.map(function(n) {
        let [, note, octave, duration, triplet] = n.match(noter);
        if(duration === '')       duration = default_note;
        else if(duration === 'e') duration = 0.5;
        else if(duration === 's') duration = 0.25;
        else                      duration = +duration;
        if(triplet === 't')       duration = 2 * duration / 3;
        else if(triplet === '.')  duration = 3 * duration / 2;
        if(octave === '')         octave = 1;
        note = harmony.note2pitch[note];
        if(note !== null) note = +note + 36 + 12 * octave;
        return {note:note, duration:duration, changed:false};
      }).map(harmony.counttime())
        .filter(x => x.note !== null);

      init();
    });
}

const selector = d3.select('#song_selector');
const onchange = function() {
  const node = selector.node();
  const song = node.options[node.selectedIndex].value;
  load_song(song);
}
selector.on("change", onchange);
onchange();
