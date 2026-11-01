// Selainlaudan tekstit suomeksi ja englanniksi. Kieli valitaan osoitteen ?lang=fi|en-parametrista,
// sitten tallennetusta valinnasta ja lopuksi selaimen kielestä (suomi vain suomenkieliselle selaimelle).

const fi = {
  points: n => (n === 1 ? 'rangaistuspisteen' : `${n} rangaistuspistettä`),
  opening: (a, b, meFirst, crawford) => `Aloitusheitto: sinä ${a}, botti ${b}. `
    + (meFirst ? 'Sinä aloitat.' : 'Botti aloittaa.')
    + (crawford ? ' Crawford-peli: tässä pelissä ei ole kuutiota.' : ''),
  noLegal: d => `Heitit ${d}. Laillisia siirtoja ei ole.`,
  youRolled: d => `Heitit ${d}.`,
  botThinking: 'Botti miettii.',
  botDoubles: (v, pts) => `Botti tuplaa arvoon ${v}. Otatko vastaan? Luopuessasi saat ${pts}.`,
  botPlayed: (d, m) => `Botti heitti ${d} ja pelasi ${m}.`,
  botDanced: d => `Botti heitti ${d} eikä voinut siirtää.`,
  draw: rows => `${rows} riviä täynnä: tasapeli. Kumpikaan ei saa rangaistuspisteitä.`,
  youExited: pts => `Pelasit viimeisen nappulasi ulos. Saat ${pts}.`,
  botExited: pts => `Botti pelasi viimeisen nappulansa ulos ja saa ${pts}. Voitit pelin.`,
  matchLost: (l, a, b) => ` Saavutit rajan ${l} ja hävisit ottelun ${a}–${b}.`,
  matchWon: (l, a, b) => ` Botti saavutti rajan ${l}. Voitit ottelun ${a}–${b}.`,
  youDropped: pts => `Luovuit pelistä. Saat ${pts}.`,
  botDropped: pts => `Botti luopui ja saa ${pts}. Voitit pelin.`,
  botTook: v => `Botti otti kuution vastaan. Arvo on nyt ${v}. Heitä.`,
  youTook: v => `Otit kuution vastaan. Arvo on nyt ${v}. Botti miettii.`,
  logDouble: v => `Tuplaa ${v}`, logTake: 'Ottaa', logDrop: 'Luopuu', logResign: 'Luovuttaa',
  chooseDest: ' Valitse kohde.', confirm: ' Vahvista siirto napilla Valmis.',
  resign: 'Luovuta', newMatch: 'Uusi ottelu', nextGame: 'Seuraava peli',
  double: v => `Tuplaa (${v})`, crawfordCube: 'Crawford-peli, ei kuutiota',
  levels: ['vakava virhe', 'virhe', 'epätarkka'],
  num: x => x.toFixed(3).replace('.', ','),
  noteBad: (p, lv, x, b) => `Siirtosi ${p}: ${lv}, ${x} equityä. Verkon paras: ${b}.`,
  noteGood: (p, x) => `Siirtosi ${p}: hyvä (ero verkon parhaaseen ${x}).`,
  summaryTitle: 'Pelin analyysi',
  summaryNone: 'Analysoitavia siirtoja ei ollut.',
  summary: (n, t, m, counts) => `Analysoituja siirtoja ${n}, virheiden summa ${t} equityä, keskimäärin ${m} siirtoa kohden. ${counts}.`,
  summaryItem: (n, p, x, b) => `Siirto ${n}, ${p}: ${x}. Verkon paras: ${b}.`,
  static: {
    sub: 'Backgammon, jossa ensimmäisenä pelistä poistuva saa rangaistuspisteen. Vastustajana neuroverkko, kuution kanssa.',
    roll: 'Heitä', done: 'Valmis', undo: 'Kumoa', pass: 'Jatka', take: 'Ota vastaan', drop: 'Luovu',
    penalty: 'Rangaistuspisteet', limit: 'raja 7', you: 'Sinä', bot: 'Botti', pips: 'Pipit',
    cube: 'Kuution arvo', row: 'Rivi', moves: 'Siirrot', rules: 'Säännöt', board: 'Pelilauta',
    other: 'English',
  },
};

