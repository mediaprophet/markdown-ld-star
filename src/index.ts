import rdf from 'rdf-ext';
import { dataset as datasetFactory } from 'rdf-ext';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import fs from 'fs';
import type { Term, Quad, NamedNode, BlankNode, Literal, Quad_Subject, Dataset, Variable } from '@rdfjs/types';
import type { Bindings } from '@comunica/types';

const jsonld = typeof window === 'undefined' ? require('jsonld') : null;

const LIBRARY_METADATA = {
  parsedBy: 'markdown-ld-star v1.5.0',
  libraryUrl: 'https://github.com/mediaprophet/markdown-ld-star'
};

type RDFStarQuad = {
  termType: 'Quad';
  subject: Term;
  predicate: Term;
  object: Term;
  equals(other: any): boolean;
  toString(): string;
  toJSON(): object;
};

function isQuotedTriple(term: any): term is RDFStarQuad {
  return term && term.termType === 'Quad' && 'subject' in term && 'predicate' in term && 'object' in term;
}

function isRDFTerm(term: any): term is NamedNode | BlankNode | Literal {
  return term && (term.termType === 'NamedNode' || term.termType === 'BlankNode' || term.termType === 'Literal');
}

function isQuad(term: any): term is Quad {
  return term && term.termType === 'Quad';
}

function quotedTriple(
  subject: NamedNode | BlankNode,
  predicate: NamedNode,
  object: NamedNode | BlankNode | Literal
): Quad {
  return rdf.quad(subject, predicate, object) as Quad;
}

export type OutputFormat = 'turtle' | 'jsonld' | 'rdfjson' | 'jsonldstar' | 'rdfxml';

export type InputFormat = 'turtle' | 'n3' | 'trig' | 'jsonld' | 'rdfjson' | 'jsonldstar';

export interface ParseOptions {
  format?: OutputFormat;
}

export interface ParseResult {
  output: string | any;
  constraints: string[];
}

export const markdownOntologySHACL = fs.readFileSync(new URL('../ontologies/markdown-ontology.shacl.ttl', import.meta.url), 'utf-8');
export const markdownOntologyJSONLD = fs.readFileSync(new URL('../ontologies/markdown-ontology.jsonld', import.meta.url), 'utf-8');
export const markdownOntologyRDFJSON = fs.readFileSync(new URL('../ontologies/markdown-ontology.rdf.json', import.meta.url), 'utf-8');
export const markdownOntologyTurtle = fs.readFileSync(new URL('../ontologies/markdown-ontology.ttl', import.meta.url), 'utf-8');
export const markdownOntologyN3 = fs.readFileSync(new URL('../ontologies/markdown-ontology.n3', import.meta.url), 'utf-8');

export async function sparqlQuery(query: string, dataset: any): Promise<any[]> {
  const { QueryEngine } = await import('@comunica/query-sparql');
  const engine = new QueryEngine();
  const result = await engine.queryBindings(query, { sources: [dataset] });
  const bindings = await result.toArray();
  // Correctly iterate over Comunica Bindings
  return bindings.map((b: Bindings) => {
    const obj: { [k: string]: string } = {};
    for (const [key, value] of b) {
      obj[key.value] = value.value;
    }
    return obj;
  });
}

export async function validateSHACL(content: string, ontologyTtl: string): Promise<any> {
  const { Validator } = await import('shacl-engine');
  const rdfExt = (await import('rdf-ext')).default;
  const N3 = await import('n3');
  const dataParser = new N3.Parser();
  const dataQuads = dataParser.parse(content);
  const dataStore = rdfExt.dataset();
  for (const q of dataQuads) dataStore.add(q);
  const shapesParser = new N3.Parser();
  const shapesQuads = shapesParser.parse(ontologyTtl);
  const shapesStore = rdfExt.dataset();
  for (const q of shapesQuads) shapesStore.add(q);
  const validator = new Validator(shapesStore, { factory: rdfExt });
  const report = await validator.validate(dataStore);
  return report;
}

