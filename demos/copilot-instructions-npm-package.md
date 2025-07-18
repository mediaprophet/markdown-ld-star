# Copilot Instructions for markdown-ld-star npm Package

## Goals
- Ensure the package is fully compatible with Node.js and Electron environments.
- Avoid browser-only APIs (window, document, fetch, DOM).
- Use Node.js modules for file/network operations (fs, http, https, path).
- Export only Node.js-friendly APIs; provide a separate browser build if needed.
- All code should run in Node.js main/renderer or Electron main/renderer processes.

## Coding Guidelines
- Do not use any global browser objects unless checking for their existence.
- For file I/O, use Node.js `fs` and `path` modules.
- For network requests, use Node.js `http`, `https`, or a library like `axios` (with Node adapter).
- Avoid direct DOM manipulation or browser events.
- If browser compatibility is needed, create a separate UMD/IIFE build and keep it isolated from Node.js code.
- Use CommonJS or ESM exports for Node.js compatibility.
- Ensure all dependencies are Node.js/Electron safe.

## Electron Integration
- All APIs must work in Electron's main and renderer processes.
- For renderer process, use IPC to communicate with main process for Node.js tasks if needed.
- Avoid using Electron's remote module (deprecated).

## Testing
- Provide unit tests for all major APIs using Node.js test runners (e.g., Jest, Mocha).
- Test in both Node.js and Electron environments.

## Documentation
- Document all public APIs and usage examples for Node.js and Electron.
- Clearly state any browser limitations or requirements.

## Example Export
```js
// Node.js/Electron compatible export
module.exports = {
  parseMarkdownLD,
  fromRDFToMarkdownLD,
  // ...other APIs
};
```

## Example Import
```js
const { parseMarkdownLD, fromRDFToMarkdownLD } = require('markdown-ld-star');
```

---
For browser builds, use a separate entry point and avoid mixing browser and Node.js code in the same file.
