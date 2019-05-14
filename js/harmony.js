'use strict';

const reharmonize = function(progression, key) {
  return progression.map(function(chord) {
    chord.name = 'dummy';
    return chord;
  });
};

export { reharmonize };
