'use strict';

import * as util from "./util.js";
import * as harmony from "./harmony.js";

var original_melody, melody, original_progression, progression, scroller, svg, button_pane;
var bpm = 100;
var playing = false;
var enabled = {melody:true, harmony:true, bass:true, drums:true};
var key;
var scroller;
var x, xinv, y, duration;
var height, width;

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

const text_button = function(base, name, px, py, w, h) {
  return prepare_button(base, name, px, py, w, h, x => {
    x.append('text')
      .text(name)
      .attr('x', w/2)
      .attr('y', h/2+8)
      .attr('text-anchor', 'middle')
      .style('font-family', 'Patrick Hand')
      .style('font-size', '18pt');
})
}

window.reharmonize = function() {
  progression = harmony.reharmonize(original_progression, key);
  draw_chords();
}

const draw_buttons = function(play, pause, stop) {
  const select = d3.select('#buttons');
  button_pane = !select.empty() ? select : svg.append('g').attr('id', 'buttons');
  const scl = 15

  button_pane.attr('transform', 'translate(10, 70)');

  const sound_pane = button_pane.append('g')
    .attr('transform', 'translate(0,75)')

  const edit_pane = button_pane.append('g')
    .attr('transform', 'translate(0,75)')

  let pane_shown = 'none';

  const slide_panes = function() {
    const dur = 500;
    switch(pane_shown) {
    case 'none':
      button_pane.transition()
        .duration(dur)
        .attr('transform', `translate(${(width-365)/2}, ${height-75})`)
      sound_pane.transition()
        .duration(dur)
        .attr('transform', `translate(0, 75)`)
      edit_pane.transition()
        .duration(dur)
        .attr('transform', `translate(0, 75)`)
      break;
    case 'sound':
      button_pane.transition()
        .duration(dur)
        .attr('transform', `translate(${(width-365)/2}, ${height-5*75})`)
      sound_pane.transition()
        .duration(dur)
        .attr('transform', `translate(0, 75)`)
      edit_pane.transition()
        .duration(dur)
        .attr('transform', `translate(0, ${5*75})`)
      break;
    case 'edit':
      button_pane.transition()
        .duration(dur)
        .attr('transform', `translate(${(width-365)/2}, ${height-4*75})`)
      sound_pane.transition()
        .duration(dur)
        .attr('transform', `translate(0, ${4*75})`)
      edit_pane.transition()
        .duration(dur)
        .attr('transform', `translate(0, 75)`)
      break;
    }
  }

  fa_button(button_pane, 'sound', 0, 0, 65, 65, '')
    .on('click', function() {
      if(pane_shown == 'sound')
        pane_shown = 'none';
      else
        pane_shown = 'sound';
      slide_panes();
  });
  fa_button(button_pane, 'edit', 75, 0, 65, 65, '')
    .on('click', function() {
      if(pane_shown == 'edit')
        pane_shown = 'none';
      else
        pane_shown = 'edit';
      slide_panes();
  });
  fa_button(button_pane, 'shuffle', 150, 0, 65, 65, '')
    .on('click', function() {
      window.reharmonize();
      window.improvize();
    });
  fa_button(button_pane, 'play', 225, 0, 65, 65, '')
    .on('click', play);
  fa_button(button_pane, 'pause', 225, 0, 65, 65, '')
    .on('click', pause);
  fa_button(button_pane, 'stop', 300, 0, 65, 65, '')
    .on('click', function() { stop() });
  d3.select('#pause').style('visibility', 'hidden');

  let dy = 0;
  text_button(edit_pane, 'original', 0, dy, 365, 65, x => {
  }).on('click', function() {
    progression = original_progression;
    melody = original_melody;
    draw_notes();
    draw_chords();
  });
  dy += 75;
  text_button(edit_pane, 'reharmonise', 0, dy, 365, 65)
    .on('click', function() { window.reharmonize() });
  dy += 75;
  text_button(edit_pane, 'improvise', 0, dy, 365, 65)
  dy = 0;
  for(const el of ['melody', 'harmony', 'bass', 'drums']) {
    const btn = text_button(sound_pane, el, 0, dy, 365, 65)
    btn.on('click', function() {
      enabled[el] = !enabled[el];
      if(enabled[el])
        btn.style('fill', 'rgba(255,255,255,0.01)');
      else
        btn.style('fill', 'rgba(255,255,255,0.5)');
    });
    dy += 75;
  }
}

