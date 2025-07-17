import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  root: 'demos',
  build: {
    outDir: '../docs',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'demos/index.html',
        playground: 'demos/playground.html',
        'playground-root': 'demos/playground.html'
      }
    }
  },
  css: {
    preprocessorOptions: {
      css: {
        additionalData: `@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@700&display=swap');`
      }
    }
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: '../dist/index.browser.js', dest: '.' },
        { src: '../demos/*', dest: 'demos' },
        { src: 'style.css', dest: 'demos' },
        { src: '../ontologies/*', dest: 'ontologies' },
        // Copy playground.html to root as playground.html
        { src: 'playground.html', dest: '.' }
      ]
    })
  ]
});
