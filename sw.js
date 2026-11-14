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
  if (r.headers.has('range') || r.destination === 'video' || /\.(mp4|webm)$/i.test(u.pathname)) return;   // الفيديو: المتصفح يتعامل معه مباشرة (لا كاش ولا Range)

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

  e.respondWith((async () => {
    try {
      const res = await fetch(r);
      if (res.ok) { const copy = res.clone(); (await caches.open(CACHE)).put(r, copy); }
      return res;
    } catch (err) {
      return (await caches.match(r)) || Response.error();
    }
  })());
});

// ===== عدّاد الأيقونة (يُحفظ في الكاش لأن الـ SW قد يُغلق في أي وقت) =====
async function getBadge() { try { const r = await (await caches.open(META)).match('badge'); return r ? (parseInt(await r.text(), 10) || 0) : 0; } catch (e) { return 0; } }
async function setBadge(n) {
  n = Math.max(0, n | 0);
  try { await (await caches.open(META)).put('badge', new Response(String(n))); } catch (e) {}
  try { if (self.navigator && self.navigator.setAppBadge) { if (n > 0) await self.navigator.setAppBadge(n); else await self.navigator.clearAppBadge(); } } catch (e) {}
}

// الرقم = عدد الإشعارات الظاهرة فعلاً (يزيد مع كل إشعار، وينقص لما المستخدم يمسح)
async function syncBadge() {
  try { const l = await self.registration.getNotifications(); await setBadge(l.length); }
  catch (e) { await setBadge((await getBadge()) + 1); }
}

self.addEventListener('notificationclose', e => { e.waitUntil(syncBadge()); });

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { b: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.some(c => c.visibilityState === 'visible')) {      // التطبيق مفتوح أمامه: حدّث الجرس فقط
      wins.forEach(c => c.postMessage({ type: 'nload' }));
      return;
    }
    await self.registration.showNotification(d.t || 'قوت', {
      body: d.b || '', icon: 'apple-touch-icon.png', tag: 'qout-' + Date.now(), dir: 'auto', data: { url: self.registration.scope }
    });
    await syncBadge();
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    await syncBadge();
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of wins) { if ('focus' in c) { await c.focus(); c.postMessage({ type: 'nopen' }); return; } }
    if (self.clients.openWindow) await self.clients.openWindow((e.notification.data && e.notification.data.url) || self.registration.scope);
  })());
});

self.addEventListener('message', e => {
  const m = e.data || {};
  if (m.type === 'badge') e.waitUntil(setBadge(m.n));
  if (m.type === 'clear') e.waitUntil((async () => {       // المستخدم شاف الإشعارات جوه التطبيق: امسحها من بره
    try { for (const n of await self.registration.getNotifications()) n.close(); } catch (err) {}
    await setBadge(0);
  })());
});
