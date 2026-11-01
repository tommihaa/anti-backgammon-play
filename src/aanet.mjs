// Pelin äänet DG Androidista (app/.../ui/WoodSounds.kt, tiedostot app/src/main/res/raw/):
// kolahdus puuhun nopan laskeutuessa, nappulan siirtyessä ja kuutiota käsiteltäessä,
// kaksoiskolahdus ohi-napautuksesta pisteeseen jolta ei voi siirtää (vain painetun pisteen
// kytkimen kanssa) ja gongi seuraavan pelin alkaessa. Äänet on syntetisoitu DG Androidin
// skriptillä tyokalut/puuaanet.py, joten lisenssiä ei ole.
//
// Kytkin on oletuksena pois. Kunkin äänen voi jättää pois erikseen, kuten DG Androidissa.
// Peruminen on hiljainen. Ääni soi alle täyden voimakkuuden, koska se on taustaa.

export const SOUNDS = {
  dice: 'aanet/wood_dice.wav',
  checker: 'aanet/wood_checker.wav',
  cube: 'aanet/wood_cube.wav',
  miss: 'aanet/wood_miss.wav',
  gong: 'aanet/match_gong.ogg',
};
const VOLUME = 0.7;

const cache = {};
export function playSound(name) {
  try {
    const base = cache[name] ??= new Audio(SOUNDS[name]);
    // Kopio, jotta peräkkäiset kolahdukset voivat soida päällekkäin.
    const a = base.cloneNode();
    a.volume = VOLUME;
    a.play().catch(() => { /* selain esti äänen ennen ensimmäistä painallusta */ });
  } catch { /* ei ääntä tässä selaimessa */ }
}