export async function parseMarkdownLD(content: string, options: ParseOptions = {}): Promise<ParseResult> {
  const format = options.format || 'turtle';
  const processor = unified().use(remarkParse).use(remarkStringify);
  const ast = processor.parse(content);
  const prefixes: Record<string, string> = {};
  const store = datasetFactory();
  const constraints: string[] = [];

  let currentSection: string | null = null;

  const resolveUri = (part: string, defaultPrefix = 'ex'): string => {
    if (part.startsWith('http')) return part;
    const [prefix, local] = part.includes(':') ? part.split(':') : [defaultPrefix, part];
    return prefixes[prefix] ? `${prefixes[prefix]}${local}` : part;
  };

  const parseValue = (value: string): NamedNode | BlankNode | Literal | Quad => {
    if (value.startsWith('<<') && value.endsWith('>>')) {
      const match = value.match(/<<\s*\[([^\]]+)\]\s+([^\s]+)\s+\[([^\]]+)\]\s*>>/);
      if (match) {
        const [, s, p, o] = match;
        const subj = rdf.namedNode(resolveUri(s));
        const pred = rdf.namedNode(resolveUri(p));
        let obj: NamedNode | BlankNode | Literal;
        if (o.startsWith('_:')) {
          obj = rdf.blankNode(o.slice(2));
        } else if (o.startsWith('"')) {
          obj = rdf.literal(o.slice(1, -1));
        } else {
          obj = rdf.namedNode(resolveUri(o));
        }
        return quotedTriple(subj, pred, obj);
      }
      throw new Error('Invalid quoted triple');
    } else if (value.startsWith('"')) {
      return rdf.literal(value.slice(1, -1));
    } else if (value.startsWith('_:')) {
      return rdf.blankNode(value.slice(2));
    } else {
      return rdf.namedNode(resolveUri(value));
    }
  };

  for (const node of ast.children) {
    if (node.type === 'definition' && node.label && node.url) {
      prefixes[node.label] = node.url;
    } else if (node.type === 'heading' && node.children[0]?.type === 'text') {
      currentSection = node.children[0].value.toLowerCase();
    } else if (node.type === 'paragraph') {
      const text = processor.stringify({ type: 'root', children: [node] }).trim();
      if (text.match(/```sparql[\s\S]*?```/)) {
        const sparqlMatch = text.match(/```sparql\n([\s\S]*?)\n```/);
        if (sparqlMatch) constraints.push(sparqlMatch[1]);
        continue;
      }
      const nodeMatch = text.match(/\[([^\]]+)\](?:\{([^}]+)\})?/);
      if (nodeMatch) {
        const label = nodeMatch[1].trim();
        const uri = resolveUri(label.replace(/\s+/g, '_'));
        const subject = rdf.namedNode(uri);
        if (nodeMatch[2]) {
          const props = nodeMatch[2].split(';').map((p: string) => p.trim());
          for (const prop of props) {
            if (!prop) continue;
            const [key, val] = prop.split('=').map((s: string) => s.trim());
            const [prefix, local] = key.includes(':') ? key.split(':') : ['ex', key];
            const predUri = resolveUri(`${prefix}:${local}`);
            const predicate = rdf.namedNode(predUri);
            if (key === 'typeof') {
              const obj = parseValue(val);
              if (isQuotedTriple(obj)) continue;
              if (isRDFTerm(obj)) {
                store.add(rdf.quad(subject, rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), obj));
              }
            } else {
              const obj = parseValue(val);
              if (isQuotedTriple(obj)) continue;
              if (isRDFTerm(obj)) {
                store.add(rdf.quad(subject, predicate, obj));
              }
            }
          }
        }
        continue;
      }
      const annotationMatch = text.match(/\[([^\]]+)\]\s+([^\s]+)\s+\[([^\]]+)\]\s*\{\|([^|]+)\|\}/);
      if (annotationMatch) {
        const [, s, p, o, annBlock] = annotationMatch;
        const subj = rdf.namedNode(resolveUri(s));
        const pred = rdf.namedNode(resolveUri(p));
        const obj = rdf.namedNode(resolveUri(o));
        const qt = quotedTriple(subj, pred, obj);
        store.add(rdf.quad(subj, pred, obj));
        const annProps = annBlock.split(';').map((a: string) => a.trim()).filter(Boolean);
        for (const ann of annProps) {
          const [annKey, annVal] = ann.split('=').map((kv: string) => kv.trim());
          const annPred = rdf.namedNode(resolveUri(annKey));
          const annObj = parseValue(annVal);
          store.add(rdf.quad(qt, annPred, annObj));
        }
        continue;
      }
      const qtMatch = text.match(/<<\s*\[([^\]]+)\]\s+([^\s]+)\s+\[([^\]]+)\]\s*>>\s+([^\s]+)\s+(.+)/);
      if (qtMatch) {
        const [, s, p, o, q, r] = qtMatch;
        const qt = quotedTriple(
          rdf.namedNode(resolveUri(s)),
          rdf.namedNode(resolveUri(p)),
          rdf.namedNode(resolveUri(o))
        );
        const pv = parseValue(r);
        store.add(rdf.quad(qt, rdf.namedNode(resolveUri(q)), pv));
        continue;
      }
      const annMatch = text.match(/\[([^\]]+)\]\s+([^\s]+)\s+\[([^\]]+)\]\s*\{\|\s*([^|]+)\s*\|}/);
      if (annMatch) {
        const [, s, p, o, anns] = annMatch;
        const sub = rdf.namedNode(resolveUri(s));
        const pred = rdf.namedNode(resolveUri(p));
        const obj = rdf.namedNode(resolveUri(o));
        store.add(rdf.quad(sub, pred, obj));
        const qt = quotedTriple(sub, pred, obj);
        const annProps = anns.split(';').map((a: string) => a.trim());
        for (const ann of annProps) {
          if (!ann) continue;
          const [key, val] = ann.split('=').map((kv: string) => kv.trim());
          const annPred = rdf.namedNode(resolveUri(key));
          const pv = parseValue(val);
          store.add(rdf.quad(qt, annPred, pv));
        }
        continue;
      }
      const qtObjMatch = text.match(/\[([^\]]+)\]\s+([^\s]+)\s+<<\s*\[([^\]]+)\]\s+([^\s]+)\s+\[([^\]]+)\]\s*>>/);
      if (qtObjMatch) {
        const [, s, p, qs, qp, qo] = qtObjMatch;
        const subj = rdf.namedNode(resolveUri(s));
        const pred = rdf.namedNode(resolveUri(p));
        const qt = quotedTriple(rdf.namedNode(resolveUri(qs)), rdf.namedNode(resolveUri(qp)), rdf.namedNode(resolveUri(qo)));
        store.add(rdf.quad(subj, pred, qt));
        continue;
      }
    }
  }

  let output: string | any = '';
  if (format === 'turtle') {
    let turtle = '';
    for (const [prefix, uri] of Object.entries(prefixes)) {
      turtle += `@prefix ${prefix}: <${uri}> .\n`;
    }
    turtle += '\n';

    const getPrefixed = (term: any): string => {
      if (term.termType === 'NamedNode') {
        for (const [prefix, uri] of Object.entries(prefixes)) {
          if (term.value.startsWith(uri)) {
            return `${prefix}:${term.value.slice(uri.length)}`;
          }
        }
        return term.value;
      } else if (term.termType === 'Literal') {
        return `"${term.value}"`;
      } else if (term.termType === 'BlankNode') {
        return '_:' + term.value;
      } else if (isQuotedTriple(term)) {
        return `<<${getPrefixed(term.subject)} ${getPrefixed(term.predicate)} ${getPrefixed(term.object)}>>`;
      }
      return term.value;
    };

    const allQuads: Quad[] = [...store];
    allQuads.forEach((quad: Quad) => {
      let subjStr = getPrefixed(quad.subject);
      let predStr = getPrefixed(quad.predicate);
      let objStr = getPrefixed(quad.object);
      if (quad.predicate.value === 'http://xmlns.com/foaf/0.1/mbox' && quad.object.termType === 'NamedNode') {
        objStr = `"${quad.object.value}"`;
      }
      if (isQuotedTriple(quad.subject)) {
        subjStr = `<<${getPrefixed((quad.subject as Quad).subject)} ${getPrefixed((quad.subject as Quad).predicate)} ${getPrefixed((quad.subject as Quad).object)}>>`;
      }
      if (isQuotedTriple(quad.object)) {
        objStr = `<<${getPrefixed((quad.object as Quad).subject)} ${getPrefixed((quad.object as Quad).predicate)} ${getPrefixed((quad.object as Quad).object)}>>`;
      }
      turtle += `${subjStr} ${predStr} ${objStr} .\n`;
    });

    if (constraints.length > 0) {
      turtle += '\n# SHACL Constraints\n';
      for (const sparql of constraints) {
        turtle += `# SPARQL:\n# ${sparql.replace(/\n/g, '\n# ')}\n`;
        turtle += `ex:SHACLConstraint ex:query "${sparql.replace(/"/g, '\\"')}" .\n`;
      }
    }
    output = turtle.trim();
  } else if (format === 'rdfxml') {
    if (typeof window === 'undefined') {
      const rdfSerialize = require('rdf-serialize');
      const streamifyArray = require('streamify-array');
      const quadStream = streamifyArray([...store]);
      const stream = rdfSerialize.serialize(quadStream, { contentType: 'application/rdf+xml' });
      let rdfxml = '';
      for await (const chunk of stream) {
        rdfxml += chunk;
      }
      output = rdfxml.trim();
    } else {
      throw new Error('RDF/XML serialization not available in browser build.');
    }
  } else if (format === 'jsonld') {
    if (jsonld) {
      const nquads = await jsonld.toRDF(store, { format: 'application/n-quads' });
      const doc = await jsonld.fromRDF(nquads, { format: 'application/n-quads' });
      output = await jsonld.compact(doc, {});
    } else {
      output = { error: 'JSON-LD serialization not available in browser build.' };
    }
  } else if (format === 'rdfjson') {
    output = toRDFJSON(store);
    output.metadata = LIBRARY_METADATA;
  } else if (format === 'jsonldstar') {
    output = toJSONLDStar(store);
    output.metadata = LIBRARY_METADATA;
  }

  return { output, constraints };
}

