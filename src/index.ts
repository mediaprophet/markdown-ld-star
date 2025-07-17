import * as N3 from 'n3';
import Parser from '@rdfjs/parser-n3';
import Serializer from '@rdfjs/serializer-jsonld';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import jsonld from 'jsonld';
import rdfParse from 'rdf-parse';
import { DataFactory } from 'rdf-data-factory';
import { Readable } from 'stream';

const factory = new DataFactory();
const { namedNode, literal, quotedTriple, blankNode } = factory;

export type OutputFormat = 'turtle' | 'jsonld' | 'rdfjson' | 'jsonldstar';

export type InputFormat = 'turtle' | 'n3' | 'trig' | 'jsonld' | 'rdfjson' | 'jsonldstar';

export interface ParseOptions {
  format?: OutputFormat;
}

export interface ParseResult {
  output: string | any; // Turtle string or JSON object
  constraints: string[];
}

const LIBRARY_METADATA = {
  parsedBy: 'markdown-ld-star v1.5.0',
  libraryUrl: 'https://github.com/mediaprophet/markdown-ld-star'
};

export function parseMarkdownLD(content: string, options: ParseOptions = {}): ParseResult {
  const format = options.format || 'turtle';
  const processor = unified().use(remarkParse).use(remarkStringify);
  const ast = processor.parse(content);
  const prefixes: { [key: string]: string } = {};
  const store = new N3.Store();
  const constraints: string[] = [];

  let currentSection: string | null = null;

  const resolveUri = (part: string, defaultPrefix = 'ex') => {
    if (part.startsWith('http')) return part;
    const [prefix, local] = part.includes(':') ? part.split(':') : [defaultPrefix, part];
    return prefixes[prefix] ? `${prefixes[prefix]}${local}` : part;
  };

  const parseValue = (value: string): N3.Term => {
    if (value.startsWith('<<') && value.endsWith('>>')) {
      const match = value.match(/<<\s*\[([^\]]+)\]\s+([^\s]+)\s+\[([^\]]+)\]\s*>>/);
      if (match) {
        const [, s, p, o] = match;
        return quotedTriple(
          namedNode(resolveUri(s)),
          namedNode(resolveUri(p)),
          namedNode(resolveUri(o))
        );
      }
      throw new Error('Invalid quoted triple');
    } else if (value.startsWith('"')) {
      return literal(value.slice(1, -1));
    } else {
      return namedNode(resolveUri(value));
    }
  };

  for (const node of ast.children) {
    if (node.type === 'definition' && node.label && node.url) {
      prefixes[node.label] = node.url;
    } else if (node.type === 'heading' && node.children[0]?.type === 'text') {
      currentSection = node.children[0].value.toLowerCase();
    } else if (node.type === 'paragraph' && currentSection?.includes('shacl constraint')) {
      const sparqlNode = node.children.find((c: any) => c.type === 'code' && c.lang === 'sparql');
      if (sparqlNode) constraints.push(sparqlNode.value);
    } else if (node.type === 'paragraph') {
      const text = processor.stringify({ type: 'paragraph', children: node.children }).trim();
      // Node syntax: [Label]{typeof=type; prop=value; ...}
      const nodeMatch = text.match(/\[([^\]]+)\](?:\{([^}]+)\})?/);
      if (nodeMatch) {
        const label = nodeMatch[1].trim();
        const uri = resolveUri(label.replace(/\s+/g, '_'));
        const subject = namedNode(uri);
        if (nodeMatch[2]) {
          const props = nodeMatch[2].split(';').map((p: string) => p.trim());
          for (const prop of props) {
            if (!prop) continue;
            const [key, val] = prop.split('=').map((s: string) => s.trim());
            const [prefix, local] = key.includes(':') ? key.split(':') : ['ex', key];
            const predUri = resolveUri(`${prefix}:${local}`);
            const predicate = namedNode(predUri);
            if (key === 'typeof') {
              store.addQuad(subject, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), parseValue(val));
            } else {
              store.addQuad(subject, predicate, parseValue(val));
            }
          }
        }
      } else {
        // Quoted triple as subject: <<[S] p [O]>> q [R]
        const qtMatch = text.match(/<<\s*\[([^\]]+)\]\s+([^\s]+)\s+\[([^\]]+)\]\s*>>\s+([^\s]+)\s+(.+)/);
        if (qtMatch) {
          const [, s, p, o, q, r] = qtMatch;
          const qt = quotedTriple(
            namedNode(resolveUri(s)),
            namedNode(resolveUri(p)),
            namedNode(resolveUri(o))
          );
          store.addQuad(qt, namedNode(resolveUri(q)), parseValue(r));
        }
        // Annotation syntax: [S] p [O] {| q r ; ... |}
        const annMatch = text.match(/\[([^\]]+)\]\s+([^\s]+)\s+\[([^\]]+)\]\s*\{\|\s*([^|]+)\s*\|}/);
        if (annMatch) {
          const [, s, p, o, anns] = annMatch;
          const sub = namedNode(resolveUri(s));
          const pred = namedNode(resolveUri(p));
          const obj = namedNode(resolveUri(o));
          store.addQuad(sub, pred, obj); // Assert the triple
          const qt = quotedTriple(sub, pred, obj);
          const annProps = anns.split(';').map((a: string) => a.trim());
          for (const ann of annProps) {
            if (!ann) continue;
            const [key, val] = ann.split('=').map((kv: string) => kv.trim());
            const annPred = namedNode(resolveUri(key));
            store.addQuad(qt, annPred, parseValue(val));
          }
        }
      }
    }
  }

  let output: string | any;
  if (format === 'turtle') {
    const writer = new N3.Writer({ prefixes });
    store.forEach((quad: N3.Quad) => writer.addQuad(quad));
    writer.end((error: Error | null, result: string) => {
      if (error) throw error;
      output = result;
    });
  } else if (format === 'jsonld') {
    const jsonldSerializer = new Serializer();
    const quads = store.getQuads(null, null, null, null);
    const quadStream = new Readable({
      objectMode: true,
      read() {
        quads.forEach(q => this.push(q));
        this.push(null);
      }
    });
    const jsonldStream = jsonldSerializer.import(quadStream);
    let jsonldString = '';
    jsonldStream.on('data', (chunk) => {
      jsonldString += chunk;
    });
    jsonldStream.on('end', () => {
      output = JSON.parse(jsonldString);
      output.metadata = LIBRARY_METADATA;
    });
  } else if (format === 'rdfjson') {
    output = toRDFJSON(store);
    output.metadata = LIBRARY_METADATA;
  } else if (format === 'jsonldstar') {
    output = toJSONLDStar(store);
    output.metadata = LIBRARY_METADATA;
  }

  return { output, constraints };
}

