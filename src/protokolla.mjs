// Moottoriprotokolla (Kaanon/Anti-Backgammon §5 kohta 9 › Protokolla ensin, kuitattu 25.11.2026).
// Rivipohjainen viestimuoto shakin UCI:n tapaan: asiakas (lauta, otteluohjelma) kirjoittaa
// komentorivejä ja moottori vastaa riveillä. Tässä moduulissa on kummankin puolen yhteinen osa:
// siirron merkintä ja jäsennys, aseman rivi ja oman moottorin komentokäsittelijä. Moduuli ei
// käytä tiedostoja eikä prosesseja, joten se toimii samana Nodessa ja selaimessa.
//
// Komennot ja vastaukset (vastauksen viimeinen rivi on aina yksi, id-, option- ja info-rivit
// tulevat ennen sitä):
//   abg                      → id name …, id author …, id protocol 1, id rules …, abgok
//   isready                  → readyok
//   newgame                  (ei vastausta) uusi peli alkaa, moottori nollaa pelikohtaisen tilan
//   setoption name N value V (ei vastausta)
//   position xgid X half H   (ei vastausta) asema ja pelatut puolisiirrot (rivi on kaksi)
//   move                     → bestmove <siirto> | bestmove none (nopat ovat XGID:ssä)
//   cube                     → double | draw | roll (vuorossa oleva ennen heittoa)
//                            → take | pass (XGID:n nopat D: vuorossa oleva vastaa tuplaukseen)
//   drawoffer                → accept | decline (vastaaja on se, joka EI ole vuorossa)
//   eval                     → eval win <P(vuorossa oleva voittaa)>
//   quit                     lopettaa
// Tuntematon tai virheellinen komento → error <komento> <selitys>. Siirto kirjoitetaan siirtäjän
// numeroinnissa noppa kerrallaan (24/18 13/11, bar/22, 6/off, lyönti merkitään *:llä).
// Toisto (n) on sallittu jäsennyksessä, esimerkiksi 13/11(2).

import { legalPlays, key, clone, BAR } from './engine.mjs';
import { applyMove } from './analyysi.mjs';
import { toXGID, fromXGID } from './xgid.mjs';
import { netBot, netCube } from './verkko.mjs';
import { tablePolicy } from './kuutio.mjs';
import { newStall, observe, stuck, botOffers, botAccepts } from './jumi.mjs';

export const PROTOCOL = 1;
// Sääntöversio nimeää ANTI-BACKGAMMON.md:n §2:n tilan. Uusi nimi, kun sääntö muuttuu.
export const RULES = 'anti-backgammon-2026-11';

// Siirron merkintä: osasiirrot suurimmasta lähtöpisteestä alkaen, kuten src/analyysi.mjs notation.
export function formatMove(base, p, moves) {
  if (!moves.length) return 'none';
  const tmp = clone(base);
  return moves.map(([f, t]) => ({ f, t, hit: applyMove(tmp, p, f, t) }))
    .sort((a, b) => b.f - a.f || b.t - a.t)
    .map(({ f, t, hit }) => `${f === BAR ? 'bar' : f}/${t <= 0 ? 'off' : t}${hit ? '*' : ''}`)
    .join(' ');
}

// Jäsentää siirron ja palauttaa laillisen siirron ({ s, moves, hits }) tai null. plays on valmiiksi
// laskettu legalPlays-lista, jos kutsujalla on se.
export function parseMove(text, s, p, d1, d2, plays = legalPlays(s, p, d1, d2)) {
  const t = String(text).trim().toLowerCase();
  if (t === 'none' || t === '') return plays.length === 1 && !plays[0].moves.length ? plays[0] : null;
  const steps = [];
  for (const part of t.split(/\s+/)) {
    const m = part.match(/^(bar|\d+)((?:\/(?:off|\d+)\*?)+)(?:\((\d)\))?$/);
    if (!m) return null;
    const pts = [m[1] === 'bar' ? BAR : Number(m[1]), ...m[2].split('/').slice(1).map(x => (x.startsWith('off') ? 0 : parseInt(x, 10)))];
    for (let r = 0; r < Number(m[3] ?? 1); r++) for (let i = 1; i < pts.length; i++) steps.push([pts[i - 1], pts[i]]);
  }
  const tmp = clone(s);
  for (const [f, to] of steps) {
    if (f < 1 || f > BAR || to < 0 || to > 24 || !tmp[p][f]) return null;
    applyMove(tmp, p, f, to);
  }
  const k = key(tmp);
  return plays.find(pl => key(pl.s) === k) ?? null;
}