const en = {
  points: n => (n === 1 ? 'a penalty point' : `${n} penalty points`),
  opening: (a, b, meFirst, crawford) => `Opening roll: you ${a}, bot ${b}. `
    + (meFirst ? 'You start.' : 'The bot starts.')
    + (crawford ? ' Crawford game: no cube in this game.' : ''),
  noLegal: d => `You rolled ${d}. No legal moves.`,
  youRolled: d => `You rolled ${d}.`,
  botThinking: 'The bot is thinking.',
  botDoubles: (v, pts) => `The bot doubles to ${v}. Do you take? If you pass, you get ${pts}.`,
  botPlayed: (d, m) => `The bot rolled ${d} and played ${m}.`,
  botDanced: d => `The bot rolled ${d} and could not move.`,
  draw: rows => `${rows} rows played: the game is a draw. Nobody gets penalty points.`,
  youExited: pts => `You bore off your last checker. You get ${pts}.`,
  botExited: pts => `The bot bore off its last checker and gets ${pts}. You won the game.`,
  matchLost: (l, a, b) => ` You reached ${l} and lost the match ${a}–${b}.`,
  matchWon: (l, a, b) => ` The bot reached ${l}. You won the match ${a}–${b}.`,
  youDropped: pts => `You left the game. You get ${pts}.`,
  botDropped: pts => `The bot passed and gets ${pts}. You won the game.`,
  botTook: v => `The bot took. The cube is now ${v}. Roll.`,
  youTook: v => `You took. The cube is now ${v}. The bot is thinking.`,
  logDouble: v => `Doubles ${v}`, logTake: 'Takes', logDrop: 'Passes', logResign: 'Resigns',
  chooseDest: ' Choose a destination.', confirm: ' Confirm the move with Done.',
  resign: 'Resign', newMatch: 'New match', nextGame: 'Next game',
  double: v => `Double (${v})`, crawfordCube: 'Crawford game, no cube',
  levels: ['blunder', 'error', 'doubtful'],
  num: x => x.toFixed(3),
  noteBad: (p, lv, x, b) => `Your move ${p}: ${lv}, ${x} equity. The network's best: ${b}.`,
  noteGood: (p, x) => `Your move ${p}: good (${x} from the network's best).`,
  summaryTitle: 'Game analysis',
  summaryNone: 'There were no moves to analyse.',
  summary: (n, t, m, counts) => `Moves analysed ${n}, total error ${t} equity, ${m} per move. ${counts}.`,
  summaryItem: (n, p, x, b) => `Move ${n}, ${p}: ${x}. The network's best: ${b}.`,
  static: {
    sub: 'Backgammon where the first player to leave the game gets a penalty point. Your opponent is a neural network, with the cube.',
    roll: 'Roll', done: 'Done', undo: 'Undo', pass: 'Continue', take: 'Take', drop: 'Pass',
    penalty: 'Penalty points', limit: 'limit 7', you: 'You', bot: 'Bot', pips: 'Pips',
    cube: 'Cube value', row: 'Row', moves: 'Moves', rules: 'Rules', board: 'Game board',
    other: 'Suomi',
  },
};

function pick() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'fi' || q === 'en') return q;
  try { const s = localStorage.getItem('ab-kieli'); if (s === 'fi' || s === 'en') return s; } catch { /* ei tallennusta */ }
  return (navigator.language ?? '').toLowerCase().startsWith('fi') ? 'fi' : 'en';
}

export let LANG = pick();
export let T = LANG === 'fi' ? fi : en;

// Vaihtaa kielen lennossa, jotta kesken oleva peli säilyy. Jo näytetty tilaviesti jää vanhalle
// kielelle seuraavaan tapahtumaan asti.
export function switchLang() {
  LANG = LANG === 'fi' ? 'en' : 'fi';
  T = LANG === 'fi' ? fi : en;
  try { localStorage.setItem('ab-kieli', LANG); } catch { /* ei tallennusta */ }
  applyStatic();
}

// Staattiset tekstit: elementit, joilla on data-t="avain", ja säännöt data-lang-lohkoina.
export function applyStatic() {
  document.documentElement.lang = LANG;
  for (const e of document.querySelectorAll('[data-t]')) e.textContent = T.static[e.dataset.t];
  for (const e of document.querySelectorAll('[data-lang]')) e.hidden = e.dataset.lang !== LANG;
  document.getElementById('board').setAttribute('aria-label', T.static.board);
}
