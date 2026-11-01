// Selainlauta: ihminen (pelaaja 0) verkkobottia (pelaaja 1) vastaan kuution kanssa.
// Verkko siirtää ja tekee kuutiopäätökset omalla arviollaan (src/verkko.mjs, Kaanon §4).
// Lauta piirretään ihmisen näkökulmasta: oma piste i, botin nappulat bottipisteessä 25 - i.

import { initialState, legalPlays, pips, exited, clone, OFF, BAR, DRAW_HALF, DRAW_ROWS } from './engine.mjs';
import { fromJSON, netBot, netCube } from './verkko.mjs';
import { newCube, mayDouble, tablePolicy, MATCH_LIMIT } from './kuutio.mjs';
import { T, applyStatic, switchLang } from './kieli.mjs';
import { rankPlays } from './analyysi.mjs';
import { toXGID, fromXGID } from './xgid.mjs';
import { parseMatch, replay } from './tuonti.mjs';
import { SOUNDS, playSound } from './aanet.mjs';
import {
  STYLES, boardLook, panelLook, cubeLook, OUTLINE, NUMBER_INK, PIP_INK, CHECKER_PER_COLUMN, TRAY_PER_COLUMN,
  DICE_PER_CHECKER, CUBE_PER_CHECKER, CHECKERS_APART, BAND_PER_CHECKER, CORNER_PER_SIDE, SPENT_DIE_DIM,
} from './ulkoasu.mjs';

const NS = 'http://www.w3.org/2000/svg';
const $ = id => document.getElementById(id);
const svg = $('board');

// Mitat DG Androidin laudasta (src/ulkoasu.mjs): nappula on 0,70 sarakkeesta, kiilaan mahtuu viisi
// nappulaa, keskikaista on kahden nappulan korkuinen ja lokerosarake 44/35 saraketta. Lauta
// piirretään oikeakätisen suuntaan (kotialue oikealla) ja peilataan X:llä.
const COL = 50, K = COL * CHECKER_PER_COLUMN, R = K / 2;
const PAD = 10, NUM = 22;
const WEDGE = K * CHECKERS_APART, BAND = K * BAND_PER_CHECKER;
const TRAY_W = Math.round(COL * TRAY_PER_COLUMN);
const LEFT = PAD, BAR_X = PAD + 6 * COL, RIGHT = BAR_X + COL, TRAY_X = RIGHT + 6 * COL;
const W = TRAY_X + TRAY_W + PAD;
const TOP = PAD + NUM, BOTTOM = TOP + 2 * WEDGE + BAND, H = BOTTOM + NUM + PAD;
const MID = (TOP + BOTTOM) / 2;
const DIE = K * DICE_PER_CHECKER, CUBE = K * CUBE_PER_CHECKER;

function pointX(i) {
  if (i <= 6) return RIGHT + (6 - i) * COL;
  if (i <= 12) return LEFT + (12 - i) * COL;
  if (i <= 18) return LEFT + (i - 13) * COL;
  return RIGHT + (i - 19) * COL;
}
const isTop = i => i >= 13;
svg.setAttribute('viewBox', `0 0 ${W} ${Math.round(H)}`);

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ei tallennusta */ } },
};

// Ulkoasun asetukset: lautatyyli, kotialue vasemmalla (peilaus) ja pystylauta kapealla ruudulla.
const prefs = {
  style: STYLES.includes(store.get('ab-tyyli', 'x22')) ? store.get('ab-tyyli', 'x22') : 'x22',
  left: store.get('ab-koti-vasen', false) === true,
  portrait: store.get('ab-pysty', false) === true,
};
// Pelaamisen kytkimet DG Androidin Pelaaminen-ryhmästä (docs/ASETUKSET.md luku 3), kaikki
// oletuksena pois (Tommin valinta 1.11.2026). Ahne uloskanto jäi pois, koska tässä pelissä ulos
// ehtiminen on se mitä vältetään.
// Siirron jälkeinen analyysi on oma kytkimensä. Se on oletuksena päällä, koska analyysi oli
// laudalla ennen kytkintä (Tommin tilaus 1.11.2026).
export const PLAY_TOGGLES = ['analysis', 'forced', 'arrows', 'botArrows', 'press', 'diceSubmit', 'diceSwap', 'diceRoll', 'nextOnDice'];
const TOGGLE_DEFAULTS = { analysis: true };
const opts = Object.fromEntries(PLAY_TOGGLES.map(k => [k, TOGGLE_DEFAULTS[k] ?? false]));
{ const saved = store.get('ab-pelaaminen', {}); for (const k of PLAY_TOGGLES) if (typeof saved?.[k] === 'boolean') opts[k] = saved[k]; }
// Botin hakusyvyys: 0-ply on verkon suora arvio, 1- ja 2-ply katsovat vastustajan heitot eteenpäin.
// Pelaaja valitsee, koska syvempi haku vie koneesta riippuen sekunteja (Tommin tilaus 1.11.2026).
export const PLIES = [0, 1, 2];
const savedPly = store.get('ab-syvyys', 0);
let ply = PLIES.includes(savedPly) ? savedPly : 0;
// Pelin äänet (src/aanet.mjs): kytkin oletuksena pois. off luettelee pois jätetyt äänet.
const snd = { on: false, off: [] };
{ const saved = store.get('ab-aanet', {}); snd.on = saved?.on === true; snd.off = Array.isArray(saved?.off) ? saved.off : []; }
const saveSnd = () => store.set('ab-aanet', snd);
// Ohi-napautuksen ääni soi vain painetun pisteen kytkimen kanssa, kuten DG Androidissa.
function sound(name) {
  if (!snd.on || snd.off.includes(name) || (name === 'miss' && !opts.press)) return;
  playSound(name);
}
const darkQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
const isDark = () => darkQuery?.matches ?? false;
// Peilattu x: alkuperäisen laatikon (x, leveys w) vasen reuna peilatulla laudalla.
const X = (x, w = 0) => (prefs.left ? W - x - w : x);

let game;
// Tuodun ottelun selaus (src/tuonti.mjs) tai null. Selauksen ajan game on näyttöolio, jonka vaihe
// on 'review'. Keskeytetty peli odottaa kentässä saved.
let review = null;
// Ottelu rangaistuspisteiden rajaan (Kaanon §2.5). crawford kertoo, onko Crawford-peli jo pelattu.
// limit on ottelun raja tai null, jolloin pelataan rahapeliä ilman rajaa ja Crawford-sääntöä.
// Vanha tallennus ilman rajaa on 7 pisteen ottelu.
export const LIMITS = [1, 3, 5, 7, null];
const match = store.get('ab-ottelu', { pen: [0, 0], crawford: false });
if (match.limit === undefined) match.limit = MATCH_LIMIT;
const pen = match.pen;
const saveMatch = () => store.set('ab-ottelu', match);
const matchOver = () => match.limit !== null && pen.some(x => x >= match.limit);
// Vastustajan verkko. Valinta ja vertailu: Kaanon/Anti-Backgammon §4.
export const NET_FILE = 'verkot/vo3plyop-nolla-s2.json';
const netText = await (await fetch(NET_FILE)).text();
const net = fromJSON(netText);
const botPlay = netBot(net);

// 1- ja 2-ply lasketaan Web Workerissa (src/botti-tyo.mjs), jotta sivu ei jäädy. Jos säiettä ei
// saa, niin haku tehdään sivulla itsellään. 0-ply on niin nopea, että se lasketaan aina sivulla.
// Botti ja analyysi saavat kumpikin oman säikeensä, jotta 2-ply-analyysi ei viivästä botin
// vastausta. Kumpikin vie 2-ply:llä sekunteja.
let reqId = 0;
const waiting = new Map();
function spawn() {
  try {
    const w = new Worker(new URL('./botti-tyo.mjs', import.meta.url), { type: 'module' });
    w.postMessage({ net: netText });
    w.onmessage = ({ data }) => { waiting.get(data.id)?.(data.result); waiting.delete(data.id); };
    return w;
  } catch { return null; }
}
const botWorker = spawn(), analysisWorker = spawn();
function ask(w, msg) {
  const id = ++reqId;
  return new Promise(res => { waiting.set(id, res); w.postMessage({ id, ...msg }); });
}
const deepBots = {};
function botMove(s, d1, d2) {
  if (ply === 0) return Promise.resolve(botPlay(s, 1, d1, d2, Math.random));
  if (!botWorker) { deepBots[ply] ??= netBot(net, ply); return Promise.resolve(deepBots[ply](s, 1, d1, d2, Math.random)); }
  return ask(botWorker, { s, p: 1, d1, d2, ply });
}
// Siirtosi analyysi samalla syvyydellä kuin botti pelaa (src/analyysi.mjs).
function rankMove(base, d1, d2, played) {
  if (ply === 0 || !analysisWorker) return Promise.resolve(rankPlays(net, base, 0, d1, d2, played, ply));
  return ask(analysisWorker, { kind: 'analyse', s: base, p: 0, d1, d2, played, ply });
}
const netPolicy = netCube(net);
let botCube;

const points = n => T.points(n);

