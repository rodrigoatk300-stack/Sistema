/* ============================================================
   SISTEMA DE DESPERTAR — service worker
   Faz duas coisas:
     1) recebe as notificacoes do Sistema (push) mesmo com o app fechado;
     2) guarda uma copia da pagina para ela abrir sem internet.
   Ao publicar uma versao nova do jogo, troque o numero do CACHE
   abaixo (v1 -> v2). Sem isso alguns celulares podem demorar a ver.
   ============================================================ */
const CACHE = "despertar-v3";
const ESSENCIAL = ["./", "./index.html", "./manifest.json", "./icone-192.png", "./icone-512.png"];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ESSENCIAL)).catch(() => {}));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Rede primeiro: a versao publicada no GitHub sempre ganha do cache.
   O cache so entra em acao quando o celular esta sem internet. */
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // Supabase, fontes: deixa passar
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
  );
});

/* ---------------- notificacoes ---------------- */
const PADRAO = {
  title: "SISTEMA DE DESPERTAR",
  body: "O Sistema chama por voce.",
  tag: "sistema"
};

self.addEventListener("push", e => {
  let d = PADRAO;
  try { if (e.data) d = Object.assign({}, PADRAO, e.data.json()); } catch (err) { }
  e.waitUntil(self.registration.showNotification(d.title, {
    body: d.body,
    tag: d.tag,
    renotify: true,
    icon: "./icone-192.png",
    badge: "./icone-192.png",
    vibrate: [90, 60, 90, 60, 180],
    requireInteraction: d.tag === "abandono",
    // aviso de mensagem abre direto na aba do chat
    data: { url: d.url || (d.tag === "chat" ? "./?aba=chat" : "./") }
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const alvo = new URL((e.notification.data && e.notification.data.url) || "./", self.location.href).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(lista => {
      for (const c of lista) {
        if (c.url.startsWith(self.location.origin) && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(alvo);
    })
  );
});
