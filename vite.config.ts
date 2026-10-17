import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages（プロジェクトページ）は /<リポジトリ名>/ 配下で配信されるため、
// アセットのパスとPWAマニフェストをそのサブパスに合わせる。
const BASE_PATH = '/skydive-spotter/'

// https://vite.dev/config/
export default defineConfig({
  base: BASE_PATH,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Skydive Spotter',
        short_name: 'Skydive Spotter',
        description: 'open-meteoの上空風予報からExit地点（グリーンライト点）を計算するスカイダイビング用PWA',
        lang: 'ja',
        start_url: BASE_PATH,
        scope: BASE_PATH,
        display: 'standalone',
        background_color: '#F3F4F1',
        theme_color: '#15191E',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 地理院タイルは「表示した範囲」だけをリクエスト時にキャッシュする（一括ダウンロードはしない）
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cyberjapandata\.gsi\.go\.jp\/xyz\/(std|seamlessphoto)\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gsi-tiles',
              expiration: { maxEntries: 2000, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // open-meteo: 同じ地点・時刻の問い合わせは15分キャッシュする（spec.md 4.1）
            urlPattern: /^https:\/\/api\.open-meteo\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'open-meteo-api',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 15 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
