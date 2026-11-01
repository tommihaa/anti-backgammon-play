// Tuplauskuutio (Kaanon/Anti-Backgammon §2.4). Kuutio aloittaa keskeltä arvolla 1 ilman omistajaa.
// Tuplaa se, joka uskoo vastustajan joutuvan ulos ensin. Ottaja saa kuution omistukseensa
// kaksinkertaisella arvolla. Luopuja saa kuution nykyarvon verran rangaistuspisteitä.
//
// "Voitto" tarkoittaa tässä, että vastustaja joutuu ulos ensin. Gammoneja ei ole (§2.3).
// Kuolleella kuutiolla ottoraja olisi backgammonin rahapelin 25 %: voittotodennäköisyydellä 1/4
// ottaminen maksaa odotusarvoltaan 2 × 3/4 − 2 × 1/4 = 1 pistettä, saman kuin luopuminen.
// Elävä kuutio on ottajalle lisäarvo, joten raja on alempana.
//
// Rajat on mitattu 27.10.2026 periaateverkkojen itsepelillä (Kaanon/Anti-Backgammon §4,
// tyokalut/tuplausraja.mjs). Pari 75 % ja 20 % voitti aiemman oletusparin 70 % ja 25 %
// kaikilla kolmella verkolla. Ilman gammoneja "liian hyvää tuplattavaksi" ei ole, joten
// tuplauksella on vain alaraja.
export const TAKE_POINT = 0.2;
export const DOUBLE_POINT = 0.75;

// Arvion muunnos voittotodennäköisyydeksi: P(vuorossa oleva voittaa) = σ(a · arvio + b).
// Kertoimet on sovitettu botin omista keskinäisistä peleistä (src/kalibroi.mjs).
// Vakio b on negatiivinen kaikilla boteilla: tasaisessa asemassa vuoro on haitta, koska
// vuorossa olevan on pakko liikkua. Sovitukset ja kalibrointitaulukot: tulokset/kalibrointi.txt.
export const FITS = {
  syvyys1: { a: 0.0816, b: -0.405 },
  syvyys2: { a: 0.0262, b: -0.196 },
  hautaussakko: { a: 0.0204, b: -0.162 },
};
FITS.oletus = FITS.syvyys2;

export const newCube = () => ({ value: 1, owner: -1 });
// Kuution arvon katto (Kaanon §2.4): arvosta CUBE_MAX ei voi enää tuplata.
export const CUBE_MAX = 64;
export const mayDouble = (cube, p) => cube.value < CUBE_MAX && (cube.owner === -1 || cube.owner === p);

const sigmoid = x => 1 / (1 + Math.exp(-x));

// Kuutiopäätökset arviolla ev. Molemmat päätökset tehdään ennen tuplaajan heittoa.
export function cubePolicy(ev, fit = FITS.oletus) {
  // Todennäköisyys, että vuorossa oleva p voittaa.
  const winProb = (s, p) => sigmoid(fit.a * ev(s, p) + fit.b);
  return {
    winProb,
    double: (s, p, cube) => mayDouble(cube, p) && winProb(s, p) >= DOUBLE_POINT,
    // Ottaja q arvioi aseman, jossa tuplaaja 1 − q on vuorossa.
    take: (s, q) => 1 - winProb(s, 1 - q) >= TAKE_POINT,
  };
}

// Kuutiollinen arvio Janowskin mallilla, kuten bgsagen cpp/src/cube.cpp (cl2cf_money).
// Vuorossa olevan odotusarvo kuution yksikköä kohden on kuolleen ja elävän kuution arvon
// painotettu keskiarvo, ja paino x on kuution tehokkuus. Ilman gammoneja W = L = 1, joten elävän
// kuution ottoraja on (L − 0,5) / (W + L + 0,5) = 0,2 ja luovutusraja 0,8.
const LIVE_TP = 0.2, LIVE_CP = 0.8;

// w on vuorossa olevan voittotodennäköisyys, owner 'keski', 'oma' tai 'vast'.
export function cubefulEquity(w, owner, x) {
  const dead = 2 * w - 1;
  let live;
  if (owner === 'keski') {
    live = w < LIVE_TP ? -1 : w < LIVE_CP ? -1 + 2 * (w - LIVE_TP) / (LIVE_CP - LIVE_TP) : 1;
  } else if (owner === 'oma') {
    live = w < LIVE_CP ? -1 + 2 * w / LIVE_CP : 1;
  } else {
    live = w < LIVE_TP ? -1 : -1 + 2 * (w - LIVE_TP) / (1 - LIVE_TP);
  }
  return (1 - x) * dead + x * live;
}