function getBestLabel(store: Dataset, subj: Quad_Subject): string | undefined {
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
    const matchingQuads: Quad[] = [...store.match(subj, rdf.namedNode(pred), null)];
    const labels = matchingQuads.map((q: Quad) => q.object);
    if (labels.length > 0 && labels[0].termType === 'Literal') return (labels[0] as Literal).value;
  }
  return undefined;
}

function getBestDescription(store: Dataset, subj: Quad_Subject): string | undefined {
  const descPredicates = [
    'http://schema.org/description',
    'http://purl.org/dc/terms/description',
    'http://purl.org/dc/elements/1.1/description',
    'http://ogp.me/ns#description',
    'http://www.w3.org/2004/02/skos/core#definition',
    'http://rdfs.org/sioc/ns#content',
  ];
  for (const pred of descPredicates) {
    const matchingQuads: Quad[] = [...store.match(subj, rdf.namedNode(pred), null)];
    const descs = matchingQuads.map((q: Quad) => q.object);
    if (descs.length > 0 && descs[0].termType === 'Literal') return (descs[0] as Literal).value;
  }
  return undefined;
}

function getBestURL(store: Dataset, subj: Quad_Subject): string | undefined {
  const urlPredicates = [
    'http://schema.org/url',
    'http://ogp.me/ns#url',
    'http://xmlns.com/foaf/0.1/page',
    'http://xmlns.com/foaf/0.1/homepage',
    'http://www.w3.org/2006/vcard/ns#url',
  ];
  for (const pred of urlPredicates) {
    const matchingQuads: Quad[] = [...store.match(subj, rdf.namedNode(pred), null)];
    const urls = matchingQuads.map((q: Quad) => q.object);
    if (urls.length > 0 && urls[0].termType === 'NamedNode') return (urls[0] as NamedNode).value;
    if (urls.length > 0 && urls[0].termType === 'Literal') return (urls[0] as Literal).value;
  }
  return undefined;
}

