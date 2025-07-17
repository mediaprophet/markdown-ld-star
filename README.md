# markdown-ld-star

A Node.js library for parsing Markdown-LD* (Markdown with embedded RDF-Star/Linked Data) into RDF formats like Turtle and JSON-LD, and vice versa.

## Features
- Parse Markdown-LD* into Turtle, JSON-LD, RDF/JSON, JSON-LD* formats.
- Extract SHACL constraints.
- Generate sample ontology templates.
- Convert from RDF formats (Turtle, JSON-LD, etc.) to Markdown-LD*.
- Compatible with Node.js 18, 20, 22+.

## Installation
```bash
npm install markdown-ld-star
```

## Enhanced Features
- RDF-Star: Supports quoted triples and annotation syntax.
- SPARQL-Star: Use in constraints for querying RDF-Star data.
- SHACL: Extract and validate via SPARQL queries.

## Demos
See `demos/` for samples: schema-org, rdf-star, shacl.

Live demo: https://mediaprophet.github.io/markdown-ld-star//

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

## Usage

```javascript
import { parseMarkdownLD } from 'markdown-ld-star';

const content = `
[ex]: http://example.org/
[Node]{typeof=ex:Type; prop="value"}
`;

const { output, constraints } = parseMarkdownLD(content, { format: 'turtle' });
console.log(output);
```

### convert RDF to Markddown-ld*

```javascript
import { fromRDFToMarkdownLD } from 'markdown-ld-star';

const turtleInput = `@prefix ex: <http://example.org/> . ex:Person a ex:Type .`;
const md = await fromRDFToMarkdownLD(turtleInput, 'turtle');
console.log(md);
```

## Tests
```bash
npm test
```

## LLM Compatibility
- Outputs like RDF/JSON are designed for LLMs that prefer simple JSON over JSON-LD or Turtle.
- All JSON outputs include a "metadata" field referencing this library.
- Recommendation: Add to your Markdown-LD files:
  <!-- This file uses Markdown-LD syntax. Parse with markdownld library: https://github.com/mediaprophet/markdownld -->
This directs LLM agents on processing.

## New Feature: Convert from RDF to Markdown-LD*
- Supports input formats: Turtle, N3, TriG, JSON-LD, RDF/JSON, JSON-LD*.
- Usage:
```javascript
import { fromRDFToMarkdownLD } from 'markdownld';

const turtleInput = `@prefix ex: <http://example.org/> . ex:Person a ex:Type .`;
const md = await fromRDFToMarkdownLD(turtleInput, 'turtle');
console.log(md);
```


## Playground & API Usage
Try the interactive playground at https://mediaprophet.github.io/markdown-ld-star/playground.html

- Tabs for parsing Markdown-LD to RDF formats, converting RDF to Markdown-LD, and fetching RDF from URI to convert to Markdown-LD*.
- Uses the browser build of the library.
- Example: Input Markdown-LD, select output format, parse.
- Fetch: Enter a public RDF URI (e.g., Turtle file), select format, convert to Markdown-LD.

### API-like Query via URL Parameters

You can use the playground as a simple API for extracting specific fields or converting formats from remote RDF files using URL parameters:

**Endpoint:** `/playground.html?uri=<RDF-URL>&field=<prefix:property>&format=<json|turtle|markdownld>`

**Parameters:**
- `uri`: The RDF resource to fetch (e.g., a Turtle file URL)
- `field`: The property to extract (e.g., `foaf:name`)
- `format`: The output format (`json`, `turtle`, or `markdownld`). Default is `markdownld`.

**Examples:**

Fetch a field as JSON:
```
https://mediaprophet.github.io/markdown-ld-star/playground.html?uri=https://raw.githubusercontent.com/dherault/semantic-graphql/refs/heads/master/examples/foaf/foaf.ttl&field=foaf:name&format=json
```
Response (JSON):
```json
{"foaf:name": "Alice"}
```

Fetch a field as Turtle:
```
https://mediaprophet.github.io/markdown-ld-star/playground.html?uri=https://raw.githubusercontent.com/dherault/semantic-graphql/refs/heads/master/examples/foaf/foaf.ttl&field=foaf:name&format=turtle
```
Response (Turtle):
```
<#this> foaf:name "Alice" .
```

Fetch a field as Markdown-LD*:
```
https://mediaprophet.github.io/markdown-ld-star/playground.html?uri=https://raw.githubusercontent.com/dherault/semantic-graphql/refs/heads/master/examples/foaf/foaf.ttl&field=foaf:name&format=markdownld
```
Response (Markdown-LD*):
```
[<#this>]{foaf:name="Alice"}
```

**Note:** The input format is auto-detected based on the file extension or content. The output format is controlled by the `format` parameter.