// Tuplauspäätöksen kolme vaihtoehtoa tuplaajan näkökulmasta kuution nykyarvon yksikköinä:
// ei tuplausta, tuplaus ja otto sekä tuplaus ja luopuminen. Kun tuplaus nostaa kuution
// kattoon, sitä ei voi enää tuplata, joten kuutio on kuollut (x = 0).
export function cubeOptions(w, cube, p, x) {
  const owner = cube.owner === -1 ? 'keski' : cube.owner === p ? 'oma' : 'vast';
  const xAfter = 2 * cube.value >= CUBE_MAX ? 0 : x;
  return {
    nd: cubefulEquity(w, owner, x),
    dt: 2 * cubefulEquity(w, 'vast', xAfter),
    dp: 1,
  };
}

// Kuutiopäätökset Janowskin mallilla. winProb on sama kuin kiinteiden rajojen politiikoissa.
export function janowskiPolicy(winProb, x) {
  return {
    winProb,
    double: (s, p, cube) => {
      if (!mayDouble(cube, p)) return false;
      const o = cubeOptions(winProb(s, p), cube, p, x);
      // Tasatilanteessa tuplataan: täysin elävällä kuutiolla (x = 1) tuplaus ja tuplaamatta
      // jättäminen ovat luovutusrajan yläpuolella yhtä arvokkaita, ja tuplaus lopettaa pelin.
      return Math.min(o.dt, o.dp) >= o.nd;
    },
    // Ottaja q ottaa, jos otto maksaa vähemmän kuin luopuminen. Vertailu on kuution yksiköissä,
    // ja kuution arvo vaikuttaa vain siihen, nouseeko kuutio kattoon. Tuplaajan omistus ennen
    // tuplausta ei vaikuta ottoon.
    take: (s, q, cube = newCube()) => {
      const o = cubeOptions(winProb(s, 1 - q), cube, 1 - q, x);
      return o.dt <= o.dp;
    },
  };
}

// Ottelun raja (Kaanon §2.5): rajan saavuttaja häviää ottelun.
export const MATCH_LIMIT = 7;

// Kuutiopäätökset ottelussa (Kaanon §2.5 ja §2.6). away[p] on pelaajan p etäisyys rajasta
// eli kuinka monta rangaistuspistettä häneltä vielä puuttuu. Rahapelin politiikkaa korjataan
// neljässä tilanteessa, joissa ottelutilanne ratkaisee päätöksen yksin. Ne ovat päättelyä eikä
// mittausta.
export function matchPolicy(policy, { away, crawford }) {
  return {
    ...policy,
    double: (s, p, cube) => {
      // Crawford-pelissä ei ole kuutiota.
      if (crawford || !mayDouble(cube, p)) return false;
      // Vastustaja häviää ottelun jo nykyisellä arvolla, joten tuplaus antaisi vain kuution hänelle.
      if (away[1 - p] <= cube.value) return false;
      // Rajasta yhden pisteen päässä mikä tahansa tappio päättää ottelun, joten tuplaus ei maksa mitään.
      if (away[p] === 1) return true;
      return policy.double(s, p, cube);
    },
    // Jos luopuminen veisi rajalle, se häviää ottelun varmasti, joten ottaminen on aina parempi.
    take: (s, q, cube) => cube.value >= away[q] || policy.take(s, q, cube),
  };
}

// Ottelun voittotaulukko pelin alusta ennen Crawford-peliä, kun kumpikin on vähintään kahden
// pisteen päässä rajasta (Kaanon §4, tulokset/ottelu-voittotaulukko.txt, 12 000 periaateverkon
// itsepeliottelua ottelukorjauksilla). MET_PRE[a][b] on todennäköisyys, että a:n päässä oleva
// voittaa b:n päässä olevan. Indeksit 0 ja 1 ovat tyhjiä.
const MET_PRE = [
  [], [],
  [, , 0.50, 0.37, 0.29, 0.21, 0.16, 0.11],
  [, , 0.63, 0.50, 0.40, 0.31, 0.24, 0.21],
  [, , 0.71, 0.60, 0.50, 0.40, 0.34, 0.26],
  [, , 0.79, 0.69, 0.60, 0.50, 0.43, 0.35],
  [, , 0.84, 0.76, 0.66, 0.57, 0.50, 0.42],
  [, , 0.89, 0.79, 0.74, 0.65, 0.58, 0.50],
];

