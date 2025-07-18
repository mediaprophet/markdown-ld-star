import rdf from 'rdf-ext';
import { dataset as datasetFactory } from 'rdf-ext';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import fs from 'fs';
import type { Term, Quad, NamedNode, BlankNode, Literal, Quad_Subject, Dataset, BaseQuad, Quad_Object } from '@rdfjs/types';
import type { Bindings } from '@comunica/types';

const jsonld = typeof window === 'undefined' ? require('jsonld') : null;

const LIBRARY_METADATA = {
  parsedBy: 'markdown-ld-star v1.5.0',
  libraryUrl: 'https://github.com/mediaprophet/markdown-ld-star'
};

// Define RDFStarQuad extending the base Quad type for better type compatibility
type RDFStarQuad = BaseQuad & {
  termType: 'Quad';
  subject: Term;
  predicate: Term;
  object: Term;
};

function isQuotedTriple(term: any): term is RDFStarQuad {
  return term && term.termType === 'Quad' && 'subject' in term && 'predicate' in term && 'object' in term;
}

function isRDFTerm(term: any): term is NamedNode | BlankNode | Literal {
  return term && (term.termType === 'NamedNode' || term.termType === 'BlankNode' || term.termType === 'Literal');
}

function quotedTriple(
  subject: NamedNode | BlankNode,
  predicate: NamedNode,
  object: NamedNode | BlankNode | Literal
): Quad {
  return rdf.quad(subject, predicate, object);
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
  const dataStore = rdfExt.dataset(dataQuads);
  const shapesParser = new N3.Parser();
  const shapesQuads = shapesParser.parse(ontologyTtl);
  const shapesStore = rdfExt.dataset(shapesQuads);
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

  const resolveUri = (part: string, defaultPrefix = 'ex'): string => {
    if (part.startsWith('http')) return part;
    const [prefix, local] = part.includes(':') ? part.split(':') : [defaultPrefix, part];
    return prefixes[prefix] ? `${prefixes[prefix]}${local}` : part;
  };

  const parseValue = (value: string): NamedNode | BlankNode | Literal | Quad => {
    value = value.trim();
    if (value.startsWith('<<') && value.endsWith('>>')) {
      const inner = value.substring(2, value.length - 2).trim();
      const parts = inner.split(/\s+/);
      if (parts.length === 3) {
        const [s, p, o] = parts;
        return quotedTriple(
          rdf.namedNode(resolveUri(s.replace(/^\[|\]$/g, ''))),
          rdf.namedNode(resolveUri(p)),
          rdf.namedNode(resolveUri(o.replace(/^\[|\]$/g, '')))
        );
      }
      throw new Error(`Invalid quoted triple format: ${value}`);
    } else if (value.startsWith('"')) {
      return rdf.literal(value.slice(1, -1));
    } else if (value.startsWith('_:')) {
      return rdf.blankNode(value.slice(2));
    } else {
      return rdf.namedNode(resolveUri(value.replace(/^\[|\]$/g, '')));
    }
  };

  for (const node of ast.children) {
    if (node.type === 'definition' && node.label && node.url) {
      prefixes[node.label] = node.url;
    } else if (node.type === 'paragraph') {
      const text = processor.stringify({ type: 'root', children: [node] }).trim();
      
      if (text.startsWith('## SHACL Constraints')) continue;
      if (text.startsWith('```sparql')) {
        const sparqlMatch = text.match(/```sparql\n([\s\S]*?)\n```/);
        if (sparqlMatch) constraints.push(sparqlMatch[1]);
        continue;
      }

      let match = text.match(/<<\s*\[([^\]]+)\]\s+([^\s]+)\s+\[([^\]]+)\]\s*>>\s*\{\|\s*([^|]+)\s*\|\}/) || 
                  text.match(/\[([^\]]+)\]\s+([^\s]+)\s+\[([^\]]+)\]\s*\{\|\s*([^|]+)\s*\|\}/);

      if (match) {
        const isQuoted = text.startsWith('<<');
        const s = match[1], p = match[2], o = match[3], annBlock = match[4];
        
        const subj = rdf.namedNode(resolveUri(s));
        const pred = rdf.namedNode(resolveUri(p));
        const obj = rdf.namedNode(resolveUri(o));

        if (!isQuoted) {
            store.add(rdf.quad(subj, pred, obj));
        }

        const qt = quotedTriple(subj, pred, obj);
        const annProps = annBlock.split(';').map((a: string) => a.trim()).filter(Boolean);
        for (const ann of annProps) {
            const [annKey, annVal] = ann.split('=').map((kv: string) => kv.trim());
            const annPred = rdf.namedNode(resolveUri(annKey));
            const annObj = parseValue(annVal);
            store.add(rdf.quad(qt, annPred, annObj));
        }
        continue;
      }
      
      match = text.match(/<<\s*\[([^\]]+)\]\s+([^\s]+)\s+\[([^\]]+)\]\s*>>\s+([^\s]+)\s+(.+)/);
      if (match) {
          const [, s, p, o, q, r] = match;
          const qt = quotedTriple(
              rdf.namedNode(resolveUri(s)),
              rdf.namedNode(resolveUri(p)),
              rdf.namedNode(resolveUri(o))
          );
          const pv = parseValue(r);
          store.add(rdf.quad(qt, rdf.namedNode(resolveUri(q)), pv));
          continue;
      }

      match = text.match(/\[([^\]]+)\](?:\{([^}]+)\})?/);
      if (match) {
        const label = match[1].trim();
        const uri = resolveUri(label.replace(/\s+/g, '_'));
        const subject = rdf.namedNode(uri);
        if (match[2]) {
          const props = match[2].split(';').map((p: string) => p.trim()).filter(Boolean);
          for (const prop of props) {
            const [key, ...valParts] = prop.split('=');
            const val = valParts.join('=').trim();
            const predUri = resolveUri(key.trim());
            const predicate = rdf.namedNode(predUri);
            if (key.trim() === 'typeof') {
              const obj = parseValue(val);
              if (isRDFTerm(obj)) {
                store.add(rdf.quad(subject, rdf.namedNode('[http://www.w3.org/1999/02/22-rdf-syntax-ns#type](http://www.w3.org/1999/02/22-rdf-syntax-ns#type)'), obj));
              }
            } else {
              const obj = parseValue(val);
              if (isRDFTerm(obj) || isQuotedTriple(obj)) {
                store.add(rdf.quad(subject, predicate, obj));
              }
            }
          }
        }
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
        return `<${term.value}>`;
      } else if (term.termType === 'Literal') {
        return `"${term.value}"`;
      } else if (term.termType === 'BlankNode') {
        return '_:' + term.value;
      } else if (isQuotedTriple(term)) {
        return `<< ${getPrefixed(term.subject)} ${getPrefixed(term.predicate)} ${getPrefixed(term.object)} >>`;
      }
      return term.value;
    };
    
    const allQuads: Quad[] = [...store];
    allQuads.forEach((quad: Quad) => {
      const subjStr = getPrefixed(quad.subject);
      const predStr = getPrefixed(quad.predicate);
      const objStr = getPrefixed(quad.object);
      turtle += `${subjStr} ${predStr} ${objStr} .\n`;
    });

    if (constraints.length > 0) {
      turtle += '\n# SHACL Constraints\n';
      for (const sparql of constraints) {
        turtle += `# SPARQL:\n# ${sparql.replace(/\n/g, '\n# ')}\n`;
        turtle += `ex:SHACLConstraint ex:query """${sparql.replace(/"/g, '\\"')}""" .\n`;
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
      '[http://www.w3.org/2000/01/rdf-schema#label](http://www.w3.org/2000/01/rdf-schema#label)',
      '[http://schema.org/name](http://schema.org/name)',
      '[http://purl.org/dc/terms/title](http://purl.org/dc/terms/title)',
      '[http://purl.org/dc/elements/1.1/title](http://purl.org/dc/elements/1.1/title)',
      '[http://ogp.me/ns#title](http://ogp.me/ns#title)',
      '[http://www.w3.org/2004/02/skos/core#prefLabel](http://www.w3.org/2004/02/skos/core#prefLabel)',
      '[http://xmlns.com/foaf/0.1/name](http://xmlns.com/foaf/0.1/name)',
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
      '[http://schema.org/description](http://schema.org/description)',
      '[http://purl.org/dc/terms/description](http://purl.org/dc/terms/description)',
      '[http://purl.org/dc/elements/1.1/description](http://purl.org/dc/elements/1.1/description)',
      '[http://ogp.me/ns#description](http://ogp.me/ns#description)',
      '[http://www.w3.org/2004/02/skos/core#definition](http://www.w3.org/2004/02/skos/core#definition)',
      '[http://rdfs.org/sioc/ns#content](http://rdfs.org/sioc/ns#content)',
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
      '[http://schema.org/url](http://schema.org/url)',
      '[http://ogp.me/ns#url](http://ogp.me/ns#url)',
      '[http://xmlns.com/foaf/0.1/page](http://xmlns.com/foaf/0.1/page)',
      '[http://xmlns.com/foaf/0.1/homepage](http://xmlns.com/foaf/0.1/homepage)',
      '[http://www.w3.org/2006/vcard/ns#url](http://www.w3.org/2006/vcard/ns#url)',
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
    // N3.js doesn't fully support RDF-star, so we may need a pre-processing step for complex cases
    const quads = parser.parse(input);
    for (const q of quads) store.add(q);
  } else if (inputFormat === 'jsonld' || inputFormat === 'jsonldstar') {
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
          let object: NamedNode | BlankNode | Literal;
          if (objEntry.type === 'uri') object = rdf.namedNode(objEntry.value);
          else if (objEntry.type === 'bnode') object = rdf.blankNode(objEntry.value.slice(2));
          else if (objEntry.type === 'literal') {
            object = rdf.literal(objEntry.value, objEntry.lang || (objEntry.datatype ? rdf.namedNode(objEntry.datatype) : undefined));
          } else continue;
          store.add(rdf.quad(subject, rdf.namedNode(p), object));
        }
      }
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
    rdf: '[http://www.w3.org/1999/02/22-rdf-syntax-ns#](http://www.w3.org/1999/02/22-rdf-syntax-ns#)',
    rdfs: '[http://www.w3.org/2000/01/rdf-schema#](http://www.w3.org/2000/01/rdf-schema#)',
    owl: '[http://www.w3.org/2002/07/owl#](http://www.w3.org/2002/07/owl#)',
    sh: '[http://www.w3.org/ns/shacl#](http://www.w3.org/ns/shacl#)',
    schema: '[http://schema.org/](http://schema.org/)',
    xsd: '[http://www.w3.org/2001/XMLSchema#](http://www.w3.org/2001/XMLSchema#)',
    dc: '[http://purl.org/dc/elements/1.1/](http://purl.org/dc/elements/1.1/)',
    dcterms: '[http://purl.org/dc/terms/](http://purl.org/dc/terms/)',
    og: '[http://ogp.me/ns#](http://ogp.me/ns#)',
    foaf: '[http://xmlns.com/foaf/0.1/](http://xmlns.com/foaf/0.1/)',
    prov: '[http://www.w3.org/ns/prov#](http://www.w3.org/ns/prov#)',
    doap: '[http://usefulinc.com/ns/doap#](http://usefulinc.com/ns/doap#)',
    gr: '[http://purl.org/goodrelations/v1#](http://purl.org/goodrelations/v1#)',
    skos: '[http://www.w3.org/2004/02/skos/core#](http://www.w3.org/2004/02/skos/core#)',
    cc: '[http://creativecommons.org/ns#](http://creativecommons.org/ns#)',
    vc: '[http://www.w3.org/2006/vcard/ns#](http://www.w3.org/2006/vcard/ns#)',
    ical: '[http://www.w3.org/2002/12/cal/ical#](http://www.w3.org/2002/12/cal/ical#)',
    wf: '[http://www.w3.org/2005/01/wf/flow#](http://www.w3.org/2005/01/wf/flow#)',
    time: '[http://www.w3.org/2006/time#](http://www.w3.org/2006/time#)',
    tzont: '[http://www.w3.org/2006/timezone#](http://www.w3.org/2006/timezone#)',
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
  if (!namespaceMap.has('ex')) namespaceMap.set('ex', '[http://example.org/](http://example.org/)');
  const prefixForNs = new Map(Array.from(namespaceMap, a => [a[1], a[0]]));

  const getPrefixed = (term: Term): string => {
    if (isQuotedTriple(term)) {
      return `<<${getPrefixed((term as RDFStarQuad).subject)} ${getPrefixed((term as RDFStarQuad).predicate)} ${getPrefixed((term as RDFStarQuad).object)}>>`;
    } else if (term.termType === 'NamedNode') {
      const ns = term.value.replace(/[^/#][^/]*$/, '');
      const local = term.value.slice(ns.length);
      const prefix = prefixForNs.get(ns);
      return prefix ? `${prefix}:${local}` : `<${term.value}>`;
    } else if (term.termType === 'BlankNode') {
      return `_:${term.value}`;
    } else if (term.termType === 'Literal') {
      return `"${term.value}"`;
    }
    throw new Error(`Unsupported term type: ${term.termType}`);
  };

  let md = '';
  for (const [prefix, ns] of namespaceMap) {
    md += `[${prefix}]: ${ns}\n`;
  }
  md += '\n';

  const allQuads: Quad[] = [...store];
  const typeQuads: Quad[] = allQuads.filter((q: Quad) => q.predicate.value === '[http://www.w3.org/1999/02/22-rdf-syntax-ns#type](http://www.w3.org/1999/02/22-rdf-syntax-ns#type)');
  const typedSubjects = [...new Set(typeQuads.map((q: Quad) => q.subject))].filter(s => s.termType === 'NamedNode');
  
  for (const subj of typedSubjects) {
    let label = getPrefixed(subj);
    if (label.includes(':')) label = label.split(':')[1].replace('>', '');

    const subjectTypeQuads: Quad[] = [...store.match(subj, rdf.namedNode('[http://www.w3.org/1999/02/22-rdf-syntax-ns#type](http://www.w3.org/1999/02/22-rdf-syntax-ns#type)'), null)];
    const types = subjectTypeQuads.map((q: Quad) => q.object);
    const type = types.length > 0 ? `typeof=${getPrefixed(types[0])}; ` : '';
    
    const subjectPropsQuads: Quad[] = [...store.match(subj, null, null)];
    const props = subjectPropsQuads.filter((q: Quad) => !isQuotedTriple(q.object));
    
    let nodeRepresentation = `[${label}]{${type}`;
    const foafNameQuad: Quad | undefined = props.find((prop: Quad) => getPrefixed(prop.predicate).endsWith(':name'));
    if (foafNameQuad && foafNameQuad.object) {
      nodeRepresentation += `${getPrefixed(foafNameQuad.predicate)}="${(foafNameQuad.object as Literal).value}"; `;
    }
    const propOrder = ['foaf:name', 'foaf:mbox', 'foaf:knows'];
    propOrder.forEach(orderKey => {
      props.filter((prop: Quad) => getPrefixed(prop.predicate).endsWith(orderKey)).forEach((prop: Quad) => {
        if (getPrefixed(prop.predicate).endsWith('foaf:name')) return;
        const o = prop.object.termType === 'Literal' ? `"${(prop.object as Literal).value}"` : getPrefixed(prop.object);
        nodeRepresentation += `${getPrefixed(prop.predicate)}=${o}; `;
      });
    });
    props.filter((prop: Quad) => !propOrder.some(pk => getPrefixed(prop.predicate).endsWith(pk)) && !getPrefixed(prop.predicate).endsWith(':type')).forEach((prop: Quad) => {
      const p = getPrefixed(prop.predicate);
      const o = prop.object.termType === 'Literal' ? `"${(prop.object as Literal).value}"` : getPrefixed(prop.object);
      nodeRepresentation += `${p}=${o}; `;
    });
    nodeRepresentation = nodeRepresentation.replace(/;\s*$/, '') + '}\n';
    md += nodeRepresentation;
  }

  const assertedQuads = allQuads.filter((q: Quad) => isRDFTerm(q.subject) && isRDFTerm(q.object));
  for (const q of assertedQuads) {
    const qt = quotedTriple(q.subject as NamedNode | BlankNode, q.predicate as NamedNode, q.object as NamedNode | BlankNode | Literal);
    const annQuads: Quad[] = [...store.match(qt, null, null)];
    if (annQuads.length > 0) {
      const s = getPrefixed(q.subject);
      const p = getPrefixed(q.predicate);
      const o = getPrefixed(q.object);
      md += `[${s.replace(/[<>]/g, '')}] ${p} [${o.replace(/[<>]/g, '')}] {| `;
      for (const ann of annQuads) {
        const ap = getPrefixed(ann.predicate);
        const ao = ann.object.termType === 'Literal' ? `"${(ann.object as Literal).value}"` : getPrefixed(ann.object);
        md += `${ap}=${ao}; `;
      }
      md = md.replace(/;\s*$/, '') + ' |}\n';
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
    md += `<<${s} ${p} ${o}>> ${qp} ${qo}\n`;
  }

  const quotedObjects = allQuads.filter((q: Quad) => isQuotedTriple(q.object));
  for (const q of quotedObjects) {
    const obj = q.object as unknown as RDFStarQuad;
    const s = getPrefixed(q.subject);
    const p = getPrefixed(q.predicate);
    const os = getPrefixed(obj.subject);
    const op = getPrefixed(obj.predicate);
    const oo = getPrefixed(obj.object);
    md += `${s} ${p} <<${os} ${op} ${oo}>>\n`;
  }

  const shaclQuads: Quad[] = [...store.match(null, rdf.namedNode('[http://www.w3.org/ns/shacl#select](http://www.w3.org/ns/shacl#select)'), null)];
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
      ds.add(rdf.quad(bnode, rdf.namedNode('[http://www.w3.org/1999/02/22-rdf-syntax-ns#subject](http://www.w3.org/1999/02/22-rdf-syntax-ns#subject)'), subj.subject));
      ds.add(rdf.quad(bnode, rdf.namedNode('[http://www.w3.org/1999/02/22-rdf-syntax-ns#predicate](http://www.w3.org/1999/02/22-rdf-syntax-ns#predicate)'), subj.predicate));
      ds.add(rdf.quad(bnode, rdf.namedNode('[http://www.w3.org/1999/02/22-rdf-syntax-ns#object](http://www.w3.org/1999/02/22-rdf-syntax-ns#object)'), subj.object));
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
      if (lit.datatype && lit.datatype.value !== '[http://www.w3.org/2001/XMLSchema#string](http://www.w3.org/2001/XMLSchema#string)') objEntry.datatype = lit.datatype.value;
    } else if (isQuotedTriple(quad.object)) {
      const bnode = rdf.blankNode();
      const obj = quad.object as RDFStarQuad;
      ds.add(rdf.quad(bnode, rdf.namedNode('[http://www.w3.org/1999/02/22-rdf-syntax-ns#subject](http://www.w3.org/1999/02/22-rdf-syntax-ns#subject)'), obj.subject));
      ds.add(rdf.quad(bnode, rdf.namedNode('[http://www.w3.org/1999/02/22-rdf-syntax-ns#predicate](http://www.w3.org/1999/02/22-rdf-syntax-ns#predicate)'), obj.predicate));
      ds.add(rdf.quad(bnode, rdf.namedNode('[http://www.w3.org/1999/02/22-rdf-syntax-ns#object](http://www.w3.org/1999/02/22-rdf-syntax-ns#object)'), obj.object));
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
[ex]: [http://example.org/](http://example.org/)
[schema]: [http://schema.org/](http://schema.org/)
[sh]: [http://www.w3.org/ns/shacl#](http://www.w3.org/ns/shacl#)

[Person]{typeof=schema:Person; schema:name="Jane Doe"}

[Person] schema:knows [Bob] {| ex:certainty=0.9 |}

<<[Person] schema:knows [Bob]>> ex:statedBy [Alice]

## SHACL Constraints

\`\`\`sparql
SELECT ?this WHERE { ?this schema:name ?name . FILTER(!isLiteral(?name)) }
\`\`\`
  `.trim();
}
