import { describe, it, expect } from 'vitest';
import { parseMarkdownLD, markdownLDToTurtle, generateSampleOntology } from '../src/index.js';

const sampleMarkdown = `
[ex]: http://example.org/
[schema]: http://schema.org/
[Person]{typeof=schema:Person; schema:name="Jane Doe"}
[Person] schema:knows [Bob] {| ex:certainty=0.9 |}
<<[Person] schema:knows [Bob]>> ex:statedBy [Alice]
`;

describe('Markdown-LD-Star Comprehensive Suite', () => {
  it('parses basic Markdown-LD and outputs Turtle', async () => {
    const result = await parseMarkdownLD(sampleMarkdown, { format: 'turtle' });
    expect(result.output).toContain('schema:Person');
    expect(result.output).toContain('schema:knows');
    expect(result.output).toContain('ex:certainty');
  });

  it('parses and outputs JSON-LD', async () => {
    const result = await parseMarkdownLD(sampleMarkdown, { format: 'jsonld' });
    expect(result.output).toBeDefined();
    expect(typeof result.output).toBe('object');
  });

  it('parses and outputs RDF/JSON', async () => {
    const result = await parseMarkdownLD(sampleMarkdown, { format: 'rdfjson' });
    expect(result.output).toBeDefined();
    expect(typeof result.output).toBe('object');
  });

  it('parses and outputs RDF/XML', async () => {
    const result = await parseMarkdownLD(sampleMarkdown, { format: 'rdfxml' });
    expect(result.output).toContain('<?xml');
    expect(result.output).toContain('rdf:RDF');
  });

  it('handles quoted triples and annotations', async () => {
    const result = await parseMarkdownLD(sampleMarkdown, { format: 'turtle' });
    expect(result.output).toContain('<<');
    expect(result.output).toContain('|');
  });

  it('generates sample ontology', () => {
    const ontology = generateSampleOntology();
    expect(ontology).toContain('[Person]');
    expect(ontology).toContain('schema:Person');
  });
});
