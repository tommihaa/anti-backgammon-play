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
  confirm: ' Vahvista siirto napilla Valmis.',
  card: (name, p, turn) => `${name}${turn ? ' (vuoro)' : ''}: ${p} ${p === 1 ? 'rangaistuspiste' : 'rangaistuspistettä'}`,
  styles: { x22: 'Monte Carlo X-22', mcVariant: 'Monte Carlo variant', deco: 'Deco', maple: 'Vaahtera',
    walnut: 'Pähkinä', oakLeather: 'Tammi ja nahka', olive: 'Oliivi' },
  home: { right: 'oikealla', left: 'vasemmalla' },
  resignConfirm: pts => `Luovutatko pelin? Saat ${pts}.`,
  xgidBad: 'Tunniste ei ole kelvollinen XGID.', xgidLoaded: 'Asema asetettu tunnisteesta.',
  xgidCopied: 'Kopioitu leikepöydälle.', xgidSelect: 'Kopioi valittu teksti näppäimillä Ctrl+C.',
  logImport: 'Asema XGID:stä',
  importBad: 'Tekstistä ei löytynyt ottelua. Tuonti lukee DailyGammonin viennin (.mat) ja .sgf-tiedoston.',
  importLoaded: (a, b, n) => `Tuotu ottelu ${a} ja ${b}, ${n} ${n === 1 ? 'peli' : 'peliä'}.`,
  reviewBusy: 'Odota, että botti on siirtänyt. Tuo sitten uudelleen.',
  reviewGameOption: (k, a, b, marked) => `Peli ${k} (${a}-${b})${marked ? ' ✱' : ''}`,
  reviewStep: (i, n) => `Asema ${i} / ${n}.`,
  reviewNext: (name, act) => `Seuraavaksi ${name}: ${act}.`,
  reviewEnd: 'Peli päättyi.',
  reviewWins: n => `Wins ${n} (tiedoston merkintä)`,
  reviewDance: 'ei siirtoa',
  reviewStopped: 'Peli alkaa muusta kuin tavallisesta alkuasemasta (nackgammon tai double repeat), joten sitä ei voi toistaa tästä eteenpäin.',
  reviewMarkText: t => `Merkintä: ${t}`,
  reviewNoMark: 'Merkittyjä asemia ei ole enempää.',
  reviewPlaying: 'Jatkat tuodun ottelun asemasta bottia vastaan.',
  logReview: 'Asema tuodusta ottelusta',
  soundsOn: 'Pelin äänet',
  sounds: { dice: 'Nopat', checker: 'Nappulat', cube: 'Tuplauskuutio', miss: 'Napautus pisteeseen, jolta ei voi siirtää', gong: 'Gongi seuraavalle pelille' },
  toggles: {
    analysis: 'Näytä analyysi siirron jälkeen', forced: 'Aseta pakkosiirrot puolestani', arrows: 'Näytä nuolet omasta siirrosta',
    botArrows: 'Näytä nuolet botin siirrosta', press: 'Näytä painettu piste',
    diceSubmit: 'Vahvista siirto noppia klikkaamalla', diceSwap: 'Vaihda noppien järjestys klikkaamalla',
    diceRoll: 'Heitä klikkaamalla botin noppia', nextOnDice: 'Seuraava peli noppien paikalle',
  },
  newMatch: 'Uusi ottelu', nextGame: 'Seuraava peli',
  double: v => `Tuplaa (${v})`, crawfordCube: 'Crawford-peli, ei kuutiota',
  penScore: (p, l) => (l === null ? String(p) : `${p} / ${l}`),
  limitOption: l => (l === null ? 'Rahapeli' : l === 1 ? '1 piste' : `${l} pistettä`),
  limitConfirm: 'Uusi pituus aloittaa uuden ottelun, ja nykyinen tilanne katoaa. Jatketaanko?',
  levels: ['vakava virhe', 'virhe', 'epätarkka'],
  num: x => x.toFixed(3).replace('.', ','),
  noteBad: (p, lv, x) => `Siirtosi ${p}: ${lv} (ero verkon parhaaseen ${x}).`,
  noteGood: (p, x) => `Siirtosi ${p}: hyvä (ero verkon parhaaseen ${x}).`,
  noteSame: p => `Siirtosi ${p}: sama kuin verkon paras.`,
  noteWait: p => `Siirtosi ${p}: analysoidaan.`,
  topTitle: n => `Verkon ${n === 3 ? 'kolme' : 'kaksi'} parasta:`,
  plyLabel: 'Botin syvyys',
  plyOption: v => (v === 0 ? '0-ply (nopea)' : v === 1 ? '1-ply' : '2-ply (hidas)'),
  summaryTitle: 'Pelin analyysi',
  summaryNone: 'Analysoitavia siirtoja ei ollut.',
  decisionsTitle: 'Siirrot ja kuutiopäätökset',
  decisionsHelp: 'Voitto on siirtäjän todennäköisyys välttää ulos joutuminen ensin ilman kuutiota, verkon arviona pelin syvyydellä. Verkon valinta on sen paras siirto tai kuutiopäätös.',
  decisionsHead: ['#', 'Pelaaja', 'Päätös', 'Voitto', 'Verkon valinta', 'Ero'],
  decisionsNone: 'Siirtokohtainen analyysi tallentuu peleistä, jotka on pelattu tämän päivityksen jälkeen.',
  decisionsWait: (k, n) => `Analysoitu ${k} / ${n}.`,
  noDouble: 'Ei tuplausta', forcedMove: 'pakkosiirto', sameBest: 'sama', cubeDiff: 'eri',
  pct: x => `${(100 * x).toFixed(1).replace('.', ',')} %`,
  playedOption: (d, l) => `${d.toLocaleString('fi-FI', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}, ${l === null ? 'rahapeli' : `ottelu ${l}`}`,
  summary: (n, t, m, counts) => `Analysoituja siirtoja ${n}, virheiden summa ${t} equityä, keskimäärin ${m} siirtoa kohden. ${counts}.`,
  summaryItem: (n, p, x) => `Siirto ${n}, ${p}: ${x}. Verkon parhaat:`,
  static: {
    sub: 'Backgammon, jossa ensimmäisenä pelistä poistuva saa rangaistuspisteen. Vastustajana neuroverkko, kuution kanssa.',
    roll: 'Heitä', done: 'Valmis', undo: 'Kumoa', pass: 'Jatka', take: 'Ota vastaan', drop: 'Luovu',
    penalty: 'Rangaistuspisteet', match: 'Ottelu', you: 'Sinä', bot: 'Botti',
    cube: 'Kuution arvo', row: 'Rivi', moves: 'Siirrot', playedTitle: 'Pelatut pelit', rules: 'Säännöt', board: 'Pelilauta',
    playing: 'Pelaaminen', resign: 'Luovuta', soundsTitle: 'Äänet',
    position: 'Asema (XGID)', xgidCopy: 'Kopioi', xgidSet: 'Aseta',
    importTitle: 'Tuo ottelu', importFileLabel: 'Tiedosto (.mat tai .sgf)', importPasteLabel: 'Tai liitä teksti',
    importGo: 'Tuo', reviewGameLabel: 'Peli', reviewYouLabel: 'Sinä', reviewMark: 'Seuraava merkki',
    reviewPlay: 'Jatka tästä', reviewClose: 'Sulje',
    look: 'Ulkoasu', styleLabel: 'Lauta', homeLabel: 'Kotialue', portraitLabel: 'Pystylauta kapealla ruudulla',
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
  confirm: ' Confirm the move with Done.',
  card: (name, p, turn) => `${name}${turn ? ' (to move)' : ''}: ${p} ${p === 1 ? 'penalty point' : 'penalty points'}`,
  styles: { x22: 'Monte Carlo X-22', mcVariant: 'Monte Carlo variant', deco: 'Deco', maple: 'Maple',
    walnut: 'Walnut', oakLeather: 'Oak leather', olive: 'Olive' },
  home: { right: 'right', left: 'left' },
  resignConfirm: pts => `Resign this game? You get ${pts}.`,
  xgidBad: 'This is not a valid XGID.', xgidLoaded: 'Position set from the ID.',
  xgidCopied: 'Copied to the clipboard.', xgidSelect: 'Copy the selected text with Ctrl+C.',
  logImport: 'Position from XGID',
  importBad: 'No match found in the text. Import reads a DailyGammon export (.mat) and an .sgf file.',
  importLoaded: (a, b, n) => `Imported match ${a} and ${b}, ${n} ${n === 1 ? 'game' : 'games'}.`,
  reviewBusy: 'Wait for the bot to move, then import.',
  reviewGameOption: (k, a, b, marked) => `Game ${k} (${a}-${b})${marked ? ' ✱' : ''}`,
  reviewStep: (i, n) => `Position ${i} / ${n}.`,
  reviewNext: (name, act) => `Next ${name}: ${act}.`,
  reviewEnd: 'The game is over.',
  reviewWins: n => `Wins ${n} (as in the file)`,
  reviewDance: 'no move',
  reviewStopped: 'This game starts from a non-standard position (nackgammon or double repeat), so it cannot be replayed from here on.',
  reviewMarkText: t => `Note: ${t}`,
  reviewNoMark: 'No more marked positions.',
  reviewPlaying: 'You continue from the imported position against the bot.',
  logReview: 'Position from imported match',
  soundsOn: 'Game sounds',
  sounds: { dice: 'Dice', checker: 'Checkers', cube: 'Doubling cube', miss: "Tap on a point you can't move from", gong: 'Gong for the next game' },
  toggles: {
    analysis: 'Show the analysis after my move', forced: 'Place forced checkers for me', arrows: 'Show arrows for my move',
    botArrows: "Show arrows for the bot's move", press: "Show which point I'm pressing",
    diceSubmit: 'Submit the move by tapping the dice', diceSwap: 'Swap the dice by tapping them',
    diceRoll: "Roll by tapping the bot's dice", nextOnDice: 'Next game where the dice were',
  },
  newMatch: 'New match', nextGame: 'Next game',
  double: v => `Double (${v})`, crawfordCube: 'Crawford game, no cube',
  penScore: (p, l) => (l === null ? String(p) : `${p} / ${l}`),
  limitOption: l => (l === null ? 'Money game' : l === 1 ? '1 point' : `${l} points`),
  limitConfirm: 'A new length starts a new match, and the current score is lost. Continue?',
  levels: ['blunder', 'error', 'doubtful'],
  num: x => x.toFixed(3),
  noteBad: (p, lv, x) => `Your move ${p}: ${lv} (${x} from the network's best).`,
  noteGood: (p, x) => `Your move ${p}: good (${x} from the network's best).`,
  noteSame: p => `Your move ${p}: same as the network's best.`,
  noteWait: p => `Your move ${p}: analysing.`,
  topTitle: n => `The network's top ${n === 3 ? 'three' : 'two'}:`,
  plyLabel: 'Bot depth',
  plyOption: v => (v === 0 ? '0-ply (fast)' : v === 1 ? '1-ply' : '2-ply (slow)'),
  summaryTitle: 'Game analysis',
  summaryNone: 'There were no moves to analyse.',
  decisionsTitle: 'Moves and cube decisions',
  decisionsHelp: "Win is the mover's chance of not being the first to leave, without the cube, as the network evaluates it at the game's depth. Network shows its best move or cube decision.",
  decisionsHead: ['#', 'Player', 'Decision', 'Win', 'Network', 'Diff'],
  decisionsNone: 'The move-by-move analysis is stored for games played after this update.',
  decisionsWait: (k, n) => `Analysed ${k} / ${n}.`,
  noDouble: 'No double', forcedMove: 'forced', sameBest: 'same', cubeDiff: 'differs',
  pct: x => `${(100 * x).toFixed(1)}%`,
  playedOption: (d, l) => `${d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}, ${l === null ? 'money game' : `match to ${l}`}`,
  summary: (n, t, m, counts) => `Moves analysed ${n}, total error ${t} equity, ${m} per move. ${counts}.`,
  summaryItem: (n, p, x) => `Move ${n}, ${p}: ${x}. The network's best:`,
  static: {
    sub: 'Backgammon where the first player to leave the game gets a penalty point. Your opponent is a neural network, with the cube.',
    roll: 'Roll', done: 'Done', undo: 'Undo', pass: 'Continue', take: 'Take', drop: 'Pass',
    penalty: 'Penalty points', match: 'Match', you: 'You', bot: 'Bot',
    cube: 'Cube value', row: 'Row', moves: 'Moves', playedTitle: 'Played games', rules: 'Rules', board: 'Game board',
    playing: 'Playing', resign: 'Resign', soundsTitle: 'Sounds',
    position: 'Position (XGID)', xgidCopy: 'Copy', xgidSet: 'Set',
    importTitle: 'Import match', importFileLabel: 'File (.mat or .sgf)', importPasteLabel: 'Or paste the text',
    importGo: 'Import', reviewGameLabel: 'Game', reviewYouLabel: 'You', reviewMark: 'Next mark',
    reviewPlay: 'Play from here', reviewClose: 'Close',
    look: 'Appearance', styleLabel: 'Board', homeLabel: 'Home board', portraitLabel: 'Portrait board on a narrow screen',
    other: 'Suomi',
  },
};

