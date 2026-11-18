// Analysoidun pelin vienti itsenäiseksi HTML-sivuksi (Tommin tilaus 14.11.2026, mallina gnubg:n ja
// XG:n HTML-vienti): jokaisesta siirrosta ja kuutiopäätöksestä lautakuva ennen päätöstä ja analyysi.
// Sivu toimii selaimessa ilman sovellusta: ei skriptejä eikä ulkoisia tiedostoja. Laudan tausta,
// pisteiden numerot ja nappulat ovat kerran sivun alussa symboleina, ja jokainen lauta viittaa
// niihin, jotta sadat laudat eivät kasvata tiedostoa.
//
// Päätökset ovat sovelluksen päätösmuodossa (src/ui.mjs decide ja reviewRecord): asema s on
// [alhaalla oleva pelaaja, ylhäällä oleva] kummankin omassa numeroinnissa, siirrossa r on verkon
// arvio (best, played, top) ja kuutiopäätöksessä w ja should. Värirajat ovat samat kuin Peli-
// paneelin listassa: yli 0,080 punainen ja yli 0,020 vihreä.

import { pips, OFF, BAR } from './engine.mjs';
import { cubeLook } from './ulkoasu.mjs';
import { cubeOptions, JANOWSKI_X } from './kuutio.mjs';

const COL = 30, BAR_W = 30, TRAY_W = 34, NUM_H = 16, HALF_H = 150, MID_H = 30;
const LEFT = 0, RIGHT = 6 * COL + BAR_W, TRAY_X = 12 * COL + BAR_W;
const W = TRAY_X + TRAY_W, TOP = NUM_H, BOTTOM = NUM_H + 2 * HALF_H + MID_H, H = BOTTOM + NUM_H;
const R = 13, STEP = 26, SHOWN = 5, CUBE = 28;
export const BLUNDER = 0.08, ERROR = 0.02;
// Nopan silmät keskipisteen suhteen (−1, 0 tai 1 kertaa silmäväli).
const PIPS = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Sarake vasemmalta 0–11. Alhaalla pisteet 12–1, ylhäällä 13–24 (koti oikealla alhaalla).
const colOf = pt => (pt >= 13 ? pt - 13 : 12 - pt);
const xOf = c => (c < 6 ? LEFT + c * COL : RIGHT + (c - 6) * COL);

