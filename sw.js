const CACHE_VERSION = '2.2.19';
const CACHE_NAME = `lezgimez-pwa-v${CACHE_VERSION}`;

const ALPHABET_AUDIO_FILES = [
  'а', 'б', 'в', 'г', 'гъ', 'гь', 'д', 'е', 'ж', 'з', 'и', 'й',
  'к', 'к1', 'къ', 'кь', 'л', 'м', 'н', 'п', 'п1', 'р', 'с', 'т',
  'т1', 'у', 'уь', 'ф', 'х', 'хъ', 'хь', 'ц', 'ц1', 'ч', 'ч1',
  'ш', 'э', 'ю', 'я'
];

const CRITICAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './output.css',
  './js/utils.js',
  './js/state.js',
  './js/telegram.js',
  './js/srs.js',
  './js/ui.js',
  './js/course.js',
  './js/app.js',
  './words.json',
  './grammar.json',
  './course.json',
  './notifications.json',
  './robots.txt',
  './sitemap.xml',
  './favicon.ico'
];


const NON_CRITICAL_ASSETS = [
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './fa/all.min.css',
  './fa/webfonts/fa-solid-900.woff2',
  './fa/webfonts/fa-regular-400.woff2',
  './fa/webfonts/fa-brands-400.woff2'
];

const AUDIO_ASSETS = ALPHABET_AUDIO_FILES.map(letter => `./audio/alphabet/${letter}.mp3`);

async function cacheAssets(cache, assets) {
  await Promise.allSettled(
    assets.map(asset => cache.add(asset))
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CRITICAL_ASSETS);
    await cacheAssets(cache, [...NON_CRITICAL_ASSETS, ...AUDIO_ASSETS]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

// === PUSH / REMINDER NOTIFICATIONS ===
const REMINDER_MESSAGES = [
  'Пора повторить слова!',
  'У вас есть слова для повторения сегодня.',
  'Лезгинский язык ждёт вас! Проведите 5 минут в приложении.',
  'Не забывайте тренировать память — загляните в словарь.',
  'Прогресс сам себя не сделает. Пора учиться!'
];

async function withConfigStore(mode, callback) {
  return new Promise((resolve) => {
    const request = indexedDB.open('lezgi_db', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('config')) {
        request.result.createObjectStore('config');
      }
    };
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result;
      try {
        const tx = db.transaction('config', mode);
        const store = tx.objectStore('config');
        callback(store, resolve);
        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch (e) {
        db.close();
        resolve(null);
      }
    };
  });
}

async function getConfig(key) {
  return withConfigStore('readonly', (store, resolve) => {
    const get = store.get(key);
    get.onsuccess = () => resolve(get.result);
    get.onerror = () => resolve(null);
  });
}

async function setConfig(key, value) {
  return withConfigStore('readwrite', (store, resolve) => {
    const put = store.put(value, key);
    put.onsuccess = () => resolve(true);
    put.onerror = () => resolve(false);
  });
}

async function checkAndNotify() {
  const enabled = await getConfig('notif_enabled');
  if (enabled !== '1') return;

  const now = Date.now();
  const lastTime = await getConfig('last_notif_time') || 0;
  const intervalMs = 3 * 60 * 60 * 1000; // hardcoded to 3 hours

  if (now - lastTime >= intervalMs) {
    let body = 'Пора повторить слова! Лезгинский язык ждёт вас.';
    try {
      const cachedResponse = await caches.match('./notifications.json');
      if (cachedResponse) {
        const messages = await cachedResponse.json();
        if (Array.isArray(messages) && messages.length > 0) {
          body = messages[Math.floor(Math.random() * messages.length)];
        }
      } else {
        const response = await fetch('./notifications.json');
        const messages = await response.json();
        if (Array.isArray(messages) && messages.length > 0) {
          body = messages[Math.floor(Math.random() * messages.length)];
        }
      }
    } catch (e) {
      if (Array.isArray(REMINDER_MESSAGES) && REMINDER_MESSAGES.length > 0) {
        body = REMINDER_MESSAGES[Math.floor(Math.random() * REMINDER_MESSAGES.length)];
      }
    }

    await self.registration.showNotification('LezgiMez', {
      body,
      icon: './icons/icon.svg',
      badge: './icons/icon.svg',
      tag: 'daily-reminder',
      data: { url: './index.html#vocabulary' }
    });
    await setConfig('last_notif_time', now);
  }
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'daily-reminder') event.waitUntil(checkAndNotify());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || './index.html#vocabulary';
  const urlToOpen = new URL(targetUrl, self.location.origin).href;

  event.waitUntil((async () => {
    const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windowClients) {
      if (client.url === urlToOpen && 'focus' in client) return client.focus();
    }
    if (clients.openWindow) return clients.openWindow(urlToOpen);
    return undefined;
  })());
});

async function putSuccessfulResponse(request, response) {
  if (!response || response.status !== 200 || request.method !== 'GET') return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

function offlineResponse(message = 'Offline and not cached', status = 504) {
  return new Response(message, {
    status,
    statusText: status === 503 ? 'Offline' : 'Offline and not cached',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

async function networkFirst(request, fallbackRequest) {
  try {
    const response = await fetch(request);
    await putSuccessfulResponse(request, response);
    return response;
  } catch (e) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (fallbackRequest) {
      const fallback = await caches.match(fallbackRequest, { ignoreSearch: true });
      if (fallback) return fallback;
    }
    return offlineResponse();
  }
}

async function networkFirstNoStore(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    await putSuccessfulResponse(request, response);
    return response;
  } catch (e) {
    const cached = await caches.match(request, { ignoreSearch: true });
    return cached || offlineResponse('', 504);
  }
}
async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const response = await fetch(request);
    await putSuccessfulResponse(request, response);
    return response;
  } catch (e) {
    return offlineResponse();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // Never cache serverless/report endpoints. Let the network/backend handle them.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/functions/')) return;

  if (
    url.pathname.endsWith('.mp3') ||
    url.pathname.endsWith('/words.json') ||
    url.pathname.endsWith('/grammar.json') ||
    url.pathname.endsWith('/notifications.json')
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (
    request.mode === 'navigate' ||
    url.pathname.endsWith('/index.html')
  ) {
    event.respondWith(networkFirst(request, './index.html'));
    return;
  }

  event.respondWith(networkFirst(request, request.destination === 'document' ? './index.html' : undefined));
});