function newGame() {
  const first = game === undefined;
  if (matchOver()) { pen[0] = 0; pen[1] = 0; match.crawford = false; }
  // Crawford-peli on ensimmäinen peli sen jälkeen, kun jompikumpi on yhden pisteen päässä rajasta
  // (Kaanon §2.6).
  const limit = match.limit;
  const crawford = limit !== null && !match.crawford && pen.some(x => x === limit - 1);
  if (crawford) match.crawford = true;
  saveMatch();
  // Rahapelissä kuutio käyttää rahapelin rajoja (Kaanon §4), ottelussa voittotaulukkoa.
  botCube = limit === null ? netPolicy : tablePolicy(netPolicy, { away: pen.map(x => limit - x), crawford });
  let a, b;
  do { a = 1 + Math.floor(Math.random() * 6); b = 1 + Math.floor(Math.random() * 6); } while (a === b);
  game = {
    s: initialState(), dice: [a, b], diceOwner: a > b ? 0 : 1, order: [a, b], botUsed: [],
    turn: a > b ? 0 : 1, phase: 'move', cube: newCube(),
    crawford, plays: null, partial: [], partialDice: [], hitsMarks: [], base: null,
    lastBot: [], log: [], moveNo: 0, half: 0, over: false, errors: [], analysed: 0, totalLoss: 0, lastNote: null,
    when: Date.now(), limit: match.limit,
    msg: T.opening(a, b, a > b, crawford),
  };
  if (!first) sound('gong');
  review = null;
  if (game.turn === 0) beginHumanMove(); else later(() => botTurn(true), 600);
  render();
}

// Päättyneet pelit analyyseineen ja siirtoineen (Tommin havainto 1.11.2026: Seuraava peli
// hävitti edellisen pelin analyysin). Talletetaan laitteelle, uusin ensin, enintään PLAYED_MAX.
// Lista näytetään laudan alla omana osionaan.
const PLAYED_MAX = 30;
const played = [store.get('ab-pelatut', [])].flatMap(a => (Array.isArray(a) ? a : []));
let finished = null;
const record = g => ({
  when: g.when, msg: g.msg, limit: g.limit, log: g.log, analysed: g.analysed, totalLoss: g.totalLoss, errors: g.errors,
});
function saveFinished() {
  if (!finished) return;
  const k = played.findIndex(x => x.when === finished.when);
  if (k >= 0) played[k] = record(finished); else played.unshift(record(finished));
  played.length = Math.min(played.length, PLAYED_MAX);
  store.set('ab-pelatut', played);
  fillPlayed();
}
function fillPlayed() {
  const sel = $('played');
  const keep = sel.value;
  sel.textContent = '';
  played.forEach((x, k) => {
    const o = document.createElement('option');
    o.value = String(k);
    o.textContent = T.playedOption(new Date(x.when), x.limit);
    sel.appendChild(o);
  });
  $('playedBox').hidden = played.length === 0;
  sel.value = keep !== '' && played[Number(keep)] ? keep : '0';
  showPlayed();
}
function showPlayed() {
  const x = played[Number($('played').value)];
  const box = $('playedSummary');
  box.textContent = '';
  if (!x) return;
  const p = document.createElement('p');
  p.textContent = x.msg;
  box.appendChild(p);
  renderSummary(box, x);
  const wMe = Math.max(16, ...x.log.map(r => r.me.length)) + 3;
  $('playedLog').textContent = x.log.map(r => `${r.n === '' ? '    ' : `${String(r.n).padStart(3)})`} ${r.me.padEnd(wMe)}${r.bot}`).join('\n');
}
$('played').addEventListener('change', showPlayed);

// Botin viivästetty vuoro kuuluu sille pelille, jossa se ajastettiin. Ilman tätä luovutus ja uusi
// peli ennen ajastimen laukeamista antaisivat uudelle pelille vanhan pelin botin siirron.
function later(fn, ms) {
  const g = game;
  setTimeout(() => { if (game === g) fn(); }, ms);
}

function roll() { return [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]; }

// Osasiirrot kirjoitetaan suurimmasta lähtöpisteestä alkaen kuten backgammonin notaatiossa
// (Tommin pyyntö 1.11.2026), muuri (25) ensin. Ulos pelattu on off.
function notation(d, moves, hits) {
  const parts = moves.map(([f, t], k) => ({ f, t, hit: hits[k] }))
    .sort((a, b) => b.f - a.f || b.t - a.t)
    .map(({ f, t, hit }) => `${f === BAR ? 25 : f}/${t <= 0 ? 'off' : t}${hit ? '*' : ''}`);
  return `${d[0]}${d[1]}: ${parts.join(' ')}`;
}

// Yhden osasiirron soveltaminen, palauttaa lyönnin.
function applyMove(s, p, from, to) {
  const me = s[p], opp = s[1 - p];
  me[from]--;
  if (to <= 0) { me[OFF]++; return false; }
  me[to]++;
  if (opp[25 - to] === 1) { opp[25 - to]--; opp[BAR]++; return true; }
  return false;
}

function beginHumanMove() {
  game.turn = 0;
  game.base = clone(game.s);
  game.plays = withDice(legalPlays(game.s, 0, game.dice[0], game.dice[1], true), game.dice[0], game.dice[1]);
  game.partial = []; game.partialDice = []; game.hitsMarks = [];
  game.diceOwner = 0;
  const [d1, d2] = game.dice;
  game.order = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
  game.phase = 'move';
  if (game.plays.every(p => p.moves.length === 0)) {
    game.phase = 'pass';
    game.msg = T.noLegal(`${game.dice[0]}${game.dice[1]}`);
    return;
  }
  if (opts.forced) placeForced();
}

// Pakolliset osasiirrot: ne jotka ovat mukana jokaisessa laillisessa siirrossa, monijoukkojen
// leikkauksena (DG Androidin CompositionSession.forcedSteps). Ne asetetaan siinä järjestyksessä
// kuin ne ovat tarjolla. Valmis jää pelaajalle.
function placeForced() {
  const count = moves => {
    const m = new Map();
    for (const mv of moves) m.set(String(mv), (m.get(String(mv)) ?? 0) + 1);
    return m;
  };
  const sets = game.plays.map(p => count(p.moves));
  const forced = new Map([...sets[0]].map(([k, n]) => [k, Math.min(...sets.map(m => m.get(k) ?? 0))]).filter(([, n]) => n > 0));
  for (;;) {
    const st = nextSteps().find(x => (forced.get(String(x.m)) ?? 0) > 0);
    if (!st) break;
    forced.set(String(st.m), forced.get(String(st.m)) - 1);
    doMove(st.m[0], st.m[1], st.d, true);
  }
}

// Moottori kirjaa isommalla nopalla ulos pelatun osasiirron kohteeksi 0 (3/off kutosella on
// [3, 0]), joten noppaa ei voi päätellä lähdön ja kohteen erotuksesta. Jokaiselle lailliselle
// siirrolle liitetään siksi sen noppajärjestys. Myös pelatun osasiirron noppa kirjataan
// (Tommin havainto 1.11.2026: 61, ensin 1/off, eikä kutonen pelannut ulos pisteeltä 3).
const fits = ([from, to], d) => from - to === d || (to === 0 && from < d);
function withDice(plays, d1, d2) {
  const seqs = d1 === d2 ? [[d1, d1, d1, d1]] : [[d1, d2], [d2, d1]];
  const out = [];
  for (const pl of plays) {
    for (const seq of seqs) {
      const dice = seq.slice(0, pl.moves.length);
      if (pl.moves.every((m, i) => fits(m, dice[i]))) out.push({ ...pl, dice });
    }
  }
  return out;
}
function candidates() {
  const k = game.partial.length;
  return game.plays.filter(p => p.moves.length >= k
    && game.partial.every((m, j) => p.moves[j][0] === m[0] && p.moves[j][1] === m[1] && p.dice[j] === game.partialDice[j]));
}
// Seuraavat osasiirrot nopan kanssa.
function nextSteps() {
  const k = game.partial.length;
  return candidates().filter(p => p.moves.length > k).map(p => ({ m: p.moves[k], d: p.dice[k] }));
}
function nextMoves() {
  return nextSteps().map(x => x.m);
}
const complete = () => candidates().some(p => p.moves.length === game.partial.length);

// Siirtosarjan nopat näyttöä varten (botin siirto): tarkka noppa ensin, muuten pienin noppa,
// jolla ulos pelaaminen käy.
function diceOf(moves, roll) {
  const left = [...roll];
  return moves.map(m => {
    let k = left.findIndex(d => m[0] - m[1] === d);
    if (k < 0) k = left.reduce((b, d, i) => (fits(m, d) && (b < 0 || d < left[b]) ? i : b), -1);
    return k < 0 ? m[0] - m[1] : left.splice(k, 1)[0];
  });
}

// Käyttämättömät nopat käyttöjärjestyksessä.
function remainingDice() {
  const left = [...game.order];
  for (const d of game.partialDice) left.splice(left.indexOf(d), 1);
  return left;
}

// Nappulan klikkaus siirtää sen ensimmäisen käyttämättömän nopan verran, tai seuraavan, jos
// ensimmäisellä ei jää laillista siirtoa (DG Androidin CompositionSession.step, Tommin valinta
// 1.11.2026).
function clickSpot(spot) {
  if (game.over || game.turn !== 0 || game.phase !== 'move') return;
  const ns = nextSteps();
  for (const d of new Set(remainingDice())) {
    const st = ns.find(x => x.m[0] === spot && x.d === d);
    if (st) { doMove(st.m[0], st.m[1], d); return; }
  }
  const seq = viaBar(spot);
  if (seq) { for (const { m, d } of seq) doMove(m[0], m[1], d); return; }
  if (spot !== BAR) sound('miss');
}

