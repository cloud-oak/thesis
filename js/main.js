'use strict';

import * as util from "./util.js";
import * as harmony from "./harmony.js";
import * as wfc from "./wfc.js";

var original_melody, melody, original_progression, progression, scroller, svg, button_pane, voicing;
var bpm = 100;
var playing = false;
var key;
var scroller;
var x, xinv, y, duration;
var height, width;
var edit_pane_height;

var audio_loaded = false,
    mvae_loaded = false,
    gan_loaded = false,
    hidden_loaded = false;

const tf = mm.tf; // Recycle Magenta's bundled Tensorflow

const D = {bass: 35, ride: 59, hat_pedal: 44}
const beat = [
  {notes: [D.ride], duration:24},
  {notes: [D.ride, D.bass, D.hat_pedal], duration:16},
  {notes: [D.ride], duration:8},
  {notes: [D.ride], duration:24},
  {notes: [D.ride, D.bass, D.hat_pedal], duration:16},
  {notes: [D.ride], duration:8},
].map(harmony.counttime())

window.init_audio = function() {
  if(MIDI.noteOn !== undefined) {
    return;
  }
  MIDI.loadPlugin({
    soundfontUrl: "./soundfont/selection/",
    instruments: [
      "acoustic_grand_piano",
      "acoustic_bass",
      "steel_drums"
    ],
    api: 'webaudio',
    targetFormat: "ogg",
    onsuccess: function() {
      audio_loaded = true;
      d3.select('#loading_audio')
        .remove();
      audio_loaded = true;
      if(mvae_loaded && gan_loaded && hidden_loaded) {
        d3.select('#loading_overlay')
          .transition(300)
          .style("opacity", 0)
          .remove();
      }
      MIDI.programChange(1, MIDI.GM.byName['acoustic_bass'].number);
      MIDI.programChange(2, MIDI.GM.byName['steel_drums'].number);
    }
  });
}
init_audio();

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
    .data(util.range(Math.ceil(duration / 96)))
    .enter()
    .append('line')
    .attr('x1', d => x(96*d))
    .attr('x2', d => x(96*d))
    .attr('y1', y(0))
    .attr('y2', y(96))
    .style('stroke', 'lightgray')
    .style('stroke-width', '1px');
}

const draw_voicing = function() {
  d3.select('#voicing').remove();
  const select = d3.select('#voicing');
  const container = !select.empty() ? select : scroller.append('g').attr('id', 'voicing');
  container.selectAll()
    .data(voicing) .enter()
    .append('rect')
      .attr('x', d => x(d.start))
      .attr('y', d => y(d.note))
      .attr('width', d => x(d.duration))
      .attr('height', 10)
      .style('stroke', 'white')
      .style('stroke-width', 3)
      .style('opacity', d => (d.channel === 0 ? 0.2 : 0.4));
}

const prepare_button = function(base, name, px, py, w, h, symbol, id=null) {
  if(id === null) { id = name };
  const select = d3.select(`#${id}`);
  const button = !select.empty() ? select : base.append('g').attr('id', id)
  button.attr('transform', `translate(${px}, ${py})`);
  button.append('rect')
    .attr('x', 0).attr('y', 0)
    .attr('width', w).attr('height', h)
    .style('fill', 'white');
  symbol(button);
  const surface = button.append('rect')
    .attr('x', 0).attr('y', 0)
    .attr('width', w).attr('height', h)
    .style('fill', 'rgba(255,255,255,0.01')
    .style('stroke', 'black');
  return surface;
}

const fa_button = function(base, name, px, py, w, h, glyph) {
  return prepare_button(base, name, px, py, w, h, x => {
    x.append('text')
      .text(glyph)
      .attr('font-family', 'FontAwesome')
      .attr('y', h*35/50)
      .attr('x', w/2)
      .attr('text-anchor', 'middle')
      .style('font-size', `${3*h/5}px`);
  });
}

const text_button = function(base, name, px, py, w, h, id=null) {
  if(id === null) {
    id = name;
  }
  return prepare_button(base, name, px, py, w, h, x => {
    x.append('text')
      .text(name)
      .attr('x', w/2)
      .attr('y', h/2+8)
      .attr('text-anchor', 'middle')
      .style('font-family', 'Patrick Hand')
      .style('font-size', '18pt');
  }, id)
}

