// Analyysitiedosto (Tommin tilaus 16.11.2026): HTML-viennin rinnalla tiedosto, jonka lauta ja
// moottori lukevat ja kirjoittavat, jotta tehty analyysi ja myöhemmin rolloutit kulkevat
// jälkianalyysiin ilman uudelleenlaskentaa. Muoto on JSON, ja kenttä format tunnistaa sen.
//
// {
//   format: 'anti-backgammon-analysis', version: 1, created: ISO-aika, net: verkon tiedosto,
//   source: 'import' | 'played',
//   match:  (import) { text: ottelun alkuperäinen teksti (.mat tai .sgf), h: valittu pelaaja,
//           kind: 'money' | 'dmp' | 'match' },
//   analysis: (import) { '<peli>:<teko>': tulos }, teko on toiminnon indeksi tuonti.mjs:n
//           g.actions-taulukossa. Siirron tulos on { r: { best, played, top }, ply } tai
//           { forced: true }, jossa best ja played ovat siirtäjän P(voitto) ja top kolme parasta
//           siirtoa ({ m: merkintä, loss, x }). Lisäksi luck (heiton onni) ja kuutiopäätöksen
//           { w, should }. Tulokset koskevat siirtäjää eivätkä riipu valitusta pelaajasta.
//   game:   (played) laudalla pelatun pelin tallenne sellaisenaan (src/ui.mjs record), jossa
//           päätöksillä on asemat mukana, koska pelistä ei ole ottelutekstiä.
//   rollouts: { avain: rollout }, avain on sama kuin analysis-kentässä (played-tiedostossa
//           päätöksen indeksi). Lauta säilyttää kentän tuonnista vientiin muuttamatta.
// }
//
// Rollout (määritelty 16.11.2026 Tommin kuittauksella, mallina gnubg:n SGF, joka tallentaa
// tuloksen rinnalle sen asetukset, jotta luvun voi toistaa ja verrata):
//
// {
//   kind: 'move' | 'cube',
//   settings: { net: verkon tiedosto, ply: rolloutin pelaajan hakusyvyys, games: pelejä per
//           vaihtoehto, seed: siemen, truncation: katkaisu puolisiirtoina tai null (pelataan
//           loppuun), crn: true jos vaihtoehdot käyttävät samoja satunnaislukuja (yhteiset
//           satunnaisluvut, tyokalut/rollout.mjs) },
//   plays: (move) [{ m: siirron merkintä kuten top-listassa, w: P(voitto), se: w:n keskivirhe,
//           d: ero parhaaseen P(voitto)-yksikköinä, dse: d:n keskivirhe }], paras ensin. Parhaalla
//           d = 0 ja dse = 0. Pelattu siirto on mukana, vaikka se ei olisi parhaiden joukossa.
//   played: (move) pelatun siirron merkintä,
//   position: (cube) { w, se }, päätöksen tekijän P(voitto) ennen päätöstä.
// }
//
// P(voitto) on siirron tai päätöksen tekijän, ja tasapeli (sääntö 2.7) on puoli voittoa, kuten
// tyokalut/rollout.mjs:ssä. Equity on 2 × w − 1, ja ero equityinä 2 × d. Anti-pelissä ei ole
// gammoneja, joten jakaumaa ei tarvita. Kuutiollinen rollout puuttuu, joten kuutiopäätöksestä
// on vain aseman voittotodennäköisyys. Virheellinen rollout jätetään pois jäsennettäessä.

export const FORMAT = 'anti-backgammon-analysis';
export const VERSION = 1;
// Pääte .abg (Tommin valinta 16.11.2026). Sisältö on JSON, ja tuonti tunnistaa tiedoston
// format-kentästä eikä päätteestä.
export const EXT = '.abg';

export function buildAnalysisFile({ net, match, analysis, game, rollouts, created = new Date() }) {
  const base = { format: FORMAT, version: VERSION, created: created.toISOString(), net };
  const tail = { rollouts: rollouts ?? {} };
  if (match) return { ...base, source: 'import', match, analysis: analysis ?? {}, ...tail };
  return { ...base, source: 'played', game, ...tail };
}

// Palauttaa tiedoston olion tai null, jos teksti ei ole analyysitiedosto. Uudempi versio kuin
// VERSION hylätään, koska sen kenttiä ei tunneta.
export function parseAnalysisFile(text) {
  let o;
  try { o = JSON.parse(String(text).replace(/^﻿/, '')); } catch { return null; }
  if (!o || o.format !== FORMAT || !(o.version >= 1 && o.version <= VERSION)) return null;
  const ok = (o.source === 'import' && typeof o.match?.text === 'string')
    || (o.source === 'played' && Array.isArray(o.game?.decisions));
  if (!ok) return null;
  const rollouts = Object.fromEntries(Object.entries(o.rollouts ?? {}).filter(([, r]) => validRollout(r)));
  return o.source === 'import' ? { analysis: {}, ...o, rollouts } : { ...o, rollouts };
}

const num = x => typeof x === 'number' && Number.isFinite(x);
const prob = x => num(x) && x >= 0 && x <= 1;
export function validRollout(r) {
  const st = r?.settings;
  if (!st || typeof st.net !== 'string' || !Number.isInteger(st.ply) || !(Number.isInteger(st.games) && st.games > 0)
    || !num(st.seed) || !(st.truncation === null || Number.isInteger(st.truncation)) || typeof st.crn !== 'boolean') return false;
  if (r.kind === 'cube') return prob(r.position?.w) && num(r.position?.se);
  if (r.kind !== 'move' || typeof r.played !== 'string' || !Array.isArray(r.plays) || !r.plays.length) return false;
  return r.plays.every(p => typeof p.m === 'string' && prob(p.w) && num(p.se) && num(p.d) && num(p.dse))
    && r.plays.some(p => p.m === r.played);
}
