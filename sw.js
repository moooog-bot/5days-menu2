// サービスワーカーの簡易記述（アプリ化認識に必須のイベント処理）
self.addEventListener('install', (e) => {
  console.log('Service Worker: Installed');
});

self.addEventListener('activate', (e) => {
  console.log('Service Worker: Activated');
});

self.addEventListener('fetch', (e) => {
  // オフライン対応などを拡張する場合はここに記述しますが、空でもアプリ化は可能です
});