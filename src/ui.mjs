// Selainlauta: ihminen (pelaaja 0) verkkobottia (pelaaja 1) vastaan kuution kanssa.
// Verkko siirtää ja tekee kuutiopäätökset omalla arviollaan (src/verkko.mjs, Kaanon §4).
// Lauta piirretään ihmisen näkökulmasta: oma piste i, botin nappulat bottipisteessä 25 - i.

import { initialState, legalPlays, pips, exited, clone, OFF, BAR, DRAW_HALF, DRAW_ROWS } from './engine.mjs';
import { fromJSON, netBot, netCube, value } from './verkko.mjs';
import { newCube, mayDouble, tablePolicy, MATCH_LIMIT } from './kuutio.mjs';
import { T, applyStatic, switchLang } from './kieli.mjs';

const NS = 'http://www.w3.org/2000/svg';
const $ = id => document.getElementById(id);
const svg = $('board');

const PW = 50, TOP = 10, BOTTOM = 510, TRI = 200, R = 21;
const BAR_X = 310, BAR_W = 40, TRAY_X = 660, TRAY_W = 90;

function pointX(i) {
  if (i <= 6) return 350 + (6 - i) * PW;
  if (i <= 12) return 10 + (12 - i) * PW;
  if (i <= 18) return 10 + (i - 13) * PW;
  return 350 + (i - 19) * PW;
}
const isTop = i => i >= 13;

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ei tallennusta */ } },
};

let game;
// Ottelu rangaistuspisteiden rajaan (Kaanon §2.5). crawford kertoo, onko Crawford-peli jo pelattu.
const match = store.get('ab-ottelu', { pen: [0, 0], crawford: false });
const pen = match.pen;
const saveMatch = () => store.set('ab-ottelu', match);
const matchOver = () => pen.some(x => x >= MATCH_LIMIT);
// Vastustajan verkko. Valinta ja vertailu: Kaanon/Anti-Backgammon §4.
export const NET_FILE = 'verkot/vo3plyop-nolla-s2.json';
const net = fromJSON(await (await fetch(NET_FILE)).text());
const botPlay = netBot(net);
const netPolicy = netCube(net);
let botCube;

const points = n => T.points(n);

function newGame() {
  if (matchOver()) { pen[0] = 0; pen[1] = 0; match.crawford = false; }
  // Crawford-peli on ensimmäinen peli sen jälkeen, kun jompikumpi on yhden pisteen päässä rajasta
  // (Kaanon §2.6).
  const crawford = !match.crawford && pen.some(x => x === MATCH_LIMIT - 1);
  if (crawford) match.crawford = true;
  saveMatch();
  botCube = tablePolicy(netPolicy, { away: pen.map(x => MATCH_LIMIT - x), crawford });
  let a, b;
  do { a = 1 + Math.floor(Math.random() * 6); b = 1 + Math.floor(Math.random() * 6); } while (a === b);
  game = {
    s: initialState(), dice: [a, b], turn: a > b ? 0 : 1, phase: 'move', cube: newCube(),
    crawford, plays: null, partial: [], hitsMarks: [], selected: null, base: null,
    lastBot: [], log: [], moveNo: 0, half: 0, over: false, errors: [], analysed: 0, totalLoss: 0, lastNote: '',
    msg: T.opening(a, b, a > b, crawford),
  };
  if (game.turn === 0) beginHumanMove(); else later(() => botTurn(true), 600);
  render();
}

// Botin viivästetty vuoro kuuluu sille pelille, jossa se ajastettiin. Ilman tätä luovutus ja uusi
// peli ennen ajastimen laukeamista antaisivat uudelle pelille vanhan pelin botin siirron.
function later(fn, ms) {
  const g = game;
  setTimeout(() => { if (game === g) fn(); }, ms);
}

function roll() { return [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]; }

function notation(d, moves, hits) {
  const parts = moves.map(([f, t], k) => `${f === BAR ? 25 : f}/${t}${hits[k] ? '*' : ''}`);
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
  game.plays = legalPlays(game.s, 0, game.dice[0], game.dice[1], true);
  game.partial = []; game.hitsMarks = []; game.selected = null;
  game.phase = 'move';
  if (game.plays.every(p => p.moves.length === 0)) {
    game.phase = 'pass';
    game.msg = T.noLegal(`${game.dice[0]}${game.dice[1]}`);
  }
}

