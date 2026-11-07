// Tasapelitarjous (Kaanon/Anti-Backgammon §2.8): jumin tunnistus, kalibroitu equity ja botin
// päätös. Laudan botti ja bottien keskinäinen opetus käyttävät samaa sääntöä.
//
// Peli on jumissa, kun jompikumpi ehto täyttyy:
// (a) kummankin pip-lukujen summa ei ole laskenut 100 rivissä
// (b) botin arvio on pysynyt 50 riviä välillä 35–65 %.
// Ehto (a) tarkistetaan jokaisen vuoron alussa kuten tyokalut/jumi-analyysi.mjs (progressFired).
// Ehdon (b) sarjassa on yksi arvio riviä kohden, pelaajan 0 vuoron alussa hänen näkökulmastaan,
// kuten tyokalut/jumi-tunnistimet.mjs. Rivi on kaksi puolisiirtoa.

import { pips, DRAW_ROWS } from './engine.mjs';

export const STALL_ROWS = 100;
export const BAND_ROWS = 50;
export const BAND_LO = 0.35, BAND_HI = 0.65;
// Sietoraja kuution yksikköinä (Tommi 3.11.2026): sen verran equityä botti saa luovuttaa
// lyhyemmän pelin hinnaksi. Kuution arvo kertoo sekä equityn että rajan, joten vertailu
// tehdään yksikköinä.
export const TOLERANCE = 0.02;

const rowOf = half => Math.floor(half / 2);

export const newStall = () => ({ turns: [], series: [] });

// Vuoron alussa: half on pelattujen puolisiirtojen määrä, p vuorossa oleva ja w0 pelaajan 0
// arvio hänen näkökulmastaan. w0 tarvitaan vain pelaajan 0 vuorolla.
export function observe(st, half, s, p, w0) {
  st.turns.push([half, pips(s[0]) + pips(s[1])]);
  if (p === 0) st.series[rowOf(half)] = w0;
}

// Onko peli jumissa viimeksi kirjatun vuoron alussa. Mittaukset voivat kiristää ehtoa
// (tyokalut/tarjous-hyoty.mjs): stallRows on ehdon (a) ikkuna, bandRows ehdon (b) ikkuna ja
// minRow rivi, jota ennen jumia ei tunnisteta. Oletus on kaanonin ehto.
export function stuck(st, { stallRows = STALL_ROWS, bandRows = BAND_ROWS, minRow = 0 } = {}) {
  const t = st.turns;
  if (!t.length) return false;
  const [half, sum] = t[t.length - 1];
  if (rowOf(half) < minRow) return false;
  // (a) Viimeisin vuoro, joka on vähintään stallRows riviä aiemmin.
  for (let j = t.length - 2; j >= 0; j--) {
    if (half - t[j][0] >= 2 * stallRows) {
      if (sum >= t[j][1]) return true;
      break;
    }
  }
  // (b) Ikkunan rivit r − bandRows + 1 … r. Sarjasta voi puuttua rivejä, joten puolet riittää.
  const r = rowOf(half);
  if (r < bandRows - 1) return false;
  let n = 0;
  for (let i = r - bandRows + 1; i <= r; i++) {
    const w = st.series[i];
    if (w === undefined) continue;
    if (w < BAND_LO || w > BAND_HI) return false;
    n++;
  }
  return n >= bandRows / 2;
}

// Toteutunut equity vuorossa olevan näkökulmasta (poistuminen ensin −1, vastustaja ensin +1,
// tasapeli 0) arvion ja jäljellä olevien rivien mukaan. Lähde tulokset/jumi-jatko-raw-g4-p3000.txt
// (ehto eteneminen:100, 15 000 itsepeliä). Pisteet ovat lokeron keskimääräinen arvio ja equity.
// Lokeroiden välillä interpoloidaan suoraan ja ääripäiden ulkopuolella käytetään ääripäätä.
// Kaistat vaihtuvat porrastetusti, kuten kaanonin hyväksymisrajat on kuvattu. Yli 200 jäljellä
// olevaa riviä ei mitattu, koska etenemisehto laukeaa aikaisintaan rivillä 100, joten niille
// käytetään kaistaa 101–200 (Kaanon §2.8).
const CALIBRATION = [
  { maxLeft: 50, pts: [[0.035, -0.303], [0.157, -0.177], [0.250, -0.082], [0.351, -0.020], [0.449, -0.020], [0.550, 0.019], [0.648, 0.019], [0.748, 0.080], [0.840, 0.171], [0.963, 0.309]] },
  { maxLeft: 100, pts: [[0.035, -0.825], [0.156, -0.595], [0.251, -0.366], [0.351, -0.209], [0.449, -0.110], [0.552, 0.104], [0.649, 0.202], [0.748, 0.372], [0.844, 0.579], [0.965, 0.825]] },
  { maxLeft: Infinity, pts: [[0.033, -0.982], [0.155, -0.768], [0.252, -0.518], [0.349, -0.341], [0.449, -0.127], [0.550, 0.115], [0.651, 0.329], [0.747, 0.519], [0.844, 0.761], [0.967, 0.982]] },
];

export const rowsLeft = half => DRAW_ROWS - rowOf(half);

// w on vuorossa olevan arvio, left jäljellä olevat rivit.
export function calibratedEquity(w, left) {
  const { pts } = CALIBRATION.find(b => left <= b.maxLeft);
  if (w <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    if (w <= x1) {
      const [x0, y0] = pts[i - 1];
      return y0 + (y1 - y0) * (w - x0) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
}

// Botin päätökset. w on aina vuorossa olevan eli tarjoajan arvio vuoron alussa, koska taulukko
// on mitattu siitä näkökulmasta. Tarjoaja tarjoaa vain jumissa. Vastaanottajan equity on
// tarjoajan equity vastaluvulla.
export const botOffers = (w, half, isStuck) => isStuck && calibratedEquity(w, rowsLeft(half)) <= TOLERANCE;
export const botAccepts = (w, half) => -calibratedEquity(w, rowsLeft(half)) <= TOLERANCE;
