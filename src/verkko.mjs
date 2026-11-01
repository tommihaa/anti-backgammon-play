// Neuroverkkoarvio TD-Gammonin tapaan: yksi piilokerros ja yksi tulos, P(pelaaja p voittaa)
// eli vastustaja joutuu ulos ensin. Gammoneja ei ole (Kaanon/Anti-Backgammon §2.3), joten muita
// tuloksia ei tarvita. Verkko arvioi aseman, jossa vastustaja on vuorossa, eli oman siirron
// jälkeisen aseman.
//
// Kaksi syötemuotoa:
//   nolla:       pelkkä lauta Tesauron koodauksella (kummallekin 24 pistettä × 4, baari, ulkona).
//   periaatteet: lisäksi Tommin periaatteet piirteinä (§4): haudatut, tehdyt kotipisteet,
//                miinat ja 6-piste kummallekin, sekä pip-luvut. Haudattu-piirre laskee myös
//                1–2-pisteen miinan. Muoto säilyy, koska sillä opetetut verkot (myös laudan
//                vastustaja) ovat oppineet juuri sen.
//   periaatteet2: sama, mutta yksinäinen nappula 1–2-pisteellä on miina eikä haudattu (§3).

import { BAR, OFF, pips, legalPlays, exited, ROLLS } from './engine.mjs';
import { mayDouble, DOUBLE_POINT, TAKE_POINT } from './kuutio.mjs';

// mines = true: yksinäinen nappula 1–2-pisteellä on miina eikä haudattu (periaatteet2).
function buriedOf(a, mines) {
  let outside = a[BAR];
  for (let i = 7; i <= 24; i++) outside += a[i];
  if (outside === 0) return 0;
  if (!mines) return a[1] + a[2];
  return (a[1] >= 2 ? a[1] : 0) + (a[2] >= 2 ? a[2] : 0);
}

function encodeSide(a, out, k) {
  for (let i = 1; i <= 24; i++) {
    const n = a[i];
    out[k++] = n >= 1 ? 1 : 0;
    out[k++] = n >= 2 ? 1 : 0;
    out[k++] = n >= 3 ? 1 : 0;
    out[k++] = n > 3 ? (n - 3) / 2 : 0;
  }
  out[k++] = a[BAR] / 2;
  out[k++] = a[OFF] / 15;
  return k;
}

function principlesOf(a, out, k, mines) {
  let made = 0, blots = 0;
  for (let i = 1; i <= 6; i++) { if (a[i] >= 2) made++; if (a[i] === 1) blots++; }
  out[k++] = buriedOf(a, mines) / 5;
  out[k++] = made / 6;
  out[k++] = blots / 6;
  out[k++] = a[6] >= 2 ? 1 : 0;
  out[k++] = pips(a) / 167;
  return k;
}

export const INPUTS = { nolla: 2 * 98, periaatteet: 2 * 98 + 2 * 5, periaatteet2: 2 * 98 + 2 * 5 };

// Syöte pelaajan p näkökulmasta: ensin omat, sitten vastustajan.
export function encode(s, p, kind, out = new Float64Array(INPUTS[kind])) {
  let k = encodeSide(s[p], out, 0);
  k = encodeSide(s[1 - p], out, k);
  if (kind === 'periaatteet' || kind === 'periaatteet2') {
    const mines = kind === 'periaatteet2';
    k = principlesOf(s[p], out, k, mines);
    k = principlesOf(s[1 - p], out, k, mines);
  }
  return out;
}

const sigmoid = x => 1 / (1 + Math.exp(-x));

export function newNet(kind, hidden, rng) {
  const n = INPUTS[kind];
  const r = () => (rng() - 0.5) * 0.2;
  return {
    kind, n, hidden,
    w1: Float64Array.from({ length: hidden * n }, r),
    b1: Float64Array.from({ length: hidden }, r),
    w2: Float64Array.from({ length: hidden }, r),
    b2: 0,
    games: 0,
  };
}

// Eteenpäin: palauttaa todennäköisyyden ja piilokerroksen aktivaatiot gradienttia varten.
export function forward(net, x, h = new Float64Array(net.hidden)) {
  const { n, hidden, w1, b1, w2 } = net;
  let o = net.b2;
  for (let j = 0; j < hidden; j++) {
    let z = b1[j];
    const base = j * n;
    for (let i = 0; i < n; i++) if (x[i] !== 0) z += w1[base + i] * x[i];
    h[j] = sigmoid(z);
    o += w2[j] * h[j];
  }
  return { y: sigmoid(o), h };
}

