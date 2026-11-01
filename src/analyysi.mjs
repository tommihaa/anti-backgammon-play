// Siirron analyysi samalla syvyydellä kuin botti pelaa (Tommin tilaus 1.11.2026). Sama
// karsinta kuin verkkobotissa (src/verkko.mjs netBot): 0-ply järjestää siirrot, ja syvempi
// haku arvioi niistä viisi parasta. Pelattu siirto arvioidaan aina, vaikka se ei olisi
// viiden joukossa. Ajetaan sivulla 0-ply:llä ja botin säikeessä 1- ja 2-ply:llä.

import { legalPlays, exited, key } from './engine.mjs';
import { value, PLY } from './verkko.mjs';

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
