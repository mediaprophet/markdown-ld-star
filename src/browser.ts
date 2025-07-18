// Manual RDF-star parsing for browser builds
import rdf from 'rdf-ext';
import { dataset as createDataset } from '@rdfjs/dataset';
import type { DatasetCore } from 'rdf-js';
const factory = rdf;

function parseRdfStar(turtle: string, dataset: DatasetCore) {
  const quotedTripleRegex = /<<\s*([^>]+)\s+([^>]+)\s+([^>]+)\s*>>/g;
  let match;
  while ((match = quotedTripleRegex.exec(turtle)) !== null) {
    const [_, subject, predicate, object] = match;
    const quotedQuad = factory.quad(
      factory.namedNode(subject.trim()),
      factory.namedNode(predicate.trim()),
      factory.namedNode(object.trim())
    );
    (dataset as any).add(quotedQuad);
  }
}

function parseRdfStarWithAnnotations(turtle: string, dataset: DatasetCore) {
  const annotatedTripleRegex = /<<\s*([^>]+)\s+([^>]+)\s+([^>]+)\s*>>\s+([^ ]+)\s+([^ ;]+)\s*;/g;
  let match;
  while ((match = annotatedTripleRegex.exec(turtle)) !== null) {
    const [_, s, p, o, annotationP, annotationO] = match;
    const subjectOfAnnotation = factory.quad(
      factory.namedNode(s.trim()),
      factory.namedNode(p.trim()),
      factory.namedNode(o.trim())
    );
    const annotationQuad = factory.quad(
      subjectOfAnnotation,
      factory.namedNode(annotationP.trim()),
      factory.namedNode(annotationO.trim())
    );
    (dataset as any).add(annotationQuad);
  }
}

import {
  InputFormat
} from './index.js';

// Browser-compatible fromRDFToMarkdownLD using N3.js for Turtle/N3/Trig
import N3 from 'n3';
async function fromRDFToMarkdownLD(input: string, inputFormat: InputFormat): Promise<string> {
  try {
    if (inputFormat === 'turtle' || inputFormat === 'n3' || inputFormat === 'trig') {
      const dataset = createDataset();
      parseRdfStar(input, dataset);
      parseRdfStarWithAnnotations(input, dataset);
      const parser = new N3.Parser({ format: inputFormat === 'trig' ? 'TriG' : 'Turtle' });
      const store = new N3.Store();
      const quads = parser.parse(input);
      store.addQuads(quads);
      for (const quad of store.getQuads(null, null, null, null)) {
        (dataset as any).add(quad);
      }
      let md = '';
      const subjects = store.getSubjects(null, null, null);
      for (const subj of subjects) {
        const quads = store.getQuads(subj, null, null, null);
        md += `[${subj.value}]{`;
        for (const quad of quads) {
          md += `${quad.predicate.value}="${quad.object.value}"; `;
        }
        md = md.trimEnd() + '}\n';
      }
      return md;
    } else if (inputFormat === 'jsonld') {
      try {
        const jsonldModule = await import('jsonld');
        const jsonld = jsonldModule.default || jsonldModule;
        const doc = JSON.parse(input);
        const nquads = await jsonld.toRDF(doc, { format: 'application/n-quads' });
        return nquads;
      } catch (e: unknown) {
        return `Error: ${(e as Error).message}`;
      }
    }
    return 'Unsupported input format in browser build.';
  } catch (e: unknown) {
    return `Error: ${(e as Error).message}`;
  }
}

// Browser-specific alternative for validateSHACL
async function validateSHACL(content: string, ontologyTtl: string): Promise<any[]> {
  try {
    const shaclModule = await import('rdf-validate-shacl');
    const Validator = shaclModule.default || shaclModule;
    const N3 = await import('n3');
    const dataParser = new N3.Parser();
    const dataQuads = dataParser.parse(content);
    const dataStore = new N3.Store();
    dataStore.addQuads(dataQuads);
    const shapesParser = new N3.Parser();
    const shapesQuads = shapesParser.parse(ontologyTtl);
    const shapesStore = new N3.Store();
    shapesStore.addQuads(shapesQuads);
    const validator = new Validator(shapesStore);
    const report = await validator.validate(dataStore);
    const results = [];
    for (const result of report.results) {
      results.push({
        focusNode: result.focusNode.value,
        message: result.message.map((m: any) => m.value),
        path: result.path ? result.path.value : undefined,
        severity: result.severity.value,
        sourceConstraintComponent: result.sourceConstraintComponent.value,
        sourceShape: result.sourceShape.value
      });
    }
    if (results.length === 0) {
      results.push({ success: true, message: 'SHACL validation passed.' });
    }
    return results;
  } catch (e: unknown) {
    return [{ error: `SHACL validation failed: ${(e as Error).message}` }];
  }
}

// RDF/XML serialization in browser using rdf-serialize
async function serializeRDFXML(dataset: any): Promise<string> {
  try {
    const rdfSerializeModule = await import('rdf-serialize');
    const rdfSerialize = rdfSerializeModule.default || rdfSerializeModule;
    const streamifyArrayModule = await import('streamify-array');
    const streamifyArray = streamifyArrayModule.default || streamifyArrayModule;
    const quadStream = streamifyArray(Array.from(dataset));
    const stream = rdfSerialize.serialize(quadStream, { contentType: 'application/rdf+xml' });
    let rdfxml = '';
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: any) => {
        rdfxml += chunk.toString();
      });
      stream.on('end', () => resolve());
      stream.on('error', (err: any) => reject(err));
    });
    return rdfxml.trim();
  } catch (e: unknown) {
    return `Error: ${(e as Error).message}`;
  }
}

declare global {
  interface Window {
    MarkdownLDStar: any;
  }
}

if (typeof window !== 'undefined') {
  window.MarkdownLDStar = {
    fromRDFToMarkdownLD,
    validateSHACL
  };
}