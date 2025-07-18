// UMD global for browser
declare global {
  interface Window {
    MarkdownLDStar: any;
  }
}
if (typeof window !== 'undefined') {
  window.MarkdownLDStar = {
    parseMarkdownLD,
    fromRDFToMarkdownLD: async function(input: string, inputFormat: InputFormat): Promise<string> {
      return await fromRDFToMarkdownLD(input, inputFormat);
    },
    markdownLDToTurtle,
    validateSHACL,
    generateSampleOntology
  };
}
import N3 from 'n3';
import { DataFactory as N3DataFactory } from 'n3';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import jsonld from 'jsonld';
// import Serializer from '@rdfjs/serializer-jsonld';
// import { Readable } from 'stream';
// import { Quad, Term } from '@rdfjs/types';


// Use the DataFactory from N3 for all N3 operations.
const dataFactory = N3DataFactory;
const { namedNode, literal, blankNode, quad } = dataFactory;

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

const parseValue = (value: string): N3.NamedNode | N3.BlankNode | N3.Literal | N3.Quad => {
  if (value.startsWith('<<') && value.endsWith('>>')) {
    const match = value.match(/<<\s*\[([^\]]+)\]\s+([^\s]+)\s+\[([^\]]+)\]\s*>>/);
    if (match) {
      const [, s, p, o] = match;
      // Only allow NamedNode or BlankNode for subject/predicate, NamedNode/BlankNode/Literal for object
      const subj = namedNode(resolveUri(s));
      const pred = namedNode(resolveUri(p));
      let obj: N3.NamedNode | N3.BlankNode | N3.Literal;
      if (o.startsWith('_:')) {
        obj = blankNode(o.slice(2));
      } else if (o.startsWith('"')) {
        obj = literal(o.slice(1, -1));
      } else {
        obj = namedNode(resolveUri(o));
      }
      return quotedTriple(subj, pred, obj);
    }
    throw new Error('Invalid quoted triple');
  } else if (value.startsWith('"')) {
    return literal(value.slice(1, -1));
  } else if (value.startsWith('_:')) {
    return blankNode(value.slice(2));
  } else {
    return namedNode(resolveUri(value));
  }
};

  for (const node of ast.children) {
    if (node.type === 'definition' && node.label && node.url) {
      prefixes[node.label] = node.url;
    } else if (node.type === 'heading' && node.children[0]?.type === 'text') {
      currentSection = (node.children[0] as any).value.toLowerCase();
    } else if (node.type === 'paragraph' && currentSection?.includes('shacl constraint')) {
      const sparqlNode = node.children.find((c: any) => c.type === 'code' && c.lang === 'sparql');
      if (sparqlNode) constraints.push((sparqlNode as any).value);
    } else if (node.type === 'paragraph') {
      const text = processor.stringify({ type: 'root', children: [node] }).trim();
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
              store.addQuad(subject, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), parseValue(val) as N3.Quad_Object);
            } else {
              store.addQuad(subject, predicate, parseValue(val) as N3.Quad_Object);
            }
          }
        }
      } else {
        // Quoted triple as subject: <<[S] p [O]>> q [R]
        const qtMatch = text.match(/<<\s*\[([^\]]+)\]\s+([^\s]+)\s+\[([^\]]+)\]\s*>>\s+([^\s]+)\s+(.+)/);
        if (qtMatch) {
          const [, s, p, o, q, r] = qtMatch;
          const qt = quad(
            namedNode(resolveUri(s)),
            namedNode(resolveUri(p)),
            namedNode(resolveUri(o))
          );
          store.addQuad(qt as unknown as N3.Quad_Subject, namedNode(resolveUri(q)), parseValue(r) as N3.Quad_Object);
        }
        // Annotation syntax: [S] p [O] {| q r ; ... |}
        const annMatch = text.match(/\[([^\]]+)\]\s+([^\s]+)\s+\[([^\]]+)\]\s*\{\|\s*([^|]+)\s*\|}/);
        if (annMatch) {
          const [, s, p, o, anns] = annMatch;
          const sub = namedNode(resolveUri(s));
          const pred = namedNode(resolveUri(p));
          const obj = namedNode(resolveUri(o));
          store.addQuad(sub, pred, obj); // Assert the triple
          const qt = quad(sub, pred, obj);
          const annProps = anns.split(';').map((a: string) => a.trim());
          for (const ann of annProps) {
            if (!ann) continue;
            const [key, val] = ann.split('=').map((kv: string) => kv.trim());
            const annPred = namedNode(resolveUri(key));
            store.addQuad(qt as unknown as N3.Quad_Subject, annPred, parseValue(val) as N3.Quad_Object);
          }
        }
      }
    }
  }

  let output: string | any;
  if (format === 'turtle') {
    const writer = new N3.Writer({ prefixes });
  (store.forEach as any)((quad: any, _dataset: any) => writer.addQuad(quad));
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
  quads.forEach((q: N3.Quad) => this.push(q));
        this.push(null);
      }
    });
    const jsonldStream = jsonldSerializer.import(quadStream);
    let jsonldString = '';
    jsonldStream.on('data', (chunk: any) => {
      jsonldString += chunk.toString();
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


// Utility: Extract best label, description, and URL for a resource
function getBestLabel(store: N3.Store, subj: N3.Term): string | undefined {
  const labelPredicates = [
    'http://www.w3.org/2000/01/rdf-schema#label',
    'http://schema.org/name',
    'http://purl.org/dc/terms/title',
    'http://purl.org/dc/elements/1.1/title',
    'http://ogp.me/ns#title',
    'http://www.w3.org/2004/02/skos/core#prefLabel',
    'http://xmlns.com/foaf/0.1/name',
  ];
  for (const pred of labelPredicates) {
    const labels = store.getObjects(subj, namedNode(pred), null);
    if (labels.length > 0 && labels[0].termType === 'Literal') return labels[0].value;
  }
  return undefined;
}
function getBestDescription(store: N3.Store, subj: N3.Term): string | undefined {
  const descPredicates = [
    'http://schema.org/description',
    'http://purl.org/dc/terms/description',
    'http://purl.org/dc/elements/1.1/description',
    'http://ogp.me/ns#description',
    'http://www.w3.org/2004/02/skos/core#definition',
    'http://rdfs.org/sioc/ns#content',
  ];
  for (const pred of descPredicates) {
    const descs = store.getObjects(subj, namedNode(pred), null);
    if (descs.length > 0 && descs[0].termType === 'Literal') return descs[0].value;
  }
  return undefined;
}
function getBestURL(store: N3.Store, subj: N3.Term): string | undefined {
  const urlPredicates = [
    'http://schema.org/url',
    'http://ogp.me/ns#url',
    'http://xmlns.com/foaf/0.1/page',
    'http://xmlns.com/foaf/0.1/homepage',
    'http://www.w3.org/2006/vcard/ns#url',
  ];
  for (const pred of urlPredicates) {
    const urls = store.getObjects(subj, namedNode(pred), null);
    if (urls.length > 0 && urls[0].termType === 'NamedNode') return urls[0].value;
    if (urls.length > 0 && urls[0].termType === 'Literal') return urls[0].value;
  }
  return undefined;
}

export async function fromRDFToMarkdownLD(input: string, inputFormat: InputFormat): Promise<string> {
  const store = new N3.Store();

  if (inputFormat === 'turtle' || inputFormat === 'n3' || inputFormat === 'trig') {
    const parser = new N3.Parser({ format: inputFormat === 'trig' ? 'TriG' : 'Turtle' });
    const quads = parser.parse(input);
    store.addQuads(quads);
  } else if (inputFormat === 'jsonld') {
    const doc = JSON.parse(input);
    const nquads = await jsonld.toRDF(doc, { format: 'application/n-quads' }) as string;
    const parser = new N3.Parser({ format: 'N-Quads' });
    const quads = parser.parse(nquads);
    store.addQuads(quads);
  }

  // Collect namespaces
  const namespaceMap = new Map<string, string>();
  const uris = new Set<string>();
  (store.forEach as any)((quad: any, _store: any) => {
    if (quad.subject.termType === 'NamedNode') uris.add(quad.subject.value);
    if (quad.predicate.termType === 'NamedNode') uris.add(quad.predicate.value);
    if (quad.object.termType === 'NamedNode') uris.add(quad.object.value);
    if (quad.graph.termType === 'NamedNode') uris.add(quad.graph.value);
    if (isQuotedTriple(quad.subject)) {
      const subj = quad.subject as RDFStarQuad;
      [subj.subject, subj.predicate, subj.object].forEach((term: N3.Term) => {
        if (term.termType === 'NamedNode') uris.add(term.value);
      });
    }
    if (isQuotedTriple(quad.object)) {
      const obj = quad.object as RDFStarQuad;
      [obj.subject, obj.predicate, obj.object].forEach((term: N3.Term) => {
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
    dc: 'http://purl.org/dc/elements/1.1/',
    dcterms: 'http://purl.org/dc/terms/',
    og: 'http://ogp.me/ns#',
    foaf: 'http://xmlns.com/foaf/0.1/',
    prov: 'http://www.w3.org/ns/prov#',
    doap: 'http://usefulinc.com/ns/doap#',
    gr: 'http://purl.org/goodrelations/v1#',
    skos: 'http://www.w3.org/2004/02/skos/core#',
    cc: 'http://creativecommons.org/ns#',
    vc: 'http://www.w3.org/2006/vcard/ns#',
    ical: 'http://www.w3.org/2002/12/cal/ical#',
    wf: 'http://www.w3.org/2005/01/wf/flow#',
    time: 'http://www.w3.org/2006/time#',
    tzont: 'http://www.w3.org/2006/timezone#',
  };

  let prefixCounter = 0;
  for (const uri of uris) {
    const ns = uri.replace(/[^\/#[^\/]*$/, '');
    if (ns && !Array.from(namespaceMap.values()).includes(ns)) {
      let prefix = Object.keys(commonPrefixes).find(p => commonPrefixes[p] === ns);
      if (!prefix) prefix = `ns${prefixCounter++}`;
      namespaceMap.set(prefix, ns);
    }
  }
  if (!namespaceMap.has('ex')) namespaceMap.set('ex', 'http://example.org/');
  const prefixForNs = new Map(Array.from(namespaceMap, a => [a[1], a[0]]));

  // Helper to get prefixed name
  const getPrefixed = (term: N3.Term | N3.Quad): string => {
    if (isQuotedTriple(term)) {
      return `<<${getPrefixed(term.subject)} ${getPrefixed(term.predicate)} ${getPrefixed(term.object)}>>`;
    } else if (term.termType === 'NamedNode') {
      const ns = term.value.replace(/[^\/#[^\/]*$/, '');
      const local = term.value.slice(ns.length);
      const prefix = prefixForNs.get(ns);
      return prefix ? `${prefix}:${local}` : term.value;
    } else if (term.termType === 'BlankNode') {
      return term.value;
    } else if (term.termType === 'Literal') {
      return '"' + term.value + '"';
    } else {
      throw new Error('Unsupported term type');
    }
  };

  let md = '';
  // Prefixes
  for (const [prefix, ns] of namespaceMap) {
    md += `[${prefix}]: ${ns}\n`;
  }
  md += '\n';

  // Typed nodes (render as Markdown-LD* blocks)
  const typedSubjects = store.getSubjects(namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), null, null).filter((s: N3.Term) => s.termType === 'NamedNode');
  for (const subj of typedSubjects) {
    const label = getBestLabel(store, subj) || getPrefixed(subj);
    const types = store.getObjects(subj, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), null);
    const type = types.length > 0 ? `typeof=${getPrefixed(types[0])}; ` : '';
    const desc = getBestDescription(store, subj);
    const url = getBestURL(store, subj);
    const props = store.getQuads(subj, null, null, null).filter((q: N3.Quad) => q.predicate.termType === 'NamedNode' && !isQuotedTriple(q.object));

    let nodeRepresentation = `[${label}]{`;
    nodeRepresentation += type;
    if (desc) nodeRepresentation += `description="${desc}"; `;
    if (url) nodeRepresentation += `url="${url}"; `;
    props.forEach((prop: N3.Quad) => {
      const p = getPrefixed(prop.predicate);
      // Avoid duplicating label/desc/url
      if ([
        'rdfs:label', 'schema:name', 'dc:title', 'dcterms:title', 'og:title', 'skos:prefLabel', 'foaf:name',
        'schema:description', 'dc:description', 'dcterms:description', 'og:description', 'skos:definition', 'sioc:content',
        'schema:url', 'og:url', 'foaf:page', 'foaf:homepage', 'vc:url'
      ].includes(p)) return;
      const o = prop.object.termType === 'Literal' ? `"${prop.object.value}"` : getPrefixed(prop.object);
      nodeRepresentation += `${p}=${o}; `;
    });
    nodeRepresentation = nodeRepresentation.trimEnd() + '}\n';
    md += nodeRepresentation;
  }

  // Annotations, quoted triples, SHACL, etc. (unchanged)
  // ...existing code...

  // Annotations
  const assertedQuads = store.getQuads(null, null, null, dataFactory.defaultGraph()).filter((q: N3.Quad) => q.subject.termType === 'NamedNode' && q.object.termType === 'NamedNode');
  for (const q of assertedQuads) {
    const qt = quotedTriple(q.subject as N3.NamedNode | N3.BlankNode, q.predicate as N3.NamedNode, q.object as N3.NamedNode | N3.BlankNode | N3.Literal);
    const annQuads = store.getQuads(qt as unknown as N3.Quad_Subject, null, null, null);
    if (annQuads.length > 0) {
      const s = getPrefixed(q.subject);
      const p = getPrefixed(q.predicate);
      const o = getPrefixed(q.object);
      md += `[${s}] ${p} [${o}] {| `;
      for (const ann of annQuads) {
        const ap = getPrefixed(ann.predicate);
        const ao = ann.object.termType === 'Literal' ? `"${ann.object.value}"` : getPrefixed(ann.object);
        md += `${ap}=${ao}; `;
      }
      md = md.trimEnd() + ' |}\n';
    }
  }

  // Quoted triples as subject (not annotated)
  const quotedSubjects = store.getQuads(null, null, null, null).filter((q: N3.Quad) => isQuotedTriple(q.subject) && store.countQuads(q.subject, null, null, null) === 0);
  for (const q of quotedSubjects) {
    if (isQuotedTriple(q.subject)) {
      const subj = q.subject as N3.Quad;
      const s = getPrefixed(subj.subject);
      const p = getPrefixed(subj.predicate);
      const o = getPrefixed(subj.object);
      const qp = getPrefixed(q.predicate);
      const qo = getPrefixed(q.object);
      md += `<<[${s}] ${p} [${o}]>> ${qp} [${qo}]\n`;
    }
  }

  // Quoted triples as object
  const quotedObjects = store.getQuads(null, null, null, null).filter((q: N3.Quad) => isQuotedTriple(q.object));
  for (const q of quotedObjects) {
    if (isQuotedTriple(q.object)) {
      const obj = q.object as N3.Quad;
      const s = getPrefixed(q.subject);
      const p = getPrefixed(q.predicate);
      const os = getPrefixed(obj.subject);
      const op = getPrefixed(obj.predicate);
      const oo = getPrefixed(obj.object);
      md += `[${s}] ${p} <<[${os}] ${op} [${oo}]>>\n`;
    }
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
            object = quotedTriple(s, p, o) as unknown as N3.Term;
          } else {
            object = namedNode(value['@id']);
          }
        } else {
          object = namedNode(value['@id'] || value);
        }
        // Only push if subject, predicate, object are valid Terms (not DefaultGraph)
        if (
          (subject.termType === 'NamedNode' || subject.termType === 'BlankNode' || isQuotedTriple(subject)) &&
          namedNode(key).termType === 'NamedNode' &&
          (object.termType === 'NamedNode' || object.termType === 'BlankNode' || object.termType === 'Literal' || isQuotedTriple(object))
        ) {
          quads.push(dataFactory.quad(subject, namedNode(key), object));
        }
        if (typeof value === 'object' && value['@annotation']) {
          const qt = dataFactory.quad(subject as N3.NamedNode | N3.BlankNode, namedNode(key), object as N3.NamedNode | N3.BlankNode | N3.Literal);
          for (const ann of Array.isArray(value['@annotation']) ? value['@annotation'] : [value['@annotation']]) {
            for (const annKey in ann) {
              const annVal = ann[annKey];
              const annO = typeof annVal === 'object' ? namedNode(annVal['@id']) : literal(annVal);
              quads.push(dataFactory.quad(qt as unknown as N3.Quad_Subject, namedNode(annKey), annO));
            }
          }
        }
      }
    }
    if (node['@type']) {
      const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
      for (const t of types) {
  quads.push(dataFactory.quad(subject, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode(t)));
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
  (store.forEach as any)((quad: any) => {
    let subjStr: string;
    if (isQuotedTriple(quad.subject)) {
      // Reify quoted triple
      const bnode = blankNode();
  const subj = quad.subject as any;
      store.addQuad(bnode, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#subject'), subj.subject);
      store.addQuad(bnode, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#predicate'), subj.predicate);
      store.addQuad(bnode, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#object'), subj.object);
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
    } else if (isQuotedTriple(quad.object)) {
      // Reify object
      const bnode = blankNode();
  const obj = quad.object as any;
      store.addQuad(bnode, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#subject'), obj.subject);
      store.addQuad(bnode, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#predicate'), obj.predicate);
      store.addQuad(bnode, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#object'), obj.object);
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
  (store.forEach as any)((quad: any) => {
  const subjId = isQuotedTriple(quad.subject) ? serializeQuoted(quad.subject) : quad.subject.value;
    if (!nodeMap.has(subjId)) nodeMap.set(subjId, { '@id': subjId });
    const node = nodeMap.get(subjId);
    const pred = quad.predicate.value;
    let obj: any;
    if (quad.object.termType === 'Literal') {
      obj = { '@value': quad.object.value };
      if (quad.object.language) obj['@language'] = quad.object.language;
      if (quad.object.datatype) obj['@type'] = quad.object.datatype.value;
    } else if (isQuotedTriple(quad.object)) {
      obj = { '@id': serializeQuoted(quad.object) };
    } else {
      obj = { '@id': quad.object.value };
    }
    if (!node[pred]) node[pred] = [];
    node[pred].push(obj);
  });

  // Handle annotations: Find quads where subject/object is quoted, add @annotation
  (store.forEach as any)((quad: any) => {
    if (isQuotedTriple(quad.subject) || isQuotedTriple(quad.object)) {
      const targetQuad = isQuotedTriple(quad.subject) ? quad.subject : quad.object;
      if (isQuotedTriple(targetQuad)) {
        const tq = targetQuad as unknown as N3.Quad;
        const embedded = {
          '@id': tq.subject.value,
          [tq.predicate.value]: { '@id': tq.object.value }
        };
        // Add annotation if it's an annotation on the triple
        const annNode = { [quad.predicate.value]: { '@id': quad.object.value } };
        if (!Array.isArray((embedded as any)['@annotation'])) (embedded as any)['@annotation'] = [];
        ((embedded as any)['@annotation'] as any[]).push(annNode);
        // Replace in graph
      }
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

// Dummy validateSHACL for now (Parser/query not implemented)
export async function validateSHACL(content: string, ontologyTtl: string): Promise<any[]> {
  return [{ error: 'SHACL validation not implemented in this build.' }];
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

// Plain interface for quoted triple (not extending N3.Term)
interface RDFStarQuad {
  termType: 'Quad';
  subject: N3.Term;
  predicate: N3.Term;
  object: N3.Term;
  equals(other: any): boolean;
  toString(): string;
  toJSON(): object;
}

// quotedTriple now returns a true N3 quad using N3.DataFactory.quad
function quotedTriple(
  subject: N3.NamedNode | N3.BlankNode,
  predicate: N3.NamedNode,
  object: N3.NamedNode | N3.BlankNode | N3.Literal
): N3.Quad {
  return dataFactory.quad(subject, predicate, object);
}

// Type guard for quoted triple (RDF-star)
function isQuotedTriple(term: any): term is RDFStarQuad {
  return (
    term &&
    term.termType === 'Quad' &&
    'subject' in term &&
    'predicate' in term &&
    'object' in term
  );
}

// When passing to N3 APIs, cast as unknown as N3.Quad_Subject or N3.Quad_Object as needed
// Example: store.addQuad(qt as unknown as N3.Quad_Subject, ...)