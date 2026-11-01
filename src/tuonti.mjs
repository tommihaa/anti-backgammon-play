// Ottelun tuonti selattavaksi (Tommin tilaus 1.11.2026): DailyGammonin vienti (.mat, Jellyfish-
// muoto) ja GNU Backgammonin .sgf, jollaisen DG Androidin Share .sgf kirjoittaa merkityt asemat
// kommentteina. Jäsennin seuraa DG Androidin tiedostoja MatFile.kt ja SgfExport.kt, joiden muoto
// on luettu DailyGammonin ja GNU:n omista tulosteista.
//
// Tulos on kummassakin muodossa sama: ottelun pituus, pelaajat ja pelit. Pelin teot ovat
// järjestyksessä. Sivu (0 tai 1) on tiedoston ensimmäinen tai toinen pelaaja. Siirrot ovat
// siirtäjän omassa numeroinnissa kuten moottorissa: 25 muuri, 0 ulos.
//   { kind: 'roll', side, dice: [d1, d2], moves: [[from, to], ...] }
//   { kind: 'double', side, value }  { kind: 'take', side }  { kind: 'drop', side }
//   { kind: 'win', side, points }
// Teolla voi olla merkki { text, located }: DG Androidin merkitty asema, joka on kohdistettu
// tähän tekoon (located) tai pudonnut pelin ensimmäiseen tekoon.

import { initialState, BAR, OFF } from './engine.mjs';

export function parseMatch(text) {
  const t = String(text).replace(/^﻿/, '');
  return /^\s*\(\s*;/.test(t) ? parseSgf(t) : parseMat(t);
}

// ---- .mat ----

const LENGTH = /^\s*(\d+)\s+point match\s*$/i;
const GAME = /^\s*Game\s+(\d+)\s*$/;
const HEADER = /^\s*(\S.*?)\s*:\s*(\d+)\s+(\S.*?)\s*:\s*(\d+)\s*$/;
const TURN = /^\s*\d+\)/;
const WIN = /^Wins\s+(\d+)\s+points?\b/;
// Nackgammonin asemarivi: valeheitto ja sivuston oma asemamerkkijono sulkeissa.
const SETUP = /\d\d: Illegal play \([^)]*\)/;

// Siirron piste: luku tai GNU:n .mat-tulosteen bar ja off.
const spot = w => (/^bar$/i.test(w) ? BAR : /^off$/i.test(w) ? OFF : Number(w));

function parseColumn(col, side) {
  const toks = col.trim().split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < toks.length;) {
    const t = toks[i];
    const r = t.match(/^(\d)(\d):$/);
    if (r) {
      const moves = [];
      i++;
      while (i < toks.length) {
        const m = toks[i].match(/^(\d+|bar)\/(\d+|off)\*?(?:\((\d)\))?$/i);
        if (!m) break;
        // GNU kirjoittaa toistuvan siirron muodossa 13/7(2).
        for (let k = 0; k < Number(m[3] ?? 1); k++) moves.push([spot(m[1]), spot(m[2])]);
        i++;
      }
      out.push({ kind: 'roll', side, dice: [Number(r[1]), Number(r[2])], moves });
    } else if (t === 'Doubles') {
      out.push({ kind: 'double', side, value: Number(toks[i + 2]) || 2 });
      i += 3;
    } else if (t === 'Takes') { out.push({ kind: 'take', side }); i++; }
    else if (t === 'Drops') { out.push({ kind: 'drop', side }); i++; }
    else if (t === 'Wins') {
      const w = toks.slice(i).join(' ').match(WIN);
      out.push({ kind: 'win', side, points: w ? Number(w[1]) : 1 });
      break;
    } else i++;
  }
  return out;
}

export function parseMat(text) {
  const lines = text.split(/\r?\n/);
  let length = null;
  const games = [];
  let cur = null, split = 0;
  for (const line of lines) {
    if (length === null) { const m = line.match(LENGTH); if (m) { length = Number(m[1]); continue; } }
    if (GAME.test(line)) { cur = null; continue; }
    if (!cur) {
      const h = line.match(HEADER);
      if (h && !TURN.test(line)) {
        // Toisen sarakkeen alku on toisen nimen alku otsikossa. Doubles-rivi alkaa yhtä
        // aiemmin, joten raja on yhtä ennen nimeä (MatFile.kt).
        split = line.indexOf(h[3], line.indexOf(h[1]) + h[1].length) - 1;
        cur = { players: [h[1], h[3]], scores: [Number(h[2]), Number(h[4])], actions: [], setup: false };
        games.push(cur);
      }
      continue;
    }
    let l = line;
    if (SETUP.test(l)) { cur.setup = true; l = l.replace(SETUP, m => ' '.repeat(m.length)); }
    const lone = l.trim().match(WIN);
    if (!TURN.test(l)) {
      // Wins omalla rivillään ilman siirtonumeroa: sarake kertoo voittajan.
      if (lone && cur.actions.at(-1)?.kind !== 'win') {
        cur.actions.push({ kind: 'win', side: l.indexOf('Wins') >= split ? 1 : 0, points: Number(lone[1]) });
      }
      continue;
    }
    const left = l.slice(0, split).replace(TURN, '');
    const right = l.length > split ? l.slice(split) : '';
    cur.actions.push(...parseColumn(left, 0), ...parseColumn(right, 1));
  }
  if (!games.length) return null;
  return { length: length ?? 0, players: games[0].players, games };
}

