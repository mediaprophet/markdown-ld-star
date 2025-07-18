import { describe, it, expect } from 'vitest';

const sampleMarkdown = `
[ex]: http://example.org/
[schema]: http://schema.org/
[Person]{typeof=schema:Person; schema:name="Jane Doe"}
[Person] schema:knows [Bob] {| ex:certainty=0.9 |}
`;

describe('Markdown-LD Basic Suite (No RDF-star)', () => {
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

  // Add more basic tests as needed
});