// Aseman rivi. g: { s, cube, turn, dice, offered, pen, crawford, limit } kuten src/xgid.mjs.
export const positionLine = (g, half) => `position xgid ${toXGID(g)} half ${half}`;

// Komentorivin jäsennys asiakkaalle ja moottorille: [komento, loput sanat].
export const splitLine = line => {
  const w = String(line).trim().split(/\s+/);
  return [w[0] ?? '', w.slice(1)];
};

// Rivi päättää vastauksen, jos se ei ole id-, option- tai info-rivi.
export const isFinal = line => !/^(id|option|info)\b/.test(line);
// Komennot, joihin tulee vastaus. Silta ja asiakas laskevat niistä odotettavat vastaukset.
export const ANSWERED = new Set(['abg', 'isready', 'move', 'cube', 'drawoffer', 'eval']);

// Oman moottorin komentokäsittelijä. net on src/verkko.mjs:n verkko. Palauttaa funktion, joka
// ottaa komentorivin ja palauttaa vastausrivit. Siirron tasapelit ratkaistaan ensimmäisellä
// parhaalla, joten moottori on deterministinen.
export function createEngine(net, { ply = 0, name = 'Anti-Backgammon', author = 'tommihaa' } = {}) {
  const opts = { ply };
  const bots = {};
  const policy = netCube(net);
  let pos = null, half = 0, stall = newStall(), lastHalf = -1;
  const first = () => 0;
  const cubeOf = g => (g.limit ? tablePolicy(policy, { away: g.pen.map(x => g.limit - x), crawford: g.crawford }) : policy);
  return line => {
    const [cmd, args] = splitLine(line);
    switch (cmd) {
      case '': return [];
      case 'abg':
        return [`id name ${name}`, `id author ${author}`, `id protocol ${PROTOCOL}`, `id rules ${RULES}`,
          'option name ply type spin default 0 min 0 max 3', 'abgok'];
      case 'isready': return ['readyok'];
      case 'newgame': stall = newStall(); lastHalf = -1; return [];
      case 'setoption': {
        const n = args.indexOf('name'), v = args.indexOf('value');
        if (args[n + 1] === 'ply' && v > 0) { const x = Number(args[v + 1]); if (x >= 0 && x <= 3) opts.ply = x; }
        return [];
      }
      case 'position': {
        const xi = args.indexOf('xgid'), hi = args.indexOf('half');
        const g = xi < 0 ? null : fromXGID(args[xi + 1]);
        if (!g) { pos = null; return ['error position XGID puuttuu tai on virheellinen']; }
        g.offered = /:D:/.test(args[xi + 1]);
        pos = g; half = hi < 0 ? 0 : Number(args[hi + 1]) || 0;
        return [];
      }
      case 'move': {
        if (!pos?.dice) return ['error move asemassa ei ole noppia'];
        bots[opts.ply] ??= netBot(net, opts.ply);
        const p = pos.turn;
        return [`bestmove ${formatMove(pos.s, p, bots[opts.ply](pos.s, p, pos.dice[0], pos.dice[1], first).moves)}`];
      }
      case 'cube': {
        if (!pos) return ['error cube asema puuttuu'];
        const p = pos.turn, c = cubeOf(pos);
        if (pos.offered) return [c.take(pos.s, p, pos.cube) ? 'take' : 'pass'];
        // Jumin tunnistus näkee vain ne vuorot, joilla moottorilta kysytään (Kaanon §5 kohta 9).
        if (half < lastHalf) stall = newStall();
        if (half !== lastHalf) observe(stall, half, pos.s, 0, policy.winProb(pos.s, p));
        lastHalf = half;
        if (c.double(pos.s, p, pos.cube)) return ['double'];
        if (botOffers(policy.winProb(pos.s, p), half, stuck(stall))) return ['draw'];
        return ['roll'];
      }
      case 'drawoffer':
        if (!pos) return ['error drawoffer asema puuttuu'];
        return [botAccepts(policy.winProb(pos.s, pos.turn), half) ? 'accept' : 'decline'];
      case 'eval':
        if (!pos) return ['error eval asema puuttuu'];
        return [`eval win ${policy.winProb(pos.s, pos.turn).toFixed(4)}`];
      default: return [`error ${cmd} tuntematon komento`];
    }
  };
}