// Kun muurilla on nappula, laudan nappulan klikkaus tuo muurin nappulat ensin sisään ja siirtää
// sitten klikatun nappulan, kuten XG Androidissa (Tommin havainto 1.11.2026: muurilla 51, ja
// klikkaus 11-pisteeseen pelaa 25/20 11/10). Klikattu nappula saa ensimmäisen käyttämättömän
// nopan, jolla sellainen siirto on laillinen. Sisääntulot saavat muut nopat.
function viaBar(spot) {
  if (spot === BAR || game.s[0][BAR] === 0 || game.s[0][spot] === 0) return null;
  const k = game.partial.length;
  const plays = candidates();
  for (const d of new Set(remainingDice())) {
    for (const p of plays) {
      const rest = p.moves.slice(k);
      const j = rest.findIndex((m, i) => m[0] === spot && p.dice[k + i] === d);
      if (j > 0 && rest.slice(0, j).every(m => m[0] === BAR)) return rest.slice(0, j + 1).map((m, i) => ({ m, d: p.dice[k + i] }));
    }
  }
  return null;
}

// Noppien klikkaus vaihtaa käyttöjärjestyksen aina, kun kaksi eri noppaa on käyttämättä.
const swappable = () => game.turn === 0 && game.phase === 'move' && new Set(remainingDice()).size === 2;
// Vuoro on valmis, kun osasiirtoja ei enää ole tai laillisia siirtoja ei ollut lainkaan.
const turnComplete = () => game.turn === 0 && !game.over
  && ((game.phase === 'move' && nextMoves().length === 0) || game.phase === 'pass');
const canSubmitByDice = () => opts.diceSubmit && turnComplete();
const canRollByDice = () => opts.diceRoll && game.phase === 'roll' && game.diceOwner === 1;
// Noppien klikkaus: valmiin vuoron vahvistus, järjestyksen vaihto tai heitto botin nopista.
function clickDice() {
  if (canSubmitByDice()) { if (game.phase === 'pass') pass(); else finishHuman(); return; }
  if (canSwap()) { swapDice(); return; }
  if (canRollByDice()) humanRoll();
}
const canSwap = () => opts.diceSwap && swappable();
function swapDice() {
  if (!swappable()) return;
  game.order.reverse();
  render();
}

// Valmiiksi asetettu siirto (auto) ei päätä peliä itse, vaan Valmis jää pelaajalle.
function doMove(from, to, die, auto = false) {
  game.partial.push([from, to]);
  game.partialDice.push(die);
  game.hitsMarks.push(applyMove(game.s, 0, from, to));
  if (auto) return;
  sound('checker');
  if (exited(game.s[0])) { finishHuman(); return; }
  render();
}

function undo() {
  if (game.turn !== 0 || game.partial.length === 0) return;
  game.partial.pop(); game.partialDice.pop(); game.hitsMarks.pop();
  game.s = clone(game.base);
  for (const [f, t] of game.partial) applyMove(game.s, 0, f, t);
  render();
}

// Siirron analyysi samalla syvyydellä kuin botti pelaa (0, 1 tai 2 ply, src/analyysi.mjs).
// Virhe on parhaan siirron ja pelatun siirron equityero ilman kuutiota: equity = 2 P(voitto) − 1,
// tasapeli puoli voittoa. Pakkosiirtoa ei analysoida.
// Luokan nimi haetaan näyttöhetkellä, jotta kielen vaihto koskee myös jo pelattuja siirtoja.
const LEVELS = [[0.16, '??', 0], [0.08, '?', 1], [0.04, '?!', 2]];
const level = loss => LEVELS.find(([t]) => loss >= t) ?? null;
const fmt = x => T.num(x);

// Analyysi palaa syvemmällä haulla myöhemmin, joten siirtolistan merkki ja huomautus täydentyvät
// vasta tuloksen tullessa. Peli jatkuu sillä välin. Tulos kuuluu sille pelille, jossa se pyydettiin.
function analyse(base, dice, played, row, moveNo) {
  const g = game;
  game.lastNote = { played, pending: true };
  rankMove(base, dice[0], dice[1], clone(game.s)).then(r => {
    if (g.lastNote?.played === played && g.lastNote.pending) g.lastNote = null;
    // Seuraavan pelin aikana valmistunut analyysi kirjataan päättyneeseen peliin, joka on
    // pelattujen listassa (Tommin havainto 1.11.2026: edellisen pelin analyysi katosi).
    const done = () => { if (game === g) render(); else if (g.over) saveFinished(); };
    if (!r) { done(); return; }
    const loss = Math.max(0, 2 * (r.best - r.played));
    // Verkon kolme parasta ja kunkin ero parhaaseen (Tommin pyyntö 1.11.2026).
    const top = r.top.map(({ moves, x }) => {
      const tmp = clone(base);
      const hits = moves.map(([f, t]) => applyMove(tmp, 0, f, t));
      return { m: notation(dice, moves, hits).split(': ')[1] ?? '', loss: 2 * (r.best - x) };
    });
    g.analysed++;
    g.totalLoss += loss;
    const lv = level(loss);
    if (lv) {
      row.me += lv[1];
      g.errors.push({ n: moveNo, played, top, loss });
    }
    if (g.lastNote === null && g.moveNo === moveNo) g.lastNote = { played, lv: lv ? lv[2] : null, loss, top };
    done();
  });
}

// Ero, joka näkyy kolmella desimaalilla nollana, on sama kuin verkon paras.
const SAME = 0.0005;

// Verkon parhaat omana numeroituna luettelonaan: paras sellaisenaan, muut eroineen.
function topList(top) {
  const ol = document.createElement('ol');
  for (const [k, t] of top.entries()) {
    const li = document.createElement('li');
    li.textContent = k === 0 ? t.m : `${t.m} (${fmt(t.loss)})`;
    ol.appendChild(li);
  }
  return ol;
}

// Siirron jälkeinen analyysi riveittäin: arvio omalla rivillään ja verkon parhaat luettelona.
function renderNote(box, n) {
  const p = document.createElement('p');
  if (n.pending) { p.textContent = T.noteWait(n.played); box.appendChild(p); return; }
  p.textContent = n.lv !== null ? T.noteBad(n.played, T.levels[n.lv], fmt(n.loss))
    : n.loss < SAME ? T.noteSame(n.played) : T.noteGood(n.played, fmt(n.loss));
  box.appendChild(p);
  if (n.loss < SAME && n.lv === null) return;
  const h = document.createElement('p');
  h.textContent = T.topTitle(n.top.length);
  box.appendChild(h);
  box.appendChild(topList(n.top));
}

function finishHuman() {
  game.moveNo++;
  const played = notation(game.dice, game.partial, game.hitsMarks);
  const row = { n: game.moveNo, me: played, bot: '' };
  game.log.push(row);
  game.lastNote = null;
  if (game.partial.length) analyse(game.base, [...game.dice], played, row, game.moveNo);
  game.half++;
  if (checkEnd(0) || checkDraw()) return;
  game.phase = 'bot'; game.turn = 1; game.msg = T.botThinking;
  render();
  later(() => botTurn(), 350);
}

function botTurn(opening = false, cubeDone = false) {
  if (game.over) return;
  game.turn = 1;
  // Botti päättää tuplauksesta ennen heittoa. Avausheitto on jo heitetty, joten silloin ei tuplata.
  if (!opening && !cubeDone && botCube.double(game.s, 1, game.cube)) {
    game.phase = 'offer';
    logCube('', T.logDouble(game.cube.value * 2));
    game.msg = T.botDoubles(game.cube.value * 2, points(game.cube.value));
    render();
    return;
  }
  if (!opening) { game.dice = roll(); sound('dice'); }
  game.diceOwner = 1;
  game.botUsed = [];
  game.msg = T.botThinking;
  render();
  // Haku palaa myöhemmin. Tulos kuuluu sille pelille, jossa se pyydettiin, kuten later().
  const g = game;
  botMove(game.s, game.dice[0], game.dice[1]).then(play => { if (game === g && !game.over) botPlayed(play); });
}

function botPlayed(play) {
  // Lyönnit osasiirroittain notaatiota varten.
  const tmp = clone(game.s); const hits = [];
  for (const [f, t] of play.moves) hits.push(applyMove(tmp, 1, f, t));
  game.s = play.s;
  game.lastBot = play.moves.map(([, t]) => (t <= 0 ? 'off' : 25 - t));
  game.botUsed = diceOf(play.moves, game.dice[0] === game.dice[1] ? Array(4).fill(game.dice[0]) : game.dice);
  game.botMoves = play.moves;
  const text = notation(game.dice, play.moves, hits);
  const last = game.log[game.log.length - 1];
  if (last && last.bot === '' && last.me !== '') last.bot = text;
  else { game.moveNo++; game.log.push({ n: game.moveNo, me: '', bot: text }); }
  const d = `${game.dice[0]}${game.dice[1]}`;
  game.msg = play.moves.length ? T.botPlayed(d, text.split(': ')[1]) : T.botDanced(d);
  game.half++;
  if (checkEnd(1) || checkDraw()) return;
  game.turn = 0; game.phase = 'roll';
  render();
}

