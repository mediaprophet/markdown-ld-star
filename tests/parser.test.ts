import { parseMarkdownLD, markdownLDToTurtle, validateSHACL, generateSampleOntology, fromRDFToMarkdownLD } from '../src/index';

describe('MarkdownLD Parser', () => {
  // ... (existing tests)
});

describe('MarkdownLD Parser Comprehensive', () => {
  // ... (existing tests)
});

describe('RDF to MarkdownLD Converter', () => {
  it('converts Turtle to Markdown-LD', async () => {
    const turtle = `
@prefix ex: <http://example.org/> .
ex:Person a ex:Type ; ex:name "John" .
    `;
    const md = await fromRDFToMarkdownLD(turtle, 'turtle');
    expect(md).toContain('[ex]: http://example.org/');
    expect(md).toContain('[Person]{typeof=ex:Type; ex:name="John"}');
  });

  it('converts RDF-Star Turtle to Markdown-LD with annotation', async () => {
    const turtle = `
@prefix ex: <http://example.org/> .
ex:Alice ex:knows ex:Bob .
<< ex:Alice ex:knows ex:Bob >> ex:certainty 0.9 .
    `;
    const md = await fromRDFToMarkdownLD(turtle, 'turtle');
    expect(md).toContain('[Alice] ex:knows [Bob] {| ex:certainty=0.9 |}');
  });

  it('converts JSON-LD* to Markdown-LD', async () => {
    const jsonldstar = JSON.stringify({
      '@graph': [{
        '@id': 'ex:Alice',
        'ex:knows': {
          '@id': 'ex:Bob',
          '@annotation': { 'ex:certainty': 0.9 }
        }
      }]
    });
    const md = await fromRDFToMarkdownLD(jsonldstar, 'jsonldstar');
    expect(md).toContain('[Alice] ex:knows [Bob] {| ex:certainty=0.9 |}');
  });

  // Additional tests for other formats, errors, SHACL, etc.
  it('converts with SHACL SPARQL', async () => {
    const turtle = `
@prefix ex: <http://example.org/> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
ex:Constraint sh:select "SELECT ?this WHERE { ?this ex:name ?name }" .
    `;
    const md = await fromRDFToMarkdownLD(turtle, 'turtle');
    expect(md).toContain('## SHACL Constraints');
    expect(md).toContain('```sparql\nSELECT ?this WHERE { ?this ex:name ?name }\n```');
  });
});