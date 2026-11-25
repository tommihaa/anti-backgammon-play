// Selainlauta: ihminen (pelaaja 0) verkkobottia (pelaaja 1) vastaan kuution kanssa.
// Verkko siirtää ja tekee kuutiopäätökset omalla arviollaan (src/verkko.mjs, Kaanon §4).
// Lauta piirretään ihmisen näkökulmasta: oma piste i, botin nappulat bottipisteessä 25 - i.

import { initialState, legalPlays, pips, exited, clone, key, OFF, BAR, DRAW_HALF, DRAW_ROWS } from './engine.mjs';
import { fromJSON, netBot, netCube, value } from './verkko.mjs';
import { newCube, mayDouble, tablePolicy, MATCH_LIMIT } from './kuutio.mjs';
import { newStall, observe, stuck, botOffers, botAccepts } from './jumi.mjs';
import { T, applyStatic, setLang } from './kieli.mjs';
import { rankPlays, rollLuck, notation, topMoves, applyMove, rollBest } from './analyysi.mjs';
import { toXGID, fromXGID } from './xgid.mjs';
import { parseMatch, replay, linkFragment } from './tuonti.mjs';
import { emptyPosition, placeCheckers, clearPosition, positionError, crawfordPossible, createdFragment } from './luonti.mjs';
import { gameHTML, cubeLabel, cubeEquityRows, luckMarkOf } from './vienti.mjs';
import { buildAnalysisFile, parseAnalysisFile, FORMAT, EXT } from './analyysitiedosto.mjs';
import { SOUNDS, playSound } from './aanet.mjs';
import { VERSION } from './versio.mjs';
import { NET_SHORT, NET_CODE, netHistory } from './historia.mjs';
import { parseMove, positionLine, isFinal, RULES } from './protokolla.mjs';
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
  style: STYLES.includes(store.get('ab-tyyli', STYLES[0])) ? store.get('ab-tyyli', STYLES[0]) : STYLES[0],
  left: store.get('ab-koti-vasen', false) === true,
};
// Pelaamisen kytkimet DG Androidin Pelaaminen-ryhmästä (docs/ASETUKSET.md luku 3). Ahne uloskanto
// jäi pois, koska tässä pelissä ulos ehtiminen on se mitä vältetään. Siirron jälkeinen analyysi on
// oma kytkimensä (Tommin tilaus 1.11.2026). Tuodun ottelun analyysi on oma kytkimensä (Tommin
// valinta 14.11.2026), koska 2-ply-analyysi vie koko ottelusta minuutteja. Botin siirtojen
// analyysi kesken pelin on oma kytkimensä (Tommin tilaus 24.11.2026). Automaattiheitto heittää
// vain vuoroilla, joilla et voi tuplata (Tommin valinta 25.11.2026), jotta tuplaus säilyy.
export const PLAY_TOGGLES = ['analysis', 'botAnalysis', 'importAnalysis', 'forced', 'arrows', 'botArrows', 'press', 'diceSubmit', 'diceSwap', 'diceRoll', 'autoRoll', 'nextOnDice'];
// Kytkimet ovat oletuksena päällä 3.11.2026 alkaen (Tommin päätös debuggausta varten, Kaanon §4).
// Automaattiheitto on poikkeus (Tommi 25.11.2026): se vie tasapelitarjouksen hetken ennen heittoa.
const OFF_BY_DEFAULT = ['autoRoll'];
const opts = Object.fromEntries(PLAY_TOGGLES.map(k => [k, !OFF_BY_DEFAULT.includes(k)]));
{ const saved = store.get('ab-pelaaminen', {}); for (const k of PLAY_TOGGLES) if (typeof saved?.[k] === 'boolean') opts[k] = saved[k]; }
// Botin hakusyvyys: 0-ply on verkon suora arvio, 1- ja 2-ply katsovat vastustajan heitot eteenpäin.
// Pelaaja valitsee, koska syvempi haku vie koneesta riippuen sekunteja (Tommin tilaus 1.11.2026).
// Oletus on 2-ply 3.11.2026 alkaen (Tommin päätös debuggausta varten, Kaanon §4). Aiempi oletus
// 1-ply valittiin, koska 2-ply:n siirto vie sekunteja. Siirron kesto näytetään viestissä.
export const PLIES = [0, 1, 2];
const DEFAULT_PLY = 2;
const savedPly = store.get('ab-syvyys', DEFAULT_PLY);
let ply = PLIES.includes(savedPly) ? savedPly : DEFAULT_PLY;
// Pelaajien nimet laudalle ja vienteihin (Tommi 18.11.2026). Oma nimi tulee Asetusten kentästä, ja
// tyhjä nimi on kielen Sinä. Botin nimi on laudan verkon lyhyt nimi ja syvyys pelin alussa
// (src/historia.mjs). Peli tallentaa nimet alkaessaan (names), joten vienti näyttää ne nimet,
// joilla peli pelattiin. Vanhalla pelillä ilman nimiä käytetään nykyisiä.
let myName = store.get('ab-nimi', '');
const meName = () => (typeof myName === 'string' && myName.trim()) || T.static.you;
const botLabel = (net = NET_FILE, p = ply) => `${NET_SHORT[net] ?? T.static.bot} ${p}-ply`;
const namesOf = x => x?.names ?? [meName(), botLabel(x?.net ?? NET_FILE)];
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
// Aseman luonnin tila tai null (Aseman luonti alempana).
let edit = null;
// Ottelu rangaistuspisteiden rajaan (Kaanon §2.5). crawford kertoo, onko Crawford-peli jo pelattu.
// limit on ottelun raja tai null, jolloin pelataan rahapeliä ilman rajaa ja Crawford-sääntöä.
// Vanha tallennus ilman rajaa on 7 pisteen ottelu.
export const LIMITS = [1, 3, 5, 7, null];
const match = store.get('ab-ottelu', { pen: [0, 0], crawford: false });
if (match.limit === undefined) match.limit = MATCH_LIMIT;
// Ottelun tunniste ja päättyneiden pelien määrä Tulokset-paneelia varten (ottelun PR, pelit ja
// pelin numero).
const startMatch = () => { match.id = Date.now(); match.done = 0; };
if (match.id === undefined) startMatch();
const pen = match.pen;
const saveMatch = () => store.set('ab-ottelu', match);
const matchOver = () => match.limit !== null && pen.some(x => x >= match.limit);
// Vastustajan verkko. Valinta ja vertailu: Kaanon/Anti-Backgammon §4.
export const NET_FILE = 'verkot/jatko-raw-g4-p3000.json';
const netText = await (await fetch(NET_FILE)).text();
const net = fromJSON(netText);
const botPlay = netBot(net);