const twoline_text_button = function(base, line1, line2, px, py, w, h, id=null) {
  if(id === null) {
    id = name;
  }
  return prepare_button(base, name, px, py, w, h, x => {
    x.append('text')
      .text(line1)
      .attr('x', w/2)
      .attr('y', h/2+8-15)
      .attr('text-anchor', 'middle')
      .style('font-family', 'Patrick Hand')
      .style('font-size', '18pt');
    x.append('text')
      .text(line2)
      .attr('x', w/2)
      .attr('y', h/2+8+15)
      .attr('text-anchor', 'middle')
      .style('font-family', 'Patrick Hand')
      .style('font-size', '18pt');
  }, id)
}

window.grammar_reharmonization = function(use_chord2vec=false) {
  progression = harmony.reharmonize(original_progression, use_chord2vec);
  draw_chords();
}

window.markov_reharmonization = function(use_grammar=false) {
  progression = harmony.markov_reharmonize(original_progression, null, false, use_grammar);
  draw_chords();
}

window.hidden_markov_reharmonization = function(use_grammar=false) {
  progression = harmony.markov_reharmonize(original_progression, melody, true, use_grammar);
  draw_chords();
}

window.naive_voicing = function() {
  voicing = progression.flatMap(chord =>
    harmony.CHORDS[chord.mode].map(x =>
      ({start: chord.start, duration: chord.duration, note: (x+chord.base) % 12 + 48, channel: 0})
    ).concat([
      ({start: chord.start, duration: chord.duration, note: chord.base + 36, channel: 1})
    ])
  );
  console.log(voicing);
}

window.shortest_path_voicing = function() {
  const h1 = 1, h2 = 2, h3 = 2;
  // For some reason a look-up into object[[]] coerces to object['']... Oh Javascript
  let best_paths = [
    [[], [], 0] // chord - path - cost
  ];
  for(let chord of progression) {
    const corresponding_melody = melody.filter(m =>
      (m.start+m.duration >= chord.start &&
       m.start <= chord.start+chord.duration)
    ); // I'm O(n) and I don't care :)
    const lowest_melody_note = d3.min(corresponding_melody.map(x => x.note));
    const lower_bound = Math.max(lowest_melody_note-20, 30);
    const upper_bound = lowest_melody_note - 1;

    const pcs = harmony.CHORDS[chord.mode].map(x => (x + chord.base) % 12);
    
    let new_best_paths = [];
    let count = 0;
    for(let S of harmony.chord_realizations(chord, lower_bound, upper_bound)) {
      count++;
      const [[, path, cost], distance] = util.argmin(best_paths, path => 
        path[2] + harmony.realization_distance(path[0], S));
      const S_pcs = S.map(s => (s % 12));
      let penalty = -S[0]/10;
      if(!S_pcs.includes(pcs[0])) penalty += h1;
      if(!S_pcs.includes(pcs[1])) penalty += h2;
      if(!S_pcs.includes(pcs[2])) penalty += h1;
      if((pcs.length > 3) && (!S_pcs.includes(pcs[2]))) penalty += h2;
      for(let k = 1; k < S.length; k++) {
        if(S[k] - S[k-1] <= 2) penalty += h3;
      }

      new_best_paths.push([S, path.concat([S]), cost + distance + penalty]);
    }
    best_paths = new_best_paths;
  }
  const [[,best_voicing,], ] = util.argmin(best_paths, path => path[2]);

  voicing = [];
  for(let i = 0; i < progression.length; i++) {
    const chord = progression[i];
    const realization = best_voicing[i];
    
    voicing.push({start: chord.start, duration: chord.duration, note: chord.base + 36, channel: 1})
    for(let note of realization) {
      voicing.push({start: chord.start, duration: chord.duration, note: note, channel: 0})
    }
  }
}

