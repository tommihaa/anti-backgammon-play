// Laudan ja ympäristön värit DG Androidin laudasta (DGAndroid/app/.../ui/DgBoard.kt ja BoardLook.kt,
// docs/ASETUKSET.md luku 4). Lauta ei vaihdu tumman tilan mukana, paitsi Deco, jolla on vaalea
// lauta. Ympäristö (paneeli, tausta, napit) seuraa tummassa tilassa lautaa ja vaaleassa teemaa:
// Deco norsunluu, puulaudat vaalea puu, muut lämmin valkoinen.

const outline = '#17120F';

// Mittasuhteet nappulan halkaisijaan sidottuina, DgBoard.kt.
export const CHECKER_PER_COLUMN = 25 / 35;
export const TRAY_PER_COLUMN = 44 / 35;
export const DICE_PER_CHECKER = 25 / 23;
export const CUBE_PER_CHECKER = 29 / 23;
export const CHECKERS_APART = 5;
export const BAND_PER_CHECKER = 2;
export const CORNER_PER_SIDE = 1 / 6;
// Pelattu noppa himmenee eikä katoa (BoardScreen.kt SPENT_DIE_DIM).
export const SPENT_DIE_DIM = 0.65;

const x22 = {
  felt: '#17120F', frame: '#6E4C33', tray: '#4E3524', trayOutline: '#3A2718', trayColumn: '#17120F',
  wedgeEven: '#E9973F', wedgeOdd: '#4E7B33',
  self: { fill: '#F0EBC0', on: '#17120F' }, opp: { fill: '#C7333D', on: '#F0E7D6' },
};

const mcVariant = {
  felt: '#3D7A3F', frame: '#5A3D27', tray: '#352418', trayOutline: '#241810', trayColumn: '#44301E',
  wedgeEven: '#E07338', wedgeOdd: '#EDE5D0',
  self: { fill: '#F3F0E8', on: '#17120F' }, opp: { fill: '#1C1B1B', on: '#F0E7D6' },
};

const deco = {
  felt: '#1B3F3A', frame: '#3B2416', tray: '#2A190F', trayOutline: '#120B06', trayColumn: '#2A190F',
  wedgeEven: '#C9A14A', wedgeOdd: '#141414',
  self: { fill: '#F1E6CC', on: '#17120F', ring: '#D4AF37', inlay: '#141414' },
  opp: { fill: '#141414', on: '#E8D9B0', ring: '#D4AF37' },
};

const decoLight = {
  felt: '#E7DCC2', frame: '#8A6440', tray: '#6E4D30', trayOutline: '#3B2416', trayColumn: '#6E4D30',
  wedgeEven: '#C9A14A', wedgeOdd: '#1B1A17',
  self: { fill: '#FFFBF2', on: '#2A241A', ring: '#9C7A2A', inlay: '#2A241A' },
  opp: { fill: '#1B1A17', on: '#E9C766', ring: '#9C7A2A' },
};

// Puulaudat (DgBoard.Wood). Syyn värit ovat Androidin ARGB-arvot rgba-muodossa.
const wood = (felt, frame, trayColumn, tray, trayOutline, wedgeEven, wedgeOdd, self, onSelf, oppRing, feltGrain, frameGrain) => ({
  felt, frame, tray, trayOutline, trayColumn, wedgeEven, wedgeOdd,
  self: { fill: self, on: onSelf }, opp: { fill: onSelf, on: self, ring: oppRing },
  feltGrain, frameGrain, wood: true,
});
const maple = wood('#E6CB98', '#5A3920', '#3F2816', '#2F1E10', '#1E130A', '#6B4424', '#C49A5E',
  '#F3E6CF', '#2B1C14', '#D9BF8C', 'rgba(58,36,16,0.18)', 'rgba(0,0,0,0.25)');
const walnut = wood('#6A4529', '#3B2416', '#2E1C11', '#24160D', '#120B06', '#E4CC9C', '#221710',
  '#EFE2C8', '#1A120D', '#C9A870', 'rgba(0,0,0,0.22)', 'rgba(0,0,0,0.25)');
