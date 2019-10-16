'use strict';

const range = function(n) { return Array(n).fill().map((x,i)=>i) };

const toTitleCase = function (e){var t=/^(a|an|and|as|at|but|by|en|for|if|in|of|on|or|the|to|vs?\.?|via)$/i;return e.replace(/([^\W_]+[^\s-]*) */g,function(e,n,r,i){return r>0&&r+n.length!==i.length&&n.search(t)>-1&&i.charAt(r-2)!==":"&&i.charAt(r-1).search(/[^\s-]/)<0?e.toLowerCase():n.substr(1).search(/[A-Z]|\../)>-1?e:e.charAt(0).toUpperCase()+e.substr(1)})};

const shuffle = function(array) {
  for(let idx = array.length-1; idx>0; idx-=1) {
    const selected = Math.floor(Math.random() * (idx+1));
    [array[idx], array[selected]] = [array[selected], array[idx]];
  }
}

const normalize = function(array) {
  const sum = array.reduce((x, y) => x+y);
  return array.map(x => x / sum);
}


export { range, toTitleCase, shuffle, normalize };
