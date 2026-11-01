// Aseman tunniste XGID-muodossa (eXtreme Gammon, myös gnubg lukee sen), Tommin tilaus 1.11.2026.
//
// XGID=PPPPPPPPPPPPPPPPPPPPPPPPPP:CV:CP:T:D:S1:S2:CJ:ML:MC
// Asema on 26 merkkiä: ensimmäinen on pienten kirjainten pelaajan muuri, sitten pisteet 1–24
// isojen kirjainten pelaajan numeroinnissa ja viimeisenä isojen kirjainten pelaajan muuri.
// A–O ja a–o ovat 1–15 nappulaa, - tyhjä. Isot kirjaimet ovat ihminen (pelaaja 0), pienet botti.
// CV on kuution arvon kaksikantainen logaritmi, CP omistaja (1 ihminen, -1 botti, 0 keskellä),
// T vuoro (1 ihminen, -1 botti), D nopat (00 heittämättä, D tuplaus tarjottu, muuten kaksi
// numeroa), S1 ja S2 pisteet, CJ Crawford-peli, ML ottelun pituus (0 rahapeli) ja MC kuution
// katon logaritmi. Pisteet ovat tässä pelissä rangaistuspisteitä.

import { BAR, OFF } from './engine.mjs';

const enc = n => (n === 0 ? '-' : null);
const up = n => enc(n) ?? String.fromCharCode(64 + n);
const low = n => enc(n) ?? String.fromCharCode(96 + n);

export function toXGID({ s, cube, turn, dice, offered, pen, crawford, limit }) {
  const [me, bot] = s;
  let pos = low(bot[BAR]);
  for (let i = 1; i <= 24; i++) pos += me[i] ? up(me[i]) : low(bot[25 - i]);
  pos += up(me[BAR]);
  const cv = Math.round(Math.log2(cube.value));
  const cp = cube.owner === 0 ? 1 : cube.owner === 1 ? -1 : 0;
  const d = offered ? 'D' : dice ? `${dice[0]}${dice[1]}` : '00';
  return `XGID=${pos}:${cv}:${cp}:${turn === 0 ? 1 : -1}:${d}:${pen[0]}:${pen[1]}:${crawford ? 1 : 0}:${limit ?? 0}:6`;
}

// Palauttaa aseman ja vuoron tiedot tai null, jos merkkijono ei ole kelvollinen XGID.
export function fromXGID(text) {
  const m = String(text).trim().match(/^(?:XGID=)?([-a-oA-O]{26}):(\d+):(-?1|0):(-?1):(00|D|B|R|[1-6]{2})(?::.*)?$/);
  if (!m) return null;
  const me = new Int8Array(26), bot = new Int8Array(26);
  const pos = m[1];
  const count = ch => (ch === '-' ? 0 : ch.toLowerCase().charCodeAt(0) - 96);
  const isUp = ch => ch !== '-' && ch === ch.toUpperCase();
  for (let k = 0; k < 26; k++) {
    const ch = pos[k], n = count(ch);
    if (!n) continue;
    if (k === 0) { if (isUp(ch)) return null; bot[BAR] = n; continue; }
    if (k === 25) { if (!isUp(ch)) return null; me[BAR] = n; continue; }
    if (isUp(ch)) me[k] = n; else bot[25 - k] = n;
  }
  const sum = a => a.slice(1).reduce((x, y) => x + y, 0);
  if (sum(me) > 15 || sum(bot) > 15) return null;
  me[OFF] = 15 - sum(me); bot[OFF] = 15 - sum(bot);
  const cv = Number(m[2]);
  if (cv > 6) return null;
  const cp = Number(m[3]);
  const dice = /^[1-6]{2}$/.test(m[5]) ? [Number(m[5][0]), Number(m[5][1])] : null;
  return {
    s: [me, bot],
    cube: { value: 2 ** cv, owner: cp === 1 ? 0 : cp === -1 ? 1 : -1 },
    turn: m[4] === '1' ? 0 : 1,
    dice,
  };
}