window.locked_hands_voicing = function() {
  let m_i = 0;
  let c_i = 0;
  voicing = [];
  {
    const new_p = progression[c_i];
    if(new_p !== undefined) {
      voicing.push({
        start: new_p.start,
        duration: new_p.duration,
        note: new_p.base + 36,
        channel: 1
      });
    }
  };
  while(m_i < melody.length && c_i < progression.length) {
    const m = melody[m_i];
    const c = progression[c_i];

    const m_end = m.start + m.duration;
    const c_end = c.start + c.duration;

    if(c_end <= m.start) {
      c_i++;
      const new_p = progression[c_i];
      if(new_p !== undefined) {
        voicing.push({
          start: new_p.start,
          duration: new_p.duration,
          note: new_p.base + 36,
          channel: 1
        });
      }
      continue;
    }
    if(m_end <= c.start) { m_i++; continue; }

    const start = Math.max(m.start, c.start);
    const end   = Math.min(m_end, c_end);

    for(let note of harmony.CHORDS[c.mode]) {
      note += c.base;
      while(note < m.note - 12) { note += 12; }
      voicing.push({
        start: start,
        duration: end - start,
        note: note,
        channel: 0
      });
    }

    if(c_end <= m_end) {
      c_i++;
      const new_p = progression[c_i];
      if(new_p !== undefined) {
        voicing.push({
          start: new_p.start,
          duration: new_p.duration,
          note: new_p.base + 36,
          channel: 1
        });
      }
    }
    if(m_end <= c_end) { m_i++; }
  }
  console.log(voicing);
}

window.wfc_voicing = function() {
  const constraints = voicing;
  voicing = [];
  let v_idx = 0;
  let cache = {};
  while(v_idx < constraints.length) {
    const root = constraints[v_idx];
    let tones = [root];
    while(++v_idx < constraints.length && constraints[v_idx].start === root.start) {
      tones.push(constraints[v_idx]);
    }
    tones.forEach(x => { if(x.channel === 1) voicing.push(x) });
    tones = tones.filter(x => x.channel !== 1);
  
    const T = root.duration;
    const Tq = root.duration / 24;
    const P = tones.length;

    let pianoroll = cache[[T, P]];
    if(pianoroll === undefined) {
      console.log('Calling WFC');
      pianoroll = wfc.wfc(Tq, P);
      cache[[T, P]] = pianoroll;
    }
    console.log(pianoroll);

    let start = 0;
    let current_voicings = [];
    for(let p = 0; p < P; p++) {
      let ison = false;
      for(let t = 0; t < T; t++) {
        let noteon = pianoroll[p][t] > 0;
        if(noteon && (t == 0 || !ison)) {
          ison = true;
          start = t;
        } else if(ison && (!noteon || t == 31)) {
          ison = false;
          if(t == T-1) { t++ };
          current_voicings.push({
            note: tones[p].note,
            start: root.start + start,
            duration: Math.max(6, t - start),
            channel: 0
          });
        }
      }
    }
    voicing = voicing.concat(current_voicings.sort((a, b) => (a.start - b.start)));
  }
  console.log(voicing);
}

