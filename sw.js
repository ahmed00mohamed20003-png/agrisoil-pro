// sw.js — قوت: "الشبكة أولاً" + استقبال تنبيهات الجهاز (Web Push) وعدّاد الأيقونة.
// عند كل تعديل جوهري غيّر رقم CACHE ليُمسح الكاش القديم.
const CACHE = 'qout-shell-v3';
const META = 'qout-meta';

self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE && k !== META) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;       // Firebase / الطقس / الخطوط: لا نتدخل
  if (u.searchParams.has('_v')) return;           // فحص التحديث: دائماً من الشبكة مباشرة

  if (r.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(r.url, { cache: 'no-store' });
        if (res.ok) { const copy = res.clone(); (await caches.open(CACHE)).put(self.registration.scope, copy); }
        return res;
      } catch (err) {
        const c = await caches.open(CACHE);
        return (await c.match(self.registration.scope)) || Response.error();
      }
    })());
    return;
  }
