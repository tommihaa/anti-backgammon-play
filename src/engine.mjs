// Anti-Backgammonin sääntömoottori. Lauta ja siirrot ovat backgammonin, voittoehto käänteinen:
// ensimmäisenä kaikki nappulansa ulos pelannut saa rangaistuspisteen (Kaanon/Anti-Backgammon §2).
//
// Tila on kummankin pelaajan omasta näkökulmasta: s[p][i] on pelaajan p nappuloiden määrä
// hänen omalla pisteellään i. Indeksi 0 = ulos pelatut, 1..24 = pisteet, 25 = baari.
// Pelaaja liikkuu suurista numeroista pieniin. Vastustajan piste i on minun pisteeni 25 - i.

export const OFF = 0;
export const BAR = 25;

// Tasapeli 300 rivin jälkeen (Kaanon/Anti-Backgammon §2.7). Rivi on kaksi puolisiirtoa, joten raja
// on 600 puolisiirtoa avausheitosta lukien. Kumpikaan ei saa rangaistuspisteitä.
export const DRAW_ROWS = 300;
export const DRAW_HALF = 2 * DRAW_ROWS;

export function initialState() {
  const side = () => {
    const a = new Int8Array(26);
    a[24] = 2; a[13] = 5; a[8] = 3; a[6] = 5;
    return a;
  };
  return [side(), side()];
}

// Nackgammonin alkuasema: kaksi takanappulaa lisää 23-pisteelle, 13- ja 6-pisteeltä yksi kummaltakin.
// Käytössä vain opetuksessa (Tommi 28.10.2026); Anti-Backgammonin alkuasema on yllä.
export function nackgammonState() {
  const side = () => {
    const a = new Int8Array(26);
    a[24] = 2; a[23] = 2; a[13] = 4; a[8] = 3; a[6] = 4;
    return a;
  };
  return [side(), side()];
}

export function clone(s) {
  return [Int8Array.from(s[0]), Int8Array.from(s[1])];
}

export function key(s) {
  return s[0].join(',') + '|' + s[1].join(',');
}

export function pips(a) {
  let n = 0;
  for (let i = 1; i <= 25; i++) n += i * a[i];
  return n;
}

export function exited(a) {
  return a[OFF] === 15;
}

function allHome(a) {
  for (let i = 7; i <= 25; i++) if (a[i] > 0) return false;
  return true;
}

// Yhden nopan siirto pisteestä from. Palauttaa uuden tilan tai null jos siirto ei ole laillinen.
// Uusi tila kertoo myös, lyötiinkö (hit = true).
function stepFrom(s, p, from, d) {
  const me = s[p], opp = s[1 - p];
  if (me[from] === 0) return null;
  if (me[BAR] > 0 && from !== BAR) return null;
  const to = from - d;
  if (to >= 1) {
    const o = opp[25 - to];
    if (o >= 2) return null;
    const n = clone(s);
    n[p][from]--; n[p][to]++;
    let hit = false;
    if (o === 1) { n[1 - p][25 - to]--; n[1 - p][BAR]++; hit = true; }
    return { s: n, hit };
  }
  if (!allHome(me)) return null;
  if (to < 0) {
    // Ylisuuri noppa kelpaa vain korkeimmalta miehitetyltä pisteeltä.
    for (let i = from + 1; i <= 6; i++) if (me[i] > 0) return null;
  }
  const n = clone(s);
  n[p][from]--; n[p][OFF]++;
  return { s: n, hit: false };
}

function stepsFor(s, p, d) {
  const out = [];
  const me = s[p];
  if (me[BAR] > 0) {
    const r = stepFrom(s, p, BAR, d);
    if (r) out.push({ ...r, from: BAR, to: BAR - d });
    return out;
  }
  for (let from = 24; from >= 1; from--) {
    if (me[from] === 0) continue;
    const r = stepFrom(s, p, from, d);
    if (r) out.push({ ...r, from, to: Math.max(from - d, 0) });
  }
  return out;
}

// Kaikki lailliset kokonaissiirrot heitolle (d1, d2). Säännöt: molemmat nopat on käytettävä jos
// mahdollista, tuplat neljästi, ja jos vain toinen noppa käy, isompi on pelattava jos se käy.
// Palauttaa listan { s, moves, hits }, jossa moves on [[from, to], ...] ja hits lyöntien määrä.
// Oletuksena sama loppuasema palautetaan kerran. Käyttöliittymä pyytää kaikki siirtojärjestykset
// (all = true), jotta pelaajan aloittama osasarja löytyy listasta.
export function legalPlays(s, p, d1, d2, all = false) {
  const seqs = d1 === d2 ? [[d1, d1, d1, d1]] : [[d1, d2], [d2, d1]];
  const results = new Map();
  let maxUsed = 0;
  const found = [];
  for (const seq of seqs) {
    const walk = (st, i, moves, hits) => {
      if (i < seq.length) {
        const next = stepsFor(st, p, seq[i]);
        if (next.length > 0) {
          for (const r of next) walk(r.s, i + 1, [...moves, [r.from, r.to]], hits + (r.hit ? 1 : 0));
          return;
        }
      }
      if (i > maxUsed) maxUsed = i;
      found.push({ s: st, moves, hits, used: i, first: seq[0] });
    };
    walk(s, 0, [], 0);
  }
  let keep = found.filter(f => f.used === maxUsed);
  if (maxUsed === 1 && d1 !== d2) {
    const big = Math.max(d1, d2);
    const withBig = keep.filter(f => f.first === big);
    if (withBig.length > 0) keep = withBig;
  }
  if (all) return keep.map(f => ({ s: f.s, moves: f.moves, hits: f.hits }));
  for (const f of keep) {
    const k = key(f.s);
    if (!results.has(k)) results.set(k, { s: f.s, moves: f.moves, hits: f.hits });
  }
  return [...results.values()];
}

// Liikkuvuus: montako (noppa, lähtöpiste) -paria pelaajalla on laillisena yksittäisenä siirtona.
// Haudattu nappula ei liiku millään nopalla ennen ulospelaamista, joten se ei tuota tähän mitään.
export function mobility(s, p) {
  let n = 0;
  for (let d = 1; d <= 6; d++) n += stepsFor(s, p, d).length;
  return n;
}

// Kilpajuoksu: kontakti on loppunut, eli kummankaan nappulat eivät enää voi kohdata. Pelaajan
// p takimmainen nappula (baari mukaan lukien) on hänen pisteellään maxP ja vastustajan
// takimmainen vastustajan pisteellä maxQ, joka on p:n pisteellä 25 − maxQ. Kontaktia ei ole, kun
// maxP < 25 − maxQ. Ehto on symmetrinen, joten vuorossa olevalla ei ole väliä.
export function isRace(s) {
  const back = a => { for (let i = BAR; i >= 1; i--) if (a[i] > 0) return i; return 0; };
  return back(s[0]) + back(s[1]) < 25;
}

// 21 erilaista heittoa painoineen (tupla 1/36, muut 2/36).
export const ROLLS = [];
for (let a = 1; a <= 6; a++) for (let b = a; b <= 6; b++) ROLLS.push([a, b, a === b ? 1 : 2]);
