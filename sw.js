// 나마 시바이 — 서비스 워커 (오프라인 사용)

const CACHE_NAME = 'namasivaya-v27';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './sutras-data.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './fonts/gyeonggi-regular.woff',
  './fonts/gyeonggi-bold.woff',
];

// HTML·JS·CSS는 늘 최신을 받도록 네트워크 우선으로 다룬다.
// (옛 캐시가 남아 옛 화면이 뜨는 일을 막기 위함)
const NETWORK_FIRST = ['.html', '.js', '.css', './'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

function isNetworkFirst(url) {
  // 문서 자체(끝이 / 이거나 .html), 그리고 .js·.css 파일은 네트워크 우선
  if (url.pathname.endsWith('/') ) return true;
  return /\.(html|js|css)$/.test(url.pathname);
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (isNetworkFirst(url)) {
    // 네트워크 우선: 최신을 받아 캐시에 갱신, 실패하면 캐시 사용
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        return caches.match(event.request).then(r => r || caches.match('./index.html'));
      })
    );
    return;
  }

  // 그 밖의 자료(폰트·아이콘 등)는 캐시 우선
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) return response;
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