// Tasapeli 300 rivin eli 600 puolisiirron jälkeen (Kaanon §2.7), kuution arvosta riippumatta.
function checkDraw() {
  if (game.half < DRAW_HALF) return false;
  game.over = true; game.phase = 'over';
  game.msg = T.draw(DRAW_ROWS);
  render();
  return true;
}

function checkEnd(p) {
  if (!exited(game.s[p])) return false;
  const v = game.cube.value;
  pen[p] += v; saveMatch();
  game.over = true; game.phase = 'over';
  game.msg = (p === 0 ? T.youExited(points(v)) : T.botExited(points(v))) + matchNote();
  render();
  return true;
}

// Ottelun päättyminen pelin lopputekstin jatkoksi.
function matchNote() {
  if (match.limit !== null && pen[0] >= match.limit) return T.matchLost(match.limit, pen[0], pen[1]);
  if (match.limit !== null && pen[1] >= match.limit) return T.matchWon(match.limit, pen[0], pen[1]);
  return '';
}

const canDouble = p => !game.crawford && mayDouble(game.cube, p);

// Kuution tapahtumat omalle rivilleen siirtolistaan.
function logCube(me, bot) {
  game.log.push({ n: '', me, bot });
}

// Luopuja saa kuution nykyarvon verran rangaistuspisteitä (Kaanon §2.4).
function endByDrop(p) {
  const v = game.cube.value;
  pen[p] += v; saveMatch();
  game.over = true; game.phase = 'over';
  game.msg = (p === 0 ? T.youDropped(points(v)) : T.botDropped(points(v))) + matchNote();
  render();
}

function humanDouble() {
  if (game.phase !== 'roll' || !canDouble(0)) return;
  sound('cube');
  const next = game.cube.value * 2;
  if (!botCube.take(game.s, 1, game.cube)) {
    logCube(T.logDouble(next), T.logDrop);
    endByDrop(1);
    return;
  }
  game.cube = { value: next, owner: 1 };
  logCube(T.logDouble(next), T.logTake);
  game.msg = T.botTook(next);
  render();
}

function humanTake() {
  if (game.phase !== 'offer') return;
  sound('cube');
  game.cube = { value: game.cube.value * 2, owner: 0 };
  game.log[game.log.length - 1].me = T.logTake;
  game.phase = 'bot';
  game.msg = T.youTook(game.cube.value);
  render();
  later(() => botTurn(false, true), 350);
}

function humanDrop() {
  if (game.phase !== 'offer') return;
  game.log[game.log.length - 1].me = T.logDrop;
  endByDrop(0);
}

function humanRoll() {
  if (game.phase !== 'roll') return;
  game.dice = roll();
  sound('dice');
  game.lastBot = [];
  beginHumanMove();
  if (game.phase === 'move') game.msg = T.youRolled(`${game.dice[0]}${game.dice[1]}`);
  render();
}

function pass() {
  if (game.phase !== 'pass') return;
  finishHuman();
}

// Pelin yhteenveto: virheiden summa ja luokat sekä kolme suurinta virhettä.
function renderSummary(box, game) {
  const h = document.createElement('strong');
  h.textContent = T.summaryTitle;
  box.appendChild(h);
  const p = document.createElement('p');
  if (!game.analysed) {
    p.textContent = T.summaryNone;
    box.appendChild(p);
    return;
  }
  const counts = LEVELS.map(([, m, k]) => `${T.levels[k]} ${game.errors.filter(e => level(e.loss)[1] === m).length}`);
  p.textContent = T.summary(game.analysed, fmt(game.totalLoss), fmt(game.totalLoss / game.analysed), counts.join(', '));
  box.appendChild(p);
  const top = [...game.errors].sort((x, y) => y.loss - x.loss).slice(0, 3);
  if (!top.length) return;
  const ol = document.createElement('ol');
  for (const e of top) {
    const li = document.createElement('li');
    li.textContent = T.summaryItem(e.n, e.played, fmt(e.loss));
    li.appendChild(topList(e.top));
    ol.appendChild(li);
  }
  box.appendChild(ol);
}

// ---------- piirto ----------

function el(name, attrs, parent = svg) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) e.setAttribute(k, v);
  parent.appendChild(e);
  return e;
}

function text(x, y, str, attrs, parent = svg) {
  const t = el('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': 'system-ui, sans-serif', ...attrs }, parent);
  t.textContent = str;
  return t;
}

// Puun syy aaltoviivoina (DG Androidin WoodGrain.kt), sama siemen joka piirrolla, jotta syy ei elä.
function grain(x, y, w, h, color, seed) {
  if (!color) return;
  let r = seed;
  const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  const spacing = 6, lines = Math.max(2, Math.floor(h / spacing)), seg = 4, step = w / seg;
  let d = '';
  for (let i = 0; i < lines; i++) {
    let yy = y + (i + 0.2 + rnd() * 0.6) * spacing;
    d += `M${X(x)},${yy}`;
    for (let k = 0; k < seg; k++) {
      const drift = (rnd() - 0.5) * spacing * 0.8, bend = (rnd() - 0.5) * spacing * 1.2;
      d += ` Q${X(x + step * (k + 0.5))},${yy + bend} ${X(x + step * (k + 1))},${yy + drift}`;
      yy += drift;
    }
  }
  el('path', { d, fill: 'none', stroke: color, 'stroke-width': 0.8, 'pointer-events': 'none' });
}

// Nappula: täyttö, reuna (Decossa kultarengas ja oman nappulan emali-inlay) ja valinnainen luku.
function checker(cx, cy, paint, label) {
  const ring = paint.ring ?? OUTLINE;
  el('circle', { cx, cy, r: R - 0.75, fill: paint.fill, stroke: paint.inlay ?? ring, 'stroke-width': 1.5 });
  if (paint.inlay) {
    el('circle', { cx, cy, r: R - 2.6, fill: 'none', stroke: ring, 'stroke-width': 1.5 });
    el('circle', { cx, cy, r: R - 4, fill: 'none', stroke: paint.inlay, 'stroke-width': 0.8 });
  }
  if (label) text(cx, cy + 0.5, label, { 'font-size': K * 0.45, 'font-weight': 'bold', fill: paint.on });
}

// Pino kiilan kannasta kärkeä kohti. Luku tulee näkyviin heti kun pinossa on yli viisi
// (docs/UI.md, Tommin havainto 8.8.2026).
function stack(cx, top, n, paint) {
  const shown = Math.min(n, CHECKERS_APART);
  for (let k = 0; k < shown; k++) {
    const cy = top ? TOP + R + k * K : BOTTOM - R - k * K;
    checker(cx, cy, paint, k === shown - 1 && n > CHECKERS_APART ? String(n) : '');
  }
}

const DIE_PIPS = {
  1: [[0.5, 0.5]], 2: [[0.26, 0.26], [0.74, 0.74]], 3: [[0.26, 0.26], [0.5, 0.5], [0.74, 0.74]],
  4: [[0.26, 0.26], [0.26, 0.74], [0.74, 0.26], [0.74, 0.74]],
  5: [[0.26, 0.26], [0.26, 0.74], [0.5, 0.5], [0.74, 0.26], [0.74, 0.74]],
  6: [[0.26, 0.26], [0.26, 0.5], [0.26, 0.74], [0.74, 0.26], [0.74, 0.5], [0.74, 0.74]],
};

// Näytettävät nopat. Tuplissa noppia on neljä, ja käytetty noppa merkitään arvon mukaan:
// ensimmäinen käyttämätön samanarvoinen.
function diceShown() {
  const [d1, d2] = game.dice;
  const own = game.diceOwner === 0 && game.turn === 0 && (game.phase === 'move' || game.phase === 'pass');
  const list = own ? game.order : d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
  const used = own ? [...game.partialDice] : game.diceOwner === 1 ? [...game.botUsed] : [];
  return list.map(v => {
    const k = used.indexOf(v);
    if (k >= 0) used.splice(k, 1);
    return { v, spent: k >= 0 };
  });
}

// Nopat heittäjän puoliskolle keskikaistalle: oma kotialueen puolella, botin toisella, ja
// peilattuna päinvastoin. Rivi luetaan aina vasemmalta oikealle käyttöjärjestyksessä.
function drawDice(L) {
  if (!game.dice || game.over) return;
  const dice = diceShown();
  const paint = game.diceOwner === 0 ? L.self : L.opp;
  const gap = K * 0.2, total = dice.length * DIE + (dice.length - 1) * gap;
  const half = (game.diceOwner === 0 ? RIGHT : LEFT) + 3 * COL;
  const x0 = X(half) - total / 2, y0 = MID - DIE / 2;
  const active = canSubmitByDice() || canSwap() || canRollByDice();
  const g = el('g', { class: active ? 'pt' : null, 'data-dice': '' });
  dice.forEach((d, k) => {
    const x = x0 + k * (DIE + gap);
    const dg = el('g', { opacity: d.spent ? 1 - SPENT_DIE_DIM : 1, 'data-spent': d.spent ? '1' : '0' }, g);
    el('rect', { x, y: y0, width: DIE, height: DIE, rx: DIE * CORNER_PER_SIDE, fill: paint.fill, stroke: OUTLINE, 'stroke-width': 1.5 }, dg);
    for (const [px, py] of DIE_PIPS[d.v]) el('circle', { cx: x + px * DIE, cy: y0 + py * DIE, r: 0.09 * DIE, fill: paint.on }, dg);
  });
  if (active) {
    el('rect', { x: x0 - 4, y: y0 - 4, width: total + 8, height: DIE + 8, fill: 'transparent' }, g);
    g.addEventListener('click', clickDice);
  }
}

