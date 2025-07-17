import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

const external = ['n3', '@rdfjs/parser-n3', '@rdfjs/serializer-jsonld', 'unified', 'remark-parse', 'remark-stringify'];

export default [
  // Node (CJS/ESM) builds with externals
  {
    input: 'src/index.ts',
    output: [
      { file: 'dist/index.cjs', format: 'cjs', exports: 'auto' },
      { file: 'dist/index.mjs', format: 'esm' }
    ],
    plugins: [typescript(), resolve({ browser: true }), commonjs()],
    external
  },
  // Browser UMD build, fully bundled
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.browser.js',
      format: 'umd',
      name: 'MarkdownLDStar'
    },
    plugins: [typescript(), resolve({ browser: true }), commonjs()]
    // No 'external' here!
  }
];