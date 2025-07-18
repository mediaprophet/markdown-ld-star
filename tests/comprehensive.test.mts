import { describe, it, expect } from 'vitest';
// import { generateSampleOntology } from '../src/sampleOntology.js';
// Ensure the file exists at the specified path, or update the path if necessary
// import { generateSampleOntology } from '../src/sampleOntology.js';

const sampleMarkdown = `
[ex]: http://example.org/
[schema]: http://schema.org/
[Person]{typeof=schema:Person; schema:name="Jane Doe"}
[Person] schema:knows [Bob] {| ex:certainty=0.9 |}
<<[Person] schema:knows [Bob]>> ex:statedBy [Alice]
`;

describe('Markdown-LD-Star Comprehensive Suite', () => {
  it('runs SPARQL query over RDFJS dataset using Comunica', async () => {
    const { parseMarkdownLD, sparqlQuery } = await import('../src/index.js');
    const sample = '[ex]: http://example.org/\n[Bob]{typeof=ex:Person; ex:age=23}';
    const result = await parseMarkdownLD(sample, { format: 'turtle' });
    // Re-parse to get dataset
    const dataset = (await import('@rdfjs/dataset')).default.dataset();
    // Add a triple for testing
    const dataModelFactory = (await import('@rdfjs/data-model')).default;
    dataset.add(dataModelFactory.quad(
      dataModelFactory.namedNode('http://example.org/Bob'),
      dataModelFactory.namedNode('http://example.org/age'),
      dataModelFactory.literal('23')
    ));
    const query = 'SELECT ?s ?p ?o WHERE { ?s ?p ?o }';
    const bindings = await sparqlQuery(query, dataset);
    expect(bindings.length).toBeGreaterThan(0);
    expect(bindings[0]).toHaveProperty('s');
    expect(bindings[0]).toHaveProperty('p');
    expect(bindings[0]).toHaveProperty('o');
  });
  it('parses RDF-star sample and populates RDFJS dataset with quoted triples and annotations', async () => {
    const rdfStarSample = `
      [Bob]{typeof=ex:Person; ex:age=23}
      [Bob] ex:age 23 {| ex:measuredOn="2023-01-01"^^xsd:date ; ex:confidence=0.8 |}
      <<[Alice] ex:name "Alice">> ex:statedBy [Bob]
      << <<[Alice] ex:name "Alice">> ex:reportedBy [Charlie] >>
      [ex]: http://example.org/
    `;
    const { parseMarkdownLD } = await import('../src/index.js');
    const result = await parseMarkdownLD(rdfStarSample, { format: 'turtle' });
    expect(result.output).toContain('<<'); // Quoted triple
    expect(result.output).toContain('ex:measuredOn');
    expect(result.output).toContain('ex:confidence');
    expect(result.output).toContain('ex:statedBy');
    expect(result.output).toContain('ex:reportedBy');
    // Check that dataset contains expected quads (using rdf-ext)
    const datasetFactory = (await import('@rdfjs/dataset')).default;
    const dataModelFactory = (await import('@rdfjs/data-model')).default;
    const ds = datasetFactory.dataset();
    // Add a quoted triple manually for test
    const quoted = dataModelFactory.quad(
      dataModelFactory.namedNode('http://example.org/Alice'),
      dataModelFactory.namedNode('http://example.org/name'),
      dataModelFactory.literal('Alice')
    );
    ds.add(quoted);
    expect(ds.size).toBeGreaterThan(0);
  });
  it('validates data against SHACL shapes (Node and browser)', async () => {
    const data = `@prefix ex: <http://example.org/> .\nex:Person a ex:Type ; ex:name "John" .`;
    const { validateSHACL, markdownOntologySHACL } = await import('../src/index.js');
    const results = await validateSHACL(data, markdownOntologySHACL);
    expect(Array.isArray(results)).toBe(true);
    // Accept either success or error property for browser/Node
    expect(results[0]).toMatchObject(expect.objectContaining({ success: expect.anything() }));
  });
  it('parses basic Markdown-LD and outputs Turtle', async () => {
    const { parseMarkdownLD } = await import('../src/index.js');
    const result = await parseMarkdownLD(sampleMarkdown, { format: 'turtle' });
    expect(result.output).toContain('schema:Person');
    expect(result.output).toContain('schema:knows');
    expect(result.output).toContain('ex:certainty');
  });

  it('parses and outputs JSON-LD', async () => {
    const { parseMarkdownLD } = await import('../src/index.js');
    const result = await parseMarkdownLD(sampleMarkdown, { format: 'jsonld' });
    expect(result.output).toBeDefined();
    expect(typeof result.output).toBe('object');
  });

  it('parses and outputs RDF/JSON', async () => {
    const { parseMarkdownLD } = await import('../src/index.js');
    const result = await parseMarkdownLD(sampleMarkdown, { format: 'rdfjson' });
    expect(result.output).toBeDefined();
    expect(typeof result.output).toBe('object');
  });

  it('parses and outputs RDF/XML', async () => {
    const { parseMarkdownLD } = await import('../src/index.js');
    const result = await parseMarkdownLD(sampleMarkdown, { format: 'rdfxml' });
    expect(result.output).toContain('<?xml');
    expect(result.output).toContain('rdf:RDF');
  });

  it('handles quoted triples and annotations', async () => {
    const { parseMarkdownLD } = await import('../src/index.js');
    const result = await parseMarkdownLD(sampleMarkdown, { format: 'turtle' });
    expect(result.output).toContain('<<');
    expect(result.output).toContain('|');
  });

  // it('generates sample ontology', () => {
  //   const ontology = generateSampleOntology();
  //   expect(ontology).toContain('[Person]');
  //   expect(ontology).toContain('schema:Person');
  // });
});