// Seuraava peli noppien paikalle pelin päätyttyä (DG Androidin Next Game where the dice were).
function drawNextOnDice(L) {
  if (!opts.nextOnDice || !game.over) return;
  const label = matchOver() ? T.newMatch : T.nextGame;
  const w = COL * 3, h = DIE, cx = X(RIGHT + 3 * COL);
  const g = el('g', { class: 'pt', 'data-next': '' });
  el('rect', { x: cx - w / 2, y: MID - h / 2, width: w, height: h, rx: 8, fill: L.self.fill, stroke: OUTLINE, 'stroke-width': 1.5 }, g);
  text(cx, MID + 0.5, label, { 'font-size': 15, 'font-weight': 'bold', fill: L.self.on }, g);
  g.addEventListener('click', newGame);
}

// Nuolen pää ja häntä: pisteellä pinon paikka, muurilla muurin puolisko, ulos pelatessa lokero.
// own kertoo, kumman nappuloista on kyse. Piste on aina ihmisen numeroinnissa.
function anchor(p, own, slot) {
  if (p === BAR) return [X(BAR_X, COL) + COL / 2, own ? MID - BAND / 2 - R : MID + BAND / 2 + R];
  if (p <= 0) return [X(TRAY_X, TRAY_W) + TRAY_W / 2, own ? BOTTOM - WEDGE / 2 : TOP + WEDGE / 2];
  const k = Math.max(0, Math.min(slot, CHECKERS_APART - 1));
  return [X(pointX(p), COL) + COL / 2, isTop(p) ? TOP + R + k * K : BOTTOM - R - k * K];
}

// Siirtonuolet (DG Androidin MoveArrows): oma kootusta siirrosta ennen Valmista, botin edellinen
// sen väreissä omaan heittoon asti. Nuolessa on nappulan väri ja sen alla vastaväri.
function drawArrows(L) {
  const list = [];
  if (opts.arrows && game.turn === 0 && (game.phase === 'move')) {
    for (const [f, t] of game.partial) list.push({ f, t, own: true });
  }
  if (opts.botArrows && game.turn === 0 && game.phase === 'roll' && game.botMoves) {
    for (const [f, t] of game.botMoves) list.push({ f: f === BAR ? BAR : 25 - f, t: t <= 0 ? 0 : 25 - t, own: false });
  }
  for (const a of list) {
    const paint = a.own ? L.self : L.opp;
    const side = a.own ? game.s[0] : game.s[1];
    const cnt = q => (q === BAR || q <= 0 ? 0 : a.own ? side[q] : side[25 - q]);
    const [x1, y1] = anchor(a.f, a.own, cnt(a.f));
    const [x2, y2] = anchor(a.t, a.own, cnt(a.t) - 1);
    const len = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    const hx = x2 - ux * 12, hy = y2 - uy * 12;
    const head = `${x2},${y2} ${hx - uy * 7},${hy + ux * 7} ${hx + uy * 7},${hy - ux * 7}`;
    const g = el('g', { 'pointer-events': 'none', 'data-arrow': a.own ? 'me' : 'bot' });
    el('line', { x1, y1, x2: hx, y2: hy, stroke: paint.on, 'stroke-width': 7, 'stroke-linecap': 'round' }, g);
    el('polygon', { points: head, fill: paint.on, stroke: paint.on, 'stroke-width': 3, 'stroke-linejoin': 'round' }, g);
    el('line', { x1, y1, x2: hx, y2: hy, stroke: paint.fill, 'stroke-width': 3.5, 'stroke-linecap': 'round' }, g);
    el('polygon', { points: head, fill: paint.fill }, g);
  }
}

// Kuutio: keskellä lokerosarakkeessa, omistettuna muurin siinä päässä joka on omistajan
// puolella (docs/UI.md, 14.9.2026). Crawford-pelissä kuutiota ei ole.
function drawCube() {
  if (game.crawford) return;
  const cl = cubeLook(prefs.style);
  const owner = game.cube.owner;
  const cx = owner === -1 ? X(TRAY_X, TRAY_W) + TRAY_W / 2 : X(BAR_X, COL) + COL / 2;
  const cy = owner === -1 ? MID : owner === 1 ? TOP + 3 + CUBE / 2 : BOTTOM - 3 - CUBE / 2;
  const x = cx - CUBE / 2, y = cy - CUBE / 2;
  if (cl.cut) {
    const c = CUBE * 0.22, e = CUBE;
    el('polygon', { points: `${x + c},${y} ${x + e - c},${y} ${x + e},${y + c} ${x + e},${y + e - c} ${x + e - c},${y + e} ${x + c},${y + e} ${x},${y + e - c} ${x},${y + c}`, fill: cl.fill, stroke: cl.border, 'stroke-width': 1.5 });
  } else {
    el('rect', { x, y, width: CUBE, height: CUBE, rx: CUBE * CORNER_PER_SIDE, fill: cl.fill, stroke: OUTLINE, 'stroke-width': 1.5 });
  }
  const v = game.cube.value === 1 ? 64 : game.cube.value;
  text(cx, cy + 1, String(v), { 'font-size': CUBE * 0.48, 'font-weight': cl.bold ? 'bold' : 'normal', fill: cl.value(game.cube.value === 1 ? null : v) });
}

// Off-lokero: jokainen ulos pelattu on viiva syrjästä katsottuna, viiden ryhmissä, ja luku on
// pelaajan värisessä kiekossa lokeron kuution puoleisessa päässä (docs/UI.md, 24.9. ja 2.10.2026).
// Tyhjää lokeroa ei piirretä.
function drawOff(L, n, paint, upper) {
  if (n === 0) return;
  const tx = X(TRAY_X, TRAY_W) + 3, tw = TRAY_W - 6;
  const h = MID - CUBE / 2 - 6 - (TOP + 3);
  const y0 = upper ? TOP + 3 : BOTTOM - 3 - h;
  el('rect', { x: tx, y: y0, width: tw, height: h, rx: 4, fill: L.tray, stroke: L.trayOutline, 'stroke-width': 1.5 });
  const inset = 5, disc = Math.min(K, tw - 4);
  const discY = upper ? y0 + h - inset - disc / 2 : y0 + inset + disc / 2;
  checker(tx + tw / 2, discY, paint, '');
  text(tx + tw / 2, discY + 0.5, String(n), { 'font-size': disc * 0.42 * 1.3, 'font-weight': 'bold', fill: paint.on });
  const room = h - 2 * inset - disc - 4;
  const groups = Math.floor((15 - 1) / CHECKERS_APART);
  const step = Math.min(7, room / (15 + groups));
  const groupGap = step >= 3.5 ? step : 0;
  for (let i = 0; i < n; i++) {
    const fromEdge = i * step + Math.floor(i / CHECKERS_APART) * groupGap;
    const y = upper ? y0 + inset + fromEdge : y0 + h - inset - fromEdge - step + 1;
    el('rect', { x: tx + tw / 2 - K / 2, y, width: K, height: step - 1, rx: Math.min((step - 1) / 2, 2), fill: paint.fill, stroke: paint.inlay ?? paint.ring ?? OUTLINE, 'stroke-width': 1 });
  }
}

// Painettu piste (DG Androidin PointPressStore): numero suurenee laudan reunassa, oranssina kun
// pisteeltä voi siirtää ja yliviivattuna tummalla laatalla kun ei voi. Se jää näkyviin hetkeksi
// sormen noston jälkeen. Piirto on omalla kerroksellaan, jotta painallus ei piirrä lautaa uudelleen
// eikä hukkaa klikkausta.
const numEls = [];
let pressLayer = null, pressed = null, pressTimer = 0;
function drawPress() {
  if (!pressLayer) return;
  pressLayer.textContent = '';
  numEls.forEach(e => e && e.setAttribute('visibility', 'visible'));
  if (!opts.press || pressed === null || !numEls[pressed]) return;
  const e = numEls[pressed];
  const x = Number(e.getAttribute('x')), y = Number(e.getAttribute('y'));
  const can = game.turn === 0 && game.phase === 'move' && nextMoves().some(m => m[0] === pressed);
  e.setAttribute('visibility', 'hidden');
  const size = NUM + 6;
  if (!can) el('rect', { x: x - COL / 2 + 2, y: y - size / 2, width: COL - 4, height: size, rx: 5, fill: OUTLINE }, pressLayer);
  text(x, y + 0.5, String(pressed), { 'font-size': 22, 'font-weight': 'bold', fill: PIP_INK, 'data-press': can ? 'can' : 'cannot' }, pressLayer);
  if (!can) el('line', { x1: x - 13, y1: y + 1, x2: x + 13, y2: y + 1, stroke: PIP_INK, 'stroke-width': 2 }, pressLayer);
}
function pointAt(ev) {
  const r = svg.getBoundingClientRect();
  const x = (ev.clientX - r.left) / r.width * W, y = (ev.clientY - r.top) / r.height * Math.round(H);
  if (y < TOP || y > BOTTOM) return null;
  for (let i = 1; i <= 24; i++) {
    const px = X(pointX(i), COL);
    if (x >= px && x < px + COL && (isTop(i) ? y < MID : y >= MID)) return i;
  }
  return null;
}
svg.addEventListener('pointerdown', ev => {
  if (!opts.press) return;
  clearTimeout(pressTimer);
  pressed = pointAt(ev);
  drawPress();
});
svg.addEventListener('pointermove', ev => {
  if (!opts.press || pressed === null || !(ev.buttons & 1)) return;
  const p = pointAt(ev);
  if (p !== pressed) { pressed = p; drawPress(); }
});
for (const t of ['pointerup', 'pointercancel', 'pointerleave']) {
  svg.addEventListener(t, () => {
    if (!opts.press || pressed === null) return;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => { pressed = null; drawPress(); }, 700);
  });
}