export async function fromRDFToMarkdownLD(input: string, inputFormat: InputFormat): Promise<string> {
  const store = new N3.Store();
  const textStream = new Readable({
    read() {
      this.push(input);
      this.push(null);
    }
  });

  const quads = await new Promise<N3.Quad[]>((resolve, reject) => {
    const q: N3.Quad[] = [];
    rdfParse.parse(textStream, { contentType: `application/${inputFormat}` })
      .on('data', (quad) => q.push(quad))
      .on('error', (error) => reject(error))
      .on('end', () => resolve(q));
  });

  store.addQuads(quads);

  // Generate Markdown-LD
  const namespaceMap = new Map<string, string>();
  const uris = new Set<string>();
  store.forEach((quad: N3.Quad) => {
    if (quad.subject.termType === 'NamedNode') uris.add(quad.subject.value);
    if (quad.predicate.termType === 'NamedNode') uris.add(quad.predicate.value);
    if (quad.object.termType === 'NamedNode') uris.add(quad.object.value);
    if (quad.graph.termType === 'NamedNode') uris.add(quad.graph.value);
    if (quad.subject.termType === 'Quad') {
      [quad.subject.subject, quad.subject.predicate, quad.subject.object].forEach((term: N3.Term) => {
        if (term.termType === 'NamedNode') uris.add(term.value);
      });
    }
    if (quad.object.termType === 'Quad') {
      [quad.object.subject, quad.object.predicate, quad.object.object].forEach((term: N3.Term) => {
        if (term.termType === 'NamedNode') uris.add(term.value);
      });
    }
  });

  const commonPrefixes: Record<string, string> = {
    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    owl: 'http://www.w3.org/2002/07/owl#',
    sh: 'http://www.w3.org/ns/shacl#',
    schema: 'http://schema.org/',
    xsd: 'http://www.w3.org/2001/XMLSchema#',
  };

  let prefixCounter = 0;
  for (const uri of uris) {
    const ns = uri.replace(/[^\/#][^\/]*$/, '');
    if (ns && !Array.from(namespaceMap.values()).includes(ns)) {
      let prefix = Object.keys(commonPrefixes).find(p => commonPrefixes[p] === ns);
      if (!prefix) prefix = `ns${prefixCounter++}`;
      namespaceMap.set(prefix, ns);
    }
  }
  if (!namespaceMap.has('ex')) namespaceMap.set('ex', 'http://example.org/');
  const prefixForNs = new Map(Array.from(namespaceMap, a => [a[1], a[0]]));

  const getPrefixed = (uri: string) => {
    const ns = uri.replace(/[^\/#][^\/]*$/, '');
    const local = uri.slice(ns.length);
    const prefix = prefixForNs.get(ns);
    if (prefix) return `${prefix}:${local}`;
    return `<${uri}>`;
  };

  let md = '';
  // Prefixes
  for (const [prefix, ns] of namespaceMap) {
    md += `[${prefix}]: ${ns}\n`;
  }
  md += '\n';

  // Typed nodes
  const typedSubjects = store.getSubjects(namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), null, null).filter(s => s.termType === 'NamedNode');
  for (const subj of typedSubjects) {
    const label = getPrefixed(subj.value).split(':')[1] || getPrefixed(subj.value);
    md += `[${label}]{`;
    const types = store.getObjects(subj, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), null);
    if (types.length > 0) md += `typeof=${getPrefixed(types[0].value)}; `;
    const props = store.getQuads(subj, null, null, null).filter(q => q.predicate.value !== 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' && q.object.termType !== 'Quad' && q.object.termType !== 'BlankNode');
    for (const prop of props) {
      const p = getPrefixed(prop.predicate.value);
      const o = prop.object.termType === 'Literal' ? `"${prop.object.value}"` : getPrefixed(prop.object.value);
      md += `${p}=${o}; `;
    }
    md = md.trimEnd() + '}\n';
  }

  // Annotations
  const assertedQuads = store.getQuads(null, null, null, DataFactory.defaultGraph()).filter((q: N3.Quad) => q.subject.termType === 'NamedNode' && q.object.termType === 'NamedNode');
  for (const q of assertedQuads) {
    const qt = quotedTriple(q.subject, q.predicate, q.object);
    const annQuads = store.getQuads(qt, null, null, null);
    if (annQuads.length > 0) {
      const s = getPrefixed(q.subject.value);
      const p = getPrefixed(q.predicate.value);
      const o = getPrefixed(q.object.value);
      md += `[${s}] ${p} [${o}] {| `;
      for (const ann of annQuads) {
        const ap = getPrefixed(ann.predicate.value);
        const ao = ann.object.termType === 'Literal' ? `"${ann.object.value}"` : getPrefixed(ann.object.value);
        md += `${ap}=${ao}; `;
      }
      md = md.trimEnd() + ' |}\n';
    }
  }

  // Quoted triples as subject (not annotated)
  const quotedSubjects = store.getQuads(null, null, null, null).filter((q: N3.Quad) => q.subject.termType === 'Quad' && store.countQuads(q.subject, null, null, null) === 0);
  for (const q of quotedSubjects) {
    const s = getPrefixed(q.subject.subject.value);
    const p = getPrefixed(q.subject.predicate.value);
    const o = getPrefixed(q.subject.object.value);
    const qp = getPrefixed(q.predicate.value);
    const qo = getPrefixed(q.object.value);
    md += `<<[${s}] ${p} [${o}]>> ${qp} [${qo}]\n`;
  }

  // Quoted triples as object
  const quotedObjects = store.getQuads(null, null, null, null).filter((q: N3.Quad) => q.object.termType === 'Quad');
  for (const q of quotedObjects) {
    const s = getPrefixed(q.subject.value);
    const p = getPrefixed(q.predicate.value);
    const os = getPrefixed(q.object.subject.value);
    const op = getPrefixed(q.object.predicate.value);
    const oo = getPrefixed(q.object.object.value);
    md += `[${s}] ${p} <<[${os}] ${op} [${oo}]>>\n`;
  }

  // SHACL constraints
  const shaclNodes = store.getQuads(null, namedNode('http://www.w3.org/ns/shacl#select'), null, null);
  if (shaclNodes.length > 0) {
    md += '\n## SHACL Constraints\n\n';
    for (const sh of shaclNodes) {
      if (sh.object.termType === 'Literal') {
        md += '```sparql\n' + sh.object.value + '\n```\n';
      }
    }
  }

  return md.trim();
}

function fromJSONLDStar(doc: any): N3.Quad[] {
  const quads: N3.Quad[] = [];
  const processNode = (node: any) => {
    if (!node['@id']) return;
    const subject = namedNode(node['@id']);
    for (const key in node) {
      if (key === '@id' || key === '@type' || key === '@annotation' || key === '@graph') continue;
      const values = Array.isArray(node[key]) ? node[key] : [node[key]];
      for (const value of values) {
        let object: N3.Term;
        if (typeof value === 'object' && value['@value'] !== undefined) {
          object = literal(value['@value'], value['@language'] || (value['@type'] ? namedNode(value['@type']) : undefined));
        } else if (typeof value === 'object' && value['@id']) {
          const keys = Object.keys(value);
          if (keys.length === 2 && keys.includes('@id') && !keys.includes('@type')) {
            const predKey = keys.find(k => k !== '@id')!;
            const objVal = value[predKey];
            const s = namedNode(value['@id']);
            const p = namedNode(predKey);
            const o = typeof objVal === 'object' && objVal['@id'] ? namedNode(objVal['@id']) : literal(objVal['@value'] || objVal);
            object = quotedTriple(s, p, o);
          } else {
            object = namedNode(value['@id']);
          }
        } else {
          object = namedNode(value['@id'] || value);
        }
        quads.push(DataFactory.quad(subject, namedNode(key), object));
        if (typeof value === 'object' && value['@annotation']) {
          const qt = quotedTriple(subject, namedNode(key), object);
          for (const ann of Array.isArray(value['@annotation']) ? value['@annotation'] : [value['@annotation']]) {
            for (const annKey in ann) {
              const annVal = ann[annKey];
              const annO = typeof annVal === 'object' ? namedNode(annVal['@id']) : literal(annVal);
              quads.push(DataFactory.quad(qt, namedNode(annKey), annO));
            }
          }
        }
      }
    }
    if (node['@type']) {
      const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
      for (const t of types) {
        quads.push(DataFactory.quad(subject, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode(t)));
      }
    }
    if (node['@graph']) {
      for (const gNode of node['@graph']) {
        processNode(gNode);
      }
    }
  };
  if (doc['@graph']) {
    for (const node of doc['@graph']) {
      processNode(node);
    }
  } else {
    processNode(doc);
  }
  return quads;
}

function toRDFJSON(store: N3.Store): any {
  const rdfjson: any = {};
  store.forEach((quad: N3.Quad) => {
    let subjStr: string;
    if (quad.subject.termType === 'Quad') {
      // Reify quoted triple
      const bnode = blankNode();
      store.addQuad(bnode, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#subject'), quad.subject.subject);
      store.addQuad(bnode, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#predicate'), quad.subject.predicate);
      store.addQuad(bnode, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#object'), quad.subject.object);
      subjStr = '_:' + bnode.value;
      // Then treat as blank
    } else {
      subjStr = quad.subject.termType === 'BlankNode' ? '_:' + quad.subject.value : quad.subject.value;
    }
    if (!rdfjson[subjStr]) rdfjson[subjStr] = {};
    const predStr = quad.predicate.value;
    if (!rdfjson[subjStr][predStr]) rdfjson[subjStr][predStr] = [];
    let objEntry: any = { value: quad.object.value };
    if (quad.object.termType === 'NamedNode') objEntry.type = 'uri';
    else if (quad.object.termType === 'BlankNode') objEntry.type = 'bnode';
    else if (quad.object.termType === 'Literal') {
      objEntry.type = 'literal';
      if (quad.object.language) objEntry.lang = quad.object.language;
      if (quad.object.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string') objEntry.datatype = quad.object.datatype.value;
    } else if (quad.object.termType === 'Quad') {
      // Reify object
      const bnode = blankNode();
      store.addQuad(bnode, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#subject'), quad.object.subject);
      store.addQuad(bnode, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#predicate'), quad.object.predicate);
      store.addQuad(bnode, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#object'), quad.object.object);
      objEntry = { type: 'bnode', value: '_:' + bnode.value };
    }
    rdfjson[subjStr][predStr].push(objEntry);
  });
  return rdfjson;
}

function toJSONLDStar(store: N3.Store): any {
  const graph: any = { '@graph': [] };
  const nodeMap = new Map<string, any>();

  // Build node map
  store.forEach((quad: N3.Quad) => {
    const subjId = quad.subject.termType === 'Quad' ? serializeQuoted(quad.subject) : quad.subject.value;
    if (!nodeMap.has(subjId)) nodeMap.set(subjId, { '@id': subjId });
    const node = nodeMap.get(subjId);
    const pred = quad.predicate.value;
    let obj: any;
    if (quad.object.termType === 'Literal') {
      obj = { '@value': quad.object.value };
      if (quad.object.language) obj['@language'] = quad.object.language;
      if (quad.object.datatype) obj['@type'] = quad.object.datatype.value;
    } else if (quad.object.termType === 'Quad') {
      obj = { '@id': serializeQuoted(quad.object) };
    } else {
      obj = { '@id': quad.object.value };
    }
    if (!node[pred]) node[pred] = [];
    node[pred].push(obj);
  });

  // Handle annotations: Find quads where subject/object is quoted, add @annotation
  store.forEach((quad: N3.Quad) => {
    if (quad.subject.termType === 'Quad' || quad.object.termType === 'Quad') {
      const targetQuad = quad.subject.termType === 'Quad' ? quad.subject : quad.object;
      const embedded = {
        '@id': targetQuad.subject.value,
        [targetQuad.predicate.value]: { '@id': targetQuad.object.value }
      };
      // Add annotation if it's an annotation on the triple
      const annNode = { [quad.predicate.value]: { '@id': quad.object.value } };
      if (!embedded['@annotation']) embedded['@annotation'] = [];
      embedded['@annotation'].push(annNode);
      // Replace in graph
    }
  });

  graph['@graph'] = Array.from(nodeMap.values());
  return graph;
}

function serializeQuoted(qt: N3.Quad): string {
  // Simple string representation for map key, e.g., JSON.stringify({ s: qt.subject.value, p: qt.predicate.value, o: qt.object.value })
  return JSON.stringify({ '@id': qt.subject.value, [qt.predicate.value]: { '@id': qt.object.value } });
}

export async function markdownLDToTurtle(content: string): Promise<string> {
  const { output } = parseMarkdownLD(content, { format: 'turtle' });
  return output as string;
}

export async function validateSHACL(content: string, ontologyTtl: string): Promise<any[]> {
  const { constraints } = parseMarkdownLD(content);
  const results: any[] = [];
  const tempStore = new N3.Store();
  const parser = new Parser();
  const quadsStream = parser.import(ontologyTtl); // Assume string input
  for await (const quad of quadsStream) {
    tempStore.addQuad(quad);
  }
  for (const constraint of constraints) {
    try {
      for await (const binding of tempStore.query(constraint)) {
        const entry: any = {};
        binding.forEach((value, key) => {
          entry[key.value] = value?.value;
        });
        results.push(entry);
      }
    } catch (error: any) {
      results.push({ error: `SHACL validation failed: ${error.message}` });
    }
  }
  return results;
}

export function generateSampleOntology(): string {
  return `
[ex]: http://example.org/
[schema]: http://schema.org/
[sh]: http://www.w3.org/ns/shacl#

[Person]{typeof=schema:Person; schema:name="Jane Doe"}

[Person] schema:knows [Bob] {| ex:certainty=0.9 |}

<<[Person] schema:knows [Bob]>> ex:statedBy [Alice]

## SHACL Constraints

\`\`\`sparql
SELECT ?this WHERE { ?this schema:name ?name . FILTER(!isLiteral(?name)) }
\`\`\`
  `.trim();
}