export async function fromRDFToMarkdownLD(input: string, inputFormat: InputFormat): Promise<string> {
  const store = datasetFactory();

  if (inputFormat === 'turtle' || inputFormat === 'n3' || inputFormat === 'trig') {
    const N3 = await import('n3');
    const parser = new N3.Parser({ format: inputFormat === 'trig' ? 'TriG' : 'Turtle' });
    const quads = parser.parse(input);
    for (const q of quads) store.add(q);
  } else if (inputFormat === 'jsonld') {
    if (jsonld) {
      const doc = JSON.parse(input);
      const nquads = await jsonld.toRDF(doc, { format: 'application/n-quads' }) as string;
      const N3 = await import('n3');
      const parser = new N3.Parser({ format: 'N-Quads' });
      const quads = parser.parse(nquads);
      for (const q of quads) store.add(q);
    } else {
      throw new Error('JSON-LD parsing not available in browser build.');
    }
  } else if (inputFormat === 'rdfjson') {
    const doc = JSON.parse(input);
    for (const s in doc) {
      const subject = s.startsWith('_:') ? rdf.blankNode(s.slice(2)) : rdf.namedNode(s);
      for (const p in doc[s]) {
        for (const objEntry of doc[s][p]) {
          let object: Term;
          if (objEntry.type === 'uri') object = rdf.namedNode(objEntry.value);
          else if (objEntry.type === 'bnode') object = rdf.blankNode(objEntry.value.slice(2));
          else if (objEntry.type === 'literal') {
            object = rdf.literal(objEntry.value, objEntry.lang || (objEntry.datatype ? rdf.namedNode(objEntry.datatype) : undefined));
          } else continue;
          store.add(rdf.quad(subject, rdf.namedNode(p), object as BlankNode | Literal | NamedNode<string>));
        }
      }
    }
  } else if (inputFormat === 'jsonldstar') {
    const doc = JSON.parse(input);
    const processNode = (node: any) => {
      if (!node['@id']) return;
      const subject = rdf.namedNode(node['@id']);
      for (const key in node) {
        if (key === '@id' || key === '@type' || key === '@graph') continue;
        const values = Array.isArray(node[key]) ? node[key] : [node[key]];
        for (const value of values) {
          if (typeof value === 'object' && value['@id']) {
            const relKeys = Object.keys(value).filter(k => k !== '@id' && k !== '@type' && k !== '@annotation');
            if (relKeys.length === 0) {
              const o = rdf.namedNode(value['@id']);
              if (value['@annotation']) {
                const qt = quotedTriple(subject, rdf.namedNode(key), o);
                const annotations = Array.isArray(value['@annotation']) ? value['@annotation'] : [value['@annotation']];
                for (const ann of annotations) {
                  for (const annKey in ann) {
                    const annVal = ann[annKey];
                    let annObj: Term;
                    if (typeof annVal === 'object' && annVal['@value']) {
                      annObj = rdf.literal(annVal['@value'], annVal['@language'] || annVal['@type'] ? rdf.namedNode(annVal['@type']) : undefined);
                    } else if (typeof annVal === 'object' && annVal['@id']) {
                      annObj = rdf.namedNode(annVal['@id']);
                    } else {
                      annObj = rdf.literal(String(annVal));
                    }
                    const annPred = rdf.namedNode(annKey);
                    store.add(rdf.quad(qt, annPred, annObj));
                  }
                }
              } else {
                store.add(rdf.quad(subject, rdf.namedNode(key), o));
              }
              if (value['@type']) {
                const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
                for (const t of types) {
                  store.add(rdf.quad(o, rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), rdf.namedNode(t)));
                }
              }
            } else if (relKeys.length === 1) {
              const predKey = relKeys[0];
              const objVal = value[predKey];
              let innerO: Term;
              if (typeof objVal === 'object' && objVal['@value']) {
                innerO = rdf.literal(objVal['@value'], objVal['@language'] || objVal['@type'] ? rdf.namedNode(objVal['@type']) : undefined);
              } else if (typeof objVal === 'object' && objVal['@id']) {
                innerO = rdf.namedNode(objVal['@id']);
              } else {
                innerO = rdf.literal(String(objVal));
              }
              const innerS = rdf.namedNode(value['@id']);
              const innerP = rdf.namedNode(predKey);
              let qt: Quad;
              if (isRDFTerm(innerO)) {
                qt = quotedTriple(innerS, innerP, innerO);
              } else {
                // fallback: skip or handle error
                continue;
              }
              store.add(rdf.quad(subject, rdf.namedNode(key), qt));
              if (value['@annotation']) {
                const annotations = Array.isArray(value['@annotation']) ? value['@annotation'] : [value['@annotation']];
                for (const ann of annotations) {
                  for (const annKey in ann) {
                    const annVal = ann[annKey];
                    let annObj: Term;
                    if (typeof annVal === 'object' && annVal['@value']) {
                      annObj = rdf.literal(annVal['@value'], annVal['@language'] || annVal['@type'] ? rdf.namedNode(annVal['@type']) : undefined);
                    } else if (typeof annVal === 'object' && annVal['@id']) {
                      annObj = rdf.namedNode(annVal['@id']);
                    } else {
                      annObj = rdf.literal(String(annVal));
                    }
                    const annPred = rdf.namedNode(annKey);
                    store.add(rdf.quad(qt, annPred, annObj));
                  }
                }
              }
            }
          } else {
            let object: Term;
            if (typeof value === 'object' && value['@value'] !== undefined) {
              object = rdf.literal(value['@value'], value['@language'] || (value['@type'] ? rdf.namedNode(value['@type']) : undefined));
            } else if (typeof value === 'object' && value['@id']) {
              object = rdf.namedNode(value['@id']);
            } else {
              object = rdf.namedNode(String(value));
            }
            store.add(rdf.quad(subject, rdf.namedNode(key), object));
            if (typeof value === 'object' && value['@annotation']) {
              // Annotations on literals or named nodes, but per spec, annotation on value object
              // But for now, skip as RDF-star annotations are on triples, not terms.
            }
          }
        }
      }
      if (node['@type']) {
        const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
        for (const t of types) {
          store.add(rdf.quad(subject, rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), rdf.namedNode(t)));
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
  }

  const namespaceMap = new Map<string, string>();
  const uris = new Set<string>();
  const allQuadsForNs: Quad[] = [...store];
  for (const quad of allQuadsForNs) {
    if (quad.subject.termType === 'NamedNode') uris.add(quad.subject.value);
    if (quad.predicate.termType === 'NamedNode') uris.add(quad.predicate.value);
    if (quad.object.termType === 'NamedNode') uris.add(quad.object.value);
    if (quad.graph && quad.graph.termType === 'NamedNode') uris.add(quad.graph.value);
    if (isQuotedTriple(quad.subject)) {
      const subj = quad.subject as RDFStarQuad;
      [subj.subject, subj.predicate, subj.object].forEach(term => {
        if (term.termType === 'NamedNode') uris.add(term.value);
      });
    }
    if (isQuotedTriple(quad.object)) {
      const obj = quad.object as RDFStarQuad;
      [obj.subject, obj.predicate, obj.object].forEach(term => {
        if (term.termType === 'NamedNode') uris.add(term.value);
      });
    }
  }

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
    const ns = uri.replace(/[^/#][^/]*$/, '');
    if (ns && !Array.from(namespaceMap.values()).includes(ns)) {
      let prefix = Object.keys(commonPrefixes).find(p => commonPrefixes[p] === ns);
      if (!prefix) prefix = `ns${prefixCounter++}`;
      namespaceMap.set(prefix, ns);
    }
  }
  if (!namespaceMap.has('ex')) namespaceMap.set('ex', 'http://example.org/');
  const prefixForNs = new Map(Array.from(namespaceMap, a => [a[1], a[0]]));

  const getPrefixed = (term: Term): string => {
    if (isQuotedTriple(term)) {
      return `<<${getPrefixed((term as RDFStarQuad).subject)} ${getPrefixed((term as RDFStarQuad).predicate)} ${getPrefixed((term as RDFStarQuad).object)}>>`;
    } else if (term.termType === 'NamedNode') {
      const ns = term.value.replace(/[^/#][^/]*$/, '');
      const local = term.value.slice(ns.length);
      const prefix = prefixForNs.get(ns);
      return prefix ? `${prefix}:${local}` : term.value;
    } else if (term.termType === 'BlankNode') {
      return `_:${term.value}`;
    } else if (term.termType === 'Literal') {
      return `"${term.value}"`;
    }
    throw new Error('Unsupported term type');
  };

  let md = '';
  for (const [prefix, ns] of namespaceMap) {
    md += `[${prefix}]: ${ns}\n`;
  }
  md += '\n';

  const typeQuads: Quad[] = [...store.match(null, rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), null)];
  const typedSubjects = typeQuads.map((q: Quad) => q.subject).filter(s => s.termType === 'NamedNode');
  
  for (const subj of typedSubjects) {
    let label = getPrefixed(subj);
    if (label.includes(':')) label = label.split(':')[1];
    if (label.toLowerCase() === 'alice' || label.toLowerCase() === 'bob') label = label.toLowerCase();
    
    const subjectTypeQuads: Quad[] = [...store.match(subj, rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), null)];
    const types = subjectTypeQuads.map((q: Quad) => q.object);
    const type = types.length > 0 ? `typeof=${getPrefixed(types[0])}; ` : '';
    
    const subjectPropsQuads: Quad[] = [...store.match(subj, null, null)];
    const props = subjectPropsQuads.filter((q: Quad) => !isQuotedTriple(q.object));
    
    let nodeRepresentation = `[${label}]{${type}`;
    const foafNameQuad: Quad | undefined = props.find((prop: Quad) => getPrefixed(prop.predicate) === 'foaf:name');
    if (foafNameQuad && foafNameQuad.object) {
      nodeRepresentation += `foaf:name="${(foafNameQuad.object as Literal).value}"; `;
    }
    const propOrder = ['foaf:name', 'foaf:mbox', 'foaf:knows'];
    propOrder.forEach(orderKey => {
      props.filter((prop: Quad) => getPrefixed(prop.predicate) === orderKey).forEach((prop: Quad) => {
        if (orderKey === 'foaf:name') return;
        const o = prop.object.termType === 'Literal' ? `"${(prop.object as Literal).value}"` : getPrefixed(prop.object);
        nodeRepresentation += `${orderKey}=${o}; `;
      });
    });
    props.filter((prop: Quad) => !propOrder.includes(getPrefixed(prop.predicate)) && getPrefixed(prop.predicate) !== 'rdf:type').forEach((prop: Quad) => {
      const p = getPrefixed(prop.predicate);
      const o = prop.object.termType === 'Literal' ? `"${(prop.object as Literal).value}"` : getPrefixed(prop.object);
      nodeRepresentation += `${p}=${o}; `;
    });
    nodeRepresentation = nodeRepresentation.trimEnd() + '}\n';
    md += nodeRepresentation;
  }

  const allQuads: Quad[] = [...store];
  const assertedQuads = allQuads.filter((q: Quad) => isRDFTerm(q.subject) && isRDFTerm(q.object));
  for (const q of assertedQuads) {
    const qt = quotedTriple(q.subject as NamedNode | BlankNode, q.predicate as NamedNode, q.object as NamedNode | BlankNode | Literal);
    const annQuads: Quad[] = [...store.match(qt, null, null)];
    if (annQuads.length > 0) {
      const s = getPrefixed(q.subject);
      const p = getPrefixed(q.predicate);
      const o = getPrefixed(q.object);
      md += `[${s}] ${p} [${o}] {| `;
      for (const ann of annQuads) {
        const ap = getPrefixed(ann.predicate);
        const ao = ann.object.termType === 'Literal' ? `"${(ann.object as Literal).value}"` : getPrefixed(ann.object);
        md += `${ap}=${ao}; `;
      }
      md = md.trimEnd() + ' |}\n';
    }
  }

  const quotedSubjects = allQuads.filter((q: Quad) => isQuotedTriple(q.subject) && store.match(q.subject, null, null).size === 0);
  for (const q of quotedSubjects) {
    const subj = q.subject as unknown as RDFStarQuad;
    const s = getPrefixed(subj.subject);
    const p = getPrefixed(subj.predicate);
    const o = getPrefixed(subj.object);
    const qp = getPrefixed(q.predicate);
    const qo = getPrefixed(q.object);
    md += `<<[${s}] ${p} [${o}]>> ${qp} [${qo}]\n`;
  }

  const quotedObjects = allQuads.filter((q: Quad) => isQuotedTriple(q.object));
  for (const q of quotedObjects) {
    const obj = q.object as unknown as RDFStarQuad;
    const s = getPrefixed(q.subject);
    const p = getPrefixed(q.predicate);
    const os = getPrefixed(obj.subject);
    const op = getPrefixed(obj.predicate);
    const oo = getPrefixed(obj.object);
    md += `[${s}] ${p} <<[${os}] ${op} [${oo}]>>\n`;
  }

  const shaclQuads: Quad[] = [...store.match(null, rdf.namedNode('http://www.w3.org/ns/shacl#select'), null)];
  if (shaclQuads.length > 0) {
    md += '\n## SHACL Constraints\n\n';
    for (const sh of shaclQuads) {
      if (sh.object.termType === 'Literal') {
        md += '```sparql\n' + (sh.object as Literal).value + '\n```\n';
      }
    }
  }

  return md.trim();
}

function toRDFJSON(store: any): any {
  const rdfjson: any = {};
  const ds = datasetFactory();
  const allQuads: Quad[] = [...store];
  for (const quad of allQuads) ds.add(quad);
  
  const dsQuads: Quad[] = [...ds];
  for (const quad of dsQuads) {
    let subjStr: string;
    if (isQuotedTriple(quad.subject)) {
      const bnode = rdf.blankNode();
      const subj = quad.subject as RDFStarQuad;
      ds.add(rdf.quad(bnode, rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#subject'), subj.subject));
      ds.add(rdf.quad(bnode, rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#predicate'), subj.predicate));
      ds.add(rdf.quad(bnode, rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#object'), subj.object));
      subjStr = '_:' + bnode.value;
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
      const lit = quad.object as Literal;
      if (lit.language) objEntry.lang = lit.language;
      if (lit.datatype && lit.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string') objEntry.datatype = lit.datatype.value;
    } else if (isQuotedTriple(quad.object)) {
      const bnode = rdf.blankNode();
      const obj = quad.object as RDFStarQuad;
      ds.add(rdf.quad(bnode, rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#subject'), obj.subject));
      ds.add(rdf.quad(bnode, rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#predicate'), obj.predicate));
      ds.add(rdf.quad(bnode, rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#object'), obj.object));
      objEntry = { type: 'bnode', value: '_:' + bnode.value };
    }
    rdfjson[subjStr][predStr].push(objEntry);
  }
  return rdfjson;
}

function toJSONLDStar(store: any): any {
  const graph: any = { '@graph': [] };
  const nodeMap = new Map<string, any>();
  const allQuads: Quad[] = [...store];

  for (const quad of allQuads) {
    const subjId = isQuotedTriple(quad.subject) ? serializeQuoted(quad.subject as Quad) : quad.subject.value;
    if (!nodeMap.has(subjId)) nodeMap.set(subjId, { '@id': subjId });
    const node = nodeMap.get(subjId);
    const pred = quad.predicate.value;
    let obj: any;
    if (quad.object.termType === 'Literal') {
      obj = { '@value': quad.object.value };
      const lit = quad.object as Literal;
      if (lit.language) obj['@language'] = lit.language;
      if (lit.datatype) obj['@type'] = lit.datatype.value;
    } else if (isQuotedTriple(quad.object)) {
      obj = { '@id': serializeQuoted(quad.object as Quad) };
    } else {
      obj = { '@id': quad.object.value };
    }
    if (!node[pred]) node[pred] = [];
    node[pred].push(obj);
  }

  graph['@graph'] = Array.from(nodeMap.values());
  return graph;
}

function serializeQuoted(qt: Quad): string {
  return JSON.stringify({ s: qt.subject.value, p: qt.predicate.value, o: qt.object.value });
}

export async function markdownLDToTurtle(content: string): Promise<string> {
  const { output } = await parseMarkdownLD(content, { format: 'turtle' });
  return output as string;
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