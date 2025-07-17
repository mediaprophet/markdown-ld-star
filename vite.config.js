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
        playground: 'demos/playground.html'
      }
    }
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: '../dist/index.browser.js', dest: '.' },
        { src: '../demos/*', dest: 'demos' },
        { src: '../src/markdown-ontology.ttl', dest: 'src' },
        { src: '../src/markdown-ontology.owl', dest: 'src' }
      ]
    })
  ]
});