const draw_buttons = function(play, pause, stop) {
  const select = d3.select('#buttons');
  button_pane = !select.empty() ? select : svg.append('g').attr('id', 'buttons');
  const scl = 15

  button_pane.attr('transform', 'translate(10, 70)');

  button_pane.append('rect')
    .attr('x', -10)
    .attr('y', -10)
    .attr('width', 385)
    .attr('height', 1000)
    .style('fill', 'white')
    .style('opacity', 0.7);

  const edit_pane = button_pane.append('g')
    .attr('transform', 'translate(0,75)');

  let pane_shown = 'none';

  const slide_panes = function() {
    const dur = 500;
    switch(pane_shown) {
    case 'none':
      button_pane.transition()
        .duration(dur)
        .attr('transform', `translate(${(width-365)/2}, ${height-75})`);
      edit_pane.transition()
        .duration(dur)
        .attr('transform', `translate(0, 75)`);
      break;
    case 'edit':
      const edit_slide_amt = 75+edit_pane_height;
      button_pane.transition()
        .duration(dur)
        .attr('transform', `translate(${(width-365)/2}, ${height-edit_slide_amt})`)
      edit_pane.transition()
        .duration(dur)
        .attr('transform', `translate(0, 75)`)
      break;
    }
  }

  fa_button(button_pane, 'reset', 0, 0, 65, 65, '')
    .on('click', function() {
      progression = original_progression;
      melody = original_melody;
      voicing = [];
      draw_notes();
      draw_chords();
      draw_voicing();
  });
  fa_button(button_pane, 'edit', 75, 0, 65, 65, '')
    .on('click', function() {
      if(pane_shown == 'edit')
        pane_shown = 'none';
      else
        pane_shown = 'edit';
      slide_panes();
  });
  fa_button(button_pane, 'magic', 150, 0, 65, 65, '')
    .on('click', function() {
      // Magic mode: Markov+Grammar -> VAE -> Locked Hands
      window.markov_reharmonization(true);
      draw_chords();
      window.improvise_mvae().then(() => {
        window.naive_voicing();
        draw_voicing();
      });
    });
  fa_button(button_pane, 'play', 225, 0, 65, 65, '')
    .on('click', play);
  fa_button(button_pane, 'pause', 225, 0, 65, 65, '')
    .on('click', pause);
  fa_button(button_pane, 'stop', 300, 0, 65, 65, '')
    .on('click', function() { stop() });
  d3.select('#pause').style('visibility', 'hidden');

  let dy = 0;
  edit_pane.append('text')
    .text('— Reharmonization —')
    .attr('x', 365/2)
    .attr('y', dy+20)
    .attr('text-anchor', 'middle')
    .style('font-family', 'Patrick Hand')
    .style('font-size', '18pt');
  dy += 35
  text_button(edit_pane, 'Grammar', 0, dy, 105, 65)
    .on('click', function() { window.grammar_reharmonization() });
  text_button(edit_pane, 'Markov', 115, dy, 105, 65)
    .on('click', function() { window.markov_reharmonization() });
  text_button(edit_pane, 'Hidden Markov', 230, dy, 135, 65)
    .on('click', function() { window.hidden_markov_reharmonization() });
  dy += 75
  twoline_text_button(edit_pane, 'Grammar +', 'Chord2Vec', 0, dy, 105, 65, 'grchord2vec')
    .on('click', function() { window.grammar_reharmonization(true) });
  twoline_text_button(edit_pane, 'Grammar +', 'Markov', 115, dy, 105, 65, 'grmarkov')
    .on('click', function() { window.markov_reharmonization(true) });
  twoline_text_button(edit_pane, 'Grammar +', 'Hidden Markov', 230, dy, 135, 65, 'grhmarkov')
    .on('click', function() { window.hidden_markov_reharmonization(true) });
  dy += 75;
  edit_pane.append('text')
    .text('— Improvisation —')
    .attr('x', 365/2)
    .attr('y', dy+20)
    .attr('text-anchor', 'middle')
    .style('font-family', 'Patrick Hand')
    .style('font-size', '18pt');
  dy += 35
  text_button(edit_pane, 'MusicVAE', 0, dy, 178, 65, 'improvise_mvae')
    .on('click', function() { window.improvise_mvae(); });
  text_button(edit_pane, 'GAN', 188, dy, 177, 65, 'improvise_gan')
    .on('click', function() { window.improvise_gan(); });
  dy += 75;
  edit_pane.append('text')
    .text('— Voicing —')
    .attr('x', 365/2)
    .attr('y', dy+20)
    .attr('text-anchor', 'middle')
    .style('font-family', 'Patrick Hand')
    .style('font-size', '18pt');
  dy += 35
  text_button(edit_pane, 'Naive', 0, dy, 80, 65, 'naive_voicing')
    .on('click', function() { window.naive_voicing(); draw_voicing(); });
  text_button(edit_pane, 'Locked Hands', 90, dy, 130, 65, 'locked_hands')
    .on('click', function() { window.locked_hands_voicing(); draw_voicing(); });
  text_button(edit_pane, 'Shortest Path', 230, dy, 135, 65, 'shortest_path')
    .on('click', function() { window.shortest_path_voicing(); draw_voicing(); });
  dy += 75;
  twoline_text_button(edit_pane, 'Naive +', 'WFC', 0, dy, 178, 65, 'naive_wfc')
    .on('click', function() { window.naive_voicing(); window.wfc_voicing(); draw_voicing(); });
  twoline_text_button(edit_pane, 'Shortest Path +', 'WFC', 188, dy, 178, 65, 'shortest_path_wfc')
    .on('click', function() { window.shortest_path_voicing(); window.wfc_voicing(); draw_voicing(); });
  dy += 75;
  edit_pane_height = dy;
}