const oakLeather = wood('#6B4830', '#A5743C', '#4E361C', '#3E2A15', '#231709', '#E8D8BA', '#1E1916',
  '#F1E7D3', '#1B1714', '#C8A878', null, 'rgba(0,0,0,0.22)');
const olive = wood('#D8C295', '#7D6334', '#4A3A1C', '#3A2D15', '#22190A', '#2F3B28', '#86382A',
  '#F2E8D2', '#231A12', '#D8C295', 'rgba(58,42,16,0.18)', 'rgba(0,0,0,0.25)');

// Tyylit valintajärjestyksessä. Ensimmäinen on oletus.
export const STYLES = ['x22', 'mcVariant', 'deco', 'maple', 'walnut', 'oakLeather', 'olive'];
const BOARDS = { x22, mcVariant, deco, maple, walnut, oakLeather, olive };

export function boardLook(style, dark) {
  if (style === 'deco' && !dark) return decoLight;
  return BOARDS[style] ?? x22;
}

// Ympäristön värit (BoardLook.kt PanelLook). Tummassa tilassa kortit ovat X-22:n huopaa.
const darkPanel = (background, outlineColor, muted) => ({
  background, outline: outlineColor, muted, card: '#17120F', text: '#F0E7D6', secondary: '#E4D6BE',
  accent: '#E9973F', button: '#F0EBC0', onButton: '#17120F', light: false,
});
const PANEL_DARK = {
  x22: darkPanel('#1B1712', '#6E6154', '#9A8D7A'),
  mcVariant: darkPanel('#44301E', '#8C7A64', '#B5A48C'),
  deco: darkPanel('#121212', '#8C7440', '#B8A77E'),
};
const PANEL_LIGHT = {
  plain: { background: '#FBF8F4', card: '#F1EBE4', outline: '#B8AA98', text: '#1E1A16', muted: '#4C443B',
    secondary: '#4C443B', accent: '#6B5844', button: '#6B5844', onButton: '#FBF8F4', light: true },
  deco: { background: '#F6EFE0', card: '#EDE3CC', outline: '#C9A14A', text: '#2A241A', muted: '#6B5D40',
    secondary: '#6B5D40', accent: '#7A5C14', button: '#1B1A17', onButton: '#E9C766', light: true },
  wood: { background: '#F3E7D3', card: '#E9D9BE', outline: '#B79A74', text: '#2B1C14', muted: '#5A4330',
    secondary: '#5A4330', accent: '#7A4A22', button: '#5A3920', onButton: '#F3E7D3', light: true },
};

export function panelLook(style, dark) {
  const b = BOARDS[style] ?? x22;
  if (!dark) return style === 'deco' ? PANEL_LIGHT.deco : b.wood ? PANEL_LIGHT.wood : PANEL_LIGHT.plain;
  if (b.wood) return darkPanel(b.trayColumn, '#8C7A64', '#B5A48C');
  return PANEL_DARK[style] ?? PANEL_DARK.x22;
}

// Kuutio: teal ja arvon mukainen numeron väri, Decossa musta emali kultareunalla ja viistetyin
// kulmin (BoardLook.kt CubeLook).
const CUBE_VALUE = { 4: '#E9973F', 8: '#FF786E', 16: '#8FD4C6', 32: '#FF96C8', 64: '#FFFFFF' };
export function cubeLook(style) {
  if (style === 'deco') return { fill: '#0B0B0B', border: '#D4AF37', cut: true, bold: false, value: () => '#D4AF37' };
  return { fill: '#2E6B62', border: null, cut: false, bold: true, value: v => CUBE_VALUE[v] ?? '#F0EBC0' };
}

export const OUTLINE = outline;
// Numerorivit ovat kehyksellä. Pip-luku on aksentin oranssi (docs/UI.md, 16.8.2026).
export const NUMBER_INK = '#F0E7D6';
export const PIP_INK = '#E9973F';