export function value(net, s, p) {
  return forward(net, encode(s, p, net.kind)).y;
}

export function toJSON(net) {
  return JSON.stringify({ ...net, w1: [...net.w1], b1: [...net.b1], w2: [...net.w2] });
}

export function fromJSON(text) {
  const o = JSON.parse(text);
  return { ...o, w1: Float64Array.from(o.w1), b1: Float64Array.from(o.b1), w2: Float64Array.from(o.w2) };
}

// n-ply-arviot (gnubg:n nimitys): p on juuri siirtänyt asemaan s. Vastustaja heittää kaikki 21
// heittoa ja valitsee siirtonsa verkon 0-ply-arviolla, minkä jälkeen syntynyt asema arvioidaan
// (n−1)-ply:llä. Tämä on gnubg:n siirtosuodatin yhdellä ehdokkaalla. Jokainen taso on noin 20
// kertaa edellistä hitaampi.
// Vastustajan 0-ply-valinta heitolla: arvo ja asema.
function bestReply(net, s, q, a, b) {
  let best = -1, bestS = null;
  for (const pl of legalPlays(s, q, a, b)) {
    const v = exited(pl.s[q]) ? 0 : value(net, pl.s, q);
    if (v > best) { best = v; bestS = pl.s; }
  }
  return [best, bestS];
}

// Palauttaa P(p voittaa).
export function onePly(net, s, p) {
  const q = 1 - p;
  let sum = 0;
  for (const [a, b, w] of ROLLS) sum += w * (1 - bestReply(net, s, q, a, b)[0]);
  return sum / 36;
}

export function twoPly(net, s, p) {
  const q = 1 - p;
  let sum = 0;
  for (const [a, b, w] of ROLLS) {
    const bestS = bestReply(net, s, q, a, b)[1];
    sum += w * (exited(bestS[q]) ? 1 : 1 - onePly(net, bestS, q));
  }
  return sum / 36;
}

export function threePly(net, s, p) {
  const q = 1 - p;
  let sum = 0;
  for (const [a, b, w] of ROLLS) {
    const bestS = bestReply(net, s, q, a, b)[1];
    sum += w * (exited(bestS[q]) ? 1 : 1 - twoPly(net, bestS, q));
  }
  return sum / 36;
}

export const PLY = { 1: onePly, 2: twoPly, 3: threePly };

// Verkkobotti valitsee siirron, jonka jälkeinen asema on verkon mukaan sille paras. ply 0 arvioi
// jokaisen siirron kerran. ply ≥ 1 arvioi n-ply-haulla vain 0-ply-arvion parhaat `keep` siirtoa
// (gnubg:n siirtosuodatin). Oletus ply 0 on sama botti kuin ennen.
export function netBot(net, ply = 0, keep = 5) {
  return (s, p, d1, d2, rng) => {
    let plays = legalPlays(s, p, d1, d2);
    const v0 = pl => (exited(pl.s[p]) ? 0 : value(net, pl.s, p));
    let score = v0;
    if (ply > 0) {
      const scored = plays.map(pl => [v0(pl), pl]).sort((x, y) => y[0] - x[0]);
      plays = scored.slice(0, keep).map(([, pl]) => pl);
      score = pl => (exited(pl.s[p]) ? 0 : PLY[ply](net, pl.s, p));
    }
    let best = -1, bests = [];
    for (const pl of plays) {
      const v = score(pl);
      if (v > best + 1e-12) { best = v; bests = [pl]; } else if (Math.abs(v - best) <= 1e-12) bests.push(pl);
    }
    return bests[Math.floor(rng() * bests.length)];
  };
}

// Verkon kuutiopäätökset: vuorossa olevan p voittotodennäköisyys on 1 − vastustajan arvio
// asemasta, jonka vastustaja on juuri jättänyt.
export function netCube(net) {
  const winProb = (s, p) => 1 - value(net, s, 1 - p);
  return {
    winProb,
    double: (s, p, cube) => mayDouble(cube, p) && winProb(s, p) >= DOUBLE_POINT,
    take: (s, q) => 1 - winProb(s, 1 - q) >= TAKE_POINT,
  };
}
