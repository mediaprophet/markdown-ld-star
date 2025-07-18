import * as markdownLD from '../src/index';

describe('MarkdownLD Parser', () => {
  it('parses basic Markdown-LD', async () => {
    const md = '[ex]: http://example.org/\n[Person]{typeof=ex:Type; ex:name="John"}';
    const result = await markdownLD.markdownLDToTurtle(md);
    expect(result).toContain('ex:Person');
    expect(result).toContain('ex:name "John"');
  });

  it('parses Markdown-LD with annotation', async () => {
    const md = '[ex]: http://example.org/\n[Person] ex:knows [Bob] {| ex:certainty=0.9 |}';
    const result = await markdownLD.markdownLDToTurtle(md);
    expect(result).toContain('ex:certainty 0.9');
    expect(result).toContain('<<ex:Person ex:knows ex:Bob>> ex:certainty 0.9 .');
  });

  it('parses Markdown-LD with quoted triple', async () => {
    const md = '[ex]: http://example.org/\n<<[Person] ex:knows [Bob]>> ex:statedBy [Alice]';
    const result = await markdownLD.markdownLDToTurtle(md);
    expect(result).toContain('<<ex:Person ex:knows ex:Bob>> ex:statedBy ex:Alice .');
  });

  it('handles SHACL constraints', async () => {
    const md = '[ex]: http://example.org/\n## SHACL Constraints\n```sparql\nSELECT ?this WHERE { ?this ex:name ?name }\n```';
    const result = await markdownLD.markdownLDToTurtle(md);
    expect(result).toContain('SELECT ?this WHERE');
  });
});

describe('MarkdownLD Parser Comprehensive', () => {
  it('validates data against SHACL shapes', async () => {
    const data = `@prefix ex: <http://example.org/> .\nex:Person a ex:Type ; ex:name "John" .`;
    const results = await markdownLD.validateSHACL(data, markdownLD.markdownOntologySHACL);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('success');
  });

  it('parses Markdown-LD with multiple prefixes', async () => {
    const md = '[ex]: http://example.org/\n[foaf]: http://xmlns.com/foaf/0.1/\n[Person]{typeof=foaf:Person; foaf:name="Jane"}';
    const result = await markdownLD.markdownLDToTurtle(md);
    expect(result).toContain('foaf:Person');
    expect(result).toContain('foaf:name "Jane"');
  });

  it('handles error for invalid syntax', async () => {
    const md = '[ex]: http://example.org/\n[Person]{typeof=ex:Type; ex:name}';
    await expect(markdownLD.markdownLDToTurtle(md)).rejects.toThrow();
  });
});

describe('RDF-Star Edge Cases', () => {
  it('parses complex quoted and annotation triples from RDF-star sample', async () => {
    const rdfStarSample = `
[ex]: http://example.org/
[Bob]{typeof=ex:Person; ex:age=23}
[Bob] ex:age 23 {| ex:measuredOn="2023-01-01"^^xsd:date ; ex:confidence=0.8 |}
<<[Alice] ex:name "Alice">> ex:statedBy [Bob]
<< <<[Alice] ex:name "Alice">> ex:reportedBy [Charlie] >>
    `;
    const result = await markdownLD.markdownLDToTurtle(rdfStarSample);
    expect(result).toContain('<<');
    expect(result).toContain('ex:measuredOn');
    expect(result).toContain('ex:confidence');
    expect(result).toContain('ex:statedBy');
    expect(result).toContain('ex:reportedBy');
  });

  it('converts Turtle to Markdown-LD', async () => {
    const turtle = `
@prefix ex: <http://example.org/> .
ex:Person a ex:Type ; ex:name "John" .
    `;
    const md = await markdownLD.fromRDFToMarkdownLD(turtle, 'turtle');
    expect(md).toContain('[ex]: http://example.org/');
    expect(md).toContain('[Person]{typeof=ex:Type; ex:name="John"}');
  });

  it('converts RDF-Star Turtle to Markdown-LD with annotation', async () => {
    const turtle = `
@prefix ex: <http://example.org/> .
ex:Alice ex:knows ex:Bob .
<< ex:Alice ex:knows ex:Bob >> ex:certainty 0.9 .
    `;
    const md = await markdownLD.fromRDFToMarkdownLD(turtle, 'turtle');
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
    const md = await markdownLD.fromRDFToMarkdownLD(jsonldstar, 'jsonldstar');
    expect(md).toContain('[Alice] ex:knows [Bob] {| ex:certainty=0.9 |}');
  });

  it('converts FOAF Turtle to Markdown-LD-Star format', async () => {
    const turtle = `
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix ex: <http://example.org/> .

ex:alice a foaf:Person ;
  foaf:name "Alice" ;
  foaf:mbox <mailto:alice@example.org> ;
  foaf:knows ex:bob .

ex:bob a foaf:Person ;
  foaf:name "Bob" ;
  foaf:mbox <mailto:bob@example.org> .
`;
    const md = await markdownLD.fromRDFToMarkdownLD(turtle, 'turtle');
    expect(md).toContain('[foaf]: http://xmlns.com/foaf/0.1/');
    expect(md).toContain('[alice]{typeof=foaf:Person; foaf:name="Alice"; foaf:mbox="mailto:alice@example.org"; foaf:knows=ex:bob;}');
    expect(md).toContain('[bob]{typeof=foaf:Person; foaf:name="Bob"; foaf:mbox="mailto:bob@example.org";}');
  });

  it('converts with SHACL SPARQL', async () => {
    const turtle = `
@prefix ex: <http://example.org/> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
ex:Constraint sh:select "SELECT ?this WHERE { ?this ex:name ?name }" .
    `;
    const md = await markdownLD.fromRDFToMarkdownLD(turtle, 'turtle');
    expect(md).toContain('## SHACL Constraints');
    expect(md).toContain('```sparql\nSELECT ?this WHERE { ?this ex:name ?name }\n```');
  });
});