function render() {
  svg.textContent = '';
  const s = game.s;
  const L = boardLook(prefs.style, isDark());

  // Kehys, huopa ja keskikaista (huopa), muuri kaistan läpi, lokerosarake.
  el('rect', { x: 0, y: 0, width: W, height: H, rx: 8, fill: L.frame });
  grain(0, 0, W, H, L.frameGrain, 3);
  el('rect', { x: X(LEFT, 13 * COL), y: TOP, width: 13 * COL, height: BOTTOM - TOP, fill: L.felt });
  grain(LEFT, TOP, 13 * COL, BOTTOM - TOP, L.feltGrain, 7);
  el('rect', { x: X(BAR_X, COL), y: TOP, width: COL, height: BOTTOM - TOP, fill: L.frame });
  grain(BAR_X, TOP, COL, BOTTOM - TOP, L.frameGrain, 11);
  el('rect', { x: X(TRAY_X, TRAY_W), y: TOP, width: TRAY_W, height: BOTTOM - TOP, fill: L.trayColumn });

  const nm = game.turn === 0 && game.phase === 'move' ? nextMoves() : [];
  const sources = new Set(nm.map(m => m[0]));

  for (let i = 1; i <= 24; i++) {
    const x = X(pointX(i), COL), top = isTop(i), cx = x + COL / 2;
    const tipY = top ? TOP + WEDGE : BOTTOM - WEDGE;
    const baseY = top ? TOP : BOTTOM;
    el('polygon', { points: `${x},${baseY} ${x + COL},${baseY} ${cx},${tipY}`, fill: i % 2 ? L.wedgeOdd : L.wedgeEven });
    numEls[i] = text(cx, top ? PAD + NUM / 2 : BOTTOM + NUM / 2, String(i), { 'font-size': 13, fill: NUMBER_INK, opacity: 0.8 });
    if (game.lastBot.includes(i)) el('rect', { x: x + 6, y: top ? TOP - 5 : BOTTOM + 1, width: COL - 12, height: 4, rx: 2, fill: 'var(--last)' });
    if (s[0][i] > 0) stack(cx, top, s[0][i], L.self);
    const o = s[1][25 - i];
    if (o > 0) stack(cx, top, o, L.opp);
    if (sources.has(i)) {
      const n = Math.min(s[0][i], CHECKERS_APART) - 1;
      el('circle', { cx, cy: top ? TOP + R + n * K : BOTTOM - R - n * K, r: R + 1.5, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 3 });
    }
    const hit = el('rect', { x, y: top ? TOP : BOTTOM - WEDGE, width: COL, height: WEDGE, fill: 'transparent', class: sources.has(i) ? 'pt' : null, 'data-point': i });
    hit.addEventListener('click', () => clickSpot(i));
  }

  // Pip-luku numerorivillä muurin kohdalla: ylhäällä botin, alhaalla oma (docs/UI.md, 15.8.2026).
  const bx = X(BAR_X, COL) + COL / 2;
  text(bx, PAD + NUM / 2, String(pips(s[1])), { 'font-size': 13 * 1.3, 'font-weight': 'bold', fill: PIP_INK, 'data-pip': 'bot' });
  text(bx, BOTTOM + NUM / 2, String(pips(s[0])), { 'font-size': 13 * 1.3, 'font-weight': 'bold', fill: PIP_INK, 'data-pip': 'me' });

  drawCube();

  // Muurin nappula on sillä puolella jonne se on menossa: oma ylhäällä botin kotialueen
  // puolella, botin alhaalla. Pino alkaa keskikaistan reunasta (docs/UI.md, 6.9.2026).
  const barStack = (n, paint, up) => {
    const shown = Math.min(n, 3);
    for (let k = 0; k < shown; k++) {
      const cy = up ? MID - BAND / 2 - R - k * K : MID + BAND / 2 + R + k * K;
      checker(bx, cy, paint, k === shown - 1 && n > shown ? String(n) : '');
    }
  };
  barStack(s[0][BAR], L.self, true);
  barStack(s[1][BAR], L.opp, false);
  if (sources.has(BAR)) el('circle', { cx: bx, cy: MID - BAND / 2 - R, r: R + 1.5, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 3 });
  const barHit = el('rect', { x: X(BAR_X, COL), y: TOP, width: COL, height: MID - TOP, fill: 'transparent', class: sources.has(BAR) ? 'pt' : null, 'data-point': BAR });
  barHit.addEventListener('click', () => clickSpot(BAR));

  drawOff(L, s[1][OFF], L.opp, true);
  drawOff(L, s[0][OFF], L.self, false);
  if (game.lastBot.includes('off')) el('rect', { x: X(TRAY_X, TRAY_W) + 8, y: TOP - 5, width: TRAY_W - 16, height: 4, rx: 2, fill: 'var(--last)' });

  drawDice(L);
  drawNextOnDice(L);
  drawArrows(L);
  pressLayer = el('g', { 'pointer-events': 'none' });
  drawPress();

  const hint = game.turn === 0 && game.phase === 'move' && nextMoves().length === 0 ? T.confirm : '';
  $('status').textContent = game.msg + hint;
  const box = $('analysis');
  box.textContent = '';
  if (game.over && finished !== game && !review) { finished = game; saveFinished(); }
  if (game.over) renderSummary(box, game); else if (opts.analysis && game.lastNote) renderNote(box, game.lastNote);
  if (game.mark) {
    const p = document.createElement('p');
    p.textContent = T.reviewMarkText(game.mark.text);
    box.appendChild(p);
  }
  $('roll').disabled = game.phase !== 'roll';
  const ready = game.turn === 0 && game.phase === 'move' && nextMoves().length === 0;
  $('done').style.display = ready ? '' : 'none';
  $('new').textContent = matchOver() ? T.newMatch : T.nextGame;
  $('new').style.display = game.over ? '' : 'none';
  $('resign').style.display = game.over ? 'none' : '';
  $('undo').disabled = !(game.turn === 0 && game.phase === 'move' && game.partial.length > 0);
  $('pass').style.display = game.phase === 'pass' ? '' : 'none';
  $('roll').style.display = game.phase === 'pass' || game.phase === 'offer' ? 'none' : '';
  $('double').style.display = game.phase === 'roll' && canDouble(0) ? '' : 'none';
  $('double').textContent = T.double(game.cube.value * 2);
  $('take').style.display = game.phase === 'offer' ? '' : 'none';
  $('drop').style.display = game.phase === 'offer' ? '' : 'none';
  $('cubeVal').textContent = game.crawford ? T.crawfordCube : game.cube.value;
  $('rows').textContent = `${Math.ceil(game.half / 2)} / ${DRAW_ROWS}`;
  $('limit').value = String(match.limit);
  // Ottelu ja rangaistuspisteet yhtenä lohkona: pisteet suhteessa otteluun valittuun rajaan.
  $('penMe').textContent = T.penScore(pen[0], match.limit);
  $('penBot').textContent = T.penScore(pen[1], match.limit);
  // Pelaajakortit pystylaudan ylä- ja alapuolella: botti ylhäällä, oma alhaalla.
  $('cardBot').textContent = T.card(T.static.bot, pen[1], game.turn === 1 && !game.over);
  $('cardMe').textContent = T.card(T.static.you, pen[0], game.turn === 0 && !game.over);
  // Oman sarakkeen leveys pisimmästä siirrosta, jotta tuplat mahtuvat (siirtolista laudan alla).
  const wMe = Math.max(16, ...game.log.map(r => r.me.length)) + 3;
  $('log').textContent = game.log.map(r => `${r.n === '' ? '    ' : `${String(r.n).padStart(3)})`} ${r.me.padEnd(wMe)}${r.bot}`).join('\n');
  $('log').scrollTop = 1e6;
  $('review').hidden = !review;
  $('actions').hidden = !!review;
  if (review) renderReview();
  if (document.activeElement !== $('xgid')) $('xgid').value = currentXGID();
}

// Selauksessa pelaajakortit ja pisteet ovat tuodun pelin: nimet ja pisteet pelin alussa.
function renderReview() {
  const g = reviewGame(), h = review.h, len = review.m.length || null;
  $('penMe').textContent = T.penScore(g.scores[h], len);
  $('penBot').textContent = T.penScore(g.scores[1 - h], len);
  $('cardBot').textContent = g.players[1 - h];
  $('cardMe').textContent = g.players[h];
  $('resign').style.display = 'none';
  const last = review.steps.length - 1;
  $('reviewFirst').disabled = $('reviewPrev').disabled = review.i === 0;
  $('reviewNext').disabled = $('reviewLast').disabled = review.i === last;
  const a = g.actions[review.i];
  $('reviewPlay').disabled = !a || a.kind === 'win' || (review.error !== null && review.i === last);
  const lines = $('log').textContent.split('\n');
  const cur = lines.findIndex(l => l.includes('◀'));
  if (cur >= 0) $('log').scrollTop = Math.max(0, cur * 19.5 - 120);
}