// Yhteiset symbolit: tausta pisteineen ja numeroineen sekä kaksi nappulaa.
export function defs(look) {
  const o = [];
  o.push(`<rect width="${W}" height="${H}" fill="${look.frame}"/>`);
  o.push(`<rect x="${LEFT}" y="${TOP}" width="${6 * COL}" height="${BOTTOM - TOP}" fill="${look.felt}"/>`);
  o.push(`<rect x="${RIGHT}" y="${TOP}" width="${6 * COL}" height="${BOTTOM - TOP}" fill="${look.felt}"/>`);
  o.push(`<rect x="${TRAY_X}" y="${TOP}" width="${TRAY_W}" height="${BOTTOM - TOP}" fill="${look.tray}"/>`);
  for (let pt = 1; pt <= 24; pt++) {
    const x = xOf(colOf(pt)), top = pt >= 13;
    const fill = pt % 2 ? look.wedgeOdd : look.wedgeEven;
    const y0 = top ? TOP : BOTTOM, y1 = top ? TOP + HALF_H : BOTTOM - HALF_H;
    o.push(`<polygon points="${x},${y0} ${x + COL},${y0} ${x + COL / 2},${y1}" fill="${fill}"/>`);
    o.push(`<text x="${x + COL / 2}" y="${top ? TOP - 4 : H - 4}">${pt}</text>`);
  }
  const checker = (id, c) => `<symbol id="${id}" viewBox="-14 -14 28 28"><circle r="${R}" fill="${c.fill}" stroke="#17120F" stroke-width="1.2"/></symbol>`;
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>`
    + `<g id="bg" font-size="11" text-anchor="middle" fill="#F0E7D6" font-family="sans-serif">${o.join('')}</g>`
    + checker('c0', look.self) + checker('c1', look.opp) + `</defs></svg>`;
}

// Yksi lauta: nappulat, muuri, ulos pelatut, pipit, nopat ja kuutio. dice on null kuutiopäätöksessä.
// flip piirtää ylemmän pelaajan alas, jotta kiilojen numerot ovat hänen numerointiaan kuten
// gnubg:n ja XG:n viennissä (Tommi 18.11.2026). Pelaajan väri säilyy käännettäessä. Pipit, kuutio
// ja off-lokero piirretään kuten pelattavalla laudalla (src/ui.mjs, Tommi 18.11.2026): style on
// laudan tyyli kuution ulkoasua varten, ja Crawford-pelissä kuutiota ei ole.
export function boardSVG(s, { dice = null, mover = 0, cube = { value: 1, owner: -1 }, look, flip = false, crawford = false, style = 'x22' }) {
  const b = flip ? 1 : 0, t = 1 - b;
  const o = [`<use href="#bg"/>`];
  const piece = (p, x, y, label) => {
    o.push(`<use href="#c${p}" x="${x - 14}" y="${y - 14}" width="28" height="28"/>`);
    if (label) o.push(`<text x="${x}" y="${y + 4}" class="n${p}">${label}</text>`);
  };
  const stack = (p, n, x, fromTop) => {
    for (let k = 0; k < Math.min(n, SHOWN); k++) {
      const y = fromTop ? TOP + R + 1 + k * STEP : BOTTOM - R - 1 - k * STEP;
      piece(p, x, y, k === SHOWN - 1 && n > SHOWN ? n : '');
    }
  };
  for (let pt = 1; pt <= 24; pt++) {
    const x = xOf(colOf(pt)) + COL / 2, top = pt >= 13;
    if (s[b][pt]) stack(b, s[b][pt], x, top);
    const q = 25 - pt;
    if (s[t][q]) stack(t, s[t][q], x, top);
  }
  // Muurin nappula on sillä puolella, jonne se on menossa: alempi ylhäällä, ylempi alhaalla.
  const bx = 6 * COL + BAR_W / 2, mid = TOP + HALF_H + MID_H / 2;
  const barStack = (p, n, up) => {
    for (let k = 0; k < Math.min(n, 3); k++) piece(p, bx, up ? mid - MID_H / 2 - R - k * STEP : mid + MID_H / 2 + R + k * STEP, k === 2 && n > 3 ? n : '');
  };
  barStack(b, s[b][BAR], true);
  barStack(t, s[t][BAR], false);
  const tx = TRAY_X + TRAY_W / 2;
  // Off-lokero kuten laudan drawOff: jokainen ulos pelattu on viiva, viiden ryhmissä, ja luku on
  // pelaajan värisessä kiekossa kuution puoleisessa päässä. Omistettu kuutio lyhentää lokeroa.
  const off = (p, n, upper) => {
    if (!n) return;
    const c = p === 0 ? look.self : look.opp;
    const x0 = TRAY_X + 3, w = TRAY_W - 6;
    const owned = !crawford && cube.owner === p ? CUBE + 6 : 0;
    const h = mid - CUBE / 2 - 6 - (TOP + 3) - owned;
    const y0 = upper ? TOP + 3 + owned : BOTTOM - 3 - h - owned;
    o.push(`<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="4" fill="${look.tray}" stroke="#17120F" stroke-width="1"/>`);
    const inset = 5, disc = w - 4;
    const room = h - 2 * inset - disc - 4, step = Math.min(7, room / 17), gap = step >= 3.5 ? step : 0;
    for (let i = 0; i < n; i++) {
      const e = i * step + Math.floor(i / SHOWN) * gap;
      const y = upper ? y0 + inset + e : y0 + h - inset - e - step + 1;
      o.push(`<rect x="${x0 + 3}" y="${y.toFixed(1)}" width="${w - 6}" height="${(step - 1).toFixed(1)}" rx="1.5" fill="${c.fill}" stroke="#17120F" stroke-width="0.8"/>`);
    }
    const dy = upper ? y0 + h - inset - disc / 2 : y0 + inset + disc / 2;
    o.push(`<circle cx="${tx}" cy="${dy}" r="${disc / 2}" fill="${c.fill}" stroke="#17120F" stroke-width="1.2"/>`);
    o.push(`<text x="${tx}" y="${dy + 4.5}" class="n${p}">${n}</text>`);
  };
  off(t, s[t][OFF], true);
  off(b, s[b][OFF], false);
  // Pipit muurin päissä kuten laudalla: luku ja ero sulkeissa, ylhäällä ylemmän ja alhaalla
  // alemman pelaajan. Ero on oma miinus toisen, joten miinus tarkoittaa pienempää pip-lukua.
  const lead = (a, c) => (a - c > 0 ? `+${a - c}` : a - c < 0 ? `−${c - a}` : '0');
  const pt = pips(s[t]), pb = pips(s[b]);
  o.push(`<text x="${bx}" y="${TOP + 14}" class="pip">${pt}</text><text x="${bx}" y="${TOP + 28}" class="pip">(${lead(pt, pb)})</text>`);
  o.push(`<text x="${bx}" y="${BOTTOM - 20}" class="pip">${pb}</text><text x="${bx}" y="${BOTTOM - 6}" class="pip">(${lead(pb, pt)})</text>`);
  // Kuutio lokerossa laudan tyylillä: keskellä tai omistajan päässä. Crawford-pelissä ei kuutiota.
  if (!crawford) {
    const cl = cubeLook(style);
    const cy = cube.owner === -1 ? mid : cube.owner === b ? BOTTOM - 3 - CUBE / 2 : TOP + 3 + CUBE / 2;
    const x = tx - CUBE / 2, y = cy - CUBE / 2, v = cube.value === 1 ? 64 : cube.value;
    if (cl.cut) {
      const k = CUBE * 0.22;
      o.push(`<polygon points="${x + k},${y} ${x + CUBE - k},${y} ${x + CUBE},${y + k} ${x + CUBE},${y + CUBE - k} ${x + CUBE - k},${y + CUBE} ${x + k},${y + CUBE} ${x},${y + CUBE - k} ${x},${y + k}" fill="${cl.fill}" stroke="${cl.border ?? '#17120F'}" stroke-width="1.5"/>`);
    } else o.push(`<rect x="${x}" y="${y}" width="${CUBE}" height="${CUBE}" rx="${CUBE / 6}" fill="${cl.fill}" stroke="#17120F" stroke-width="1.5"/>`);
    o.push(`<text x="${tx}" y="${cy + 5}" class="cube" style="fill:${cl.value(cube.value === 1 ? null : v)}${cl.bold ? '' : ';font-weight:normal'}">${v}</text>`);
  }
  // Nopat siirtäjän puolella: alemman oikealla, ylemmän vasemmalla. Silmät eikä numero, kuten
  // laudalla (Tommi 18.11.2026).
  if (dice) {
    const x0 = mover === b ? RIGHT + 3 * COL : LEFT + 3 * COL;
    const c = mover === 0 ? look.self : look.opp;
    dice.forEach((v, k) => {
      const x = x0 + (k ? 6 : -30);
      o.push(`<rect x="${x}" y="${mid - 12}" width="24" height="24" rx="4" fill="${c.fill}" stroke="#17120F"/>`);
      for (const [dx, dy] of PIPS[v]) o.push(`<circle cx="${x + 12 + 6.5 * dx}" cy="${mid + 6.5 * dy}" r="2.3" fill="${c.on}"/>`);
    });
  }
  return `<svg class="board" viewBox="0 0 ${W} ${H}" role="img">${o.join('')}</svg>`;
}

// Siirron ero parhaaseen (equity) ja luokka listan väreillä.
export const lossOf = d => (d.k === 'move' && d.r ? Math.max(0, 2 * (d.r.best - d.r.played)) : null);
const classOf = loss => (loss === null ? '' : loss > BLUNDER ? 'blunder' : loss > ERROR ? 'error' : '');

function moveTable(d, T) {
  const played = d.text.split(': ')[1] ?? d.text, fmt = T.num;
  const loss = lossOf(d);
  const rows = d.r.top.map(t => ({ m: t.m, x: t.x, loss: t.loss, played: false }));
  let k = rows.findIndex(r => r.m === played);
  if (k < 0) k = rows.findIndex(r => Math.abs(r.x - d.r.played) < 1e-12);
  if (k >= 0) rows[k].played = true;
  else rows.push({ m: played, x: d.r.played, loss, played: true });
  const head = T.evalHead.map((h, i) => `<th${i ? ' class="num"' : ''}>${esc(h)}</th>`).join('');
  const body = rows.map(r => {
    const best = r.loss < 0.0005;
    return `<tr class="${best ? 'best' : 'worse'}${r.played ? ' played' : ''}"><td>${r.played ? '▶ ' : ''}${esc(r.m)}</td>`
      + `<td class="num">${esc(T.pct(r.x))}</td><td class="num">${esc((2 * r.x - 1 >= 0 ? '+' : '−') + fmt(Math.abs(2 * r.x - 1)))}</td>`
      + `<td class="num">${best ? '' : '−' + esc(fmt(r.loss))}</td></tr>`;
  }).join('');
  return `<table><tr>${head}</tr>${body}</table>`;
}

// Kuutiopäätöksen teksti otsikkoon ja taulukkoon. Laudalla pelatun pelin kuutiopäätöksellä ei ole
// tekstiä (src/ui.mjs cubeDecision), joten otsikko muodostetaan teosta.
export const cubeLabel = (T, act, v) => (act === 'double' ? T.logDouble(2 * v) : act === 'take' ? T.logTake : act === 'drop' ? T.logDrop : T.noDouble);
const textOf = (d, T) => d.text ?? (d.k === 'move' ? '' : cubeLabel(T, d.act, d.value));

// Kuutiopäätöksen equityt Janowskin mallilla (src/kuutio.mjs cubeOptions, JANOWSKI_X) tuplaajan
// näkökulmasta kuution nykyarvon yksikköinä, myös ottopäätöksessä, kuten gnubg:ssä. d.w on
// päättäjän voittotodennäköisyys, joten ottopäätöksessä tuplaajan on 1 − d.w. d.cube on kuutio
// ennen tuplausta. Paras on tuplaus, kun se on vähintään yhtä arvokas kuin tuplaamatta jättäminen
// (janowskiPolicy), ja tuplauksen arvo on ottajan valinta eli pienempi otosta ja luopumisesta.
export function cubeEquities(d) {
  const doubler = d.k === 'cube' ? d.p : 1 - d.p;
  const w = d.k === 'cube' ? d.w : 1 - d.w;
  const o = cubeOptions(w, d.cube ?? { value: 1, owner: -1 }, doubler, JANOWSKI_X);
  const dbl = Math.min(o.dt, o.dp);
  const best = dbl >= o.nd ? (o.dt <= o.dp ? 'dt' : 'dp') : 'nd';
  return { ...o, best, top: Math.max(o.nd, dbl) };
}
// Equityrivit taulukkoon: [vaihtoehto, equity, ero parhaaseen tai '', paras].
export function cubeEquityRows(d, T) {
  const e = cubeEquities(d);
  const sg = x => (x < -0.0005 ? '−' : '+') + T.num(Math.abs(x));
  return ['nd', 'dt', 'dp'].map((k, i) => [T.cubeEq[i], sg(e[k]), k === e.best ? '' : sg(e[k] - e.top), k === e.best]);
}

function cubeTable(d, T) {
  const cube = (act, v) => cubeLabel(T, act, v);
  const mine = d.k === 'cube' ? d.act === 'double' : d.act === 'take';
  const pick = d.k === 'cube' ? (d.should ? 'double' : 'nodouble') : (d.should ? 'take' : 'drop');
  const rows = [[T.cubeHead[0], cube(d.act, d.value)], [T.cubeHead[1], T.pct(d.w)], [T.cubeHead[2], cube(pick, d.value)],
    [T.cubeHead[3], mine === d.should ? T.sameBest : T.cubeDiff]];
  const eq = cubeEquityRows(d, T).map(([a, b, c, best]) => `<tr${best ? ' class="best"' : ''}><td>${esc(a)}</td><td class="num">${esc(b)}</td><td class="num">${esc(c)}</td></tr>`).join('');
  return `<table>${rows.map(([a, b], i) => `<tr${i === 3 ? ` class="${mine === d.should ? 'best' : 'worse'}"` : ''}><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</table>`
    + `<table class="cubeeq"><tr><th>${esc(T.cubeEqHead[0])}</th><th class="num">${esc(T.cubeEqHead[1])}</th><th class="num">${esc(T.cubeEqHead[2])}</th></tr>${eq}</table>`
    + `<p class="luck">${esc(T.cubeEqNote)}</p>`;
}

// Koko sivu. names on [alempi, ylempi], info on otsikon alle tulevat rivit [nimi, arvo] ja
// summary valmiit yhteenvedon kappaleet. lang on sivun kieli ja signed etumerkillinen luku.
export function gameHTML({ T, lang, title, names, info, summary, decisions, look, signed, crawford = false, style = 'x22', markLabel = m => m.text }) {
  const blocks = decisions.map((d, i) => {
    const loss = lossOf(d), cls = classOf(loss);
    const who = names[d.p];
    const titleText = T.evalTitle(d.n, who, textOf(d, T));
    let body;
    if (d.k === 'move') {
      if (d.forced) body = `<p>${esc(d.text.includes('/') ? T.evalForced : T.evalDance)}</p>`;
      else if (!d.r) body = `<p>${esc(T.exportNoAnalysis)}</p>`;
      else body = moveTable(d, T);
    } else body = d.w === undefined ? `<p>${esc(T.exportNoAnalysis)}</p>` : cubeTable(d, T);
    if (d.k === 'move' && d.luck !== undefined) body += `<p class="luck">${esc(T.luckLine(signed(d.luck)))}</p>`;
    if (d.mark) body = `<p class="mark">${esc(markLabel(d.mark))}</p>` + body;
    const board = boardSVG(d.s, { dice: d.k === 'move' ? d.dice : null, mover: d.p, cube: d.cube ?? { value: 1, owner: -1 }, look, flip: d.p === 1, crawford, style });
    const nav = `<nav>${i ? `<a href="#d${i - 1}">◀</a>` : ''} <a href="#top">▲</a> ${i < decisions.length - 1 ? `<a href="#d${i + 1}">▶</a>` : ''}</nav>`;
    return `<section id="d${i}" class="${cls}"><h3><span class="dot p${d.p}"></span>${d.mark ? '✱ ' : ''}${esc(titleText)}${loss !== null && loss >= 0.0005 ? ` <small>−${esc(T.num(loss))}</small>` : ''}</h3>`
      + `<div class="pos">${board}<div class="an">${body}${nav}</div></div></section>`;
  });
  // Virheluettelo linkkeineen, suurin ensin, avattavan otsikon takana (Tommin pyyntö 14.11.2026).
  const errs = decisions.map((d, i) => ({ d, i, loss: lossOf(d) })).filter(e => e.loss !== null && e.loss > ERROR)
    .sort((a, b) => b.loss - a.loss);
  const errList = errs.length
    ? `<details><summary>${esc(T.exportErrors(errs.length))}</summary><ol class="errs">${errs.map(e => `<li class="${classOf(e.loss)}"><a href="#d${e.i}">${esc(T.evalTitle(e.d.n, names[e.d.p], textOf(e.d, T)))}</a> −${esc(T.num(e.loss))}</li>`).join('')}</ol></details>`
    : '';
  // Merkityt asemat pelin järjestyksessä, avattuna, koska ne ovat lukijalle tarkoitettuja.
  const marked = decisions.map((d, i) => ({ d, i })).filter(e => e.d.mark);
  const markList = marked.length
    ? `<details open><summary>${esc(T.exportMarks(marked.length))}</summary><ol class="marks">${marked.map(e => `<li><a href="#d${e.i}">${esc(T.evalTitle(e.d.n, names[e.d.p], textOf(e.d, T)))}</a>${e.d.mark.text ? `: ${esc(e.d.mark.text)}` : ''}</li>`).join('')}</ol></details>`
    : '';
  const css = `
  :root { color-scheme: light dark; --bg: #FBF8F4; --ink: #1E1A16; --muted: #4C443B; --line: #B8AA98; --good: #2E7D32; --bad: #C62828; --accent: #6B5844; }
  @media (prefers-color-scheme: dark) { :root { --bg: #1B1712; --ink: #F0E7D6; --muted: #9A8D7A; --line: #6E6154; --good: #7CC47F; --bad: #FF786E; --accent: #E9973F; } }
  body { margin: 0; padding: 16px; background: var(--bg); color: var(--ink); font: 15px/1.45 Georgia, serif; }
  main { max-width: 980px; margin: 0 auto; }
  h1 { font-size: 1.5em; margin: 0 0 6px; } h2 { font-size: 1.15em; margin: 18px 0 6px; }
  h3 { font-size: 1em; margin: 0 0 8px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; margin: 8px 0; } dt { color: var(--muted); } dd { margin: 0; }
  section { border-top: 1px solid var(--line); padding: 14px 0; }
  section.error h3, li.error, li.error a { color: var(--good); } section.blunder h3, li.blunder, li.blunder a { color: var(--bad); }
  .pos { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }
  .board { width: 100%; max-width: 420px; height: auto; }
  .board text { font: 11px sans-serif; text-anchor: middle; }
  .board .n0 { fill: ${look.self.on}; font-weight: bold; font-size: 13px; } .board .n1 { fill: ${look.opp.on}; font-weight: bold; font-size: 13px; }
  .board .pip, .board .off { fill: #F0E7D6; font-size: 12px; } .board .cube { fill: #F0EBC0; font-weight: bold; font-size: 13px; }
  .an { flex: 1 1 280px; min-width: 0; }
  table { border-collapse: collapse; width: 100%; font: 13px/1.5 ui-monospace, Consolas, monospace; }
  th, td { padding: 2px 6px; text-align: left; } th { color: var(--muted); font-weight: normal; } .num { text-align: right; }
  tr.played { outline: 1px solid var(--line); } tr.best td:first-child { color: var(--good); }
  .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; border: 1px solid #17120F; }
  .dot.p0 { background: ${look.self.fill}; } .dot.p1 { background: ${look.opp.fill}; }
  nav { margin-top: 8px; display: flex; gap: 14px; } a { color: var(--accent); }
  small { font-weight: normal; }
  details { margin: 8px 0; } summary { cursor: pointer; color: var(--accent); }
  p.mark { font-style: italic; border-left: 3px solid var(--accent); padding-left: 8px; white-space: pre-wrap; }`;
  return `<!doctype html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${css}
</style>
</head>
<body>
${defs(look)}
<main id="top">
<h1>${esc(title)}</h1>
<dl>${info.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>
<h2>${esc(T.summaryTitle)}</h2>
${summary.map(p => `<p>${esc(p)}</p>`).join('\n')}
${markList}
${errList}
<h2>${esc(T.exportMoves)}</h2>
${blocks.join('\n')}
</main>
</body>
</html>
`;
}
