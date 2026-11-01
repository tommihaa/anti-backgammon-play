// Botin siirtohaku ja siirtojen analyysi omassa säikeessään (Web Worker), jotta 1- ja 2-ply
// eivät jäädytä sivua. 2-ply vie selaimessa sekunteja per siirto. Sivu lähettää ensin verkon
// tekstinä ja sitten kunkin pyynnön tunnisteella. Vastaus palaa samalla tunnisteella.
// Pyynnöt käsitellään saapumisjärjestyksessä.

import { fromJSON, netBot } from './verkko.mjs';
import { rankPlays } from './analyysi.mjs';

let net = null;
const bots = {};

self.onmessage = ({ data }) => {
  if (data.net) { net = fromJSON(data.net); return; }
  const { id, s, p, d1, d2, ply } = data;
  if (data.kind === 'analyse') {
    postMessage({ id, result: rankPlays(net, s, p, d1, d2, data.played, ply) });
    return;
  }
  bots[ply] ??= netBot(net, ply);
  postMessage({ id, result: bots[ply](s, p, d1, d2, Math.random) });
};
