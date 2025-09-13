const CACHE = 'oneul-workout-routed-v1';
const ASSETS = [
  './','./index.html','./styles.css','./manifest.webmanifest',
  './js/state.js','./js/home.js','./js/calendar.js','./js/rank.js','./js/settings.js','./js/router.js',
  './views/home.html','./views/calendar.html','./views/rank.html','./views/settings.html',
  './icons/icon-192.png','./icons/icon-512.png'
];
self.addEventListener('install', e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e=>{ e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e=>{
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res=>{
      const copy = res.clone();
      if(copy.ok){ caches.open(CACHE).then(c=>c.put(e.request, copy)); }
      return res;
    }).catch(()=>cached))
  );
});