// 1- ja 2-ply lasketaan Web Workerissa (src/botti-tyo.mjs), jotta sivu ei jäädy. Jos säiettä ei
// saa, niin haku tehdään sivulla itsellään. 0-ply on niin nopea, että se lasketaan aina sivulla.
// Botti ja analyysi saavat kumpikin oman säikeensä, jotta 2-ply-analyysi ei viivästä botin
// vastausta. Kumpikin vie 2-ply:llä sekunteja.
let reqId = 0;
const waiting = new Map();
// Välitulokset pyynnöille, jotka lähettävät osia ennen tulosta (heittokartta).
const partials = new Map();
function spawn() {
  try {
    const w = new Worker(new URL('./botti-tyo.mjs', import.meta.url), { type: 'module' });
    w.postMessage({ net: netText });
    w.onmessage = ({ data }) => {
      if (data.partial) { partials.get(data.id)?.(data.partial); return; }
      waiting.get(data.id)?.(data.result); waiting.delete(data.id); partials.delete(data.id);
    };
    return w;
  } catch { return null; }
}
const botWorker = spawn(), analysisWorker = spawn();
// Pelattujen pelien jälkianalyysi saa kolmannen säikeen, kun sitä ensi kerran tarvitaan.
let reviewWorker;
const reviewW = () => (reviewWorker === undefined ? (reviewWorker = spawn()) : reviewWorker);
// Pyyntö, jonka osat tulevat onPart-kutsuina ennen lopullista tulosta.
function askStream(w, msg, onPart) {
  const id = ++reqId;
  partials.set(id, onPart);
  return new Promise(res => { waiting.set(id, res); w.postMessage({ id, ...msg }); });
}
function ask(w, msg) {
  const id = ++reqId;
  return new Promise(res => { waiting.set(id, res); w.postMessage({ id, ...msg }); });
}
// Ulkoinen moottori (Kaanon/Anti-Backgammon §5 kohta 9 › Protokolla ensin, 25.11.2026). Osoite on
// protokollamoottorin silta (tyokalut/moottorisilta.mjs), tyhjä osoite on laudan oma botti.
// Ulkoinen moottori päättää botin siirrot, tuplaukset, otot ja tasapelitarjoukset. Analyysi
// käyttää aina laudan verkkoa. Jos moottori ei vastaa tai vastaa laittomasti, laudan botti tekee
// päätöksen ja viesti kertoo sen.
let engineUrl = String(store.get('ab-moottori', '') ?? '');
const engine = { name: null, error: null, sentFor: null };
async function engineAsk(lines, ms = 120000) {
  const r = await fetch(engineUrl, { method: 'POST', body: lines.join('\n'), signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const out = (await r.text()).split(/\r?\n/).filter(Boolean);
  const last = out.filter(isFinal).at(-1);
  if (!last || last.startsWith('error')) throw new Error(last ?? 'ei vastausta');
  return { last, out };
}
async function engineHello() {
  engine.name = null; engine.error = null;
  if (!engineUrl) return;
  try {
    const { last, out } = await engineAsk(['abg'], 3000);
    const rules = out.find(l => l.startsWith('id rules '))?.slice(9);
    if (last !== 'abgok') throw new Error(last);
    if (rules !== RULES) throw new Error(T.engineRules(rules ?? '?', RULES));
    engine.name = out.find(l => l.startsWith('id name '))?.slice(8) ?? engineUrl;
  } catch (e) { engine.error = e.message; }
}
// Laudan pelaaja 0 on ihminen ja 1 botti. Rahapelin raja on protokollassa 0.
const enginePos = (turn, extra = {}) => positionLine({
  s: game.s, cube: game.cube, turn, dice: null, offered: false, pen: [...pen], crawford: game.crawford,
  limit: match.limit ?? 0, ...extra,
}, game.half);
// Kysymys ulkoiselle moottorille. Uusi peli ja syvyys kulkevat ensimmäisen kysymyksen mukana.
function engineQuery(turn, cmd, extra) {
  const pre = engine.sentFor === game ? [] : ['newgame'];
  engine.sentFor = game;
  return engineAsk([...pre, `setoption name ply value ${ply}`, enginePos(turn, extra), cmd]).then(r => r.last);
}
const useEngine = () => engineUrl !== '' && engine.name !== null;
function engineFailed(e) {
  engine.error = e?.message ?? String(e);
  game.engineNote = T.engineFallback;
}
if (engineUrl) await engineHello();

const deepBots = {};
function botMove(s, d1, d2) {
  if (useEngine()) {
    return engineQuery(1, 'move', { dice: [d1, d2] }).then(a => {
      const play = a.startsWith('bestmove ') ? parseMove(a.slice(9), s, 1, d1, d2) : null;
      if (!play) throw new Error(`${T.engineIllegal}: ${a}`);
      return play;
    }).catch(e => { engineFailed(e); return internalMove(s, d1, d2); });
  }
  return internalMove(s, d1, d2);
}
function internalMove(s, d1, d2) {
  if (ply === 0) return Promise.resolve(botPlay(s, 1, d1, d2, Math.random));
  if (!botWorker) { deepBots[ply] ??= netBot(net, ply); return Promise.resolve(deepBots[ply](s, 1, d1, d2, Math.random)); }
  return ask(botWorker, { s, p: 1, d1, d2, ply });
}
// Pelaajan p siirron analyysi samalla syvyydellä kuin botti pelaa (src/analyysi.mjs).
function rankMove(base, d1, d2, played, p = 0) {
  if (ply === 0 || !analysisWorker) return Promise.resolve(rankPlays(net, base, p, d1, d2, played, ply));
  return ask(analysisWorker, { kind: 'analyse', s: base, p, d1, d2, played, ply });
}
const netPolicy = netCube(net);
let botCube;

const points = n => T.points(n);

function newGame() {
  const first = game === undefined;
  if (matchOver()) { pen[0] = 0; pen[1] = 0; match.crawford = false; startMatch(); }
  // Crawford-peli on ensimmäinen peli sen jälkeen, kun jompikumpi on yhden pisteen päässä rajasta
  // (Kaanon §2.6).
  const limit = match.limit;
  // DMP on yhden pisteen ottelu, jonka jokainen peli on kuutioton kuten Crawford-peli.
  // match.crawford on Crawford-pelin numero (aiemmin true). Sivun lataus hylkää kesken olevan pelin,
  // joten samalla numerolla alkava peli on yhä Crawford-peli. Aiemmin merkintä ohitti sen, ja
  // DMP sai latauksen jälkeen kuution (Tommin havainto 24.11.2026).
  const dmp = limit === 1, no = (match.done ?? 0) + 1;
  const crawford = dmp || (limit !== null && (!match.crawford || match.crawford === no) && pen.some(x => x === limit - 1));
  if (crawford && !dmp) match.crawford = no;
  saveMatch();
  // Rahapelissä kuutio käyttää rahapelin rajoja (Kaanon §4), ottelussa voittotaulukkoa.
  botCube = limit === null ? netPolicy : tablePolicy(netPolicy, { away: pen.map(x => limit - x), crawford });
  let a, b;
  do { a = 1 + Math.floor(Math.random() * 6); b = 1 + Math.floor(Math.random() * 6); } while (a === b);
  game = {
    s: initialState(), dice: [a, b], diceOwner: a > b ? 0 : 1, order: [a, b], botUsed: [],
    turn: a > b ? 0 : 1, phase: 'move', cube: newCube(),
    crawford, dmp, plays: null, partial: [], partialDice: [], hitsMarks: [], base: null,
    lastBot: [], log: [], moveNo: 0, half: 0, over: false, errors: [], analysed: 0, totalLoss: 0,
    when: Date.now(), limit: match.limit, decisions: [], stall: newStall(), turnAct: null,
    names: [meName(), useEngine() ? engine.name : botLabel()],
    msg: T.opening(a, b, a > b, crawford && !dmp), no, score: [...pen], match: match.id,
  };
  if (!first) sound('gong');
  review = null;
  sel = { when: null, d: null };
  fillGameSel();
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
  decisions: g.decisions ?? [], no: g.no, score: g.score, match: g.match, crawford: g.crawford,
  // Verkko, jolla peli pelattiin ja analysoitiin. Siirtojen syvyys on päätöksissä (ply).
  net: g.net ?? NET_FILE,
  // Analyysitiedostosta tuodun pelin rollout-tulokset säilyvät seuraavaan vientiin.
  rollouts: g.rollouts,
  names: g.names,
});
function saveFinished() {
  if (!finished) return;
  const k = played.findIndex(x => x.when === finished.when);
  if (k >= 0) played[k] = record(finished); else played.unshift(record(finished));
  played.length = Math.min(played.length, PLAYED_MAX);
  store.set('ab-pelatut', played);
  fillGameSel();
}

// Paneelit (Tommin tilaus 10.11.2026, mallina backgammondrills.com:n Hypergammon): Peli-paneelin
// valitsimessa ovat nykyinen peli ja pelatut pelit, ja lista näyttää valitun pelin siirrot. Rivin
// valinta näyttää aseman ennen siirtoa laudalla ja siirron arvion Arvio-paneelissa. Tulokset-
// paneelissa ovat ottelu, pelit ja PR. sel.when on valitun pelatun pelin tunniste tai null
// nykyiselle pelille, ja sel.d on valitun päätöksen indeksi pelin päätöksissä.
let sel = { when: null, d: null };

// Analysoidut tuodut ottelut (Tommin valinnat 14.11.2026): pelivalitsimessa pelattujen pelien
// rinnalla, enintään IMPORTED_MAX laitteella, uusin ensin. Tallessa ovat ottelun teksti, sen
// tiiviste tunnisteena (liitetyllä tekstillä ei ole DailyGammonin numeroa), valittu pelaaja,
// verkko jolla analyysi laskettiin ja valmiit tulokset teon mukaan syvyyksineen. Teksti
// jäsennetään avattaessa uudelleen, joten asemia ei tallenneta.
const IMPORTED_MAX = 5;
const imported = [store.get('ab-tuodut', [])].flatMap(a => (Array.isArray(a) ? a : []));
// FNV-1a rivinvaihdot yhtenäistettyinä, jotta saman tiedoston liitetty ja ladattu teksti täsmäävät.
function textId(text) {
  let h = 0x811c9dc5;
  for (const c of String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim()) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
}
function saveImported() {
  if (!review?.done.size && !Object.keys(review?.marks ?? {}).length) return;
  const x = {
    id: review.id, text: review.text, when: review.when, players: review.m.players, length: review.m.length,
    h: review.h, net: review.net, kind: review.kind, done: Object.fromEntries(review.done), rollouts: review.rollouts,
    marks: review.marks,
  };
  const k = imported.findIndex(y => y.id === x.id);
  if (k >= 0) imported.splice(k, 1);
  imported.unshift(x);
  imported.length = Math.min(imported.length, IMPORTED_MAX);
  store.set('ab-tuodut', imported);
}
const liveGame = () => (review ? review.saved : game);
// Selauksessa valittu on tuodun pelin päätöslista (reviewRecord).
const selRec = () => (review ? review.rec : sel.when === null ? liveGame() : played.find(x => x.when === sel.when) ?? liveGame());
const viewing = () => !review && sel.d !== null && !!selRec().decisions?.[sel.d]?.s;

function fillGameSel() {
  const s = $('gameSel');
  s.textContent = '';
  const cur = liveGame();
  const add = (value, x, now) => {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = T.gameOption(x.no, x.score, now ? null : new Date(x.when), x.limit);
    s.appendChild(o);
  };
  add('', cur, true);
  for (const x of imported) {
    const o = document.createElement('option');
    o.value = `imp:${x.id}`;
    o.textContent = T.importOption(x.players[0], x.players[1], new Date(x.when), x.kind === 'dmp' ? 1 : x.length || null);
    s.appendChild(o);
  }
  for (const x of played) if (x.when !== cur.when) add(String(x.when), x, false);
  if (sel.when !== null && !played.some(x => x.when === sel.when)) sel = { when: null, d: null };
  s.value = sel.when === null ? '' : String(sel.when);
}
$('gameSel').addEventListener('change', e => {
  if (e.target.value.startsWith('imp:')) {
    const x = imported.find(y => y.id === e.target.value.slice(4));
    e.target.value = '';
    if (x) importMatch(x.text);
    return;
  }
  sel ={ when: e.target.value === '' ? null : Number(e.target.value), d: null };
  const x = selRec();
  if (x !== liveGame()) analyseRecord(x);
  render();
});
function select(d) {
  // Selauksessa rivin valinta siirtyy sen teon asemaan.
  if (review) { const k = review.rec.act.indexOf(d); if (k >= 0) step(k); return; }
  sel.d = sel.d === d ? null : d;
  render();
}
function resume() {
  sel.d = null;
  render();
}
$('resume').addEventListener('click', resume);

// Peli-paneelin lista: rivin numero ja sen alla molempien pelaajien siirrot omilla riveillään.
// Rivi on valittavissa, kun siitä on kirjattu päätös (meD ja botD ovat päätösten indeksejä).
let navOrder = [];
function renderGamePanel() {
  const list = $('gameList');
  $('gameSel').hidden = !!review;
  const x = selRec(), live = x === liveGame();
  $('gameMsg').textContent = live ? '' : x.msg;
  // Vienti päättyneestä tai tuodusta pelistä, jossa on päätöksiä.
  $('exportHtml').hidden = !x.decisions?.length || (live && !x.over);
  $('exportFile').hidden = $('exportHtml').hidden;
  // Siirrot väritetään equity-menetyksen mukaan (Tommin rajat 13.11.2026): yli 0,020 vihreä
  // (error) ja yli 0,080 punainen (blunder). Kuutiopäätöksistä ei ole menetyksen suuruutta, joten
  // ne jäävät värittä. Kesken pelin väri tulee analyysin valmistuttua (Tommi 24.11.2026), omille
  // siirroille Tutor-tilassa ja botin siirroille kytkimellä botAnalysis, kuten Arvio-paneelissa.
  const ended = !live || game.over;
  const lossClass = d => {
    if (d?.k !== 'move' || !d.r) return null;
    if (!ended && !(d.p === 0 ? opts.analysis : opts.botAnalysis)) return null;
    const loss = 2 * (d.r.best - d.r.played);
    return loss > 0.08 ? 'gl-blunder' : loss > 0.02 ? 'gl-error' : null;
  };
  // Heiton onni rivin loppuun gnubg:n tapaan (src/vienti.mjs luckMarkOf, sama HTML-viennissä).
  // Kesken pelin samat kytkimet kuin väreillä.
  const luckMark = d => {
    if (d?.k !== 'move') return null;
    if (!ended && !(d.p === 0 ? opts.analysis : opts.botAnalysis)) return null;
    const m = luckMarkOf(d.luck);
    return m && { text: m.text, cls: 'gl-' + m.cls, label: T.luckMarks[m.idx] };
  };
  list.textContent = '';
  navOrder = [];
  let selected = null;
  for (const r of x.log) {
    const row = document.createElement('div');
    row.className = 'gl-row';
    const n = document.createElement('span');
    n.className = 'gl-n';
    n.textContent = r.n === '' ? '' : `${r.n})`;
    const lines = document.createElement('div');
    let es = [{ p: 0, t: r.me, d: r.meD }, { p: 1, t: r.bot, d: r.botD }].filter(e => e.t !== '');
    if (es.length === 2 && es[0].d !== undefined && es[1].d !== undefined && es[1].d < es[0].d) es = es.reverse();
    for (const e of es) {
      const b = document.createElement('button');
      b.className = 'gl-line';
      const dot = document.createElement('span');
      dot.className = e.p === 0 ? 'dot me' : 'dot bot';
      const t = document.createElement('span');
      t.textContent = e.t + (x.decisions?.[e.d]?.mark ? ' ✱' : '');
      b.append(dot, t);
      const lc = e.d === undefined ? null : lossClass(x.decisions?.[e.d]);
      if (lc) b.classList.add(lc);
      const lm = e.d === undefined ? null : luckMark(x.decisions?.[e.d]);
      if (lm) {
        const m = document.createElement('span');
        m.className = 'gl-luck ' + lm.cls;
        m.textContent = lm.text;
        m.title = lm.label;
        b.appendChild(m);
      }
      b.setAttribute('aria-label', `${namesOf(x)[e.p]}: ${e.t}${lm ? `, ${lm.label}` : ''}`);
      if (e.d === undefined || !x.decisions?.[e.d]) b.disabled = true;
      else {
        navOrder.push(e.d);
        b.dataset.d = String(e.d);
        if (sel.d === e.d) { b.classList.add('sel'); selected = b; }
        b.addEventListener('click', () => select(e.d));
      }
      lines.appendChild(b);
    }
    row.append(n, lines);
    list.appendChild(row);
  }
  if (selected) selected.scrollIntoView({ block: 'nearest' });
  else if (live) list.scrollTop = 1e6;
}
// Nuolinäppäimet ylös ja alas askeltavat valittuja rivejä.
function stepSel(k) {
  if (!navOrder.length) return;
  const i = navOrder.indexOf(sel.d);
  const j = i < 0 ? (k > 0 ? 0 : navOrder.length - 1) : Math.max(0, Math.min(navOrder.length - 1, i + k));
  sel.d = navOrder[j];
  render();
}

// Laudalla näytettävä asema valitulta riviltä: asema ennen siirtoa tai kuutiopäätöstä, heitto ja
// pelatun siirron nuolet. Näyttöolio on samaa muotoa kuin peli, mutta vaihe on 'view'.
function viewGame() {
  if (!viewing()) return null;
  const x = selRec(), d = x.decisions[sel.d];
  const dice = d.k === 'move' ? d.dice : null;
  return {
    s: [Int8Array.from(d.s[0]), Int8Array.from(d.s[1])], cube: d.cube ?? newCube(), crawford: !!x.crawford, dmp: x.limit === 1,
    turn: d.p, phase: 'view', over: false, dice, diceOwner: d.p,
    order: dice ? (dice[0] === dice[1] ? Array(4).fill(dice[0]) : [...dice]) : [],
    botUsed: [], partial: [], partialDice: [], hitsMarks: [], lastBot: [], botMoves: null,
    viewMoves: d.k === 'move' ? d.moves ?? null : null, viewP: d.p, mark: d.mark ?? null,
  };
}

// PR kuten XG:ssä: keskimääräinen virhe pakottamatonta siirtoa kohden kertaa 500. Mukana ovat
// vain omat siirrot, koska kuutiopäätöksille ei lasketa equityeroa.
function pr(list) {
  const n = list.reduce((a, x) => a + (x.analysed ?? 0), 0);
  return n ? T.pr(500 * list.reduce((a, x) => a + (x.totalLoss ?? 0), 0) / n) : T.prNone;
}
function renderResults() {
  const cur = liveGame();
  $('gamesPlayed').textContent = String(match.done ?? 0);
  const inMatch = played.filter(x => x.match === match.id && x.when !== cur.when);
  $('matchPR').textContent = pr([cur, ...inMatch]);
  $('gamePR').textContent = pr([selRec()]);
}
$('clearHistory').addEventListener('click', async () => {
  if (!played.length || !(await confirmBox(T.clearConfirm))) return;
  played.length = 0;
  store.set('ab-pelatut', played);
  sel = { when: null, d: null };
  fillGameSel();
  render();
});

// Arvio-paneeli. Kesken pelin näkyy sama kuin päättyneessä pelissä: voittotodennäköisyys, equity,
// ero parhaaseen, heiton onni ja kuutiopäätösten arvio. Tommi purki 24.11.2026 debuggausta varten
// 10.11.2026 tehdyn rajauksen, jonka mukaan analyysi ei kertonut kesken pelin, kannattaako tuplata
// (Kaanon §5). Omat päätökset näkyvät Tutor-tilassa (kytkin analysis), ja ilman valintaa
// viimeisin oma siirto. Botin päätökset näkyvät kytkimellä botAnalysis.
const para = (box, text) => { const p = document.createElement('p'); p.textContent = text; box.appendChild(p); return p; };
const signed = x => (x >= 0 ? '+' : '−') + fmt(Math.abs(x));
function renderEval() {
  const box = $('evalBox');
  box.textContent = '';
  const picked = sel.d !== null ? selRec().decisions?.[sel.d] : null;
  if (picked) markLine(box, picked);
  if (review && !opts.importAnalysis) { para(box, T.evalReview); return; }
  if (review?.stale || review?.paused) {
    para(box, review.stale ? T.analysisStale(review.net.replace(/^.*\//, '')) : T.analysisPaused);
    const b = document.createElement('button');
    b.textContent = review.stale ? T.analysisRedo : T.analysisResume;
    b.addEventListener('click', review.stale ? reanalyse : resumeAnalysis);
    box.appendChild(b);
  }
  const x = selRec(), live = x === liveGame() && !x.over;
  if (!picked && live && HUMAN_PHASES.has(x.phase)) liveMarkLine(box);
  let d = sel.d !== null ? x.decisions?.[sel.d] : null;
  if (!d) {
    // Aseman linkki ilman noppia: siirtäjän voitto ja verkon kuutiopäätös ennen heittoa.
    if (review?.m.link && !x.decisions.length) {
      const st = review.steps[0], h = review.h, g = reviewGame(), p = g.turn === h ? 0 : 1;
      const s = [Int8Array.from(st.s[h]), Int8Array.from(st.s[1 - h])];
      const cube = { value: st.cube.value, owner: st.cube.owner === -1 ? -1 : st.cube.owner === h ? 0 : 1 };
      para(box, T.linkRoll(whoName(p), T.pct(x.cubePolicy.winProb(s, p)), !g.crawford && mayDouble(cube, p) ? x.cubePolicy.double(s, p, cube) : null));
      return;
    }
    if (!live) {
      renderSummary(box, x);
      para(box, x.decisions?.length ? T.evalPick : T.decisionsNone);
      return;
    }
    if (!opts.analysis) { para(box, T.evalTutorOff); return; }
    d = [...(x.decisions ?? [])].reverse().find(y => y.k === 'move' && y.p === 0);
    // Tuonnin vihje tyhjään paneeliin, koska analyysi on pelaajille vaikea löytää (DailyGammonin
    // palaute 23.11.2026, Kaanon YHTEYDENOTTO_FORUM64419 kohta 5).
    if (!d) { para(box, T.evalNone); para(box, T.evalImportHint); return; }
  }
  if (live && d.p === 0 && !opts.analysis) { para(box, T.evalTutorOff); return; }
  // Kesken pelin valitun botin siirron linkin voi kopioida, vaikka analyysi näkyy vasta pelin jälkeen
  // (Tommi 24.11.2026). Linkin avaaja näkee analyysin. Kytkimen botAnalysis kanssa botin siirto
  // näkyy kuten omasi. Ennen kytkintä tai sivun latausta pelatut siirrot analysoidaan valittaessa.
  if (live && d.p === 1 && !opts.botAnalysis) { para(box, T.evalBotLater); if (picked) linkButton(box, () => decisionLink(d)); return; }
  if (live && d.p === 1 && d.k === 'move') analyseBot(d);
  if (d.k !== 'move') { renderCubeEval(box, d); return; }
  // Kesken pelin heiton onni lasketaan valittaessa (0-ply, noin 10 ms). Jälkianalyysi ohittaa sen.
  if (live && d.luck === undefined && d.s && d.dice) d.luck = rollLuck(net, [Int8Array.from(d.s[0]), Int8Array.from(d.s[1])], d.p, d.dice[0], d.dice[1]);
  const who = whoName(d.p), mine = d.p === 0 && !review;
  const played = d.text.split(': ')[1] ?? d.text;
  const luck = () => { if (d.luck !== undefined) para(box, T.luckLine(signed(d.luck))); };
  if (d.forced) { para(box, T.evalTitle(d.n, who, d.text)); para(box, d.text.includes('/') ? T.evalForced : T.evalDance); luck(); return; }
  if (!d.r) { para(box, mine ? T.noteWait(d.text) : T.evalTitle(d.n, who, d.text) + ' ' + T.evalWait); luck(); return; }
  const loss = Math.max(0, 2 * (d.r.best - d.r.played)), lv = level(loss);
  para(box, mine
    ? (lv ? T.noteBad(d.text, T.levels[lv[2]], fmt(loss)) : loss < SAME ? T.noteSame(d.text) : T.noteGood(d.text, fmt(loss)))
    : T.evalTitle(d.n, who, d.text));
  const rows = d.r.top.map(t => ({ m: t.m, x: t.x, loss: t.loss, played: false }));
  if (!d.open) {
    let k = rows.findIndex(r => r.m === played);
    if (k < 0) k = rows.findIndex(r => Math.abs(r.x - d.r.played) < 1e-12);
    if (k >= 0) rows[k].played = true;
    else rows.push({ m: played, x: d.r.played, loss, played: true });
  }
  const table = document.createElement('table');
  table.className = 'eval';
  const head = table.insertRow();
  T.evalHead.forEach((c, i) => { const th = document.createElement('th'); th.textContent = c; if (i > 0) th.className = 'num'; head.appendChild(th); });
  for (const r of rows) {
    const tr = table.insertRow();
    const best = r.loss < SAME;
    tr.className = (best ? 'best' : 'worse') + (r.played ? ' played' : '');
    const cells = [(r.played && best ? '✓ ' : '') + r.m];
    cells.push(T.pct(r.x), signed(2 * r.x - 1));
    cells.push(best ? '' : '−' + fmt(r.loss));
    cells.forEach((c, i) => { const td = tr.insertCell(); td.textContent = c; td.className = i === 0 ? 'mv' : 'num'; });
  }
  box.appendChild(table);
  luck();
  para(box, T.evalHelp).className = 'caption';
  allMoves(box, d, played);
  rollMap(box, d);
  // Aseman linkki analysoidusta siirrosta pelattuine siirtoineen. Nappi näkyy, kun siirto on valittu
  // siirtolistasta, myös kesken pelin (Tommi 24.11.2026).
  if (picked) linkButton(box, () => decisionLink(d));
}

// Kaikki lailliset siirrot 0-plyllä (Tommin tilaus 25.11.2026: kolme parasta ei riitä). Lista on
// oma taulukkonsa, koska analyysin rivit ovat pelin syvyydellä ja nämä 0-plyllä. Ero on etäisyys
// 0-plyn parhaaseen. Avattu lista pysyy auki, kunnes päätös vaihtuu.
const allOpen = new WeakSet();
function allMoves(box, d, played) {
  if (!d.s || !d.dice) return;
  const b = document.createElement('button');
  b.textContent = allOpen.has(d) ? T.allMovesHide : T.allMovesShow;
  b.addEventListener('click', () => { if (allOpen.has(d)) allOpen.delete(d); else allOpen.add(d); render(); });
  box.appendChild(b);
  if (!allOpen.has(d)) return;
  const base = [Int8Array.from(d.s[0]), Int8Array.from(d.s[1])];
  const plays = legalPlays(base, d.p, d.dice[0], d.dice[1]);
  const ranked = plays.map(pl => ({ moves: pl.moves, x: exited(pl.s[d.p]) ? 0 : value(net, pl.s, d.p), k: key(pl.s) }))
    .sort((a, b) => b.x - a.x);
  const after = d.after ? key([Int8Array.from(d.after[0]), Int8Array.from(d.after[1])]) : null;
  const shown = topMoves(base, d.p, d.dice, ranked, ranked[0].x);
  const table = document.createElement('table');
  table.className = 'eval';
  const head = table.insertRow();
  T.evalHead.forEach((c, i) => { const th = document.createElement('th'); th.textContent = c; if (i > 0) th.className = 'num'; head.appendChild(th); });
  shown.forEach((r, i) => {
    const tr = table.insertRow();
    const best = r.loss < SAME, isPlayed = !d.open && (after ? ranked[i].k === after : r.m === played);
    tr.className = (best ? 'best' : 'worse') + (isPlayed ? ' played' : '');
    [r.m, T.pct(r.x), signed(2 * r.x - 1), best ? '' : '−' + fmt(r.loss)]
      .forEach((c, j) => { const td = tr.insertCell(); td.textContent = c; td.className = j === 0 ? 'mv' : 'num'; });
  });
  para(box, T.allMovesCaption(plays.length)).className = 'caption';
  box.appendChild(table);
}

// Heittokartta (Tommin tilaus 25.11.2026, analyysiohjelmien värikartan malli): kaikki 36 heittoa
// ruudukkona ennen siirtoa. Ruudun luku on heiton onni eli verkon arvio heiton parhaasta siirrosta
// miinus kaikkien heittojen keskiarvo, equityinä. Rivi on ensimmäinen noppa ja sarake toinen, joten
// sekaheitto näkyy kahdesti. Toteutunut heitto on kehystetty, ja ruudun vihje näyttää parhaan
// siirron. Kartta lasketaan 1-plyllä (noin sekunti) ja napista 2-plyllä (15–35 s) omassa
// säikeessään (Tommin valinta 25.11.2026). Valmis kartta muistetaan päätöksen ajan. 1-ply-kartta
// näkyy, kunnes 2-ply valmistuu.
const maps = new WeakMap();
let mapWorker;
function startMap(d, depth) {
  const all = maps.get(d) ?? {};
  maps.set(d, all);
  if (all[depth]) return all[depth];
  const st = all[depth] = { cells: new Map(), done: false };
  const base = [Int8Array.from(d.s[0]), Int8Array.from(d.s[1])];
  const put = ({ a, c, x, moves }) => {
    st.cells.set(`${a}${c}`, { x, moves });
    const el = document.getElementById(`rollmapWait${depth}`);
    if (el) el.textContent = T.rollMapWait(depth, st.cells.size);
  };
  // Ruudut, joita säie ei laskenut, lasketaan sivulla.
  const fill = () => {
    for (let a = 1; a <= 6; a++) for (let c = a; c <= 6; c++) if (!st.cells.has(`${a}${c}`)) put({ a, c, ...rollBest(net, base, d.p, a, c, depth) });
    st.done = true;
  };
  if (mapWorker === undefined) mapWorker = spawn();
  if (!mapWorker) { fill(); return st; }
  // Selaimen välimuistista tullut vanha säie ei tunne heittokarttaa ja vastaa ilman ruutuja, jolloin
  // kartta kaatui (selainpaneeli 25.11.2026). Uusi sivu ja vanha säie voivat kohdata myös julkaisun jälkeen.
  askStream(mapWorker, { kind: 'rollmap', s: base, p: d.p, ply: depth }, put).then(() => { fill(); render(); });
  return st;
}
function rollMap(box, d) {
  if (!d.s || !d.dice) return;
  const one = startMap(d, 1), two = maps.get(d)?.[2];
  const shown = two?.done ? two : one.done ? one : null;
  const wait = depth => {
    const st = maps.get(d)[depth];
    const el = para(box, T.rollMapWait(depth, st.cells.size));
    el.id = `rollmapWait${depth}`;
    el.className = 'caption';
  };
  if (!shown) { wait(1); return; }
  const depth = shown === two ? 2 : 1;
  const base = [Int8Array.from(d.s[0]), Int8Array.from(d.s[1])];
  const cell = (a, c) => shown.cells.get(a <= c ? `${a}${c}` : `${c}${a}`);
  let sum = 0;
  for (let a = 1; a <= 6; a++) for (let c = 1; c <= 6; c++) sum += cell(a, c).x;
  const mean = sum / 36;
  const table = document.createElement('table');
  table.className = 'rollmap';
  const cap = table.createCaption();
  cap.textContent = T.rollMapTitle(depth);
  const head = table.insertRow();
  head.appendChild(document.createElement('th'));
  for (let c = 1; c <= 6; c++) { const th = document.createElement('th'); th.textContent = c; head.appendChild(th); }
  for (let a = 1; a <= 6; a++) {
    const tr = table.insertRow();
    const th = document.createElement('th'); th.textContent = a; tr.appendChild(th);
    for (let c = 1; c <= 6; c++) {
      const { x, moves } = cell(a, c);
      const l = 2 * (x - mean);
      const td = tr.insertCell();
      td.textContent = (l >= 0 ? '+' : '−') + Math.abs(l).toFixed(2).replace(/^0/, '');
      // Väri: onnekas sininen ja epäonninen ruskea kuten onnen merkit, voimakkuus 0,3 equityyn asti.
      const w = Math.min(1, Math.abs(l) / 0.3);
      td.style.background = `color-mix(in srgb, var(${l >= 0 ? '--lucky' : '--unlucky'}) ${Math.round(w * 70)}%, transparent)`;
      if ((a === d.dice[0] && c === d.dice[1]) || (a === d.dice[1] && c === d.dice[0])) td.className = 'got';
      const m = moves.length ? topMoves(base, d.p, [a, c], [{ moves, x }], x)[0].m : T.rollMapNoMove;
      td.title = T.rollMapCell(a, c, signed(l), m);
    }
  }
  box.appendChild(table);
  if (!two) {
    const b = document.createElement('button');
    b.textContent = T.rollMapDeeper;
    b.addEventListener('click', () => { startMap(d, 2); render(); });
    box.appendChild(b);
  } else if (!two.done) wait(2);
  para(box, T.rollMapHelp).className = 'caption';
}

// Linkin kopiointinappi ja ilmoitus. Jos leikepöytä ei ole käytettävissä, linkki näytetään valittuna.
function linkButton(box, make) {
  const b = document.createElement('button');
  b.textContent = T.copyLink;
  const msg = document.createElement('p');
  msg.className = 'caption';
  b.addEventListener('click', async () => {
    const url = make();
    try { await navigator.clipboard.writeText(url); msg.textContent = T.linkCopied; }
    catch { msg.textContent = url; }
  });
  box.append(b, msg);
}
// Julkiselta laudalta linkki osoittaa lyhyeen ohjaussivuun, koska DailyGammonin foorumi rivittää
// viestin noin 72 merkin kohdalta ja tunnistaa linkiksi vain http-osoitteen (Tommi 24.11.2026).
// Paikallisessa kehityksessä linkki osoittaa samaan sivuun, jotta sen voi kokeilla.
const LINK_BASE = location.hostname === 'tommihaa.github.io' ? 'http://tommihaa.github.io/abg/#' : `${location.origin}${location.pathname}#`;
const linkURL = frag => LINK_BASE + frag;
// Vastustajabotti linkkiin (Tommi 24.11.2026): verkon kirjain ja syvyys. Omassa pelissä botti on
// pelaaja 1, aseman linkin selauksessa linkin botti. Tuodussa ottelussa bottia ei ole.
function linkBot(x, d) {
  if (review) return review.m.bot ?? null;
  const code = NET_CODE[x.net ?? NET_FILE];
  return code ? { ply: d?.ply ?? ply, code } : null;
}
// Päätöksen asema ennen siirtoa, nopat ja pelattu siirto. Pisteet ja pituus ovat pelin alun.
function decisionLink(d) {
  const x = selRec();
  const pen0 = review ? [reviewGame().scores[review.h], reviewGame().scores[1 - review.h]] : x.score ?? pen;
  const limit = review ? reviewLimit() : x.limit;
  const s = [Int8Array.from(d.s[0]), Int8Array.from(d.s[1])];
  // Selauksessa Crawford on tuodun pelin (aseman linkki) tai DMP:n, jossa jokainen peli on Crawford-peli.
  const crawford = review ? !!reviewGame().crawford || review.kind === 'dmp' : !!x.crawford;
  return linkURL(linkFragment({ s, cube: d.cube, turn: d.p, dice: d.dice, pen: pen0, crawford, limit }, d.open ? null : d.moves, linkBot(x, d)));
}
// Aseman merkintä (Tommin tilaus 18.11.2026): pelaaja merkitsee valitun rivin aseman ja voi
// kirjoittaa huomautuksen, esimerkiksi miksi botin siirto näyttää väärältä. Merkintä kuuluu
// päätökseen eli asemaan ennen siirtoa tai kuutiopäätöstä. Omissa peleissä se on päätöksen
// kenttä mark = { text }, joten se tallentuu pelin mukana ja analyysitiedoston game-kenttään.
// Tuodussa ottelussa merkinnät ovat review.marks-oliossa teon avaimella (sama kuin analyysissä),
// koska päätökset rakennetaan ottelutekstistä uudelleen. Arvo null poistaa tiedoston (.sgf)
// oman merkinnän. HTML-vienti näyttää merkinnät ja niiden luettelon.
const markLabel = m => (m.text ? T.reviewMarkText(m.text) : T.markPlain);
function markLine(box, d) {
  if (d.mark) para(box, markLabel(d.mark)).className = 'mark-note';
  const b = document.createElement('button');
  b.textContent = d.mark ? T.markEdit : T.markAdd;
  b.addEventListener('click', () => editMark(d));
  box.appendChild(b);
}
// Merkintä kesken pelin (Tommin tilaus 18.11.2026): omalla vuorolla merkitään laudalla oleva
// asema ennen kuin päätös on kirjattu. Merkintä odottaa kentässä game.pendingMark ja liitetään
// seuraavaan pelaajan päätökseen (decide): ennen heittoa kuutiopäätökseen, heiton jälkeen
// siirtoon ja botin tuplauksen jälkeen ottopäätökseen. Ennen heittoa ilman tuplausmahdollisuutta
// päätöstä ei kirjata, joten merkintä siirtyy heiton jälkeiseen siirtoon.
const HUMAN_PHASES = new Set(['roll', 'move', 'pass', 'offer']);
function liveMarkLine(box) {
  const m = game.pendingMark;
  if (m) para(box, markLabel(m)).className = 'mark-note';
  const b = document.createElement('button');
  b.textContent = m ? T.markEdit : T.markAdd;
  b.addEventListener('click', async () => {
    const v = await markBox(T.markNow, m?.text ?? '', !!m);
    if (v === undefined) return;
    if (v) game.pendingMark = v; else delete game.pendingMark;
    render();
  });
  box.appendChild(b);
}
function markBox(title, text, removable) {
  const dlg = $('markBox');
  $('markPrompt').textContent = T.markPrompt(title);
  $('markText').value = text;
  $('markRemove').hidden = !removable;
  return new Promise(res => {
    const done = v => { $('markSave').onclick = $('markRemove').onclick = $('markCancel').onclick = dlg.oncancel = null; dlg.close(); res(v); };
    $('markSave').onclick = () => done({ text: $('markText').value.trim() });
    $('markRemove').onclick = () => done(null);
    $('markCancel').onclick = () => done(undefined);
    dlg.oncancel = ev => { ev.preventDefault(); done(undefined); };
    dlg.showModal();
    $('markText').focus();
  });
}
async function editMark(d) {
  const x = selRec();
  const v = await markBox(T.evalTitle(d.n, whoName(d.p), d.text ?? cubeLabel(T, d.act, d.value)), d.mark?.text ?? '', !!d.mark);
  if (v === undefined) return;
  if (v) d.mark = v; else delete d.mark;
  if (x.imported && review?.rec === x) {
    review.marks[d.key] = v ? v.text : null;
    saveImported();
    // Pelivalitsimen tähti päivittyy.
    fillReview();
    $('reviewGame').value = String(review.gi);
    showStep();
  } else if (!x.imported) {
    if (x === game && game.over) saveFinished();
    else if (x !== game) store.set('ab-pelatut', played);
  }
  render();
}
// Tuodun ottelun teon merkintä: laudalla tehty tai poistettu ensin, sitten tiedoston oma.
function importedMark(gi, k) {
  const key = `${gi}:${k}`;
  if (key in review.marks) return review.marks[key] === null ? null : { text: review.marks[key] };
  const a = review.m.games[gi].actions[k];
  return a?.mark ? { text: a.mark.text } : null;
}

// Heittojen onni yhteensä kummallekin pelaajalle (sovelluksen yhteenveto ja vienti).
function luckLines(decisions, name) {
  const out = [];
  for (const p of [0, 1]) {
    const ls = decisions.filter(d => d.k === 'move' && d.p === p && d.luck !== undefined).map(d => d.luck);
    if (ls.length) out.push(T.luckSum(name(p), signed(ls.reduce((a, b) => a + b, 0)), ls.length));
  }
  return out;
}
// Siirtäjän nimi Arvio-paneeliin: selauksessa tuodun pelin pelaaja, muuten sinä tai botti.
function whoName(p) {
  if (!review) return namesOf(selRec())[p];
  return reviewGame().players[p === 0 ? review.h : 1 - review.h];
}
// Kuutiopäätös päättyneestä pelistä: päättäjän voittotodennäköisyys ja verkon valinta.
function renderCubeEval(box, d) {
  if (d.w === undefined) { para(box, T.evalTitle(d.n, whoName(d.p), d.text) + ' ' + T.evalWait); return; }
  const cube = (act, v) => (act === 'double' ? T.logDouble(2 * v) : act === 'take' ? T.logTake : act === 'drop' ? T.logDrop : T.noDouble);
  const mine = d.k === 'cube' ? d.act === 'double' : d.act === 'take';
  const pick = d.k === 'cube' ? (d.should ? 'double' : 'nodouble') : (d.should ? 'take' : 'drop');
  para(box, T.evalTitle(d.n, whoName(d.p), cube(d.act, d.value)));
  const table = document.createElement('table');
  table.className = 'eval';
  const rows = [[T.cubeHead[0], cube(d.act, d.value)], [T.cubeHead[1], T.pct(d.w)], [T.cubeHead[2], cube(pick, d.value)]];
  for (const [a, b] of rows) {
    const tr = table.insertRow();
    tr.insertCell().textContent = a;
    tr.insertCell().textContent = b;
  }
  const tr = table.insertRow();
  tr.className = mine === d.should ? 'best' : 'worse';
  tr.insertCell().textContent = T.cubeHead[3];
  tr.insertCell().textContent = mine === d.should ? T.sameBest : T.cubeDiff;
  box.appendChild(table);
  // Equityt Janowskin mallilla (src/vienti.mjs cubeEquities), samat kuin HTML-viennissä.
  const eq = document.createElement('table');
  eq.className = 'eval';
  const hr = eq.insertRow();
  T.cubeEqHead.forEach((h, i) => { const th = document.createElement('th'); th.textContent = h; if (i) th.className = 'num'; hr.appendChild(th); });
  for (const [a, b, c, best] of cubeEquityRows(d, T)) {
    const r = eq.insertRow();
    if (best) r.className = 'best';
    [a, b, c].forEach((v, i) => { const td = r.insertCell(); td.textContent = v; if (i) td.className = 'num'; });
  }
  box.appendChild(eq);
  para(box, T.cubeEqNote);
}
function renderPanels() {
  renderGamePanel();
  renderEval();
  renderResults();
}

// Jälkianalyysi: siirrot, joita pelin aikainen analyysi ei kattanut (botin siirrot ja kesken
// jääneet), lasketaan yksi kerrallaan siirron omalla syvyydellä. Tulos tallentuu listaan.
let reviewing = null, runNo = 0;
async function analyseRecord(x) {
  if (reviewing === x) return;
  reviewing = x;
  const run = ++runNo, prog = x.imported ? progress(x) : null;
  // Tuodun pelin tulos talteen teon mukaan, jotta pelaajan vaihto ja uusi avaus eivät laske uudelleen.
  const keep = (d, v) => { if (x.imported) review?.done.set(d.key, { ...review.done.get(d.key), ...v }); };
  let lucky = 0;
  for (const d of x.decisions ?? []) {
    // Tuodun pelin analyysi loppuu, kun selaus sulkeutuu, peli tai pelaaja vaihtuu, kytkin menee
    // pois tai analyysi perutaan.
    if (x.imported && (review?.rec !== x || !opts.importAnalysis || review.paused || run !== runNo)) break;
    if (x.imported && d.k !== 'move' && d.w === undefined) { cubeEval(x, d); continue; }
    if (d.k !== 'move' || !d.s || !d.dice) continue;
    const base = [Int8Array.from(d.s[0]), Int8Array.from(d.s[1])];
    // Heiton onni 0-ply:llä sivulla (noin 10 ms heittoa kohden), myös pakkosiirroille ja tansseille.
    // Tauko 20 heiton välein antaa sivun piirtyä.
    if (d.luck === undefined) {
      d.luck = rollLuck(net, base, d.p, d.dice[0], d.dice[1]);
      keep(d, { luck: d.luck });
      if (++lucky % 20 === 0) { if (selRec().decisions === x.decisions) renderPanels(); await new Promise(res => setTimeout(res, 0)); }
    }
    if (d.r || d.forced) continue;
    const after = [Int8Array.from(d.after[0]), Int8Array.from(d.after[1])];
    const depth = d.ply ?? 0, w = depth > 0 ? reviewW() : null;
    const r = w ? await ask(w, { kind: 'analyse', s: base, p: d.p, d1: d.dice[0], d2: d.dice[1], played: after, ply: depth })
      : rankPlays(net, base, d.p, d.dice[0], d.dice[1], after, depth);
    if (!r) d.forced = true;
    // Avoimella siirrolla ei ole pelattua siirtoa, joten virhettä ei ole.
    else d.r = { best: r.best, played: d.open ? r.best : r.played, top: topMoves(base, d.p, d.dice, r.top, r.best) };
    if (x.imported) {
      keep(d, { r: d.r, forced: d.forced, ply: d.ply });
      countImported(x, d);
      prog?.tick();
      // Tallennus 20 siirron välein, jotta sivun sulkeminen kesken ei hävitä kaikkea.
      if (review?.rec === x && review.done.size % 20 === 0) saveImported();
    }
    else store.set('ab-pelatut', played);
    if (selRec().decisions === x.decisions) renderPanels();
    // Sivulla laskettaessa tauko antaa sivun piirtyä. Säikeen vastaus odotetaan jo, ja tauko
    // hidastaisi taustavälilehdessä, jossa selain kuristaa ajastimet sekunnin välein.
    if (!w) await new Promise(res => setTimeout(res, 0));
  }
  if (run === runNo) prog?.end();
  if (x.imported && review?.rec === x) saveImported();
  if (!x.imported && lucky) store.set('ab-pelatut', played);
  if (lucky && selRec().decisions === x.decisions) renderPanels();
  if (reviewing === x) reviewing = null;
}

// Tuodun ottelun analyysin etenemisikkuna (Tommin valinta 14.11.2026, modaali): palkki, siirtojen
// määrä, aika-arvio ja Peruuta. Aika-arvio on tähänastinen keskimääräinen aika siirtoa kohden
// kertaa jäljellä olevat siirrot, ja se näytetään kahden siirron jälkeen. Ikkuna ei aukea, jos
// analysoitavaa ei ole.
const ETA_AFTER = 2;
function progress(x) {
  const total = x.decisions.filter(d => d.k === 'move' && !d.r && !d.forced).length;
  if (!total) return null;
  const box = $('analysisBox'), t0 = performance.now();
  let k = 0;
  const show = () => {
    $('analysisTitle').textContent = T.analysisTitle;
    $('analysisBar').max = total;
    $('analysisBar').value = k;
    $('analysisCount').textContent = T.analysisCount(k, total);
    const left = k < ETA_AFTER ? null : Math.ceil((performance.now() - t0) / k * (total - k) / 1000);
    $('analysisEta').textContent = left === null ? T.analysisEtaWait : T.analysisEta(left);
    $('analysisCancel').textContent = T.analysisCancel;
  };
  show();
  box.oncancel = ev => { ev.preventDefault(); cancelAnalysis(); };
  $('analysisCancel').onclick = cancelAnalysis;
  if (!box.open) box.showModal();
  return { tick() { k++; show(); }, end() { box.close(); } };
}
// Peruttu analyysi jää kesken: valmiit siirrot säilyvät, ja Arvio-paneelin Jatka analyysia jatkaa.
function cancelAnalysis() {
  if (review) review.paused = true;
  saveImported();
  runNo++;
  reviewing = null;
  $('analysisBox').close();
  render();
}
// Eri verkolla laskettu analyysi hylätään ja lasketaan nykyisellä verkolla.
function reanalyse() {
  if (!review) return;
  review.done.clear();
  review.net = NET_FILE;
  review.stale = false;
  review.paused = false;
  openRecord();
  render();
}
function resumeAnalysis() {
  if (!review || review.stale) return;
  review.paused = false;
  analyseRecord(review.rec);
}
// Tuodun pelin kuutiopäätös samalla kuutiopolitiikalla kuin botti pelaa: rahapelissä verkon
// rajat, ottelussa voittotaulukko pelin alun pisteistä.
function cubeEval(x, d) {
  const s = [Int8Array.from(d.s[0]), Int8Array.from(d.s[1])], pol = x.cubePolicy;
  if (d.k === 'cube') { d.w = pol.winProb(s, d.p); d.should = pol.double(s, d.p, d.cube); }
  else { d.w = 1 - pol.winProb(s, 1 - d.p); d.should = pol.take(s, d.p, d.cube); }
  review?.done.set(d.key, { w: d.w, should: d.should });
}
// Valitun pelaajan (0) siirrot lasketaan virheyhteenvetoon ja PR:ään kuten omassa pelissä.
function countImported(x, d) {
  if (d.p !== 0 || !d.r || d.open) return;
  const loss = Math.max(0, 2 * (d.r.best - d.r.played));
  x.analysed++;
  x.totalLoss += loss;
  if (level(loss)) x.errors.push({ n: d.n, played: d.text, top: d.r.top, loss });
}

// Verkon kuvaus vientiin ilman tiedostonimen suomenkielisiä termejä (Tommin valinta 14.11.2026:
// kuvaus eikä uutta nimeä). Lähde: Kaanon/Anti-Backgammon/ANTI-BACKGAMMON.md §4 ja
// mittaukset/06-aineisto-ja-viimeistely.md. Tuntematon verkko näytetään tiedostonimellä.
const NET_INFO = { 'verkot/jatko-raw-g4-p3000.json': { base: 'g4', positions: 60000, hidden: 40, passes: 3000 } };
const netLabel = file => (NET_INFO[file] ? T.netDesc(NET_INFO[file]) : file.replace(/^.*\//, ''));
// Otsikkorivi: versio nimen perässä ja kuvauksessa vastustajan verkko (Tommi 18.11.2026: verkko
// oli Asetuksissa liian piilossa). Kutsutaan alussa ja kielen vaihtuessa.
function fillHead() {
  $('ver').textContent = VERSION;
  const sub = $('sub'), more = $('netMore');
  sub.textContent = '';
  const link = document.createElement('button');
  link.type = 'button';
  link.className = 'linklike';
  link.textContent = NET_SHORT[NET_FILE] ?? netLabel(NET_FILE);
  link.title = T.netMoreHint;
  link.setAttribute('aria-controls', 'netMore');
  link.setAttribute('aria-expanded', String(!more.hidden));
  link.addEventListener('click', () => {
    more.hidden = !more.hidden;
    link.setAttribute('aria-expanded', String(!more.hidden));
  });
  sub.append(`${T.static.sub} ${T.opponentLead} `, link, '.');
  // Pitkä kuvaus ja historia (src/historia.mjs) linkin takana, koska ne ovat pitkiä.
  more.textContent = '';
  const h = netHistory(document.documentElement.lang);
  const p = (text, cls) => { const e = document.createElement('p'); e.textContent = text; if (cls) e.className = cls; more.appendChild(e); };
  p(netLabel(NET_FILE));
  p(h.intro);
  for (const [title, rows] of [[h.line, h.lineage], [h.side, h.branches]]) {
    const head = document.createElement('h4');
    head.textContent = title;
    const ol = document.createElement('ol');
    for (const r of rows) {
      const li = document.createElement('li');
      const b = document.createElement('b');
      b.textContent = r.name;
      const st = document.createElement('span');
      st.className = `ng ng-${r.state}`;
      st.textContent = h.state[r.state];
      li.append(b, ` (${r.date}) `, st, ` ${r.text}`);
      ol.appendChild(li);
    }
    more.append(head, ol);
  }
}

// Valitun pelin vienti itsenäiseksi HTML-sivuksi (src/vienti.mjs, Tommin tilaus 14.11.2026):
// lautakuva ja analyysi jokaisesta päätöksestä. Laudan värit ovat valitun lautatyylin vaaleassa
// tilassa. Syvyys luetaan analysoiduista siirroista, koska se voi vaihdella pelin aikana.
function exportGame() {
  const x = selRec();
  if (!x.decisions?.length) return;
  const g = review ? reviewGame() : null;
  const names = review ? [g.players[review.h], g.players[1 - review.h]] : namesOf(x);
  const no = review ? review.gi + 1 : x.no ?? 1;
  const score = review ? [g.scores[review.h], g.scores[1 - review.h]] : x.score ?? [0, 0];
  const limit = review ? reviewLimit() : x.limit ?? null;
  const net = netLabel(review ? review.net : x.net ?? NET_FILE);
  const plies = [...new Set(x.decisions.filter(d => d.r).map(d => d.ply ?? 0))].sort();
  const date = new Date();
  const info = [
    [T.exportInfo[0], T.exportPlayers(names[0], names[1])],
    [T.exportInfo[1], review?.kind === 'dmp' ? T.exportDmp : T.exportMatch(limit, score[0], score[1])],
    [T.exportInfo[2], net],
    [T.exportInfo[3], plies.length ? plies.map(v => `${v}-ply`).join(', ') : T.prNone],
    [T.exportInfo[4], date.toLocaleString(document.documentElement.lang)],
  ];
  // Yhteenveto ja PR kummallekin pelaajalle (Tommin pyyntö 14.11.2026), laskettuna päätöksistä.
  const summary = [];
  for (const p of [0, 1]) {
    const losses = x.decisions.filter(d => d.k === 'move' && d.p === p && d.r).map(d => Math.max(0, 2 * (d.r.best - d.r.played)));
    if (!losses.length) continue;
    const total = losses.reduce((a, b) => a + b, 0);
    const counts = LEVELS.map(([, m, k]) => `${T.levels[k]} ${losses.filter(l => level(l)?.[1] === m).length}`);
    summary.push(`${names[p]}: ${T.summary(losses.length, fmt(total), fmt(total / losses.length), counts.join(', '))}`);
    summary.push(T.exportPR(names[p], T.pr(500 * total / losses.length)));
  }
  if (!summary.length) summary.push(T.summaryNone);
  summary.push(...luckLines(x.decisions, p => names[p]));
  const html = gameHTML({
    T, lang: document.documentElement.lang, title: T.exportTitle(names[0], names[1], no), names, info, summary,
    decisions: x.decisions, look: boardLook(prefs.style, false), signed, style: prefs.style, markLabel,
    crawford: review ? review.kind === 'dmp' : !!x.crawford,
  });
  download(new Blob([html], { type: 'text/html' }), `anti-backgammon-${slug(names[0])}-${slug(names[1])}-${no}.html`);
}
$('exportHtml').addEventListener('click', exportGame);

const slug = s => String(s).normalize('NFKD').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'peli';
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

// Analyysitiedosto (src/analyysitiedosto.mjs, Tommin tilaus 16.11.2026): HTML-viennin rinnalla
// tiedosto, jonka Tuo ottelu -kohta lukee takaisin ilman uudelleenlaskentaa. Tuodusta ottelusta
// viedään koko ottelu (teksti ja kaikkien pelien valmis analyysi), laudalla pelatusta pelistä
// pelin tallenne. Rollout-tulokset kulkevat mukana sellaisinaan.
function exportAnalysis() {
  const x = selRec();
  if (!x.decisions?.length) return;
  let file, name;
  if (review) {
    file = buildAnalysisFile({
      net: review.net, match: { text: review.text, h: review.h, kind: review.kind },
      analysis: Object.fromEntries(review.done), rollouts: review.rollouts, marks: review.marks,
    });
    name = `anti-backgammon-${slug(review.m.players[0])}-${slug(review.m.players[1])}`;
  } else {
    const { rollouts, ...g } = record(x);
    // Ennen nimiä pelatulle pelille kirjataan samat nimet kuin HTML-viennissä.
    g.names ??= namesOf(x);
    file = buildAnalysisFile({ net: g.net, game: g, rollouts });
    name = `anti-backgammon-${slug(namesOf(x)[0])}-${slug(namesOf(x)[1])}-${x.no ?? 1}`;
  }
  download(new Blob([JSON.stringify(file)], { type: 'application/json' }), name + EXT);
}
$('exportFile').addEventListener('click', exportAnalysis);

// Tuonti tunnistaa analyysitiedoston. Muu teksti on ottelu (.mat tai .sgf).
function importAny(text) {
  const f = parseAnalysisFile(text);
  if (f) { importAnalysisFile(f); return; }
  let o = null;
  try { o = JSON.parse(text); } catch { /* ei JSONia */ }
  if (o?.format === FORMAT) { $('importMsg').textContent = T.importNewer; return; }
  importMatch(text);
}
// Tuodun ottelun analyysi yhdistetään laitteen tallennukseen, jos ne on laskettu samalla
// verkolla. Muuten tiedoston analyysi korvaa tallennuksen, ja eri verkolla laskettu näytetään
// merkittynä kuten muutenkin (importMatch, stale). Pelattu peli lisätään pelattujen joukkoon.
function importAnalysisFile(f) {
  if (f.source === 'import') {
    const m = parseMatch(f.match.text);
    if (!m) { $('importMsg').textContent = T.importBad; return; }
    if (!review && game.phase === 'bot') { $('importMsg').textContent = T.reviewBusy; return; }
    const id = textId(f.match.text), old = imported.find(y => y.id === id);
    const same = old && old.net === f.net;
    const x = {
      id, text: f.match.text, when: old?.when ?? Date.now(), players: m.players, length: m.length,
      h: Number.isInteger(f.match.h) ? f.match.h : old?.h ?? 0, net: f.net,
      kind: f.match.kind ?? old?.kind ?? (m.length ? 'match' : 'money'),
      done: same ? { ...old.done, ...f.analysis } : f.analysis,
      rollouts: same ? { ...old.rollouts, ...f.rollouts } : f.rollouts,
      // Merkinnät eivät riipu verkosta, joten tiedoston merkinnät yhdistetään aina.
      marks: { ...(old?.marks ?? {}), ...f.marks },
    };
    if (old) imported.splice(imported.indexOf(old), 1);
    imported.unshift(x);
    imported.length = Math.min(imported.length, IMPORTED_MAX);
    store.set('ab-tuodut', imported);
    importMatch(f.match.text);
    return;
  }
  const g = { ...f.game, net: f.net, rollouts: f.rollouts, when: f.game.when ?? Date.now() };
  const k = played.findIndex(y => y.when === g.when);
  if (k >= 0) played[k] = g; else played.unshift(g);
  played.length = Math.min(played.length, PLAYED_MAX);
  store.set('ab-pelatut', played);
  if (review) closeReview();
  sel = { when: g.when, d: null };
  fillGameSel();
  // Kesken jäänyt analyysi jatkuu kuten pelivalitsimesta avatulla pelillä.
  analyseRecord(selRec());
  render();
  $('importMsg').textContent = T.importPlayed;
}

// Botin viivästetty vuoro kuuluu sille pelille, jossa se ajastettiin. Ilman tätä luovutus ja uusi
// peli ennen ajastimen laukeamista antaisivat uudelle pelille vanhan pelin botin siirron.
function later(fn, ms) {
  const g = game;
  setTimeout(() => { if (game === g) fn(); }, ms);
}

function roll() { return [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]; }

// Pelin päätökset jälkianalyysia varten (Tommin tilaus 1.11.2026: siirrot ja kuutiopäätökset
// voittoprosentteineen pelin jälkeen, molempien pelaajien). Siirrosta kirjataan asema ennen ja
// jälkeen, nopat ja syvyys. Analyysi täydentyy myöhemmin (r tai forced). Kuutiopäätöksestä
// kirjataan heti päättäjän voittotodennäköisyys ja verkon kuutiopolitiikan suositus samalla
// politiikalla kuin botti pelaa. Asemat ovat tavallisina taulukkoina, jotta ne tallentuvat.
const plain = st => [Array.from(st[0]), Array.from(st[1])];
function decide(d) {
  if (d.p === 0 && game.pendingMark) { d.mark = game.pendingMark; delete game.pendingMark; }
  game.decisions?.push(d);
  return d;
}
// Viimeksi kirjatun päätöksen indeksi Peli-paneelin riviä varten, tai undefined.
const lastDecision = () => (game.decisions?.length ? game.decisions.length - 1 : undefined);
// Siirtonumero, jonka p:n seuraava heitto saa (vrt. finishHumanMove ja botTurn): ihmisen siirto
// aloittaa aina uuden rivin, ja botin siirto liittyy riville, jolla on vain ihmisen siirto.
// Kuutiopäätös kuuluu tuplaajan seuraavaan heittoon, joten se saa saman numeron.
function nextMoveNo(p) {
  const last = game.log[game.log.length - 1];
  return p === 1 && last && last.bot === '' && last.me !== '' ? game.moveNo : game.moveNo + 1;
}
// Tuplaaja p ennen heittoaan: tuplasiko (act) ja olisiko verkko tuplannut.
function cubeDecision(p, act) {
  decide({ k: 'cube', p, n: nextMoveNo(p), act, s: plain(game.s), cube: { ...game.cube }, value: game.cube.value, w: botCube.winProb(game.s, p), should: botCube.double(game.s, p, game.cube) });
}
// Ottaja q tuplauksen jälkeen, kuutio vielä ennen tuplausta.
function takeDecision(q, act) {
  decide({ k: 'take', p: q, n: nextMoveNo(1 - q), act, s: plain(game.s), cube: { ...game.cube }, value: game.cube.value, w: 1 - botCube.winProb(game.s, 1 - q), should: botCube.take(game.s, q, game.cube) });
}

function beginHumanMove() {
  game.turn = 0;
  game.base = clone(game.s);
  game.plays = withDice(legalPlays(game.s, 0, game.dice[0], game.dice[1], true), game.dice[0], game.dice[1]);
  game.partial = []; game.partialDice = []; game.hitsMarks = [];
  // forcedN on automaattisesti asetettujen pakkosiirtojen määrä. Niitä ei voi kumota, koska ne
  // ovat mukana jokaisessa laillisessa siirrossa (Tommin havainto 13.11.2026).
  game.forcedN = 0;
  game.diceOwner = 0;
  const [d1, d2] = game.dice;
  game.order = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
  game.phase = 'move';
  if (game.plays.every(p => p.moves.length === 0)) {
    game.phase = 'pass';
    game.msg = T.noLegal(`${game.dice[0]}${game.dice[1]}`);
    if (opts.forced) autoFinish();
    return;
  }
  if (!opts.forced) return;
  placeForced();
  game.forcedN = game.partial.length;
  if (nextMoves().length === 0) autoFinish();
}

// Pelaa pakkosiirrot puolestani (Tommin valinta 14.11.2026, korvasi asetuksen joka vain asetti
// ne): kun siirtoa ei ole tai laillinen siirto on yksi, vuoro päättyy itsestään. Viive jättää
// heiton ja asetetut nappulat näkyviin ennen botin vuoroa.
const AUTO_FINISH_MS = 900;
function autoFinish() {
  // Puolivuoron numero estää laukeamisen myöhemmällä vuorolla, jos pelaaja ehti vahvistaa itse.
  const ph = game.phase, half = game.half;
  later(() => {
    if (game.turn !== 0 || game.over || game.phase !== ph || game.half !== half) return;
    if (ph === 'pass') pass();
    else if (nextMoves().length === 0) finishHuman();
  }, AUTO_FINISH_MS);
}

// Pakolliset osasiirrot: ne jotka ovat mukana jokaisessa laillisessa siirrossa, monijoukkojen
// leikkauksena (DG Androidin CompositionSession.forcedSteps). Ne asetetaan siinä järjestyksessä
// kuin ne ovat tarjolla. Valmis jää pelaajalle, ellei koko siirto ole pakotettu.
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
  if (edit || dragEnded || viewing() || game.over || game.turn !== 0 || game.phase !== 'move') return;
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
  if (viewing()) return;
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
  // Automaattiheiton jälkeen botin siirron merkinnät näkyvät ensimmäiseen omaan osasiirtoon asti.
  if (game.autoRolled && !auto) { game.autoRolled = false; game.lastBot = []; }
  game.partial.push([from, to]);
  game.partialDice.push(die);
  game.hitsMarks.push(applyMove(game.s, 0, from, to));
  if (auto) return;
  sound('checker');
  if (exited(game.s[0])) { finishHuman(); return; }
  render();
}

function undo() {
  if (game.turn !== 0 || game.partial.length <= (game.forcedN ?? 0)) return;
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
function analyse(base, dice, played, row, moveNo, dec) {
  const g = game;
  rankMove(base, dice[0], dice[1], clone(game.s)).then(r => {
    // Seuraavan pelin aikana valmistunut analyysi kirjataan päättyneeseen peliin, joka on
    // pelattujen listassa (Tommin havainto 1.11.2026: edellisen pelin analyysi katosi).
    const done = () => { if (game === g) render(); else if (g.over) saveFinished(); };
    if (!r) { dec.forced = true; done(); return; }
    const loss = Math.max(0, 2 * (r.best - r.played));
    // Verkon kolme parasta ja kunkin ero parhaaseen (Tommin pyyntö 1.11.2026).
    const top = topMoves(base, 0, dice, r.top, r.best);
    dec.r = { best: r.best, played: r.played, top };
    g.analysed++;
    g.totalLoss += loss;
    const lv = level(loss);
    if (lv) {
      row.me += lv[1];
      g.errors.push({ n: moveNo, played, top, loss });
    }
    done();
  });
}

// Botin siirron analyysi kesken pelin (kytkin botAnalysis, Tommin tilaus 24.11.2026). Se menee
// samaan analyysisäikeeseen kuin omat siirtosi, joten 2-ply:llä oman siirron arvio voi tulla
// myöhemmin. Botin vastaus ei hidastu, koska botilla on oma säikeensä. Botin siirrot eivät kuulu
// pelin virhesummaan. Tulos kuuluu sille pelille, jossa se pyydettiin, kuten analyse().
const botQueued = new WeakSet();
function analyseBot(dec) {
  if (dec.r || dec.forced || !dec.dice || botQueued.has(dec)) return;
  botQueued.add(dec);
  const g = game, arr = st => [Int8Array.from(st[0]), Int8Array.from(st[1])];
  const base = arr(dec.s);
  rankMove(base, dec.dice[0], dec.dice[1], arr(dec.after), 1).then(r => {
    if (!r) dec.forced = true;
    else dec.r = { best: r.best, played: r.played, top: topMoves(base, 1, dec.dice, r.top, r.best) };
    if (game === g) render(); else if (g.over) saveFinished();
  });
}

// Heiton onni lasketaan heti siirron kirjauksessa (0-ply, noin 10 ms), jotta siirtolista voi
// merkitä sen kesken pelin. Jälkianalyysi ohittaa jo lasketun.
function recordLuck(dec) {
  dec.luck = rollLuck(net, [Int8Array.from(dec.s[0]), Int8Array.from(dec.s[1])], dec.p, dec.dice[0], dec.dice[1]);
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

function finishHuman() {
  game.moveNo++;
  const played = notation(game.dice, game.partial, game.hitsMarks);
  const row = { n: game.moveNo, me: played, bot: '' };
  game.log.push(row);
  const dec = decide({
    k: 'move', p: 0, n: game.moveNo, s: plain(game.base), after: plain(game.s), dice: [...game.dice],
    text: played, ply, forced: game.partial.length === 0, moves: game.partial.map(m => [...m]), cube: { ...game.cube },
  });
  row.meD = lastDecision();
  recordLuck(dec);
  if (game.partial.length) analyse(game.base, [...game.dice], played, row, game.moveNo, dec);
  game.half++;
  if (checkEnd(0) || checkDraw()) return;
  game.phase = 'bot'; game.turn = 1; game.msg = T.botThinking;
  render();
  later(() => botTurn(), 350);
}

// Vuoron alku jumin tunnistukseen (src/jumi.mjs). Arviosarja on ihmisen eli pelaajan 0 vuoroilta
// botin 0-ply-arviolla, koska kalibrointi on mitattu siitä. turnAct kertoo, onko vuorolla jo
// tuplattu tai tarjottu tasapeliä (Kaanon §2.8: joko tai, ja tarjous kerran vuorossa).
function turnStart(p) {
  observe(game.stall, game.half, game.s, p, p === 0 ? netPolicy.winProb(game.s, 0) : undefined);
  game.turnAct = null;
}

function botTurn(opening = false, cubeDone = false) {
  if (game.over) return;
  game.turn = 1;
  if (!opening && !cubeDone) turnStart(1);
  // Ulkoinen moottori päättää ennen heittoa: double, draw tai roll.
  if (!opening && !cubeDone && useEngine()) {
    const g = game;
    game.msg = T.botThinking;
    render();
    engineQuery(1, 'cube').then(a => {
      if (!['double', 'draw', 'roll'].includes(a)) throw new Error(`${T.engineIllegal}: ${a}`);
      return a;
    }).catch(e => { engineFailed(e); return internalCubeChoice(); })
      .then(a => { if (game === g && !game.over) botTurnRest(false, false, a); });
    return;
  }
  botTurnRest(opening, cubeDone, opening || cubeDone ? 'roll' : internalCubeChoice());
}

// Laudan botin päätös ennen heittoa. Tasapeliä botti tarjoaa vain jumissa ja vain, kun jatkaminen
// ei ole sille edullista.
function internalCubeChoice() {
  if (botCube.double(game.s, 1, game.cube)) return 'double';
  if (botOffers(netPolicy.winProb(game.s, 1), game.half, stuck(game.stall))) return 'draw';
  return 'roll';
}

function botTurnRest(opening, cubeDone, choice) {
  // Botti päättää tuplauksesta ennen heittoa. Avausheitto on jo heitetty, joten silloin ei tuplata.
  const doubles = !opening && !cubeDone && choice === 'double' && canDouble(1);
  if (!opening && !cubeDone && canDouble(1)) cubeDecision(1, doubles ? 'double' : 'nodouble');
  if (doubles) {
    game.phase = 'offer';
    logCube('', T.logDouble(game.cube.value * 2), undefined, lastDecision());
    game.msg = T.botDoubles(game.cube.value * 2, points(game.cube.value));
    render();
    return;
  }
  if (!opening && !cubeDone && choice === 'draw') {
    game.phase = 'drawOffer';
    logCube('', T.logOfferDraw);
    game.msg = T.botOffersDraw;
    render();
    return;
  }
  if (!opening) { game.dice = roll(); sound('dice'); }
  game.diceOwner = 1;
  game.botUsed = [];
  game.msg = T.botThinking;
  render();
  // Haku palaa myöhemmin. Tulos kuuluu sille pelille, jossa se pyydettiin, kuten later().
  const g = game, t0 = performance.now();
  botMove(game.s, game.dice[0], game.dice[1]).then(play => { if (game === g && !game.over) botPlayed(play, performance.now() - t0); });
}

function botPlayed(play, ms) {
  const before = plain(game.s);
  // Lyönnit osasiirroittain notaatiota varten.
  const tmp = clone(game.s); const hits = [];
  for (const [f, t] of play.moves) hits.push(applyMove(tmp, 1, f, t));
  game.s = play.s;
  game.lastBot = play.moves.map(([, t]) => (t <= 0 ? 'off' : 25 - t));
  game.botUsed = diceOf(play.moves, game.dice[0] === game.dice[1] ? Array(4).fill(game.dice[0]) : game.dice);
  game.botMoves = play.moves;
  const text = notation(game.dice, play.moves, hits);
  const last = game.log[game.log.length - 1];
  const joins = last && last.bot === '' && last.me !== '';
  if (!joins) game.moveNo++;
  const dec = decide({ k: 'move', p: 1, n: game.moveNo, s: before, after: plain(play.s), dice: [...game.dice], text, ply,
    forced: play.moves.length === 0, moves: play.moves.map(m => [...m]), cube: { ...game.cube } });
  recordLuck(dec);
  if (opts.botAnalysis && play.moves.length) analyseBot(dec);
  if (joins) { last.bot = text; last.botD = lastDecision(); }
  else game.log.push({ n: game.moveNo, me: '', bot: text, botD: lastDecision() });
  const d = `${game.dice[0]}${game.dice[1]}`;
  game.msg = play.moves.length ? T.botPlayed(d, text.split(': ')[1]) + ' ' + T.botTime(ply, ms) : T.botDanced(d);
  game.half++;
  if (checkEnd(1) || checkDraw()) return;
  game.turn = 0; game.phase = 'roll';
  turnStart(0);
  render();
  autoRoll();
}

// Automaattiheitto (Tommin valinta 25.11.2026): vuoro alkaa heitolla, kun et voi tuplata
// (Crawford-peli, kuutio vastustajalla tai katossa). Kun voit tuplata, Heitä odottaa kuten ennen.
// Lyhyt viive jättää botin siirron hetkeksi näkyviin ennen noppia.
function autoRoll() {
  if (!opts.autoRoll || game.over || game.turn !== 0 || game.phase !== 'roll' || canDouble(0)) return;
  const g = game;
  later(() => {
    if (game !== g || !opts.autoRoll || viewing() || game.phase !== 'roll' || game.turnAct !== null || canDouble(0)) return;
    humanRoll(true);
  }, 500);
}

// Tasapeli 300 rivin eli 600 puolisiirron jälkeen (Kaanon §2.7), kuution arvosta riippumatta.
// Tasapeliin päättynyt Crawford-peli pelataan uudelleen, joten Crawford-merkintä puretaan.
function checkDraw() {
  if (game.half < DRAW_HALF) return false;
  endDraw(T.draw(DRAW_ROWS));
  return true;
}

// Hyväksytty tasapelitarjous päättyy kuten 300 rivin tasapeli (Kaanon §2.8).
function endDraw(msg) {
  game.over = true; game.phase = 'over';
  game.msg = msg;
  if (game.crawford) { match.crawford = false; saveMatch(); if (!game.dmp) game.msg += ' ' + T.crawfordReplay; }
  render();
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
function logCube(me, bot, meD, botD) {
  game.log.push({ n: '', me, bot, meD, botD });
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
  if (game.phase !== 'roll' || !canDouble(0) || game.turnAct !== null) return;
  game.turnAct = 'double';
  sound('cube');
  const next = game.cube.value * 2;
  cubeDecision(0, 'double');
  const meD = lastDecision();
  if (useEngine()) {
    const g = game;
    game.msg = T.botThinking;
    render();
    engineQuery(1, 'cube', { offered: true }).then(a => {
      if (a !== 'take' && a !== 'pass') throw new Error(`${T.engineIllegal}: ${a}`);
      return a === 'take';
    }).catch(e => { engineFailed(e); return botCube.take(game.s, 1, game.cube); })
      .then(takes => { if (game === g && !game.over) botAnswersDouble(takes, next, meD); });
    return;
  }
  botAnswersDouble(botCube.take(game.s, 1, game.cube), next, meD);
}

function botAnswersDouble(takes, next, meD) {
  takeDecision(1, takes ? 'take' : 'drop');
  if (!takes) {
    logCube(T.logDouble(next), T.logDrop, meD, lastDecision());
    endByDrop(1);
    return;
  }
  game.cube = { value: next, owner: 1 };
  logCube(T.logDouble(next), T.logTake, meD, lastDecision());
  game.msg = T.botTook(next);
  render();
}

function humanTake() {
  if (game.phase !== 'offer') return;
  sound('cube');
  takeDecision(0, 'take');
  game.cube = { value: game.cube.value * 2, owner: 0 };
  Object.assign(game.log[game.log.length - 1], { me: T.logTake, meD: lastDecision() });
  game.phase = 'bot';
  game.msg = T.youTook(game.cube.value);
  render();
  later(() => botTurn(false, true), 350);
}

function humanDrop() {
  if (game.phase !== 'offer') return;
  takeDecision(0, 'drop');
  Object.assign(game.log[game.log.length - 1], { me: T.logDrop, meD: lastDecision() });
  endByDrop(0);
}

// Tasapelitarjous omalla vuorolla ennen heittoa (Kaanon §2.8). Botti päättää heti. Hylätyn
// tarjouksen jälkeen samalla vuorolla ei voi enää tuplata eikä tarjota.
function humanOfferDraw() {
  if (game.phase !== 'roll' || game.turnAct !== null) return;
  game.turnAct = 'offer';
  if (useEngine()) {
    const g = game;
    game.msg = T.botThinking;
    render();
    engineQuery(0, 'drawoffer').then(a => {
      if (a !== 'accept' && a !== 'decline') throw new Error(`${T.engineIllegal}: ${a}`);
      return a === 'accept';
    }).catch(e => { engineFailed(e); return botAccepts(netPolicy.winProb(game.s, 0), game.half); })
      .then(accepts => { if (game === g && !game.over) botAnswersDraw(accepts); });
    return;
  }
  botAnswersDraw(botAccepts(netPolicy.winProb(game.s, 0), game.half));
}

function botAnswersDraw(accepts) {
  logCube(T.logOfferDraw, accepts ? T.logAccept : T.logDecline);
  if (accepts) { endDraw(T.drawAgreed); return; }
  game.msg = T.botDeclinedDraw;
  render();
}

function humanAcceptDraw() {
  if (game.phase !== 'drawOffer') return;
  game.log[game.log.length - 1].me = T.logAccept;
  endDraw(T.drawAgreed);
}

function humanDeclineDraw() {
  if (game.phase !== 'drawOffer') return;
  game.log[game.log.length - 1].me = T.logDecline;
  game.phase = 'bot';
  game.msg = T.youDeclinedDraw;
  render();
  later(() => botTurn(false, true), 350);
}

function humanRoll(auto = false) {
  if (game.phase !== 'roll') return;
  if (canDouble(0) && game.turnAct !== 'offer') cubeDecision(0, 'nodouble');
  game.dice = roll();
  sound('dice');
  game.autoRolled = auto === true;
  if (!game.autoRolled) game.lastBot = [];
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
  for (const line of luckLines(game.decisions ?? [], whoName)) para(box, line);
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
// Botin tuplaus- ja tasapelitarjous tulee ennen botin heittoa, joten edellinen oma heitto ei
// kuulu laudalle (Tommin havainto 14.11.2026).
const offering = () => game.phase === 'offer' || game.phase === 'drawOffer';
function drawDice(L) {
  if (!game.dice || game.over || offering()) return;
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
  // Ei siirtoa noppien alla, kun heittäjällä ei ollut laillista siirtoa: oma tanssi ennen ✓:ta ja
  // botin tanssi omaan heittoon asti. Muuten tanssin erottaisi laudalta vain nuolten puuttumisesta.
  const danced = game.diceOwner === 0 ? game.phase === 'pass' : Array.isArray(game.botMoves) && game.botMoves.length === 0;
  if (danced) {
    const cx = X(half), w = COL * 2.4, h = 22, y = y0 + DIE + 10;
    el('rect', { x: cx - w / 2, y, width: w, height: h, rx: 6, fill: paint.fill, stroke: OUTLINE, 'stroke-width': 1.5 });
    text(cx, y + h / 2 + 0.5, T.noMove, { 'font-size': 13, 'font-weight': 'bold', fill: paint.on });
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
  if (game.phase === 'view' && game.viewMoves) {
    for (const [f, t] of game.viewMoves) {
      list.push(game.viewP === 0 ? { f, t, own: true } : { f: f === BAR ? BAR : 25 - f, t: t <= 0 ? 0 : 25 - t, own: false });
    }
  }
  if (opts.botArrows && game.turn === 0 && (game.phase === 'roll' || game.autoRolled) && game.botMoves) {
    for (const [f, t] of game.botMoves) list.push({ f: f === BAR ? BAR : 25 - f, t: t <= 0 ? 0 : 25 - t, own: false });
  }
  if (!list.length) return;
  // Muurin kohdalla nuoli himmenee, jotta muurin pipit näkyvät sen alta (DG Androidin
  // MoveArrows, Tommin valinta 2.11.2026). Sama nuoli piirretään kahdesti: muurin ulkopuolelle
  // täytenä ja muurille yhtenä läpikuultavana tasona, jotta reuna ei näy täytön läpi.
  const bl = X(BAR_X, COL);
  const defs = el('defs', {});
  const outside = el('clipPath', { id: 'arrowOut' }, defs);
  el('rect', { x: 0, y: 0, width: bl, height: H }, outside);
  el('rect', { x: bl + COL, y: 0, width: W - bl - COL, height: H }, outside);
  el('rect', { x: bl, y: 0, width: COL, height: H }, el('clipPath', { id: 'arrowBar' }, defs));
  const layers = [el('g', { 'clip-path': 'url(#arrowOut)', 'pointer-events': 'none' }),
    el('g', { 'clip-path': 'url(#arrowBar)', opacity: 0.3, 'pointer-events': 'none' })];
  for (const a of list) {
    const paint = a.own ? L.self : L.opp;
    const side = a.own ? game.s[0] : game.s[1];
    const cnt = q => (q === BAR || q <= 0 ? 0 : a.own ? side[q] : side[25 - q]);
    const [x1, y1] = anchor(a.f, a.own, cnt(a.f));
    const [x2, y2] = anchor(a.t, a.own, cnt(a.t) - 1);
    const len = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    const hx = x2 - ux * 12, hy = y2 - uy * 12;
    const head = `${x2},${y2} ${hx - uy * 7},${hy + ux * 7} ${hx + uy * 7},${hy - ux * 7}`;
    layers.forEach((layer, i) => {
      const g = el('g', i ? {} : { 'data-arrow': a.own ? 'me' : 'bot' }, layer);
      el('line', { x1, y1, x2: hx, y2: hy, stroke: paint.on, 'stroke-width': 7, 'stroke-linecap': 'round' }, g);
      el('polygon', { points: head, fill: paint.on, stroke: paint.on, 'stroke-width': 3, 'stroke-linejoin': 'round' }, g);
      el('line', { x1, y1, x2: hx, y2: hy, stroke: paint.fill, 'stroke-width': 3.5, 'stroke-linecap': 'round' }, g);
      el('polygon', { points: head, fill: paint.fill }, g);
    });
  }
}

// Kuutio: keskellä lokerosarakkeessa, omistettuna saman sarakkeen omistajan päässä, ylhäällä
// botin ja alhaalla oma. Muurin päässä se oli 14.9.–14.11.2026, ja paikka vapautui pipeille kuten
// DG Androidissa 7.11.2026. Crawford-pelissä ja DMP:ssä kuutiota ei ole.
function drawCube() {
  if (game.crawford) return;
  const cl = cubeLook(prefs.style);
  const owner = game.cube.owner;
  const cx = X(TRAY_X, TRAY_W) + TRAY_W / 2;
  const cy = owner === -1 ? MID : owner === 1 ? TOP + 3 + CUBE / 2 : BOTTOM - 3 - CUBE / 2;
  const x = cx - CUBE / 2, y = cy - CUBE / 2;
  if (cl.cut) {
    const c = CUBE * 0.22, e = CUBE;
    el('polygon', { points: `${x + c},${y} ${x + e - c},${y} ${x + e},${y + c} ${x + e},${y + e - c} ${x + e - c},${y + e} ${x + c},${y + e} ${x},${y + e - c} ${x},${y + c}`, fill: cl.fill, stroke: cl.border, 'stroke-width': 1.5 });
  } else {
    el('rect', { x, y, width: CUBE, height: CUBE, rx: CUBE * CORNER_PER_SIDE, fill: cl.fill, stroke: OUTLINE, 'stroke-width': 1.5 });
  }
  const v = game.cube.value === 1 ? 64 : game.cube.value;
  text(cx, cy + 1, String(v), { 'font-size': CUBE * 0.48, 'font-weight': cl.bold && !decoFont() ? 'bold' : 'normal', fill: cl.value(game.cube.value === 1 ? null : v), ...decoFont() });
  if (!canHumanDouble()) return;
  // Tuplattavissa oleva kuutio korostetaan kuten siirrettävä nappula ja on klikattava (clickCube).
  el('rect', { x: x - 3, y: y - 3, width: CUBE + 6, height: CUBE + 6, rx: 6, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 2.5, 'pointer-events': 'none' });
  const hit = el('rect', { x: x - 6, y: y - 6, width: CUBE + 12, height: CUBE + 12, fill: 'transparent', class: 'pt', 'data-cube': '', role: 'button', 'aria-label': T.double(game.cube.value * 2) });
  const tip = document.createElementNS(NS, 'title');
  tip.textContent = T.double(game.cube.value * 2);
  hit.appendChild(tip);
  hit.addEventListener('click', clickCube);
}

// Off-lokero: jokainen ulos pelattu on viiva syrjästä katsottuna, viiden ryhmissä, ja luku on
// pelaajan värisessä kiekossa lokeron kuution puoleisessa päässä (docs/UI.md, 24.9. ja 2.10.2026).
// Tyhjää lokeroa ei piirretä.
function drawOff(L, n, paint, upper) {
  if (n === 0) return;
  const tx = X(TRAY_X, TRAY_W) + 3, tw = TRAY_W - 6;
  // Omistettu kuutio on sarakkeen päässä, joten sen puoleinen lokero lyhenee kuution verran.
  const owned = !game.crawford && game.cube.owner === (upper ? 1 : 0) ? CUBE + 6 : 0;
  const h = MID - CUBE / 2 - 6 - (TOP + 3) - owned;
  const y0 = upper ? TOP + 3 + owned : BOTTOM - 3 - h - owned;
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
  if (!opts.press || edit) return;
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

// Raahaus (Tommin tilaus 24.11.2026, DailyGammonin palaute sujuvammasta käytöstä): nappula
// viedään lähtöpisteestä kohteeseen, ja siirto käyttää ne nopat, joilla sama nappula sinne
// laillisesti kulkee. Lyhyt liike on klikkaus, joka siirtää nopan verran kuten ennenkin.
// Pudotus lähtöpisteeseen peruu raahauksen. Lokero on uloskannon kohde.
const DRAG_PX = 8;
let drag = null, dragEnded = false;
function spotAt(ev) {
  const r = svg.getBoundingClientRect();
  const x = (ev.clientX - r.left) / r.width * W, y = (ev.clientY - r.top) / r.height * Math.round(H);
  if (y < TOP || y > BOTTOM) return null;
  const bx = X(BAR_X, COL), tx = X(TRAY_X, TRAY_W);
  if (x >= bx && x < bx + COL) return BAR;
  if (x >= tx && x < tx + TRAY_W) return OFF;
  return pointAt(ev);
}
function svgPoint(ev) {
  const r = svg.getBoundingClientRect();
  return [(ev.clientX - r.left) / r.width * W, (ev.clientY - r.top) / r.height * Math.round(H)];
}
// Lyhin osasiirtojen ketju, joka vie yhden nappulan lähteestä kohteeseen. Kun ketjuja on monta,
// etusijalla on se, joka alkaa ensimmäisellä käyttämättömällä nopalla.
function dragPath(from, to) {
  const k = game.partial.length, first = remainingDice()[0];
  let best = null;
  for (const p of candidates()) {
    const rest = p.moves.slice(k);
    if (!rest.length || rest[0][0] !== from) continue;
    let j = 0;
    while (j < rest.length && rest[j][1] !== to && rest[j + 1]?.[0] === rest[j][1]) j++;
    if (j >= rest.length || rest[j][1] !== to) continue;
    const path = rest.slice(0, j + 1).map((m, i) => ({ m, d: p.dice[k + i] }));
    if (!best || path.length < best.length || (path.length === best.length && path[0].d === first && best[0].d !== first)) best = path;
  }
  return best;
}
function drawGhost(ev) {
  svg.querySelector('[data-ghost]')?.remove();
  if (!drag?.moved) return;
  const [x, y] = svgPoint(ev);
  const L = boardLook(prefs.style, isDark());
  const g = el('g', { 'pointer-events': 'none', 'data-ghost': '', opacity: 0.85 });
  el('circle', { cx: x, cy: y, r: R - 0.75, fill: L.self.fill, stroke: L.self.inlay ?? L.self.ring ?? OUTLINE, 'stroke-width': 1.5 }, g);
}
svg.addEventListener('pointerdown', ev => {
  if (ev.button !== 0 || edit || viewing() || game.over || game.turn !== 0 || game.phase !== 'move') return;
  const from = spotAt(ev);
  if (from === null || !nextMoves().some(m => m[0] === from)) return;
  drag = { from, x: ev.clientX, y: ev.clientY, moved: false };
});
// Kosketuksella laudan touch-action: manipulation antaa selaimen vierittää sivua. Vieritys perii
// eleen ja lähettää pointercancelin, joten raahaus katkesi tabletilla (Tommi 25.11.2026). Kun
// ele alkaa siirrettävästä nappulasta, touchmove perutaan eikä vieritys ala. Napautus tuottaa
// yhä klikkauksen, koska touchstartia ei peruta.
svg.addEventListener('touchmove', ev => { if (drag) ev.preventDefault(); }, { passive: false });
document.addEventListener('pointermove', ev => {
  if (!drag) return;
  if (!drag.moved && Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) < DRAG_PX) return;
  drag.moved = true;
  drawGhost(ev);
});
document.addEventListener('pointerup', ev => {
  const d = drag;
  drag = null;
  if (!d?.moved) return;
  svg.querySelector('[data-ghost]')?.remove();
  // Raahauksen päättävä klikkaus ei saa siirtää nappulaa uudelleen nopan verran.
  dragEnded = true;
  setTimeout(() => { dragEnded = false; }, 0);
  const to = spotAt(ev);
  if (to === null || to === d.from) return;
  const path = dragPath(d.from, to);
  if (!path) { sound('miss'); return; }
  for (const { m, d: die } of path) {
    doMove(m[0], m[1], die);
    if (game.phase !== 'move' || game.turn !== 0) break;
  }
});
document.addEventListener('pointercancel', () => { drag = null; svg.querySelector('[data-ghost]')?.remove(); });

function render() {
  // Valitun rivin asema piirretään näyttöoliosta. Peli itse jatkuu taustalla ennallaan.
  // Aseman luonnissa lauta ja tila piirretään luonnin asemasta.
  const real = game, shown = edit ? editGame() : viewGame();
  if (shown) game = shown;
  try { drawBoard(); if (edit) renderStatus(false); } finally { game = real; }
  if (!edit) renderStatus(!!shown);
}

function drawBoard() {
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
    numEls[i] = text(cx, top ? PAD + NUM / 2 : BOTTOM + NUM / 2, String(i), { 'font-size': 13, fill: NUMBER_INK, opacity: 0.8, ...decoFont() });
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

  // Pipit muurin päissä kuten DG Androidin BarPips (Tommin tilaus 14.11.2026): luku ja ero
  // sulkeissa ilman Pips-sanaa (Tommin valinta 14.11.2026), ylhäällä botin ja alhaalla oma. Ero on oma miinus toisen, joten
  // miinus tarkoittaa pienempää pip-lukua. Muurin nappulapino (enintään kolme) jättää päihin
  // kahden nappulan korkeuden, ja pino piirtyy pippien päälle. Koottu siirto korostaa luvun ja
  // eron, jotka poikkeavat vuoron alun asemasta, kuten DG Androidin pipMoved.
  const bx = X(BAR_X, COL) + COL / 2;
  const lead = (a, b) => (a - b > 0 ? `+${a - b}` : String(a - b));
  const moving = game.phase === 'move' && game.base && !review;
  const barPips = (p, top) => {
    const me = pips(s[p]), other = pips(s[1 - p]);
    const was = moving ? [pips(game.base[p]), pips(game.base[1 - p])] : [me, other];
    const rows = [[String(me), me !== was[0]], [`(${lead(me, other)})`, me - other !== was[0] - was[1]]];
    const fs = 14, lh = 17, y0 = top ? TOP + 6 + lh / 2 : BOTTOM - 6 - lh * 1.5;
    rows.forEach(([str, moved], i) => {
      const y = y0 + i * lh;
      if (moved) el('rect', { x: bx - COL / 2 + 3, y: y - lh / 2 + 1, width: COL - 6, height: lh - 2, rx: 3, fill: 'var(--accent)', 'fill-opacity': 0.35 });
      text(bx, y + 0.5, str, { 'font-size': fs, fill: NUMBER_INK, 'data-pip': i === 0 ? (p ? 'bot' : 'me') : null });
    });
  };
  barPips(1, true);
  barPips(0, false);

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
}

// Tilarivi poistettiin (Tommin valinta 14.11.2026): lauta näyttää heiton, siirrot ja kuution.
// Laudalle kirjoitetaan vain tieto, jota se ei muuten näytä: botin tuplaus luopumisen hintoineen,
// tasapelitarjous ja pelin tulos nappien yläpuolella sekä Ei siirtoa noppien alla (drawDice).
// Tuodun ottelun selauksen viesti on laudan alla selausnappien yläpuolella.
const boardNote = () => [game.engineNote, game.over || game.phase === 'offer' || game.phase === 'drawOffer' ? game.msg : ''].filter(Boolean).join(' ');
function renderStatus(isView) {
  const note = review ? '' : boardNote();
  $('boardNote').textContent = note;
  $('boardNote').hidden = !note;
  $('actRow').classList.toggle('noted', !!note);
  $('reviewMsg').textContent = review ? game.msg : '';
  const box = $('analysis');
  box.textContent = '';
  if (game.over && finished !== game && !review) {
    finished = game;
    match.done = (match.done ?? 0) + 1; saveMatch();
    saveFinished(); analyseRecord(played[0]);
  }
  if (isView) {
    const d = selRec().decisions[sel.d];
    $('viewHelp').textContent = T.viewHelp;
    placeViewNote(d.k === 'move' && d.p === 0 ? LEFT : RIGHT);
  }
  if (game.mark) {
    const p = document.createElement('p');
    p.textContent = T.reviewMarkText(game.mark.text);
    box.appendChild(p);
  }
  // Laudan päällä näkyvät vain sillä hetkellä käytettävät napit (Tommin valinta 13.11.2026).
  // Tuplaus on kuution klikkaus (drawCube), joten sillä ei ole nappia.
  const ready = game.turn === 0 && game.phase === 'move' && nextMoves().length === 0;
  const show = (id, on) => { $(id).style.display = on ? '' : 'none'; };
  // Kuvakenappien nimi on vihjeteksti ja ruudunlukijan nimi.
  for (const id of ['undo', 'done', 'offerDraw']) { $(id).title = T.static[id]; $(id).setAttribute('aria-label', T.static[id]); }
  show('roll', game.phase === 'roll');
  // Tanssissa Valmis (✓) on noppien oikealla puolella Jatka-napin sijaan (13.11.2026).
  show('done', ready || game.phase === 'pass');
  show('undo', game.turn === 0 && game.phase === 'move' && game.partial.length > (game.forcedN ?? 0));
  // Tasapelinappi on aina esillä kuten kuutio, mutta toimii vain omalla vuorolla ennen heittoa
  // (Tommin valinta 14.11.2026).
  show('offerDraw', !game.over);
  $('offerDraw').disabled = !(game.turn === 0 && game.phase === 'roll' && game.turnAct === null);
  show('acceptDraw', game.phase === 'drawOffer');
  show('declineDraw', game.phase === 'drawOffer');
  show('take', game.phase === 'offer');
  show('drop', game.phase === 'offer');
  $('new').textContent = matchOver() ? T.newMatch : T.nextGame;
  // Kun Seuraava peli noppien paikalle on päällä, nappi on laudalle piirretty (drawNextOnDice).
  show('new', game.over && !opts.nextOnDice);
  $('resign').style.display = game.over ? 'none' : '';
  placeActions();
  $('cubeVal').textContent = game.dmp ? T.dmpCube : game.crawford ? T.crawfordCube : game.cube.value;
  $('rows').textContent = `${Math.ceil(game.half / 2)} / ${DRAW_ROWS}`;
  $('limit').value = String(match.limit);
  // Ottelu ja rangaistuspisteet yhtenä lohkona: pisteet suhteessa otteluun valittuun rajaan.
  $('penMe').textContent = T.penScore(pen[0], match.limit);
  $('penBot').textContent = T.penScore(pen[1], match.limit);
  // Pelaajakortit laudan ylä- ja alapuolella: vastapuoli ylhäällä, oma alhaalla. Selauksessa
  // tuodun pelin pelaajat ja pisteet pelin alussa, muuten oma ottelu (Tommi 24.11.2026).
  const rg = review ? reviewGame() : null;
  const nm = rg ? [rg.players[review.h], rg.players[1 - review.h]] : namesOf(liveGame());
  const pp = rg ? [rg.scores[review.h], rg.scores[1 - review.h]] : edit ? edit.pen : pen;
  for (const [id, k] of [['cardBot', 1], ['cardMe', 0]]) {
    const turn = game.turn === k && !game.over;
    $(id).textContent = T.card(nm[k], pp[k], turn);
    $(id).classList.toggle('turn', turn);
  }
  $('review').hidden = !review || !!edit;
  $('editor').hidden = !edit;
  $('actions').hidden = !!review || isView || !!edit;
  $('viewBar').hidden = !isView;
  renderPanels();
  if (review) renderReview();
  if (document.activeElement !== $('xgid')) $('xgid').value = currentXGID();
}

// Laudan napit keskikaistan korkeudella (Tommin valinnat 13.11.2026): Heitä oman puoliskon
// keskellä, Tarjoa tasapeliä (½) muurin keskellä, Kumoa (↶) vasemmanpuoleisen nopan vasemmalla
// ja Valmis (✓) oikeanpuoleisen oikealla. Muut napit ovat rivinä sen puoliskon keskellä, jolla
// omat nopat eivät ole. Pelin päätyttyä rivi ja tulos ovat botin puoliskolla: Seuraava peli
// noppien paikalle piirtää oman nappinsa toiselle puoliskolle. Pyöreän napin halkaisija on 36 yksikköä, mutta
// vähintään --icon-min (CSS: 22 px, kosketusnäytöllä 32 px), joten etäisyys nopista lasketaan laudan todellisesta leveydestä.
function placeActions() {
  const at = (id, x) => {
    $(id).style.left = `${x / W * 100}%`;
    $(id).style.top = `${MID / Math.round(H) * 100}%`;
  };
  const own = game.dice && !game.over && !offering() && game.diceOwner === 0;
  const free = (own || game.over ? LEFT : RIGHT) + 3 * COL;
  at('roll', X(RIGHT + 3 * COL));
  at('offerDraw', X(BAR_X, COL) + COL / 2);
  at('actRow', X(free));
  $('actRow').style.width = $('actRow').classList.contains('noted') ? `${(6 * COL - 16) / W * 100}%` : '';
  const scale = (svg.getBoundingClientRect().width || W) / W;
  const minPx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--icon-min')) || 22;
  const r = Math.max(36, minPx / scale) / 2;
  const n = game.dice && game.diceOwner === 0 && ['move', 'pass'].includes(game.phase) ? diceShown().length : 2;
  const off = (n * DIE + (n - 1) * K * 0.2) / 2 + K * 0.2 + r;
  const c = X(RIGHT + 3 * COL);
  // Tuplien neljä noppaa ja kosketusnäytön isompi nappi eivät mahdu kapealla laudalla ½-napin ja
  // noppien väliin (Pixel 8a 14.11.2026): silloin Kumoa pienenee väliin, kuitenkin vähintään 22 px.
  const half = $('offerDraw').getBoundingClientRect().width / scale / 2 || r;
  const lo = X(BAR_X, COL) + COL / 2 + half + K * 0.1;
  const hi = c - off + r;
  const undo = $('undo').style;
  if (hi - lo < 2 * r) {
    const rr = Math.max(22 / scale / 2, (hi - lo) / 2);
    undo.width = undo.height = `${2 * rr * scale}px`;
    at('undo', (lo + hi) / 2);
  } else {
    undo.width = undo.height = '';
    at('undo', c - off);
  }
  at('done', c + off);
}
if (typeof ResizeObserver === 'function') new ResizeObserver(() => { if (game) placeActions(); }).observe(svg);

// Rivin aseman katselun ohje ja Palaa peliin -nappi sen puoliskon keskelle, jolla nopat eivät
// ole: oman siirron rivillä vasemmalle (oikealle, kun kotialue on vasemmalla), botin siirron ja
// kuutiopäätöksen rivillä toiselle puoliskolle. Leveys on puolisko pienin reunavaroin.
function placeViewNote(half) {
  const note = $('viewNote');
  note.style.left = `${X(half + 3 * COL) / W * 100}%`;
  note.style.top = `${MID / Math.round(H) * 100}%`;
  note.style.width = `${(6 * COL - 16) / W * 100}%`;
}

// Kuution klikkaus tuplaa omalla vuorolla ennen heittoa, kun tuplaus on sallittu. Tuplaus,
// otto ja luopuminen vahvistetaan ikkunassa (Tommin valinta 13.11.2026), koska kuutio
// on laudalla ja vahinkoklikkaus olisi peruuttamaton.
// Vahvistus pelin omalla ikkunalla selaimen confirmin sijaan (Tommin valinta 14.11.2026).
// Esc ja Ei peruvat. Palauttaa lupauksen totuusarvosta.
function confirmBox(text) {
  const d = $('confirmBox');
  $('confirmText').textContent = text;
  return new Promise(res => {
    const done = v => { $('confirmYes').onclick = $('confirmNo').onclick = d.oncancel = null; d.close(); res(v); };
    $('confirmYes').onclick = () => done(true);
    $('confirmNo').onclick = () => done(false);
    d.oncancel = ev => { ev.preventDefault(); done(false); };
    d.showModal();
    $('confirmYes').focus();
  });
}
const canHumanDouble = () => game.phase === 'roll' && canDouble(0) && game.turnAct === null;
async function clickCube() {
  if (!canHumanDouble() || !(await confirmBox(T.doubleConfirm(game.cube.value * 2))) || !canHumanDouble()) return;
  humanDouble();
}

// Selauksessa pisteet ovat tuodun pelin alun pisteet. Pelaajakortit piirtää render.
function renderReview() {
  const g = reviewGame(), h = review.h, len = reviewLimit();
  $('penMe').textContent = T.penScore(g.scores[h], len);
  $('penBot').textContent = T.penScore(g.scores[1 - h], len);
  $('resign').style.display = 'none';
  const last = review.steps.length - 1;
  $('reviewFirst').disabled = $('reviewPrev').disabled = review.i === 0;
  $('reviewNext').disabled = $('reviewLast').disabled = review.i === last;
  const a = g.actions[review.i];
  // Aseman linkki ilman noppia jatkuu alusta, vaikka teko puuttuu (playFromHere).
  $('reviewPlay').disabled = (!a && !(g.start && review.i === 0)) || a?.kind === 'win' || (review.error !== null && review.i === last);
}

$('roll').addEventListener('click', humanRoll);
$('undo').addEventListener('click', undo);
$('take').addEventListener('click', async () => {
  if (game.phase === 'offer' && await confirmBox(T.takeConfirm(game.cube.value * 2)) && game.phase === 'offer') humanTake();
});
$('drop').addEventListener('click', async () => {
  if (game.phase === 'offer' && await confirmBox(T.dropConfirm(points(game.cube.value))) && game.phase === 'offer') humanDrop();
});
$('offerDraw').addEventListener('click', humanOfferDraw);
$('acceptDraw').addEventListener('click', humanAcceptDraw);
$('declineDraw').addEventListener('click', humanDeclineDraw);
$('done').addEventListener('click', () => {
  if (game.phase === 'pass') { pass(); return; }
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
$('limit').addEventListener('change', async e => {
  const v = e.target.value === 'null' ? null : Number(e.target.value);
  const progress = pen[0] + pen[1] > 0 || (game.half > 0 && !game.over);
  if (progress && !(await confirmBox(T.limitConfirm))) { e.target.value = String(match.limit); return; }
  match.limit = v; pen[0] = 0; pen[1] = 0; match.crawford = false;
  startMatch();
  newGame();
});

// Kesken olevan pelin hylkääminen on luovutus, joten siitä tulee kuution arvon verran
// rangaistuspisteitä (Kaanon §2.2).
// Luovutus on paneelissa erillään vuoron napeista ja vaatii varmistuksen (Tommin valinta
// 1.11.2026, vahinkoklikkauksen jälkeen).
$('new').addEventListener('click', () => { if (game.over) newGame(); });
$('resign').addEventListener('click', async () => {
  if (game.over || !(await confirmBox(T.resignConfirm(points(game.cube.value)))) || game.over) return;
  logCube(T.logResign, '');
  endByDrop(0);
});

// Aseman XGID (src/xgid.mjs). Kesken olevasta siirrosta annetaan asema ennen siirtoa ja nopat.
function currentXGID() {
  const moving = game.turn === 0 && (game.phase === 'move' || game.phase === 'pass');
  return toXGID({
    s: moving ? game.base : game.s, cube: game.cube, turn: game.turn,
    dice: moving || game.phase === 'review' || game.phase === 'edit' ? game.dice : null, offered: game.phase === 'offer', crawford: game.crawford,
    // Selauksessa pisteet ja pituus ovat tuodun pelin ja aseman luonnissa luotavan aseman.
    pen: review ? [reviewGame().scores[review.h], reviewGame().scores[1 - review.h]] : edit ? edit.pen : pen,
    limit: review ? reviewLimit() : edit ? edit.limit : match.limit,
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
  sel = { when: null, d: null };
  game = {
    ...game, s: x.s, cube: x.cube, over: false, base: null, partial: [], partialDice: [], hitsMarks: [],
    lastBot: [], botMoves: null, botUsed: [], dice: x.dice, diceOwner: x.turn,
    order: x.dice ? [...x.dice] : [], log: [...game.log.map(({ n, me, bot }) => ({ n, me, bot })), { n: '', me: logText, bot: '' }],
    msg, when: Date.now(), limit: match.limit, decisions: [], stall: newStall(), turnAct: null,
  };
  if (x.turn === 0) {
    if (x.dice) beginHumanMove(); else { game.turn = 0; game.phase = 'roll'; turnStart(0); autoRoll(); }
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
// Nykyisen aseman linkki ilman pelattua siirtoa. Avaaja näkee verkon parhaat ja voi jatkaa.
$('xgidLink').addEventListener('click', async () => {
  const url = linkURL(linkFragment(fromXGID(currentXGID()), null, linkBot(liveGame())));
  $('xgid').value = url;
  try { await navigator.clipboard.writeText(url); $('xgidMsg').textContent = T.linkCopied; }
  catch { $('xgid').select(); $('xgidMsg').textContent = T.xgidSelect; }
});
$('xgid').addEventListener('keydown', ev => { if (ev.key === 'Enter') loadXGID($('xgid').value); });

// Aseman luonti (src/luonti.mjs, Tommin valinnat 25.11.2026): tyhjä lauta, nappulat klikkaamalla
// värivalitsimen värillä, vuoro, heitto, kuutio ja ottelun tilanne lomakkeelta. Analysoi avaa
// aseman selaukseen aseman linkkinä. Luonnin aikana peli odottaa taustalla, ja lauta piirretään
// luonnin asemasta (render). Tila edit on määritelty tiedoston alussa reviewin vieressä.
const editGame = () => ({
  ...game, s: edit.s, turn: edit.turn, dice: edit.dice, diceOwner: edit.turn, order: edit.dice ? [...edit.dice] : [],
  cube: edit.cube.value === 1 ? { value: 1, owner: -1 } : edit.cube, crawford: edit.crawford && crawfordPossible(edit), dmp: false,
  phase: 'edit', over: false, base: null, partial: [], partialDice: [], botUsed: [], botMoves: null, lastBot: [],
  autoRolled: false, mark: null, engineNote: '', msg: '',
});
function fillEditor() {
  const opt = (sel, list) => {
    const v = sel.value;
    sel.textContent = '';
    for (const [value, label] of list) { const o = document.createElement('option'); o.value = value; o.textContent = label; sel.appendChild(o); }
    if (v !== '') sel.value = v;
  };
  opt($('editTurn'), [['0', T.static.you], ['1', T.static.bot]]);
  const rolls = [['', T.editNoRoll]];
  for (let a = 6; a >= 1; a--) for (let b = a; b >= 1; b--) rolls.push([`${a}${b}`, `${a}${b}`]);
  opt($('editDice'), rolls);
  opt($('editCubeValue'), [1, 2, 4, 8, 16, 32, 64].map(v => [String(v), String(v)]));
  opt($('editCubeOwner'), [['-1', T.editCenter], ['0', T.static.you], ['1', T.static.bot]]);
  $('editCubeValue').setAttribute('aria-label', T.static.cube);
  $('editCubeOwner').setAttribute('aria-label', T.editOwner);
  if (edit) editForm();
}
function editForm() {
  $('editTurn').value = String(edit.turn);
  $('editDice').value = edit.dice ? `${edit.dice[0]}${edit.dice[1]}` : '';
  $('editCubeValue').value = String(edit.cube.value);
  $('editCubeOwner').value = String(edit.cube.value === 1 ? -1 : edit.cube.owner);
  $('editCubeOwner').disabled = edit.cube.value === 1;
  $('editLimit').value = String(edit.limit);
  $('editLimitNote').textContent = edit.limit ? '' : T.limitOption(null);
  $('editPenMe').value = String(edit.pen[0]);
  $('editPenBot').value = String(edit.pen[1]);
  $('editCrawford').disabled = !crawfordPossible(edit);
  $('editCrawford').checked = edit.crawford && crawfordPossible(edit);
}
function readEditor() {
  const num = (id, max) => Math.max(0, Math.min(max, Math.floor(Number($(id).value)) || 0));
  const d = $('editDice').value;
  edit.color = $('editColorBot').checked ? 1 : 0;
  edit.turn = Number($('editTurn').value);
  edit.dice = d ? [Number(d[0]), Number(d[1])] : null;
  const value = Number($('editCubeValue').value);
  edit.cube = { value, owner: value === 1 ? -1 : Number($('editCubeOwner').value) };
  edit.limit = num('editLimit', 25);
  edit.pen = [num('editPenMe', 24), num('editPenBot', 24)];
  edit.crawford = $('editCrawford').checked;
  $('editMsg').textContent = '';
  editForm();
  render();
}
function startEdit() {
  if (!review && game.phase === 'bot') { $('xgidMsg').textContent = T.editBusy; return; }
  if (review) closeReview();
  sel = { when: null, d: null };
  edit = {
    s: emptyPosition(), color: 0, turn: 0, dice: null, cube: { value: 1, owner: -1 },
    limit: match.limit ?? 0, pen: [0, 0], crawford: false,
  };
  $('editColorMe').checked = true;
  $('editMsg').textContent = '';
  $('xgidMsg').textContent = '';
  fillEditor();
  closeMenus();
  render();
  $('editor').scrollIntoView?.({ block: 'nearest' });
}
function cancelEdit() {
  if (!edit) return;
  edit = null;
  render();
}
function finishEdit() {
  if (!edit) return;
  const err = positionError(edit);
  if (err) { $('editMsg').textContent = err === 'empty' ? T.editEmpty : T.editScore; return; }
  const f = createdFragment(edit);
  edit = null;
  importMatch(f);
}
// Klikkauskohdan korkeus pisteen tyvestä nappuloina. Muurin yläpuolisko on oma ja alapuolisko
// botin, kuten muurin pinot piirretään.
svg.addEventListener('click', ev => {
  if (!edit) return;
  const spot = spotAt(ev);
  if (spot === null || spot === OFF) return;
  const y = svgPoint(ev)[1];
  let p = edit.color, slot;
  if (spot === BAR) {
    p = y < MID ? 0 : 1;
    const from = p === 0 ? MID - BAND / 2 - y : y - MID - BAND / 2;
    slot = from < 0 ? 1 : Math.floor(from / K) + 1;
  } else slot = Math.floor((isTop(spot) ? y - TOP : BOTTOM - y) / K) + 1;
  placeCheckers(edit.s, p, spot, slot);
  $('editMsg').textContent = '';
  render();
});
$('editStart').addEventListener('click', startEdit);
$('editor').addEventListener('change', readEditor);
$('editClear').addEventListener('click', () => { clearPosition(edit.s); $('editMsg').textContent = ''; render(); });
$('editDone').addEventListener('click', finishEdit);
$('editCancel').addEventListener('click', cancelEdit);

// Ottelun tuonti ja selaus (Tommin valinta 1.11.2026): DailyGammonin vienti (.mat) tai .sgf
// tiedostona tai liitettynä. Ottelua selataan teko kerrallaan. Mistä tahansa asemasta voi
// jatkaa peliä bottia vastaan. Selaus ei muuta ottelun pisteitä. Keskeytetty peli palaa, kun
// selaus suljetaan.
const reviewGame = () => review.m.games[review.gi];

function importMatch(text) {
  const m = parseMatch(text);
  if (!m) { $('importMsg').textContent = T.importBad; return; }
  // Aseman linkissä ei ole nimiä: a-pelaaja on Pelaaja ja b-pelaaja linkin botti tai laudan botti.
  if (m.link) {
    // Tuntematon syvyys hylätään, koska analyysi laskee vain laudan syvyyksillä.
    if (m.bot && !PLIES.includes(m.bot.ply)) m.bot = null;
    const net = Object.keys(NET_CODE).find(k => NET_CODE[k] === m.bot?.code);
    const bot = m.bot ? (net ? botLabel(net, m.bot.ply) : `${T.static.bot} ${m.bot.ply}-ply`) : botLabel();
    m.players = m.games[0].players = m.players.map((n, k) => n || (k ? bot : T.linkPlayer));
  }
  if (!review && game.phase === 'bot') { $('importMsg').textContent = T.reviewBusy; return; }
  const name = store.get('ab-tuonti-nimi', null);
  // Saman ottelun uusi tuonti avaa tallennetun analyysin. done säilyttää valmiit analyysit teon
  // mukaan, joten pelaajan vaihto ei aloita alusta. stale kertoo, että analyysi on laskettu eri
  // verkolla kuin nykyinen: se näytetään merkittynä eikä sitä jatketa sekaisin.
  const id = textId(text), old = imported.find(x => x.id === id);
  const h = old ? old.h : Math.max(0, m.players.indexOf(name));
  const done = new Map(Object.entries(old?.done ?? {}));
  review = {
    m, h, gi: 0, i: 0, steps: [], error: null, saved: review?.saved ?? game, rec: null, done,
    id, text, when: old?.when ?? Date.now(), net: old?.net ?? NET_FILE, stale: !!old && old.net !== NET_FILE && done.size > 0,
    kind: old?.kind ?? (m.length ? 'match' : 'money'), rollouts: old?.rollouts ?? {}, marks: old?.marks ?? {},
  };
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
    o.textContent = T.reviewGameOption(k + 1, g.scores[0], g.scores[1], g.actions.some((a, j) => importedMark(k, j)));
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
  const ms = $('reviewMatch');
  ms.textContent = '';
  for (const k of m.length ? ['money', 'dmp', 'match'] : ['money', 'dmp']) {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = k === 'match' ? T.matchKind.match(m.length) : T.matchKind[k];
    ms.appendChild(o);
  }
  ms.value = review.kind;
}
// Tuodun ottelun laji (Tommin valinta 14.11.2026): DailyGammonin vienti kirjoittaa kuutiottoman
// DMP:n otsikoksi "0 point match", joten tiedostosta ei erota sitä rahapelistä. Oletus luetaan
// tiedostosta, ja selauksen Ottelu-valitsin korjaa sen. DMP on yhden pisteen ottelu ilman kuutiota.
// Laji vaikuttaa pisteisiin, XGID:hen, kuutiopäätösten arvioon ja viennin tietoihin, ei siirtojen
// analyysiin, joka on kuutioton voittotodennäköisyys.
function reviewLimit() {
  return review.kind === 'dmp' ? 1 : review.kind === 'match' ? review.m.length : null;
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
  openRecord();
  showStep();
}

// Tuodun pelin päätökset samassa muodossa kuin oman pelin (Tommin valinta 14.11.2026), jotta
// Peli-paneelin lista, värit, Arvio-paneeli ja jälkianalyysi toimivat selauksessakin. Valittu
// pelaaja on 0 ja toinen 1. act[k] on teon k päätöksen indeksi tai undefined (voitto ja teko,
// johon toisto pysähtyi).
function reviewRecord() {
  const { h, steps, gi } = review, g = reviewGame(), len = reviewLimit();
  const view = st => [Array.from(st.s[h]), Array.from(st.s[1 - h])];
  const cubeOf = st => ({ value: st.cube.value, owner: st.cube.owner === -1 ? -1 : st.cube.owner === h ? 0 : 1 });
  const rec = {
    imported: true, msg: '', log: [], decisions: [], act: [], analysed: 0, totalLoss: 0, errors: [],
    cubePolicy: len ? tablePolicy(netPolicy, { away: [Math.max(1, len - g.scores[h]), Math.max(1, len - g.scores[1 - h])], crawford: false }) : netPolicy,
  };
  let n = 0;
  g.actions.forEach((a, k) => {
    if (k >= steps.length && review.error !== null) return;
    const p = a.side === h ? 0 : 1, st = steps[k] ?? steps[steps.length - 1];
    const text = actText(a, st);
    const last = rec.log[rec.log.length - 1];
    let row;
    if (p === 1 && last && last.bot === '' && last.me !== '') { row = last; row.bot = text; }
    else { row = { n: ++n, me: p === 0 ? text : '', bot: p === 0 ? '' : text }; rec.log.push(row); }
    if (a.kind === 'win' || k + 1 >= steps.length) return;
    const d = { key: `${gi}:${k}`, p, n: row.n, s: view(st), cube: cubeOf(st), text };
    // Aseman linkin avoin siirto (open): nopat on heitetty, mutta siirtoa ei ole pelattu.
    if (a.kind === 'roll') Object.assign(d, { k: 'move', after: view(steps[k + 1]), dice: [...a.dice], ply: review.m.bot?.ply ?? ply, forced: !a.open && a.moves.length === 0, open: !!a.open, moves: a.moves.map(m => [...m]) });
    else if (a.kind === 'double') Object.assign(d, { k: 'cube', act: 'double', value: (a.value ?? 2 * st.cube.value) / 2 });
    else Object.assign(d, { k: 'take', act: a.kind, value: st.cube.value });
    Object.assign(d, review.done.get(d.key));
    const mk = importedMark(gi, k);
    if (mk) d.mark = mk;
    rec.act[k] = rec.decisions.length;
    rec.decisions.push(d);
    if (p === 0) row.meD = rec.act[k]; else row.botD = rec.act[k];
    countImported(rec, d);
  });
  return rec;
}
function openRecord() {
  review.rec = reviewRecord();
  if (opts.importAnalysis && !review.paused && !review.stale) analyseRecord(review.rec);
}

// Teon teksti siirtolistaan ja tilariville siirtäjän numeroinnissa.
function actText(a, st) {
  if (a.kind === 'roll' && a.open) return `${a.dice[0]}${a.dice[1]}: ?`;
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
  const side = a ? a.side : g.turn ?? h;
  sel = { when: null, d: review.rec.act[i] ?? null };
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
    turn: side === h ? 0 : 1, phase: 'review', over: false,
    // Tuodun DMP:n laudalla ei ole kuutiota (Tommi 18.11.2026), kuten pelatussakaan.
    crawford: review.kind === 'dmp', dmp: review.kind === 'dmp',
    dice: a?.kind === 'roll' && !stopped ? [...a.dice] : null, diceOwner: side === h ? 0 : 1,
    order: [], botUsed: [], partial: [], partialDice: [], hitsMarks: [], base: null, plays: null,
    lastBot: [], botMoves: null, log: [], moveNo: 0, half: 0, errors: [], analysed: 0, totalLoss: 0,
    msg, mark: i < g.actions.length ? importedMark(review.gi, i) : null,
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
    const k = games[gi].actions.findIndex((a, j) => j >= from && importedMark(gi, j));
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
  // Aseman linkki ilman noppia: peli jatkuu linkin vuorosta heitolla.
  if (!a && !(g.start && i === 0)) return;
  if (a?.kind === 'win') return;
  const st = review.steps[i], h = review.h, owner = st.cube.owner;
  const x = {
    s: [Int8Array.from(st.s[h]), Int8Array.from(st.s[1 - h])],
    cube: { value: st.cube.value, owner: owner === -1 ? -1 : owner === h ? 0 : 1 },
    turn: (a ? a.side : g.turn) === h ? 0 : 1,
    dice: a?.kind === 'roll' ? [...a.dice] : null,
  };
  game = review.saved;
  review = null;
  fillGameSel();
  setPosition(x, T.logReview, T.reviewPlaying);
}

function closeReview() {
  if (!review) return;
  game = review.saved;
  review = null;
  sel = { when: null, d: null };
  fillGameSel();
  render();
}

$('importFile').addEventListener('change', async ev => {
  const f = ev.target.files?.[0];
  if (!f) return;
  importAny(await f.text());
  ev.target.value = '';
});
$('importGo').addEventListener('click', () => importAny($('importText').value));
$('reviewGame').addEventListener('change', e => openGame(Number(e.target.value)));
$('reviewYou').addEventListener('change', e => {
  review.h = Number(e.target.value);
  store.set('ab-tuonti-nimi', review.m.players[review.h]);
  saveImported();
  openRecord();
  showStep();
});
$('reviewMatch').addEventListener('change', e => {
  review.kind = e.target.value;
  // Kuutiopäätökset arvioidaan uudelleen uuden lajin kuutiopolitiikalla.
  for (const [k, v] of review.done) { const { w, should, ...rest } = v; review.done.set(k, rest); }
  saveImported();
  openRecord();
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
// Deco-laudan kuution ja pistenumeroiden kirjasin (Poiret One, index.html @font-face). Muilla
// laudoilla tyhjä, jolloin text() käyttää oletusta.
function decoFont() { return prefs.style === 'deco' ? { 'font-family': "'Poiret One', system-ui, sans-serif" } : null; }
function applyLook() {
  const P = panelLook(prefs.style, isDark());
  const root = document.documentElement.style;
  const vars = { '--bg': P.background, '--panel': P.card, '--ink': P.text, '--muted': P.muted,
    '--frame': P.outline, '--accent': P.button, '--on-accent': P.onButton, '--link': P.accent };
  for (const [k, v] of Object.entries(vars)) root.setProperty(k, v);
  // Peli-paneelin nappulamerkit laudan nappuloiden väreissä, Arvio-paneelin vihreä ja punainen
  // ympäristön vaaleuden mukaan.
  const L = boardLook(prefs.style, isDark());
  root.setProperty('--dot-me', L.self.fill);
  root.setProperty('--dot-bot', L.opp.fill);
  root.setProperty('--good', P.light ? '#2b7a36' : '#7fd18b');
  root.setProperty('--bad', P.light ? '#b3261e' : '#f2867c');
  document.documentElement.style.colorScheme = P.light ? 'light' : 'dark';
  // Puhelimen tila- ja osoitepalkki sekä asennetun sovelluksen yläpalkki sivun taustan värissä.
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.content = P.background;
  document.body.classList.toggle('home-left', prefs.left);
  document.body.classList.toggle('deco', prefs.style === 'deco');
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
  // Äänet: pääkytkin ja kunkin äänen ruutu, kuten DG Androidin Game sounds.
  const sbox = $('sounds');
  sbox.textContent = '';
  // Äänen rivillä on oma Kuuntele-nappi, kuten DG Androidin Play (Tommin tilaus 14.11.2026). Se
  // soittaa äänen myös kytkimen ollessa pois, koska painallus on pyyntö. Ruutu ja nimi ovat yksi
  // klikkausalue, nappi oma: rivin klikkaus ei soita, eikä nappi vaihda ruutua.
  const row = (text, checked, onChange, play = null) => {
    const label = document.createElement('label');
    label.className = play ? 'wide sub' : 'wide';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    const span = document.createElement('span');
    span.textContent = text;
    label.append(input, span);
    if (!play) { sbox.appendChild(label); return input; }
    const line = document.createElement('div');
    line.className = 'sound-row';
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = T.soundPlay;
    b.setAttribute('aria-label', T.soundPlayLabel(text));
    b.dataset.play = play;
    b.addEventListener('click', () => playSound(play));
    line.append(label, b);
    sbox.appendChild(line);
    return input;
  };
  const main = row(T.soundsOn, snd.on, v => { snd.on = v; saveSnd(); subs.forEach(i => { i.disabled = !v; }); });
  main.dataset.sound = 'on';
  const subs = Object.keys(SOUNDS).map(k => {
    const i = row(T.sounds[k], !snd.off.includes(k), v => {
      snd.off = v ? snd.off.filter(x => x !== k) : [...new Set([...snd.off, k])];
      saveSnd();
      if (v) sound(k);
    }, k);
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
  const engLabel = document.createElement('label');
  engLabel.htmlFor = 'engineUrl';
  engLabel.textContent = T.engineLabel;
  const engIn = document.createElement('input');
  engIn.id = 'engineUrl';
  engIn.type = 'url';
  engIn.placeholder = 'http://127.0.0.1:5191/';
  engIn.value = engineUrl;
  const engState = document.createElement('p');
  engState.className = 'net-note';
  engState.id = 'engineState';
  const showEngine = () => {
    engState.textContent = !engineUrl ? T.engineNone : engine.name ? T.engineOk(engine.name) : engine.error ? T.engineFail(engine.error) : T.engineWait;
  };
  engIn.addEventListener('change', async () => {
    engineUrl = engIn.value.trim();
    store.set('ab-moottori', engineUrl);
    engine.name = null; engine.error = null;
    showEngine();
    await engineHello();
    showEngine();
  });
  showEngine();
  const engNote = document.createElement('p');
  engNote.className = 'net-note';
  engNote.textContent = T.engineNote;
  // Käytössä oleva verkko ja sen ero syvyyteen (Tommin tilaus 18.11.2026): ennen tätä verkko
  // näkyi vain HTML-viennissä.
  for (const [cls, text] of [['net-line', netLabel(NET_FILE)], ['net-note', T.netVsDepth]]) {
    const p = document.createElement('p');
    p.className = cls;
    p.textContent = text;
    box.appendChild(p);
  }
  box.append(engLabel, engIn, engState, engNote);
  const nameLabel = document.createElement('label');
  nameLabel.htmlFor = 'myName';
  nameLabel.textContent = T.nameLabel;
  const nameIn = document.createElement('input');
  nameIn.id = 'myName';
  nameIn.type = 'text';
  nameIn.maxLength = 30;
  nameIn.autocomplete = 'nickname';
  nameIn.placeholder = T.namePlaceholder;
  nameIn.value = typeof myName === 'string' ? myName : '';
  nameIn.addEventListener('change', () => {
    myName = nameIn.value.trim();
    store.set('ab-nimi', myName);
    // Käynnissä oleva peli saa uuden nimen heti. Päättyneet pelit pitävät nimen, jolla ne pelattiin.
    const g = liveGame();
    if (g === game && !game.over && game.names) game.names[0] = meName();
    render();
  });
  box.append(nameLabel, nameIn);
  for (const k of PLAY_TOGGLES) {
    const label = document.createElement('label');
    label.className = 'wide';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = opts[k];
    input.dataset.toggle = k;
    input.addEventListener('change', () => {
      opts[k] = input.checked; store.set('ab-pelaaminen', opts);
      if (k === 'importAnalysis' && opts[k]) resumeAnalysis();
      render();
    });
    const span = document.createElement('span');
    span.textContent = T.toggles[k];
    label.append(input, span);
    box.appendChild(label);
  }
}
$('style').addEventListener('change', e => { prefs.style = e.target.value; store.set('ab-tyyli', prefs.style); applyLook(); render(); });
$('home').addEventListener('change', e => { prefs.left = e.target.value === 'left'; store.set('ab-koti-vasen', prefs.left); applyLook(); render(); });
darkQuery?.addEventListener?.('change', () => { applyLook(); render(); });

// Pikanäppäimet Windows-työpöydälle (Tommin valinta 1.11.2026): Ctrl+Z kumoaa, välilyönti heittää,
// Enter vahvistaa valmiin siirron tai jatkaa tai aloittaa seuraavan pelin, S vaihtaa nopat.
// Peruuttamattomilla teoilla (otto, luopuminen, luovutus) ei ole näppäintä. Kenttien ja
// valintojen näppäimet jätetään niille.
document.addEventListener('keydown', ev => {
  if (ev.target.closest?.('input, select, textarea, details.menu, .langmenu, dialog') || ev.altKey || ev.metaKey) return;
  const key = ev.key.toLowerCase();
  // Aseman luonnissa pelin näppäimet eivät toimi, ja Esc peruu luonnin.
  if (edit) { if (key === 'escape') { ev.preventDefault(); cancelEdit(); } return; }
  // Rivin aseman katselussa nuolet ylös ja alas askeltavat listaa ja Esc palaa peliin.
  if (!review && sel.d !== null) {
    if (key === 'escape') { ev.preventDefault(); resume(); }
    else if (key === 'arrowdown' || key === 'arrowup') { ev.preventDefault(); stepSel(key === 'arrowdown' ? 1 : -1); }
    if (viewing()) return;
  }
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

// Paneelien asettelu (Tommin toiveet 10.11.2026). Sivu tunnistaa näytön muodon ikkunan
// kuvasuhteesta ja käyttää sen asettelua: leveä vaakanäyttö (vähintään 1,6), tavallinen
// vaakanäyttö (1–1,6) ja pystynäyttö (alle 1). Kullekin muodolle tallentuvat erikseen paneelien
// paikat (laudan vieressä tai alla), piilotetut paneelit, sivusarakkeen ja alarivin paneelien
// leveydet sekä paneelien korkeudet, jotta tabletin säätö ei muuta pöytäkoneen asettelua.
// Paneeli siirtyy otsikosta raahaamalla, leveys erottimesta ja korkeus paneelin oikeasta
// alakulmasta. Kaksoisklikkaus erottimeen palauttaa oletusleveyden. Tulokset, Asetukset ja Säännöt
// eivät ole paneeleja vaan otsikkorivin valikoita (13.11. ja 14.11.2026). Säätö toimii vain muokkaustilassa (alempana). Tila on selaimessa avaimella ab-asettelu. Vanha
// avain ab-paneelit (yksi asettelu kaikille muodoille) jätetään lukematta.
const PANELS = ['gamePanel', 'evalPanel'];
const HIDEABLE = ['gamePanel', 'evalPanel'];
const SHAPES = ['wide', 'normal', 'tall'];
const LAYOUT_DEFAULTS = {
  wide: { side: ['gamePanel', 'evalPanel'], below: [] },
  normal: { side: ['gamePanel', 'evalPanel'], below: [] },
  tall: { side: [], below: ['evalPanel', 'gamePanel'] },
};
const shapeOf = () => {
  const r = window.innerWidth / Math.max(1, window.innerHeight);
  return r >= 1.6 ? 'wide' : r >= 1 ? 'normal' : 'tall';
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(Math.max(lo, hi), v));
const layouts = store.get('ab-asettelu', {});
function profile(shape) {
  const d = LAYOUT_DEFAULTS[shape];
  const p = layouts[shape] && typeof layouts[shape] === 'object' ? layouts[shape] : {};
  // Jokainen paneeli on täsmälleen yhdessä paikassa. Tuntematon jätetään pois, puuttuva alle.
  const seen = new Set();
  const keep = a => (Array.isArray(a) ? a : []).filter(id => PANELS.includes(id) && !seen.has(id) && seen.add(id));
  const side = keep(p.side ?? d.side), below = keep(p.below ?? d.below);
  for (const id of PANELS) if (!seen.has(id)) below.push(id);
  const hidden = (Array.isArray(p.hidden) ? p.hidden : []).filter(id => HIDEABLE.includes(id));
  const num = v => (Number.isFinite(v) && v > 0 ? Math.round(v) : undefined);
  const w = {}, h = {};
  for (const id of PANELS) {
    if (num(p.w?.[id])) w[id] = num(p.w[id]);
    if (typeof p.h?.[id] === 'string' && /^\d+(\.\d+)?px$/.test(p.h[id])) h[id] = p.h[id];
  }
  return layouts[shape] = { side, below, hidden, sideW: num(p.sideW), w, h };
}
let shape = shapeOf();
let lay = profile(shape);
let dragging = null;
let builtKey = '';
const saveLayout = () => store.set('ab-asettelu', layouts);
const visible = id => !lay.hidden.includes(id);

function applyLayout() {
  const root = document.documentElement.style;
  if (lay.sideW) root.setProperty('--side-w', `${lay.sideW}px`); else root.removeProperty('--side-w');
  // DOM rakennetaan uudelleen vain, kun järjestys tai näkyvyys muuttuu. Muuten raahattava erotin
  // poistuisi kesken raahauksen.
  const key = JSON.stringify([lay.side, lay.below, lay.hidden]);
  if (key !== builtKey) {
    builtKey = key;
    const side = document.querySelector('.side'), below = document.querySelector('.below');
    for (const s of below.querySelectorAll(':scope > .split')) s.remove();
    for (const id of lay.side) side.appendChild($(id));
    let prev = null;
    for (const id of lay.below) {
      // Erotin näkyvien alarivin paneelien väliin säätää vasemman paneelin leveyttä.
      if (prev && visible(id)) below.appendChild(belowSplit(prev));
      below.appendChild($(id));
      if (visible(id)) prev = id;
    }
  }
  for (const id of PANELS) {
    const el = $(id);
    el.hidden = !visible(id);
    el.style.height = lay.h[id] ?? '';
    el.style.flex = lay.below.includes(id) && lay.w[id] ? `0 0 ${lay.w[id]}px` : '';
  }
  document.body.classList.toggle('no-side', !dragging && !lay.side.some(visible));
  placeMatchRow();
  syncBoardH();
}
// Ottelun pituuden rivi on Peli-paneelin yläpuolella. Jos Peli on alarivissä tai laudan vieressä
// ei näy yhtään paneelia, rivi on alarivin ensimmäisenä. DOM-siirto vain paikan muuttuessa.
function placeMatchRow() {
  const row = $('matchRow'), gp = $('gamePanel');
  const inSide = lay.side.includes('gamePanel') && !document.body.classList.contains('no-side');
  if (inSide) { if (gp.previousElementSibling !== row) gp.before(row); return; }
  const below = document.querySelector('.below');
  if (below.firstElementChild !== row) below.prepend(row);
}
// Laudan vieressä paneelit jakavat laudan sarakkeen korkeuden (CSS-muuttuja --board-h).
function syncBoardH() {
  const h = Math.round(document.querySelector('.boardcol').getBoundingClientRect().height);
  document.documentElement.style.setProperty('--board-h', `${h}px`);
}
function belowSplit(id) {
  const el = document.createElement('div');
  el.className = 'split';
  el.setAttribute('role', 'separator');
  el.setAttribute('aria-orientation', 'vertical');
  splitter(el, x => {
    const b = $(id).getBoundingClientRect(), all = document.querySelector('.below').getBoundingClientRect();
    lay.w[id] = Math.round(clamp(x - b.left, 180, all.right - b.left - 200));
  }, () => { delete lay.w[id]; });
  return el;
}
function splitter(el, set, reset) {
  el.addEventListener('pointerdown', ev => {
    if (!editing) return;
    ev.preventDefault();
    el.setPointerCapture(ev.pointerId);
    el.classList.add('drag');
    const move = e => { set(e.clientX); applyLayout(); };
    const up = () => {
      el.classList.remove('drag');
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      saveLayout();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  });
  el.addEventListener('dblclick', () => { if (!editing) return; reset(); applyLayout(); saveLayout(); });
}
splitter($('splitSide'), x => {
  const b = document.querySelector('.layout').getBoundingClientRect();
  lay.sideW = Math.round(clamp(prefs.left ? x - b.left : b.right - x, 240, b.width - 360));
}, () => { delete lay.sideW; });

// Siirto: paneeli seuraa osoitinta laudan viereen tai alle, kun otsikkoa on raahattu 6 px.
// Paikka lasketaan lähimmästä näkyvästä paneelista: sivusarakkeessa pystysuunnassa, alarivissä
// rivin ja vaakasuunnan mukaan.
function dropAt(id, x, y) {
  const zones = [['side', document.querySelector('.side')], ['below', document.querySelector('.below')]];
  const inside = r => x >= r.left - 16 && x <= r.right + 16 && y >= r.top - 16 && y <= r.bottom + 16;
  const hit = zones.find(([, z]) => inside(z.getBoundingClientRect()));
  if (!hit) return false;
  const [key] = hit;
  const others = lay[key].filter(o => o !== id && visible(o));
  let index = others.length;
  for (let i = 0; i < others.length; i++) {
    const r = $(others[i]).getBoundingClientRect();
    const before = key === 'side' ? y < r.top + r.height / 2
      : y < r.top || (y <= r.bottom && x < r.left + r.width / 2);
    if (before) { index = i; break; }
  }
  // Uusi järjestys: piilotetut paneelit pysyvät listassa entisillä paikoillaan lopussa.
  const order = [...others.slice(0, index), id, ...others.slice(index)];
  const next = { side: lay.side.filter(o => o !== id), below: lay.below.filter(o => o !== id) };
  next[key] = [...order, ...lay[key].filter(o => o !== id && !visible(o))];
  if (JSON.stringify(next.side) === JSON.stringify(lay.side) && JSON.stringify(next.below) === JSON.stringify(lay.below)) return false;
  lay.side = next.side; lay.below = next.below;
  return true;
}
for (const id of PANELS) {
  const head = $(id).querySelector('h2');
  head.addEventListener('pointerdown', ev => {
    if (!editing || ev.button !== 0 || window.matchMedia('(max-width: 760px)').matches) return;
    // Kuuntelu on ikkunassa eikä osoittimen kaappauksella, koska paneelin siirto DOMissa
    // vapauttaa kaappauksen ja pudotus jäisi kuulematta.
    const x0 = ev.clientX, y0 = ev.clientY;
    ev.preventDefault();
    const move = e => {
      if (!dragging) {
        if (Math.hypot(e.clientX - x0, e.clientY - y0) < 6) return;
        dragging = id;
        document.body.classList.add('dragging');
        $(id).classList.add('moving');
        applyLayout();
      }
      if (dropAt(id, e.clientX, e.clientY)) applyLayout();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (!dragging) return;
      dragging = null;
      document.body.classList.remove('dragging');
      $(id).classList.remove('moving');
      applyLayout();
      saveLayout();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
}

// Muokkauspalkin asetteluosa: näytön muoto, piilotetut paneelit ja oletuksen palautus.
// Muokkaustila (Tommin valinta 10.11.2026): asettelu on lukittu, kunnes yläreunan Muokkaa
// asettelua avaa sen. Tila ei tallennu, joten sivu aukeaa aina lukittuna. Muokkauspalkissa ovat
// näytön muoto, piilotetut paneelit palautusnappeineen ja oletuksen palautus.
let editing = false;
function setEditing(on) {
  editing = on;
  document.body.classList.toggle('editing', on);
  $('editBar').hidden = !on;
  $('editLayout').textContent = on ? T.editDone : T.editLayout;
  $('editLayout').setAttribute('aria-pressed', String(on));
  syncBoardH();
}
const setHidden = (id, hide) => {
  lay.hidden = hide ? [...new Set([...lay.hidden, id])] : lay.hidden.filter(o => o !== id);
  applyLayout();
  fillLayout();
  saveLayout();
};
for (const id of HIDEABLE) {
  const b = document.createElement('button');
  b.className = 'hide-btn';
  b.textContent = '×';
  b.dataset.hide = id;
  b.addEventListener('click', () => setHidden(id, true));
  $(id).appendChild(b);
}
function fillLayout() {
  $('editLayout').textContent = editing ? T.editDone : T.editLayout;
  $('shapeMsg').textContent = T.layoutShape(T.shapes[shape]);
  for (const id of HIDEABLE) {
    const b = $(id).querySelector('.hide-btn');
    b.title = T.hidePanel(T.static[id]);
    b.setAttribute('aria-label', b.title);
  }
  const box = $('hiddenList');
  box.textContent = '';
  const gone = HIDEABLE.filter(id => !visible(id));
  if (!gone.length) return;
  const label = document.createElement('span');
  label.className = 'caption';
  label.textContent = T.hiddenPanels;
  box.appendChild(label);
  for (const id of gone) {
    const b = document.createElement('button');
    b.textContent = `${T.static[id]} +`;
    b.title = T.showPanel(T.static[id]);
    b.setAttribute('aria-label', b.title);
    b.dataset.show = id;
    b.addEventListener('click', () => setHidden(id, false));
    box.appendChild(b);
  }
}
$('editLayout').addEventListener('click', () => setEditing(!editing));
document.addEventListener('keydown', ev => {
  if (editing && ev.key === 'Escape' && !ev.target.closest?.('input, select, textarea, dialog')) setEditing(false);
});
$('resetLayout').addEventListener('click', () => {
  delete layouts[shape];
  lay = profile(shape);
  applyLayout();
  fillLayout();
  saveLayout();
});
window.addEventListener('resize', () => {
  syncBoardH();
  const s = shapeOf();
  if (s === shape) return;
  shape = s;
  lay = profile(shape);
  applyLayout();
  fillLayout();
});
applyLayout();
if (typeof ResizeObserver === 'function') {
  // Selaimen oma koonmuutos kirjoittaa korkeuden elementin tyyliin. Se luetaan talteen.
  const ro = new ResizeObserver(() => {
    const h = {};
    for (const id of PANELS) if ($(id).style.height) h[id] = $(id).style.height;
    if (JSON.stringify(h) !== JSON.stringify(lay.h)) { lay.h = h; saveLayout(); }
  });
  for (const id of PANELS) ro.observe($(id));
  new ResizeObserver(syncBoardH).observe(document.querySelector('.boardcol'));
}

applyStatic();
fillHead();
fillLimits();
fillLook();
fillLayout();
applyLook();
// Otsikkorivin valikot: Tulokset, Asetukset, Säännöt ja kieli. Vain yksi on kerrallaan auki. Klikkaus
// valikon ulkopuolelle tai Esc sulkee.
const menus = [...document.querySelectorAll('details.menu')];
const langOpen = on => { $('langList').hidden = !on; $('lang').setAttribute('aria-expanded', String(on)); };
function closeMenus(except) {
  for (const m of menus) if (m !== except) m.open = false;
  if (except !== 'lang') langOpen(false);
}
for (const m of menus) m.addEventListener('toggle', () => { if (m.open) closeMenus(m); });
$('lang').addEventListener('click', () => { const on = $('langList').hidden; closeMenus('lang'); langOpen(on); });
$('langList').addEventListener('click', e => {
  const o = e.target.closest('[data-code]');
  if (!o) return;
  langOpen(false);
  setLang(o.dataset.code); fillHead(); fillLimits(); fillLook(); fillLayout(); fillGameSel(); fillEditor();
  if (review) { fillReview(); $('reviewGame').value = String(review.gi); showStep(); } else render();
});
document.addEventListener('pointerdown', e => {
  if (!e.target.closest?.('details.menu, .langmenu')) closeMenus();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && (menus.some(m => m.open) || !$('langList').hidden)) closeMenus();
});
newGame();

// Aseman linkki (#xgid=...) avautuu selaukseen kuten tuotu ottelu. Botin kesken oleva vuoro
// odotetaan loppuun, koska selaus korvaa pelin näkymän.
function openLink() {
  const h = location.hash.slice(1);
  if (!h || !parseMatch(h)?.link) return;
  if (!review && game.phase === 'bot') { setTimeout(openLink, 300); return; }
  importMatch(h);
}
window.addEventListener('hashchange', openLink);
openLink();

// Testikoukku: ?debug antaa automaattiselle läpipeluulle pääsyn tilaan.
if (location.search.includes('debug')) window.__dg = { get game() { return game; }, currentXGID, loadXGID, importMatch, get review() { return review; }, step, nextMark, playFromHere, closeReview, played, get ply() { return ply; }, match, prefs, opts, snd, newGame, clickSpot, swapDice, remainingDice, nextMoves, humanDouble, humanTake, humanDrop, botCube, humanOfferDraw, humanAcceptDraw, humanDeclineDraw };