// Initialize...
const init = function() {
  playing = false;

  progression = original_progression;
  melody = original_melody;

  const events = melody.concat(progression)
  let duration = d3.max(events.map(x => x.start+x.duration));

  d3.select('#drawing').select('svg').remove();
  svg = d3.select('#drawing')
    .append('svg')
    .style('height', '100vh')
    .style('width', '100vw');

  x    = (t => t * 60);
  xinv = (t => t / 60);

  const highest = d3.max(original_melody.map(n => n.note));
  y    = (p => (24+highest - p) * 10);
  console.log(highest);

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
  const b2ms     = (beats => 1000 * 60 / bpm * beats);
  const humanize = (ms => Math.max(0, 30 * (Math.random() - 0.5) + ms));
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
      if(note_idx < melody.length) {
        setTimeout(playnextnote, humanize(b2ms(melody[note_idx].start - gettime())));
      }
    };
    const playnextchord = function() {
      if(!playing) return;
      const chord = progression[chord_idx];
      const notes = harmony.CHORDS[chord.mode].map(x => x+chord.base+48);
      if(enabled.bass) {
        MIDI.noteOn(  1, notes[0]-12, 120, 0);
        MIDI.noteOff( 1, notes[0]-12, b2ms(chord.duration) / 1000);
      }
      if(enabled.harmony) {
        MIDI.chordOn( 0, notes.slice(1), 60, 0);
        MIDI.chordOff(0, notes.slice(1), b2ms(chord.duration) / 1000);
      }
      chord_idx++;
      if(chord_idx < progression.length) {
        setTimeout(playnextchord, humanize(b2ms(progression[chord_idx].start - gettime())));
      }
    };
    const playnextdrums = function() {
     if(!playing) return;
      const chord = beat[beat_idx];
      if(enabled.drums) {
        MIDI.chordOn( 2, chord.notes, 70, 0);
        MIDI.chordOff(2, chord.notes, b2ms(chord.duration) / 1000);
      }
      beat_idx = (beat_idx + 1) % beat.length;
      const delay = b2ms((((beat[beat_idx].start - gettime()) % 4) + 4) % 4);
      setTimeout(playnextdrums, humanize(delay));
    };

    setTimeout(playnextnote,  b2ms(melody[note_idx].start - time));
    setTimeout(playnextchord, b2ms(progression[chord_idx].start - time));
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

  window.improvize = function() {
    const latent_noise = mm.tf.randomNormal([1, 128], 0, 0.3);
    for(let start = 4; start < duration - 8; start += 8) {
      const filter_and_crop = seq => seq
        .filter(t => t.start+t.duration >= start || t.start <= start+8)
        .map(t => {
          let t2 = Object.create(t);
          if(t2.start < start) t2.start = start;
          if(t2.start + t2.duration < start+8) t2.duration = start+8 - t2.duration;
          return t2
        });

      const chords      = filter_and_crop(progression);
      const chords_orig = filter_and_crop(original_progression);
      const submelody   = filter_and_crop(original_melody);

      let chord_progression = new Array(8).fill(mm.constants.NO_CHORD);
      let chord_progression_orig = new Array(8).fill(mm.constants.NO_CHORD);
      for(let beat = 0; beat < 8; ++beat) {
        for(let c of chords_orig) {
          if(c.start <= beat+start && c.start+c.duration > beat+start) {
            chord_progression_orig[beat] = harmony.chordname_tonal(c);
          }
        }
        for(let c of chords) {
          if(c.start <= beat+start && c.start+c.duration > beat+start) {
            chord_progression[beat] = harmony.chordname_tonal(c);
          }
        }
      }
      console.log(chord_progression);

      const notesequence = harmony.melody_to_notesequence(submelody, -start);
      mvae.encode([notesequence], chord_progression_orig).then(function(latent) {
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
  }

  window.mvae = mvae;
  mvae.initialize().then(function(x) {
    d3.select('#improvise')
      .on('click', function() { window.improvize() });
    d3.select('#improvise > text')
      .style('fill', 'black');
  });
};

const handle_resize = function() {
  width = document.getElementById("drawing").clientWidth;
  height = document.getElementById("drawing").clientHeight;

  d3.select("g#buttons")
    .attr("transform", `translate(${(width-365)/2}, ${height-75})`)
  // y = (p => (24 + highest - p) * 10);
}

const load_song = function(song) {
  console.log(song);
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