describe('MarkdownLD Edge Cases', () => {
  it('handles empty input', async () => {
    const md = '';
    const result = await markdownLD.markdownLDToTurtle(md);
    expect(result).toBe('');
  });

  it('handles missing prefix', async () => {
    const md = '[Person]{typeof=ex:Type; ex:name="John"}';
    const result = await markdownLD.markdownLDToTurtle(md);
    expect(result).toContain('ex:Person');
    expect(result).toContain('ex:name "John"');
  });

  it('handles deeply nested annotation', async () => {
    const md = '[ex]: http://example.org/\n[Person] ex:knows [Bob] {| ex:certainty=0.9; ex:source=[Source]{typeof=ex:Document; ex:title="Doc"} |}';
    const result = await markdownLD.markdownLDToTurtle(md);
    expect(result).toContain('ex:certainty 0.9');
    expect(result).toContain('ex:title "Doc"');
  });

  it('handles quoted triple as object', async () => {
    const md = '[ex]: http://example.org/\n[Person] ex:statement <<[Person] ex:knows [Bob]>>';
    const result = await markdownLD.markdownLDToTurtle(md);
    expect(result).toContain('ex:statement');
    expect(result).toContain('<<ex:Person ex:knows ex:Bob>>');
  });

  it('handles invalid property', async () => {
    const md = '[ex]: http://example.org/\n[Person]{typeof=ex:Type; ex:name}';
    await expect(markdownLD.markdownLDToTurtle(md)).rejects.toThrow();
  });
});

describe('MarkdownLD Format Support', () => {
  it('parses N3 input', async () => {
    const n3 = '@prefix ex: <http://example.org/> .\nex:Person a ex:Type ; ex:name "John" .';
    const md = await markdownLD.fromRDFToMarkdownLD(n3, 'n3');
    expect(md).toContain('[Person]{typeof=ex:Type; ex:name="John"}');
  });

  it('parses JSON-LD input', async () => {
    const jsonld = JSON.stringify({
      '@context': { 'ex': 'http://example.org/' },
      '@id': 'ex:Person',
      '@type': 'ex:Type',
      'ex:name': 'John'
    });
    const md = await markdownLD.fromRDFToMarkdownLD(jsonld, 'jsonld');
    expect(md).toContain('[Person]{typeof=ex:Type; ex:name="John"}');
  });

  it('parses RDF/JSON input', async () => {
    const rdfjson = JSON.stringify({
      'http://example.org/Person': {
        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type': [{ type: 'uri', value: 'http://example.org/Type' }],
        'http://example.org/name': [{ type: 'literal', value: 'John' }]
      }
    });
    const md = await markdownLD.fromRDFToMarkdownLD(rdfjson, 'rdfjson');
    expect(md).toContain('[Person]{typeof=ex:Type; ex:name="John"}');
  });
});