$('roll').addEventListener('click', humanRoll);
$('undo').addEventListener('click', undo);
$('pass').addEventListener('click', pass);
$('double').addEventListener('click', humanDouble);
$('take').addEventListener('click', humanTake);
$('drop').addEventListener('click', humanDrop);
$('done').addEventListener('click', () => {
  if (game.turn === 0 && game.phase === 'move' && nextMoves().length === 0) finishHuman();
});
// Ottelun pituuden vaihto aloittaa uuden ottelun. Jos ottelussa on jo pisteitä tai siirtoja,
// vaihto vahvistetaan, koska tilanne katoaa.
function fillLimits() {
  const sel = $('limit');
  sel.textContent = '';
  for (const l of LIMITS) {
    const o = document.createElement('option');
    o.value = String(l);
    o.textContent = T.limitOption(l);
    sel.appendChild(o);
  }
  sel.value = String(match.limit);
}
$('limit').addEventListener('change', e => {
  const v = e.target.value === 'null' ? null : Number(e.target.value);
  const progress = pen[0] + pen[1] > 0 || (game.half > 0 && !game.over);
  if (progress && !confirm(T.limitConfirm)) { e.target.value = String(match.limit); return; }
  match.limit = v; pen[0] = 0; pen[1] = 0; match.crawford = false;
  newGame();
});

// Kesken olevan pelin hylkääminen on luovutus, joten siitä tulee kuution arvon verran
// rangaistuspisteitä (Kaanon §2.2).
// Luovutus on paneelissa erillään vuoron napeista ja vaatii varmistuksen (Tommin valinta
// 1.11.2026, vahinkoklikkauksen jälkeen).
$('new').addEventListener('click', () => { if (game.over) newGame(); });
$('resign').addEventListener('click', () => {
  if (game.over || !confirm(T.resignConfirm(points(game.cube.value)))) return;
  logCube(T.logResign, '');
  endByDrop(0);
});

// Aseman XGID (src/xgid.mjs). Kesken olevasta siirrosta annetaan asema ennen siirtoa ja nopat.
function currentXGID() {
  const moving = game.turn === 0 && (game.phase === 'move' || game.phase === 'pass');
  return toXGID({
    s: moving ? game.base : game.s, cube: game.cube, turn: game.turn,
    dice: moving || game.phase === 'review' ? game.dice : null, offered: game.phase === 'offer', crawford: game.crawford,
    // Selauksessa pisteet ja pituus ovat tuodun pelin.
    pen: review ? [reviewGame().scores[review.h], reviewGame().scores[1 - review.h]] : pen,
    limit: review ? review.m.length || null : match.limit,
  });
}

// Liitetty XGID asettaa laudalle aseman, kuution, vuoron ja nopat. Ottelun pisteet ja pituus
// pysyvät ennallaan, koska ne ovat ottelun eivätkä aseman. Uusi peliolio katkaisee vanhan pelin
// odottavat botin siirrot ja analyysit (later ja analyse vertaavat peliin).
function loadXGID(text) {
  const x = fromXGID(text);
  if (!x) { $('xgidMsg').textContent = T.xgidBad; return; }
  $('xgidMsg').textContent = '';
  if (review) { game = review.saved; review = null; }
  setPosition(x, T.logImport, T.xgidLoaded);
}

// Asema laudalle pelattavaksi: XGID tai tuodun ottelun asema. x on { s, cube, turn, dice }.
function setPosition(x, logText, msg) {
  game = {
    ...game, s: x.s, cube: x.cube, over: false, base: null, partial: [], partialDice: [], hitsMarks: [],
    lastBot: [], botMoves: null, botUsed: [], lastNote: null, dice: x.dice, diceOwner: x.turn,
    order: x.dice ? [...x.dice] : [], log: [...game.log, { n: '', me: logText, bot: '' }],
    msg, when: Date.now(), limit: match.limit,
  };
  if (x.turn === 0) {
    if (x.dice) beginHumanMove(); else { game.turn = 0; game.phase = 'roll'; }
  } else {
    game.turn = 1; game.phase = 'bot';
    later(() => botTurn(!!x.dice), 400);
  }
  render();
}
$('xgidCopy').addEventListener('click', async () => {
  const id = currentXGID();
  $('xgid').value = id;
  try { await navigator.clipboard.writeText(id); $('xgidMsg').textContent = T.xgidCopied; }
  catch { $('xgid').select(); $('xgidMsg').textContent = T.xgidSelect; }
});
$('xgidSet').addEventListener('click', () => loadXGID($('xgid').value));
$('xgid').addEventListener('keydown', ev => { if (ev.key === 'Enter') loadXGID($('xgid').value); });

// Ottelun tuonti ja selaus (Tommin valinta 1.11.2026): DailyGammonin vienti (.mat) tai .sgf
// tiedostona tai liitettynä. Ottelua selataan teko kerrallaan. Mistä tahansa asemasta voi
// jatkaa peliä bottia vastaan. Selaus ei muuta ottelun pisteitä. Keskeytetty peli palaa, kun
// selaus suljetaan.
const reviewGame = () => review.m.games[review.gi];

function importMatch(text) {
  const m = parseMatch(text);
  if (!m) { $('importMsg').textContent = T.importBad; return; }
  if (!review && game.phase === 'bot') { $('importMsg').textContent = T.reviewBusy; return; }
  const name = store.get('ab-tuonti-nimi', null);
  const h = Math.max(0, m.players.indexOf(name));
  review = { m, h, gi: 0, i: 0, steps: [], error: null, saved: review?.saved ?? game };
  $('importMsg').textContent = T.importLoaded(m.players[0], m.players[1], m.games.length);
  fillReview();
  openGame(0);
}

function fillReview() {
  const { m, h } = review;
  const gs = $('reviewGame');
  gs.textContent = '';
  m.games.forEach((g, k) => {
    const o = document.createElement('option');
    o.value = String(k);
    o.textContent = T.reviewGameOption(k + 1, g.scores[0], g.scores[1], g.actions.some(a => a.mark));
    gs.appendChild(o);
  });
  const ys = $('reviewYou');
  ys.textContent = '';
  m.players.forEach((n, k) => {
    const o = document.createElement('option');
    o.value = String(k);
    o.textContent = n;
    ys.appendChild(o);
  });
  ys.value = String(h);
}

// Peli toistetaan alusta. Tavallisesta poikkeava alkuasema (nackgammon, double repeatin toistettu
// peli) ei toistu, joten se näytetään pysähtyneenä alkuun.
function openGame(gi) {
  review.gi = gi;
  const g = reviewGame();
  const r = replay(g);
  review.steps = g.setup ? r.steps.slice(0, 1) : r.steps;
  review.error = g.setup ? 0 : r.error;
  review.i = 0;
  $('reviewGame').value = String(gi);
  showStep();
}

// Teon teksti siirtolistaan ja tilariville siirtäjän numeroinnissa.
function actText(a, st) {
  if (a.kind === 'roll') {
    const tmp = [Int8Array.from(st.s[0]), Int8Array.from(st.s[1])];
    const hits = a.moves.map(([f, t]) => applyMove(tmp, a.side, f, t));
    return a.moves.length ? notation(a.dice, a.moves, hits) : `${a.dice[0]}${a.dice[1]}: ${T.reviewDance}`;
  }
  if (a.kind === 'double') return T.logDouble(a.value ?? st.cube.value * 2);
  if (a.kind === 'take') return T.logTake;
  if (a.kind === 'drop') return T.logDrop;
  return T.reviewWins(a.points);
}

// Selattavan aseman näyttöolio: sinä olet valittu pelaaja, toinen botin paikalla.
function showStep() {
  const { h, i, steps } = review;
  const g = reviewGame();
  const st = steps[i];
  const a = i < g.actions.length ? g.actions[i] : null;
  const side = a ? a.side : h;
  const log = [];
  let n = 0;
  g.actions.forEach((x, k) => {
    if (k >= steps.length && review.error !== null) return;
    const t = actText(x, steps[k] ?? st) + (k === i ? ' ◀' : '');
    const mine = x.side === h;
    const last = log[log.length - 1];
    if (!mine && last && last.bot === '' && last.me !== '') last.bot = t;
    else if (mine) log.push({ n: ++n, me: t, bot: '' });
    else log.push({ n: ++n, me: '', bot: t });
  });
  const stopped = review.error !== null && i === steps.length - 1;
  const name = g.players[side];
  let msg = T.reviewStep(i + 1, steps.length);
  if (stopped) msg += ' ' + T.reviewStopped;
  else if (a) msg += ' ' + T.reviewNext(name, actText(a, st));
  else msg += ' ' + T.reviewEnd;
  const owner = st.cube.owner;
  game = {
    s: [Int8Array.from(st.s[h]), Int8Array.from(st.s[1 - h])],
    cube: { value: st.cube.value, owner: owner === -1 ? -1 : owner === h ? 0 : 1 },
    turn: side === h ? 0 : 1, phase: 'review', over: false, crawford: false,
    dice: a?.kind === 'roll' && !stopped ? [...a.dice] : null, diceOwner: side === h ? 0 : 1,
    order: [], botUsed: [], partial: [], partialDice: [], hitsMarks: [], base: null, plays: null,
    lastBot: [], botMoves: null, log, moveNo: n, half: 0, errors: [], analysed: 0, totalLoss: 0,
    lastNote: null, msg, mark: a?.mark ?? null,
  };
  render();
}