// Initialize...
const init = function() {
  playing = false;

  progression = original_progression;
  melody = original_melody;

  const events = melody.concat(progression)
  duration = d3.max(events.map(x => x.start+x.duration));

  d3.select('#drawing').select('svg').remove();
  svg = d3.select('#drawing')
    .append('svg')
    .attr('id', 'svg_canvas')
    .style('height', '100vh')
    .style('width', '100vw')
    // .style('position', 'absolute')
    // .style('top', '0')
    // .style('left', '0')

  x    = (t => t * 2);
  xinv = (t => t / 2);

  const highest = d3.max(original_melody.map(n => n.note));
  y    = (p => (24+highest - p) * 10);

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
  const b2ms     = (ticks => 1000 * 60 / 24 / bpm * ticks);
  const humanize = (ms => ms); //Math.max(0, 30 * (Math.random() - 0.5) + ms));
  const play = function() {
    scroller.interrupt();
    playing = true;
    d3.select("#pause").style("visibility", "visible");
    d3.select("#play").style("visibility", "hidden");
    const time = gettime();
    scroller.transition()
      .duration(b2ms(duration - time))
      .ease(d3.easeLinear)
      .attr('transform', `translate(${-x(duration)}, 0)`)
      .on('end', function() { playing = false });

    let note_idx  = 0;
    let chord_idx = 0;
    let beat_idx = 0;
    const playnextnote = function() {
      if(!playing) return;
      const note = melody[note_idx];
      MIDI.noteOn( 0, note.note, 90, 0);
      MIDI.noteOff(0, note.note, b2ms(note.duration) / 1000);
      note_idx++;
      if(note_idx < melody.length) {
        setTimeout(playnextnote, humanize(b2ms(melody[note_idx].start - gettime())));
      }
    };
    const playnextchord = function() {
      if(!playing) return;
      const now = voicing[chord_idx].start;
      while(voicing[chord_idx].start == now) {
        const note = voicing[chord_idx];
        // Even though MIDI.js seems to ignore the gain...
        MIDI.noteOn(note.channel,  note.note, note.channel === 1 ? 80 : 30, 0);
        MIDI.noteOff(note.channel, note.note, b2ms(note.duration) / 1000);
        chord_idx++;
      }
      if(chord_idx < voicing.length) {
        setTimeout(playnextchord, humanize(b2ms(voicing[chord_idx].start - gettime())));
      }
    };
    const playnextdrums = function() {
     if(!playing) return;
      const chord  = beat[beat_idx];
      const noride = chord.notes.filter(n => n != D.ride);
      MIDI.noteOn(  2, D.ride, 30, 0);
      if(noride.length) {
        MIDI.chordOn( 2, noride, 70, 0);
      }
      MIDI.chordOff(2, chord.notes, b2ms(chord.duration) / 1000);
      beat_idx = (beat_idx + 1) % beat.length;
      const delay = b2ms((((beat[beat_idx].start - gettime()) % 96) + 96) % 96);
      setTimeout(playnextdrums, humanize(delay));
    };

    while(note_idx < melody.length   && melody[note_idx].start < time) note_idx++;
    while(chord_idx < voicing.length && voicing[chord_idx].start < time) chord_idx++;
    while(beat[beat_idx].start < (time % 96)) beat_idx++;

    if(note_idx < melody.length)
      setTimeout(playnextnote,  b2ms(melody[note_idx].start - time));
    if(chord_idx < voicing.length)
      setTimeout(playnextchord, b2ms(voicing[chord_idx].start - time));
    setTimeout(playnextdrums, b2ms(beat[beat_idx].start - time));
  };
  const stop = function() {
    pause();
    scroller.transition()
      .duration(500)
      .attr('transform', 'translate(0,0)');
  }
  const pause = function() {
    scroller.interrupt();
    playing = false;
    d3.select("#pause").style("visibility", "hidden");
    d3.select("#play").style("visibility", "visible");
  };
  draw_notes();
  draw_chords();
  draw_barlines(duration);
  draw_buttons(play, pause, stop);
  handle_resize();
  d3.select('body')
    .on('keydown', function() {
      const keycode = d3.event.keyCode;
      if(keycode === 32) {
        if(playing) pause();
        else        play();
      }
      else if(keycode === 39) {
        pause()
        let time = gettime() + 96;
        time -= time % 96;
        scroller.attr('transform', `translate(${-x(time)})`);
      }
      else if(keycode === 37) {
        pause()
        let time = gettime() - 96;
        time -= time % 96;
        scroller.attr('transform', `translate(${-x(time)})`);
      }
    });
};

const handle_resize = function() {
  width = document.getElementById("drawing").clientWidth;
  height = document.getElementById("drawing").clientHeight;

  d3.select("g#buttons")
    .attr("transform", `translate(${(width-365)/2}, ${height-75})`)
  // y = (p => (24 + highest - p) * 10);
}

