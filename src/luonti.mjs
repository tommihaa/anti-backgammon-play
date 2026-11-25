// Aseman luonti analysoitavaksi (Tommin tilaus ja valinnat 25.11.2026). Luonti alkaa tyhjästä
// laudasta, ja nappulat asetetaan klikkaamalla. Klikkauskohdan korkeus kertoo pisteen nappulamäärän
// kuten XG:ssä ja gnubg:ssä, ja värivalitsin kertoo kumman nappuloita asetetaan. Vuoro, heitto,
// kuutio ja ottelun tilanne asetetaan lomakkeelta. Valmis asema avautuu analyysiin aseman linkkinä
// (src/tuonti.mjs linkFragment), joten selaus, Arvio-paneeli ja Jatka tästä toimivat kuten linkissä.
//
// Asema on [oma, botti] kummankin omassa numeroinnissa kuten moottorissa. Piste annetaan oman
// numeroinnin mukaan (1–24), joten botin nappulat ovat sen indeksissä 25 − piste.

import { BAR, OFF } from './engine.mjs';
import { linkFragment } from './tuonti.mjs';

// Pisteelle mahtuu näkyviin viisi nappulaa ja muurille kolme (src/ui.mjs stack ja barStack).
export const SLOTS_POINT = 5, SLOTS_BAR = 3;

export function emptyPosition() {
  const s = [new Int8Array(26), new Int8Array(26)];
  s[0][OFF] = s[1][OFF] = 15;
  return s;
}

const onBoard = side => 15 - side[OFF];

// Klikkaus pisteen tai muurin kohtaan slot (1 tyvestä alkaen) pelaajan p värillä. Klikkaus ylimpään
// nappulaan poistaa sen, ja ylimmän näkyvän paikan klikkaus täydellä pinolla lisää yhden. Muuten
// pisteelle tulee slot nappulaa. Määrä rajataan lokerossa jäljellä oleviin. Pisteeltä väistyy toisen
// pelaajan pino. Muuttaa asemaa s ja palauttaa sen.
export function placeCheckers(s, p, spot, slot) {
  const bar = spot === BAR;
  const top = bar ? SLOTS_BAR : SLOTS_POINT;
  const k = Math.max(1, Math.min(top, slot));
  const idx = bar || p === 0 ? spot : 25 - spot;
  const me = s[p];
  const cur = me[idx];
  let n = k === top && cur >= top ? cur + 1 : k === cur ? k - 1 : k;
  n = Math.min(n, me[OFF] + cur);
  me[OFF] += cur - n;
  me[idx] = n;
  if (!bar && n > 0) {
    const other = s[1 - p], j = 25 - idx;
    other[OFF] += other[j];
    other[j] = 0;
  }
  return s;
}

export function clearPosition(s) {
  for (const side of s) { side.fill(0); side[OFF] = 15; }
  return s;
}

// Luodun aseman virhe tai null: 'empty', kun jommaltakummalta puuttuvat laudan nappulat (aseman
// linkki ei kelpuuta sitä, koska pelaaja on silloin jo poistunut pelistä), ja 'score', kun
// rangaistuspisteet eivät jää ottelun pituuden alle.
export function positionError(x) {
  if (!onBoard(x.s[0]) || !onBoard(x.s[1])) return 'empty';
  if (x.limit > 0 && x.pen.some(v => v >= x.limit)) return 'score';
  return null;
}

// Yhden pisteen ottelu on DMP ilman kuutiota kuten pelissä (Tommin kuittaus 25.11.2026).
export const isDmp = x => x.limit === 1;

// Crawford-peli on mahdollinen vain DMP:tä pidemmässä ottelussa, jossa jompikumpi on pisteen
// päässä rajasta.
export const crawfordPossible = x => x.limit > 1 && x.pen.some(v => v === x.limit - 1);

// Kuutioton asema: DMP tai Crawford-peli.
export const cubeless = x => isDmp(x) || (x.crawford && crawfordPossible(x));

// Luodun aseman linkin fragmentti. Kuutio arvolla 1 on aina keskellä, ja DMP:ssä ja
// Crawford-pelissä kuutiota ei ole.
export function createdFragment(x) {
  const cube = x.cube.value === 1 || cubeless(x) ? { value: 1, owner: -1 } : x.cube;
  return linkFragment({ ...x, cube, crawford: x.crawford && crawfordPossible(x) }, null, null);
}