function candidates() {
  const k = game.partial.length;
  return game.plays.filter(p => game.partial.every((m, j) => p.moves[j][0] === m[0] && p.moves[j][1] === m[1]) && p.moves.length >= k);
}
function nextMoves() {
  const k = game.partial.length;
  return candidates().filter(p => p.moves.length > k).map(p => p.moves[k]);
}
const complete = () => candidates().some(p => p.moves.length === game.partial.length);

function clickSpot(spot) {
  if (game.over || game.turn !== 0 || game.phase !== 'move') return;
  const nm = nextMoves();
  if (game.selected === null) {
    const dests = [...new Set(nm.filter(m => m[0] === spot).map(m => m[1]))];
    if (dests.length === 0) return;
    if (dests.length === 1) { doMove(spot, dests[0]); return; }
    game.selected = spot;
  } else if (spot === game.selected) {
    game.selected = null;
  } else if (nm.some(m => m[0] === game.selected && m[1] === spot)) {
    doMove(game.selected, spot);
    return;
  } else {
    game.selected = null;
    clickSpot(spot);
    return;
  }
  render();
}

function doMove(from, to) {
  game.partial.push([from, to]);
  game.hitsMarks.push(applyMove(game.s, 0, from, to));
  game.selected = null;
  if (exited(game.s[0])) { finishHuman(); return; }
  render();
}

function undo() {
  if (game.turn !== 0 || game.partial.length === 0) return;
  game.partial.pop(); game.hitsMarks.pop();
  game.s = clone(game.base);
  for (const [f, t] of game.partial) applyMove(game.s, 0, f, t);
  game.selected = null;
  render();
}

// Siirron analyysi verkon omalla arviolla (0-ply, sama arvio jolla botti valitsee siirtonsa).
// Virhe on parhaan siirron ja pelatun siirron equityero ilman kuutiota: equity = 2 P(voitto) − 1,
// tasapeli puoli voittoa. Pakkosiirtoa ei analysoida.
// Luokan nimi haetaan näyttöhetkellä, jotta kielen vaihto koskee myös jo pelattuja siirtoja.
const LEVELS = [[0.16, '??', 0], [0.08, '?', 1], [0.04, '?!', 2]];
const level = loss => LEVELS.find(([t]) => loss >= t) ?? null;
const fmt = x => T.num(x);

function analyse() {
  const plays = legalPlays(game.base, 0, game.dice[0], game.dice[1]);
  if (plays.length < 2) return null;
  const v = st => (exited(st[0]) ? 0 : value(net, st, 0));
  let best = plays[0], bv = -1;
  for (const pl of plays) { const x = v(pl.s); if (x > bv) { bv = x; best = pl; } }
  const loss = Math.max(0, 2 * (bv - v(game.s)));
  const tmp = clone(game.base);
  const hits = best.moves.map(([f, t]) => applyMove(tmp, 0, f, t));
  return { loss, best: notation(game.dice, best.moves, hits).split(': ')[1] ?? '' };
}

function finishHuman() {
  game.moveNo++;
  const played = notation(game.dice, game.partial, game.hitsMarks);
  const a = game.partial.length ? analyse() : null;
  let mark = '';
  game.lastNote = '';
  if (a) {
    game.analysed++;
    game.totalLoss += a.loss;
    const lv = level(a.loss);
    if (lv) {
      mark = lv[1];
      game.errors.push({ n: game.moveNo, played, best: a.best, loss: a.loss });
      game.lastNote = T.noteBad(played, T.levels[lv[2]], fmt(a.loss), a.best);
    } else {
      game.lastNote = T.noteGood(played, fmt(a.loss));
    }
  }
  game.log.push({ n: game.moveNo, me: played + mark, bot: '' });
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
  if (!opening) game.dice = roll();
  const play = botPlay(game.s, 1, game.dice[0], game.dice[1], Math.random);
  // Lyönnit osasiirroittain notaatiota varten.
  const tmp = clone(game.s); const hits = [];
  for (const [f, t] of play.moves) hits.push(applyMove(tmp, 1, f, t));
  game.s = play.s;
  game.lastBot = play.moves.map(([, t]) => (t <= 0 ? 'off' : 25 - t));
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
  if (pen[0] >= MATCH_LIMIT) return T.matchLost(MATCH_LIMIT, pen[0], pen[1]);
  if (pen[1] >= MATCH_LIMIT) return T.matchWon(MATCH_LIMIT, pen[0], pen[1]);
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
function renderSummary(box) {
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
    li.textContent = T.summaryItem(e.n, e.played, fmt(e.loss), e.best);
    ol.appendChild(li);
  }
  box.appendChild(ol);
}

// ---------- piirto ----------

