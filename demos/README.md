# Markdown-LD-Star Demos (Vite React)

This project contains React-based demos for the Markdown-LD-Star library, migrated from legacy HTML/JS implementations.

## Features
- API demo for querying RDF/Markdown-LD* via URI
- Legacy styles imported from olddemos
- Ready for additional demo components

## Getting Started
1. Install dependencies: `npm install`
2. Start the dev server: `npm run dev`
3. Open your browser to the provided localhost URL

## Migrating Legacy Demos
- Legacy demo files and styles are in `olddemos/`
- Migrate each demo to a React component in `src/`
- Import styles as needed

## Optimizing for npm
- Refactor main.ts/index.ts to export only the npm package API
- Keep browser and Node.js code separate

## Contributing
Feel free to add new demo components or improve existing ones!
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