function step(k) {
  if (!review) return;
  review.i = Math.max(0, Math.min(review.steps.length - 1, k));
  showStep();
}

// Seuraava merkitty asema, tarvittaessa seuraavista peleistä.
function nextMark() {
  if (!review) return;
  const games = review.m.games;
  for (let gi = review.gi; gi < games.length; gi++) {
    const from = gi === review.gi ? review.i + 1 : 0;
    const k = games[gi].actions.findIndex((a, j) => j >= from && a.mark);
    if (k < 0) continue;
    if (gi !== review.gi) openGame(gi);
    step(k);
    return;
  }
  $('importMsg').textContent = T.reviewNoMark;
}

// Peli jatkuu selattavasta asemasta bottia vastaan. Kuutiopäätöksen kohdalla jatketaan
// tuplaajan vuorosta ennen tuplausta, joten päätös tehdään uudelleen.
function playFromHere() {
  if (!review) return;
  const g = reviewGame();
  let i = review.i;
  if (review.error !== null && i === review.steps.length - 1) return;
  if (['take', 'drop'].includes(g.actions[i]?.kind)) i--;
  const a = g.actions[i];
  if (!a || a.kind === 'win') return;
  const st = review.steps[i], h = review.h, owner = st.cube.owner;
  const x = {
    s: [Int8Array.from(st.s[h]), Int8Array.from(st.s[1 - h])],
    cube: { value: st.cube.value, owner: owner === -1 ? -1 : owner === h ? 0 : 1 },
    turn: a.side === h ? 0 : 1,
    dice: a.kind === 'roll' ? [...a.dice] : null,
  };
  game = review.saved;
  review = null;
  setPosition(x, T.logReview, T.reviewPlaying);
}

function closeReview() {
  if (!review) return;
  game = review.saved;
  review = null;
  render();
}

$('importFile').addEventListener('change', async ev => {
  const f = ev.target.files?.[0];
  if (!f) return;
  importMatch(await f.text());
  ev.target.value = '';
});
$('importGo').addEventListener('click', () => importMatch($('importText').value));
$('reviewGame').addEventListener('change', e => openGame(Number(e.target.value)));
$('reviewYou').addEventListener('change', e => {
  review.h = Number(e.target.value);
  store.set('ab-tuonti-nimi', review.m.players[review.h]);
  showStep();
});
$('reviewFirst').addEventListener('click', () => step(0));
$('reviewPrev').addEventListener('click', () => step(review.i - 1));
$('reviewNext').addEventListener('click', () => step(review.i + 1));
$('reviewLast').addEventListener('click', () => step(review.steps.length - 1));
$('reviewMark').addEventListener('click', nextMark);
$('reviewPlay').addEventListener('click', playFromHere);
$('reviewClose').addEventListener('click', closeReview);

// Ulkoasu: lautatyyli, kotialueen puoli ja pystylauta. Ympäristön värit tulevat CSS-muuttujiin
// lautatyylistä ja laitteen tummasta tilasta (src/ulkoasu.mjs).
function applyLook() {
  const P = panelLook(prefs.style, isDark());
  const root = document.documentElement.style;
  const vars = { '--bg': P.background, '--panel': P.card, '--ink': P.text, '--muted': P.muted,
    '--frame': P.outline, '--accent': P.button, '--on-accent': P.onButton, '--link': P.accent };
  for (const [k, v] of Object.entries(vars)) root.setProperty(k, v);
  document.documentElement.style.colorScheme = P.light ? 'light' : 'dark';
  document.body.classList.toggle('home-left', prefs.left);
  document.body.classList.toggle('portrait', prefs.portrait);
}
function fillLook() {
  const sel = $('style');
  sel.textContent = '';
  for (const st of STYLES) {
    const o = document.createElement('option');
    o.value = st;
    o.textContent = T.styles[st];
    sel.appendChild(o);
  }
  sel.value = prefs.style;
  const home = $('home');
  home.textContent = '';
  for (const v of ['right', 'left']) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = T.home[v];
    home.appendChild(o);
  }
  home.value = prefs.left ? 'left' : 'right';
  $('portrait').checked = prefs.portrait;
  // Äänet: pääkytkin ja kunkin äänen ruutu, kuten DG Androidin Game sounds.
  const sbox = $('sounds');
  sbox.textContent = '';
  const row = (text, checked, onChange, sub = false) => {
    const label = document.createElement('label');
    label.className = sub ? 'wide sub' : 'wide';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    const span = document.createElement('span');
    span.textContent = text;
    label.append(input, span);
    sbox.appendChild(label);
    return input;
  };
  const main = row(T.soundsOn, snd.on, v => { snd.on = v; saveSnd(); subs.forEach(i => { i.disabled = !v; }); });
  main.dataset.sound = 'on';
  const subs = Object.keys(SOUNDS).map(k => {
    const i = row(T.sounds[k], !snd.off.includes(k), v => {
      snd.off = v ? snd.off.filter(x => x !== k) : [...new Set([...snd.off, k])];
      saveSnd();
      if (v) sound(k);
    }, true);
    i.disabled = !snd.on;
    i.dataset.sound = k;
    return i;
  });

  const box = $('playing');
  box.textContent = '';
  const plyLabel = document.createElement('label');
  plyLabel.htmlFor = 'ply';
  plyLabel.textContent = T.plyLabel;
  const plySel = document.createElement('select');
  plySel.id = 'ply';
  for (const v of PLIES) {
    const o = document.createElement('option');
    o.value = String(v);
    o.textContent = T.plyOption(v);
    plySel.appendChild(o);
  }
  plySel.value = String(ply);
  plySel.addEventListener('change', () => { ply = Number(plySel.value); store.set('ab-syvyys', ply); });
  box.append(plyLabel, plySel);
  for (const k of PLAY_TOGGLES) {
    const label = document.createElement('label');
    label.className = 'wide';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = opts[k];
    input.dataset.toggle = k;
    input.addEventListener('change', () => { opts[k] = input.checked; store.set('ab-pelaaminen', opts); render(); });
    const span = document.createElement('span');
    span.textContent = T.toggles[k];
    label.append(input, span);
    box.appendChild(label);
  }
}
$('style').addEventListener('change', e => { prefs.style = e.target.value; store.set('ab-tyyli', prefs.style); applyLook(); render(); });
$('home').addEventListener('change', e => { prefs.left = e.target.value === 'left'; store.set('ab-koti-vasen', prefs.left); applyLook(); render(); });
$('portrait').addEventListener('change', e => { prefs.portrait = e.target.checked; store.set('ab-pysty', prefs.portrait); applyLook(); });
darkQuery?.addEventListener?.('change', () => { applyLook(); render(); });

// Pikanäppäimet Windows-työpöydälle (Tommin valinta 1.11.2026): Ctrl+Z kumoaa, välilyönti heittää,
// Enter vahvistaa valmiin siirron tai jatkaa tai aloittaa seuraavan pelin, S vaihtaa nopat.
// Peruuttamattomilla teoilla (otto, luopuminen, luovutus) ei ole näppäintä. Kenttien ja
// valintojen näppäimet jätetään niille.
document.addEventListener('keydown', ev => {
  if (ev.target.closest?.('input, select, textarea') || ev.altKey || ev.metaKey) return;
  const key = ev.key.toLowerCase();
  // Selauksessa nuolet askeltavat ja Home ja End vievät pelin alkuun ja loppuun.
  if (review && !ev.ctrlKey) {
    const moves = { arrowleft: review.i - 1, arrowright: review.i + 1, home: 0, end: review.steps.length - 1 };
    if (key in moves) { ev.preventDefault(); step(moves[key]); }
    return;
  }
  if (ev.ctrlKey) {
    if (key === 'z') { ev.preventDefault(); undo(); }
    return;
  }
  if (key === ' ') { ev.preventDefault(); humanRoll(); }
  else if (key === 'enter') {
    ev.preventDefault();
    if (game.over) newGame();
    else if (game.phase === 'pass') pass();
    else if (turnComplete()) finishHuman();
  } else if (key === 's') swapDice();
});

applyStatic();
fillLimits();
fillLook();
fillPlayed();
applyLook();
$('lang').addEventListener('click', () => {
  switchLang(); fillLimits(); fillLook(); fillPlayed();
  if (review) { fillReview(); $('reviewGame').value = String(review.gi); showStep(); } else render();
});
newGame();

// Testikoukku: ?debug antaa automaattiselle läpipeluulle pääsyn tilaan.
if (location.search.includes('debug')) window.__dg = { get game() { return game; }, currentXGID, loadXGID, importMatch, get review() { return review; }, step, nextMark, playFromHere, closeReview, played, get ply() { return ply; }, match, prefs, opts, snd, newGame, clickSpot, swapDice, remainingDice, nextMoves, humanDouble, humanTake, humanDrop, botCube };