function el(name, attrs, parent = svg) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent.appendChild(e);
  return e;
}

function checker(x, y, mine, label) {
  el('circle', { cx: x, cy: y, r: R, fill: mine ? 'var(--me)' : 'var(--bot)', stroke: mine ? 'var(--me-edge)' : 'var(--bot-edge)', 'stroke-width': 2 });
  if (label) {
    const t = el('text', { x, y: y + 6, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 'bold', fill: mine ? 'var(--me-edge)' : 'var(--me)' });
    t.textContent = label;
  }
}

function stack(x, top, n, mine) {
  const shown = Math.min(n, 5);
  for (let k = 0; k < shown; k++) {
    const y = top ? TOP + R + 2 + k * (2 * R) : BOTTOM - R - 2 - k * (2 * R);
    checker(x, y, mine, k === shown - 1 && n > 5 ? String(n) : '');
  }
}

function render() {
  svg.textContent = '';
  const s = game.s;
  el('rect', { x: 0, y: 0, width: 760, height: 520, fill: 'var(--frame)' });
  el('rect', { x: 10, y: TOP, width: 640, height: BOTTOM - TOP, fill: 'var(--board)' });
  el('rect', { x: BAR_X, y: TOP, width: BAR_W, height: BOTTOM - TOP, fill: 'var(--frame)' });
  el('rect', { x: TRAY_X, y: TOP, width: TRAY_W, height: BOTTOM - TOP, fill: 'var(--board)', opacity: 0.6 });

  const nm = game.turn === 0 && game.phase === 'move' ? nextMoves() : [];
  const sources = new Set(nm.map(m => m[0]));
  const dests = new Set(game.selected === null ? [] : nm.filter(m => m[0] === game.selected).map(m => m[1]));

  for (let i = 1; i <= 24; i++) {
    const x = pointX(i), top = isTop(i);
    const tipY = top ? TOP + TRI : BOTTOM - TRI;
    const baseY = top ? TOP : BOTTOM;
    el('polygon', { points: `${x},${baseY} ${x + PW},${baseY} ${x + PW / 2},${tipY}`, fill: i % 2 ? 'var(--pt-a)' : 'var(--pt-b)' });
    const num = el('text', { x: x + PW / 2, y: top ? TOP + TRI + 22 : BOTTOM - TRI - 10, 'text-anchor': 'middle', 'font-size': 13, fill: 'var(--ink)', opacity: 0.6 });
    num.textContent = i;
    if (game.lastBot.includes(i)) el('rect', { x: x + 4, y: top ? TOP + 2 : BOTTOM - 6, width: PW - 8, height: 4, fill: 'var(--last)' });
    if (s[0][i] > 0) stack(x + PW / 2, top, s[0][i], true);
    const o = s[1][25 - i];
    if (o > 0) stack(x + PW / 2, top, o, false);
    if (sources.has(i) || dests.has(i) || game.selected === i) {
      el('rect', { x: x + 2, y: top ? TOP : BOTTOM - TRI - 30, width: PW - 4, height: TRI + 30, fill: 'none', stroke: game.selected === i ? 'var(--accent)' : 'var(--hl)', 'stroke-width': 3, rx: 6 });
    }
    const hit = el('rect', { x, y: top ? TOP : BOTTOM - TRI - 30, width: PW, height: TRI + 30, fill: 'transparent', class: 'pt' });
    hit.addEventListener('click', () => clickSpot(i));
  }

  // Baari: botin nappulat ylhäällä, omat alhaalla.
  const bx = BAR_X + BAR_W / 2;
  for (let k = 0; k < s[1][BAR]; k++) checker(bx, 200 - k * 2 * R, false, k === 0 && s[1][BAR] > 1 ? String(s[1][BAR]) : '');
  for (let k = 0; k < s[0][BAR]; k++) checker(bx, 320 + k * 2 * R, true, k === 0 && s[0][BAR] > 1 ? String(s[0][BAR]) : '');
  if (sources.has(BAR)) el('rect', { x: BAR_X + 1, y: 290, width: BAR_W - 2, height: 220, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 3, rx: 6 });
  const barHit = el('rect', { x: BAR_X, y: 260, width: BAR_W, height: 250, fill: 'transparent', class: 'pt' });
  barHit.addEventListener('click', () => clickSpot(BAR));

  // Ulos pelatut: botin ylhäällä, omat alhaalla.
  const tx = TRAY_X + TRAY_W / 2;
  const trayLabel = (y, n, mine) => {
    if (n === 0) return;
    checker(tx, y, mine, String(n));
  };
  trayLabel(TOP + 40, s[1][OFF], false);
  trayLabel(BOTTOM - 40, s[0][OFF], true);
  if (game.lastBot.includes('off')) el('rect', { x: TRAY_X + 4, y: TOP + 2, width: TRAY_W - 8, height: 4, fill: 'var(--last)' });
  if (dests.has(0)) el('rect', { x: TRAY_X + 2, y: 270, width: TRAY_W - 4, height: 238, fill: 'none', stroke: 'var(--hl)', 'stroke-width': 3, rx: 6 });
  const trayHit = el('rect', { x: TRAY_X, y: 260, width: TRAY_W, height: 250, fill: 'transparent', class: 'pt' });
  trayHit.addEventListener('click', () => clickSpot(0));

  // Kuutio ulos pelattujen sarakkeessa: keskellä ilman omistajaa, muuten omistajan puolella.
  const cy = game.cube.owner === -1 ? 245 : game.cube.owner === 1 ? 110 : 380;
  el('rect', { x: tx - 20, y: cy - 20, width: 40, height: 40, rx: 5, fill: 'var(--panel)', stroke: 'var(--frame)', 'stroke-width': 2 });
  const ct = el('text', { x: tx, y: cy + 7, 'text-anchor': 'middle', 'font-size': 19, 'font-weight': 'bold', fill: 'var(--ink)' });
  ct.textContent = game.cube.value === 1 ? '64' : game.cube.value;

  // Nopat laudan oikealle puoliskolle.
  if (game.dice && !game.over) {
    game.dice.forEach((d, k) => {
      const x = 470 + k * 50, y = 240;
      el('rect', { x, y, width: 40, height: 40, rx: 7, fill: game.turn === 0 ? 'var(--me)' : 'var(--bot)', stroke: 'var(--frame)', 'stroke-width': 2 });
      const t = el('text', { x: x + 20, y: y + 28, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 'bold', fill: game.turn === 0 ? 'var(--me-edge)' : 'var(--me)' });
      t.textContent = d;
    });
  }

  const hint = game.selected !== null ? T.chooseDest : (game.turn === 0 && game.phase === 'move' && nextMoves().length === 0 ? T.confirm : '');
  $('status').textContent = game.msg + hint;
  const box = $('analysis');
  box.textContent = '';
  if (game.over) renderSummary(box); else box.textContent = game.lastNote;
  $('roll').disabled = game.phase !== 'roll';
  const ready = game.turn === 0 && game.phase === 'move' && nextMoves().length === 0;
  $('done').style.display = ready ? '' : 'none';
  $('new').textContent = !game.over ? T.resign : matchOver() ? T.newMatch : T.nextGame;
  $('undo').disabled = !(game.turn === 0 && game.phase === 'move' && game.partial.length > 0);
  $('pass').style.display = game.phase === 'pass' ? '' : 'none';
  $('roll').style.display = game.phase === 'pass' || game.phase === 'offer' ? 'none' : '';
  $('double').style.display = game.phase === 'roll' && canDouble(0) ? '' : 'none';
  $('double').textContent = T.double(game.cube.value * 2);
  $('take').style.display = game.phase === 'offer' ? '' : 'none';
  $('drop').style.display = game.phase === 'offer' ? '' : 'none';
  $('cubeVal').textContent = game.crawford ? T.crawfordCube : game.cube.value;
  $('rows').textContent = `${Math.ceil(game.half / 2)} / ${DRAW_ROWS}`;
  $('penMe').textContent = pen[0];
  $('penBot').textContent = pen[1];
  $('pipMe').textContent = pips(s[0]);
  $('pipBot').textContent = pips(s[1]);
  $('log').textContent = game.log.map(r => `${r.n === '' ? '    ' : `${String(r.n).padStart(3)})`} ${r.me.padEnd(24)}${r.bot}`).join('\n');
  $('log').scrollTop = 1e6;
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
// Kesken olevan pelin hylkääminen on luovutus, joten siitä tulee kuution arvon verran
// rangaistuspisteitä (Kaanon §2.2).
$('new').addEventListener('click', () => {
  if (game.over) { newGame(); return; }
  logCube(T.logResign, '');
  endByDrop(0);
});

applyStatic();
$('lang').addEventListener('click', () => { switchLang(); render(); });
newGame();

// Testikoukku: ?debug antaa automaattiselle läpipeluulle pääsyn tilaan.
if (location.search.includes('debug')) window.__dg = { get game() { return game; }, match, newGame, clickSpot, nextMoves, humanDouble, humanTake, humanDrop, botCube };
