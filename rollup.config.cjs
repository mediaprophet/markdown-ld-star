const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const typescript = require('@rollup/plugin-typescript');
const terser = require('@rollup/plugin-terser');

const external = ['n3', '@rdfjs/parser-n3', '@rdfjs/serializer-jsonld', 'unified', 'remark-parse', 'remark-stringify'];

module.exports = [
  // Node (CJS/ESM) builds with externals
  {
    input: 'src/index.ts',
    output: [
      {
        dir: 'dist',
        entryFileNames: 'index.cjs',
        format: 'cjs',
        exports: 'auto'
      },
      {
        dir: 'dist',
        entryFileNames: 'index.mjs',
        format: 'esm'
      }
    ],
    plugins: [
      typescript({ tsconfig: './tsconfig.json' }),
      resolve({ preferBuiltins: true }), 
      commonjs()
    ],
    external
  },
  // Browser UMD build, fully bundled (unminified)
  {
    input: 'src/browser.ts',
    output: {
      file: 'dist/index.browser.js',
      format: 'umd',
      name: 'MarkdownLDStar',
      globals: {
        'streamify-array': 'streamifyArray',
        'fs': 'fs',
        'buffer': 'Buffer',
        'events': 'Events'
      }
    },
    plugins: [
      resolve({ browser: true, preferBuiltins: false }),
      commonjs(),
      typescript({ tsconfig: './tsconfig.json' }),
      require('rollup-plugin-polyfill-node')()
    ],
  },
  // Browser UMD build, minified
  {
    input: 'src/browser.ts',
    output: {
      file: 'dist/index.browser.min.js',
      format: 'umd',
      name: 'MarkdownLDStar',
      globals: {
        'streamify-array': 'streamifyArray',
        'fs': 'fs',
        'buffer': 'Buffer',
        'events': 'Events'
      }
    },
    plugins: [
      resolve({ browser: true, preferBuiltins: false }),
      commonjs(),
      typescript({ tsconfig: './tsconfig.json' }),
      terser(),
      require('rollup-plugin-polyfill-node')()
    ],
  }
];
