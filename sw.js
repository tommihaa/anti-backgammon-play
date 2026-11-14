// Offline-välimuisti aloitusnäytölle asennettua lautaa varten (malli Jaon public/sw.js).
// Kaikki haetaan ensin verkosta, jotta uusi julkaisu näkyy heti, ja välimuisti on vain
// offline-varasto. Tiedostonimissä ei ole sisältöhashia, joten cache-first-haaraa ei ole.
// Esitallennus: tyokalut/vie-sovellus.mjs kirjoittaa julkiseen repoon precache.json-listan
// (sivu, moduulit, verkko, äänet, ikonit). Lista haetaan asennuksessa ja jokaisella verkon
// kanssa tehdyllä avauksella, koska tämä tiedosto ei muutu julkaisusta toiseen eikä selain
// siksi asenna SW:tä uudelleen. Listalta pudonneet (esim. vaihtunut verkko) poistetaan.
// Yksityisessä repossa listaa ei ole: silloin talteen menee vain se, mitä sivu on hakenut.
// Polut ovat suhteellisia, koska julkinen lauta on GitHub Pagesin alipolussa.
const CACHE = 'anti-backgammon-v1';
const MATCH = { ignoreVary: true, ignoreSearch: true };
const scoped = f => new URL(f, self.registration.scope).href;

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(precache());
});

self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => clients.claim())
));

// no-cache: selaimen HTTP-välimuisti tarkistaa tuoreuden palvelimelta (304 on halpa), jottei
// heuristisesti välimuistiin jäänyt vanha moduuli jää käyttöön julkaisun jälkeen.
function fetchAndCache(request) {
  return fetch(request, { cache: 'no-cache' }).then(resp => {
    if (resp.ok) {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(request, copy));
    }
    return resp;
  });
}

// Puuttuvat tallennetaan yksi kerrallaan, jotta yksi epäonnistunut ei kaada muita. Sivu
// ('./') haetaan aina, koska ensimmäinen avaus ei kulje SW:n kautta.
let running = null;
function precache() {
  if (running) return running;
  running = (async () => {
    const cache = await caches.open(CACHE);
    let files = null;
    try {
      const resp = await fetch(scoped('precache.json'), { cache: 'no-store' });
      if (resp.ok) files = await resp.json();
    } catch { /* ei verkkoa */ }
    const want = ['./', ...(files || [])].map(scoped);
    const have = new Set((await cache.keys()).map(r => r.url));
    for (const url of want) {
      if (have.has(url) && url !== scoped('./')) continue;
      try {
        const r = await fetch(url, { cache: 'no-cache' });
        if (r.ok) await cache.put(url, r);
      } catch { /* verkko katkesi kesken: loput seuraavalla avauksella */ }
    }
    if (!files) return;
    const keep = new Set(want);
    for (const req of await cache.keys()) if (!keep.has(req.url)) await cache.delete(req);
  })().catch(() => {}).finally(() => { running = null; });
  return running;
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetchAndCache(e.request)
        .then(resp => { if (resp.ok) e.waitUntil(precache()); return resp; })
        .catch(() => caches.match(e.request, MATCH).then(hit => hit || caches.match(scoped('./'), MATCH)))
    );
    return;
  }

  e.respondWith(
    fetchAndCache(e.request).catch(() => caches.match(e.request, MATCH)
      .then(hit => hit || Promise.reject(new Error('offline'))))
  );
});
