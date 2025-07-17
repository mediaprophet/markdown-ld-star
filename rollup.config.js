import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/index.ts',
  output: [
    { file: 'dist/index.cjs', format: 'cjs', exports: 'default' },
    { file: 'dist/index.mjs', format: 'esm' },
    { file: 'dist/index.browser.js', format: 'umd', name: 'MarkdownLD' }
  ],
  plugins: [typescript(), resolve({ browser: true }), commonjs()],
  external: ['n3', '@rdfjs/parser-n3', '@rdfjs/serializer-jsonld', 'unified', 'remark-parse', 'remark-stringify']
};