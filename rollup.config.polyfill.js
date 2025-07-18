import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import nodePolyfills from 'rollup-plugin-polyfill-node';

const external = ['n3', '@rdfjs/parser-n3', '@rdfjs/serializer-jsonld', 'unified', 'remark-parse', 'remark-stringify'];

export default [
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
    input: 'src/index.ts',
    output: {
      file: 'dist/index.browser.js',
      format: 'umd',
      name: 'MarkdownLDStar',
    },
    plugins: [
      nodePolyfills(),
      resolve({ browser: true }),
      commonjs(),
      typescript({ tsconfig: './tsconfig.json' })
    ],
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
      nodePolyfills(),
      resolve({ browser: true }),
      commonjs(),
      typescript({ tsconfig: './tsconfig.json' }),
      terser()
    ],
  }
];
