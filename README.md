
# Markdown-LD* & Markdown-LD-Star
**A TypeScript/JavaScript library for parsing and serializing Markdown-LD* (Markdown with RDF-star/quoted triples) and Markdown-LD-Star, with support for RDF-star, JSON-LD, Turtle, and more.**

---
> **Specification Draft:**
> This project is specified in the [Markdown-LD & Markdown-LD-Star Unofficial Draft Specification](demos/respec-index.html). The spec covers syntax, parser modes, quoted triples, SHACL constraints, and integration with the Semantic Weaver plugin and playground. See [demos/respec-index.html](demos/respec-index.html) for details.
---

## Markdown Syntax Ontology

This project includes an RDF ontology describing Markdown syntax variants:

- **Standard Markdown** ([md:StandardMarkdown](src/markdown-ontology.ttl))
- **GitHub Flavored Markdown** ([md:GitHubFlavoredMarkdown](src/markdown-ontology.ttl))
- **Obsidian Markdown** ([md:ObsidianMarkdown](src/markdown-ontology.ttl))

See the following ontology files and demos:

- [`ontologies/markdown-ontology.ttl`](ontologies/markdown-ontology.ttl) — Turtle/RDF version
- [`ontologies/markdown-ontology.owl`](ontologies/markdown-ontology.owl) — OWL version with sameAs mappings
- [`demos/markdown-ontology.md`](demos/markdown-ontology.md) — Markdown-LD-Star demo (Turtle style)
- [`demos/markdown-ontology-owl.md`](demos/markdown-ontology-owl.md) — Markdown-LD-Star demo (OWL style)

These can be used for documentation, testing, and as examples of Markdown-LD-Star ontologies.

Example (Turtle):

```turtle
@prefix md: <http://example.org/markdown#> .
md:ObsidianMarkdown md:hasExtension md:wikilinks, md:callouts .
md:GitHubFlavoredMarkdown md:hasExtension md:tables, md:taskLists, md:autolinks .
```

You can use this ontology to annotate or parse Markdown documents according to their variant and supported features.
## Usage

```javascript
import { parseMarkdownLD } from 'markdown-ld-star';

# markdown-ld-star

A Node.js library for parsing Markdown-LD* and Markdown-LD-Star (Markdown with embedded RDF-Star/Linked Data) into RDF formats like Turtle and JSON-LD, and vice versa.

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


## Demos & Playground
See `demos/` for samples: schema-org, rdf-star, shacl.

- **Live playground:** https://mediaprophet.github.io/markdown-ld-star/demos/playground.html
- **Specification:** [demos/respec-index.html](demos/respec-index.html)

## Browser Usage
Try the interactive playground at https://mediaprophet.github.io/markdown-ld-star/demos/playground.html
<script src="dist/index.browser.js"></script>
<script>
  const result = MarkdownLDStar.parseMarkdownLD(content);
</script>
```

## Installation


## Usage

```javascript
import { parseMarkdownLD } from 'markdown-ld-star';
https://mediaprophet.github.io/markdown-ld-star/demos/playground.html?uri=https://raw.githubusercontent.com/dherault/semantic-graphql/refs/heads/master/examples/foaf/foaf.ttl&field=foaf:name&format=json
const content = `
[ex]: http://example.org/
[Node]{typeof=ex:Type; prop="value"}
`;

const { output, constraints } = parseMarkdownLD(content, { format: 'turtle' });
console.log(output);
```
https://mediaprophet.github.io/markdown-ld-star/demos/playground.html?uri=https://raw.githubusercontent.com/dherault/semantic-graphql/refs/heads/master/examples/foaf/foaf.ttl&field=foaf:name&format=turtle
### convert RDF to Markddown-ld*

```javascript
import { fromRDFToMarkdownLD } from 'markdown-ld-star';

const turtleInput = `@prefix ex: <http://example.org/> . ex:Person a ex:Type .`;
const md = await fromRDFToMarkdownLD(turtleInput, 'turtle');
console.log(md);
https://mediaprophet.github.io/markdown-ld-star/demos/playground.html?uri=https://raw.githubusercontent.com/dherault/semantic-graphql/refs/heads/master/examples/foaf/foaf.ttl&field=foaf:name&format=markdownld

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
Try the interactive playground at https://mediaprophet.github.io/markdown-ld-star/demos/playground.html

- Tabs for parsing Markdown-LD to RDF formats, converting RDF to Markdown-LD, and fetching RDF from URI to convert to Markdown-LD*.
- Uses the browser build of the library.
- Example: Input Markdown-LD, select output format, parse.
- Fetch: Enter a public RDF URI (e.g., Turtle file), select format, convert to Markdown-LD.

### API-like Query via URL Parameters

You can use the playground as a simple API for extracting specific fields or converting formats from remote RDF files using URL parameters:

**Endpoint:** `/demos/playground.html?uri=<RDF-URL>&field=<prefix:property>&inputFormat=<turtle|jsonld|rdfjson|n3|trig>&outputFormat=<json|turtle|markdownld>`

**Parameters:**
- `uri`: The RDF resource to fetch (e.g., a Turtle file URL)
- `field`: The property to extract (e.g., `foaf:name`)
- `inputFormat`: The input RDF serialization format (e.g., `turtle`, `jsonld`, `rdfjson`, `n3`, `trig`). **Required.**
- `outputFormat`: The output format (`json`, `turtle`, or `markdownld`). Default is `markdownld`.

**Examples:**

Fetch a field as JSON:
```
https://mediaprophet.github.io/markdown-ld-star/demos/playground.html?uri=https://raw.githubusercontent.com/dherault/semantic-graphql/refs/heads/master/examples/foaf/foaf.ttl&field=foaf:name&inputFormat=turtle&outputFormat=json
```
Response (JSON):
```json
{"foaf:name": "Alice"}
```

Fetch a field as Turtle:
```
https://mediaprophet.github.io/markdown-ld-star/demos/playground.html?uri=https://raw.githubusercontent.com/dherault/semantic-graphql/refs/heads/master/examples/foaf/foaf.ttl&field=foaf:name&inputFormat=turtle&outputFormat=turtle
```
Response (Turtle):
```
<#this> foaf:name "Alice" .
```

Fetch a field as Markdown-LD*:
```
https://mediaprophet.github.io/markdown-ld-star/demos/playground.html?uri=https://raw.githubusercontent.com/dherault/semantic-graphql/refs/heads/master/examples/foaf/foaf.ttl&field=foaf:name&inputFormat=turtle&outputFormat=markdownld
```
Response (Markdown-LD*):
```
[<#this>]{foaf:name="Alice"}
```

**Note:** The input format is required. The output format is controlled by the `outputFormat` parameter.