// ---- .sgf ----

// GNU kirjoittaa laudan ensimmäisen pelaajan (W) suunnasta: piste p on 'a' + p - 1, toisen
// pelaajan (B) piste p on 'a' + 24 - p. Muuri y ja ulos z ovat samat kummallekin.
function sgfPoint(ch, side) {
  if (ch === 'y') return BAR;
  if (ch === 'z') return OFF;
  const k = ch.charCodeAt(0) - 97;
  return side === 0 ? k + 1 : 24 - k;
}

// Jäsentää SGF-puun solmuiksi: jokainen solmu on { prop: [arvot] }. Pelipuut ovat peräkkäin.
function sgfTrees(text) {
  const trees = [];
  let i = 0, depth = 0, nodes = null, node = null;
  while (i < text.length) {
    const c = text[i];
    if (c === '(') { depth++; if (depth === 1) { nodes = []; trees.push(nodes); } i++; continue; }
    if (c === ')') { depth--; i++; continue; }
    if (c === ';') { node = {}; nodes?.push(node); i++; continue; }
    if (/[A-Z]/.test(c) && node) {
      let id = '';
      while (/[A-Za-z]/.test(text[i])) id += text[i++];
      const vals = [];
      while (/\s/.test(text[i] ?? '')) i++;
      while (text[i] === '[') {
        i++;
        let v = '';
        while (i < text.length && text[i] !== ']') {
          if (text[i] === '\\') i++;
          v += text[i++];
        }
        i++;
        vals.push(v);
        while (/\s/.test(text[i] ?? '')) i++;
      }
      node[id] = vals;
      continue;
    }
    i++;
  }
  return trees;
}

export function parseSgf(text) {
  const trees = sgfTrees(text);
  const games = [];
  let length = 0;
  for (const nodes of trees) {
    const root = nodes[0];
    if (!root || root.GM?.[0] !== '6') continue;
    const mi = Object.fromEntries((root.MI ?? []).map(v => v.split(':')));
    if (mi.length) length = Number(mi.length);
    const g = {
      players: [root.PW?.[0] ?? 'White', root.PB?.[0] ?? 'Black'],
      scores: [Number(mi.ws ?? 0), Number(mi.bs ?? 0)],
      actions: [],
      // Asetussolmu (AE, AW, AB) tarkoittaa muuta kuin tavallista alkuasemaa.
      setup: nodes.some(n => n.AE || n.AW || n.AB),
    };
    for (const n of nodes.slice(1)) {
      const side = n.W ? 0 : n.B ? 1 : null;
      if (side === null) continue;
      const v = (n.W ?? n.B)[0];
      let a;
      if (v === 'double') a = { kind: 'double', side };
      else if (v === 'take') a = { kind: 'take', side };
      else if (v === 'drop') a = { kind: 'drop', side };
      else if (/^[1-6]{2}/.test(v)) {
        const moves = [];
        for (let k = 2; k + 1 < v.length; k += 2) moves.push([sgfPoint(v[k], side), sgfPoint(v[k + 1], side)]);
        a = { kind: 'roll', side, dice: [Number(v[0]), Number(v[1])], moves };
      } else continue;
      if (n.C) a.mark = { text: n.C.join('\n'), located: !!n.DO };
      g.actions.push(a);
    }
    const re = root.RE?.[0]?.match(/^([WB])\+(\d+)/);
    if (re) g.actions.push({ kind: 'win', side: re[1] === 'W' ? 0 : 1, points: Number(re[2]) });
    games.push(g);
  }
  if (!games.length) return null;
  return { length, players: games[0].players, games };
}

// ---- Toisto ----

// Pelin asemat teko teolta: steps[k] on asema ennen tekoa k, viimeinen pelin lopussa.
// Asema on [ensimmäinen, toinen] kummankin omassa numeroinnissa, kuutio { value, owner }, jossa
// owner on sivu tai -1 keskellä. Jos siirto lähtee tyhjästä pisteestä (toistettu peli tai
// tavallisesta poikkeava alkuasema), toisto pysähtyy ja error kertoo teon.
export function replay(g) {
  const s = initialState().map(a => Int8Array.from(a));
  let cube = { value: 1, owner: -1 }, offered = 2;
  const steps = [];
  const snap = () => ({ s: [Int8Array.from(s[0]), Int8Array.from(s[1])], cube: { ...cube } });
  for (let k = 0; k < g.actions.length; k++) {
    steps.push(snap());
    const a = g.actions[k];
    if (a.kind === 'double') offered = a.value ?? cube.value * 2;
    else if (a.kind === 'take') cube = { value: offered, owner: a.side };
    else if (a.kind === 'roll') {
      const me = s[a.side], op = s[1 - a.side];
      for (const [f, t] of a.moves) {
        if (f < 1 || f > 25 || t < 0 || t > 24 || me[f] <= 0) return { steps, error: k };
        me[f]--;
        if (t === OFF) me[OFF]++;
        else {
          me[t]++;
          if (op[25 - t] === 1) { op[25 - t]--; op[BAR]++; }
        }
      }
    }
  }
  steps.push(snap());
  return { steps, error: null };
}