document.addEventListener("DOMContentLoaded", function() {
  handle_resize();
});

const load_song = async function(song) {
  const resp = await fetch(`leadsheets/${song}.ls`);
  const data = await resp.text();
  voicing = [];

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

  let default_note = 24, default_chord = 96;
  for (let h of header.split(' ')) {
    if (h.startsWith('default_note'))
      default_note = Math.round(24 * parseFloat(h.split(':')[1]));
    if (h.startsWith('default_chord'))
      default_chord = Math.round(24 * parseFloat(h.split(':')[1]));
    if (h.startsWith('bpm'))
      bpm = parseFloat(h.split(':')[1]);
  }

  let parse_chord = function(chord) {
    let [, base, mode] = chord.match(chrdr);
    base = harmony.note2pitch[base.toLowerCase()];

    let length = chord.match(lengthr),
      dur = 0;
    if(length) {
      let [, beats, triplet] = length;
      if(beats === 'e')         dur = 12;
      else if(beats === 's')    dur = 6;
      else                      dur = 24 * +beats;
      if(triplet === 't')       dur = 2 * dur / 3;
      else if(triplet === '.')  dur = 3 * dur / 2;
    } else {
      dur = default_chord;
    }
    return {base:base, mode:mode, duration:dur, reharmonized:false};
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
  original_melody = notes.map(function(n) {
    let [, note, octave, dur, triplet] = n.match(noter);
    if(dur === '')            dur = default_note;
    else if(dur === 'e')      dur = 12;
    else if(dur === 's')      dur = 6;
    else                      dur = 24 * +dur;
    if(triplet === 't')       dur = 2 * dur / 3;
    else if(triplet === '.')  dur = 3 * dur / 2;
    if(octave === '')         octave = 1;
    note = harmony.note2pitch[note];
    if(note !== null) note = +note + 48 + 12 * octave;
    return {note:note, duration:dur, changed:false};
  }).map(harmony.counttime())
    .filter(x => x.note !== null);

  init();
}

const selector = document.getElementById('song_selector');
const selector_contents = document.getElementById('song_contents');
const song_search = document.getElementById('song_search');

fetch('songs.lst').then(resp => resp.text()).then(function(data) {
  data.split('\n').map(line => {
    if(line.startsWith('automatic/')) {
      let a = document.createElement('a');
      let nols = line.substr(0, line.length-3);
      a.href = '#' + nols.replace('/', '!')
      a.innerText = util.toTitleCase(nols.substr(10).replace(/_/g, ' '));
      selector_contents.appendChild(a);
    }
  }
)});

window.toggledropdown = function() {
  document.getElementById("song_selector").classList.toggle("show");
}

window.filtersongs = function() {
  let filter = song_search.value.toLowerCase();
  let elements = selector.getElementsByTagName('a');
  for(let i = 0; i < elements.length; i++) {
    let text = elements[i].innerText;
    if(text.toLowerCase().indexOf(filter) > -1) 
      elements[i].style.display = '';
    else
      elements[i].style.display = 'none';
  }
}

const hashchanged = function(hash) {
  document.getElementById("song_selector").classList.remove("show");
  let song = hash.substr(1).replace(/!/g, '/');
  load_song(song);
  if(song.startsWith('automatic/'))
    song = song.substr(10);
  document.getElementById('songname').innerText = util.toTitleCase(song.replace(/_/g, ' '));
}

if ("onhashchange" in window) { // event supported?
    window.onhashchange = function () {
      hashchanged(window.location.hash);
    }
}
else { // event not supported:
    var storedHash = window.location.hash;
    window.setInterval(function () {
        if (window.location.hash != storedHash) {
            storedHash = window.location.hash;
            hashchanged(storedHash);
        }
    }, 100);
}

window.addEventListener("resize", handle_resize);

if(window.location.hash == '')
{
  window.location.hash = 'autumn_leaves'
}
hashchanged(window.location.hash);

tf.loadLayersModel('nets/hidden_markov/model.json').then(net => {
  hidden_loaded = true;
  if(mvae_loaded && gan_loaded) {
    d3.select('#loading_networks')
      .remove()
    if(audio_loaded) {
      d3.select('#loading_overlay')
        .transition(300)
        .style("opacity", 0)
        .remove();
    }
  }
  window.hidden_markov_net = net;
});

tf.loadLayersModel('nets/gan_quantized/model.json').then(net => {
  gan_loaded = true;
  if(mvae_loaded && hidden_loaded) {
    d3.select('#loading_networks')
      .remove()
    if(audio_loaded) {
      d3.select('#loading_overlay')
        .transition(300)
        .style("opacity", 0)
        .remove();
    }
  }
  d3.select('#improvise_gan > text')
    .style('fill', 'black');
  console.log('finished loading gan');
  window.improvise_gan = async function() {
    console.log('Improvising using gan');
    const LATENT = 128;
    let noise = tf.randomNormal([1, LATENT]);

    const recurse = function(start) {
      let pianoroll = tf.buffer([1, 32, 36]);
      for(let note of original_melody) {
        if(note.note === undefined) {
          continue;
        }
        let s = Math.floor((note.start - start) / 6);
        let e = Math.floor((note.start + note.duration - start) / 6);
        if(e >= 0 || s < 32) {
          for(let i = Math.max(0, s); i < Math.min(32, e); i++) {
            pianoroll.set(1, 0, i, note.note - 48);
          }
        }
      }

      const input_pianoroll = pianoroll.toTensor().mul(2).sub(1);
      const output_pianoroll = net.predict([noise, input_pianoroll]).arraySync()[0]

      const pre  = melody.filter(t => t.start < start);
      const post = melody.filter(t => t.start >= start+192);
      const newnotes = harmony.pianoroll_to_melody(output_pianoroll, start);
      melody = pre.concat(newnotes).concat(post);
      window.melody = melody;
      draw_notes();
      if(start + 192 < duration) {
        recurse(start + 192);
      }
    }
    // Start improvising when the first chord is played
    const recursion_start = progression[0].start;
    recurse(recursion_start);
  }
});

console.log('declaring mvae')
const mvae = new mm.MusicVAE("https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/mel_chords");
console.log('done. initializing...')
mvae.initialize().then(function() {
  mvae_loaded = true;
  if(gan_loaded && hidden_loaded) {
    d3.select('#loading_networks')
      .remove()
    if(audio_loaded) {
      d3.select('#loading_overlay')
        .transition(300)
        .style("opacity", 0)
        .remove();
    }
  }
  window.improvise_mvae = async function() {
    console.log('improvising with MVAE');
    const latent_noise = mm.tf.randomNormal([1, 128], 0, 0.3);
    const recurse = async function(start) {
      const filter_and_crop = seq => seq
        .filter(t => t.start+t.duration >= start && t.start < start+192)
        .map(t => {
          let t2 = Object.create(t);
          if(t2.start < start) t2.start = start;
          if(t2.start + t2.duration < start+192) t2.duration = start+192 - t2.duration;
          return t2;
        });

      const chords      = filter_and_crop(progression);
      const chords_orig = filter_and_crop(original_progression);
      const submelody   = filter_and_crop(original_melody);

      let chord_progression = new Array(8).fill(mm.constants.NO_CHORD);
      let chord_progression_orig = new Array(8).fill(mm.constants.NO_CHORD);
      for(let beat = 0; beat < 8; ++beat) {
        const ticks = 24 * beat;
        for(let c of chords_orig) {
          if(c.start <= ticks+start && c.start+c.duration > ticks+start) {
            chord_progression_orig[beat] = harmony.chordname_tonal(c);
          }
        }
        for(let c of chords) {
          if(c.start <= ticks+start && c.start+c.duration > ticks+start) {
            chord_progression[beat] = harmony.chordname_tonal(c);
          }
        }
      }

      const notesequence = harmony.melody_to_notesequence(submelody, -start);
      let latent = await mvae.encode([notesequence], chord_progression_orig)
      latent = mm.tf.add(latent, latent_noise);
      const res = await mvae.decode(latent, null, chord_progression)
      const pre  = melody.filter(t => t.start < start);
      const post = melody.filter(t => t.start >= start+192);
      const newnotes = harmony.notesequence_to_melody(res[0], start);
      melody = pre.concat(newnotes).concat(post);
      window.melody = melody;
      draw_notes();
      if(start + 192 < duration) {
        await recurse(start + 192);
      }
    }
    // Start improvising when the first chord is played
    const recursion_start = progression[0].start;
    await recurse(recursion_start);
  }
});
