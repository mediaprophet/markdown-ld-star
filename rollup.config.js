import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import polyfill from 'rollup-plugin-polyfill-node'; // <-- Import the polyfill

const external = ['n3', '@rdfjs/parser-n3', '@rdfjs/serializer-jsonld', 'unified', 'remark-parse', 'remark-stringify'];

export default [
  // Node (CJS/ESM) builds with externals
  {
    input: 'src/index.ts',
    output: [
      { file: 'dist/index.cjs', format: 'cjs', exports: 'auto' },
      { file: 'dist/index.mjs', format: 'esm' }
    ],
    plugins: [typescript(), resolve(), commonjs()],
    external
  },
  // Browser UMD build, fully bundled (unminified)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.browser.js',
      format: 'umd',
      name: 'MarkdownLDStar',
    },
    plugins: [
      polyfill(), // <-- Add the polyfill plugin
      resolve({ browser: true, preferBuiltins: false }),
      commonjs(),
      typescript({ tsconfig: './tsconfig.json' })
    ],
    external: [] // Ensure nothing is external
  },
  // Browser UMD build, minified
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.browser.min.js',
      format: 'umd',
      name: 'MarkdownLDStar',
    },
    plugins: [
      polyfill(), // <-- Add the polyfill plugin
      resolve({ browser: true, preferBuiltins: false }),
      commonjs(),
      typescript({ tsconfig: './tsconfig.json' }),
      terser()
    ],
    external: []
  }
];