function pick() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'fi' || q === 'en') return q;
  try { const s = localStorage.getItem('ab-kieli'); if (s === 'fi' || s === 'en') return s; } catch { /* ei tallennusta */ }
  return (navigator.language ?? '').toLowerCase().startsWith('fi') ? 'fi' : 'en';
}

// Kielinapin lippu on sen kielen, johon nappi vaihtaa. Liput ovat SVG:nä, koska Windows ei
// piirrä lippuemojeja vaan näyttää kirjaimet.
const FLAGS = {
  fi: '<svg viewBox="0 0 18 11" width="22" height="13" aria-hidden="true"><rect width="18" height="11" fill="#fff"/><rect x="5" width="3" height="11" fill="#002f6c"/><rect y="4" width="18" height="3" fill="#002f6c"/></svg>',
  en: '<svg viewBox="0 0 60 30" width="26" height="13" aria-hidden="true"><clipPath id="uk-t"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath><rect width="60" height="30" fill="#012169"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/><path d="M0,0 L60,30 M60,0 L0,30" clip-path="url(#uk-t)" stroke="#c8102e" stroke-width="4"/><path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10"/><path d="M30,0 v30 M0,15 h60" stroke="#c8102e" stroke-width="6"/></svg>',
};

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
  document.getElementById('flag').innerHTML = FLAGS[LANG === 'fi' ? 'en' : 'fi'];
}
