import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

const external = ['n3', '@rdfjs/parser-n3', '@rdfjs/serializer-jsonld', 'unified', 'remark-parse', 'remark-stringify']; // Node only

export default [
  // Node (CJS/ESM) builds with externals
  {
    input: 'src/index.ts',
    output: [
      {
        // Use 'dir' instead of 'file' to allow for multiple chunks
        dir: 'dist',
        // Specify the name for the main entry file
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
      // For Node builds, prefer the built-in modules
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
    // Do NOT mark rdf-serialize or jsonld as external for browser build
    external: ['n3', '@rdfjs/parser-n3', '@rdfjs/serializer-jsonld', 'unified', 'remark-parse', 'remark-stringify'] // exclude rdf-serialize, jsonld
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