// Crawford-pelin jälkeen rajasta yhden pisteen päässä oleva tuplaa heti, ja vastustaja
// valitsee oton (peli arvolla 2) ja luopumisen (1 piste itselle) väliltä. Solut lasketaan
// tasavahvoilla pelaajilla eikä mitata, koska mitatut solut ovat harvinaisia ja kohinaisia (§4).
function postCrawford(b) {
  if (b <= 0) return 1;
  if (b === 1) return 0.5;
  return Math.min(postCrawford(b - 1), 0.5 * postCrawford(b - 2));
}

// Ottelun voittotodennäköisyys seuraavan pelin alussa pelaajalle, joka on a:n päässä rajasta
// vastustajan ollessa b:n päässä. post kertoo, onko Crawford-peli jo pelattu.
export function matchEquity(a, b, post, limit = MATCH_LIMIT) {
  if (a <= 0) return 0;
  if (b <= 0) return 1;
  if (a === 1 && b === 1) return 0.5;
  if (a === 1) return post ? postCrawford(b) : 0.5 * postCrawford(b - 1);
  if (b === 1) return 1 - matchEquity(b, a, post, limit);
  if (limit !== 7) throw new Error('voittotaulukko on mitattu vain rajalle 7');
  return MET_PRE[a][b];
}

// Ottajan ottoraja, kun tuplaaja (away aD) tuplaa ottajalle (away aT) arvoon v. Kuolleella
// kuutiolla raja on (luopumisen − tappion arvo) / (voiton − tappion arvo) ottelun
// voittotodennäköisyyksinä. Elävällä kuutiolla ottaja omistaa kuution ja kotiuttaa voittonsa
// tuplaamalla takaisin, kun hänen voittotodennäköisyytensä saavuttaa kotiutusrajan
// c = 1 − (tuplaajan ottoraja arvossa 2v). Jos ottajan arvo on lineaarinen voittotodennäköisyyden
// suhteen (jatkuvan pelin malli, kuten Janowskin x = 1), raja on c kertaa kuolleen kuution raja.
// Rahapelissä tämä antaa 0,25 × 0,8 = 0,2, kuten mitattu ottoraja.
export function takePoint(aD, aT, v, post) {
  // Arvot tuplaajan näkökulmasta.
  const E = x => matchEquity(aD, aT - x, post);
  const L = x => matchEquity(aD - x, aT, post);
  const span = E(v) - L(v);
  if (span <= 0) return 0;
  const dead = (E(v) - E(v / 2)) / span;
  // Takaisintuplaus on hyödytön, kun kuutio on katossa tai tuplaaja häviää ottelun jo arvolla v.
  const live = v >= CUBE_MAX || aD <= v ? 1 : 1 - takePoint(aT, aD, 2 * v, post);
  return Math.min(1, Math.max(0, dead * live));
}

// Kuutiopäätökset ottelussa voittotaulukolla. Ottaja ottaa ottorajasta ylöspäin. Tuplaaja tuplaa
// samassa suhteessa kotiutusrajaan kuin rahapelin mitatut rajat: rahapelissä tuplausraja 0,75
// on 0,9375 kertaa kotiutusraja 0,8. Tuplauksen kannattaa olla vähän ennen kotiutusrajaa, koska
// heitto voi viedä aseman rajan yli. Crawford-pelin ja tuplaamisen hyödyttömyyden säännöt ovat
// samat kuin matchPolicyssa, ja ilmainen tuplaus (tappio arvolla v häviää ottelun jo) yleistää
// sen säännön, että rajasta yhden pisteen päässä tuplataan heti.
const DOUBLE_RATIO = DOUBLE_POINT / (1 - TAKE_POINT);

export function tablePolicy(policy, { away, crawford }) {
  const post = !crawford && away.some(a => a === 1);
  return {
    ...policy,
    double: (s, p, cube) => {
      if (crawford || !mayDouble(cube, p)) return false;
      const v = cube.value;
      if (away[1 - p] <= v) return false;
      if (away[p] <= v) return true;
      const cash = 1 - takePoint(away[p], away[1 - p], 2 * v, post);
      return policy.winProb(s, p) >= DOUBLE_RATIO * cash;
    },
    take: (s, q, cube) => 1 - policy.winProb(s, 1 - q) >= takePoint(away[1 - q], away[q], 2 * cube.value, post),
  };
}
