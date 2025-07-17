(function (factory) {
  typeof define === 'function' && define.amd ? define(factory) :
  factory();
})((function () { 'use strict';

  Object.defineProperty(exports, "__esModule", { value: true });
  exports.parseMarkdownLD = parseMarkdownLD;
  exports.fromRDFToMarkdownLD = fromRDFToMarkdownLD;
  exports.markdownLDToTurtle = markdownLDToTurtle;
  exports.validateSHACL = validateSHACL;
  exports.generateSampleOntology = generateSampleOntology;
  const tslib_1 = require("tslib");
  // UMD global for browser
  exports.default = {
      parseMarkdownLD,
      fromRDFToMarkdownLD,
      markdownLDToTurtle,
      validateSHACL,
      generateSampleOntology
  };
  const n3_1 = tslib_1.__importDefault(require("n3"));
  const n3_2 = require("n3");
  const unified_1 = require("unified");
  const remark_parse_1 = tslib_1.__importDefault(require("remark-parse"));
  const remark_stringify_1 = tslib_1.__importDefault(require("remark-stringify"));
  const jsonld_1 = tslib_1.__importDefault(require("jsonld"));
  const serializer_jsonld_1 = tslib_1.__importDefault(require("@rdfjs/serializer-jsonld"));
  const stream_1 = require("stream");
  // Use the DataFactory from N3 for all N3 operations.
  const dataFactory = n3_2.DataFactory;
  const { namedNode, literal, blankNode, quad } = dataFactory;
  const LIBRARY_METADATA = {
      parsedBy: 'markdown-ld-star v1.5.0',
      libraryUrl: 'https://github.com/mediaprophet/markdown-ld-star'
  };
  function parseMarkdownLD(content, options = {}) {
      const format = options.format || 'turtle';
      const processor = (0, unified_1.unified)().use(remark_parse_1.default).use(remark_stringify_1.default);
      const ast = processor.parse(content);
      const prefixes = {};
      const store = new n3_1.default.Store();
      const constraints = [];
      let currentSection = null;
      const resolveUri = (part, defaultPrefix = 'ex') => {
          if (part.startsWith('http'))
              return part;
          const [prefix, local] = part.includes(':') ? part.split(':') : [defaultPrefix, part];
          return prefixes[prefix] ? `${prefixes[prefix]}${local}` : part;
      };
      const parseValue = (value) => {
          if (value.startsWith('<<') && value.endsWith('>>')) {
              const match = value.match(/<<\s*\[([^\]]+)\]\s+([^\s]+)\s+\[([^\]]+)\]\s*>>/);
              if (match) {
                  const [, s, p, o] = match;
                  // Only allow NamedNode or BlankNode for subject/predicate, NamedNode/BlankNode/Literal for object
                  const subj = namedNode(resolveUri(s));
                  const pred = namedNode(resolveUri(p));
                  let obj;
                  if (o.startsWith('_:')) {
                      obj = blankNode(o.slice(2));
                  }
                  else if (o.startsWith('"')) {
                      obj = literal(o.slice(1, -1));
                  }
                  else {
                      obj = namedNode(resolveUri(o));
                  }
                  return quotedTriple(subj, pred, obj);
              }
              throw new Error('Invalid quoted triple');
          }
          else if (value.startsWith('"')) {
              return literal(value.slice(1, -1));
          }
          else if (value.startsWith('_:')) {
              return blankNode(value.slice(2));
          }
          else {
              return namedNode(resolveUri(value));
          }
      };
      for (const node of ast.children) {
          if (node.type === 'definition' && node.label && node.url) {
              prefixes[node.label] = node.url;
          }
          else if (node.type === 'heading' && node.children[0]?.type === 'text') {
              currentSection = node.children[0].value.toLowerCase();
          }
          else if (node.type === 'paragraph' && currentSection?.includes('shacl constraint')) {
              const sparqlNode = node.children.find((c) => c.type === 'code' && c.lang === 'sparql');
              if (sparqlNode)
                  constraints.push(sparqlNode.value);
          }
          else if (node.type === 'paragraph') {
              const text = processor.stringify({ type: 'root', children: [node] }).trim();
              // Node syntax: [Label]{typeof=type; prop=value; ...}
              const nodeMatch = text.match(/\[([^\]]+)\](?:\{([^}]+)\})?/);
              if (nodeMatch) {
                  const label = nodeMatch[1].trim();
                  const uri = resolveUri(label.replace(/\s+/g, '_'));
                  const subject = namedNode(uri);
                  if (nodeMatch[2]) {
                      const props = nodeMatch[2].split(';').map((p) => p.trim());
                      for (const prop of props) {
                          if (!prop)
                              continue;
                          const [key, val] = prop.split('=').map((s) => s.trim());
                          const [prefix, local] = key.includes(':') ? key.split(':') : ['ex', key];
                          const predUri = resolveUri(`${prefix}:${local}`);
                          const predicate = namedNode(predUri);
                          if (key === 'typeof') {
                              store.addQuad(subject, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), parseValue(val));
                          }
                          else {
                              store.addQuad(subject, predicate, parseValue(val));
                          }
                      }
                  }
              }
              else {
                  // Quoted triple as subject: <<[S] p [O]>> q [R]
                  const qtMatch = text.match(/<<\s*\[([^\]]+)\]\s+([^\s]+)\s+\[([^\]]+)\]\s*>>\s+([^\s]+)\s+(.+)/);
                  if (qtMatch) {
                      const [, s, p, o, q, r] = qtMatch;
                      const qt = quad(namedNode(resolveUri(s)), namedNode(resolveUri(p)), namedNode(resolveUri(o)));
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
                      const qt = quad(sub, pred, obj);
                      const annProps = anns.split(';').map((a) => a.trim());
                      for (const ann of annProps) {
                          if (!ann)
                              continue;
                          const [key, val] = ann.split('=').map((kv) => kv.trim());
                          const annPred = namedNode(resolveUri(key));
                          store.addQuad(qt, annPred, parseValue(val));
                      }
                  }
              }
          }
      }
      let output;
      if (format === 'turtle') {
          const writer = new n3_1.default.Writer({ prefixes });
          store.forEach((quad, _dataset) => writer.addQuad(quad));
          writer.end((error, result) => {
              if (error)
                  throw error;
              output = result;
          });
      }
      else if (format === 'jsonld') {
          const jsonldSerializer = new serializer_jsonld_1.default();
          const quads = store.getQuads(null, null, null, null);
          const quadStream = new stream_1.Readable({
              objectMode: true,
              read() {
                  quads.forEach((q) => this.push(q));
                  this.push(null);
              }
          });
          const jsonldStream = jsonldSerializer.import(quadStream);
          let jsonldString = '';
          jsonldStream.on('data', (chunk) => {
              jsonldString += chunk.toString();
          });
          jsonldStream.on('end', () => {
              output = JSON.parse(jsonldString);
              output.metadata = LIBRARY_METADATA;
          });
      }
      else if (format === 'rdfjson') {
          output = toRDFJSON(store);
          output.metadata = LIBRARY_METADATA;
      }
      else if (format === 'jsonldstar') {
          output = toJSONLDStar(store);
          output.metadata = LIBRARY_METADATA;
      }
      return { output, constraints };
  }
  async function fromRDFToMarkdownLD(input, inputFormat) {
      const store = new n3_1.default.Store();
      if (inputFormat === 'turtle' || inputFormat === 'n3' || inputFormat === 'trig') {
          const parser = new n3_1.default.Parser({ format: inputFormat === 'trig' ? 'TriG' : 'Turtle' });
          const quads = parser.parse(input);
          store.addQuads(quads);
      }
      else if (inputFormat === 'jsonld') {
          const doc = JSON.parse(input);
          const nquads = await jsonld_1.default.toRDF(doc, { format: 'application/n-quads' });
          const parser = new n3_1.default.Parser({ format: 'N-Quads' });
          const quads = parser.parse(nquads);
          store.addQuads(quads);
      }
      // Skipped RDF/JSON-LD* streaming parse for now (rdfParse/textStream not defined)
      // Generate Markdown-LD
      const namespaceMap = new Map();
      const uris = new Set();
      store.forEach((quad, _store) => {
          if (quad.subject.termType === 'NamedNode')
              uris.add(quad.subject.value);
          if (quad.predicate.termType === 'NamedNode')
              uris.add(quad.predicate.value);
          if (quad.object.termType === 'NamedNode')
              uris.add(quad.object.value);
          if (quad.graph.termType === 'NamedNode')
              uris.add(quad.graph.value);
          if (isQuotedTriple(quad.subject)) {
              const subj = quad.subject;
              [subj.subject, subj.predicate, subj.object].forEach((term) => {
                  if (term.termType === 'NamedNode')
                      uris.add(term.value);
              });
          }
          if (isQuotedTriple(quad.object)) {
              const obj = quad.object;
              [obj.subject, obj.predicate, obj.object].forEach((term) => {
                  if (term.termType === 'NamedNode')
                      uris.add(term.value);
              });
          }
      });
      const commonPrefixes = {
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
              if (!prefix)
                  prefix = `ns${prefixCounter++}`;
              namespaceMap.set(prefix, ns);
          }
      }
      if (!namespaceMap.has('ex'))
          namespaceMap.set('ex', 'http://example.org/');
      new Map(Array.from(namespaceMap, a => [a[1], a[0]]));
      // Refactor getPrefixed to handle Term objects directly
      const getPrefixed = (term) => {
          if (isQuotedTriple(term)) {
              // Recursively handle quoted triples
              return `<<${getPrefixed(term.subject)} ${getPrefixed(term.predicate)} ${getPrefixed(term.object)}>>`;
          }
          else if (term.termType === 'NamedNode' || term.termType === 'BlankNode') {
              return term.value;
          }
          else if (term.termType === 'Literal') {
              return '"' + term.value + '"';
          }
          else {
              throw new Error('Unsupported term type');
          }
      };
      let md = '';
      // Prefixes
      for (const [prefix, ns] of namespaceMap) {
          md += `[${prefix}]: ${ns}\n`;
      }
      md += '\n';
      // Typed nodes
      const typedSubjects = store.getSubjects(namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), null, null).filter((s) => s.termType === 'NamedNode');
      for (const subj of typedSubjects) {
          const label = getPrefixed(subj);
          const types = store.getObjects(subj, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), null);
          const type = types.length > 0 ? `typeof=${getPrefixed(types[0])}; ` : '';
          const props = store.getQuads(subj, null, null, null).filter((q) => q.predicate.termType === 'NamedNode' && !isQuotedTriple(q.object));
          let nodeRepresentation = `[${label}]{`;
          nodeRepresentation += type;
          props.forEach((prop) => {
              const p = getPrefixed(prop.predicate);
              const o = prop.object.termType === 'Literal' ? `"${prop.object.value}"` : getPrefixed(prop.object);
              nodeRepresentation += `${p}=${o}; `;
          });
          nodeRepresentation = nodeRepresentation.trimEnd() + '}\n';
          md += nodeRepresentation;
      }
      // Annotations
      const assertedQuads = store.getQuads(null, null, null, dataFactory.defaultGraph()).filter((q) => q.subject.termType === 'NamedNode' && q.object.termType === 'NamedNode');
      for (const q of assertedQuads) {
          const qt = quotedTriple(q.subject, q.predicate, q.object);
          const annQuads = store.getQuads(qt, null, null, null);
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
      const quotedSubjects = store.getQuads(null, null, null, null).filter((q) => isQuotedTriple(q.subject) && store.countQuads(q.subject, null, null, null) === 0);
      for (const q of quotedSubjects) {
          if (isQuotedTriple(q.subject)) {
              const subj = q.subject;
              const s = getPrefixed(subj.subject);
              const p = getPrefixed(subj.predicate);
              const o = getPrefixed(subj.object);
              const qp = getPrefixed(q.predicate);
              const qo = getPrefixed(q.object);
              md += `<<[${s}] ${p} [${o}]>> ${qp} [${qo}]\n`;
          }
      }
      // Quoted triples as object
      const quotedObjects = store.getQuads(null, null, null, null).filter((q) => isQuotedTriple(q.object));
      for (const q of quotedObjects) {
          if (isQuotedTriple(q.object)) {
              const obj = q.object;
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
  function toRDFJSON(store) {
      const rdfjson = {};
      store.forEach((quad) => {
          let subjStr;
          if (isQuotedTriple(quad.subject)) {
              // Reify quoted triple
              const bnode = blankNode();
              const subj = quad.subject;
              store.addQuad(bnode, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#subject'), subj.subject);
              store.addQuad(bnode, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#predicate'), subj.predicate);
              store.addQuad(bnode, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#object'), subj.object);
              subjStr = '_:' + bnode.value;
              // Then treat as blank
          }
          else {
              subjStr = quad.subject.termType === 'BlankNode' ? '_:' + quad.subject.value : quad.subject.value;
          }
          if (!rdfjson[subjStr])
              rdfjson[subjStr] = {};
          const predStr = quad.predicate.value;
          if (!rdfjson[subjStr][predStr])
              rdfjson[subjStr][predStr] = [];
          let objEntry = { value: quad.object.value };
          if (quad.object.termType === 'NamedNode')
              objEntry.type = 'uri';
          else if (quad.object.termType === 'BlankNode')
              objEntry.type = 'bnode';
          else if (quad.object.termType === 'Literal') {
              objEntry.type = 'literal';
              if (quad.object.language)
                  objEntry.lang = quad.object.language;
              if (quad.object.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string')
                  objEntry.datatype = quad.object.datatype.value;
          }
          else if (isQuotedTriple(quad.object)) {
              // Reify object
              const bnode = blankNode();
              const obj = quad.object;
              store.addQuad(bnode, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#subject'), obj.subject);
              store.addQuad(bnode, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#predicate'), obj.predicate);
              store.addQuad(bnode, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#object'), obj.object);
              objEntry = { type: 'bnode', value: '_:' + bnode.value };
          }
          rdfjson[subjStr][predStr].push(objEntry);
      });
      return rdfjson;
  }
  function toJSONLDStar(store) {
      const graph = { '@graph': [] };
      const nodeMap = new Map();
      // Build node map
      store.forEach((quad) => {
          const subjId = isQuotedTriple(quad.subject) ? serializeQuoted(quad.subject) : quad.subject.value;
          if (!nodeMap.has(subjId))
              nodeMap.set(subjId, { '@id': subjId });
          const node = nodeMap.get(subjId);
          const pred = quad.predicate.value;
          let obj;
          if (quad.object.termType === 'Literal') {
              obj = { '@value': quad.object.value };
              if (quad.object.language)
                  obj['@language'] = quad.object.language;
              if (quad.object.datatype)
                  obj['@type'] = quad.object.datatype.value;
          }
          else if (isQuotedTriple(quad.object)) {
              obj = { '@id': serializeQuoted(quad.object) };
          }
          else {
              obj = { '@id': quad.object.value };
          }
          if (!node[pred])
              node[pred] = [];
          node[pred].push(obj);
      });
      // Handle annotations: Find quads where subject/object is quoted, add @annotation
      store.forEach((quad) => {
          if (isQuotedTriple(quad.subject) || isQuotedTriple(quad.object)) {
              const targetQuad = isQuotedTriple(quad.subject) ? quad.subject : quad.object;
              if (isQuotedTriple(targetQuad)) {
                  const tq = targetQuad;
                  const embedded = {
                      '@id': tq.subject.value,
                      [tq.predicate.value]: { '@id': tq.object.value }
                  };
                  // Add annotation if it's an annotation on the triple
                  const annNode = { [quad.predicate.value]: { '@id': quad.object.value } };
                  if (!Array.isArray(embedded['@annotation']))
                      embedded['@annotation'] = [];
                  embedded['@annotation'].push(annNode);
                  // Replace in graph
              }
          }
      });
      graph['@graph'] = Array.from(nodeMap.values());
      return graph;
  }
  function serializeQuoted(qt) {
      // Simple string representation for map key, e.g., JSON.stringify({ s: qt.subject.value, p: qt.predicate.value, o: qt.object.value })
      return JSON.stringify({ '@id': qt.subject.value, [qt.predicate.value]: { '@id': qt.object.value } });
  }
  async function markdownLDToTurtle(content) {
      const { output } = parseMarkdownLD(content, { format: 'turtle' });
      return output;
  }
  // Dummy validateSHACL for now (Parser/query not implemented)
  async function validateSHACL(content, ontologyTtl) {
      return [{ error: 'SHACL validation not implemented in this build.' }];
  }
  function generateSampleOntology() {
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
  // quotedTriple now returns a true N3 quad using N3.DataFactory.quad
  function quotedTriple(subject, predicate, object) {
      return dataFactory.quad(subject, predicate, object);
  }
  // Type guard for quoted triple (RDF-star)
  function isQuotedTriple(term) {
      return (term &&
          term.termType === 'Quad' &&
          'subject' in term &&
          'predicate' in term &&
          'object' in term);
  }
  // When passing to N3 APIs, cast as unknown as N3.Quad_Subject or N3.Quad_Object as needed
  // Example: store.addQuad(qt as unknown as N3.Quad_Subject, ...)

}));
if (typeof window !== "undefined" && window.MarkdownLDStar === undefined && typeof MarkdownLDStar !== "undefined") { window.MarkdownLDStar = MarkdownLDStar; }
