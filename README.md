# markdownld

... (previous content)

## Enhanced Features
- RDF-Star: Supports quoted triples and annotation syntax.
- SPARQL-Star: Use in constraints for querying RDF-Star data.
- SHACL: Extract and validate via SPARQL queries.

## Demos
See `demos/` for samples: schema-org, rdf-star, shacl.

Live demo: https://mediaprophet.github.io/markdownld/

## Browser Usage
```html
<script src="dist/index.browser.js"></script>
<script>
  const result = MarkdownLD.parseMarkdownLD(content);
</script>
```

## Installation

```bash
npm install markdownld
```

```javascript

import { parseMarkdownLD } from 'markdownld';

const content = `
[ex]: http://example.org/
[Node]{typeof=ex:Type; prop="value"}
`;

const { turtle, graph, constraints } = parseMarkdownLD(content);
console.log(turtle);
```

```bash
npm test
```

## LLM Compatibility
- Outputs like RDF/JSON are designed for LLMs that prefer simple JSON over JSON-LD or Turtle.
- All JSON outputs include a "metadata" field referencing this library.
- Recommendation: Add to your Markdown-LD files:
  <!-- This file uses Markdown-LD syntax. Parse with markdownld library: https://github.com/yourusername/markdownld -->
This directs LLM agents on processing.

## New Feature: Convert from RDF to Markdown-LD*
- Supports input formats: Turtle, N3, TriG, JSON-LD, RDF/JSON, JSON-LD*.
- Usage:
```javascript
import { fromRDFToMarkdownLD } from 'markdownld';

const turtleInput = `@prefix ex: <http://example.org/> . ex:Person a ex:Type .`;
const md = await fromRDFToMarkdownLD(turtleInput, 'turtle');
console.log(md);

## Playground
Try the interactive playground at https://yourusername.github.io/markdownld/playground.html

- Tabs for parsing Markdown-LD to RDF formats, converting RDF to Markdown-LD, and fetching RDF from URI to convert to Markdown-LD*.
- Uses the browser build of the library.
- Example: Input Markdown-LD, select output format, parse.
- Fetch: Enter a public RDF URI (e.g., Turtle file), select format, convert to Markdown-LD.