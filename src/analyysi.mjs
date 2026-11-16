// Siirron analyysi samalla syvyydellä kuin botti pelaa (Tommin tilaus 1.11.2026). Sama
// karsinta kuin verkkobotissa (src/verkko.mjs netBot): 0-ply järjestää siirrot, ja syvempi
// haku arvioi niistä viisi parasta. Pelattu siirto arvioidaan aina, vaikka se ei olisi
// viiden joukossa. Ajetaan sivulla 0-ply:llä ja botin säikeessä 1- ja 2-ply:llä.

import { legalPlays, exited, key, ROLLS, clone, OFF, BAR } from './engine.mjs';
import { value, PLY } from './verkko.mjs';

// Osasiirrot kirjoitetaan suurimmasta lähtöpisteestä alkaen kuten backgammonin notaatiossa
// (Tommin pyyntö 1.11.2026), muuri (25) ensin. Ulos pelattu on off. Laudalta (src/ui.mjs)
// tänne, jotta moottori kirjoittaa analyysitiedostoon saman merkinnän kuin lauta.
export function notation(d, moves, hits) {
  const parts = moves.map(([f, t], k) => ({ f, t, hit: hits[k] }))
    .sort((a, b) => b.f - a.f || b.t - a.t)
    .map(({ f, t, hit }) => `${f === BAR ? 25 : f}/${t <= 0 ? 'off' : t}${hit ? '*' : ''}`);
  return `${d[0]}${d[1]}: ${parts.join(' ')}`;
}

// Yhden osasiirron soveltaminen, palauttaa lyönnin.
export function applyMove(s, p, from, to) {
  const me = s[p], opp = s[1 - p];
  me[from]--;
  if (to <= 0) { me[OFF]++; return false; }
  me[to]++;
  if (opp[25 - to] === 1) { opp[25 - to]--; opp[BAR]++; return true; }
  return false;
}

// Verkon parhaat siirtäjän numeroinnissa eroineen (rankPlays-tuloksen top laudan muotoon).
export function topMoves(base, p, dice, top, best) {
  return top.map(({ moves, x }) => {
    const tmp = clone(base);
    const hits = moves.map(([f, t]) => applyMove(tmp, p, f, t));
    return { m: notation(dice, moves, hits).split(': ')[1] ?? '', loss: 2 * (best - x), x };
  });
}

// Palauttaa pelatun siirron arvion, parhaan arvion ja kolme parasta siirtoa (moves ja arvio),
// kaikki P(voitto) pelaajalle p. Pakkosiirrosta (alle kaksi eri loppuasemaa) palauttaa null.
export function rankPlays(net, base, p, d1, d2, playedS, ply = 0, keep = 5) {
  const plays = legalPlays(base, p, d1, d2);
  if (plays.length < 2) return null;
  const v0 = st => (exited(st[p]) ? 0 : value(net, st, p));
  let ranked = plays.map(pl => ({ moves: pl.moves, s: pl.s, x: v0(pl.s) })).sort((a, b) => b.x - a.x);
  const playedKey = key(playedS);
  if (ply > 0) {
    const deep = st => (exited(st[p]) ? 0 : PLY[ply](net, st, p));
    const pick = ranked.slice(0, keep);
    const own = ranked.find(r => key(r.s) === playedKey);
    if (own && !pick.includes(own)) pick.push(own);
    ranked = pick.map(r => ({ ...r, x: deep(r.s) })).sort((a, b) => b.x - a.x);
  }
  const playedV = ranked.find(r => key(r.s) === playedKey)?.x ?? v0(playedS);
  return { best: ranked[0].x, played: playedV, top: ranked.slice(0, 3).map(({ moves, x }) => ({ moves, x })) };
}

// Heiton onni (luck) kuten gnubg:ssä, 0-ply:llä kuten gnubg:n oletus (Tommin pyyntö 14.11.2026):
// verkon arvio parhaasta siirrosta saadulla heitolla miinus sama arvio keskimäärin kaikista 36
// heitosta. Arvio on siirtäjän P(voitto) siirron jälkeen. Tuplat painavat yhden ja muut kaksi
// heittoa. Tanssissa asema jää ennalleen. Tulos on equityä (2 × P(voitto) − 1) siirtäjälle:
// plus on onnea, miinus epäonnea. Lasketaan myös pakkosiirroille ja tansseille.
export function rollLuck(net, base, p, d1, d2) {
  const v = st => (exited(st[p]) ? 0 : value(net, st, p));
  let sum = 0, weight = 0, got = null;
  for (const [a, b, n] of ROLLS) {
    const x = Math.max(...legalPlays(base, p, a, b).map(pl => v(pl.s)));
    sum += n * x;
    weight += n;
    if ((a === d1 && b === d2) || (a === d2 && b === d1)) got = x;
  }
  return 2 * (got - sum / weight);
}
