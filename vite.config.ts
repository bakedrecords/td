import { defineConfig } from 'vite';

// base: './' にしておくと GitHub Pages のサブパスでもローカルでも
// 相対パスでアセットが解決でき、そのまま動きます。
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
  server: {
    host: true, // `npm run dev` を同じ Wi-Fi のスマホからも開けるように
  },
});
